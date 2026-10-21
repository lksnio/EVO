import { beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, SPAWN, UPGRADES } from '../src/data/life';
import { phases } from '../src/sim/life';
import { game, newStyle, upCost } from '../src/state/GameState';

// Goldene Geburt, die Segen als Punktfolge, und was sich gegenüber der vorigen Generation verändert hat.

/** Gelaicht (n Eier) – mit dieser Wahrscheinlichkeit golden, ohne Streuung. */
function lay(n: number, gold: number, t: Partial<typeof game.traits> = {}) {
  const g = SPAWN.gold, v = INHERIT.vary;
  SPAWN.gold = gold;
  INHERIT.vary = 0;
  const c = game.addClutch({ place: 'laichfluss', x: 300, y: 600, at: Date.now(), fert: true, role: 'father', young: n });
  const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
  Object.assign(h.traits, t);
  const eggs = game.layEggs(c, h);
  SPAWN.gold = g;
  INHERIT.vary = v;
  return eggs;
}

describe('Goldene Geburt', () => {
  beforeEach(() => {
    game.resetAll();
    game.newRun();
  });

  it('etwa jedes zwanzigste Ei leuchtet golden – mit einem Segen in einer Richtung der großen Muschel', () => {
    expect(SPAWN.gold).toBe(0.05);
    const eggs = lay(24, 1);
    expect(eggs.every((e) => e.gold && game.upKeys.includes(e.gold))).toBe(true);
    expect(game.life.clutches[0].gold).toBe(true);
    expect(lay(24, 0).some((e) => e.gold)).toBe(false);
  });

  it('der goldene Segen gilt nur für dieses Tier: so viel wie der nächste Segen – ohne den Preis zu erhöhen', () => {
    for (let i = 0; i < 20; i++) game.addShell();
    // Lebenskraft (1) + Lebenskraft (2) + Lebenskraft (4) + Ausdauer (8): 15 Muscheln
    for (const k of ['hp', 'hp', 'hp', 'stam'] as const) expect(game.buyUp(k)).toBe(true);
    expect(game.shellsSpent).toBe(15);
    expect(game.upTrail.map((d) => d.key)).toEqual(['hp', 'hp', 'hp', 'stam']);
    const hp0 = game.roeShown().hp;
    // ein goldenes Ei mit Lebenskraft schlüpft (die nächste Generation)
    const [egg] = lay(1, 1);
    egg.gold = 'hp';
    // das Ei zeigt den goldenen Segen schon
    expect(game.roeShown(egg).hp).toBeGreaterThan(hp0);
    expect(game.hatch('next', 0)).toBe(true);
    expect(game.ups.hp).toBe(4);
    expect(game.bought.hp).toBe(3);
    // der Preis des nächsten Segens: wie ohne den goldenen (16)
    expect(game.upCount).toBe(4);
    expect(game.upCost).toBe(upCost(4));
    expect(game.upCost).toBe(16);
    // die Punktfolge: rot, rot, rot, grau – dann golden rot
    expect(game.upTrail).toEqual([
      { key: 'hp', gold: false }, { key: 'hp', gold: false }, { key: 'hp', gold: false }, { key: 'stam', gold: false }, { key: 'hp', gold: true },
    ]);
    // er findet Muscheln und wählt Sicht für 16: rot, rot, rot, grau, rot (golden), schwarz
    for (let i = 0; i < 11; i++) game.addShell();
    expect(game.buyUp('sight')).toBe(true);
    expect(game.shellsSpent).toBe(31);
    expect(game.upTrail.map((d) => (d.gold ? `${d.key}*` : d.key))).toEqual(['hp', 'hp', 'hp', 'stam', 'hp*', 'sight']);
    // das nächste Tier (ohne Gold) hat ihn nicht mehr – die gekauften Segen bleiben
    game.ageBy(phases(2).mature);
    lay(1, 0);
    expect(game.hatch('next', 0)).toBe(true);
    expect(game.ups.hp).toBe(3);
    expect(game.upTrail.map((d) => d.key)).toEqual(['hp', 'hp', 'hp', 'stam', 'sight']);
    expect(UPGRADES.max).toBeGreaterThanOrEqual(5);
  });
});

describe('Übersicht: Veränderung gegenüber der vorigen Generation', () => {
  beforeEach(() => {
    game.resetAll();
    game.newRun();
  });

  it('der Urfisch hat keine vorige Generation – ein Nachkomme mit stärkerem Gebiss zeigt das Plus', () => {
    expect(game.inheritedDelta()).toBeNull();
    lay(1, 0, { jaw: 0.2, bs: 1 });
    game.hatch('next', 0);
    const d = game.inheritedDelta()!;
    expect(d.bite).toBeGreaterThan(0);
    expect(d.skull).toBe(0);
    expect(d.scales).toBe(0);
    // und schwächer: ein Minus
    lay(1, 0, { jaw: 0.05 });
    game.hatch('next', 0);
    expect(game.inheritedDelta()!.bite).toBeLessThan(0);
  });
});
