import { beforeEach, describe, expect, it } from 'vitest';
import { game } from '../src/state/GameState';

// Die Beute in der Übersicht: was deine Linie an einem Ort gefressen hat – die drei häufigsten Arten und ihr Anteil.

describe('Beute', () => {
  beforeEach(() => game.resetAll());

  it('zählt je Ort – die drei häufigsten mit ihrem Anteil an allem, was dort gefressen wurde', () => {
    game.newRun(0);
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
  });

  it('gilt über die Generationen der Linie – eine neue Linie beginnt leer', () => {
    game.newRun(0);
    game.noteEaten('a');
    game.noteEaten('a');
    expect(game.topPrey().total).toBe(2);
    game.extinct(0.5, 'Test');
    game.newRun(0);
    expect(game.topPrey()).toEqual({ top: [], total: 0 });
  });
});
