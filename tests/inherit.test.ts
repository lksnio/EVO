import { beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, SPAWN } from '../src/data/life';
import { phases } from '../src/sim/life';
import { game, meatOf, newStyle, noteBest, plateCeil, plateLevel, PLATE_IDS } from '../src/state/GameState';

// Vererbung ohne Wahl: Die Nachkommen sind an die Spielweise angepasst – und schlüpfen aus dem befruchteten Gelege.
describe('Generationswechsel', () => {
  beforeEach(() => {
    game.resetAll();
    game.newRun();
  });

  it('ein Jungtier ist klein und schwach, ausgewachsen stark – Artgenossen sind immer ausgewachsen', () => {
    const young = game.stats();
    game.ageBy(phases(1).mature * 1.3);
    const grown = game.stats();
    expect(young.size).toBeLessThan(grown.size * 0.5);
    expect(young.bite).toBeLessThan(grown.bite);
    expect(young.maxHp).toBeLessThan(grown.maxHp);
    expect(game.stats(game.cls, game.traits).size).toBeCloseTo(game.stats(game.cls, game.traits).size);
    game.ageBy(phases(1).span);
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

  it('die Nahrung eines Lebens wird zu Nachkommen – sie sind die übrigen Leben (Geschwister im Gelege)', () => {
    // der erste Fisch: je 100 Gefressenem ein Nachkomme
    expect(game.broodBase).toBe(SPAWN.perYoung);
    expect(SPAWN.perYoung).toBe(100);
    expect(game.spawnMinFood).toBeCloseTo(SPAWN.minFood, 6);
    game.feed(SPAWN.perYoung * 4.3);
    expect(game.young).toBe(4);
    const c = game.addClutch({ place: 'lagune', x: 500, y: 800, at: Date.now(), fert: true, role: 'father' });
    const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
    game.succeed(c, h);
    expect(game.life.gen).toBe(2);
    expect(game.life.fed).toBe(0);
    // eins ist geschlüpft, drei warten
    expect(game.run?.siblings?.n).toBe(3);
    // stirbt es vor dem Laichen, schlüpft ein Geschwister: dieselbe Generation, so wie es geschlüpft ist
    game.grow('stealth', 0.5);
    game.ageBy(200);
    game.feed(80);
    expect(game.sibling()).toBe(true);
    expect(game.life.gen).toBe(2);
    expect(game.life.age).toBe(0);
    expect(game.life.fed).toBe(0);
    expect(game.traits.stealth).toBe(h.traits.stealth);
    expect(game.prog.at).toEqual({ x: 500, y: 800 });
    expect(game.run?.history.length).toBe(1);
    expect(game.sibling()).toBe(true);
    expect(game.sibling()).toBe(true);
    expect(game.run?.siblings).toBeUndefined();
    expect(game.sibling()).toBe(false);
  });

  it('mit einem befruchteten Gelege gibt es wenigstens einen Nachkommen; ein neues Gelege ersetzt die alten Geschwister', () => {
    game.feed(SPAWN.perYoung * 3.2);
    const c = game.addClutch({ place: 'lagune', x: 500, y: 800, at: Date.now(), fert: true, role: 'mother' });
    game.succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.run?.siblings?.n).toBe(2);
    // (ältere Spielstände): kaum Nahrung, aber befruchtet – einer schlüpft, keiner wartet
    game.feed(SPAWN.perYoung * 0.4);
    expect(game.young).toBe(0);
    const d = game.addClutch({ place: 'lagune', x: 700, y: 800, at: Date.now(), fert: true, role: 'mother' });
    expect(game.young).toBe(1);
    game.succeed(d, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.life.gen).toBe(3);
    expect(game.run?.siblings).toBeUndefined();
  });

  it('vorerst schlüpft jedes eigene Tier als Männchen – auch Nachkommen und Geschwister', () => {
    expect(SPAWN.alwaysMale).toBe(true);
    for (let k = 0; k < 6; k++) {
      game.resetAll();
      expect(game.newRun().sex).toBe(1);
      game.feed(SPAWN.perYoung * 3);
      const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
      const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
      expect(h.sex).toBe(1);
      game.succeed(c, h);
      expect(game.run?.sex).toBe(1);
      while (game.sibling()) expect(game.run?.sex).toBe(1);
    }
  });

  it('weiter entwickelte Nachfahren brauchen mehr Nahrung je Nachkomme – Schwere einen volleren Magen zum Laichen', () => {
    const food = game.spawnMinFood;
    const bite0 = game.stats(game.cls, game.traits).bite;
    // nur das Gebiss etwa 25 % stärker: rund 200 je Nachkomme
    game.traits.jaw = 0.089;
    const bite = game.stats(game.cls, game.traits).bite / bite0 - 1;
    expect(bite).toBeGreaterThan(0.2);
    expect(bite).toBeLessThan(0.3);
    expect(game.broodBase).toBeGreaterThan(180);
    expect(game.broodBase).toBeLessThan(225);
    // ein schwereres Tier: stärker in vielem – deutlich mehr je Nachkomme, und ein vollerer Magen zum Laichen
    game.traits.growth = 1;
    game.traits.girth = 0.6;
    expect(game.weight()).toBeGreaterThan(3);
    expect(game.broodBase).toBeGreaterThan(300);
    expect(game.spawnMinFood).toBeGreaterThan(food);
    expect(game.spawnMinFood).toBeLessThanOrEqual(SPAWN.minFoodMax);
  });

  it('Beute gibt Futter nach Stärke und Größe – kleine einen Happen, große mehrere Mägen voll', () => {
    const stomach = 100;
    // ein kleiner Beutefisch (Lebenskraft 6): ein ordentlicher Happen, kein Krümel
    expect(meatOf(6)).toBeGreaterThan(stomach * 0.12);
    expect(meatOf(6)).toBeLessThan(stomach * 0.25);
    // ein Räuber wie Orthoceras (41): fast ein ganzer Magen
    expect(meatOf(41)).toBeGreaterThan(stomach * 0.7);
    // ein Riese: mehrere Mägen voll
    expect(meatOf(343)).toBeGreaterThan(stomach * 4);
    // je stärker, desto mehr – aber nicht ganz im selben Maß (große Tiere sind zäh)
    expect(meatOf(20)).toBeGreaterThan(meatOf(10));
    expect(meatOf(200) / meatOf(20)).toBeLessThan(10);
  });

  it('wie im Fitnessstudio: nur kleine Beute trägt bis zu einer Stufe, stärkere Gegner darüber hinaus', () => {
    const train = (best: number) => {
      game.resetAll();
      game.newRun();
      for (let gen = 0; gen < 14; gen++) {
        const style = { ...newStyle(), hunt: 200 };
        for (let i = 0; i < 5; i++) noteBest(style, 'hunt', best);
        const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
        game.succeed(c, game.inherit({ meat: 10, plant: 0 }, style));
      }
      return plateLevel(game.traits.bs);
    };
    const small = train(0.5), equal = train(1), strong = train(2);
    // kleine Beute (halb so stark): Es geht voran – aber nur bis zur Obergrenze
    expect(small).toBeGreaterThan(0.4);
    expect(small).toBeLessThanOrEqual(0.3 + 0.45 * 0.5 + 0.001);
    expect(equal).toBeGreaterThan(small + 0.15);
    expect(strong).toBeGreaterThan(equal);
    // es bleiben Kompromisse: Ein starkes Gebiss macht langsamer
    game.resetAll();
    const base = game.stats(game.cls, game.newRun().traits);
    game.traits.bs = 3;
    game.traits.jaw = 0.8;
    expect(game.stats(game.cls, game.traits).speed).toBeLessThan(base.speed);
  });

  it('die drei stärksten Gegner zählen – ein einzelner Glückstreffer trägt nicht weit', () => {
    const style = newStyle();
    noteBest(style, 'ram', 3);
    noteBest(style, 'ram', 0.4);
    expect(plateCeil(style).st).toBeCloseTo(0.3 + 0.45 * (3.4 / 3), 5);
    for (let i = 0; i < 4; i++) noteBest(style, 'ram', 2.5);
    expect(style.best?.ram).toEqual([3, 2.5, 2.5]);
    expect(plateCeil(style).st).toBe(1);
    // was nicht geübt wurde, bleibt bei der Grundstufe
    expect(plateCeil(style).bs).toBeCloseTo(0.3, 5);
  });

  it('ein Endgegner, der dem Elterntier folgte, folgt nicht der neuen Generation', () => {
    game.prog.boss = 1;
    const c = game.addClutch({ place: 'lagune', x: 640, y: 900, at: Date.now(), fert: true, role: 'mother' });
    game.succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.prog.boss).toBe(0);
  });

  it('wer viel stößt, bekommt Nachkommen mit härterem Kopf – ohne Wahl, eine Generation weiter', () => {
    game.ageBy(phases(1).mature + 60);
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

  it('keine Generation verändert sich zu stark – aber merklich', () => {
    game.ageBy(phases(1).mature + 60);
    const before = { ...game.traits };
    // ein Leben voller Stöße, Bisse und Verfolgungen, tief unten, viel eingesteckt, nur Fleisch
    const style = { ...newStyle(), ram: 500, hunt: 500, chase: 500, swim: 500, hurt: 200, hab: { abyss: 900 } };
    const h = game.inherit({ meat: 100, plant: 0 }, style);
    const grew = PLATE_IDS.map((id) => 1 - Math.exp(-0.7 * h.traits[id]) - (1 - Math.exp(-0.7 * before[id])));
    for (const g of grew) expect(g).toBeLessThanOrEqual(INHERIT.plateStep + 1e-9);
    expect(grew.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(INHERIT.plateTotal + 1e-9);
    expect(Math.max(...grew)).toBeGreaterThan(0.05);
    expect(Math.abs(h.traits.growth - before.growth)).toBeLessThanOrEqual(INHERIT.step.growth + 1e-9);
    expect(h.traits.armor - before.armor).toBeLessThanOrEqual(INHERIT.step.armor + 1e-9);
    expect(Math.abs(h.traits.diet - before.diet)).toBeLessThanOrEqual(INHERIT.step.diet + 1e-9);
    // sichtbar: Kiefer, Schädel oder Körperbau haben sich bewegt
    expect(Math.abs(h.traits.jaw - before.jaw) + Math.abs(h.traits.skull - before.skull) + Math.abs(h.traits.len - before.len)).toBeGreaterThan(0.05);
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
