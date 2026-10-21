import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { SPECIES_ROOM, type SpeciesAdvanced, type SpeciesJoin, type SpeciesOver, type SpeciesPicked } from '../src/net/protocol';
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

const join = (name: string) => new Client(URL).joinOrCreate<SpeciesState>(SPECIES_ROOM, { epoch: 0, name } satisfies SpeciesJoin, SpeciesState);
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

describe('Die gemeinsame Art (Koop)', () => {
  const rooms: Room<unknown, SpeciesState>[] = [];

  beforeAll(async () => {
    await server.listen(PORT);
  });

  afterAll(async () => {
    for (const r of rooms) await Promise.race([r.leave().catch(() => undefined), wait(500)]);
    await server.gracefullyShutdown(false);
  });

  it('ein gemeinsamer Laich – der Generationssprung gilt für beide – ohne Laich stirbt die Art für beide aus', async () => {
    const a = await join('Anna');
    const b = await join('Ben');
    rooms.push(a, b);
    expect(a.roomId).toBe(b.roomId);
    const adv: SpeciesAdvanced[] = [], overA: SpeciesOver[] = [], overB: SpeciesOver[] = [];
    a.onMessage('advanced', (m: SpeciesAdvanced) => adv.push(m));
    a.onMessage('extinct', (m: SpeciesOver) => overA.push(m));
    b.onMessage('extinct', (m: SpeciesOver) => overB.push(m));
    // Anna beginnt die Art: Generation 1, drei Eier für Generation 2
    a.send('hello', { gen: 1, pool: [], next: [egg('aaaa1'), egg('aaaa2'), egg('aaaa3')] });
    await until(() => b.state.gen === 1 && b.state.next.size === 3);
    expect(b.state.members.size).toBe(2);
    // Ben kommt mit nichts dazu – und laicht selbst zwei Eier (seine Eier gehören zur Generation 2)
    b.send('hello', { gen: 1, pool: [], next: [] });
    b.send('lay', { gen: 2, eggs: [egg('bbbb1', 0.2), egg('bbbb2')] });
    await until(() => a.state.next.size === 5);
    // ein Ei, das es schon gab, kommt nicht doppelt (etwa nach einem Neuladen)
    a.send('hello', { gen: 1, pool: [], next: [egg('aaaa1')] });
    await wait(150);
    expect(a.state.next.size).toBe(5);
    // Ben wählt Bens Ei aus der nächsten Generation: Generation 2 beginnt – für beide, die übrigen vier sind Geschwister
    const pickB = picker(b), pickA = picker(a);
    const r1 = await pickB('bbbb1');
    expect(r1.group).toBe('next');
    expect(r1.gen).toBe(2);
    expect(JSON.parse(r1.egg).traits.jaw).toBe(0.2);
    await until(() => a.state.gen === 2 && a.state.pool.size === 4 && a.state.next.size === 0);
    await until(() => adv.length > 0);
    expect(adv[0]).toEqual({ name: 'Ben', gen: 2 });
    // Anna lebt noch (Generation 1) und laicht: Ihre Eier gehören zu Generation 2 – zu den Geschwistern
    a.send('lay', { gen: 2, eggs: [egg('aaaa4')] });
    await until(() => b.state.pool.size === 5);
    // Eier aus Generation 1 gibt es nicht mehr (dorthin führt kein Weg zurück)
    a.send('lay', { gen: 1, eggs: [egg('aaaa5')] });
    await wait(150);
    expect(b.state.pool.size + b.state.next.size).toBe(5);
    // wer zuerst kommt: Ein Ei bekommt nur einer
    const [x, y] = await Promise.all([pickA('aaaa2'), pickB('aaaa2')]);
    expect([x.egg, y.egg].filter(Boolean).length).toBe(1);
    await until(() => a.state.pool.size === 4);
    // die übrigen schlüpfen nach und nach …
    for (const id of [...a.state.pool.keys()]) expect((await pickA(id)).egg).not.toBe('');
    await until(() => b.state.pool.size === 0);
    // … dann stirbt Anna, und es liegt kein Laich mehr da: Die Art ist ausgestorben – für beide
    a.send('extinct', { cause: 'Von einem Räuber gefressen' });
    await until(() => overA.length > 0 && overB.length > 0);
    expect(overB[0].name).toBe('Anna');
    await until(() => b.state.over !== '');
    // eine neue Linie beginnt eine neue Art
    b.send('hello', { gen: 1, pool: [], next: [egg('cccc1')] });
    await until(() => a.state.over === '' && a.state.gen === 1 && a.state.next.size === 1);
  });

  it('solange Laich da ist, stirbt die Art nicht aus', async () => {
    const c = await new Client(URL).joinOrCreate<SpeciesState>(SPECIES_ROOM, { epoch: 1, name: 'Cleo' } satisfies SpeciesJoin, SpeciesState);
    rooms.push(c);
    c.send('hello', { gen: 3, pool: [egg('dddd1')], next: [] });
    await until(() => c.state.gen === 3 && c.state.pool.size === 1);
    c.send('extinct', { cause: 'Test' });
    await wait(200);
    expect(c.state.over).toBe('');
  });
});
