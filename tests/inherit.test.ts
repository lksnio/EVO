import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, SPAWN } from '../src/data/life';
import { phases } from '../src/sim/life';
import { game, meatChunks, meatOf, newStyle, noteBest, plateCeil, type Clutch, type Heir } from '../src/state/GameState';
import { SPECIES } from '../src/data/species';
import { evolutionBudget, recordDefeat, type CombatSkill } from '../src/sim/evolution';

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
    SPAWN.gold = 0;
  });
  afterEach(() => { SPAWN.gold = 0.05; INHERIT.vary = 0.5; });

  it('ein Jungtier ist klein und schwach, ausgewachsen stark – Artgenossen sind immer ausgewachsen', () => {
    const young = game.stats();
    game.ageBy(phases(1).mature * 1.3);
    const grown = game.stats();
    expect(young.size).toBeLessThan(grown.size * 0.5);
    expect(young.bite).toBeLessThan(grown.bite);
    expect(young.maxHp).toBeLessThan(grown.maxHp);
    expect(young.speed).toBeCloseTo(grown.speed * 0.6);
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

  it('nur der aktuelle Zuwachs streut pro Ei, geerbte Werte und feste Gegenkosten bleiben erhalten', () => {
    game.traits.biteGain = 10;
    const style = newStyle();
    for (let i = 0; i < 8; i++) recordDefeat(style.defeats!, { bite: 1 }, 1);
    const h = game.inherit({ meat: 40, plant: 60 }, style);
    const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: 24 });
    const eggs = game.layEggs(c, h);
    for (const e of eggs) {
      expect(e.traits.biteGain).toBeGreaterThanOrEqual(13);
      expect(e.traits.biteGain).toBeLessThanOrEqual(19);
      expect(e.traits.ramGain).toBe(-1.5);
      expect(e.traits.vitality).toBeGreaterThanOrEqual(4.5);
      expect(e.traits.vitality).toBeLessThanOrEqual(13.5);
    }
    expect(new Set(eggs.map(e => e.traits.biteGain)).size).toBeGreaterThan(1);
    expect(game.traits.biteGain).toBe(10);
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
    // lange versteckt, am Grund gelaufen, im Licht geschwommen
    for (let i = 0; i < 40; i++) game.grow('stealth', 0.05);
    game.grow('limb', 0.3);
    game.shiftLight(0.5);
    game.shiftBody('fin', 0.4);
    expect(JSON.stringify(game.traits)).toBe(before);
    expect(JSON.stringify(game.morph({ belly: 1 }))).toBe(look);
    // die Nachkommen tragen einen Teil davon weiter – höchstens einen Schritt je Generation
    const h = game.inherit({ meat: 0, plant: 0 }, newStyle());
    expect(h.traits.stealth).toBeGreaterThan(game.traits.stealth);
    expect(h.traits.stealth - game.traits.stealth).toBeLessThanOrEqual(INHERIT.step.carry + 1e-9);
    expect(h.traits.light).toBeGreaterThan(game.traits.light);
    expect(h.traits.scars).toBe(0);
  });

  it('erhält vorgemerkte Färbungen älterer Spielstände bei den Nachkommen', () => {
    game.life.coat = 2;
    expect(game.traits.coat).toBe(0);
    const c = game.addClutch({ place: 'riff', x: 640, y: 900, at: Date.now(), fert: true, role: 'mother' });
    succeed(c, game.inherit({ meat: 0, plant: 0 }, newStyle()));
    expect(game.traits.coat).toBe(2);
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

  it('60 % Pflanzen ergeben 9 Lebenspunkte, 40 % Fleisch bei vollen Biss-Siegen 6 Gebisspunkte', () => {
    const style = newStyle();
    for (let i = 0; i < 8; i++) recordDefeat(style.defeats!, { bite: 1 }, 1);
    const before = game.roeShown();
    const h = game.inherit({ meat: 40, plant: 60 }, style);
    expect(h.traits.vitality).toBe(9);
    expect(h.traits.biteGain).toBe(6);
    expect(h.traits.ramGain).toBe(-1.5);
    const preview = game.roeShown({ traits: h.traits });
    expect(preview.hp - before.hp).toBe(9);
    expect(preview.bite - before.bite).toBe(6);
    expect(game.stats(game.cls, h.traits).endurance).toBe(game.stats(game.cls, game.traits).endurance);
    const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father' });
    const [egg] = game.layEggs(c, h);
    expect(game.hatch('next', game.roe.indexOf(egg))).toBe(true);
    expect(game.broodBase).toBeGreaterThan(SPAWN.perYoung);
    expect(game.inheritedDelta()!.bite).toBeGreaterThanOrEqual(3);
    expect(game.inheritedDelta()!.bite).toBeLessThanOrEqual(9);
  });

  it('Gegenkosten hängen von der unteren Schranke ab, nicht vom zufälligen Zuwachs', () => {
    for (const [key, gain, opposite] of [['bite', 'biteGain', 'ramGain'], ['skull', 'ramGain', 'biteGain'], ['fins', 'finGain', 'scaleGain'], ['scales', 'scaleGain', 'finGain']] as const) {
      game.resetAll(); game.newRun();
      const style = newStyle();
      for (let i = 0; i < 8; i++) recordDefeat(style.defeats!, { [key]: 1 }, 1);
      const h = game.inherit({ meat: 40, plant: 60 }, style);
      const c = game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: 24 });
      const eggs = game.layEggs(c, h);
      for (const e of eggs) { expect(e.traits[gain]).toBeGreaterThanOrEqual(3); expect(e.traits[gain]).toBeLessThanOrEqual(9); expect(e.traits[opposite]).toBe(-1.5); }
    }
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

  it('mehr und stärkere besiegte Gegner erschließen mehr vom Fleischbudget, Treffer allein reichen nicht', () => {
    const budget = (n: number, strength: number) => {
      const style = newStyle();
      for (let i = 0; i < n; i++) recordDefeat(style.defeats!, { bite: 1 }, strength);
      return evolutionBudget({ meat: 100, plant: 0 }, style.defeats!).bite;
    };
    expect(budget(0, 1)).toBe(0);
    expect(budget(4, 0.5)).toBe(3.75);
    expect(budget(4, 1)).toBe(7.5);
    expect(budget(8, 1)).toBe(15);
    expect(budget(100, 10)).toBe(15);
    const style = { ...newStyle(), hunt: 10000, ram: 10000, hurt: 10000 };
    expect(game.inherit({ meat: 100, plant: 0 }, style).traits.biteGain ?? 0).toBe(0);
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


  it('erfolgreiche Stöße stärken den Schädel der Nachkommen und schwächen das Gebiss', () => {
    const style = newStyle();
    for (let i = 0; i < 8; i++) recordDefeat(style.defeats!, { skull: 1 }, 1);
    const h = game.inherit({ meat: 10, plant: 10 }, style);
    expect(h.traits.ramGain).toBe(7.5);
    expect(h.traits.biteGain).toBe(-1.875);
    expect(game.roeShown({ traits: h.traits }).ram).toBeGreaterThan(game.roeShown().ram);
    const c = game.addClutch({ place: 'lagune', x: 640, y: 900, at: Date.now(), fert: true, role: 'father' });
    succeed(c, h);
    expect(game.life.gen).toBe(2);
    expect(game.life.age).toBe(0);
    expect(game.prog.at).toEqual({ x: 640, y: 900 });
    expect(game.run?.history.length).toBe(1);
  });

  it('aufgeteilte Kampferfolge teilen sich das Budget, Körperwachstum läuft getrennt und bleibt verborgen', () => {
    const style = { ...newStyle(), distance: 60000, waterTime: 100, depthTime: 80 };
    for (let i = 0; i < 8; i++) recordDefeat(style.defeats!, { bite: 1, skull: 1, fins: 1, scales: 1 }, 1);
    const budget = evolutionBudget({ meat: 100, plant: 0 }, style.defeats!);
    for (const key of ['bite', 'skull', 'fins', 'scales'] as CombatSkill[]) expect(budget[key]).toBe(3.75);
    expect(Object.values(budget).reduce((n, v) => n + v, 0)).toBe(15);
    const h = game.inherit({ meat: 100, plant: 0 }, style);
    expect(h.traits.lengthGain).toBeCloseTo(0.1);
    expect(h.traits.massGain).toBeCloseTo(0.08);
    expect(game.traits.lengthGain).toBeUndefined();
    expect(game.traits.massGain).toBeUndefined();
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
