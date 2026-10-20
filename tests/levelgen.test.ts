import { describe, expect, it } from 'vitest';
import { EPOCHS, epochIndex } from '../src/data/epochs';
import { SPECIES } from '../src/data/species';
import { STEP } from '../src/level/terrain';
import { maxSlope } from '../src/sim/brood';
import { placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';

// Die Welt ist für alle gleich: dieselbe Saat ergibt denselben Ort – egal, wer ihn betritt und von wo.
const ep = EPOCHS[0];
const shape = (L: ReturnType<typeof generateLevel>) => ({
  solids: L.solids,
  ground: L.groundRects.length,
  rocks: L.rocks.map((r) => [Math.round(r.x), Math.round(r.y), r.seed]),
  spawns: L.spawns,
  plants: L.plants,
  caves: L.caves.map((c) => [c.x, c.y, c.w, c.h]),
  shrine: L.shrine,
});

describe('Weltgenerator', () => {
  it('erzeugt aus derselben Saat denselben Ort', () => {
    for (const place of placesOf(ep).slice(0, 4)) {
      const a = generateLevel(ep, 'test-welt', place);
      const b = generateLevel(ep, 'test-welt', place);
      expect(shape(a)).toEqual(shape(b));
    }
  });

  it('hängt nicht davon ab, von wo man ankommt (nur der Ankunftsplatz ändert sich)', () => {
    for (const place of placesOf(ep)) {
      const base = generateLevel(ep, 'test-welt', place);
      for (const side of ['left', 'right'] as const) {
        for (const frac of [0.1, 0.9]) {
          const via = generateLevel(ep, 'test-welt', place, { side, frac });
          expect(shape(via)).toEqual(shape(base));
          // man kommt am Gegenrand an (links verlassen → rechts herein)
          if (side === 'left') expect(via.start.x).toBeGreaterThan(via.width * 0.9);
          else expect(via.start.x).toBeLessThan(via.width * 0.1);
        }
      }
    }
  });

  it('andere Saat – andere Welt', () => {
    const place = placesOf(ep)[1];
    expect(shape(generateLevel(ep, 'welt-a', place))).not.toEqual(shape(generateLevel(ep, 'welt-b', place)));
  });
});

const slopeDeg = (hp: number[], i: number) => (Math.atan(Math.abs(hp[i + 1] - hp[i]) / STEP) * 180) / Math.PI;

/** die steilste Stelle am Fuß des Felsens (das untere Fünftel seiner Höhe) */
function steepFoot(L: ReturnType<typeof generateLevel>) {
  const hp = L.terrain.hp;
  const h = L.surfaceY - Math.min(...hp);
  let m = 0;
  for (let i = 0; i < hp.length - 1; i++) {
    const above = L.surfaceY - hp[i];
    if (above > 10 && above < h * 0.18) m = Math.max(m, slopeDeg(hp, i));
  }
  return m;
}

describe('Karbon: Land über dem Wasser', () => {
  const kb = EPOCHS[epochIndex('karbon')];
  const places = placesOf(kb);

  it('jeder Ort hat Wasser und Land – das Land ragt über die Wasserlinie', () => {
    for (const place of places) {
      const L = generateLevel(kb, 'test-welt', place);
      expect(L.amphibious).toBe(true);
      expect(L.surfaceY).toBeGreaterThan(200);
      expect(L.land?.length ?? 0).toBeGreaterThan(0);
      expect(L.terrain.hp.some((y) => y > L.surfaceY + 80)).toBe(true);
      // dieselbe Saat, derselbe Ort
      expect(shape(generateLevel(kb, 'test-welt', place))).toEqual(shape(L));
    }
  });

  it('im Brutsumpf liegt das Nest im flachen Wasser, und dort leben keine Räuber', () => {
    const L = generateLevel(kb, 'test-welt', places[0]);
    expect(L.nest).toBeDefined();
    expect(L.nest!.y).toBeGreaterThan(L.surfaceY);
    for (const s of L.spawns) {
      const d = SPECIES[s.id];
      expect(d.role === 'predator' || d.role === 'apex').toBe(false);
    }
    // Landtiere stehen an Land
    for (const s of L.spawns.filter((q) => SPECIES[q.id].land)) expect(s.y).toBeLessThan(L.surfaceY);
    // Das Nest liegt in einem Tümpel, der ins tiefe Wasser reicht – Inseln trennen die Tümpel, und die Räuber müssen aus
    // demselben Wasser kommen. Der Tümpel ist so lang, dass sie außer Sicht auftauchen.
    const wet = (c: number) => L.ground[c] > L.surfaceY + 40;
    let c0 = Math.floor(L.nest!.x / 40), c1 = c0;
    while (c0 > 0 && wet(c0 - 1)) c0--;
    while (c1 < L.ground.length - 1 && wet(c1 + 1)) c1++;
    expect(Math.max(c1 * 40 - L.nest!.x, L.nest!.x - c0 * 40)).toBeGreaterThan(900);
    expect(Math.max(...L.ground.slice(c0, c1 + 1)) - L.surfaceY).toBeGreaterThan(150);
  });

  it('der steile Fels: ein hoher Gipfel, dessen Hänge oben deutlich steiler sind als unten', () => {
    const fels = places.find((p) => p.shape === 'peak')!;
    const L = generateLevel(kb, 'test-welt', fels);
    expect(L.summit).toBeDefined();
    const hp = L.terrain.hp;
    const top = Math.min(...hp);
    expect(L.surfaceY - top).toBeGreaterThan(18 * 40);
    // die steilste Stelle nahe am Gipfel und unten am Ufer
    let steepTop = 0, steepLow = 0;
    for (let i = 0; i < hp.length - 1; i++) {
      const above = L.surfaceY - hp[i];
      if (above > (L.surfaceY - top) * 0.82) steepTop = Math.max(steepTop, slopeDeg(hp, i));
      else if (above > 20 && above < (L.surfaceY - top) * 0.25) steepLow = Math.max(steepLow, slopeDeg(hp, i));
    }
    expect(steepTop).toBeGreaterThan(50);
    expect(steepLow).toBeLessThan(40);
    // Pederpes mit Grundwerten kommt unten hinauf, aber nicht bis zum Gipfel
    expect(maxSlope(0, 0)).toBeGreaterThan(steepFoot(L));
    expect(maxSlope(0, 0)).toBeLessThan(steepTop);
    expect(maxSlope(0.8, 0.8)).toBeGreaterThan(steepTop);
  });
});
