import { describe, expect, it } from 'vitest';
import { BITE, bitePlan, biteRest } from '../src/sim/bite';

// Der Biss der Jäger: ausholen (rot werden) → kurz schneller vorschnellen → zuschnappen → erholen. Jeder Biss ist ein wenig
// anders, damit man die Jäger nicht nach dem Takt ausspielen kann – aber nicht so sehr, dass sie unberechenbar werden.

/** ein fester Zufall: liefert die Werte der Reihe nach (und dann immer wieder von vorn) */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('Biss der Jäger', () => {
  it('ohne Streuung: so lange holt er aus, schnellt vor und erholt sich – große länger und schneller', () => {
    const mid = seq(0.99, 0.5, 0.5, 0.5, 0.5);
    const p = bitePlan(100, false, false, mid);
    expect(p.wind).toBeCloseTo(BITE.wind);
    expect(p.dash).toBeCloseTo(BITE.dash);
    expect(p.speed).toBeCloseTo(BITE.speedMin);
    expect(p.rec).toBeCloseTo(BITE.rec);
    const big = bitePlan(200, true, false, seq(0.99, 0.5, 0.5, 0.5, 0.5));
    expect(big.wind).toBeCloseTo(BITE.windBig);
    expect(big.dash).toBeGreaterThan(p.dash);
    expect(big.speed).toBeCloseTo(200 * BITE.speed * 1.1);
    // der weite Vorstoß: viel länger vorschnellen
    expect(bitePlan(200, true, true, seq(0.99, 0.5, 0.5, 0.5, 0.5)).dash).toBeCloseTo(big.dash * BITE.long);
  });

  it('jeder Biss ist ein wenig anders – aber nie mehr als um die Streuung (und ein schneller Biss)', () => {
    let lo = Infinity, hi = 0, quick = 0;
    for (let i = 0; i < 2000; i++) {
      const p = bitePlan(150, false);
      lo = Math.min(lo, p.wind);
      hi = Math.max(hi, p.wind);
      if (p.wind < BITE.wind * (1 - BITE.spread)) quick++;
      expect(p.dash).toBeGreaterThanOrEqual(BITE.dash * 0.9 * (1 - BITE.spread) - 1e-9);
      expect(p.dash).toBeLessThanOrEqual(BITE.dash * (1 + BITE.spread) + 1e-9);
      expect(p.rec).toBeGreaterThanOrEqual(BITE.rec * (1 - BITE.spread) - 1e-9);
    }
    expect(lo).toBeGreaterThanOrEqual(BITE.wind * BITE.quick * (1 - BITE.spread) - 1e-9);
    expect(hi).toBeLessThanOrEqual(BITE.wind * (1 + BITE.spread) + 1e-9);
    // es kommt wirklich Abwechslung vor: weit gestreut, und manchmal schnappt er besonders schnell zu
    expect(hi / lo).toBeGreaterThan(1.5);
    expect(quick).toBeGreaterThan(100);
  });

  it('die Pause bis zum nächsten Biss schwankt: mal kürzer, mal länger, manchmal deutlich länger', () => {
    const v = Array.from({ length: 3000 }, () => biteRest(false));
    const min = Math.min(...v), max = Math.max(...v);
    expect(min).toBeGreaterThanOrEqual(BITE.rest * BITE.restLo - 1e-9);
    expect(max).toBeLessThanOrEqual(BITE.rest * BITE.restHi + BITE.pauseMax + 1e-9);
    expect(max - min).toBeGreaterThan(BITE.rest * 0.8);
    const long = v.filter((x) => x > BITE.rest * BITE.restHi).length / v.length;
    expect(long).toBeGreaterThan(0.05);
    expect(long).toBeLessThan(0.3);
    // große Räuber warten etwas länger
    expect(biteRest(true, seq(0.5, 0.99))).toBeGreaterThan(biteRest(false, seq(0.5, 0.99)));
  });
});
