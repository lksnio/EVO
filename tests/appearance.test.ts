import { beforeEach, describe, expect, it, vi } from 'vitest';
import { morphKey, quantize } from '../src/art/creatureArt';
import { ADULT } from '../src/sim/life';
import { game } from '../src/state/GameState';

vi.mock('phaser', () => ({ default: {} }));

beforeEach(() => { game.resetAll(); game.newRun(0); });

describe('Sichtbare Entwicklung', () => {
  it.each([[0, 0], [9, 0], [10, 1], [20, 2], [40, 4], [50, 5], [90, 9], [190, 19]])(
    'Gebisszuwachs %s erzeugt Vorderzahnstufe %s', (biteGain, tier) => {
      expect(game.morph({ traits: { ...game.traits, biteGain } }).toothTier).toBe(tier);
    },
  );

  it('erzeugt auch bei bereits maximalem Kiefer neue Zahntexturen statt alte aus dem Cache zu verwenden', () => {
    const a = game.morph({ traits: { ...game.traits, biteGain: 40 } });
    const b = game.morph({ traits: { ...game.traits, biteGain: 50 } });
    expect(a.jaw).toBe(1);
    expect(b.jaw).toBe(1);
    expect(quantize(a).toothTier).toBe(4);
    expect(quantize(b).toothTier).toBe(5);
    expect(morphKey(a)).not.toBe(morphKey(b));
    expect(quantize({ ...a, toothTier: undefined }).toothTier).toBe(0);
  });

  it('behält die vererbte Zahnstufe beim Heranwachsen und Altern bei', () => {
    const traits = { ...game.traits, biteGain: 50 };
    const young = game.morph({ traits, life: { grow: 0.4, old: 0 } });
    const grown = game.morph({ traits, life: ADULT });
    const old = game.morph({ traits, life: { grow: 1, old: 1 } });
    expect(young.size).toBeLessThan(grown.size);
    expect(young.toothTier).toBe(grown.toothTier);
    expect(old.toothTier).toBe(grown.toothTier);
  });

  it('zusätzliche vererbte Lebenskraft vergrößert den Körper maßvoll, ohne Waffen oder Tempo mitzuerhöhen', () => {
    const start = { ...game.traits };
    const strong = { ...start, vitality: 30 };
    const a = game.stats('fish', start, ADULT);
    const b = game.stats('fish', strong, ADULT);
    expect(b.maxHp).toBeGreaterThan(a.maxHp * 2);
    expect(b.size / a.size).toBeGreaterThan(1.13);
    expect(b.size / a.size).toBeLessThan(1.18);
    expect(b.speed).toBe(a.speed);
    expect(b.bite).toBe(a.bite);
    expect(b.ram).toBe(a.ram);
    expect(game.morph({ traits: strong }).size).toBe(b.size);
    expect(game.measure('fish', strong).cm).toBeGreaterThan(game.measure('fish', start).cm);
    expect(game.stats('fish', strong, { grow: 0.4, old: 0 }).size).toBeCloseTo(b.size * 0.4);
  });

  it('Lebenssegen lassen den Körper stärker wachsen, der Schädel-Grundwert bleibt 10', () => {
    const no = { hp: 0, sight: 0, stam: 0, oxy: 0 };
    const a = game.stats('fish', game.traits, ADULT, no);
    const b = game.stats('fish', game.traits, ADULT, { ...no, hp: 4 });
    expect(b.size / a.size).toBeCloseTo(1.072);
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    expect(b.ram).toBe(a.ram);
    expect(game.roeShown().ram).toBe(10);
    expect(a.ramStun).toBe(1000);
    expect(b.ramStun).toBe(1000);
  });
});
