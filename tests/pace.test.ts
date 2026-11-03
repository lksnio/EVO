import { describe, expect, it } from 'vitest';
import { HUNT } from '../src/data/life';
import { attackPace, chasePace, surgeStep, roamingPace } from '../src/sim/pace';

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

describe('Lebendiges normales Schwimmen',()=>{
  it('hat häufig zügige Phasen für große Tiere, ohne negative Geschwindigkeiten oder Sprünge',()=>{
    const values=Array.from({length:1200},(_,i)=>roamingPace(i/20,1.7,true));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(.7);
    expect(Math.max(...values)).toBeLessThanOrEqual(1.6);
    expect(values.filter(v=>v>1).length/values.length).toBeGreaterThan(.5);
    expect(Math.max(...values.map((v,i)=>i?Math.abs(v-values[i-1]):0))).toBeLessThan(.03);
  });
  it('schwimmt pro Tier versetzt und unterscheidet große von kleinen Tieren',()=>{
    const a=Array.from({length:100},(_,i)=>roamingPace(i/10,.2,true));
    const b=Array.from({length:100},(_,i)=>roamingPace(i/10,3.8,true));
    expect(a).not.toEqual(b);
    expect(roamingPace(3,1,true)).toBeGreaterThan(roamingPace(3,1,false));
  });
});
