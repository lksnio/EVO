import { beforeEach, describe, expect, it } from 'vitest';
import { epochIndex } from '../src/data/epochs';
import { BROOD, KTRAIN } from '../src/data/karbon';
import { game, ZERO_TRAITS } from '../src/state/GameState';

// Das Karbon im Spielstand: Man lebt als Pederpes, beginnt mit einem Gelege voller Eier, und die Segen der großen Muschel
// (Lebenskraft, Ausdauer, Sauerstoff) überdauern das Aussterben.

const K = epochIndex('karbon');

describe('Karbon im Spielstand', () => {
  beforeEach(() => game.resetAll());

  it('eine neue Linie: Pederpes, ein Gelege mit 100 Eiern, Generation 0, Grundwerte', () => {
    const run = game.newRun(K);
    expect(run.epoch).toBe(K);
    expect(run.cls).toBe('amphibian');
    expect(run.brood?.eggs).toBe(BROOD.eggs);
    expect(run.brood?.gen).toBe(0);
    expect(run.brood?.phase).toBe('young');
    expect(run.traits).toEqual(ZERO_TRAITS);
    // ein Jungtier ist klein
    expect(game.lifeK.grow).toBeCloseTo(BROOD.growHatch);
    // an der großen Muschel: Sauerstoff statt Sicht
    expect(game.upKeys).toEqual(['hp', 'stam', 'oxy']);
    game.newRun(0);
    expect(game.upKeys).toEqual(['hp', 'stam', 'sight']);
  });

  it('Fressen, Metamorphose, ein Ei wählen: das neue Tier trägt das Erbgut seines Eis und schlüpft am Nest', () => {
    game.newRun(K);
    expect(game.broodFeed(BROOD.food).meta).toBe(true);
    game.metamorphose();
    expect(game.brood?.phase).toBe('grown');
    expect(game.lifeK.grow).toBe(1);
    expect(game.morph().gills).toBe(0);
    const eggs = game.eggOffer();
    expect(eggs.length).toBe(BROOD.choice);
    game.brood!.nest = { place: 'brut', x: 900, y: 700 };
    game.prog.place = 'farn';
    game.hatchEgg(eggs[0]);
    expect(game.brood?.eggs).toBe(BROOD.eggs - 1);
    expect(game.prog.place).toBe('brut');
    expect(game.prog.at).toEqual({ x: 900, y: 700 });
  });

  it('das neue Gelege: die nächste Generation trägt, was die vorige trainiert hat', () => {
    game.newRun(K);
    game.metamorphose();
    game.brood!.train.land = KTRAIN.ref.land * 10;
    game.brood!.train.hurt = KTRAIN.ref.hurt * 10;
    const next = game.newClutch()!;
    expect(next.gen).toBe(1);
    expect(next.eggs).toBe(BROOD.eggs);
    expect(next.phase).toBe('young');
    expect(next.genes.limb).toBeGreaterThan(0.1);
    expect(next.genes.armor).toBeGreaterThan(0.09);
    expect(next.genes.jaw).toBe(0);
    game.hatchEgg(game.eggOffer()[0]);
    expect(game.traits.limb).toBeGreaterThan(0.05);
  });

  it('Kompromisse: Beine bremsen beim Schwimmen und machen an Land schneller, Griff und Beine lassen steilere Hänge zu', () => {
    game.newRun(K);
    game.metamorphose();
    const s0 = game.stats();
    game.run!.traits = { ...game.run!.traits, limb: 0.8, grip: 0.6 };
    const s1 = game.stats();
    expect(s1.speed).toBeLessThan(s0.speed);
    expect(s1.landSpeed).toBeGreaterThan(s0.landSpeed);
    expect(s1.slope).toBeGreaterThan(s0.slope);
    game.run!.traits = { ...game.run!.traits, limb: 0, grip: 0, armor: 0.8 };
    const s2 = game.stats();
    expect(s2.defense).toBeLessThan(s0.defense);
    expect(s2.landSpeed).toBeLessThan(s0.landSpeed);
  });

  it('Übersicht und Eier messen sich am ersten Pederpes: Er hat überall 10', () => {
    game.newRun(K);
    game.metamorphose();
    const v = game.shown();
    expect([v.bite, v.legs, v.grip, v.scales]).toEqual([10, 10, 10, 10]);
    expect(game.eggShown(game.eggOffer()[0])).toEqual({ jaw: 10, limb: 10, grip: 10, armor: 10 });
    const e = game.eggShown({ genes: { jaw: 0.3, limb: 0.2, grip: 0, armor: 0.1 } });
    expect(e.jaw).toBeGreaterThan(10);
    expect(e.limb).toBe(14);
    expect(e.grip).toBe(10);
  });

  it('die Segen der großen Muschel überdauern im Karbon das Aussterben', () => {
    game.newRun(K);
    for (let i = 0; i < 7; i++) game.addShell();
    expect(game.buyUp('oxy')).toBe(true);
    expect(game.buyUp('hp')).toBe(true);
    const sec = game.oxygenSeconds;
    game.extinct(0.3, 'Test');
    game.newRun(K);
    expect(game.ups.oxy).toBe(1);
    expect(game.ups.hp).toBe(1);
    // im Devon beginnt eine neue Linie dagegen ohne Segen
    game.newRun(0);
    expect(game.upCount).toBe(0);
    game.newRun(K);
    expect(game.oxygenSeconds).toBeGreaterThan(0);
    expect(sec).toBeGreaterThan(0);
  });
});
