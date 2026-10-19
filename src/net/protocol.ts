// Was Client und Server einander schicken – ohne Abhängigkeiten, damit beide Seiten es nutzen können.
//
// Meilenstein 1: Jeder Client bewegt seinen Fisch selbst und meldet die Lage; der Server prüft sie (Tempo, Grenzen des
// Ortes) und verteilt sie an alle im selben Ort. Später rechnet der Server Bewegung, Kampf und Leben selbst.

/** Name des Raums: ein Raum je Ort und Zeitalter (siehe zoneId). */
export const ZONE_ROOM = 'zone';

/** So oft (je Sekunde) meldet ein Client die Lage seines Fisches. */
export const SEND_HZ = 15;

/** So weit zurück (ms) zeigt ein Client die anderen Fische – dazwischen wird geglättet. */
export const INTERP_MS = 110;

/** Schneller schwimmt kein Fisch (Bildpunkte je Sekunde, mit Stoß und Strömung) – was schneller ist, ist ein Fehler. */
export const MAX_SPEED = 1400;

/** So viel Strecke (Bildpunkte) darf sich ansammeln: ein kurzer Ruck nach einem Hänger ist erlaubt, ein Sprung nicht. */
export const MOVE_BURST = 900;

/** So lange (s) hält der Server den Platz eines Spielers, dessen Verbindung abriss. */
export const RECONNECT_S = 20;

/** Was der Fisch gerade tut (für die Darstellung bei den anderen). */
export const ANIM = { swim: 0, idle: 1, dash: 2, bite: 3, ram: 4, dead: 5 } as const;
export type AnimId = (typeof ANIM)[keyof typeof ANIM];

/** Der Raum eines Ortes: Zeitalter und Ort. */
export const zoneId = (epoch: number, place: string) => `${epoch}/${place}`;

/** Beim Betreten: wer man ist, wie man aussieht, wo man ist. */
export interface JoinOptions {
  zone: string;
  name: string;
  /** Aussehen (JSON eines Morph) */
  look: string;
  gen: number;
  x: number;
  y: number;
}

/** Client → Server, SEND_HZ-mal je Sekunde */
export interface PosMsg {
  x: number;
  y: number;
  facing: number;
  anim: number;
  size: number;
}

/** Client → Server, wenn sich das Aussehen sichtbar ändert (Wachstum, neue Generation) */
export interface LookMsg {
  look: string;
  gen: number;
}

/** Server → Client nach dem Betreten: die Uhr des Servers (für die gemeinsame Weltzeit) */
export interface WelcomeMsg {
  now: number;
  you: string;
}

/** Server → Client: Die gemeldete Lage war unmöglich – hier ist der Fisch wirklich. */
export interface SnapMsg {
  x: number;
  y: number;
}

/** Ein Spielername: kurz, ohne Steuerzeichen. */
export function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 18);
}
