import { beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, SPAWN } from '../src/data/life';
import { phases } from '../src/sim/life';
import { game, meatChunks, meatOf, newStyle, noteBest, plateCeil, plateLevel, PLATE_IDS, type Clutch, type Heir } from '../src/state/GameState';
import { SPECIES } from '../src/data/species';

/**
 * Die nächste Generation schlüpft: Die Eier dieses Geleges kommen auf den Stapel (ohne Streuung, damit es nachprüfbar
 * bleibt), und das erste davon schlüpft. Gibt die Eier zurück.
 */
function succeed(c: Clutch, h: Heir) {
  const v = INHERIT.vary;
  INHERIT.vary = 0;
  const eggs = game.layEggs(c, h);
  INHERIT.vary = v;
  expect(game.hatch('next', game.roe.indexOf(eggs[0]))).toBe(true);
  return eggs;
}

// Vererbung: Was ein Tier beim Laichen weitergibt, liegt als Eier im Laich – stirbt es, wählt man eines davon.
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
    const a = game.addClutch({ place: 'lagune', x: 100, y: 200, at: now, fert: false, role: 'mother', young: 2 });
    expect(game.roe.length).toBe(0);
    game.fertilize(a.id, { traits: { ...game.traits }, seed: 5, sex: 1 });
    game.layEggs(game.life.clutches[0], game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.roe.length).toBe(2);
    // dasselbe Gelege legt nicht zweimal Eier
    expect(game.layEggs(game.life.clutches[0], game.inherit({ meat: 0, plant: 0 }, newStyle()))).toEqual([]);
    expect(game.roe.length).toBe(2);
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

  it('die Nahrung wird beim Laichen zu Nachkommen – mehrmals laichen zählt zusammen, sie sind die übrigen Leben', () => {
    // der erste Fisch: je 20 Gefressenem ein Nachkomme
    expect(game.broodBase).toBe(SPAWN.perYoung);
    expect(SPAWN.perYoung).toBe(20);
    game.feed(SPAWN.perYoung * 2.5);
    expect(game.young).toBe(0);
    // gelaicht: zwei Nachkommen, der Rest bleibt für das nächste Mal
    let n = game.takeYoung();
    expect(n).toBe(2);
    expect(game.life.fed).toBeCloseTo(10, 6);
    game.addClutch({ place: 'lagune', x: 300, y: 800, at: Date.now(), fert: true, role: 'father', young: n });
    expect(game.young).toBe(2);
    // später noch einmal gefressen und gelaicht: Es kommt dazu (zusammen 60 → 3)
    game.feed(SPAWN.perYoung * 0.5);
    n = game.takeYoung();
    expect(n).toBe(1);
    expect(game.life.fed).toBeCloseTo(0, 6);
    const c = game.addClutch({ place: 'lagune', x: 500, y: 800, at: Date.now(), fert: true, role: 'father', young: n });
    expect(game.young).toBe(3);
    const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
    game.layEggs(game.life.clutches[0], h);
    const [egg] = succeed(c, h);
    expect(game.life.gen).toBe(2);
    expect(game.life.fed).toBe(0);
    expect(game.prog.at).toEqual({ x: egg.x, y: egg.y });
    // eins ist geschlüpft, zwei warten als Geschwister
    expect(game.pool.length).toBe(2);
    expect(game.roe.length).toBe(0);
    // stirbt es, kann ein Geschwister schlüpfen: dieselbe Generation, so wie es gelaicht wurde
    game.grow('stealth', 0.5);
    game.ageBy(200);
    game.feed(80);
    const sib = game.pool[0];
    expect(game.hatch('pool', 0)).toBe(true);
    expect(game.life.gen).toBe(2);
    expect(game.life.age).toBe(0);
    expect(game.life.fed).toBe(0);
    expect(game.traits.stealth).toBeCloseTo(h.traits.stealth, 3);
    expect(game.prog.at).toEqual({ x: sib.x, y: sib.y });
    expect(game.run?.history.length).toBe(1);
    expect(game.hatch('pool', 0)).toBe(true);
    expect(game.pool.length).toBe(0);
    expect(game.hatch('pool', 0)).toBe(false);
  });

  it('der Laich einer Generation zählt zusammen – auch was die Geschwister gelaicht haben', () => {
    // der Urfisch laicht drei Eier
    let c = game.addClutch({ place: 'lagune', x: 100, y: 800, at: Date.now(), fert: true, role: 'father', young: 3 });
    succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.life.gen).toBe(2);
    expect(game.pool.length).toBe(2);
    // Generation 2: das erste Tier laicht vier Eier und stirbt …
    c = game.addClutch({ place: 'lagune', x: 200, y: 800, at: Date.now(), fert: true, role: 'father', young: 4 });
    game.layEggs(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.roe.length).toBe(4);
    // … ein Geschwister schlüpft (der Laich bleibt liegen) und laicht sechs dazu
    expect(game.hatch('pool', 0)).toBe(true);
    expect(game.life.gen).toBe(2);
    expect(game.roe.length).toBe(4);
    c = game.addClutch({ place: 'lagune', x: 300, y: 800, at: Date.now(), fert: true, role: 'father', young: 6 });
    game.layEggs(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.roe.length).toBe(10);
    // aus den zehn wählen: Generation 3 beginnt, die übrigen neun sind ihre Geschwister – das letzte Geschwister der
    // Generation 2 ist fort, es gibt kein Zurück
    expect(game.pool.length).toBe(1);
    expect(game.hatch('next', 7)).toBe(true);
    expect(game.life.gen).toBe(3);
    expect(game.pool.length).toBe(9);
    expect(game.roe.length).toBe(0);
    expect(game.run?.history.length).toBe(2);
  });

  it('die Eier tragen die Werte des Elterntiers zur Laichzeit – mit einer kleinen Streuung (Gebiss 18 → 17 bis 19)', () => {
    // ein Beißfisch: Gebiss etwa 18
    game.traits.jaw = 0.25;
    game.traits.bs = 1.5;
    game.ageBy(phases(1).mature + 60);
    const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
    const want = game.roeShown({ traits: h.traits });
    expect(want.bite).toBeGreaterThanOrEqual(16);
    const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: 24 });
    const eggs = game.layEggs(c, h);
    const bites = eggs.map((e) => game.roeShown(e).bite);
    for (const b of bites) {
      expect(b).toBeGreaterThanOrEqual(Math.floor(want.bite * (1 - INHERIT.vary)));
      expect(b).toBeLessThanOrEqual(Math.ceil(want.bite * (1 + INHERIT.vary)));
    }
    // die Eier unterscheiden sich wirklich (nicht alle gleich)
    expect(new Set(bites).size).toBeGreaterThan(1);
    // was nie entwickelt wurde (der Stoß des Urfischs), streut nicht
    for (const e of eggs) expect(game.roeShown(e).ram).toBe(want.ram);
  });

  it('nie mehr als SPAWN.maxYoung Nachkommen in einem Leben – der Rest der Nahrung bleibt', () => {
    game.feed(SPAWN.perYoung * (SPAWN.maxYoung + 3.5));
    const n = game.takeYoung();
    expect(n).toBe(SPAWN.maxYoung);
    game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: n });
    expect(game.takeYoung()).toBe(0);
    expect(game.life.fed).toBeCloseTo(SPAWN.perYoung * 3.5, 6);
  });

  it('wer in die nächste Generation geht, lässt die übrigen Geschwister für immer zurück', () => {
    game.feed(SPAWN.perYoung * 3.2);
    const c = game.addClutch({ place: 'lagune', x: 500, y: 800, at: Date.now(), fert: true, role: 'mother', young: game.takeYoung() });
    succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.pool.length).toBe(2);
    // (ältere Spielstände): ein befruchtetes Gelege ohne Angabe zählt einen Nachkommen
    expect(game.young).toBe(0);
    const d = game.addClutch({ place: 'lagune', x: 700, y: 800, at: Date.now(), fert: true, role: 'mother' });
    expect(game.young).toBe(1);
    succeed(d, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.life.gen).toBe(3);
    // die beiden Geschwister aus Generation 2 sind fort – und der Laich ist aufgebraucht
    expect(game.pool.length).toBe(0);
    expect(game.roe.length).toBe(0);
    expect(game.hatch('pool', 0)).toBe(false);
    expect(game.hatch('next', 0)).toBe(false);
  });

  it('das eigene Tier verändert sich im Leben nicht – was es tut, zeigt sich erst bei den Nachkommen', () => {
    const before = JSON.stringify(game.traits);
    const look = JSON.stringify(game.morph({ belly: 1 }));
    // lange versteckt, am Grund gelaufen, im Licht geschwommen, durch eine Höhle
    for (let i = 0; i < 40; i++) game.grow('stealth', 0.05);
    game.grow('limb', 0.3);
    game.shiftLight(0.5);
    game.shiftBody('fin', 0.4);
    game.setCoat(1);
    expect(JSON.stringify(game.traits)).toBe(before);
    expect(JSON.stringify(game.morph({ belly: 1 }))).toBe(look);
    // die Nachkommen tragen einen Teil davon weiter – höchstens einen Schritt je Generation
    const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
    expect(h.traits.stealth).toBeGreaterThan(game.traits.stealth);
    expect(h.traits.stealth - game.traits.stealth).toBeLessThanOrEqual(INHERIT.step.carry + 1e-9);
    expect(h.traits.light).toBeGreaterThan(game.traits.light);
    expect(h.traits.coat).toBe(1);
    expect(h.traits.scars).toBe(0);
  });

  it('vorerst schlüpft jedes eigene Tier als Männchen – auch Nachkommen und Geschwister', () => {
    expect(SPAWN.alwaysMale).toBe(true);
    for (let k = 0; k < 6; k++) {
      game.resetAll();
      expect(game.newRun().sex).toBe(1);
      game.feed(SPAWN.perYoung * 3);
      const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: 3 });
      const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
      expect(h.sex).toBe(1);
      succeed(c, h);
      expect(game.run?.sex).toBe(1);
      while (game.hatch('pool', 0)) expect(game.run?.sex).toBe(1);
    }
  });

  it('weiter entwickelte Nachfahren brauchen mehr Nahrung je Nachkomme – aber sanft', () => {
    const bite0 = game.stats(game.cls, game.traits).bite;
    // nur das Gebiss etwa 50 % stärker (15 statt 10): rund 24 je Nachkomme
    game.traits.jaw = 0.16;
    const bite = game.stats(game.cls, game.traits).bite / bite0 - 1;
    expect(bite).toBeGreaterThan(0.4);
    expect(bite).toBeLessThan(0.6);
    expect(game.broodBase).toBeGreaterThanOrEqual(23);
    expect(game.broodBase).toBeLessThanOrEqual(25);
    // ein schwereres Tier: stärker in vielem – deutlich mehr je Nachkomme
    game.traits.growth = 1;
    game.traits.girth = 0.6;
    expect(game.weight()).toBeGreaterThan(3);
    expect(game.broodBase).toBeGreaterThan(30);
  });

  it('eine Generation verändert sich merklich – die zweite braucht etwas mehr Nahrung je Nachkomme', () => {
    game.ageBy(phases(1).mature + 60);
    // ein Leben voller Jagd auf etwas kleinere Beute
    const style = { ...newStyle(), hunt: 40, hurt: 10, fwd: 200, turns: 60, up: 30, down: 30, hab: { start: 200, murky: 100 } };
    for (let i = 0; i < 3; i++) noteBest(style, 'hunt', 0.7);
    const bite0 = game.stats(game.cls, game.traits).bite;
    const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
    succeed(c, game.inherit({ meat: 300, plant: 100 }, style));
    const bite = game.stats(game.cls, game.traits).bite / bite0 - 1;
    expect(bite).toBeGreaterThan(0.2);
    expect(bite).toBeLessThan(0.6);
    expect(game.broodBase).toBeGreaterThan(SPAWN.perYoung * 1.05);
    expect(game.broodBase).toBeLessThan(SPAWN.perYoung * 1.4);
  });

  it('je Generation höchstens +5 bis +8 in einer Richtung – die Kompromisse kosten nur −1 bis −2', () => {
    const v = INHERIT.vary;
    INHERIT.vary = 0;
    for (const kind of ['hunt', 'ram', 'hurt'] as const) {
      game.resetAll();
      game.newRun();
      let prev = game.roeShown();
      for (let gen = 0; gen < 7; gen++) {
        const style = { ...newStyle(), [kind]: 300 };
        for (let i = 0; i < 5; i++) noteBest(style, kind === 'hurt' ? 'hunt' : kind, 2);
        game.ageBy(400);
        const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
        succeed(c, game.inherit({ meat: 50, plant: 50 }, style));
        const now = game.roeShown();
        const up = kind === 'hunt' ? now.bite - prev.bite : kind === 'ram' ? now.ram - prev.ram : now.scales - prev.scales;
        expect(up).toBeLessThanOrEqual(8);
        if (gen < 3) expect(up).toBeGreaterThanOrEqual(kind === 'ram' ? 4 : 5);
        expect(now.speed - prev.speed).toBeGreaterThanOrEqual(-2);
        expect(now.stam - prev.stam).toBeGreaterThanOrEqual(-2);
        prev = now;
      }
    }
    INHERIT.vary = v;
  });

  it('Beute gibt Futter in ganzen Brocken – nach Stärke und Größe, kleine einen, große viele', () => {
    // ein kleiner Beutefisch: ein kleiner Brocken (1) – zwanzig davon für einen Nachkommen
    for (const id of ['birkenia', 'kieferlos', 'sacabambaspis']) expect(meatOf(SPECIES[id].hp)).toBe(1);
    // ein Räuber wie Orthoceras: etwa ein Viertel eines Nachkommen
    expect(meatOf(SPECIES.orthoceras.hp)).toBeGreaterThanOrEqual(4);
    expect(meatOf(SPECIES.orthoceras.hp)).toBeLessThanOrEqual(7);
    // ein Riese: rund 40 – zehn große Brocken und ein paar kleine
    expect(meatOf(SPECIES.cameroceras.hp)).toBeGreaterThan(30);
    expect(meatOf(SPECIES.cameroceras.hp)).toBeLessThan(60);
    // immer ganze Einheiten
    for (const hp of [1, 7, 33, 120]) expect(Number.isInteger(meatOf(hp))).toBe(true);
    // in Brocken: große (5) und kleine (1), zusammen genau so viel
    expect(meatChunks(1)).toEqual([1]);
    expect(meatChunks(7)).toEqual([5, 1, 1]);
    expect(meatChunks(50)).toEqual(Array(10).fill(5));
    const c = meatChunks(43);
    expect(c.reduce((a, b) => a + b, 0)).toBe(43);
    expect(c.filter((v) => v === 5).length).toBe(8);
  });

  it('kleine Fische brauchen ausgewachsen drei Bisse und mehr, nur die kleinsten zwei', () => {
    game.ageBy(phases(1).mature);
    const bite = game.stats().bite;
    const bites = (hp: number) => Math.ceil(hp / bite);
    for (const id of ['birkenia', 'moythomasia', 'thelodus', 'lasanius']) expect(bites(SPECIES[id].hp)).toBe(2);
    for (const id of ['kieferlos', 'astraspis', 'sacabambaspis', 'arandaspis']) expect(bites(SPECIES[id].hp)).toBeGreaterThanOrEqual(3);
    // ein Jungtier braucht mehr, aber nicht endlos viele
    game.resetAll();
    game.newRun();
    expect(Math.ceil(SPECIES.kieferlos.hp / game.stats().bite)).toBeLessThanOrEqual(5);
  });

  it('wie im Fitnessstudio: nur kleine Beute trägt bis zu einer Stufe, stärkere Gegner darüber hinaus', () => {
    const train = (best: number) => {
      game.resetAll();
      game.newRun();
      for (let gen = 0; gen < 30; gen++) {
        const style = { ...newStyle(), hunt: 200 };
        for (let i = 0; i < 5; i++) noteBest(style, 'hunt', best);
        const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
        succeed(c, game.inherit({ meat: 10, plant: 0 }, style));
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
    succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.prog.boss).toBe(0);
  });

  it('wer viel stößt, bekommt Nachkommen mit härterem Kopf – eine Generation weiter', () => {
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
    succeed(c, h);
    expect(game.life.gen).toBe(gen + 1);
    expect(game.life.age).toBe(0);
    expect(game.life.clutches).toEqual([]);
    expect(game.prog.at).toEqual({ x: 640, y: 900 });
    expect(game.traits.st).toBeCloseTo(h.traits.st, 3);
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
    expect(Math.max(...grew)).toBeGreaterThan(INHERIT.plateTotal * 0.3);
    expect(Math.abs(h.traits.growth - before.growth)).toBeLessThanOrEqual(INHERIT.step.growth + 1e-9);
    expect(h.traits.armor - before.armor).toBeLessThanOrEqual(INHERIT.step.armor + 1e-9);
    expect(Math.abs(h.traits.diet - before.diet)).toBeLessThanOrEqual(INHERIT.step.diet + 1e-9);
    // merklich: Kiefer, Schädel oder Körperbau haben sich bewegt
    expect(Math.abs(h.traits.jaw - before.jaw) + Math.abs(h.traits.skull - before.skull) + Math.abs(h.traits.len - before.len)).toBeGreaterThan(0.02);
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
