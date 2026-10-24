// Was Client und Server einander schicken – ohne Abhängigkeiten, damit beide Seiten es nutzen können.
//
// Meilenstein 1: Jeder Client bewegt seinen Fisch selbst und meldet die Lage; der Server prüft sie (Tempo, Grenzen des
// Ortes) und verteilt sie an alle im selben Ort. Später rechnet der Server Bewegung, Kampf und Leben selbst.

/** Name des Raums: ein Raum je Ort und Zeitalter (siehe zoneId). */
export const ZONE_ROOM = 'zone';

/** So oft (je Sekunde) meldet ein Client die Lage seines Fisches. */
export const SEND_HZ = 20;

/** So oft (je Sekunde) verteilt der Server die Änderungen eines Ortes. */
export const PATCH_HZ = 30;

/**
 * So weit zurück (ms) zeigt ein Client die anderen Fische mindestens – dazwischen wird geglättet. Kommen Meldungen
 * unregelmäßig, wächst die Verzögerung von selbst (bis INTERP_MAX_MS, siehe net/Interp.ts).
 */
export const INTERP_MS = 75;
export const INTERP_MAX_MS = 400;

/** Bleibt eine Meldung aus, schwimmt ein Fisch oder Tier höchstens so lange (ms) in seiner Richtung weiter. */
export const EXTRAPOLATE_MS = 150;

/** Schneller schwimmt kein Fisch (Bildpunkte je Sekunde, mit Stoß und Strömung) – was schneller ist, ist ein Fehler. */
export const MAX_SPEED = 1400;

/** So viel Strecke (Bildpunkte) darf sich ansammeln: ein kurzer Ruck nach einem Hänger ist erlaubt, ein Sprung nicht. */
export const MOVE_BURST = 900;

/** So oft (je Sekunde) meldet der Ortswächter die Tiere und das Fleisch seines Ortes. */
export const FAUNA_HZ = 10;

/** Tiere des Ortswächters werden mindestens so weit zurück (ms) gezeigt – er meldet seltener als die Spieler sich selbst. */
export const FAUNA_INTERP_MS = 130;

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
  /** Uhrzeit des Absenders (ms, performance.now) – damit die anderen die Abstände ohne das Zittern des Netzes kennen */
  t: number;
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

// ---------------------------------------------------------------- gemeinsame Tiere
//
// Ein Spieler je Ort ist Ortswächter (state.host): Sein Spiel rechnet die Tiere und das Fleisch des Ortes und meldet sie
// (fauna). Alle anderen sehen dieselben Tiere als Stellvertreter. Beißen sie zu, geht der Treffer an den Ortswächter (hit);
// beißt ein Tier einen anderen Spieler, geht der Schaden an diesen (hurt); frisst jemand vom Fleisch, erfährt es der
// Ortswächter (eat). Geht der Ortswächter, übernimmt der nächste Spieler – mit den Tieren, wie sie gerade sind.

/** Ein Tier, wie es der Ortswächter meldet. */
export interface AnimalRow {
  id: number;
  /** Art */
  sp: string;
  x: number;
  y: number;
  /** Blickrichtung (1 rechts, -1 links) */
  d: number;
  /** Neigung (Grad) */
  an: number;
  /** Lebenskraft und ihr Höchstwert */
  hp: number;
  mh: number;
  /** Größe des Exemplars */
  sz: number;
  /** Färbung (0 = keine, sonst die Farbe beim Ausholen, Aufglühen …) */
  tn: number;
  /** Deckkraft in Prozent (Ein- und Ausblenden) */
  al: number;
  /** greift gerade an (gefährlich bei Berührung) */
  at: boolean;
}

/** Ein Stück Fleisch. */
export interface MeatRow {
  /** Art und gemeinsame Beutekennung aller Brocken dieses Tiers. */
  sp?: string;
  kill?: string;
  id: number;
  x: number;
  y: number;
  /** Sättigung, die noch darin steckt */
  v: number;
  /** Größe des Stücks (0 klein … 2 groß) */
  s: number;
}

/**
 * Ortswächter → Server: geänderte Tiere und Fleischstücke, und was fort ist (gestorben: died = 1); dazu die Pflanzen, deren
 * Stand sich geändert hat (Nummer in der Reihenfolge des Weltgenerators, noch übrige Bissen). t: seine Uhrzeit (ms).
 */
export interface FaunaMsg {
  t?: number;
  a?: AnimalRow[];
  gone?: [id: number, died: number][];
  m?: MeatRow[];
  mgone?: number[];
  p?: [i: number, units: number][];
}

/** Ein Spieler beißt in eine Pflanze (→ an den Ortswächter): ihre Nummer. */
export interface PlantMsg {
  i: number;
}

/** Client → Server → Client: Wie lange braucht eine Nachricht hin und zurück? (t: Uhrzeit des Absenders) */
export interface PingMsg {
  t: number;
}

/** Ein Spieler trifft ein Tier (→ an den Ortswächter, dort mit from = wer). stun: so lange betäubt (ms). */
export interface HitMsg {
  id: number;
  dmg: number;
  kind: 'bite' | 'ram' | 'other';
  stun: number;
  from?: string;
}

/** Ein Tier des Ortswächters trifft einen anderen Spieler (to). */
export interface HurtMsg {
  /** Gegnerkennung für die lokale Schuppenwertung (ältere Clients senden sie nicht). */
  animal?: number;
  /** Aktueller Angreifer, auch wenn sein reguläres Tierpaket noch unterwegs ist. */
  attacker?: AnimalRow;
  to?: string;
  dmg: number;
  x: number;
  by: string;
}

/** Ein Spieler frisst vom Fleisch (→ an den Ortswächter). */
export interface EatMsg {
  id: number;
  amount: number;
}

/** Ein Spielername: kurz, ohne Steuerzeichen. */
export function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 18);
}

// ---------------------------------------------------------------- die gemeinsame Art (Koop)
//
// Alle Spieler eines Zeitalters teilen ihren Laich (ein Raum je Zeitalter, siehe server/SpeciesRoom.ts): Was einer laicht,
// liegt für alle da; stirbt einer, wählt er ein Ei aus dem gemeinsamen Laich. Wählt jemand ein Ei der nächsten Generation,
// beginnt sie für alle – die übrigen Geschwister sind fort, und wer noch lebt, kommt nach seinem Tod nur noch dorthin.
// Liegt kein Laich mehr da, wenn jemand stirbt, ist die Art ausgestorben – für alle.

/** Name des Raums der Art: einer je Zeitalter. */
export const SPECIES_ROOM = 'species';

/** so viele Eier hält der Laich einer Art höchstens (Geschwister und nächste Generation zusammen) */
export const SPECIES_MAX_EGGS = 2000;

/** Beim Betreten des Raums der Art. */
export interface SpeciesJoin {
  epoch: number;
  name: string;
}

/**
 * Client → Server, gleich nach dem Betreten: der eigene Laich (JSON je Ei) und die Generation der eigenen Geschwister. Gibt
 * es die Art schon, kommen nur Eier dazu, die sie noch nicht kennt (und keine aus vergangenen Generationen).
 */
export interface SpeciesHello {
  gen: number;
  pool: string[];
  next: string[];
}

/** Client → Server: gelaicht – Eier der Generation gen (die Generation des Elterntiers + 1). */
export interface SpeciesLay {
  gen: number;
  eggs: string[];
}

/** Client → Server: Dieses Ei soll schlüpfen (req: eine Nummer, die in der Antwort zurückkommt). */
export interface SpeciesPick {
  id: string;
  req: number;
}

/** Server → Client: die Antwort – das Ei (JSON) und als welche Generation es schlüpft; egg leer: schon fort. */
export interface SpeciesPicked {
  req: number;
  egg: string;
  gen: number;
  group: 'pool' | 'next';
}

/** Server → alle: Ein Spieler hat die nächste Generation begonnen. */
export interface SpeciesAdvanced {
  name: string;
  gen: number;
}

/** Client → Server → alle: Die Art ist ausgestorben (es lag kein Laich mehr da, als jemand starb). */
export interface SpeciesOver {
  name: string;
  cause: string;
  gen: number;
}
