import { CLASSES } from './classes';
import { epochSpecies, EPOCHS } from './epochs';
import { INHERIT, LIFE, MISC, SHELLS, SPAWN, STAMINA, UPGRADES } from './life';
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
    label: 'Nahrung',
    def: () => (d0.food !== undefined ? d0.food : meatOf(b.hp * ANIMALS.hp)),
    get: () => (b.food !== undefined ? b.food : meatOf(b.hp * ANIMALS.hp)),
    set: (v) => (b.food = v),
    reset: () => (b.food = d0.food),
    step: 1,
    min: 0,
    max: 1e5,
  };
  return { id, name: SPECIES[id].name, epoch, params: [food, num('hp', 'Lebenskraft'), num('dmg', 'Biss'), num('speed', 'Tempo'), num('power', 'Stärke')] };
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
  for (const id of Object.keys(BASE)) if (!seen.has(id)) rows.push(speciesRow(id, 'Sonst'));
  return rows;
})();

// ---------------------------------------------------------------- alle Gruppen

const fish = CLASSES.fish.base;

export const GROUPS: Group[] = [
  {
    id: 'nahrung',
    title: 'Nahrung',
    note: 'Was Fressen bringt. Alles Gefressene sammelt sich für den Nachwuchs.',
    params: [
      field(FOOD, 'meatPerHp', 'FOOD.meatPerHp', 'Nahrung je Lebenskraft der Beute', { step: 0.01, hint: 'Ein erlegtes Tier gibt meatPerHp × (Lebenskraft × Größe) hoch meatExp, gerundet, wenigstens 1 – sofern die Art keinen eigenen Wert hat.' }),
      field(FOOD, 'meatExp', 'FOOD.meatExp', 'Abnahme bei großer Beute (Exponent)', { hint: '1 = genau nach Lebenskraft, kleiner = große Tiere geben verhältnismäßig weniger.', max: 2 }),
      field(FOOD, 'chunk', 'FOOD.chunk', 'Nahrung in einem großen Brocken', { min: 2, hint: 'Ein Tier zerfällt in große Brocken (so viel) und kleine (je 1); jeder wird mit einem Bissen ganz gefressen.' }),
      field(FOOD.plant, 'sat', 'FOOD.plant.sat', 'Nahrung je Pflanze'),
      field(FOOD.toxic, 'sat', 'FOOD.toxic.sat', 'Nahrung je Giftpflanze'),
      field(FOOD.roe, 'sat', 'FOOD.roe.sat', 'Nahrung je Ei (fremder Laich)'),
      field(MISC, 'animalBite', 'MISC.animalBite', 'Fleisch je Biss anderer Tiere'),
      field(MISC, 'plantRegrow', 'MISC.plantRegrow', 'Pflanzen wachsen nach (Sekunden je Bissen)'),
    ],
  },
  {
    id: 'nachwuchs',
    title: 'Nachwuchs und Laichen',
    params: [
      field(SPAWN, 'perYoung', 'SPAWN.perYoung', 'Nahrung je Nachkomme (erster Fisch)'),
      field(SPAWN, 'perGain', 'SPAWN.perGain', 'Mehr je Verbesserung', { hint: 'Nahrung je Nachkomme = perYoung × (1 + perGain × Verbesserungen). Nur das Gebiss 25 % stärker: × 1,5.' }),
      field(SPAWN, 'maxYoung', 'SPAWN.maxYoung', 'Höchstens Nachkommen je Leben'),
      field(SPAWN, 'cooldown', 'SPAWN.cooldown', 'Pause nach dem Laichen (Sekunden)'),
      field(SPAWN, 'alwaysMale', 'SPAWN.alwaysMale', 'Immer als Männchen schlüpfen (1 = ja)'),
      field(SPAWN, 'reach', 'SPAWN.reach', 'Reichweite zum Gelege (Bildpunkte)'),
      field(SPAWN, 'ground', 'SPAWN.ground', 'Abstand zum Grund beim Ablegen (Bildpunkte)'),
      field(SPAWN.maleDelay, 0, 'SPAWN.maleDelay.0', 'Männchen kommt nach … (von, Sekunden)'),
      field(SPAWN.maleDelay, 1, 'SPAWN.maleDelay.1', '… bis (Sekunden)'),
      field(SPAWN.femaleDelay, 0, 'SPAWN.femaleDelay.0', 'Weibchen legt nach … (von, Sekunden)'),
      field(SPAWN.femaleDelay, 1, 'SPAWN.femaleDelay.1', '… bis (Sekunden)'),
      field(SPAWN, 'femaleEvery', 'SPAWN.femaleEvery', 'Weibchen legt höchstens alle … Sekunden'),
      field(SPAWN, 'decay', 'SPAWN.decay', 'Unbefruchtetes Gelege verdirbt nach (Sekunden)'),
      field(SPAWN, 'eggs', 'SPAWN.eggs', 'Eier je Gelege'),
      field(SPAWN, 'gold', 'SPAWN.gold', 'Goldene Geburt je Ei (Anteil)', { max: 1 }),
    ],
  },
  {
    id: 'muscheln',
    title: 'Muscheln, Segen und Sicht',
    note: 'Muscheln fallen von erlegten Tieren (10 % bei ebenbürtigen) und bleiben über alle Läufe. An der großen Muschel im Laichfluss verteilt man sie je Linie auf Lebenskraft, Ausdauer und Sicht: 1, 2, 4, 8 … Muscheln je Segen.',
    params: [
      field(SHELLS, 'chance', 'SHELLS.chance', 'Muschel je Tier (Wahrscheinlichkeit)', { step: 0.001, max: 1, hint: 'Für ein Tier, das so stark ist wie du. Stärkere öfter, schwächere seltener (siehe unten).' }),
      field(SHELLS, 'relMin', 'SHELLS.relMin', 'Schwache Beute: höchstens so viel seltener (Faktor)', { step: 0.05, max: 1 }),
      field(SHELLS, 'relMax', 'SHELLS.relMax', 'Starke Beute: höchstens so viel öfter (Faktor)', { step: 0.1, min: 1 }),
      field(UPGRADES, 'max', 'UPGRADES.max', 'Höchstens so viele Segen je Linie', { min: 0, max: 30 }),
      field(UPGRADES, 'first', 'UPGRADES.first', 'Der erste Segen kostet so viele Muscheln', { min: 1 }),
      field(UPGRADES, 'factor', 'UPGRADES.factor', 'Jeder weitere: so viel mal so viele', { step: 0.1, min: 1, hint: '1 und 2 → 1, 2, 4, 8 … (gleich, wofür)' }),
      field(UPGRADES, 'hp', 'UPGRADES.hp', 'Lebenskraft je Segen (Anteil)', { step: 0.005, max: 1 }),
      field(UPGRADES, 'hpSize', 'UPGRADES.hpSize', 'Größerer Körper je Segen in Lebenskraft (Anteil)', { step: 0.002, max: 0.2 }),
      field(UPGRADES, 'sight', 'UPGRADES.sight', 'Sicht zu Beginn (Anteil des Bildes)', { step: 0.05, max: 1 }),
      field(UPGRADES, 'sightPer', 'UPGRADES.sightPer', 'Sicht je Segen', { step: 0.01, max: 1 }),
      field(SIGHT, 'front0', 'SIGHT.front0', 'Sicht nach vorn: Grundstück (Anteil der Weite)', { step: 0.02, max: 1 }),
      field(SIGHT, 'fade', 'SIGHT.fade', 'Rand der Sicht: so lang ist der Übergang (Anteil der Weite)', { step: 0.01, max: 1 }),
      field(SIGHT, 'depth', 'SIGHT.depth', 'Ganz in der Tiefe reicht der Blick so weit (Faktor)', { step: 0.02, max: 1.5 }),
      field(SIGHT, 'dark', 'SIGHT.dark', 'Hinter dem Rand so dunkel (nah an der Oberfläche)', { step: 0.05, max: 1 }),
      field(SIGHT, 'darkDeep', 'SIGHT.darkDeep', 'Hinter dem Rand so dunkel (in der Tiefe)', { step: 0.05, max: 1 }),
      field(STAMINA, 'perBlessing', 'STAMINA.perBlessing', 'Ein Segen gibt (Anteil eines Kreises)', { step: 0.05, max: 2 }),
      field(STAMINA, 'max', 'STAMINA.max', 'Höchstens so viele Kreise', { min: 1, max: 3 }),
      field(STAMINA, 'sprint', 'STAMINA.sprint', 'Ein Kreis reicht für so viele Sekunden Spurt', { step: 0.1, min: 0.5 }),
    ],
  },
  {
    id: 'leben',
    title: 'Leben',
    note: 'Sekunden aktiven Lebens. Spätere Generationen leben länger (je Verdopplung der Generation).',
    params: [
      field(LIFE, 'mature', 'LIFE.mature', 'Bis zur Laichzeit (Sekunden, Generation 1)'),
      field(LIFE, 'maturePerDoubling', 'LIFE.maturePerDoubling', '… länger je Verdopplung'),
      field(LIFE, 'rest', 'LIFE.rest', 'Danach noch (Sekunden, Generation 1)'),
      field(LIFE, 'restPerDoubling', 'LIFE.restPerDoubling', '… länger je Verdopplung'),
      field(LIFE, 'hatch', 'LIFE.hatch', 'Größe beim Schlüpfen (Anteil)', { max: 1 }),
      field(LIFE, 'adult', 'LIFE.adult', 'Ausgewachsen ab (Anteil der Größe)', { max: 1 }),
      field(LIFE, 'oldFrac', 'LIFE.oldFrac', 'Alt ab (Anteil der Restzeit)', { max: 1 }),
      field(LIFE, 'oldSpeed', 'LIFE.oldSpeed', 'Im Alter: weniger Tempo (Anteil)', { max: 1 }),
      field(LIFE, 'oldEndurance', 'LIFE.oldEndurance', 'Im Alter: weniger Ausdauer (Anteil)', { max: 1 }),
      field(LIFE, 'oldRecover', 'LIFE.oldRecover', 'Im Alter: langsamere Erholung (Anteil)', { max: 1 }),
      field(LIFE, 'oldHp', 'LIFE.oldHp', 'Im Alter: weniger Lebenskraft (Anteil)', { max: 1 }),
      field(LIFE, 'fadeSeconds', 'LIFE.fadeSeconds', 'Am Ende langsamer: die letzten … Sekunden'),
      field(LIFE, 'fadeTo', 'LIFE.fadeTo', '… bis auf (Anteil des Tempos)', { max: 1 }),
      field(MISC, 'restHealCap', 'MISC.restHealCap', 'Ausruhen heilt bis (Anteil)', { max: 1 }),
      field(MISC, 'regenRest', 'MISC.regenRest', 'Heilen beim Treiben (Anteil je Sekunde)', { step: 0.001, max: 1 }),
      field(MISC, 'regenSlow', 'MISC.regenSlow', 'Heilen beim langsamen Schwimmen (Anteil je Sekunde)', { step: 0.001, max: 1 }),
      field(MISC, 'healBite', 'MISC.healBite', 'Ein Heilkraut heilt (Anteil)', { max: 1 }),
    ],
  },
  {
    id: 'vererbung',
    title: 'Vererbung',
    note: 'Wie stark sich die Nachkommen je Generation verändern.',
    params: [
      field(INHERIT, 'points', 'INHERIT.points', 'Punktebudget vor Varianz'),
      field(INHERIT, 'defeats', 'INHERIT.defeats', 'Ebenbürtige Siege für das volle Fleischbudget'),
      field(INHERIT, 'swimDistance', 'INHERIT.swimDistance', 'Strecke für den vollen Längenzuwachs'),
      field(INHERIT, 'lengthStep', 'INHERIT.lengthStep', 'Längenzuwachs je Generation (Anteil)'),
      field(INHERIT, 'massStep', 'INHERIT.massStep', 'Gewichtszuwachs in voller Tiefe (Anteil)'),
      field(INHERIT, 'carry', 'INHERIT.carry', 'Im Leben Angesammeltes geht weiter (Anteil)', { max: 1 }),
      field(INHERIT, 'partner', 'INHERIT.partner', 'Vom Partner (Anteil)', { max: 1 }),
      field(INHERIT, 'vary', 'INHERIT.vary', 'Varianz des Zugewinns je Ei (± Anteil)', { max: 0.5 }),
      field(INHERIT.step, 'diet', 'INHERIT.step.diet', 'Kost je Generation höchstens'),
      field(INHERIT.step, 'carry', 'INHERIT.step.carry', 'Angesammeltes je Generation höchstens'),
      field(FOOD.meat, 'kcal', 'FOOD.meat.kcal', 'Nährwert Fleisch (für die Kost)'),
      field(FOOD.plant, 'kcal', 'FOOD.plant.kcal', 'Nährwert Pflanzen (für die Kost)'),
    ],
  },
  {
    id: 'tier',
    title: 'Eigenes Tier (erster Fisch)',
    note: 'Grundwerte, bevor Wachstum, Alter und Vererbung wirken.',
    params: [
      field(fish, 'hp', 'CLASSES.fish.hp', 'Lebenskraft'),
      field(fish, 'bite', 'CLASSES.fish.bite', 'Biss'),
      field(fish, 'ram', 'CLASSES.fish.ram', 'Stoß'),
      field(fish, 'speed', 'CLASSES.fish.speed', 'Tempo'),
    ],
  },
  {
    id: 'alle',
    title: 'Alle Tiere',
    note: 'Faktoren auf die Werte jeder Art (1 = wie eingestellt).',
    params: [
      field(ANIMALS, 'hp', 'ANIMALS.hp', 'Lebenskraft ×', { step: 0.05 }),
      field(ANIMALS, 'dmg', 'ANIMALS.dmg', 'Biss ×', { step: 0.05 }),
      field(ANIMALS, 'speed', 'ANIMALS.speed', 'Tempo ×', { step: 0.05 }),
      field(ANIMALS, 'atkSpeed', 'ANIMALS.atkSpeed', 'Tempo beim Angriff ×', { step: 0.05 }),
    ],
  },
  {
    id: 'biss',
    title: 'Biss der Jäger',
    note: 'Rot werden (ausholen) → kurz schneller schwimmen (vorschnellen, Maul weit auf) → zuschnappen → erholen. Schaden nur im Maul.',
    params: [
      field(BITE, 'reach', 'BITE.reach', 'Setzt an, so weit vor dem Maul (Bildpunkte)', { step: 5 }),
      field(BITE, 'wind', 'BITE.wind', 'Ausholen (Sekunden)', { step: 0.02 }),
      field(BITE, 'windBig', 'BITE.windBig', '… große Räuber (Sekunden)', { step: 0.02 }),
      field(BITE, 'dash', 'BITE.dash', 'Vorschnellen (Sekunden)', { step: 0.02 }),
      field(BITE, 'long', 'BITE.long', 'Weiter Vorstoß der Großen: so viel länger', { step: 0.1 }),
      field(BITE, 'speed', 'BITE.speed', 'Tempo beim Vorschnellen (× Angriffstempo)', { step: 0.1 }),
      field(BITE, 'rec', 'BITE.rec', 'Erholen (Sekunden)', { step: 0.02 }),
      field(BITE, 'rest', 'BITE.rest', 'Bis zum nächsten Biss (ms)', { step: 50 }),
      field(BITE, 'restBig', 'BITE.restBig', '… große Räuber (ms)', { step: 50 }),
      field(BITE, 'spread', 'BITE.spread', 'Streuung jeder Phase (±Anteil)', { step: 0.02, max: 0.6, hint: 'Jede Phase dauert zufällig so viel länger oder kürzer – damit man die Jäger nicht nach dem Takt ausspielen kann.' }),
      field(BITE, 'quickChance', 'BITE.quickChance', 'So oft ein schneller Biss', { step: 0.05, max: 1, hint: 'Dann holt er nur quick × so lange aus.' }),
      field(BITE, 'pauseChance', 'BITE.pauseChance', 'So oft eine längere Pause', { step: 0.05, max: 1, hint: 'Dann wartet er pauseMin … pauseMax ms länger bis zum nächsten Biss.' }),
      field(BITE, 'aim', 'BITE.aim', 'Gelenkt nur am Anfang des Vorstoßes (Anteil)', { step: 0.05, max: 1, hint: 'Danach ist der Biss entschieden: Wer jetzt zur Seite schwimmt, entkommt.' }),
    ],
  },
  {
    id: 'gruppe',
    title: 'Gruppe',
    params: [
      field(SWARM, 'cap', 'SWARM.cap', 'Höchstens auf einen Ruf'),
      field(SWARM, 'capPlus', 'SWARM.capPlus', '… mehr mit vollem Zusammenhalt'),
      field(SWARM, 'growEvery', 'SWARM.growEvery', 'Neuer Artgenosse je geteilter Beute'),
      field(SWARM, 'dmg', 'SWARM.dmg', 'Angriffskraft eines Artgenossen (Anteil)', { max: 1 }),
      field(SWARM, 'dmgPlus', 'SWARM.dmgPlus', '… mehr mit vollem Zusammenhalt', { max: 1 }),
      field(SWARM, 'cooldown', 'SWARM.cooldown', 'Wieder rufen nach (ms)', { step: 500 }),
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
