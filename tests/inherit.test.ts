import { beforeEach, describe, expect, it } from 'vitest';
import { LIFE, SPAWN } from '../src/data/life';
import { game, newStyle, PLATE_IDS } from '../src/state/GameState';

// Vererbung ohne Wahl: Die Nachkommen sind an die Spielweise angepasst – und schlüpfen aus dem befruchteten Gelege.
describe('Generationswechsel', () => {
  beforeEach(() => {
    game.resetAll();
    game.newRun();
  });

  it('ein Jungtier ist klein und schwach, ausgewachsen stark – Artgenossen sind immer ausgewachsen', () => {
    const young = game.stats();
    game.ageBy(LIFE.mature * 3);
    const grown = game.stats();
    expect(young.size).toBeLessThan(grown.size * 0.5);
    expect(young.bite).toBeLessThan(grown.bite);
    expect(young.maxHp).toBeLessThan(grown.maxHp);
    expect(game.stats(game.cls, game.traits).size).toBeCloseTo(game.stats(game.cls, game.traits).size);
    game.ageBy(LIFE.span);
    expect(game.stats().speed).toBeLessThan(grown.speed);
  });

  it('nur befruchtete Gelege führen die Linie weiter, unbefruchtete verderben', () => {
    const now = Date.now();
    const a = game.addClutch({ place: 'lagune', x: 100, y: 200, at: now, fert: false, role: 'mother' });
    expect(game.heir()).toBeUndefined();
    game.fertilize(a.id, { traits: { ...game.traits }, seed: 5, sex: 1 });
    expect(game.heir()?.id).toBe(a.id);
    const b = game.addClutch({ place: 'lagune', x: 300, y: 200, at: now - SPAWN.decay * 1000 - 1, fert: false, role: 'mother' });
    expect(game.decayClutches(now)).toBe(true);
    expect(game.life.clutches.map((c) => c.id)).toEqual([a.id]);
    void b;
  });

  it('ein Gelege, zu dem ein Männchen unterwegs ist, verdirbt nicht (auch nach langer Pause)', () => {
    const now = Date.now();
    const c = game.addClutch({ place: 'lagune', x: 100, y: 200, at: now, fert: false, role: 'mother' });
    game.maleCalled(c.id);
    expect(game.decayClutches(now + SPAWN.decay * 1000 * 5)).toBe(false);
    expect(game.life.clutches[0].called).toBe(true);
  });

  it('ein Endgegner, der dem Elterntier folgte, folgt nicht der neuen Generation', () => {
    game.prog.boss = 1;
    const c = game.addClutch({ place: 'lagune', x: 640, y: 900, at: Date.now(), fert: true, role: 'mother' });
    game.succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.prog.boss).toBe(0);
  });

  it('wer viel stößt, bekommt Nachkommen mit härterem Kopf – ohne Wahl, eine Generation weiter', () => {
    game.ageBy(LIFE.mature + 60);
    const before = { ...game.traits };
    const style = { ...newStyle(), ram: 60, hunt: 2, chase: 1, swim: 10 };
    const h = game.inherit({ meat: 10, plant: 10 }, style);
    expect(h.line).toBe('st');
    expect(h.traits.st).toBeGreaterThan(before.st);
    expect(h.traits.skull).toBeGreaterThan(before.skull);
    expect(h.traits.st - before.st).toBeGreaterThan(h.traits.bs - before.bs);
    for (const id of PLATE_IDS) expect(h.fit[id]).toBeGreaterThanOrEqual(0);
    const c = game.addClutch({ place: 'lagune', x: 640, y: 900, at: Date.now(), fert: true, role: 'mother' });
    const gen = game.life.gen;
    game.succeed(c, h);
    expect(game.life.gen).toBe(gen + 1);
    expect(game.life.age).toBe(0);
    expect(game.life.clutches).toEqual([]);
    expect(game.prog.at).toEqual({ x: 640, y: 900 });
    expect(game.traits.st).toBe(h.traits.st);
    expect(game.run?.history.length).toBe(1);
  });

  it('der Partner gibt nur etwas vom Aussehen mit', () => {
    const style = newStyle();
    const partner = { traits: { ...game.traits, green: 1, armor: 1, growth: 1 }, seed: 1, sex: 1 as const };
    const h = game.inherit({ meat: 0, plant: 0 }, style, partner);
    expect(h.traits.green).toBeGreaterThan(0);
    expect(h.traits.green).toBeLessThan(0.5);
    expect(h.traits.armor).toBeLessThan(0.5);
    expect(h.traits.growth).toBeLessThan(0.5);
  });
});
