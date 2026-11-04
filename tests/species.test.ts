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

describe('Unabhängige Koop-Linien im gemeinsamen Laich',()=>{
 const rooms:Room<unknown,SpeciesState>[]=[];
 beforeAll(async()=>{await server.listen(PORT);});
 afterAll(async()=>{for(const r of rooms)await Promise.race([r.leave().catch(()=>undefined),wait(500)]);await server.gracefullyShutdown(false);});
 async function pair(){
  const a=await new Client(URL).create<SpeciesState>(SPECIES_ROOM,{epoch:0,name:'Anna'},SpeciesState);
  const b=await new Client(URL).joinById<SpeciesState>(a.roomId,{name:'Ben'},SpeciesState);rooms.push(a,b);
  a.onMessage('advanced',()=>undefined);b.onMessage('advanced',()=>undefined);
  return {a,b};
 }
 it('zwei Linien entwickeln sich unabhängig; ein fremdes Ei übernimmt exakt dessen Abstammung',async()=>{
  const {a,b}=await pair();
  const root={form:0,primary:0};const ta=[root,{form:1,primary:1}],tb=[root,{form:7,primary:3}];
  a.send('hello',{gen:1,trace:JSON.stringify([root]),pool:[egg('aaaa1')],next:[JSON.stringify({...JSON.parse(egg('aaaa2')),trace:ta})]});
  b.send('hello',{gen:1,trace:JSON.stringify([root]),pool:[],next:[JSON.stringify({...JSON.parse(egg('bbbb2')),trace:tb})]});
  await until(()=>b.state.pool.size===3&&a.state.branches.size===2);
  const pickA=picker(a),pickB=picker(b);
  const first=await pickB('bbbb2');expect(first.gen).toBe(2);expect(JSON.parse(first.egg).trace).toEqual(tb);
  await until(()=>a.state.pool.size===2);
  expect(a.state.pool.has('aaaa1')).toBe(true);expect(a.state.pool.has('aaaa2')).toBe(true);
  // Ben advances again while Anna's first-generation sibling and offspring remain available.
  b.send('lay',{gen:3,eggs:[JSON.stringify({...JSON.parse(egg('bbbb3')),trace:[...tb,{form:8,primary:3}]})]});
  await until(()=>a.state.pool.has('bbbb3'));
  expect((await pickB('bbbb3')).gen).toBe(3);
  expect(a.state.pool.has('aaaa1')).toBe(true);
  const adopted=await pickA('aaaa2');expect(adopted.gen).toBe(2);expect(JSON.parse(adopted.egg).trace).toEqual(ta);
  // One physical egg is allocated once, even when both choose it at the same time.
  const [x,y]=await Promise.all([pickA('aaaa1'),pickB('aaaa1')]);expect([x,y].filter(r=>!!r.egg)).toHaveLength(1);
 });
 it('der Tod einer Linie löscht weder lebende Mitspieler noch deren spätere Nachkommen',async()=>{
  const {a,b}=await pair();const over:SpeciesOver[]=[];
  a.onMessage('extinct',(m:SpeciesOver)=>over.push(m));b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,pool:[],next:[]});b.send('hello',{gen:1,pool:[],next:[]});
  await until(()=>a.state.gen===1&&b.state.gen===1);
  a.send('extinct',{cause:'Räuber'});await wait(150);expect(a.state.over).toBe('');expect(over).toHaveLength(0);
  b.send('lay',{gen:2,eggs:[egg('survive1')]});await until(()=>a.state.pool.has('survive1'));
  expect((await picker(a)('survive1')).gen).toBe(2);
 });
 it('Markieren reserviert kein Ei; ein Generationswechsel entfernt nur die Auswahl des schlüpfenden Spielers',async()=>{
  const {a,b}=await pair();
  a.send('hello',{gen:1,pool:[egg('marka')],next:[egg('markb'),egg('markc')]});
  b.send('hello',{gen:1,pool:[],next:[]});await until(()=>b.state.pool.size===3);
  a.send('select',{id:'marka'});b.send('select',{id:'marka'});await until(()=>a.state.selections.size===2);
  const pickA=picker(a);expect((await pickA('markb')).gen).toBe(2);
  await until(()=>b.state.selections.size===1);expect(b.state.pool.has('marka')).toBe(true);
  expect(b.state.selections.get(b.sessionId)).toBe('marka');
  b.send('select',{id:'unknown'});await wait(80);expect(a.state.selections.get(b.sessionId)).toBe('marka');
  await b.leave();await until(()=>a.state.members.size===1&&a.state.selections.size===0);
 });
 it('nur wenn alle Spieler ohne Eier ausgestorben sind endet die gemeinsame Art',async()=>{
  const {a,b}=await pair();a.onMessage('extinct',()=>undefined);b.onMessage('extinct',()=>undefined);
  a.send('hello',{gen:1,pool:[],next:[]});b.send('hello',{gen:1,pool:[],next:[]});await until(()=>a.state.gen===1);
  a.send('extinct',{cause:'Test'});b.send('extinct',{cause:'Test'});await until(()=>a.state.over!=='');
 });
 it('bewahrt die Generation jedes Eis auch beim Wiederherstellen gemischten Laichs',async()=>{
  const {a,b}=await pair();
  const at=(id:string,generation:number)=>JSON.stringify({...JSON.parse(egg(id)),generation});
  a.send('hello',{gen:5,pool:[at('older2',2),at('same5',5)],next:[at('future7',7)]});
  await until(()=>b.state.pool.size===3);
  expect(JSON.parse(b.state.pool.get('older2')!).generation).toBe(2);expect(JSON.parse(b.state.pool.get('future7')!).generation).toBe(7);
  const pick=picker(b);expect((await pick('future7')).gen).toBe(7);expect((await pick('older2')).gen).toBe(2);
  expect(a.state.pool.has('same5')).toBe(true);
 });

});
