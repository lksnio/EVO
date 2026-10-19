import { describe, expect, it } from 'vitest';
import { Interp } from '../src/net/Interp';
import { EXTRAPOLATE_MS, INTERP_MAX_MS } from '../src/net/protocol';

// Die Glättung der anderen Fische und Tiere: Zittern im Netz stört die Bahn nicht, kurze Lücken werden überbrückt.
describe('Glättung über das Netz', () => {
  /** ein Fisch schwimmt gleichmäßig nach rechts (100 Bildpunkte je Sekunde), Meldungen alle 50 ms – mit Zittern */
  function swim(jitter: (i: number) => number) {
    const ip = new Interp(75);
    const xs: number[] = [];
    let next = 0;
    const msgs = Array.from({ length: 60 }, (_, i) => ({ sent: 1000 + i * 50, at: 40_000 + i * 50 + 30 + jitter(i), x: i * 5 }));
    for (let now = 40_000; now < 43_000; now += 16) {
      while (next < msgs.length && msgs[next].at <= now) {
        ip.push(msgs[next].sent, msgs[next].x, 0, now);
        next++;
      }
      if (!ip.empty && now > 40_400) xs.push(ip.at(now, 0.016).x);
    }
    return { ip, xs };
  }

  it('gleichmäßige Bahn trotz unregelmäßig ankommender Meldungen', () => {
    // jede dritte Meldung kommt 60 ms zu spät
    const { ip, xs } = swim((i) => (i % 3 === 0 ? 60 : 0));
    const steps = xs.slice(30, 120).map((x, i, a) => (i ? x - a[i - 1] : 0)).slice(1);
    // 16 ms bei 100 px/s ≈ 1,6 px je Bild – nie Stillstand, nie ein Sprung
    for (const d of steps) {
      expect(d).toBeGreaterThan(0.8);
      expect(d).toBeLessThan(2.6);
    }
    // die Verzögerung ist mit dem Zittern gewachsen, aber in Grenzen geblieben
    expect(ip.delay).toBeGreaterThan(75);
    expect(ip.delay).toBeLessThan(INTERP_MAX_MS);
  });

  it('meldet ein langsamer Rechner seltener, wartet die Anzeige entsprechend länger', () => {
    const ip = new Interp(75);
    const xs: number[] = [];
    // nur alle 200 ms eine Meldung
    for (let now = 0, i = 0; now < 4000; now += 20) {
      if (now % 200 === 0) ip.push(1000 + i * 200, i++ * 20, 0, 50_000 + now);
      const x = ip.at(50_000 + now, 0.02).x;
      if (now > 1000) xs.push(x);
    }
    expect(ip.delay).toBeGreaterThan(200);
    const steps = xs.slice(20).map((x, i, a) => (i ? x - a[i - 1] : 2)).slice(1);
    for (const d of steps) expect(d).toBeCloseTo(2, 1);
  });

  it('bleibt eine Meldung aus, schwimmt es kurz weiter – aber nicht endlos', () => {
    const ip = new Interp(75);
    for (let i = 0; i < 10; i++) ip.push(i * 50, i * 5, 0, 10_000 + i * 50);
    const last = 45;
    const soon = ip.at(10_450 + 75 + 60, 0.016).x;
    expect(soon).toBeGreaterThan(last);
    const later = ip.at(10_450 + 75 + 2000, 0.016).x;
    expect(later).toBeLessThanOrEqual(last + (5 / 50) * EXTRAPOLATE_MS + 0.01);
  });

  it('nach einer langen Pause schleicht es nicht über die ganze Pause hinweg', () => {
    const ip = new Interp(75);
    ip.push(0, 0, 0, 10_000);
    ip.push(50, 0, 0, 10_050);
    // fünf Sekunden still, dann ein Ruck nach rechts
    ip.push(5050, 50, 0, 15_050);
    ip.push(5100, 55, 0, 15_100);
    // kurz bevor die neue Bewegung gezeigt wird, steht es noch am alten Fleck
    expect(ip.at(15_050 - 120 + 75, 0.016).x).toBeCloseTo(0, 5);
  });

  it('ein neuer Absender (andere Uhr) fängt von vorn an', () => {
    const ip = new Interp(75);
    for (let i = 0; i < 5; i++) ip.push(1_000_000 + i * 50, i, 0, 10_000 + i * 50);
    ip.push(20, 500, 0, 10_300);
    ip.push(70, 505, 0, 10_350);
    expect(ip.at(10_350 + 200, 0.016).x).toBeGreaterThan(400);
  });
});
