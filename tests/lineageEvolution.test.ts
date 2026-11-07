import { describe, expect, it, vi } from 'vitest';
import {
  breedLineage, isLineageEvolution, lineageForm, lineageFormName, lineageModifiers, lineageSummary,
  LINEAGE_ENDPOINTS, LINEAGE_FORMS, newLineageEvolution, readLineageEvolution,
  type LineageEvolution, type LineageHabitat, type LineageWeapon,
} from '../src/sim/lineageEvolution';

const work = (weapon: LineageWeapon, damage = 100) => weapon === 'bite' ? { biteDamage: damage } : { ramDamage: damage };
function body(site: LineageHabitat, weapon?: LineageWeapon) {
  let state = newLineageEvolution();
  for (let i = 0; i < 3; i++) state = breedLineage(state, site, weapon ? work(weapon) : {});
  return state;
}
function firstWeapon(site: LineageHabitat, weapon: LineageWeapon) { return breedLineage(body(site, weapon), site); }
function endpoint(site: LineageHabitat, weapon: LineageWeapon) { return breedLineage(firstWeapon(site, weapon), site, work(weapon)); }

describe('The new shoreline lineage', () => {
  it('starts as a viable transition animal, with an open habitat and weapon path', () => {
    const state = newLineageEvolution();
    expect(lineageForm(state)).toBe('transition');
    expect(state.habitat).toBeUndefined();
    expect(state.primary).toBeUndefined();
    expect(isLineageEvolution(state)).toBe(true);
    const m = lineageModifiers(state);
    expect(m.swim).toBeGreaterThan(.5);
    expect(m.walk).toBeGreaterThan(.5);
    expect(m.bite).toBe(1);
    expect(m.ram).toBe(1);
  });

  it.each(['water', 'shore'] as const)('needs three inherited generations at %s, not three clutches from one parent', site => {
    const parent = newLineageEvolution();
    const candidates = Array.from({ length: 12 }, () => breedLineage(parent, site));
    expect(candidates.every(egg => Math.abs(egg.habitatProgress) === 1 && !egg.habitat)).toBe(true);
    expect(parent).toEqual(newLineageEvolution());
    let chosen = candidates[0];
    chosen = breedLineage(chosen, site);
    expect(chosen.habitat).toBeUndefined();
    expect(lineageForm(chosen)).toBe('transition');
    chosen = breedLineage(chosen, site);
    expect(chosen.habitat).toBe(site);
    expect(lineageForm(chosen)).toBe(site);
    expect(chosen.births).toBe(3);
    expect(chosen.tier).toBe(0);
    // Choosing one egg never mutates its siblings or silently advances another lineage.
    expect(candidates[1].births).toBe(1);
  });

  it('unwinds an undecided habitat gradually when the lineage changes nursery', () => {
    let state = breedLineage(breedLineage(newLineageEvolution(), 'shore'), 'shore');
    expect(state.habitatProgress).toBe(2);
    state = breedLineage(state, 'water');
    expect(state.habitatProgress).toBe(1);
    expect(state.habitat).toBeUndefined();
    for (const value of [0, -1, -2, -3]) {
      state = breedLineage(state, 'water');
      expect(state.habitatProgress).toBe(value);
    }
    expect(state.habitat).toBe('water');
    const later = breedLineage(state, 'shore');
    expect(later.habitat).toBe('water');
    expect(later.habitatProgress).toBe(-3);
  });

  it('banks combat from the first life but still gives both the base and first weapon a whole generation', () => {
    const base = body('water', 'bite');
    expect(base.bite).toBe(12);
    expect(base.skull).toBe(0);
    expect(lineageForm(base)).toBe('water');
    const one = breedLineage(base, 'water', work('bite', 10000));
    expect(lineageForm(one)).toBe('water-bite-1');
    expect(one.specialization).toBe(0);
    const two = breedLineage(one, 'water', work('bite'));
    expect(lineageForm(two)).toBe('water-bite-2');
    expect(two.births).toBe(5);
    expect(base.tier).toBe(0);
    expect(one.tier).toBe(1);
  });

  it('allows gradual training but grants no final specialization for merely waiting or hatching', () => {
    let state = firstWeapon('shore', 'skull');
    for (let i = 0; i < 12; i++) state = breedLineage(state, 'shore');
    expect(state.tier).toBe(1);
    expect(state.specialization).toBe(0);
    for (let i = 0; i < 9; i++) state = breedLineage(state, 'shore', work('skull', 10));
    expect(state.tier).toBe(1);
    expect(state.specialization).toBeCloseTo(3.6);
    state = breedLineage(state, 'shore', work('skull', 10));
    expect(state.tier).toBe(2);
    expect(state.specialization).toBeCloseTo(4);
  });

  it('keeps a balanced weapon path open, including after a long balanced history', () => {
    let state = newLineageEvolution();
    for (let i = 0; i < 30; i++) state = breedLineage(state, 'water', { biteDamage: 100, ramDamage: 100 });
    expect(state.tier).toBe(0);
    expect(state.primary).toBeUndefined();
    expect(state.bite).toBeCloseTo(state.skull);
    expect(state.bite + state.skull).toBeCloseTo(40);
    state = breedLineage(state, 'water', work('skull'));
    expect(state.primary).toBe('skull');
    expect(state.tier).toBe(1);
  });

  it('specialization sheds acquired opposite traits without removing their usable base action', () => {
    let state = body('water');
    state = { ...state, bite: 10, skull: 8 };
    state = breedLineage(state, 'water');
    expect(state.primary).toBe('bite');
    const before = state.skull;
    state = breedLineage(state, 'water', { biteDamage: 100, ramDamage: 100 });
    expect(state.skull).toBeLessThan(before);
    for (let i = 0; i < 10; i++) state = breedLineage(state, 'water');
    const m = lineageModifiers(state);
    expect(state.skull).toBe(0);
    expect(m.ram).toBe(1);
    expect(m.bite).toBeGreaterThan(m.ram);
    expect(state.primary).toBe('bite');
  });

  it('has exactly the illustrated forms and four endpoints, with distinct habitat and weapon tradeoffs', () => {
    const observed = new Set([lineageForm(newLineageEvolution())]);
    for (const site of ['water', 'shore'] as const) for (const weapon of ['bite', 'skull'] as const) {
      for (const state of [body(site, weapon), firstWeapon(site, weapon), endpoint(site, weapon)]) {
        observed.add(lineageForm(state));
        expect(isLineageEvolution(state)).toBe(true);
        expect(lineageFormName(lineageForm(state))).toBeTruthy();
        expect(lineageSummary(state)).toBeTruthy();
      }
    }
    expect([...observed].sort()).toEqual([...LINEAGE_FORMS].sort());
    expect(LINEAGE_ENDPOINTS).toHaveLength(4);
    for (const weapon of ['bite', 'skull'] as const) {
      const water = lineageModifiers(endpoint('water', weapon)), shore = lineageModifiers(endpoint('shore', weapon));
      expect(water.swim).toBeGreaterThan(shore.swim);
      expect(water.walk).toBeLessThan(shore.walk);
      expect(water.walk).toBeGreaterThan(0);
      expect(shore.swim).toBeGreaterThan(0);
      expect(shore.air).toBeGreaterThan(water.air);
    }
    const jaws = lineageModifiers(endpoint('water', 'bite')), skull = lineageModifiers(endpoint('water', 'skull'));
    expect(jaws.bite).toBeGreaterThan(skull.bite);
    expect(jaws.ram).toBeLessThan(skull.ram);
    expect(jaws.defense).toBeGreaterThan(skull.defense);
  });

  it('has no fin mutation or random weapon choice; invalid effort cannot create training', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw Error('Evolution should not roll a mutation.'); });
    try {
      const state = breedLineage(newLineageEvolution(), 'shore', { biteDamage: Infinity, ramDamage: -100 });
      expect(state.bite).toBe(0);
      expect(state.skull).toBe(0);
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
});

describe('Lineage evolution persistence and input validation', () => {
  it('round trips independent egg states and strips unknown data without mutating the saved object', () => {
    const a = endpoint('water', 'bite'), b = endpoint('shore', 'skull');
    const saved = JSON.parse(JSON.stringify({ a, b }));
    const read = readLineageEvolution({ ...saved.a, injected: ['not part of the model'] });
    expect(read).toEqual(a);
    expect(read).not.toBe(saved.a);
    expect(readLineageEvolution(saved.b)).toEqual(b);
    expect(read).not.toHaveProperty('injected');
    read.bite = 0;
    expect(saved.a.bite).toBe(a.bite);
    expect(saved.b.habitat).toBe('shore');
  });

  it.each([
    null, {}, [], { ...newLineageEvolution(), v: 2 },
    { ...newLineageEvolution(), bite: NaN }, { ...newLineageEvolution(), skull: Infinity },
    { ...newLineageEvolution(), habitatProgress: 1.5 },
    { ...newLineageEvolution(), habitat: 'air' },
    { ...newLineageEvolution(), habitat: 'water', habitatProgress: 3 },
    { ...newLineageEvolution(), habitatProgress: -3 },
    { ...newLineageEvolution(), tier: 2 },
    { ...newLineageEvolution(), specialization: 10 },
    { ...newLineageEvolution(), births: -1 },
  ])('rejects malformed state %# and falls back to a fresh transition animal', value => {
    expect(isLineageEvolution(value)).toBe(false);
    expect(readLineageEvolution(value)).toEqual(newLineageEvolution());
  });

  it('keeps all ordinary actions functional and all output factors finite throughout long lineages', () => {
    let state: LineageEvolution = newLineageEvolution();
    for (let i = 0; i < 500; i++) {
      state = breedLineage(state, 'water', { biteDamage: 100000, ramDamage: 50 });
      expect(isLineageEvolution(state)).toBe(true);
      for (const n of Object.values(lineageModifiers(state))) {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
    }
    expect(state.tier).toBe(2);
    expect(state.bite).toBeLessThanOrEqual(40);
    expect(state.skull).toBe(0);
  });
});
