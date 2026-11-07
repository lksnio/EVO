/** The new shoreline lineage. Stored on an individual egg and adopted only when that egg is chosen. */
export type LineageHabitat = 'water' | 'shore';
export type LineageWeapon = 'bite' | 'skull';
export type LineageTier = 0 | 1 | 2;
export type LineageForm = 'transition' | LineageHabitat
  | 'water-bite-1' | 'water-bite-2' | 'water-skull-1' | 'water-skull-2'
  | 'shore-bite-1' | 'shore-bite-2' | 'shore-skull-1' | 'shore-skull-2';

export interface LineageEvolution {
  v: 1;
  /** Negative approaches water; positive approaches shore. Three inherited steps commit the body. */
  habitatProgress: number;
  habitat?: LineageHabitat;
  /** Inherited combat training: weighted damage / 25, at most four points per life. */
  bite: number;
  skull: number;
  primary?: LineageWeapon;
  tier: LineageTier;
  /** Primary training after the first visible weapon stage, bounded at the final requirement. */
  specialization: number;
  births: number;
}

export interface LineageEffort { biteDamage?: number; ramDamage?: number }
export interface LineageModifiers {
  swim: number;
  walk: number;
  bite: number;
  ram: number;
  /** Multiplier for incoming damage: lower means stronger protection. */
  defense: number;
  endurance: number;
  /** Breath reserve multiplier, independent of ordinary stamina. */
  air: number;
}

export const LINEAGE_HABITAT_STEPS = 3;
export const LINEAGE_WEAPON_FIRST = 4;
export const LINEAGE_WEAPON_FINAL = 10;
export const LINEAGE_FINAL_PRACTICE = 4;
export const LINEAGE_DAMAGE_PER_POINT = 25;
export const LINEAGE_MAX_TRAINING = 4;
export const LINEAGE_DOMINANCE = 1.2;
const MAX_BANK = 40;
const MAX_BIRTHS = 1_000_000;
const EPS = 1e-9;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const habitat = (v: unknown): v is LineageHabitat => v === 'water' || v === 'shore';
const weapon = (v: unknown): v is LineageWeapon => v === 'bite' || v === 'skull';

export function newLineageEvolution(): LineageEvolution {
  return { v: 1, habitatProgress: 0, bite: 0, skull: 0, tier: 0, specialization: 0, births: 0 };
}

/** Strict shape validation for network input. Unknown fields are never copied into the canonical state. */
export function isLineageEvolution(value: unknown): value is LineageEvolution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Partial<LineageEvolution>;
  return s.v === 1 && finite(s.habitatProgress, -3, 3) && Number.isInteger(s.habitatProgress)
    && (s.habitat === undefined || habitat(s.habitat))
    && (!s.habitat || s.habitatProgress === (s.habitat === 'water' ? -3 : 3))
    && (s.habitat || Math.abs(s.habitatProgress) < 3)
    && finite(s.bite, 0, MAX_BANK) && finite(s.skull, 0, MAX_BANK)
    && (s.primary === undefined || weapon(s.primary))
    && (s.tier === 0 || s.tier === 1 || s.tier === 2)
    && (s.tier === 0 || !!s.habitat && !!s.primary)
    && finite(s.specialization, 0, LINEAGE_FINAL_PRACTICE)
    && finite(s.births, 0, MAX_BIRTHS) && Number.isInteger(s.births);
}

/** Older/missing/damaged state starts at the transition animal; valid state is copied, never aliased. */
export function readLineageEvolution(value: unknown): LineageEvolution {
  if (!isLineageEvolution(value)) return newLineageEvolution();
  return { v: 1, habitatProgress: value.habitatProgress, ...(value.habitat ? { habitat: value.habitat } : {}),
    bite: value.bite, skull: value.skull, ...(value.primary ? { primary: value.primary } : {}),
    tier: value.tier, specialization: value.specialization, births: value.births };
}

const training = (damage: number | undefined) => Math.min(LINEAGE_MAX_TRAINING,
  Math.max(0, Number.isFinite(damage) ? damage! : 0) / LINEAGE_DAMAGE_PER_POINT);

/** A balanced lifestyle keeps the weapon choice open. No random roll chooses a player's specialization. */
function dominantWeapon(bite: number, skull: number): LineageWeapon | undefined {
  if (bite >= LINEAGE_WEAPON_FIRST - EPS && bite >= skull * LINEAGE_DOMINANCE - EPS) return 'bite';
  if (skull >= LINEAGE_WEAPON_FIRST - EPS && skull >= bite * LINEAGE_DOMINANCE - EPS) return 'skull';
  return undefined;
}

/**
 * Calculate a candidate descendant, without mutating the parent or committing a player's run.
 * Its nursery belongs to this particular egg; merely visiting a site or producing extra clutches is not another step.
 */
export function breedLineage(parent: unknown, nursery: LineageHabitat, effort: LineageEffort = {}): LineageEvolution {
  const before = readLineageEvolution(parent), next = readLineageEvolution(before);
  next.births = Math.min(MAX_BIRTHS, before.births + 1);
  const gained = { bite: training(effort.biteDamage), skull: training(effort.ramDamage) };

  if (!next.habitat) {
    next.habitatProgress = clamp(next.habitatProgress + (nursery === 'water' ? -1 : 1), -3, 3);
    if (Math.abs(next.habitatProgress) === 3) next.habitat = next.habitatProgress < 0 ? 'water' : 'shore';
  }

  if (before.tier && before.primary) {
    const other = before.primary === 'bite' ? 'skull' : 'bite';
    next[before.primary] = Math.min(MAX_BANK, before[before.primary] + gained[before.primary]);
    // Acquired opposite traits recede. The other action always retains its ordinary base function.
    next[other] = Math.max(0, before[other] - 1 - gained[before.primary] * .5);
    next.specialization = Math.min(LINEAGE_FINAL_PRACTICE, before.specialization + gained[before.primary]);
    if (before.tier === 1 && next[before.primary] >= LINEAGE_WEAPON_FINAL - EPS && next.specialization >= LINEAGE_FINAL_PRACTICE - EPS) next.tier = 2;
  } else {
    next.bite += gained.bite;
    next.skull += gained.skull;
    // A shared cap preserves the latest direction even after a long balanced history.
    const total = next.bite + next.skull;
    if (total > MAX_BANK) { next.bite *= MAX_BANK / total; next.skull *= MAX_BANK / total; }
    // The newly committed habitat is a playable BASE for a full generation. Its first weapon comes later.
    if (before.habitat) {
      const primary = dominantWeapon(next.bite, next.skull);
      if (primary) { next.primary = primary; next.tier = 1; next.specialization = 0; }
    }
  }
  return next;
}

export function lineageForm(state: LineageEvolution): LineageForm {
  if (!state.habitat) return 'transition';
  return state.tier && state.primary ? `${state.habitat}-${state.primary}-${state.tier}` : state.habitat;
}

const FORM_NAMES: Record<LineageForm, string> = {
  transition: 'Shoreline ancestor', water: 'Aquatic fish', shore: 'Shoreline walker',
  'water-bite-1': 'Fanged fish', 'water-bite-2': 'Fang specialist',
  'water-skull-1': 'Shield-headed fish', 'water-skull-2': 'Armoured rammer',
  'shore-bite-1': 'Toothed shoreline walker', 'shore-bite-2': 'Shoreline bite specialist',
  'shore-skull-1': 'Shield-headed walker', 'shore-skull-2': 'Shoreline ram specialist',
};
export const lineageFormName = (form: LineageForm) => FORM_NAMES[form];

/** The four endpoints are explicit; a new unrelated three-trait permutation is never silently invented. */
export const LINEAGE_FORMS = Object.keys(FORM_NAMES) as LineageForm[];
export const LINEAGE_ENDPOINTS: readonly LineageForm[] = ['water-bite-2', 'water-skull-2', 'shore-bite-2', 'shore-skull-2'];

export function lineageSummary(state: LineageEvolution): string {
  if (!state.habitat) {
    const toward = state.habitatProgress < 0 ? 'water' : state.habitatProgress > 0 ? 'shore' : 'either habitat';
    return `${Math.abs(state.habitatProgress)} / ${LINEAGE_HABITAT_STEPS} inherited steps towards ${toward}`;
  }
  if (!state.tier) return `${state.habitat === 'water' ? 'Aquatic' : 'Shoreline'} body established · weapon path still open`;
  return `${state.primary === 'bite' ? 'Jaws' : 'Head armour'} ${state.tier} · ${state.tier === 2 ? 'fully specialised' : 'specialisation developing'}`;
}

/** Bounded factors multiply the ordinary vitality/stamina/scales-based stats; no usable action drops to zero. */
export function lineageModifiers(state: LineageEvolution): LineageModifiers {
  const own = state.primary, tier = state.tier;
  const biteTraining = 1 + Math.min(LINEAGE_WEAPON_FIRST, state.bite) * .075;
  const skullTraining = 1 + Math.min(LINEAGE_WEAPON_FIRST, state.skull) * .075;
  let swim = .78 - state.habitatProgress * .05, walk = .65 + state.habitatProgress * .1;
  if (state.habitat === 'water') { swim = [1.1, 1.35, 1.65][tier]; walk = [.48, .38, .28][tier]; }
  if (state.habitat === 'shore') { swim = [.8, .68, .55][tier]; walk = [1.05, 1.3, 1.6][tier]; }
  return { swim, walk,
    bite: own === 'bite' && tier ? [1, 1.8, 3][tier] : biteTraining,
    ram: own === 'skull' && tier ? [1, 1.9, 3.2][tier] : skullTraining,
    defense: own === 'skull' && tier ? [1, .8, .6][tier] : 1 - Math.min(LINEAGE_WEAPON_FIRST, state.skull) * .02,
    endurance: 1,
    air: state.habitat === 'shore' ? [1.25, 1.6, 2][tier] : state.habitat === 'water' ? .75 : 1 };
}
