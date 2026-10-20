import { describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
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
