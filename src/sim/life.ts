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

/** Zeitkonstante des Wachstums: Mit LIFE.mature Sekunden ist LIFE.adult der vollen Größe erreicht. */
const TAU = LIFE.mature / Math.log((1 - LIFE.hatch) / (1 - LIFE.adult));

/** Größe (Anteil der ausgewachsenen) nach age Sekunden: schnell am Anfang, dann immer langsamer – sie nähert sich der vollen Größe. */
export function growthAt(age: number) {
  return 1 - (1 - LIFE.hatch) * Math.exp(-Math.max(0, age) / TAU);
}

/** Wie weit das Alter fortgeschritten ist (0 = noch nicht alt … 1 = am Ende des Lebens). */
export function oldAt(age: number) {
  return clamp((age - LIFE.old) / (LIFE.span - LIFE.old), 0, 1);
}

export const lifeK = (age: number): LifeK => ({ grow: growthAt(age), old: oldAt(age) });

export type Stage = 'jung' | 'heran' | 'adult' | 'alt';

export const STAGE_NAME: Record<Stage, string> = { jung: 'Jungtier', heran: 'Heranwachsend', adult: 'Ausgewachsen', alt: 'Alt' };

export function stageOf(age: number): Stage {
  if (age >= LIFE.old) return 'alt';
  if (age >= LIFE.mature) return 'adult';
  if (age >= LIFE.mature * 0.35) return 'heran';
  return 'jung';
}

export const isAdult = (age: number) => age >= LIFE.mature;

/** Am Ende des Lebens: Tod durch Altersschwäche. */
export const diesOfAge = (age: number) => age >= LIFE.span;

// ---------------------------------------------------------------- Laichen

export type SpawnBlock = 'jung' | 'hunger' | 'pause' | 'ort' | 'grund' | 'gelege';

/** Was noch fehlt, um zu laichen (in Worten, für die Tafel). */
export const SPAWN_BLOCK: Record<SpawnBlock, string> = {
  jung: 'noch nicht ausgewachsen',
  hunger: 'zu hungrig',
  pause: 'gerade erst gelaicht',
  ort: 'nur im Laichfluss',
  grund: 'dicht am Grund',
  gelege: 'an einem frischen Gelege eines Weibchens',
};

/**
 * Kann dieses Tier jetzt laichen? Gibt den ersten Hinderungsgrund zurück (oder null). Wo gelaicht werden darf
 * (im Laichfluss) und ob man am rechten Fleck ist – Weibchen dicht am Grund, Männchen an einem frischen Gelege –,
 * entscheidet der Aufrufer (atGround).
 */
export function spawnBlock(o: { age: number; food: number; lastSpawn: number; inGrounds: boolean; atGround: boolean; male?: boolean }): SpawnBlock | null {
  if (!isAdult(o.age)) return 'jung';
  if (o.food < SPAWN.minFood) return 'hunger';
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
