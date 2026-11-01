import { beforeEach, describe, expect, it } from 'vitest';
import { INHERIT } from '../src/data/life';
import { evolutionBonus, evolutionStep } from '../src/sim/evolution';
import { game, newStyle } from '../src/state/GameState';

beforeEach(() => { game.resetAll(); game.newRun(); });

describe('Schuppen und Tempo aus der Spielweise', () => {
  it('überstandene Kämpfe bringen +2 bis +3 Schuppen, auch ohne einen erlegten Gegner', () => {
    expect(evolutionBonus({}).scales).toBe(0);
    expect(evolutionBonus({ hurt: 5.33 }).scales).toBeCloseTo(2, 1);
    expect(evolutionBonus({ hurt: 8 }).scales).toBe(3);
    expect(evolutionBonus({ hurt: 80 }).scales).toBe(3);
  });

  it('wer dem Tod nahe war, bekommt +4 bis +5 – je nach Dauer', () => {
    expect(evolutionBonus({ danger: 0.5 }).scales).toBeGreaterThanOrEqual(4);
    expect(evolutionBonus({ danger: 0.5 }).scales).toBeLessThan(4.2);
    expect(evolutionBonus({ danger: 7.5, hurt: 3 }).scales).toBeCloseTo(4.5, 5);
    expect(evolutionBonus({ danger: 15, hurt: 8 }).scales).toBe(5);
    expect(evolutionBonus({ danger: 200, hurt: 8 }).scales).toBe(5);
  });

  it('schnelles Schwimmen und eingeholte Flüchtende bringen etwas Tempo – weniger als die Schuppen', () => {
    const swim = evolutionBonus({ swim: 20 }).fins, chase = evolutionBonus({ chase: 3 }).fins;
    expect(swim).toBeGreaterThan(1);
    expect(evolutionBonus({ swim: 20, chase: 3 }).fins).toBe(swim + chase);
    expect(evolutionBonus({ swim: 20, chase: 3 }).fins).toBeLessThan(evolutionBonus({ danger: 15, hurt: 8 }).scales);
    expect(evolutionBonus({ swim: 999, chase: 999 }).fins).toBe(swim + chase);
  });

  it('der Bonus kommt als fester Zuwachs ins Ei (ohne Streuung)', () => {
    const zero = { hp: 0, bite: 0, skull: 0, fins: 0, scales: 0 };
    const a = evolutionStep(zero, () => 0.5, { hp: 0, bite: 0, skull: 0, fins: 0, scales: 4 });
    expect(a.scales).toBe(4);
    const lo = evolutionStep(zero, () => 0, { hp: 0, bite: 0, skull: 0, fins: 0, scales: 4 });
    const hi = evolutionStep(zero, () => 1, { hp: 0, bite: 0, skull: 0, fins: 0, scales: 4 });
    expect(lo.scales).toBe(3);
    expect(hi.scales).toBe(5);
  });

  it('dem Tod nahe sein zählt nur Sekunden unter einem Viertel der Lebenskraft im Spielstil mit', () => {
    const style = { ...newStyle(), hurt: 9, danger: 15 };
    const h = game.inherit({ meat: 0, plant: 0 }, style);
    expect(h.evolution!.fixed!.scales).toBe(5);
    // Vorschau neutral (kein ±1): 5 Schuppenpunkte mehr
    expect(h.traits.scaleGain).toBe(5);
  });
});

describe('Gewichtung und letzter Schritt', () => {
  it('Schuppen, Flossen und Schädel zählen mehr, Gebiss und Leben weniger', () => {
    const W = INHERIT.weight;
    expect(W.scales).toBeGreaterThan(1);
    expect(W.fins).toBeGreaterThan(1);
    expect(W.skull).toBeGreaterThan(1);
    expect(W.bite).toBeLessThan(1);
    expect(W.hp).toBeLessThan(1);
    const base = { hp: 10, bite: 10, skull: 10, fins: 10, scales: 10 };
    const out = evolutionStep(base, () => 0.5);
    expect(out.scales).toBeGreaterThan(out.skull - 1.7); // Kosten der Gegenpaare mitgerechnet
    expect(out.hp).toBeCloseTo(10 * W.hp, 5);
  });

  it('als letzter Schritt bekommt jedes Feld +1 oder −1', () => {
    const base = { hp: 0, bite: 0, skull: 0, fins: 0, scales: 0 };
    expect(evolutionStep(base, () => 0)).toEqual({ hp: -1, bite: -1, skull: -1, fins: -1, scales: -1 });
    expect(evolutionStep(base, () => 1)).toEqual({ hp: 1, bite: 1, skull: 1, fins: 1, scales: 1 });
    let seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(evolutionStep(base).hp);
    expect([...seen].sort()).toEqual([-1, 1]);
  });
});
