import { CLASSES } from './classes';
import { epochSpecies, EPOCHS } from './epochs';
import { INHERIT, LIFE, MISC, MOVEMENT, SPAWN, STAMINA, VISION } from './life';
import { SIGHT } from '../sim/sight';
import { BITE } from '../sim/bite';
import { SWARM } from './swarm';
import { SPECIES } from './species';
import { FOOD, game, meatOf } from '../state/GameState';

// ---------------------------------------------------------------------------
// Die Entwickler-Einstellung (Titelbild, Zahnrad): alle Zahlen, die das Gleichgewicht des Spiels bestimmen, an einer Stelle –
// mit dem eingestellten Standard. Geändert wird direkt an den Werten selbst (LIFE, SPAWN, FOOD, SPECIES …); was vom Standard
// abweicht, merkt sich der Browser und setzt es beim nächsten Start wieder. Die meisten Werte gelten ab dem nächsten Ort.
// ---------------------------------------------------------------------------

export interface Param {
  /** fester Schlüssel (so steht er im Speicher und beim Exportieren) */
  id: string;
  label: string;
  hint?: string;
  /** der eingestellte Standard – bei manchen errechnet (die Nahrung einer Art aus ihrer Lebenskraft) */
  def: () => number;
  get: () => number;
  set: (v: number) => void;
  reset: () => void;
  step: number;
  min: number;
  max: number;
  bool?: boolean;
}

export interface Group {
  id: string;
  title: string;
  note?: string;
  params: Param[];
}

/** Eine Art in der Tabelle: ihre fünf Werte (Nahrung, Lebenskraft, Biss, Tempo, Stärke). */
export interface SpeciesRow {
  id: string;
  name: string;
  epoch: string;
  params: Param[];
}

type Bag = Record<string | number, unknown>;

const stepOf = (v: number) => (Number.isInteger(v) && Math.abs(v) >= 1 ? 1 : Math.abs(v) >= 10 ? 1 : Math.abs(v) >= 1 ? 0.1 : 0.01);

/** Ein Wert in einem Objekt (Zahl oder ja/nein). */
function field(obj: object, key: string | number, id: string, label: string, o: { hint?: string; step?: number; min?: number; max?: number } = {}): Param {
  const bag = obj as Bag;
  const d = bag[key] as number | boolean;
  const bool = typeof d === 'boolean';
  const num = bool ? (d ? 1 : 0) : (d as number);
  return {
    id,
    label,
    hint: o.hint,
    def: () => num,
    get: () => {
      const v = bag[key];
      return typeof v === 'boolean' ? (v ? 1 : 0) : (v as number);
    },
    set: (v) => (bag[key] = bool ? v >= 0.5 : v),
    reset: () => (bag[key] = d),
    step: bool ? 1 : (o.step ?? stepOf(num)),
    min: bool ? 0 : (o.min ?? 0),
    max: bool ? 1 : (o.max ?? 1e9),
    bool,
  };
}

// ---------------------------------------------------------------- Tiere

/** Die Werte jeder Art, wie im Spiel eingestellt. Die Regler gelten ihnen; die Faktoren für alle Tiere kommen obendrauf. */
const BASE: Record<string, { hp: number; dmg: number; speed: number; atkSpeed: number; power: number; food?: number }> = {};
for (const [id, d] of Object.entries(SPECIES)) BASE[id] = { hp: d.hp, dmg: d.dmg, speed: d.speed, atkSpeed: d.atkSpeed ?? d.speed, power: d.power, food: d.food };

/** Faktoren für alle Tiere zugleich */
export const ANIMALS = { hp: 1, dmg: 1, speed: 1, atkSpeed: 1 };

/** Die Arten bekommen ihre Werte: eigene Werte × Faktoren für alle. */
function syncSpecies() {
  for (const [id, b] of Object.entries(BASE)) {
    const d = SPECIES[id];
    d.hp = Math.max(1, Math.round(b.hp * ANIMALS.hp));
    d.dmg = Math.round(b.dmg * ANIMALS.dmg * 100) / 100;
    d.speed = Math.round(b.speed * ANIMALS.speed);
    d.atkSpeed = Math.round(b.atkSpeed * ANIMALS.atkSpeed);
    d.power = b.power;
    d.food = b.food;
  }
}

function speciesRow(id: string, epoch: string): SpeciesRow {
  const b = BASE[id];
  const d0 = { ...b };
  const num = (key: 'hp' | 'dmg' | 'speed' | 'power', label: string): Param => ({
    id: `art.${id}.${key}`,
    label,
    def: () => d0[key],
    get: () => b[key],
    set: (v) => {
      b[key] = v;
      // das Angriffstempo geht mit dem Tempo mit
      if (key === 'speed') b.atkSpeed = d0.atkSpeed * (d0.speed ? v / d0.speed : 1);
    },
    reset: () => {
      b[key] = d0[key];
      if (key === 'speed') b.atkSpeed = d0.atkSpeed;
    },
    step: key === 'dmg' || key === 'power' ? 0.5 : 1,
    min: key === 'hp' ? 1 : 0,
    max: 1e5,
  });
  // Nahrung: ohne eigenen Wert nach der Lebenskraft (FOOD.meatPerHp, FOOD.meatExp) – bei Größe 1
  const food: Param = {
    id: `art.${id}.food`,
    label: 'Food',
    def: () => (d0.food !== undefined ? d0.food : meatOf(b.hp * ANIMALS.hp)),
    get: () => (b.food !== undefined ? b.food : meatOf(b.hp * ANIMALS.hp)),
    set: (v) => (b.food = v),
    reset: () => (b.food = d0.food),
    step: 1,
    min: 0,
    max: 1e5,
  };
  return { id, name: SPECIES[id].name, epoch, params: [food, num('hp', 'Vitality'), num('dmg', 'Bite'), num('speed', 'Speed'), num('power', 'Power')] };
}

/** Alle Arten, nach dem Zeitalter, in dem sie zuerst vorkommen. */
export const SPECIES_ROWS: SpeciesRow[] = (() => {
  const seen = new Set<string>();
  const rows: SpeciesRow[] = [];
  for (const ep of EPOCHS) {
    const ids = epochSpecies(ep);
    for (const id of ids) {
      if (!id || seen.has(id) || !BASE[id]) continue;
      seen.add(id);
      rows.push(speciesRow(id, ep.name));
    }
  }
  for (const id of Object.keys(BASE)) if (!seen.has(id)) rows.push(speciesRow(id, 'Other'));
  return rows;
})();

// ---------------------------------------------------------------- alle Gruppen

const fish = CLASSES.fish.base;

export const GROUPS: Group[] = [
  {
    id: 'nahrung',
    title: 'Food',
    note: 'What food provides. Everything eaten contributes to offspring.',
    params: [
      field(FOOD, 'meatPerHp', 'FOOD.meatPerHp', 'Food per prey vitality', { step: 0.01, hint: 'A defeated animal yields meatPerHp × (vitality × size) to the power meatExp, rounded and at least 1, unless the species has its own value.' }),
      field(FOOD, 'meatExp', 'FOOD.meatExp', 'Reduction for large prey (exponent)', { hint: '1 follows vitality exactly; lower values make large animals yield proportionally less.', max: 2 }),
      field(FOOD, 'chunk', 'FOOD.chunk', 'Food in a large chunk', { min: 2, hint: 'An animal breaks into large chunks of this value and small chunks worth 1 each; one bite consumes a whole chunk.' }),
      field(FOOD.plant, 'sat', 'FOOD.plant.sat', 'Food per plant'),
      field(FOOD.toxic, 'sat', 'FOOD.toxic.sat', 'Food per toxic plant'),
      field(FOOD.roe, 'sat', 'FOOD.roe.sat', 'Food per egg (other species\' eggs)'),
      field(MISC, 'animalBite', 'MISC.animalBite', 'Meat per bite taken by other animals'),
      field(MISC, 'plantRegrow', 'MISC.plantRegrow', 'Plant regrowth (seconds per bite)'),
    ],
  },
  {
    id: 'nachwuchs',
    title: 'Offspring and spawning',
    params: [
      field(SPAWN, 'perYoung', 'SPAWN.perYoung', 'Food per offspring (first fish)'),
      field(SPAWN, 'perGain', 'SPAWN.perGain', 'Increase per improvement', { hint: 'Food per offspring = perYoung × (1 + perGain × improvements). Jaws alone 25% stronger: × 1.5.' }),
      field(SPAWN, 'maxYoung', 'SPAWN.maxYoung', 'Maximum offspring per life'),
      field(SPAWN, 'cooldown', 'SPAWN.cooldown', 'Pause after spawning (seconds)'),
      field(SPAWN, 'alwaysMale', 'SPAWN.alwaysMale', 'Always hatch male (1 = yes)'),
      field(SPAWN, 'reach', 'SPAWN.reach', 'Clutch interaction range (pixels)'),
      field(SPAWN, 'ground', 'SPAWN.ground', 'Distance from bottom when laying (pixels)'),
      field(SPAWN.maleDelay, 0, 'SPAWN.maleDelay.0', 'Male arrives after … (minimum seconds)'),
      field(SPAWN.maleDelay, 1, 'SPAWN.maleDelay.1', '… to (maximum seconds)'),
      field(SPAWN.femaleDelay, 0, 'SPAWN.femaleDelay.0', 'Female lays after … (minimum seconds)'),
      field(SPAWN.femaleDelay, 1, 'SPAWN.femaleDelay.1', '… to (maximum seconds)'),
      field(SPAWN, 'femaleEvery', 'SPAWN.femaleEvery', 'Female lays at most once every … seconds'),
      field(SPAWN, 'decay', 'SPAWN.decay', 'Unfertilised clutch spoils after (seconds)'),
      field(SPAWN, 'eggs', 'SPAWN.eggs', 'Eggs per clutch'),
    ],
  },
  {
    id: 'muscheln',
    title: 'Vision',
    note: 'Vision is inherited through time spent in deep water. Collectible shells provide no stat bonuses.',
    params: [
      field(VISION, 'base', 'VISION.base', 'Initial vision (screen fraction)', { step: 0.05, max: 1 }),
      field(VISION, 'perPoint', 'VISION.perPoint', 'Vision per inherited vision point', { step: 0.01, max: 1 }),
      field(SIGHT, 'front0', 'SIGHT.front0', 'Forward vision: base portion of range', { step: 0.02, max: 1 }),
      field(SIGHT, 'fade', 'SIGHT.fade', 'Edge of vision: transition length (range fraction)', { step: 0.01, max: 1 }),
      field(SIGHT, 'depth', 'SIGHT.depth', 'Vision range in the deepest water (factor)', { step: 0.02, max: 1.5 }),
      field(SIGHT, 'dark', 'SIGHT.dark', 'Darkness beyond view (near the surface)', { step: 0.05, max: 1 }),
      field(SIGHT, 'darkDeep', 'SIGHT.darkDeep', 'Darkness beyond view (in the depths)', { step: 0.05, max: 1 }),
      field(SIGHT, 'feel', 'SIGHT.feel', 'Lateral line: detect any animal within (pixels)', { step: 10, max: 600 }),
      field(SIGHT, 'feelThreat', 'SIGHT.feelThreat', 'Lateral line: detect predators and attackers within (pixels)', { step: 10, max: 1200 }),
      field(SIGHT, 'feelThreatClarity', 'SIGHT.feelThreatClarity', 'Visibility of a sensed predator', { step: 0.05, max: 1 }),
      field(STAMINA, 'sprint', 'STAMINA.sprint', 'Sprint seconds per stamina circle', { step: 0.1, min: 0.5 }),
    ],
  },
  {
    id: 'leben',
    title: 'Life',
    note: 'Seconds of active life. Later generations live longer, per doubling of generation number.',
    params: [
      field(LIFE, 'mature', 'LIFE.mature', 'Time until spawning (seconds, generation 1)'),
      field(LIFE, 'maturePerDoubling', 'LIFE.maturePerDoubling', '… extra per doubling'),
      field(LIFE, 'rest', 'LIFE.rest', 'Remaining life afterwards (seconds, generation 1)'),
      field(LIFE, 'restPerDoubling', 'LIFE.restPerDoubling', '… extra per doubling'),
      field(LIFE, 'hatch', 'LIFE.hatch', 'Size at hatching (fraction)', { max: 1 }),
      field(LIFE, 'adult', 'LIFE.adult', 'Adult from (size fraction)', { max: 1 }),
      field(LIFE, 'oldFrac', 'LIFE.oldFrac', 'Old from (remaining-life fraction)', { max: 1 }),
      field(LIFE, 'oldSpeed', 'LIFE.oldSpeed', 'Old age: speed reduction (fraction)', { max: 1 }),
      field(LIFE, 'oldEndurance', 'LIFE.oldEndurance', 'Old age: stamina reduction (fraction)', { max: 1 }),
      field(LIFE, 'oldRecover', 'LIFE.oldRecover', 'Old age: recovery reduction (fraction)', { max: 1 }),
      field(LIFE, 'oldHp', 'LIFE.oldHp', 'Old age: vitality reduction (fraction)', { max: 1 }),
      field(LIFE, 'fadeSeconds', 'LIFE.fadeSeconds', 'Slowing at life\'s end: final … seconds'),
      field(LIFE, 'fadeTo', 'LIFE.fadeTo', '… down to (speed fraction)', { max: 1 }),
      field(MISC, 'restHealCap', 'MISC.restHealCap', 'Rest heals up to (fraction)', { max: 1 }),
      field(MISC, 'regenRest', 'MISC.regenRest', 'Healing while drifting (fraction per second)', { step: 0.001, max: 1 }),
      field(MISC, 'regenSlow', 'MISC.regenSlow', 'Healing while swimming slowly (fraction per second)', { step: 0.001, max: 1 }),
      field(MISC, 'healBite', 'MISC.healBite', 'Healing from a medicinal plant (fraction)', { max: 1 }),
    ],
  },
  {
    id: 'vererbung',
    title: 'Inheritance',
    note: 'How much offspring change each generation.',
    params: [
      field(INHERIT, 'points', 'INHERIT.points', 'Point budget before variance'),
      field(INHERIT, 'defeats', 'INHERIT.defeats', 'Equal-strength victories for the full meat budget'),
      field(INHERIT, 'swimDistance', 'INHERIT.swimDistance', 'Distance for full length gain'),
      field(INHERIT, 'lengthStep', 'INHERIT.lengthStep', 'Length gain per generation (fraction)'),
      field(MOVEMENT, 'finPerPoint', 'MOVEMENT.finPerPoint', 'Speed per inherited fin point (fraction)', { step: 0.005, max: 0.2 }),
      field(MOVEMENT, 'finEndurance', 'MOVEMENT.finEndurance', 'Stamina per inherited fin point (fraction)', { step: 0.001, max: 0.05 }),
      field(MOVEMENT, 'lengthSpeed', 'MOVEMENT.lengthSpeed', 'Speed from length gain (fraction)', { step: 0.05, max: 1 }),
      field(INHERIT, 'massStep', 'INHERIT.massStep', 'Weight gain at full depth (fraction)'),
      field(INHERIT, 'carry', 'INHERIT.carry', 'Life experience passed on (fraction)', { max: 1 }),
      field(INHERIT, 'partner', 'INHERIT.partner', 'Partner contribution (fraction)', { max: 1 }),
      field(INHERIT, 'vary', 'INHERIT.vary', 'Gain variance per egg (± fraction)', { max: 0.5 }),
      field(INHERIT.step, 'diet', 'INHERIT.step.diet', 'Maximum diet change per generation'),
      field(INHERIT.step, 'carry', 'INHERIT.step.carry', 'Maximum accumulated gain per generation'),
      field(FOOD.meat, 'kcal', 'FOOD.meat.kcal', 'Meat nutrition (for diet)'),
      field(FOOD.plant, 'kcal', 'FOOD.plant.kcal', 'Plant nutrition (for diet)'),
    ],
  },
  {
    id: 'tier',
    title: 'Player animal (first fish)',
    note: 'Base values before growth, age and inheritance.',
    params: [
      field(fish, 'hp', 'CLASSES.fish.hp', 'Vitality'),
      field(fish, 'bite', 'CLASSES.fish.bite', 'Bite'),
      field(fish, 'ram', 'CLASSES.fish.ram', 'Ram'),
      field(fish, 'speed', 'CLASSES.fish.speed', 'Speed'),
    ],
  },
  {
    id: 'alle',
    title: 'All animals',
    note: 'Multipliers for every species\' values (1 = configured value).',
    params: [
      field(ANIMALS, 'hp', 'ANIMALS.hp', 'Vitality ×', { step: 0.05 }),
      field(ANIMALS, 'dmg', 'ANIMALS.dmg', 'Bite ×', { step: 0.05 }),
      field(ANIMALS, 'speed', 'ANIMALS.speed', 'Speed ×', { step: 0.05 }),
      field(ANIMALS, 'atkSpeed', 'ANIMALS.atkSpeed', 'Attack speed ×', { step: 0.05 }),
    ],
  },
  {
    id: 'biss',
    title: 'Predator bites',
    note: 'Turn red (wind up) → brief fast lunge with mouth open → snap shut → recover. Damage applies only inside the mouth.',
    params: [
      field(BITE, 'reach', 'BITE.reach', 'Begins attack this far in front of the mouth (pixels)', { step: 5 }),
      field(BITE, 'wind', 'BITE.wind', 'Wind-up (seconds)', { step: 0.02 }),
      field(BITE, 'windBig', 'BITE.windBig', '… large predators (seconds)', { step: 0.02 }),
      field(BITE, 'dash', 'BITE.dash', 'Lunge (seconds)', { step: 0.02 }),
      field(BITE, 'long', 'BITE.long', 'Long lunge of large predators: extra duration', { step: 0.1 }),
      field(BITE, 'speed', 'BITE.speed', 'Lunge speed (× attack speed)', { step: 0.1 }),
      field(BITE, 'rec', 'BITE.rec', 'Recovery (seconds)', { step: 0.02 }),
      field(BITE, 'rest', 'BITE.rest', 'Time until next bite (ms)', { step: 50 }),
      field(BITE, 'restBig', 'BITE.restBig', '… large predators (ms)', { step: 50 }),
      field(BITE, 'spread', 'BITE.spread', 'Phase timing variance (± fraction)', { step: 0.02, max: 0.6, hint: 'Each phase randomly lasts a little longer or shorter, so predators cannot be beaten by following a fixed rhythm.' }),
      field(BITE, 'quickChance', 'BITE.quickChance', 'Quick-bite probability', { step: 0.05, max: 1, hint: 'Wind-up then lasts only quick × the usual time.' }),
      field(BITE, 'pauseChance', 'BITE.pauseChance', 'Longer-pause probability', { step: 0.05, max: 1, hint: 'Adds pauseMin … pauseMax ms before the next bite.' }),
      field(BITE, 'aim', 'BITE.aim', 'Steering only at lunge start (fraction)', { step: 0.05, max: 1, hint: 'After this the bite is committed: swimming aside lets you escape.' }),
    ],
  },
  {
    id: 'gruppe',
    title: 'Group',
    params: [
      field(SWARM, 'cap', 'SWARM.cap', 'Maximum answering one call'),
      field(SWARM, 'capPlus', 'SWARM.capPlus', '… extra at full cohesion'),
      field(SWARM, 'growEvery', 'SWARM.growEvery', 'New group member per shared prey'),
      field(SWARM, 'dmg', 'SWARM.dmg', 'Group member attack strength (fraction)', { max: 1 }),
      field(SWARM, 'dmgPlus', 'SWARM.dmgPlus', '… extra at full cohesion', { max: 1 }),
      field(SWARM, 'cooldown', 'SWARM.cooldown', 'Call cooldown (ms)', { step: 500 }),
    ],
  },
];

const ALL: Param[] = [...GROUPS.flatMap((g) => g.params), ...SPECIES_ROWS.flatMap((r) => r.params)];
const BY_ID = new Map(ALL.map((p) => [p.id, p]));

// ---------------------------------------------------------------- Speichern und Anwenden

const KEY = 'evo-tuning-v1';
let overrides: Record<string, number> = {};

function save() {
  try {
    if (Object.keys(overrides).length) localStorage.setItem(KEY, JSON.stringify(overrides));
    else localStorage.removeItem(KEY);
  } catch {
    /* ohne Speicher gilt es nur bis zum Neuladen */
  }
}

/** Nach jeder Änderung: Arten neu setzen, Bezugswerte vergessen. */
function settle() {
  syncSpecies();
  game.forgetBaseline();
}

/** Beim Start: die gespeicherten eigenen Werte setzen. */
export function applyTuning() {
  try {
    const raw = localStorage.getItem(KEY);
    overrides = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    overrides = {};
  }
  for (const [id, v] of Object.entries(overrides)) {
    const p = BY_ID.get(id);
    if (p && Number.isFinite(v)) p.set(v);
    else delete overrides[id];
  }
  settle();
}

/** Ist der Wert vom Standard verändert? */
export const isChanged = (p: Param) => p.id in overrides;

/** Einen Wert setzen (auf den Standard: die Änderung fällt weg). */
export function setParam(p: Param, v: number) {
  const x = Math.min(p.max, Math.max(p.min, p.bool ? (v >= 0.5 ? 1 : 0) : v));
  if (Math.abs(x - p.def()) < 1e-9) {
    delete overrides[p.id];
    p.reset();
  } else {
    overrides[p.id] = x;
    p.set(x);
  }
  settle();
  save();
}

export function resetParam(p: Param) {
  delete overrides[p.id];
  p.reset();
  settle();
  save();
}

/** Alles zurück auf den Standard. */
export function resetAll() {
  for (const id of Object.keys(overrides)) BY_ID.get(id)?.reset();
  overrides = {};
  settle();
  save();
}

/** Wie viele Werte verändert sind. */
export const changedCount = () => Object.keys(overrides).length;

/** Die eigenen Werte als Text (zum Weitergeben). */
export const exportTuning = () => JSON.stringify(overrides, null, 2);

/** Eigene Werte aus Text übernehmen (ersetzt alle bisherigen). Gibt die Zahl der übernommenen Werte zurück, -1 bei Unsinn. */
export function importTuning(text: string): number {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return -1;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return -1;
  resetAll();
  let n = 0;
  for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
    const p = BY_ID.get(id);
    if (!p || typeof v !== 'number' || !Number.isFinite(v)) continue;
    overrides[id] = v;
    p.set(v);
    n++;
  }
  settle();
  save();
  return n;
}
