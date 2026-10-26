import { H, LEVEL_ZOOM, W } from '../config';

// Das Laichduell: ein Minispiel zu zweit, das in der Höhle links im Laichfluss (Devon) beginnt – als reine Rechnung ohne
// Phaser, damit Server (server/DuelRoom.ts) und Spiel (scenes/DuelScene.ts) dieselben Regeln haben.
//
// Das Becken ist genau ein Bildschirm groß (so weit, wie man im Spiel unter Wasser sieht). Links ist es steinig (mit einer
// Höhle), in der Mitte freies Wasser, rechts wachsen Pflanzen. Oben zieht eine Strömung von links nach rechts, unten eine
// von rechts nach links. Beide beginnen als Urfisch (der eine links, der andere rechts) und können laichen: Das kostet die
// Hälfte der Lebenskraft, und nach DUEL.hatch Sekunden schlüpft aus dem Laich ein neuer Fisch – das alte Tier stirbt, man
// spielt den neuen weiter, mit voller Lebenskraft. Er gehört zum Gebiet, in dem sein Laich zuletzt lag (Stein, Wasser,
// Pflanze) – die Strömung kann den Laich dabei in ein anderes Gebiet tragen. Stein schlägt Wasser, Wasser schlägt Pflanze,
// Pflanze schlägt Stein. Wer stirbt, ohne dass Laich von ihm liegt, hat die Runde verloren.

/** Element eines Fisches: der Urfisch (base) und die drei Gebiete des Beckens. */
export type Elem = 'base' | 'stone' | 'water' | 'plant';
export const ELEMS: readonly Elem[] = ['base', 'stone', 'water', 'plant'];

/** Alle Zahlen des Duells (veränderbar – die Tests verkürzen damit z. B. die Zeit bis zum Schlüpfen). */
export const DUEL = {
  /** Lebenskraft jedes Fisches im Duell (beim Schlüpfen wieder voll) */
  hp: 20,
  /** so viele Sekunden nach dem Laichen schlüpft der neue Fisch */
  hatch: 20,
  /** Schaden je Biss: gewöhnlich, gegen das unterlegene Element, gegen das überlegene */
  dmg: 2,
  strong: 5,
  weak: 1,
  /** so lange (ms) kann ein getroffener Fisch nicht noch einmal getroffen werden */
  guard: 700,
  /** so oft (ms) darf ein Fisch höchstens zubeißen (der Server prüft es) */
  biteEvery: 300,
  /** so weit (Bildpunkte, von Mitte zu Mitte) darf der Gegner beim Biss höchstens weg sein (großzügig wegen des Netzes) */
  reach: 230,
  /** Strömung: so schnell treibt Laich mit (Bildpunkte je Sekunde) – und so stark schiebt sie einen Fisch */
  eggDrift: 70,
  push: 110,
  /** Countdown vor dem Start (s) und wie lange auf den zweiten Spieler gewartet wird (s) */
  count: 3,
  joinWait: 45,
  /** Belohnung: Anteil der Nahrung, die das eigene Tier für einen Nachkommen braucht (aufgerundet) */
  win: 0.25,
  lose: 0.1,
};

/** Das Becken: ein Bildschirm bei der Kamera des Spiels, Oberfläche und Grund wie im Meer. */
export const ARENA = (() => {
  const w = Math.round(W / LEVEL_ZOOM), h = Math.round(H / LEVEL_ZOOM);
  const surface = 56, floor = h - 84;
  const band = (floor - surface) * 0.28;
  return {
    w,
    h,
    surface,
    floor,
    /** die beiden Strömungen: oben nach rechts, unten nach links */
    currents: [
      { y0: surface + 26, y1: surface + 26 + band, dir: 1 },
      { y0: floor - band, y1: floor, dir: -1 },
    ] as const,
  };
})();

/** Das Gebiet bei x: links Stein, in der Mitte Wasser, rechts Pflanzen. */
export function elemAt(x: number): Exclude<Elem, 'base'> {
  return x < ARENA.w / 3 ? 'stone' : x > (ARENA.w * 2) / 3 ? 'plant' : 'water';
}

/** Wer wen schlägt: Stein → Wasser → Pflanze → Stein (wie Schere, Stein, Papier). Der Urfisch schlägt niemanden. */
export const BEATS: Record<Elem, Elem | null> = { stone: 'water', water: 'plant', plant: 'stone', base: null };

/** Schaden eines Bisses von att an def. */
export function duelDamage(att: Elem, def: Elem): number {
  if (BEATS[att] === def) return DUEL.strong;
  if (BEATS[def] === att) return DUEL.weak;
  return DUEL.dmg;
}

/** Die Strömung in der Höhe y: 1 nach rechts, -1 nach links, 0 keine. */
export function flowAt(y: number): number {
  for (const c of ARENA.currents) if (y >= c.y0 && y <= c.y1) return c.dir;
  return 0;
}

/** Laich treibt mit der Strömung (am Rand bleibt er liegen). */
export function driftEgg(e: { x: number; y: number }, dt: number) {
  e.x = Math.max(60, Math.min(ARENA.w - 60, e.x + flowAt(e.y) * DUEL.eggDrift * dt));
}

/** Wo ein Fisch beginnt: Seite 0 links, 1 rechts. */
export function duelStart(side: number) {
  return { x: side ? ARENA.w - 300 : 300, y: Math.round(ARENA.surface + (ARENA.floor - ARENA.surface) * 0.5) };
}

/** Lebenskraft nach dem Laichen: Die Hälfte der jetzigen geht verloren (aufgerundet bleibt wenigstens 1). */
export const afterLay = (hp: number) => Math.max(1, Math.ceil(hp / 2));

/** Die Belohnung: so viel Nahrung für Sieger bzw. Verlierer (aufgerundet auf ganze Zahlen). */
export const duelReward = (perYoung: number, won: boolean) => Math.ceil(Math.max(0, perYoung) * (won ? DUEL.win : DUEL.lose));

/** Farbe eines Gebiets (für den Laich, der sie ein wenig annimmt, und die Anzeige). */
export const ELEM_COLOR: Record<Elem, number> = { base: 0xe8c4c0, stone: 0x9a9080, water: 0x5fb0e6, plant: 0x6fcf52 };
export const ELEM_NAME: Record<Elem, string> = { base: 'Urfisch', stone: 'Steinfisch', water: 'Wasserfisch', plant: 'Pflanzenfisch' };
