import { describe, expect, it } from 'vitest';
import { LIFE, SPAWN, WORLD } from '../src/data/life';
import { cyclePhase, diesOfAge, growthAt, isAdult, lifeK, oldAt, spawnBlock, stageOf, worldYears } from '../src/sim/life';

describe('Lebenszyklus', () => {
  it('wächst vom Schlüpfling stetig heran und ist zur festen Zeit ausgewachsen', () => {
    expect(growthAt(0)).toBeCloseTo(LIFE.hatch, 5);
    expect(growthAt(LIFE.mature)).toBeCloseTo(LIFE.adult, 5);
    let prev = 0;
    for (let t = 0; t <= LIFE.span; t += 30) {
      const g = growthAt(t);
      expect(g).toBeGreaterThan(prev);
      expect(g).toBeLessThan(1);
      prev = g;
    }
  });

  it('kennt die Lebensabschnitte und den Tod durch Alter', () => {
    expect(stageOf(0)).toBe('jung');
    expect(stageOf(LIFE.mature * 0.5)).toBe('heran');
    expect(stageOf(LIFE.mature)).toBe('adult');
    expect(stageOf(LIFE.old + 1)).toBe('alt');
    expect(isAdult(LIFE.mature - 1)).toBe(false);
    expect(oldAt(LIFE.old)).toBe(0);
    expect(oldAt(LIFE.span)).toBe(1);
    expect(diesOfAge(LIFE.span - 1)).toBe(false);
    expect(diesOfAge(LIFE.span)).toBe(true);
    expect(lifeK(0)).toEqual({ grow: growthAt(0), old: 0 });
  });

  it('sagt, was zum Laichen noch fehlt', () => {
    const ok = { age: LIFE.mature + 10, food: 0.9, lastSpawn: -1e9, inGrounds: true, atGround: true };
    expect(spawnBlock(ok)).toBeNull();
    expect(spawnBlock({ ...ok, age: 10 })).toBe('jung');
    expect(spawnBlock({ ...ok, food: SPAWN.minFood - 0.01 })).toBe('hunger');
    expect(spawnBlock({ ...ok, lastSpawn: ok.age - 10 })).toBe('pause');
    expect(spawnBlock({ ...ok, inGrounds: false })).toBe('ort');
    expect(spawnBlock({ ...ok, atGround: false })).toBe('grund');
    expect(spawnBlock({ ...ok, atGround: false, male: true })).toBe('gelege');
  });

  it('die Weltzeit ist für alle gleich und bleibt im Zeitalter', () => {
    const t = WORLD.start + 3600_000;
    expect(cyclePhase(450, t)).toBeCloseTo((3600 % 450) / 450, 6);
    expect(cyclePhase(450, WORLD.start - 1000)).toBeGreaterThanOrEqual(0);
    expect(worldYears(470e6, 458e6, WORLD.start)).toBe(470e6);
    expect(worldYears(470e6, 458e6, WORLD.start + 3600_000)).toBeCloseTo(470e6 - 3600 * WORLD.yearsPerSecond, 3);
    expect(worldYears(470e6, 458e6, WORLD.start + 1e13)).toBe(458e6);
  });
});
