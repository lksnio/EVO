import { describe, expect, it } from 'vitest';
import { breedLineage, LINEAGE_ENDPOINTS, newLineageEvolution, type LineageHabitat, type LineageWeapon } from '../src/sim/lineageEvolution';
import { evolutionNodeKey, lineageTree } from '../src/sim/lineageTree';

function playedPath(habitat: LineageHabitat, weapon: LineageWeapon) {
  const trace = [newLineageEvolution()];
  for (let i = 0; i < 5; i++) trace.push(breedLineage(trace.at(-1), habitat,
    weapon === 'bite' ? { biteDamage: 100 } : { ramDamage: 100 }));
  return trace;
}

describe('new lineage tree', () => {
  it('offers two habitat routes and all four endpoints before they have been played', () => {
    const model = lineageTree([]);
    for (const endpoint of LINEAGE_ENDPOINTS) {
      const node = model.nodes.find(node => node.id === endpoint);
      expect(node?.possible).toBe(true);
      expect(node?.routes).toEqual([]);
    }
    expect(model.nodes.filter(node => node.form === 'transition')).toHaveLength(5);
    expect(new Set(model.nodes.map(node => node.id)).size).toBe(model.nodes.length);
    expect(model.edges.every(edge => model.nodes.some(node => node.id === edge.from) && model.nodes.some(node => node.id === edge.to))).toBe(true);
  });

  it('overlays independent co-op routes on the same origin and keeps the other paths subdued', () => {
    const a = playedPath('water', 'bite'), b = playedPath('shore', 'skull');
    const model = lineageTree([
      { id: 'anna', name: 'Anna', evolutionTrace: a },
      { id: 'ben', name: 'Ben', evolutionTrace: b },
    ]);
    expect(model.nodes.find(node => node.id === 'transition')?.routes).toEqual(['anna', 'ben']);
    expect(model.nodes.find(node => node.id === 'water-bite-2')?.endpoints).toEqual(['anna']);
    expect(model.nodes.find(node => node.id === 'shore-skull-2')?.endpoints).toEqual(['ben']);
    expect(model.nodes.find(node => node.id === 'water-skull-2')?.possible).toBe(true);
    expect(model.nodes.find(node => node.id === 'shore-bite-2')?.possible).toBe(true);
    expect(model.edges.find(edge => edge.from === 'water' && edge.to === 'water-bite-1')?.routes).toEqual(['anna']);
    expect(model.edges.find(edge => edge.from === 'shore' && edge.to === 'shore-skull-1')?.routes).toEqual(['ben']);
  });

  it('records a reversal of nursery direction without inventing an established body', () => {
    const trace = [newLineageEvolution()];
    for (const nursery of ['water', 'water', 'shore', 'shore', 'shore'] as const) trace.push(breedLineage(trace.at(-1), nursery));
    const before = JSON.stringify(trace), model = lineageTree([{ id: 'route', name: 'Route', evolutionTrace: trace }]);
    expect(model.edges.find(edge => edge.from === 'water-nursery-2' && edge.to === 'water-nursery-1')?.possible).toBe(false);
    expect(model.edges.find(edge => edge.from === 'water-nursery-1' && edge.to === 'transition')?.possible).toBe(false);
    expect(model.nodes.find(node => node.id === 'shore-nursery-1')?.endpoints).toEqual(['route']);
    expect(model.nodes.find(node => node.id === 'water')?.possible).toBe(true);
    expect(model.nodes.find(node => node.id === 'shore')?.possible).toBe(true);
    expect(JSON.stringify(trace)).toBe(before);
  });

  it('does not create appearance nodes for every numeric training increment or fabricate missing ancestors', () => {
    const trace = playedPath('water', 'bite'), final = trace.at(-1)!;
    expect(evolutionNodeKey({ ...final, bite: 30, births: 100 })).toBe('water-bite-2');
    const model = lineageTree([{ id: 'loaded', name: 'Loaded', evolutionTrace: [final, { ...final, bite: 30, births: 100 }] }]);
    expect(model.nodes.find(node => node.id === 'transition')?.possible).toBe(true);
    expect(model.nodes.find(node => node.id === 'water-bite-2')?.endpoints).toEqual(['loaded']);
    expect(model.edges.every(edge => edge.possible)).toBe(true);
  });
});
