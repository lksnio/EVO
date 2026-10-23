import { beforeEach, describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
import { SPECIES } from '../src/data/species';
import { edgeNeighbor, placeOf, placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';
import { oceanChart } from '../src/level/oceanChart';
import { faunaAffinity, habitatExtent } from '../src/sim/habitat';
import { game } from '../src/state/GameState';
import { TILE } from '../src/config';

const ep = EPOCHS[0], places = placesOf(ep);

describe('Zusammenhängendes Meer', () => {
  it('verbindet Laichfluss, Flachwasser und Tiefental direkt und ohne Abzweigungen', () => {
    expect(places.map((p) => p.id)).toEqual(['riff', 'garten', 'wand']);
    for (let i = 0; i < places.length; i++) for (const depth of [0, 0.5, 1]) {
      expect(edgeNeighbor(ep, places[i], 'left', depth)).toBe(places[i - 1]);
      expect(edgeNeighbor(ep, places[i], 'right', depth)).toBe(places[i + 1]);
    }
    expect(placeOf(ep, 'bank')).toBe(places[1]);
    expect(placeOf(ep, 'grund')).toBe(places[2]);
  });

  it('hat passende Übergangsböden, ein flaches zweites Gebiet und ein nach rechts fallendes Tal', () => {
    for (const seed of ['ozean-a', 'ozean-b', 'ozean-c']) {
      const levels = places.map((p) => generateLevel(ep, seed, p));
      for (let i = 0; i < levels.length - 1; i++) {
        expect(levels[i].ground.at(-10)).toBeCloseTo(levels[i + 1].ground[9], 3);
      }
      const shelf = levels[1].ground;
      expect(Math.max(...shelf) - Math.min(...shelf)).toBeLessThan(2 * TILE);
      const valley = levels[2].ground;
      const at = (f: number) => valley[Math.floor((valley.length - 1) * f)];
      expect(at(0.2)).toBeLessThan(at(0.45));
      expect(at(0.45)).toBeLessThan(at(0.7));
      expect(at(0.7)).toBeLessThan(at(0.95));
      expect(at(0.95) - at(0.05)).toBeGreaterThan(60 * TILE);
    }
  });

  it('zeigt auf C denselben Boden, dieselbe Reihenfolge und eine durchgehende Position', () => {
    const chart = oceanChart(ep, 'karten-saat');
    let x = 0;
    chart.sections.forEach((s, i) => {
      const L = generateLevel(ep, 'karten-saat', places[i]);
      expect(s.ground).toEqual(L.ground);
      expect(s.x).toBe(x);
      x += L.width;
    });
    expect(chart.width).toBe(x);
    expect(chart.sections[0].roe).toBeDefined();
  });

  it('bevölkert den Anfang mit kleinen Fischen und das Tal mit großen Tieren und starken Nicht-Fischen', () => {
    const counts = places.map(() => ({ small: 0, big: 0, other: 0, width: 0 }));
    for (let seed = 0; seed < 6; seed++) places.forEach((p, i) => {
      const L = generateLevel(ep, seed, p), count = counts[i];
      count.width += L.width;
      for (const spawn of L.spawns) {
        const d = SPECIES[spawn.id];
        if (d.art.t === 'fish' && d.role === 'prey') count.small++;
        if (d.power >= 8) count.big++;
        if (d.art.t !== 'fish' && d.power >= 6) count.other++;
        if (!i && d.role !== 'prey') expect(spawn.x).toBeGreaterThan(L.riverEnd!);
      }
    });
    expect(counts[0].small).toBeGreaterThan(6 * counts[0].big);
    expect(counts[0].big).toBeGreaterThan(0);
    expect(counts[0].small / counts[0].width).toBeGreaterThan(counts[2].small / counts[2].width);
    expect(counts[2].big / counts[2].width).toBeGreaterThan(4 * counts[0].big / counts[0].width);
    expect(counts[2].other).toBeGreaterThan(6);
    expect(counts[2].other / counts[2].width).toBeGreaterThan(4 * counts[0].other / counts[0].width);
    expect(faunaAffinity(places[2], SPECIES.seeskorpion)).toBeGreaterThan(faunaAffinity(places[0], SPECIES.seeskorpion));
  });

  it('erweitert den roten Lebensraum mit wachsender Stärke stetig bis fast zum ganzen Meer', () => {
    const values = [-1, 0, 0.5, 1, 2, 4, 8, 100].map((gain) => habitatExtent(gain));
    values.forEach((v, i) => { expect(v).toBeGreaterThan(0); expect(v).toBeLessThanOrEqual(1); if (i) expect(v).toBeGreaterThanOrEqual(values[i - 1]); });
    expect(values[2]).toBeGreaterThan(values[1]);
    expect(values.at(-1)).toBeGreaterThan(0.99);
    expect(habitatExtent(0, 2)).toBeGreaterThan(habitatExtent(0, 1));
  });
});

describe('Direkter Gebietswechsel', () => {
  beforeEach(() => { game.resetAll(); game.newRun(0); });
  it('behält Nahrung, Leben und Fähigkeiten bei und verbraucht keine zusätzliche Reisezeit', () => {
    game.feed(72);
    const age = game.life.age, traits = { ...game.traits };
    game.enterPlace('garten', { side: 'right', frac: 0.7 });
    expect(game.prog.place).toBe('garten');
    expect(game.life.fed).toBe(72);
    expect(game.life.age).toBe(age);
    expect(game.traits).toEqual(traits);
    expect(game.prog.edge).toEqual({ side: 'right', frac: 0.7 });
  });

  it('übernimmt alte Nebenorte samt Eiern und Nahrung in das zusammenhängende Meer', () => {
    game.feed(72);
    game.traits.biteGain = 17;
    game.prog.place = 'bank';
    game.prog.seen = ['riff', 'bank', 'grund'];
    game.prog.known = ['riff', 'bank', 'grund'];
    game.prog.links = ['bank|riff', 'bank|wald'];
    const egg = { traits: {}, sex: 1 as const, seed: 10, place: 'wald', x: 1200, y: 400 };
    game.run!.pool = [egg];
    game.run!.next = [{ ...egg, place: 'grund' }];
    game.life.clutches = [{ id: 1, place: 'delta', x: 1200, y: 400, at: 1, fert: true, role: 'father', young: 1, eggs: true }];
    const saved = JSON.stringify(game.data);
    const storage = new Map([['evo-save-v3', saved]]);
    const global = globalThis as { localStorage?: unknown };
    global.localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
    try {
      game.load();
      expect(game.prog.place).toBe('garten');
      expect(game.prog.seen).toEqual(['riff', 'garten', 'wand']);
      expect(game.pool[0].place).toBe('garten');
      expect(game.roe[0].place).toBe('wand');
      expect(game.life.clutches[0].place).toBe('garten');
      expect(game.life.fed).toBe(72);
      expect(game.traits.biteGain).toBe(17);
    } finally { delete global.localStorage; }
  });
});
