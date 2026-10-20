import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SHELLS, STAMINA, UPGRADES } from '../src/data/life';
import { game, shellChance, sightOf, staminaMax, upCost, upSpent } from '../src/state/GameState';
import { phases } from '../src/sim/life';

// Muscheln fallen selten von erlegter Beute und bleiben über alle Läufe. An der großen Muschel verteilt man sie je Linie auf
// Lebenskraft, Ausdauer und Sicht: Der erste Segen kostet 1, jeder weitere doppelt so viel (gleich, wofür).

describe('Muscheln', () => {
  beforeEach(() => game.resetAll());

  it('fallen von erlegter Beute – ebenbürtige 10 %, doppelt so starke 20 %, schwache halb so oft', () => {
    expect(SHELLS.chance).toBe(0.1);
    expect(shellChance(1)).toBeCloseTo(0.1);
    expect(shellChance(2)).toBeCloseTo(0.2);
    expect(shellChance(9)).toBeCloseTo(0.2);
    expect(shellChance(0.1)).toBeCloseTo(0.05);
  });

  it('höchstens zehn Segen je Linie: der zehnte kostet 512, zusammen 1023 Muscheln', () => {
    expect(UPGRADES.max).toBe(10);
    expect(upCost(9)).toBe(512);
    expect(upSpent(10)).toBe(1023);
    game.newRun(0);
    for (let i = 0; i < 2000; i++) game.addShell();
    let n = 0;
    while (game.buyUp((['hp', 'sight', 'stam'] as const)[n % 3])) n++;
    expect(n).toBe(10);
    expect(game.upCount).toBe(10);
    expect(game.shellsFree).toBe(2000 - 1023);
    expect(game.canUp()).toBe(false);
  });

  it('jeder Segen kostet doppelt so viel wie der vorige, gleich wofür: 1, 2, 4, 8 …', () => {
    expect([0, 1, 2, 3, 4].map(upCost)).toEqual([1, 2, 4, 8, 16]);
    expect([0, 1, 2, 3, 4].map(upSpent)).toEqual([0, 1, 3, 7, 15]);
    game.newRun(0);
    expect(game.canUp()).toBe(false);
    game.addShell();
    expect(game.upCost).toBe(1);
    expect(game.buyUp('sight')).toBe(true);
    expect(game.shellsFree).toBe(0);
    expect(game.upCost).toBe(2);
    expect(game.buyUp('hp')).toBe(false);
    game.addShell();
    game.addShell();
    expect(game.buyUp('hp')).toBe(true);
    expect(game.ups).toEqual({ hp: 1, stam: 0, sight: 1, oxy: 0 });
    expect(game.upCost).toBe(4);
    expect(game.shells).toBe(3);
    expect(game.shellsFree).toBe(0);
  });

  it('Lebenskraft wächst um 2,5 % je Segen, Ausdauer um einen Viertelkreis, Sicht von 20 % um je 5 %', () => {
    game.newRun(0);
    const hp0 = game.stats().maxHp, size0 = game.stats().size;
    for (let i = 0; i < 15; i++) game.addShell();
    game.buyUp('hp');
    game.buyUp('hp');
    game.buyUp('hp');
    game.buyUp('hp');
    expect(game.ups.hp).toBe(4);
    expect(game.stats().maxHp).toBe(Math.round((hp0 * (1 + 4 * UPGRADES.hp))));
    expect(game.stats().size).toBeGreaterThan(size0);
    // die Werte fremder Tiere bleiben, wie sie sind
    expect(game.stats(game.cls, game.traits).maxHp).toBeLessThan(game.stats(game.cls, game.traits, undefined, true).maxHp);
    expect(sightOf(0)).toBeCloseTo(0.2);
    expect(sightOf(3)).toBeCloseTo(0.35);
    expect(sightOf(99)).toBe(1);
    expect(staminaMax(0)).toBe(1);
    expect(staminaMax(2)).toBe(1 + 2 * STAMINA.perBlessing);
    expect(staminaMax(100)).toBe(STAMINA.max);
  });

  it('die Muscheln bleiben über alle Läufe – eine neue Linie verteilt sie neu', () => {
    game.newRun(0);
    for (let i = 0; i < 7; i++) game.addShell();
    game.buyUp('stam');
    game.buyUp('stam');
    game.buyUp('sight');
    expect(game.shellsFree).toBe(0);
    expect(game.staminaMax).toBe(1 + 2 * STAMINA.perBlessing);
    game.extinct(0.5, 'Test');
    game.newRun(0);
    expect(game.shells).toBe(7);
    expect(game.shellsFree).toBe(7);
    expect(game.ups).toEqual({ hp: 0, stam: 0, sight: 0, oxy: 0 });
    expect(game.staminaMax).toBe(1);
    expect(game.sight).toBeCloseTo(0.2);
  });

  it('die Übersicht zeigt Zahlen – der erste Fisch hat ausgewachsen Gebiss und Schädel 10, Sicht 20, Ausdauer 30', () => {
    game.newRun(0);
    game.life.age = phases(1).mature + 30;
    const v = game.shown();
    expect(v.sight).toBe(20);
    expect(v.bite).toBe(10);
    expect(v.skull).toBe(10);
    expect(v.swarm).toBe(0);
    expect(v.scales).toBe(10);
    expect(v.stam).toBe(30);
    // die Vorschau der großen Muschel: was ein Segen brächte
    expect(game.shown({ hp: 0, stam: 0, sight: 1, oxy: 0 }).sight).toBe(25);
    expect(game.shown({ hp: 0, stam: 1, sight: 0, oxy: 0 }).stam).toBeGreaterThan(v.stam);
    expect(game.shown({ hp: 4, stam: 0, sight: 0, oxy: 0 }).hpMax).toBeGreaterThan(v.hpMax);
  });
});

describe('ältere Spielstände', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('Muscheln der Linie werden zu deinen, ihre Segen in Ausdauer bleiben', () => {
    game.resetAll();
    game.newRun(0);
    const old = JSON.parse(JSON.stringify(game.data));
    delete old.shells;
    delete old.seenShells;
    delete old.run.ups;
    old.run.shells = 9;
    old.run.seenRows = 8;
    old.run.blessings = 1;
    store.set('evo-save-v3', JSON.stringify(old));
    game.load();
    expect(game.shells).toBe(9);
    expect(game.seenShells).toBe(8);
    expect(game.ups).toEqual({ hp: 0, stam: 1, sight: 0, oxy: 0 });
    expect(game.shellsFree).toBe(8);
    expect(game.staminaMax).toBe(1 + STAMINA.perBlessing);
  });

  it('feste Muscheln von früher (eine Liste) zählen weiter', () => {
    game.resetAll();
    game.newRun(0);
    const old = JSON.parse(JSON.stringify(game.data));
    delete old.shells;
    delete old.run.ups;
    old.run.shells = ['devon:riff:0', 'devon:garten:0', 'devon:wand:1'];
    store.set('evo-save-v3', JSON.stringify(old));
    game.load();
    expect(game.shells).toBe(3);
    expect(game.staminaMax).toBe(1);
  });

  it('das Alter bleibt beim Laden, wie es war – nur wer nach heutiger Rechnung schon am Ende wäre, ist wieder alt', () => {
    game.resetAll();
    game.newRun(0);
    const P = phases(1);
    const save = (age: number) => {
      const d = JSON.parse(JSON.stringify(game.data));
      d.run.life.age = age;
      store.set('evo-save-v3', JSON.stringify(d));
      game.load();
      return game.life.age;
    };
    expect(save(P.mature + 100)).toBe(P.mature + 100);
    expect(save(P.span + 50)).toBe(P.old);
  });
});
