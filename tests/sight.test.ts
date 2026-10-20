import { describe, expect, it } from 'vitest';
import { clarity, farthest, reach, SIGHT } from '../src/sim/sight';

// Sicht unter Wasser: nach vorn weit, nach hinten ein kleiner Kreis; dahinter verschwimmt es, dann ist nur noch Wasser.

const FULL = 900;

describe('Sicht', () => {
  it('nah am Fisch ist es rundherum klar – auch knapp hinter ihm', () => {
    for (const [f, s] of [[30, 0], [-60, 0], [0, 60], [0, -60]]) expect(clarity(f, s, 0.2, FULL)).toBe(1);
  });

  it('nach vorn sieht man viel weiter als nach hinten', () => {
    expect(clarity(250, 0, 0.2, FULL)).toBeGreaterThan(clarity(-250, 0, 0.2, FULL));
    expect(reach(1, 0.2, FULL).clear).toBeCloseTo(0.2 * FULL);
    expect(reach(-1, 0.2, FULL).clear).toBeCloseTo(SIGHT.back);
    // zu den Seiten liegt es dazwischen
    const side = reach(0, 0.2, FULL).clear;
    expect(side).toBeGreaterThan(SIGHT.back);
    expect(side).toBeLessThan(0.2 * FULL);
  });

  it('weit weg ist nur noch Wasser – dazwischen verschwimmt es weich', () => {
    expect(clarity(farthest(0.2, FULL) + 5, 0, 0.2, FULL)).toBe(0);
    const mid = clarity(0.2 * FULL + (SIGHT.fade * FULL) / 2, 0, 0.2, FULL);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it('mehr Sicht reicht weiter: bei 100 % ist es bis zum Bildrand vor dir klar', () => {
    expect(clarity(400, 0, 0.2, FULL)).toBeLessThan(clarity(400, 0, 0.6, FULL));
    expect(clarity(FULL - 1, 0, 1, FULL)).toBe(1);
    expect(farthest(1, FULL)).toBeGreaterThan(farthest(0.2, FULL));
  });
});
