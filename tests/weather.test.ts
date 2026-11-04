import { describe, expect, it } from 'vitest';
import { episode, forcedWeather, stormSwell, sunlight, weatherAt, WEATHER } from '../src/sim/weather';

describe('Wetter', () => {
  it('regnet ab und zu – nicht immer und nicht nie', () => {
    let rainy = 0, slots = 400;
    for (let k = 0; k < slots; k++) if (episode(k)) rainy++;
    expect(rainy / slots).toBeGreaterThan(0.35);
    expect(rainy / slots).toBeLessThan(0.65);
  });

  it('ist für alle zur selben Weltzeit gleich und bleibt in seinen Grenzen', () => {
    for (let s = 0; s < 20000; s += 7.3) {
      const a = weatherAt(s), b = weatherAt(s);
      expect(a).toEqual(b);
      expect(a.cloud).toBeGreaterThanOrEqual(0);
      expect(a.cloud).toBeLessThanOrEqual(1);
      expect(a.rain).toBeGreaterThanOrEqual(0);
      expect(a.rain).toBeLessThanOrEqual(1);
    }
  });

  it('zieht erst zu, dann regnet es, und es klart langsam wieder auf', () => {
    const k = [...Array(50).keys()].find(i => episode(i))!;
    const e = episode(k)!;
    const before = weatherAt(e.start - 5), mid = weatherAt((e.start + e.end) / 2), after = weatherAt(e.end + 10);
    expect(before.cloud).toBeGreaterThan(0.5);
    expect(before.rain).toBe(0);
    expect(mid.cloud).toBeCloseTo(1);
    expect(mid.rain).toBeGreaterThan(0.3);
    expect(after.rain).toBe(0);
    expect(after.cloud).toBeGreaterThan(0.5);
    expect(weatherAt(e.end + WEATHER.cloudOut + 1).cloud).toBeCloseTo(0);
  });

  it('ändert sich weich, ohne Sprünge', () => {
    for (let s = 0; s < 10000; s += 0.5) {
      const a = weatherAt(s), b = weatherAt(s + 0.5);
      expect(Math.abs(a.cloud - b.cloud)).toBeLessThan(0.05);
      expect(Math.abs(a.rain - b.rain)).toBeLessThan(0.06);
    }
  });

  it('rührt das Wasser auf und nimmt Licht', () => {
    expect(stormSwell({ cloud: 0, rain: 0 })).toBe(1);
    expect(stormSwell({ cloud: 1, rain: 1 })).toBeCloseTo(1 + WEATHER.swell);
    expect(sunlight({ cloud: 1, rain: 1 })).toBeCloseTo(WEATHER.light);
    expect(forcedWeather('?weather=rain')).toEqual({ cloud: 1, rain: 1 });
    expect(forcedWeather('?debug')).toBeUndefined();
  });
});

describe('Wetter im Zeitraffer', () => {
  it('zeigt mit ?weather=demo einen ganzen Regen in 70 Sekunden', () => {
    const at = (s: number) => forcedWeather('?weather=demo', s)!;
    expect(at(0)).toEqual({ cloud: 0, rain: 0 });
    expect(at(30).cloud).toBeCloseTo(1);
    expect(at(30).rain).toBeCloseTo(1);
    expect(at(69).rain).toBe(0);
    expect(at(70)).toEqual(at(0));
  });
});
