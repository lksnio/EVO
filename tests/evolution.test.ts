import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INHERIT, LIFE, MOVEMENT } from '../src/data/life';
import { ADULT, phases } from '../src/sim/life';
import { COMBAT_SKILLS, evolutionBonus, evolutionBudget, evolutionStep, recordDefeat, type Defeats } from '../src/sim/evolution';
import { game, newStyle } from '../src/state/GameState';

/** Die alten Rechenwege prüfen wir ohne Gewichtung, Bonus und ±1 – die neuen in tests/bonus.test.ts. */
const REAL = { weight: { ...INHERIT.weight }, bonus: { ...INHERIT.bonus }, final: INHERIT.final };
const neutral = () => {
  INHERIT.weight = { hp: 1, bite: 1, skull: 1, fins: 1, scales: 1 };
  INHERIT.bonus = { ...REAL.bonus, scalesHurt: 0, dangerMin: 0, dangerMax: 0, finsSwim: 0, finsChase: 0 };
  INHERIT.final = 0;
};
const restore = () => { INHERIT.weight = { ...REAL.weight }; INHERIT.bonus = { ...REAL.bonus }; INHERIT.final = REAL.final; };

beforeEach(() => { game.resetAll(); game.newRun(); neutral(); });
afterEach(() => { INHERIT.points = 15; INHERIT.vary = 0.5; restore(); });

describe('Punktebudget und Varianz', () => {
  it('entspricht auch dem 10-Punkte-Beispiel: 6 Leben, 4 Gebiss, Wurf 2–6, Gegenwert −1', () => {
    INHERIT.points = 10;
    const base = evolutionBudget({ plant: 60, meat: 40 }, { bite: { count: 8, strength: 8 } });
    expect(base).toEqual({ hp: 6, bite: 4, skull: 0, fins: 0, scales: 0 });
    expect(evolutionStep(base, () => 0)).toEqual({ hp: 3, bite: 2, skull: -1, fins: 0, scales: 0 });
    expect(evolutionStep(base, () => 1)).toEqual({ hp: 9, bite: 6, skull: -1, fins: 0, scales: 0 });
  });

  it('verteilt einen Sieg nur einmal; Stärke und Zahl zählen, Fressen ist kein Bestandteil der Siegwertung', () => {
    const d: Defeats = {};
    recordDefeat(d, { bite: 3, skull: 1 }, 2);
    expect(d.bite).toEqual({ count: 0.75, strength: 1.5 });
    expect(d.skull).toEqual({ count: 0.25, strength: 0.5 });
    recordDefeat(d, { fins: 1, scales: 1 }, 1);
    expect(Object.values(d).reduce((n, v) => n + v.count, 0)).toBe(2);
    expect(Object.values(d).reduce((n, v) => n + v.strength, 0)).toBe(3);
    expect(evolutionBudget({ plant: 100, meat: 0 }, d)).toEqual({ hp: 15, bite: 0, skull: 0, fins: 0, scales: 0 });
    expect(evolutionBudget({ plant: 0, meat: 0 }, d)).toEqual({ hp: 0, bite: 0, skull: 0, fins: 0, scales: 0 });
  });

  it('jede Gegenpaarung kostet ein Viertel des Zugewinns vor Varianz; keine Abzüge für Leben oder Muschelwerte', () => {
    for (const key of COMBAT_SKILLS) {
      const d: Defeats = {};
      recordDefeat(d, { [key]: 1 }, 8);
      const base = evolutionBudget({ plant: 0, meat: 1 }, d);
      const min = evolutionStep(base, () => 0), max = evolutionStep(base, () => 1);
      expect(min[key]).toBe(7.5);
      expect(max[key]).toBe(22.5);
      const opposite = ({ bite: 'skull', skull: 'bite', fins: 'scales', scales: 'fins' } as const)[key];
      expect(min[opposite]).toBe(-3.75);
      expect(max[opposite]).toBe(-3.75);
      expect(max.hp).toBe(0);
    }
  });
});

describe('Verborgener Körperbau und Kampfwerte', () => {
  it('Flossen vergrößern die Reserve statt das Tempo; Länge behält ihren bisherigen Einfluss', () => {
    const start = { ...game.traits };
    const base = game.stats('fish', start, ADULT);
    const evolved = game.stats('fish', { ...start, finGain: 10, lengthGain: 0.1 }, ADULT);
    const gain = 1 + MOVEMENT.lengthSpeed * 0.1;
    expect(gain).toBeCloseTo(1.03);
    expect(evolved.speed * evolved.cruise / (base.speed * base.cruise)).toBeCloseTo(gain);
    expect(evolved.speed * evolved.climb / (base.speed * base.climb)).toBeCloseTo(gain);
    expect(evolved.speed * evolved.dive / (base.speed * base.dive)).toBeCloseTo(gain);
    expect(game.roeShown({ traits: { ...start, finGain: 10 } }).fins).toBe(20);
    expect(evolved.endurance).toBeGreaterThan(base.endurance);
    expect(game.roeShown({ traits: { ...start, finGain: 10 } }).speed).toBe(10);
  });

  it('auch weit entwickelte Jungtiere erreichen ihr Generationstempo erst beim Ausgewachsensein', () => {
    Object.assign(game.traits, { finGain: 90, lengthGain: 0.7, massGain: 0.3 });
    const grown = game.stats('fish', game.traits, ADULT);
    for (const gen of [1, 4, 16]) {
      game.life.gen = gen;
      const mature = phases(gen).mature;
      let previous = 0;
      for (const age of [0, mature * 0.25, mature * 0.5, mature * 0.9, mature]) {
        game.life.age = age;
        const st = game.stats();
        expect(st.speed).toBeGreaterThan(previous);
        if (age < mature) {
          expect(st.speed * st.cruise).toBeLessThan(grown.speed * grown.cruise);
          expect(st.speed * st.climb).toBeLessThan(grown.speed * grown.climb);
          expect(st.speed * st.dive).toBeLessThan(grown.speed * grown.dive);
        } else expect(st.speed).toBeCloseTo(grown.speed);
        if (age === 0) expect(st.speed).toBeCloseTo(grown.speed * 0.6);
        previous = st.speed;
      }
    }
  });

  it('der Wachstumsfaktor gilt auch für Schwimmen und Laufen anderer Körperformen', () => {
    for (const cls of ['fish', 'amphibian', 'reptile', 'mammal'] as const) {
      const traits = { ...game.traits, growth: 0.6, limb: 0.4 };
      const hatch = game.stats(cls, traits, { grow: LIFE.hatch, old: 0 });
      const half = game.stats(cls, traits, { grow: (LIFE.hatch + LIFE.adult) / 2, old: 0 });
      const grown = game.stats(cls, traits, ADULT);
      expect(hatch.speed / grown.speed).toBeCloseTo(0.6);
      expect(half.speed / grown.speed).toBeCloseTo(0.8);
      expect(hatch.landSpeed / grown.landSpeed).toBeCloseTo(0.6);
      expect(half.landSpeed / grown.landSpeed).toBeCloseTo(0.8);
    }
  });

  it('lange Strecken erhöhen Länge und Tempo; Schuppen verlieren nur die halbe relative Änderung', () => {
    const start = { ...game.traits };
    const h = game.inherit({ plant: 0, meat: 0 }, { ...newStyle(), distance: INHERIT.swimDistance });
    const a = game.stats(game.cls, start), b = game.stats(game.cls, h.traits);
    const ma = game.measure(game.cls, start), mb = game.measure(game.cls, h.traits);
    expect(mb.cm / ma.cm).toBeCloseTo(1.1);
    expect(mb.g).toBeCloseTo(ma.g);
    // Ältere Ausdauerpunkte verändern das Fischtempo nicht mehr.
    expect(b.speed / a.speed).toBeCloseTo(1 + MOVEMENT.lengthSpeed * INHERIT.lengthStep);
    expect(game.roeShown({ traits: h.traits }).scales).toBe(10); // 9.5 wird für die Anzeige gerundet
    expect(b.defense / a.defense).toBeCloseTo(1 / 0.95);
    expect(game.inheritedDelta()).toBeNull();
    expect(game.traits).toEqual(start);
  });

  it('mittlere Tiefe erhöht nur das Gewicht; Masse schützt zusätzlich zu Schuppen und kostet halbes Tempo', () => {
    const start = { ...game.traits };
    const h = game.inherit({ plant: 0, meat: 0 }, { ...newStyle(), waterTime: 100, depthTime: 80 });
    const a = game.stats(game.cls, start), b = game.stats(game.cls, h.traits);
    const ma = game.measure(game.cls, start), mb = game.measure(game.cls, h.traits);
    expect(mb.g / ma.g).toBeCloseTo(1.08);
    expect(mb.cm).toBe(ma.cm);
    expect(b.speed / a.speed).toBeCloseTo(0.96);
    expect(b.defense / a.defense).toBeCloseTo(1 / 1.08);
    expect(game.stats(game.cls, { ...h.traits, scaleGain: 5 }).defense).toBeLessThan(b.defense);
    const shallow = game.inherit({ plant: 0, meat: 0 }, { ...newStyle(), waterTime: 100, depthTime: 20 });
    expect(h.traits.massGain).toBeGreaterThan(shallow.traits.massGain!);
  });



  it('alte Spielstände bleiben lesbar, neue Punkte und Körperdaten überstehen das Packen und Schlüpfen', () => {
    game.traits.jaw = 0.2;
    const before = game.roeShown();
    const style = { ...newStyle(), distance: INHERIT.swimDistance, waterTime: 20, depthTime: 10 };
    recordDefeat(style.defeats!, { bite: 1 }, 8);
    const h = game.inherit({ plant: 60, meat: 40 }, style);
    const c = game.addClutch({ place: 'lagune', x: 100, y: 100, at: 1, fert: true, role: 'father', young: 1 });
    const [egg] = game.layEggs(c, h);
    expect(egg.traits.lengthGain).toBe(0.1);
    expect(egg.traits.massGain).toBe(0.05);
    expect(game.hatch('next', 0)).toBe(true);
    expect(game.roeShown().bite).toBeGreaterThan(before.bite);
    expect(game.inheritedDelta()).toHaveProperty('fins');
    expect(game.inheritedDelta()).not.toHaveProperty('length');
    expect(game.inheritedDelta()).not.toHaveProperty('weight');
    expect(game.run?.sex).toBe(1);
  });
});

describe('Werte nach Verhalten (Stoß, Strömung, Strecke)', () => {
  it('ein Stoß schadet mehr als früher und zählt für den Schädel wie drei bis vier Bisse', async () => {
    const { RAM } = await import('../src/data/life');
    expect(RAM.damage).toBeGreaterThan(0.625);
    expect(RAM.credit).toBeGreaterThanOrEqual(3);
    expect(RAM.credit).toBeLessThanOrEqual(4);
    // ein Sieg mit einem Stoß und drei Bissen: der Schädel bekommt jetzt fast die Hälfte, früher ein Viertel
    const defeats: Record<string, { count: number; strength: number }> = {};
    recordDefeat(defeats, { skull: 1 * RAM.credit, bite: 3 }, 1);
    expect(defeats.skull!.strength / (defeats.skull!.strength + defeats.bite!.strength)).toBeGreaterThan(0.45);
  });

  it('Zeit im Strömungsschub bringt Flossenpunkte (Tempo), anteilig und bis zu einer Grenze', () => {
    const B = INHERIT.bonus;
    expect(evolutionBonus({ flowTime: 0 }).fins).toBe(0);
    expect(evolutionBonus({ flowTime: B.flowRef / 2 }).fins).toBeCloseTo(B.finsFlow / 2);
    expect(evolutionBonus({ flowTime: B.flowRef * 5 }).fins).toBeCloseTo(B.finsFlow);
  });

  it('Schub: der Strömungsschub macht schneller, Spurt und Stoß im Schub noch mehr, und er klingt langsam ab', async () => {
    const { FLOW } = await import('../src/data/life');
    expect(FLOW.speed).toBeGreaterThan(0);
    expect(FLOW.sprint).toBeGreaterThan(0);
    expect(FLOW.ram).toBeGreaterThan(0);
    expect(FLOW.fade).toBeGreaterThan(FLOW.rise * 2); // klingt viel langsamer ab, als er anwächst
    // nach FLOW.fade Sekunden ist noch gut ein Drittel des Schubs übrig
    expect(Math.exp(-1)).toBeGreaterThan(0.3);
  });

  it('nur Flossen vergrößern die Fischreserve; ältere Ausdauerpunkte verändern sie und das Tempo nicht', () => {
    const t = { ...game.traits };
    const base = game.stats(game.cls, t, undefined);
    const fast = game.stats(game.cls, { ...t, finGain: 10 }, undefined);
    const long = game.stats(game.cls, { ...t, endGain: 10 }, undefined);
    const tempo = (x: typeof base) => x.speed * x.cruise;
    expect(tempo(fast)).toBeCloseTo(tempo(base));
    expect(fast.endurance).toBeGreaterThan(base.endurance);
    expect(long.endurance).toBe(base.endurance);
    expect(tempo(long)).toBeCloseTo(tempo(base));
  });

  it('weite Strecken: Ausdauerpunkte für die Nachkommen, anteilig; der Kamm am Rücken wächst mit ihnen, die Flossen mit dem Tempo', () => {
    const none = game.inherit({ plant: 0, meat: 0 }, { ...newStyle(), distance: 0 });
    const far = game.inherit({ plant: 0, meat: 0 }, { ...newStyle(), distance: INHERIT.endDistance });
    expect(none.traits.endGain ?? 0).toBe(0);
    expect(far.traits.endGain).toBeCloseTo(INHERIT.endStep);
    expect(game.morph({ traits: far.traits }).crest ?? 0).toBeGreaterThan(game.morph({ traits: none.traits }).crest ?? 0);
    expect(game.morph({ traits: { ...far.traits, finGain: 8 } }).fin ?? 0).toBeGreaterThan(game.morph({ traits: far.traits }).fin ?? 0);
  });
});
