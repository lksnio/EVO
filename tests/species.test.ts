import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { SPECIES_ROOM, type SpeciesOver, type SpeciesPicked } from '../src/net/protocol';
import { SpeciesState } from '../src/net/schema';

// Koop: Zwei Spieler teilen ihren Laich (ein Raum je Zeitalter). Wählt einer ein Ei der nächsten Generation, beginnt sie
// für beide; stirbt jemand und es liegt kein Laich mehr da, ist die Art für beide ausgestorben.

const PORT = 26170 + Math.floor(Math.random() * 200);
const URL = `http://localhost:${PORT}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Zeit abgelaufen');
    await wait(20);
  }
}

const egg = (id: string, jaw = 0) => JSON.stringify({ id, traits: { jaw }, sex: 1, seed: 1, place: 'laichfluss', x: 1, y: 1 });

function picker(r: Room<unknown, SpeciesState>) {
  const got: SpeciesPicked[] = [];
  r.onMessage('picked', (m: SpeciesPicked) => got.push(m));
  let req = 1;
  return async (id: string) => {
    const n = req++;
    r.send('pick', { id, req: n });
    await until(() => got.some((m) => m.req === n));
    return got.find((m) => m.req === n)!;
  };
}

describe('Gemeinsame Generation mit Zuschauer-Wiedereinstieg',()=>{
 const rooms:Room<unknown,SpeciesState>[]=[];
 beforeAll(async()=>{await server.listen(PORT);});
 afterAll(async()=>{for(const r of rooms)await Promise.race([r.leave().catch(()=>undefined),wait(500)]);await server.gracefullyShutdown(false);});
 async function pair(){
  const a=await new Client(URL).create<SpeciesState>(SPECIES_ROOM,{epoch:0,name:'Anna'},SpeciesState);
  const b=await new Client(URL).joinById<SpeciesState>(a.roomId,{name:'Ben'},SpeciesState);rooms.push(a,b);
  a.onMessage('advanced',()=>undefined);b.onMessage('advanced',()=>undefined);
  return {a,b};
 }
 it('ein Generationswechsel entfernt die alten Eier für alle; alte Laichmeldungen können sie nicht zurückbringen',async()=>{
  const {a,b}=await pair();const trace=[{form:0,primary:0},{form:7,primary:3}];
  a.send('hello',{gen:1,pool:[egg('oldone')],next:[egg('nexta')]});b.send('hello',{gen:1,pool:[],next:[JSON.stringify({...JSON.parse(egg('nextb')),trace})]});
  await until(()=>a.state.pool.size===1&&a.state.next.size===2);
  const pickA=picker(a),pickB=picker(b);const chosen=await pickB('nextb');expect(chosen.gen).toBe(2);expect(JSON.parse(chosen.egg).trace).toEqual(trace);
  await until(()=>a.state.gen===2&&a.state.pool.size===1&&a.state.next.size===0);expect(a.state.pool.has('oldone')).toBe(false);
  expect((await pickA('oldone')).egg).toBe('');
  a.send('lay',{gen:1,eggs:[egg('lateold')]});a.send('hello',{gen:1,pool:[egg('oldone')],next:[]});
  await wait(80);expect(a.state.pool.size).toBe(1);expect(a.state.gen).toBe(2);
  // The still-living first generation may contribute its children to the current generation.
  a.send('lay',{gen:2,eggs:[egg('raceegg')]});await until(()=>a.state.pool.size===2);
  const [x,y]=await Promise.all([pickA('raceegg'),pickB('raceegg')]);expect([x,y].filter(r=>!!r.egg)).toHaveLength(1);
 });
 it('der Tod einer Linie löscht weder lebende Mitspieler noch deren spätere Nachkommen',async()=>{
  const {a,b}=await pair();const over:SpeciesOver[]=[];
  a.onMessage('extinct',(m:SpeciesOver)=>over.push(m));b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,pool:[],next:[]});b.send('hello',{gen:1,pool:[],next:[]});
  await until(()=>a.state.gen===1&&b.state.gen===1);
  a.send('extinct',{cause:'Räuber'});await wait(150);expect(a.state.over).toBe('');expect(over).toHaveLength(0);
  b.send('lay',{gen:2,eggs:[egg('survive1')]});await until(()=>a.state.next.has('survive1'));
  expect((await picker(a)('survive1')).gen).toBe(2);
 });
 it('beim Generationswechsel verschwinden auch Markierungen auf abgelaufenen Eiern',async()=>{
  const {a,b}=await pair();a.send('hello',{gen:1,pool:[egg('marka')],next:[egg('markb'),egg('markc')]});b.send('hello',{gen:1,pool:[],next:[]});
  await until(()=>b.state.pool.size===1&&b.state.next.size===2);
  a.send('select',{id:'marka'});b.send('select',{id:'marka'});await until(()=>a.state.selections.size===2);
  expect((await picker(a)('markb')).gen).toBe(2);await until(()=>b.state.selections.size===0&&b.state.pool.size===1);
  expect(b.state.pool.has('marka')).toBe(false);b.send('select',{id:'markc'});await until(()=>a.state.selections.size===1);
  await b.leave();await until(()=>a.state.members.size===1&&a.state.selections.size===0);
 });
 it('nur wenn alle Spieler ohne Eier ausgestorben sind endet die gemeinsame Art',async()=>{
  const {a,b}=await pair();a.onMessage('extinct',()=>undefined);b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,pool:[],next:[]});b.send('hello',{gen:1,pool:[],next:[]});await until(()=>a.state.gen===1);
  a.send('extinct',{cause:'Test'});b.send('extinct',{cause:'Test'});await until(()=>a.state.over!=='');
 });
 it('stellt nur aktuelle und nächste Eier wieder her; frühere und zu weit zukünftige Eier sind unbenutzbar',async()=>{
  const {a,b}=await pair();const at=(id:string,generation:number)=>JSON.stringify({...JSON.parse(egg(id)),generation});
  a.send('hello',{gen:5,pool:[at('older2',2),at('same5',5)],next:[at('future7',7),at('nextsix',6)]});
  await until(()=>b.state.pool.size===1&&b.state.next.size===1);
  const pick=picker(b);expect((await pick('older2')).egg).toBe('');expect((await pick('future7')).egg).toBe('');
  expect((await pick('nextsix')).gen).toBe(6);await until(()=>a.state.pool.size===0);
  expect((await pick('same5')).egg).toBe('');
 });
 it('ein wartender Spieler bleibt Zuschauer bis er ein neues Ei wählen kann',async()=>{
  const {a,b}=await pair();a.onMessage('extinct',()=>undefined);b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,identity:'anna123',place:'riff',pool:[],next:[]});b.send('hello',{gen:1,identity:'ben1234',place:'laichfluss',pool:[],next:[]});
  await until(()=>a.state.gen===1&&b.state.presence.size===2);
  a.send('extinct',{cause:'Räuber',ended:true});await until(()=>JSON.parse(b.state.presence.get(a.sessionId)!).alive===false);
  expect(a.state.over).toBe('');expect(JSON.parse(a.state.presence.get(b.sessionId)!).alive).toBe(true);
  const trace=[{form:0,primary:0},{form:7,primary:3}];b.send('lay',{gen:2,eggs:[JSON.stringify({...JSON.parse(egg('returnegg')),trace})]});
  await until(()=>a.state.next.has('returnegg'));const picked=await picker(a)('returnegg');expect(picked.gen).toBe(2);expect(JSON.parse(picked.egg).trace).toEqual(trace);
  await until(()=>JSON.parse(b.state.presence.get(a.sessionId)!).alive===true);
 });

 it('beendet die Art, wenn der letzte lebende Spieler geht und nur Zuschauer ohne Eier übrig sind',async()=>{
  const {a,b}=await pair();a.onMessage('extinct',()=>undefined);b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,pool:[],next:[],waiting:true});b.send('hello',{gen:1,pool:[],next:[]});
  await until(()=>a.state.gen===1&&a.state.presence.size===2);
  a.send('lay',{gen:2,eggs:[egg('invaliddead')]});await wait(80);expect(a.state.next.size).toBe(0);
  await b.leave();await until(()=>a.state.over!=='');
 });

});
