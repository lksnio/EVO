import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SHELLS, STAMINA } from '../src/data/life';
import { game, shellChance, staminaMax } from '../src/state/GameState';

// Muscheln fallen selten von erlegter Beute; bei 16, 256, 4096 … Muscheln segnet die große Muschel mit mehr Ausdauer.

describe('Muscheln', () => {
  beforeEach(() => game.resetAll());

  it('fallen selten – ebenbürtige Beute 1 %, doppelt so starke 2 %, schwache halb so oft', () => {
    expect(SHELLS.chance).toBe(0.01);
    expect(shellChance(1)).toBeCloseTo(0.01);
    expect(shellChance(2)).toBeCloseTo(0.02);
    expect(shellChance(9)).toBeCloseTo(0.02);
    expect(shellChance(0.1)).toBeCloseTo(0.005);
  });

  it('bei 16, 256, 4096 … Muscheln segnet die große Muschel: Jeder Segen gibt mehr Ausdauer', () => {
    game.newRun(0);
    expect(game.staminaMax).toBe(1);
    expect(game.nextBlessing).toBe(16);
    for (let i = 0; i < 15; i++) game.addShell();
    expect(game.canPray).toBe(false);
    expect(game.pray()).toBe(false);
    expect(game.addShell()).toBe(16);
    expect(game.canPray).toBe(true);
    expect(game.pray()).toBe(true);
    expect(game.blessings).toBe(1);
    expect(game.staminaMax).toBe(1 + STAMINA.perBlessing);
    // die Muscheln bleiben – der nächste Segen wartet bei 256
    expect(game.shells).toBe(16);
    expect(game.nextBlessing).toBe(256);
    expect(game.canPray).toBe(false);
  });

  it('die Ausdauer wächst nicht über ihr Höchstmaß', () => {
    expect(staminaMax(0)).toBe(1);
    expect(staminaMax(2)).toBe(1 + 2 * STAMINA.perBlessing);
    expect(staminaMax(100)).toBe(STAMINA.max);
  });
});

describe('ältere Spielstände mit festen Muscheln', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('gefundene Muscheln zählen weiter (aus der Liste wird ihre Zahl)', () => {
    game.resetAll();
    game.newRun(0);
    const old = JSON.parse(JSON.stringify(game.data));
    old.run.shells = ['devon:riff:0', 'devon:garten:0', 'devon:wand:1'];
    old.run.seenRows = 2;
    delete old.run.blessings;
    store.set('evo-save-v3', JSON.stringify(old));
    game.load();
    expect(game.shells).toBe(3);
    expect(game.blessings).toBe(0);
    expect(game.staminaMax).toBe(1);
  });
});
