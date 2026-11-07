import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { SpeciesState } from '../src/net/schema';
import { SPECIES_ROOM, type SpeciesPicked } from '../src/net/protocol';
import { firstPlayable } from '../src/data/epochs';
import { breedLineage, newLineageEvolution, type LineageEvolution, type LineageHabitat } from '../src/sim/lineageEvolution';
import { continuesEvolution, MAX_EVOLUTION_TRACE, networkEvolutionTrace, networkSpeciesBranch } from '../src/net/lineageProtocol';
import { networkMorph } from '../src/net/morphProtocol';
import { LINEAGE_FORMS } from '../src/sim/lineageEvolution';

const legacy = [{ form: 0, primary: 0 }];
function route(habitat: LineageHabitat): LineageEvolution[] {
  const trace = [newLineageEvolution()];
  for (let i = 0; i < 5; i++) trace.push(breedLineage(trace.at(-1), habitat, habitat === 'water' ? { biteDamage: 100 } : { ramDamage: 100 }));
  return trace;
}

describe('bounded cooperative lineage messages', () => {
  it('preserves every supported peer body form and rejects arbitrary renderer identifiers', () => {
    for (const form of LINEAGE_FORMS) {
      expect(networkMorph(JSON.stringify({ cls: 'fish', size: 1, lineageForm: form })))
        .toMatchObject({ cls: 'fish', size: 1, lineageForm: form });
    }
    expect(networkMorph({ cls: 'fish', size: 100, lineageForm: '/arbitrary-asset' })).toEqual({ cls: 'fish', size: 2.5 });
    expect(networkMorph({ cls: 'fish', size: 1, lineageForm: 123 })).not.toHaveProperty('lineageForm');
    expect(networkMorph({ cls: 'amphibian', size: 1, lineageForm: 'water' })).not.toHaveProperty('lineageForm');
    expect(networkMorph({ cls: '__proto__' })).toBeUndefined();
    expect(networkMorph('{invalid')).toBeUndefined();
  });

  it('normalises valid history without accepting malformed/defaulted or unbounded states', () => {
    const trace = route('water');
    expect(networkEvolutionTrace(JSON.stringify(trace))).toEqual(trace);
    expect(networkEvolutionTrace([{}])).toBeUndefined();
    expect(networkEvolutionTrace([{ ...trace[0], habitatProgress: 2, habitat: 'water' }])).toBeUndefined();
    expect(networkEvolutionTrace([{ ...trace[0], specialization: Number.NaN }])).toBeUndefined();
    expect(networkEvolutionTrace(Array.from({ length: MAX_EVOLUTION_TRACE + 1 }, () => trace[0]))).toBeUndefined();
    expect(networkSpeciesBranch(JSON.stringify({ id: 'peer-anna', name: 'Anna', evolutionTrace: trace })))
      .toMatchObject({ trace: legacy, evolutionTrace: trace });
  });

  it('keeps training within a visual milestone and bounded history shifts on one branch', () => {
    const trace = route('water');
    const trained = trace.map(state => ({ ...state }));
    trained.at(-1)!.births += 1;
    trained.at(-1)!.bite += 1;
    expect(continuesEvolution(trace, trained)).toBe(true);
    expect(continuesEvolution(trace.slice(0, 4), trace)).toBe(true);
    expect(continuesEvolution(trace, route('shore'))).toBe(false);
    const full = Array.from({ length: MAX_EVOLUTION_TRACE }, (_, i) => ({ ...trace[0], habitatProgress: i % 2, births: i }));
    expect(continuesEvolution(full, [...full.slice(1), { ...trace[0], births: 24 }])).toBe(true);
  });
});

const PORT = 28170 + Math.floor(Math.random() * 200);
const URL = `http://localhost:${PORT}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the shared lineage.');
    await wait(20);
  }
}
function picker(room: Room<unknown, SpeciesState>) {
  const responses: SpeciesPicked[] = [];
  room.onMessage('picked', (message: SpeciesPicked) => responses.push(message));
  let request = 0;
  return async (id: string) => {
    const req = ++request;
    room.send('pick', { id, req });
    await until(() => responses.some(response => response.req === req));
    return responses.find(response => response.req === req)!;
  };
}

describe('independent water and shore lineages in a shared brood', () => {
  const rooms: Room<unknown, SpeciesState>[] = [];
  beforeAll(async () => { await server.listen(PORT); });
  afterAll(async () => {
    for (const room of rooms) await Promise.race([room.leave().catch(() => undefined), wait(500)]);
    await server.gracefullyShutdown(false);
  });
  async function pair() {
    const a = await new Client(URL).create<SpeciesState>(SPECIES_ROOM, { epoch: firstPlayable(), name: 'Anna' }, SpeciesState);
    const b = await new Client(URL).joinById<SpeciesState>(a.roomId, { name: 'Ben' }, SpeciesState);
    a.onMessage('advanced', () => undefined); b.onMessage('advanced', () => undefined);
    a.onMessage('extinct', () => undefined); b.onMessage('extinct', () => undefined);
    rooms.push(a, b);
    return { a, b };
  }

  it('shares both paths, updates their training without false archives, and preserves adoption of the other player\'s egg', async () => {
    const { a, b } = await pair();
    const water = route('water'), shore = route('shore');
    a.send('hello', { gen: 1, pool: [], next: [], trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(water), identity: 'anna1234', place: 'riff' });
    b.send('hello', { gen: 1, pool: [], next: [], trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(shore), identity: 'ben12345', place: 'ufer' });
    await until(() => a.state.branches.size === 2 && b.state.branches.size === 2);
    expect(JSON.parse(a.state.branches.get(a.sessionId)!).evolutionTrace).toEqual(water);
    expect(JSON.parse(a.state.branches.get(b.sessionId)!).evolutionTrace).toEqual(shore);

    const practiced = water.map(state => ({ ...state }));
    practiced.at(-1)!.births += 1;
    practiced.at(-1)!.bite += 1;
    a.send('lineage', { trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(practiced) });
    await until(() => JSON.parse(b.state.branches.get(a.sessionId)!).evolutionTrace.at(-1).births === practiced.at(-1)!.births);
    expect(b.state.branches.size).toBe(2);

    a.send('extinct', { cause: 'Predator', ended: true });
    await until(() => !JSON.parse(b.state.presence.get(a.sessionId)!).alive);
    expect(b.state.over).toBe('');
    const descendant = breedLineage(shore.at(-1), 'shore', { ramDamage: 100 });
    const evolutionTrace = [...shore, descendant];
    const raw = JSON.stringify({ id: 'adoptshore1', generation: 2, traits: { vitality: 3 }, sex: 1, seed: 17,
      place: 'ufer', x: 500, y: 600, breedingSite: 'shore', evolution: descendant, evolutionTrace, trace: legacy });
    b.send('lay', { gen: 2, eggs: [raw] });
    await until(() => a.state.next.has('adoptshore1'));
    const picked = await picker(a)('adoptshore1');
    expect(picked.gen).toBe(2);
    expect(JSON.parse(picked.egg)).toMatchObject({ evolution: descendant, evolutionTrace, breedingSite: 'shore', traits: { vitality: 3 } });
    a.send('lineage', { trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(evolutionTrace) });
    await until(() => [...b.state.branches.values()].some(rawBranch => {
      const branch = JSON.parse(rawBranch);
      return branch.id.startsWith(`past-${a.sessionId}-evo-`) && branch.extinct && branch.evolutionTrace.at(-1).habitat === 'water';
    }));
    expect(JSON.parse(b.state.branches.get(a.sessionId)!).evolutionTrace).toEqual(evolutionTrace);
    expect(JSON.parse(b.state.presence.get(a.sessionId)!).alive).toBe(true);
    expect(a.state.pool.has('adoptshore1')).toBe(false);
  });

  it('rejects corrupted state and oversized history while keeping legacy eggs usable', async () => {
    const { a, b } = await pair();
    a.send('hello', { gen: 1, pool: [], next: [] });
    await until(() => b.state.gen === 1);
    const egg = { generation: 2, traits: {}, sex: 1, seed: 1, place: 'riff', x: 10, y: 20 };
    a.send('lay', { gen: 2, eggs: [
      JSON.stringify({ ...egg, id: 'badstate1', evolution: { v: 1 } }),
      JSON.stringify({ ...egg, id: 'badtrace1', evolutionTrace: Array.from({ length: 25 }, newLineageEvolution) }),
      JSON.stringify({ ...egg, id: 'badsite1', breedingSite: 'mountain' }),
      JSON.stringify({ ...egg, id: 'legacyegg1' }),
    ] });
    await until(() => b.state.next.has('legacyegg1'));
    expect(b.state.next.size).toBe(1);
    expect(JSON.parse((await picker(b)('legacyegg1')).egg).id).toBe('legacyegg1');
  });

  it('keeps the population generation authoritative when a later saved lineage joins, without resetting its ancestry', async () => {
    const { a, b } = await pair();
    const water = route('water'), shore = route('shore');
    a.send('hello', { gen: 3, pool: [], next: [], trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(water) });
    await until(() => b.state.gen === 3);
    const stale = { traits: {}, sex: 1, seed: 1, place: 'ufer', x: 500, y: 600,
      breedingSite: 'shore', evolution: shore.at(-1), evolutionTrace: shore, trace: legacy };
    b.send('hello', { gen: 17, pool: [JSON.stringify({ ...stale, id: 'savedpool17', generation: 17 })],
      next: [JSON.stringify({ ...stale, id: 'savednext18', generation: 18 })], trace: JSON.stringify(legacy), evolutionTrace: JSON.stringify(shore) });
    await until(() => a.state.branches.size === 2);
    expect(a.state.gen).toBe(3);
    expect(a.state.pool.size).toBe(0);
    expect(a.state.next.size).toBe(0);
    expect(JSON.parse(a.state.branches.get(b.sessionId)!).evolutionTrace).toEqual(shore);

    // The client aligns its population generation to the room, while its chosen lineage retains all of its own births.
    const descendant = breedLineage(shore.at(-1), 'shore', { ramDamage: 100 });
    const evolutionTrace = [...shore, descendant];
    b.send('lay', { gen: 4, eggs: [JSON.stringify({ ...stale, id: 'rebasednext4', generation: 4,
      evolution: descendant, evolutionTrace })] });
    await until(() => a.state.next.has('rebasednext4'));
    const picked = await picker(b)('rebasednext4');
    expect(picked.gen).toBe(4);
    const egg = JSON.parse(picked.egg);
    expect(egg.evolution.births).toBe(descendant.births);
    expect(egg.evolutionTrace).toEqual(evolutionTrace);
    expect(egg.evolution.habitat).toBe('shore');
    await until(() => a.state.gen === 4);
    expect(a.state.gen).toBe(4);
  });
});
