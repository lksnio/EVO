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

describe('Versteckte Farbabweichung je Ei', () => {
  it('Körper, Flossen und Panzer wandern in kleinen Schritten und bleiben im natürlichen Bereich', async () => {
    const { driftColors } = await import('../src/state/GameState');
    const { INHERIT } = await import('../src/data/life');
    const { palette, COLOR, PLATE_BASE } = await import('../src/art/creatureArt');
    // Zufall deterministisch (einfacher Zähler), Schritte nie größer als drei Streuungen
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let t = { cb: 0, cf: 0, cp: 0 } as never as import('../src/state/GameState').Traits;
    const path: number[] = [];
    for (let g = 0; g < 400; g++) {
      const n = driftColors(t, rnd);
      for (const k of ['cb', 'cf', 'cp'] as const) {
        expect(Math.abs((n[k] ?? 0) - (t[k] ?? 0))).toBeLessThanOrEqual(3 * INHERIT.colorStep + 1e-9);
        expect(Math.abs(n[k] ?? 0)).toBeLessThanOrEqual(1);
      }
      t = n;
      path.push(t.cb ?? 0);
    }
    // sie wandert wirklich (nicht dauernd null) und die drei Farben sind unabhängig
    expect(Math.max(...path) - Math.min(...path)).toBeGreaterThan(0.3);
    const a = driftColors({ cb: 0, cf: 0, cp: 0 } as never, rnd), b = driftColors({ cb: 0, cf: 0, cp: 0 } as never, rnd);
    expect(a.cb).not.toBe(b.cb);
    // Palette: Körper und Flossen folgen den Werten, an den Enden nur wenige Grad – dieselbe Art Fisch
    const m = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7 } as const;
    const base = palette({ ...m }), hi = palette({ ...m, cb: 1, cf: 1, cp: 1 }), lo = palette({ ...m, cb: -1, cf: -1, cp: -1 });
    expect(hi.base).not.toBe(base.base);
    expect(lo.fin).not.toBe(base.fin);
    expect(hi.plate).not.toBe(lo.plate);
    expect(palette({ ...m }).plate).toBe(palette({ ...m, cp: 0 }).plate);
    expect(COLOR.hueBody).toBeLessThanOrEqual(30);
    expect(COLOR.huePlate).toBeLessThanOrEqual(25);
    expect(PLATE_BASE).toBe(0xb9ae9a);
  });

  it('jedes Ei bekommt seinen eigenen Wert (Aussehen je Ei, ohne Anzeige)', async () => {
    const { morphKey } = await import('../src/art/creatureArt');
    const m = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7 } as const;
    expect(morphKey({ ...m, cb: 0.5 })).not.toBe(morphKey({ ...m, cb: 0 }));
    expect(morphKey({ ...m, cp: 0.3 })).not.toBe(morphKey({ ...m }));
    // sehr kleine Unterschiede teilen sich eine Textur (Quantisierung)
    expect(morphKey({ ...m, cb: 0.51 })).toBe(morphKey({ ...m, cb: 0.5 }));
  });
});
