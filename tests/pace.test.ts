import { describe, expect, it } from 'vitest';
import { HUNT } from '../src/data/life';
import { attackPace, chasePace, surgeStep } from '../src/sim/pace';

describe('Kampf-Beschleunigung der Jäger', () => {
  it('ohne Kampf bleibt alles normal: Tempo und Angriff ×1', () => {
    expect(chasePace(0)).toBe(1);
    expect(attackPace(0)).toBe(1);
    expect(surgeStep(0, false, 5)).toBe(0);
  });

  it('im Kampf steigt sie stetig und ist nach HUNT.rise Sekunden voll – danach nicht mehr', () => {
    let s = 0;
    const seen: number[] = [];
    for (let t = 0; t < HUNT.rise + 2; t += 0.1) {
      s = surgeStep(s, true, 0.1);
      seen.push(s);
    }
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1])).toBe(true);
    expect(seen[Math.round((HUNT.rise / 2) / 0.1)]).toBeGreaterThan(0.3);
    expect(seen[Math.round((HUNT.rise / 2) / 0.1)]).toBeLessThan(0.7);
    expect(s).toBe(1);
    expect(chasePace(1)).toBeCloseTo(1 + HUNT.chase);
    expect(attackPace(1)).toBeCloseTo(1 + HUNT.attack);
  });

  it('nach dem Kampf klingt sie langsamer ab, als sie anwuchs', () => {
    expect(HUNT.fade).toBeGreaterThan(HUNT.rise);
    const s = surgeStep(1, false, HUNT.fade / 2);
    expect(s).toBeCloseTo(0.5);
    expect(surgeStep(1, false, HUNT.fade * 2)).toBe(0);
  });

  it('der Angriff wird mit dem Kampf schneller, das Verfolgen auch – der Biss mindestens so stark wie das Verfolgen', () => {
    for (const k of [0.25, 0.5, 1]) {
      expect(chasePace(k)).toBeGreaterThan(1);
      expect(attackPace(k)).toBeGreaterThan(1);
    }
    expect(HUNT.chase).toBeGreaterThan(0.2);
    expect(HUNT.attack).toBeGreaterThan(0.2);
  });
});
