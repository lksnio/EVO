import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, SPAWN } from '../src/data/life';
import { phases } from '../src/sim/life';
import { game, meatChunks, meatOf, newStyle, noteBest, plateCeil, type Clutch, type Heir } from '../src/state/GameState';
import { SPECIES } from '../src/data/species';
import { evolutionBudget, recordDefeat } from '../src/sim/evolution';

/** Die alten Rechenwege prüfen wir ohne Gewichtung, Bonus und ±1 – die neuen in tests/bonus.test.ts. */
const REAL = { weight: { ...INHERIT.weight }, bonus: { ...INHERIT.bonus }, final: INHERIT.final };
const neutral = () => {
  INHERIT.weight = { hp: 1, bite: 1, skull: 1, fins: 1, scales: 1 };
  INHERIT.bonus = { ...REAL.bonus, scalesHurt: 0, dangerMin: 0, dangerMax: 0, finsSwim: 0, finsChase: 0 };
  INHERIT.final = 0;
};
const restore = () => { INHERIT.weight = { ...REAL.weight }; INHERIT.bonus = { ...REAL.bonus }; INHERIT.final = REAL.final; };

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

// Spawning, food and lifecycle invariants retained across the fish-rules redesign.
describe('Generationswechsel',()=>{
 beforeEach(()=>{game.resetAll();game.newRun();neutral();});
 afterEach(()=>{INHERIT.vary=.5;restore();});
  it('ein Jungtier ist klein und schwach, ausgewachsen stark – Artgenossen sind immer ausgewachsen', () => {
    const young = game.stats();
    game.ageBy(phases(1).mature * 1.3);
    const grown = game.stats();
    expect(young.size).toBeLessThan(grown.size * 0.5);
    expect(young.bite).toBeLessThan(grown.bite);
    expect(young.maxHp).toBeLessThan(grown.maxHp);
    expect(young.speed).toBeCloseTo(grown.speed);
    expect(game.stats(game.cls, game.traits).size).toBeCloseTo(game.stats(game.cls, game.traits).size);
    game.ageBy(phases(1).span);
    expect(game.stats().speed).toBeCloseTo(grown.speed);
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
  it('nie mehr als SPAWN.maxYoung Nachkommen in einem Leben – der Rest der Nahrung bleibt', () => {
    game.feed(SPAWN.perYoung * (SPAWN.maxYoung + 3.5));
    const n = game.takeYoung();
    expect(n).toBe(SPAWN.maxYoung);
    game.addClutch({ place: 'lagune', x: 1, y: 1, at: Date.now(), fert: true, role: 'father', young: n });
    expect(game.takeYoung()).toBe(0);
    expect(game.life.fed).toBeCloseTo(SPAWN.perYoung * 3.5, 6);
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
});
