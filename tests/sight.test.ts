import { describe, expect, it } from 'vitest';
import { clarity, clearness, depthOf, disc, farthest, SIGHT, veil, vision } from '../src/sim/sight';

// Sicht unter Wasser – wie auf einem Zeitstrahl: Steht der Fisch auf 5 und schaut Richtung 10, sieht er 4 bis 7; schaut er
// Richtung 0, sieht er 3 bis 6. Wie weit, hängt an der Sicht des Tiers, an der Wasserqualität und an der Tiefe.

const FULL = 900;
const v20 = vision(0.2, FULL);

describe('Sicht', () => {
  it('nach vorn doppelt so weit wie nach hinten – der klare Bereich liegt vor dem Fisch', () => {
    expect(v20.back).toBeCloseTo(v20.front * SIGHT.backShare);
    const { ahead, r } = disc(v20);
    // vorn reicht er bis front, hinten bis back
    expect(ahead + r).toBeCloseTo(v20.front);
    expect(r - ahead).toBeCloseTo(v20.back);
    expect(clarity(v20.front - 1, 0, v20)).toBe(1);
    expect(clarity(-v20.back + 1, 0, v20)).toBe(1);
    expect(clarity(v20.front + v20.fade + 1, 0, v20)).toBe(0);
    expect(clarity(-v20.back - v20.fade - 1, 0, v20)).toBe(0);
  });

  it('wie auf dem Zeitstrahl: Was vor dem Fisch klar ist, ist es hinter ihm erst halb so weit – und oben wie unten gleich', () => {
    const unit = v20.back;
    // auf 5 nach 10 schauend: 4 bis 7 klar (eine Einheit zurück, zwei nach vorn), 3 und 8 nicht mehr
    expect(clarity(-unit + 1, 0, v20)).toBe(1);
    expect(clarity(2 * unit - 1, 0, v20)).toBe(1);
    expect(clarity(-2 * unit, 0, v20)).toBe(0);
    expect(clarity(3 * unit, 0, v20)).toBe(0);
    expect(clarity(50, 120, v20)).toBeCloseTo(clarity(50, -120, v20));
  });

  it('der Rand ist kurz und deutlich – dahinter nur Wasser', () => {
    expect(v20.fade).toBeLessThan(0.2 * FULL);
    expect(farthest(v20)).toBeCloseTo(disc(v20).r + v20.fade);
    const mid = clarity(v20.front + v20.fade / 2, 0, v20);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it('mehr Sicht reicht weiter: bei 100 % ist es bis zum Bildrand vor dir klar', () => {
    expect(clarity(400, 0, v20)).toBeLessThan(clarity(400, 0, vision(0.6, FULL)));
    expect(clarity(FULL - 1, 0, vision(1, FULL))).toBe(1);
  });

  it('in sauberem Wasser sieht man weiter – und durch das Wasser hindurch mehr vom Hintergrund', () => {
    expect(vision(0.2, FULL, SIGHT.water.start).front).toBeGreaterThan(vision(0.2, FULL, SIGHT.water.lush).front);
    expect(vision(0.2, FULL, SIGHT.water.lush).front).toBeGreaterThan(vision(0.2, FULL, SIGHT.water.murky).front);
    expect(veil(v20, SIGHT.water.start, 0).murk).toBeLessThan(veil(v20, SIGHT.water.murky, 0).murk);
    expect(clearness(1, 0)).toBe(1);
    expect(clearness(SIGHT.water.lush, 0)).toBeLessThan(1);
  });

  it('nah an der Oberfläche sieht man weiter, in der Tiefe weniger – dort hört es plötzlicher auf und wird früher dunkel', () => {
    const top = vision(0.2, FULL, 1, 0), low = vision(0.2, FULL, 1, 1);
    expect(top.front).toBeGreaterThan(low.front);
    expect(top.fade).toBeGreaterThan(low.fade);
    const vt = veil(top, 1, 0), vl = veil(low, 1, 1);
    expect(vl.dark).toBeGreaterThan(vt.dark);
    expect(vl.murk).toBeGreaterThan(vt.murk);
    expect(vl.field.fade / low.fade).toBeLessThan(vt.field.fade / top.fade);
    expect(depthOf(0)).toBe(0);
    expect(depthOf(SIGHT.deepAt * 2)).toBe(1);
  });
});
