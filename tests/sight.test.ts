import { describe, expect, it } from 'vitest';
import { clarity, darkness, depthOf, farthest, reach, SIGHT, vision } from '../src/sim/sight';

// Sicht unter Wasser: nach vorn weit, nach hinten ein kleiner Kreis; dahinter verschwimmt es kurz, dann ist nur noch Wasser
// und weiter draußen das Dunkle. Wie weit, hängt an der Sicht des Tiers, an der Wasserqualität und an der Tiefe.

const FULL = 900;
const v20 = vision(0.2, FULL);

describe('Sicht', () => {
  it('nah am Fisch ist es rundherum klar – auch knapp hinter ihm', () => {
    for (const [f, s] of [[30, 0], [-60, 0], [0, 60], [0, -60]]) expect(clarity(f, s, v20)).toBe(1);
  });

  it('nach vorn sieht man viel weiter als nach hinten – und schon zu Beginn ein gutes Stück', () => {
    expect(clarity(250, 0, v20)).toBeGreaterThan(clarity(-250, 0, v20));
    expect(v20.front).toBeCloseTo(FULL * (SIGHT.front0 + (1 - SIGHT.front0) * 0.2) * SIGHT.surface);
    expect(v20.front).toBeGreaterThan(0.2 * FULL);
    expect(reach(-1, v20).clear).toBeCloseTo(SIGHT.back);
    const side = reach(0, v20).clear;
    expect(side).toBeGreaterThan(SIGHT.back);
    expect(side).toBeLessThan(v20.front);
  });

  it('der Rand ist kurz und deutlich – dahinter nur Wasser', () => {
    expect(v20.fade).toBeLessThan(0.2 * FULL);
    expect(clarity(farthest(v20) + 5, 0, v20)).toBe(0);
    const mid = clarity(v20.front + v20.fade / 2, 0, v20);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it('mehr Sicht reicht weiter: bei 100 % ist es bis zum Bildrand vor dir klar', () => {
    expect(clarity(400, 0, v20)).toBeLessThan(clarity(400, 0, vision(0.6, FULL)));
    expect(clarity(FULL - 1, 0, vision(1, FULL))).toBe(1);
  });

  it('in sauberem Wasser sieht man weiter als in trübem', () => {
    expect(vision(0.2, FULL, SIGHT.water.start).front).toBeGreaterThan(vision(0.2, FULL, SIGHT.water.murky).front);
  });

  it('nah an der Oberfläche sieht man weiter, in der Tiefe weniger – dort hört es plötzlicher auf und wird früher dunkel', () => {
    const top = vision(0.2, FULL, 1, 0), low = vision(0.2, FULL, 1, 1);
    expect(top.front).toBeGreaterThan(low.front);
    expect(top.fade).toBeGreaterThan(low.fade);
    // das Dunkle beginnt am Rand und nimmt nach außen zu – in der Tiefe dunkler und schneller
    expect(darkness(low, 1).alpha).toBeGreaterThan(darkness(top, 0).alpha);
    expect(darkness(top, 0).field.fade).toBeGreaterThan(top.fade);
    expect(darkness(low, 1).field.fade / low.fade).toBeLessThan(darkness(top, 0).field.fade / top.fade);
    expect(depthOf(0)).toBe(0);
    expect(depthOf(SIGHT.deepAt * 2)).toBe(1);
  });
});
