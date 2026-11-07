import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { epochIndex } from '../src/data/epochs';
import { startPlace } from '../src/data/world';
import { lineageForm, newLineageEvolution, type LineageHabitat, type LineageWeapon } from '../src/sim/lineageEvolution';
import { phases } from '../src/sim/life';
import { game, newStyle, type RoeEgg } from '../src/state/GameState';

const PERM = epochIndex('perm');
const SLOT = 'lineageflow';
const KEY = `evo-save-v3-${SLOT}`;
const storage = new Map<string, string>();
const effort = (weapon?: LineageWeapon, damage = 100) => ({
  ...newStyle(),
  ...(weapon === 'bite' ? { biteDamage: damage } : weapon === 'skull' ? { ramDamage: damage } : {}),
});

function lay(site: LineageHabitat, weapon?: LineageWeapon, young = 1): RoeEgg[] {
  const clutch = game.addClutch({ place: 'riff', breedingSite: site, x: site === 'water' ? 1160 : 3000,
    y: 400, at: Date.now(), fert: true, role: 'father', young });
  return game.layEggs(clutch, game.inherit({ meat: 0, plant: 0 }, effort(weapon)));
}

function choose(site: LineageHabitat, weapon?: LineageWeapon): RoeEgg {
  const [egg] = lay(site, weapon);
  const index = game.roe.findIndex(e => e.id === egg.id);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(game.hatch('next', index)).toBe(true);
  return egg;
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  game.load(SLOT);
  game.resetAll();
  game.newRun(PERM);
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('The played lineage, from a clutch to the chosen descendant', () => {
  it('starts in the open transition form with two usable basic attacks', () => {
    expect(game.isLineageEvolution).toBe(true);
    expect(game.evolution).toEqual(newLineageEvolution());
    expect(game.morph().lineageForm).toBe('transition');
    expect(game.stats().bite).toBeGreaterThan(0);
    expect(game.stats().ram).toBeGreaterThan(0);
    expect(game.stats().landSpeed).toBeGreaterThan(0);
    expect(game.canRam).toBe(true);
  });

  it('creates separate candidate lineages at the two sites without advancing the parent', () => {
    const parent = JSON.stringify(game.evolution);
    const water = lay('water', 'bite', 3);
    const shore = lay('shore', 'skull', 2);
    const moreWater = lay('water', 'bite');
    expect(JSON.stringify(game.evolution)).toBe(parent);
    expect(game.evolution.births).toBe(0);
    for (const egg of [...water, ...moreWater]) {
      expect(egg.breedingSite).toBe('water');
      expect(egg.evolution?.habitatProgress).toBe(-1);
      expect(egg.evolution?.births).toBe(1);
      expect(egg.evolution?.tier).toBe(0);
      expect(egg.finMutation).not.toBe(true);
    }
    for (const egg of shore) {
      expect(egg.breedingSite).toBe('shore');
      expect(egg.evolution?.habitatProgress).toBe(1);
      expect(egg.evolution?.births).toBe(1);
    }
    expect(water[0].evolution).not.toBe(water[1].evolution);
    expect(water[0].evolutionTrace).not.toBe(water[1].evolutionTrace);
    expect(game.morph().lineageForm).toBe('transition');
  });

  it.each(['water', 'shore'] as const)('commits the %s body after three chosen generations, retaining an unarmed base first', site => {
    const direction = site === 'water' ? -1 : 1;
    for (let step = 1; step <= 3; step++) {
      const egg = choose(site, 'bite');
      expect(game.evolution.births).toBe(step);
      expect(game.evolution.habitatProgress).toBe(direction * step);
      expect(game.evolution).toEqual(egg.evolution);
      expect(game.life.gen).toBe(step + 1);
      expect(game.morph().lineageForm).toBe(step < 3 ? 'transition' : site);
    }
    expect(game.evolution.habitat).toBe(site);
    expect(game.evolution.tier).toBe(0);
    expect(game.evolution.bite).toBeGreaterThan(0);
  });

  it.each([
    ['water', 'bite', 'water-bite-2'], ['water', 'skull', 'water-skull-2'],
    ['shore', 'bite', 'shore-bite-2'], ['shore', 'skull', 'shore-skull-2'],
  ] as const)('reaches %s / %s through the base and both visible weapon stages', (site, weapon, endpoint) => {
    const forms = [game.morph().lineageForm];
    for (let generation = 1; generation <= 5; generation++) {
      choose(site, weapon);
      forms.push(game.morph().lineageForm);
    }
    expect(forms).toEqual(['transition', 'transition', 'transition', site, `${site}-${weapon}-1`, endpoint]);
    expect(game.evolution.primary).toBe(weapon);
    expect(game.evolution.tier).toBe(2);
    expect(game.evolution.births).toBe(5);
    expect(game.run?.evolutionTrace?.at(-1)).toEqual(game.evolution);
    expect(game.stats().bite).toBeGreaterThan(0);
    expect(game.stats().ram).toBeGreaterThan(0);
  });

  it('keeps sibling selection in the same generation without inventing another inherited step', () => {
    const eggs = lay('water', undefined, 3);
    expect(game.hatch('next', game.roe.indexOf(eggs[0]))).toBe(true);
    const before = structuredClone(game.evolution);
    expect(game.pool).toHaveLength(2);
    expect(game.hatch('pool', 0)).toBe(true);
    expect(game.evolution).toEqual(before);
    expect(game.evolution.births).toBe(1);
    expect(game.life.gen).toBe(2);
  });

  it('unwinds an unfinished body choice when the selected offspring came from the other nursery', () => {
    choose('shore'); choose('shore');
    expect(game.evolution.habitatProgress).toBe(2);
    choose('water');
    expect(game.evolution.habitatProgress).toBe(1);
    expect(game.evolution.habitat).toBeUndefined();
    expect(game.morph().lineageForm).toBe('transition');
  });

  it('uses the egg form and displayed inheritance consistently before and after hatching', () => {
    for (let i = 0; i < 4; i++) choose('shore', 'skull');
    const [egg] = lay('shore', 'skull');
    const preview = game.roeMorph(egg), shown = game.roeShown(egg);
    const parent = structuredClone(game.evolution);
    expect(preview.lineageForm).toBe('shore-skull-2');
    expect(game.morph().lineageForm).toBe('shore-skull-1');
    expect(game.evolution).toEqual(parent);
    expect(game.hatch('next', game.roe.indexOf(egg))).toBe(true);
    expect(game.morph().lineageForm).toBe(preview.lineageForm);
    expect(game.roeShown()).toEqual(shown);
  });

  it('adopts another player\'s actual ancestry rather than adding the local nursery counter to it', () => {
    choose('water', 'bite'); choose('water', 'bite');
    const local = structuredClone(game.evolution);
    game.save();
    game.load('lineagepeer'); game.resetAll(); game.newRun(PERM);
    choose('shore', 'skull'); choose('shore', 'skull'); choose('shore', 'skull');
    const [foreign] = lay('shore', 'skull');
    const egg = structuredClone(foreign);
    game.load(SLOT);
    expect(game.evolution).toEqual(local);
    game.syncShared(egg.generation!, [egg], []);
    expect(game.evolution).toEqual(local);
    game.hatchRoe(egg, egg.generation!);
    expect(game.evolution).toEqual(egg.evolution);
    expect(game.evolution.births).toBe(4);
    expect(game.morph().lineageForm).toBe('shore-skull-1');
    expect(game.run?.evolutionTrace).toEqual(egg.evolutionTrace);
    expect(game.data.fishBranches?.some(branch => branch.extinct
      && branch.evolutionTrace?.some(s => s.habitatProgress === -2))).toBe(true);
  });

  it('joins a younger shared generation without losing its developed ancestry or sending future-generation eggs', () => {
    for (let i = 0; i < 5; i++) choose('shore', 'skull');
    const evolution = structuredClone(game.evolution), trace = structuredClone(game.run!.evolutionTrace);
    game.life.gen = 17; game.life.age = phases(17).span * .45; game.run!.coopGen = 17;
    const [oldEgg] = lay('shore', 'skull');
    expect(oldEgg.generation).toBe(18);
    game.syncShared(3, [], [oldEgg]);
    expect(game.life.gen).toBe(3);
    expect(game.life.age / phases(3).span).toBeCloseTo(.45);
    expect(game.evolution).toEqual(evolution);
    expect(game.run!.evolutionTrace).toEqual(trace);
    expect(game.pool).toHaveLength(0); expect(game.roe).toHaveLength(0);
    const [currentEgg] = lay('shore', 'skull');
    expect(currentEgg.generation).toBe(4);
    expect(game.roe).toHaveLength(1);
    expect(game.hatch('next', 0)).toBe(true);
    expect(game.life.gen).toBe(4);
    expect(game.evolution.births).toBe(evolution.births + 1);
    expect(game.morph().lineageForm).toBe('shore-skull-2');
  });
});

describe('Lineage saves and migration', () => {
  it('reloads a current lineage and its unchosen eggs without advancing or relocating it', () => {
    choose('shore', 'bite'); choose('shore', 'bite');
    game.enterPlace('ufer', { side: 'left', frac: .5 });
    game.run!.prog.resume = { x: 1760, y: 440 };
    lay('shore', 'bite', 2);
    const state = structuredClone(game.evolution), trace = structuredClone(game.run!.evolutionTrace);
    const eggs = structuredClone(game.roe);
    game.save(); game.load(SLOT);
    expect(game.evolution).toEqual(state);
    expect(game.run!.evolutionTrace).toEqual(trace);
    expect(game.prog.place).toBe('ufer');
    expect(game.prog.resume).toEqual({ x: 1760, y: 440 });
    expect(game.roe).toEqual(eggs);
  });

  it.each(['missing', 'malformed'] as const)('migrates a %s legacy Perm state once while preserving nutrition traits and discoveries', kind => {
    Object.assign(game.traits, { vitality: 18, staminaGain: 12, scaleGain: 7, biteGain: 90, finGain: 40 });
    game.collectShell('abyss'); game.life.fed = 37; game.life.age = 400;
    game.run!.prog.place = 'hochland';
    game.run!.prog.resume = { x: 900, y: 120 };
    game.run!.prog.edge = { side: 'right', frac: .5 };
    game.addClutch({ place: 'hochland', x: 500, y: 300, at: Date.now(), fert: true, role: 'father' });
    const raw = JSON.parse(JSON.stringify(game.data));
    if (kind === 'missing') delete raw.run.evolution;
    else raw.run.evolution = { v: 1, habitatProgress: Infinity, tier: 999 };
    storage.set(KEY, JSON.stringify(raw));
    game.load(SLOT);
    expect(game.evolution).toEqual(newLineageEvolution());
    expect(game.traits.vitality).toBe(18); expect(game.traits.staminaGain).toBe(12); expect(game.traits.scaleGain).toBe(7);
    expect(game.hasShell('abyss')).toBe(true); expect(game.life.fed).toBe(37); expect(game.life.gen).toBe(raw.run.life.gen);
    expect(game.prog.place).toBe(startPlace(game.epoch).id);
    expect(game.prog.resume).toBeUndefined(); expect(game.prog.edge).toBeUndefined();
    expect(game.life.clutches).toHaveLength(0);
    expect(game.life.age).toBeLessThanOrEqual(phases(game.life.gen).mature);
    game.enterPlace('ufer', { side: 'left', frac: .5 }); game.save(); game.load(SLOT);
    expect(game.prog.place).toBe('ufer');
    expect(game.evolution).toEqual(newLineageEvolution());
  });

  it('accepts a legacy egg as an independent transition form without copying the current player\'s development', () => {
    choose('water', 'bite'); choose('water', 'bite');
    const legacy: RoeEgg = { id: 'legacy-child', generation: game.poolGen + 1, traits: { vitality: 8 },
      sex: 1, seed: 3, place: 'riff', x: 0, y: 0 };
    game.run!.next = [legacy];
    expect(game.hatch('next', 0)).toBe(true);
    expect(lineageForm(game.evolution)).toBe('transition');
    expect(game.evolution.births).toBe(0);
    expect(game.evolution.habitatProgress).toBe(0);
  });
});
