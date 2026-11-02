import type { Ctx } from '../util/canvas';
import { css, mix, rgbOf, shade } from '../util/color';

// ---------------------------------------------------------------------------
// Der Tuschestil des Devons: handgezeichnete Formen mit dunkler Außenkontur, ruhige Farbflächen und wenige, harte Schatten –
// statt Verläufen, Rauschen und Glanz. Gedeckte Blau-, Grün- und Erdtöne, helle Akzente nur dort, wo das Spiel etwas zeigen
// will (Augen, Laich, Nahrung). Gilt nur für das Devon: Wer ein Tier des Devons (oder den Fisch der Spielfigur) malt, schaltet
// ihn mit withInk() ein; alle anderen Zeitalter behalten ihre Malweise (art/paint.ts fragt inkOn()).
// ---------------------------------------------------------------------------

/** die Tusche: fast schwarz, mit einem Hauch Blaugrün */
export const INK = 0x06090c;
/** die Farbe der fernen Umgebung (Wasser in der Tiefe) – Ebenen und Schatten gehen darauf zu */
export const DEEP_INK = 0x0b1a22;

let on = false;

/** Wird gerade im Tuschestil gemalt? */
export const inkOn = () => on;

/** Malt fn im Tuschestil (enable) bzw. in der bisherigen Malweise – und stellt den alten Zustand wieder her. */
export function withInk<T>(enable: boolean, fn: () => T): T {
  const prev = on;
  on = enable;
  try {
    return fn();
  } finally {
    on = prev;
  }
}

const lum = (c: number) => {
  const [r, g, b] = rgbOf(c);
  return (0.3 * r + 0.59 * g + 0.11 * b) / 255;
};

/**
 * Die Farbe ins Devon rücken: ein Stück entsättigt und zum kühlen Blaugrün des Wassers gezogen, in der Helligkeit begrenzt,
 * damit nichts grell oder tot-schwarz wird. Alle Tiere, Pflanzen und Felsen teilen so eine Farbwelt.
 */
export function grade(c: number, water = 0.14): number {
  const l = lum(c);
  const grey = mix(0x000000, 0xffffff, l);
  let o = mix(c, grey, 0.28);
  o = mix(o, 0x3f6a72, water);
  return o;
}

/**
 * Die Farbe eines Tiers: wie grade(), aber heller und etwas lebhafter – Tiere sollen sich von Gelände und Wasser abheben (die Welt
 * ist dunkel und kühl, sie sind die hellsten Flächen im Bild).
 */
export function gradeAnimal(c: number): number {
  const g = grade(c, 0.08);
  return mix(shade(g, 0.24), c, 0.2);
}

/** Die Konturfarbe zu einer Fläche: Tusche, die ein wenig von der Farbe behält. */
export const lineOf = (c: number, keep = 0.16) => mix(INK, c, keep);

/** Der Schatten zu einer Farbe: dunkler, kühler, ruhig (keine schwarze Farbe). */
export const shadowOf = (c: number, k = 0.42) => mix(shade(c, -k), 0x0c1a26, 0.22);

/** Das Licht zu einer Farbe: heller und etwas wärmer – nur als schmaler Streifen gedacht. */
export const lightOf = (c: number, k = 0.22) => mix(shade(c, k), 0xf2ecd2, 0.1);

/**
 * Die Kontur einer Form: einmal kräftig, einmal mit kleinem Versatz dünner – so wirkt die Linie wie mit der Feder gezogen, nicht
 * wie ein sauberer Computerstrich. path zeichnet nur den Weg (ohne beginPath-Pflicht der Aufrufer, er beginnt selbst).
 */
export function outline(ctx: Ctx, path: () => void, color: number, w: number, a = 1) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = css(color, a);
  ctx.lineWidth = w;
  ctx.stroke();
  // leicht versetzte, dünnere zweite Linie: ungleichmäßige Strichstärke
  ctx.translate(w * 0.16, w * 0.12);
  path();
  ctx.lineWidth = w * 0.55;
  ctx.stroke();
  ctx.restore();
}

/** Ein Linienzug mit leichtem Zittern wie von Hand (Stärke amp in Bildpunkten, wiederholbar über seed). */
export function wobble(pts: [number, number][], amp: number, seed = 1): [number, number][] {
  let s = seed * 9301 + 49297;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280 - 0.5;
  };
  return pts.map(([x, y]) => [x + r() * amp, y + r() * amp] as [number, number]);
}

// ---------------------------------------------------------------------------
// Welche Bilder die Szene gerade benutzt: Im Devon greifen Pflanzen, Laich, Muscheln und
// Bewuchs auf ihre Tusche-Fassung zu (art/inkFilter.ts), in den anderen Zeitaltern auf die bisherigen Bilder.

let world = false;

/** Zeigt die laufende Szene die Welt des Devons im Tuschestil? (Wird beim Aufbau eines Ortes gesetzt.) */
export const inkWorldOn = () => world;
export const setInkWorld = (on: boolean) => {
  world = on;
};
