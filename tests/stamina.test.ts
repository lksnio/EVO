import { beforeEach, describe, expect, it } from 'vitest';
import { fishStaminaMax, FISH_ATTACK_COST, spendStamina } from '../src/sim/stamina';
import { game } from '../src/state/GameState';
import { ADULT } from '../src/sim/life';

describe('Ausdauer und absolute Angriffskosten', () => {
  beforeEach(() => { game.resetAll(); game.newRun(); });

  it.each([[30, 1, 5, 8], [45, 1.5, 7, 12], [60, 2, 10, 16], [100, 10 / 3, 16, 26]])(
    'Ausdauer %s: Reserve %s für %s Bisse oder %s Stöße ohne Regeneration', (points, reserve, bites, rams) => {
      game.traits.staminaGain = points-30;
      expect(game.staminaMax).toBeCloseTo(reserve);
      expect(game.stats('fish', game.traits, ADULT).endurance).toBeCloseTo(reserve);
      const count = (cost: number) => {
        let left = game.staminaMax, n = 0;
        for (let next = spendStamina(left, cost); next !== null; next = spendStamina(left, cost)) { left = next; n++; }
        return n;
      };
      expect(count(FISH_ATTACK_COST.bite)).toBe(bites);
      expect(count(FISH_ATTACK_COST.ram)).toBe(rams);
    },
  );

  it('wächst zwischen den Stufen stetig und anteilig, auch bei Bruchteilen von Ausdauerpunkten', () => {
    expect(fishStaminaMax(37.5)).toBeCloseTo(1.25);
    expect(fishStaminaMax(52.5)).toBeCloseTo(1.75);
    expect(fishStaminaMax(80)).toBeCloseTo(8 / 3);
    for (const knot of [45, 60, 100]) {
      expect(fishStaminaMax(knot - 1e-5)).toBeCloseTo(fishStaminaMax(knot), 5);
      expect(fishStaminaMax(knot + 1e-5)).toBeCloseTo(fishStaminaMax(knot), 5);
    }
    expect(fishStaminaMax(-20)).toBe(1);
    expect(fishStaminaMax(Number.NaN)).toBe(1);
  });

  it('gibt bei fehlender Kraft keinen Kredit und toleriert nur Rundungsreste', () => {
    expect(spendStamina(0, FISH_ATTACK_COST.bite)).toBeNull();
    expect(spendStamina(FISH_ATTACK_COST.bite - .01, FISH_ATTACK_COST.bite)).toBeNull();
    expect(spendStamina(FISH_ATTACK_COST.ram - 1e-12, FISH_ATTACK_COST.ram)).toBe(0);
  });
});
