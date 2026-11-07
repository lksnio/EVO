import { describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
import { edgeNeighbor, edgeOpen, mapNeighbors, placesOf } from '../src/data/world';
import { parseWorldMap, type WorldMap } from '../src/editor/document';
import { generateLevel } from '../src/level/LevelGen';
import { groundAt } from '../src/level/terrain';

const ep = EPOCHS.find(e => e.id === 'perm')!;
const places = placesOf(ep), start = places[0];

describe('The branching nursery', () => {
  it('keeps the five Permian maps and connects the water and shore in their visible direction', () => {
    expect(places.map(p => p.id)).toEqual(['riff', 'garten', 'wand', 'ufer', 'hochland']);
    expect(start.nurseryFork).toBe(true);
    expect(start.waterway).toBeUndefined();
    expect(places[2]).toMatchObject({ below: 'garten', boss: 'orthacanthus' });
    expect(places[4]).toMatchObject({ needsLegs: true, boss: 'dimetrodon' });
    expect(mapNeighbors(ep, start).map(p => p.id)).toEqual(['garten', 'ufer']);
    for (const frac of [0, .5, 1]) {
      expect(edgeNeighbor(ep, start, 'left', frac)?.id).toBe('garten');
      expect(edgeNeighbor(ep, start, 'right', frac)?.id).toBe('ufer');
    }
    expect(edgeOpen(ep, start, 'left')).toBe(true);
    expect(edgeOpen(ep, start, 'right')).toBe(true);
    expect(mapNeighbors(ep, places[1]).some(p => p.id === 'wand')).toBe(false);
  });

  it('starts between two accessible underwater egg piles, with food at both', () => {
    for (const seed of ['nursery-a', 'nursery-b', 'nursery-c']) {
      const L = generateLevel(ep, seed, start);
      const [water, shore] = L.breedingSites!;
      expect(L.amphibious).toBe(true);
      expect(L.cave).toBeUndefined();
      expect(L.riverEnd).toBeUndefined();
      expect(water.id).toBe('water');
      expect(shore.id).toBe('shore');
      expect(water.x).toBeLessThan(L.start.x);
      expect(shore.x).toBeGreaterThan(L.start.x);
      expect(L.start.y).toBeGreaterThan(L.surfaceY + 30);
      expect(L.start.y).toBeLessThan(groundAt(L.terrain.hp, L.start.x) - 35);
      expect(water.y - L.surfaceY).toBeGreaterThan(shore.y - L.surfaceY + 80);
      expect(shore.y - L.surfaceY).toBeGreaterThan(85);
      expect(shore.y - L.surfaceY).toBeLessThan(130);
      expect(L.land!.some(p => p.x1 > L.width * .9)).toBe(true);
      for (const site of L.breedingSites!) {
        expect(site.y).toBeCloseTo(groundAt(L.terrain.hp, site.x) + 3);
        expect(L.roe.filter(r => r.own && r.breedingSite === site.id)).toEqual([
          expect.objectContaining({ x: site.x, y: site.y }),
        ]);
        expect(L.plants.filter(p => Math.abs(p.x - site.x) < 180 && Math.abs(p.x - site.x) > 65).length).toBeGreaterThanOrEqual(4);
        expect(L.spawns.every(s => Math.hypot(s.x - site.x, s.y - site.y) >= 400)).toBe(true);
      }
      // A starter can swim the complete corridor between both piles without crossing a dry bank or a rock.
      for (let x = water.x - 60; x <= shore.x + 60; x += 30) {
        const y = groundAt(L.terrain.hp, x) - 40;
        expect(y).toBeGreaterThan(L.surfaceY + 35);
        expect(L.solids.some(s => x + 20 > s.x && x - 20 < s.x + s.w && y + 20 > s.y && y - 20 < s.y + s.h)).toBe(false);
      }
    }
  });

  it('keeps permanent breeding sites fixed across entry points and random encounter rolls', () => {
    for (const place of places.slice(0, 4)) {
      const original = generateLevel(ep, 'fixed-shore', place);
      expect(original.breedingSites?.length).toBe(place.nurseryFork ? 2 : 1);
      for (const side of ['left', 'right'] as const) {
        const visit = generateLevel(ep, 'fixed-shore', place, { side, frac: .5 }, 'new-encounters-' + side);
        expect(visit.breedingSites, place.id).toEqual(original.breedingSites);
      }
      for (const site of original.breedingSites!) {
        expect(site.y - original.surfaceY, place.id).toBeGreaterThan(80);
        expect(site.y, place.id).toBeCloseTo(groundAt(original.terrain.hp, site.x) + 3);
      }
    }
    expect(generateLevel(ep, 'fixed-shore', places[4]).breedingSites).toBeUndefined();
  });

  it('preserves breeding habitats and the local landscape when maps are saved and loaded', () => {
    for (const place of places.slice(0, 4)) {
      const map: WorldMap = { format: 'evo-world-map', version: 1, epoch: ep.id, place: place.id, name: place.name,
        layout: generateLevel(ep, 'editor-nursery', place), objects: [] };
      const restored = parseWorldMap(JSON.parse(JSON.stringify(map)));
      expect(restored.layout.breedingSites).toEqual(map.layout.breedingSites);
      expect(restored.layout.roe).toEqual(map.layout.roe);
      expect(restored.layout.theme).toBe(map.layout.theme);
    }
  });

  it('rejects invalid or duplicate nursery habitats in imported maps', () => {
    const fixture = () => ({ format: 'evo-world-map', version: 1, epoch: ep.id, place: start.id, name: start.name,
      layout: generateLevel(ep, 'editor-nursery', start), objects: [] });
    for (const mutate of [
      (m: ReturnType<typeof fixture>) => { (m.layout.breedingSites![0] as { id: string }).id = 'land'; },
      (m: ReturnType<typeof fixture>) => { m.layout.breedingSites![1].id = 'water'; },
      (m: ReturnType<typeof fixture>) => { m.layout.breedingSites![0].x = m.layout.width + 1; },
      (m: ReturnType<typeof fixture>) => { (m.layout.roe[0] as { breedingSite: string }).breedingSite = 'land'; },
    ]) {
      const map = fixture(); mutate(map);
      expect(() => parseWorldMap(map)).toThrow();
    }
  });
});
