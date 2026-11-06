import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EPOCHS, epochIndex, firstPlayable } from '../src/data/epochs';
import { game } from '../src/state/GameState';

const P = firstPlayable();
/** ein zweites Zeitalter mit eigener Beute: das (ruhende) Karbon, für diese Tests spielbar */
const K = epochIndex('karbon');

// Die Beute in der Übersicht: was deine Linie an einem Ort gefressen hat – die drei häufigsten Arten und ihr Anteil.

describe('Beute', () => {
  beforeEach(() => {
    EPOCHS[K].playable = true;
    game.resetAll();
  });
  afterEach(() => {
    EPOCHS[K].playable = undefined;
  });

  it('zählt je Ort – die drei häufigsten mit ihrem Anteil an allem, was dort gefressen wurde', () => {
    game.newRun(P);
    const here = game.prog.place;
    for (const [id, n] of [['a', 5], ['b', 3], ['c', 1], ['d', 1]] as const) for (let i = 0; i < n; i++) game.noteEaten(id);
    const { top, total } = game.topPrey();
    expect(total).toBe(10);
    expect(top.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(top.map((e) => e.count)).toEqual([5, 3, 1]);
    expect(top[0].share).toBeCloseTo(0.5);
    expect(top[1].share).toBeCloseTo(0.3);
    // an einem anderen Ort stehen andere Zahlen
    expect(game.topPrey('woanders').total).toBe(0);
    expect(game.topPrey(here).total).toBe(10);
    game.prog.place = 'woanders';
    game.noteEaten('b');
    expect(game.topPrey().total).toBe(11);
    expect(game.topPrey(here).total).toBe(10);
  });

  it('zeigt die Nahrungsanteile über Orte und Generationen einer Epoche', () => {
    game.newRun(P);
    game.noteFood('plant', 60);
    game.prog.place = 'woanders';
    game.noteFood('meat', 40);
    expect(game.dietAt()).toEqual({ plant: 0.6, meat: 0.4 });
    game.newRun(P);
    expect(game.dietAt()).toEqual({ plant: 0.6, meat: 0.4 });
    game.newRun(K);
    expect(game.dietAt()).toBeNull();
  });

  it('übernimmt alte Ortsdaten einmalig, ohne sie beim nächsten Essen doppelt zu zählen', () => {
    game.newRun(P);
    game.run!.prey = { riff: { a: 2 }, delta: { a: 1, b: 1 } };
    game.run!.diet = { riff: { plant: 60, meat: 40 } };
    expect(game.topPrey().total).toBe(4);
    game.noteEaten('b');
    game.noteFood('plant', 20);
    expect(game.topPrey().total).toBe(5);
    expect(game.dietAt()).toEqual({ plant: 80 / 120, meat: 40 / 120 });
    game.noteEaten('b');
    expect(game.topPrey().total).toBe(6);
  });

  it('gilt über alle Linien derselben Epoche; andere Epochen haben ihre eigene Beute', () => {
    game.newRun(P);
    game.noteEaten('a');
    game.noteEaten('a');
    expect(game.topPrey().total).toBe(2);
    game.extinct(0.5, 'Test');
    game.newRun(P);
    expect(game.topPrey().total).toBe(2);
    game.newRun(K);
    expect(game.topPrey()).toEqual({ top: [], total: 0 });
  });
});
