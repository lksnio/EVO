import { LIFE, SPAWN, WORLD } from '../data/life';
import { clamp } from '../util/math';

// Der Lebenszyklus als reine Rechnung (ohne Phaser): Wachstum, Alter, Laichbereitschaft und die Weltzeit. Der Client nutzt
// sie heute, der Server später genauso – deshalb steht hier nichts, was einen Browser braucht.

/** Wie sehr Wachstum und Alter gerade wirken: grow = Anteil der ausgewachsenen Größe, old = wie weit das Alter fortgeschritten ist. */
export interface LifeK {
  grow: number;
  old: number;
}

/** ein ausgewachsenes Tier in den besten Jahren (für Vergleiche, Artgenossen und Nachkommen-Vorschau) */
export const ADULT: LifeK = { grow: 1, old: 0 };

/** Die Abschnitte eines Lebens (Sekunden) in Generation gen: ausgewachsen (Laichzeit), alt, Ende. Logarithmisch länger. */
export function phases(gen = 1) {
  const g = Math.log2(Math.max(1, gen));
  const mature = LIFE.mature + LIFE.maturePerDoubling * g;
  const rest = LIFE.rest + LIFE.restPerDoubling * g;
  return { mature, old: mature + LIFE.oldFrac * rest, span: mature + rest };
}

/** Größe (Anteil der ausgewachsenen) nach age Sekunden: schnell am Anfang, dann immer langsamer – sie nähert sich der vollen Größe. */
export function growthAt(age: number, gen = 1) {
  const tau = phases(gen).mature / Math.log((1 - LIFE.hatch) / (1 - LIFE.adult));
  return 1 - (1 - LIFE.hatch) * Math.exp(-Math.max(0, age) / tau);
}

/** Wie weit das Alter fortgeschritten ist (0 = noch nicht alt … 1 = am Ende des Lebens). */
export function oldAt(age: number, gen = 1) {
  const P = phases(gen);
  return clamp((age - P.old) / (P.span - P.old), 0, 1);
}

export const lifeK = (age: number, gen = 1): LifeK => ({ grow: growthAt(age, gen), old: oldAt(age, gen) });

export type Stage = 'jung' | 'heran' | 'adult' | 'alt';

export const STAGE_NAME: Record<Stage, string> = { jung: 'Jungtier', heran: 'Heranwachsend', adult: 'Ausgewachsen', alt: 'Alt' };

export function stageOf(age: number, gen = 1): Stage {
  const P = phases(gen);
  if (age >= P.old) return 'alt';
  if (age >= P.mature) return 'adult';
  if (age >= P.mature * 0.35) return 'heran';
  return 'jung';
}

export const isAdult = (age: number, gen = 1) => age >= phases(gen).mature;

/** Am Ende des Lebens: Tod durch Altersschwäche. */
export const diesOfAge = (age: number, gen = 1) => age >= phases(gen).span;

// ---------------------------------------------------------------- Laichen

export type SpawnBlock = 'jung' | 'hunger' | 'nahrung' | 'pause' | 'ort' | 'grund' | 'gelege';

/** Was noch fehlt, um zu laichen (in Worten, für die Tafel). */
export const SPAWN_BLOCK: Record<SpawnBlock, string> = {
  jung: 'noch nicht ausgewachsen',
  hunger: 'der Magen ist zu leer',
  nahrung: 'zu wenig gefressen für Nachwuchs',
  pause: 'gerade erst gelaicht',
  ort: 'nur im Laichfluss',
  grund: 'dicht am Grund',
  gelege: 'an einem frischen Gelege eines Weibchens',
};

/**
 * So viel Nahrung braucht ein Nachkomme – beim ersten Fisch SPAWN.perYoung, schwerere Tiere brauchen mehr.
 * weight: Gewicht des ausgewachsenen Tiers im Verhältnis zum ersten Fisch.
 */
export const broodBase = (weight = 1) => Math.round(SPAWN.perYoung * Math.pow(Math.max(0.1, weight), SPAWN.perYoungExp));

/** So voll muss der Magen zum Laichen mindestens sein (Anteil): beim ersten Fisch kaum, bei schweren Tieren mehr. */
export const spawnMinFood = (weight = 1) => clamp(SPAWN.minFood * Math.pow(Math.max(0.1, weight), SPAWN.minFoodExp), SPAWN.minFood, SPAWN.minFoodMax);

/** So viele Nachkommen bringt die Nahrung eines Lebens (fed) bei diesem Grundwert (base). */
export const youngOf = (fed: number, base: number) => clamp(Math.floor(Math.max(0, fed) / Math.max(1, base)), 0, SPAWN.maxYoung);

/** Für die Tafel: was gefressen wurde, was ein Nachkomme braucht, wie viele es werden – und wer im Gelege noch wartet. */
export function broodText(fed: number, base: number, siblings = 0) {
  const n = youngOf(fed, base);
  const wait = siblings ? ` · ${siblings} Geschwister im Gelege` : '';
  return `${Math.floor(fed)} gefressen · je ${base} ein Nachkomme → ${n}${wait}`;
}

/**
 * Kann dieses Tier jetzt laichen? Gibt den ersten Hinderungsgrund zurück (oder null). Wo gelaicht werden darf
 * (im Laichfluss) und ob man am rechten Fleck ist – Weibchen dicht am Grund, Männchen an einem frischen Gelege –,
 * entscheidet der Aufrufer (atGround). Ohne genug Nahrung für wenigstens einen Nachkommen (fed, base) geht es nicht.
 */
export function spawnBlock(o: {
  age: number; gen?: number; food: number; minFood?: number; fed?: number; base?: number; lastSpawn: number; inGrounds: boolean; atGround: boolean; male?: boolean;
}): SpawnBlock | null {
  if (!isAdult(o.age, o.gen)) return 'jung';
  if (o.food < (o.minFood ?? SPAWN.minFood)) return 'hunger';
  if (o.fed !== undefined && o.base !== undefined && youngOf(o.fed, o.base) < 1) return 'nahrung';
  if (o.age - o.lastSpawn < SPAWN.cooldown) return 'pause';
  if (!o.inGrounds) return 'ort';
  if (!o.atGround) return o.male ? 'gelege' : 'grund';
  return null;
}

// ---------------------------------------------------------------- Weltzeit

/** So weit geht die Uhr des Rechners gegenüber der des Servers nach (ms) – ohne Server 0. */
let serverOffset = 0;

/** Die Uhr des Servers ist bekannt (beim Betreten eines Ortes): Ab jetzt zählt sie für die Weltzeit. */
export function setServerClock(serverNow: number, localNow = Date.now()) {
  if (Number.isFinite(serverNow)) serverOffset = serverNow - localNow;
}

/** Jetzt – nach der Uhr des Servers, sobald es eine gibt (ms seit 1970). */
export const worldNow = () => Date.now() + serverOffset;

/** Sekunden Weltzeit seit Beginn der Welt – für alle gleich (nach der Uhr des Servers, offline nach der des Rechners). */
export function worldSeconds(now = worldNow()) {
  return (now - WORLD.start) / 1000;
}

/** "vor … Jahren": Die Jahre laufen mit der Weltzeit rückwärts – bis zum Ende des Zeitalters. */
export function worldYears(from: number, to: number, now = worldNow()) {
  return clamp(from - Math.max(0, worldSeconds(now)) * WORLD.yearsPerSecond, to, from);
}

/** Wo im wiederkehrenden Ablauf eines Zeitalters (0 … 1) die Welt gerade steht: Ereignisse kommen für alle zugleich wieder. */
export function cyclePhase(cycleSeconds: number, now = worldNow()) {
  const s = worldSeconds(now);
  return (((s % cycleSeconds) + cycleSeconds) % cycleSeconds) / cycleSeconds;
}
