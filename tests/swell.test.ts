import { describe, expect, it } from 'vitest';
import { focus, orbit, surface, surfaceReach, SWELL } from '../src/sim/swell';

describe('Seegang', () => {
  it('bleibt in seiner Höhe und überschlägt sich nie', () => {
    const reach = surfaceReach();
    for (const t of [0, 3.7, 41, 260]) {
      let last = -Infinity;
      for (let x = 0; x < 6000; x += 4) {
        const s = surface(x, t);
        expect(Math.abs(s.dy)).toBeLessThanOrEqual(reach + 1e-9);
        // die Punkte behalten ihre Reihenfolge: keine Schleifen an den Kämmen
        expect(x + s.dx).toBeGreaterThan(last);
        last = x + s.dx;
      }
    }
  });

  it('hat schmale Kämme und breite Täler', () => {
    let above = 0, below = 0;
    for (const t of [0, 9, 17, 52]) {
      for (let x = 0; x < 12000; x += 2) {
        const a = surface(x, t), b = surface(x + 2, t);
        const span = b.dx + 2 - a.dx;
        if (a.dy < 0) above += span;
        else below += span;
      }
    }
    expect(above / (above + below)).toBeLessThan(0.47);
  });

  it('wiederholt sich nicht nach einer einzelnen Wellenlänge oder Periode', () => {
    for (const w of SWELL.waves) {
      const period = w.len / Math.abs(w.speed);
      let diff = 0;
      for (let x = 0; x < 3000; x += 50) diff += Math.abs(surface(x, 10).dy - surface(x, 10 + period).dy);
      expect(diff / 60).toBeGreaterThan(0.5);
    }
  });

  it('bewegt das Wasser unten schwächer, aber nie gar nicht', () => {
    const mean = (depth: number) => {
      let s = 0;
      for (let i = 0; i < 400; i++) {
        const o = orbit(i * 37, depth, i * 0.31);
        s += Math.hypot(o.dx, o.dy);
      }
      return s / 400;
    };
    expect(mean(0)).toBeGreaterThan(mean(300));
    expect(mean(300)).toBeGreaterThan(mean(2000));
    expect(mean(2000)).toBeGreaterThan(0.5);
  });

  it('bündelt das Licht unter den Kämmen', () => {
    const long = SWELL.waves[0];
    // nur die lange Dünung zählt: ihr Kamm (θ = 0) und ihr Tal (θ = π) zur Zeit 0
    const crest = (-long.phase / (Math.PI * 2)) * long.len;
    const trough = crest + long.len / 2;
    const minLen = long.len - 1;
    expect(focus(crest, 0, minLen)).toBeGreaterThan(0.7);
    expect(focus(trough, 0, minLen)).toBeLessThan(0.3);
    for (let x = 0; x < 4000; x += 13) {
      const f = focus(x, x * 0.01);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('Seegang bei Sturm', () => {
  it('wird höher, überschlägt sich aber nicht', () => {
    for (const t of [0, 7, 33]) {
      let last = -Infinity, top = 0;
      for (let x = 0; x < 6000; x += 3) {
        const s = surface(x, t, 1.75);
        expect(x + s.dx).toBeGreaterThan(last);
        last = x + s.dx;
        top = Math.max(top, -s.dy);
      }
      expect(top).toBeGreaterThan(surfaceReach() * 0.6);
    }
  });
});
