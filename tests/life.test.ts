import { describe, expect, it } from 'vitest';
import { LIFE, SPAWN, WORLD } from '../src/data/life';
import { broodBase, cyclePhase, diesOfAge, growthAt, isAdult, lifeK, oldAt, phases, spawnBlock, spawnMinFood, stageOf, worldYears, youngOf } from '../src/sim/life';

describe('Lebenszyklus', () => {
  it('die ersten Leben sind kurz, jedes weitere etwas länger – logarithmisch', () => {
    expect(phases(1)).toMatchObject({ mature: 7 * 60, span: 11 * 60 });
    expect(phases(2)).toMatchObject({ mature: 10 * 60, span: 15 * 60 });
    expect(phases(4)).toMatchObject({ mature: 13 * 60, span: 19 * 60 });
    // je mehr Generationen, desto kleiner der Zuwachs
    const d = (g: number) => phases(g + 1).span - phases(g).span;
    expect(d(1)).toBeGreaterThan(d(2));
    expect(d(2)).toBeGreaterThan(d(10));
    expect(phases(50).span).toBeLessThan(40 * 60);
  });

  it('wächst vom Schlüpfling stetig heran und ist zur Laichzeit ausgewachsen', () => {
    for (const gen of [1, 2, 7]) {
      const P = phases(gen);
      expect(growthAt(0, gen)).toBeCloseTo(LIFE.hatch, 5);
      expect(growthAt(P.mature, gen)).toBeCloseTo(LIFE.adult, 5);
      let prev = 0;
      for (let t = 0; t <= P.span; t += 30) {
        const g = growthAt(t, gen);
        expect(g).toBeGreaterThan(prev);
        expect(g).toBeLessThan(1);
        prev = g;
      }
    }
  });

  it('kennt die Lebensabschnitte und den Tod durch Alter', () => {
    const P = phases(1);
    expect(stageOf(0)).toBe('jung');
    expect(stageOf(P.mature * 0.5)).toBe('heran');
    expect(stageOf(P.mature)).toBe('adult');
    expect(stageOf(P.old + 1)).toBe('alt');
    expect(isAdult(P.mature - 1)).toBe(false);
    expect(isAdult(P.mature, 2)).toBe(false);
    expect(oldAt(P.old)).toBe(0);
    expect(oldAt(P.span)).toBe(1);
    expect(diesOfAge(P.span - 1)).toBe(false);
    expect(diesOfAge(P.span)).toBe(true);
    expect(diesOfAge(P.span, 2)).toBe(false);
    expect(lifeK(0)).toEqual({ grow: growthAt(0), old: 0 });
  });

  it('sagt, was zum Laichen noch fehlt', () => {
    const ok = { age: phases(1).mature + 10, food: 0.9, lastSpawn: -1e9, inGrounds: true, atGround: true };
    expect(spawnBlock(ok)).toBeNull();
    expect(spawnBlock({ ...ok, age: 10 })).toBe('jung');
    expect(spawnBlock({ ...ok, food: SPAWN.minFood - 0.01 })).toBe('hunger');
    expect(spawnBlock({ ...ok, lastSpawn: ok.age - 10 })).toBe('pause');
    expect(spawnBlock({ ...ok, inGrounds: false })).toBe('ort');
    expect(spawnBlock({ ...ok, atGround: false })).toBe('grund');
    expect(spawnBlock({ ...ok, atGround: false, male: true })).toBe('gelege');
    // ohne genug Nahrung für wenigstens einen Nachkommen geht es nicht
    expect(spawnBlock({ ...ok, fed: 99, base: 100 })).toBe('nahrung');
    expect(spawnBlock({ ...ok, fed: 100, base: 100 })).toBeNull();
  });

  it('Nachkommen aus Nahrung: je Grundwert einer – Schwere brauchen mehr', () => {
    expect(broodBase(1)).toBe(SPAWN.perYoung);
    expect(youngOf(250, 100)).toBe(2);
    expect(youngOf(490, 100)).toBe(4);
    expect(youngOf(500, 100)).toBe(5);
    expect(youngOf(99, 100)).toBe(0);
    expect(youngOf(1e6, 100)).toBe(SPAWN.maxYoung);
    // ein zehnmal so schweres Tier braucht mehr je Nachkomme – aber nicht zehnmal so viel
    expect(broodBase(10)).toBeGreaterThan(2 * broodBase(1));
    expect(broodBase(10)).toBeLessThan(10 * broodBase(1));
  });

  it('der Magen muss zum Laichen kaum voll sein – bei schweren Tieren etwas mehr, nie mehr als ein Viertel', () => {
    expect(spawnMinFood(1)).toBeCloseTo(SPAWN.minFood, 6);
    expect(spawnMinFood(1)).toBeLessThanOrEqual(0.1);
    expect(spawnMinFood(4)).toBeGreaterThan(spawnMinFood(1));
    expect(spawnMinFood(1000)).toBe(SPAWN.minFoodMax);
    expect(SPAWN.minFoodMax).toBeLessThanOrEqual(0.25);
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
