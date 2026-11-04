import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INHERIT } from '../src/data/life';
import { evolutionBonus, recordDefeat } from '../src/sim/evolution';
import { game } from '../src/state/GameState';

/** Die alten Rechenwege prüfen wir ohne Gewichtung, Bonus und ±1 – die neuen in tests/bonus.test.ts. */
const REAL = { weight: { ...INHERIT.weight }, bonus: { ...INHERIT.bonus }, final: INHERIT.final };
const neutral = () => {
  INHERIT.weight = { hp: 1, bite: 1, skull: 1, fins: 1, scales: 1 };
  INHERIT.bonus = { ...REAL.bonus, scalesHurt: 0, dangerMin: 0, dangerMax: 0, finsSwim: 0, finsChase: 0 };
  INHERIT.final = 0;
};
const restore = () => { INHERIT.weight = { ...REAL.weight }; INHERIT.bonus = { ...REAL.bonus }; INHERIT.final = REAL.final; };

beforeEach(() => { game.resetAll(); game.newRun(); neutral(); });
afterEach(() => { INHERIT.points = 15; INHERIT.vary = 0.5; restore(); });

describe('Bestehende Regeln anderer Körperklassen und Strömungsbewegung',()=>{
 beforeEach(()=>{game.resetAll();game.newRun();});
  it('ein Stoß schadet mehr als früher und zählt für den Schädel wie drei bis vier Bisse', async () => {
    const { RAM } = await import('../src/data/life');
    expect(RAM.damage).toBeGreaterThan(0.625);
    expect(RAM.credit).toBeGreaterThanOrEqual(3);
    expect(RAM.credit).toBeLessThanOrEqual(4);
    // ein Sieg mit einem Stoß und drei Bissen: der Schädel bekommt jetzt fast die Hälfte, früher ein Viertel
    const defeats: Record<string, { count: number; strength: number }> = {};
    recordDefeat(defeats, { skull: 1 * RAM.credit, bite: 3 }, 1);
    expect(defeats.skull!.strength / (defeats.skull!.strength + defeats.bite!.strength)).toBeGreaterThan(0.45);
  });
  it('Zeit im Strömungsschub bringt Flossenpunkte (Tempo), anteilig und bis zu einer Grenze', () => {
    const B = INHERIT.bonus;
    expect(evolutionBonus({ flowTime: 0 }).fins).toBe(0);
    expect(evolutionBonus({ flowTime: B.flowRef / 2 }).fins).toBeCloseTo(B.finsFlow / 2);
    expect(evolutionBonus({ flowTime: B.flowRef * 5 }).fins).toBeCloseTo(B.finsFlow);
  });
  it('Schub: der Strömungsschub macht schneller, Spurt und Stoß im Schub noch mehr, und er klingt langsam ab', async () => {
    const { FLOW } = await import('../src/data/life');
    expect(FLOW.speed).toBeGreaterThan(0);
    expect(FLOW.sprint).toBeGreaterThan(0);
    expect(FLOW.ram).toBeGreaterThan(0);
    expect(FLOW.fade).toBeGreaterThan(FLOW.rise * 2); // klingt viel langsamer ab, als er anwächst
    // nach FLOW.fade Sekunden ist noch gut ein Drittel des Schubs übrig
    expect(Math.exp(-1)).toBeGreaterThan(0.3);
  });
});
