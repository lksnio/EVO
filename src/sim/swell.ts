// ---------------------------------------------------------------------------
// Der Seegang: eine gemeinsame Bewegung für das ganze Wasser. Wenige Wellenzüge verschiedener Länge laufen gegeneinander
// und mit verschiedenem Tempo über die Oberfläche – als Gerstner-Wellen: Die Kämme sind schmal und spitz, die Täler breit
// und flach, wie bei echtem Wasser. Weil die Längen nicht zueinander passen und eine langsame Dünung (Wellengruppen) die
// Höhe hebt und senkt, wiederholt sich das Bild praktisch nie und ist nie spiegelgleich.
//
// Dieselbe Rechnung treibt alles, was sich im Wasser bewegt:
//   – die Oberfläche selbst (surface),
//   – das Wasser darunter: Jedes Teilchen kreist mit den Wellen, nach unten immer weniger (orbit) – Schwebeteilchen wiegen
//     sich darum im Takt der Oberfläche,
//   – das Licht: Unter einem Wellenkamm bündelt sich das Sonnenlicht wie unter einer Linse (focus) – Lichtbahnen und
//     Lichtsaum flackern im Takt der Wellen, die über sie hinweglaufen.
// Alles ist eine Handvoll Sinus-Rechnungen je Punkt: keine Texturen, keine Teilchen, nichts, was mit der Zeit mehr wird.
// ---------------------------------------------------------------------------

export interface Wave {
  /** Wellenlänge (Bildpunkte der Welt) */
  len: number;
  /** Höhe (halbe Höhe vom Tal zum Kamm, Bildpunkte) */
  amp: number;
  /** Tempo (Bildpunkte je Sekunde); das Vorzeichen ist die Laufrichtung */
  speed: number;
  /** Phase (Bogenmaß) */
  phase: number;
  /**
   * Steilheit (Gerstner, 0 … 0,75): wie stark sich das Wasser zum Kamm hin zusammenschiebt. Die Summe aller Wellen bleibt so
   * auch in einer hohen Wellengruppe unter der Grenze, an der sich die Oberfläche überschlagen würde.
   */
  steep: number;
}

export const SWELL = {
  /** Die Wellenzüge: eine lange Dünung, zwei mittlere Wellen, die gegeneinander laufen, und ein kurzes Gekräusel */
  waves: [
    { len: 1180, amp: 4.2, speed: 46, phase: 0, steep: 0.35 },
    { len: 560, amp: 4.6, speed: 33, phase: 1.7, steep: 0.7 },
    { len: 330, amp: 2.4, speed: -24, phase: 4.1, steep: 0.55 },
    { len: 170, amp: 1.2, speed: 17, phase: 2.6, steep: 0.4 },
  ] as Wave[],
  /** Wellengruppen: Die Höhe schwankt langsam um ± diesen Anteil – mal läuft eine stärkere Folge durch, mal ist es ruhiger … */
  group: 0.32,
  /** … über diese Länge (Bildpunkte) und in dieser Zeit (Sekunden) */
  groupLen: 2900,
  groupPeriod: 31,
  /**
   * Wie tief die Bewegung ins Wasser reicht: Unter einer Welle kreist das Wasser, nach unten immer schwächer (wie e^(−k·z));
   * hier gestreckt, damit man es im Bild auch weiter unten noch spürt (1 = wie in echtem tiefem Wasser).
   */
  reach: 3.2,
  /** Ganz unten hört es nicht ganz auf: eine träge Dünung am Grund (Bildpunkte, Sekunden) */
  surge: 5,
  surgePeriod: 11,
  /** So stark bündelt ein Kamm das Licht (Anteil um den Mittelwert) */
  focus: 1,
  /** So weit neigen sich Pflanzen mit dem Wasser (Grad je Bildpunkt, den das Wasser an ihrer Stelle hin und her schiebt) */
  lean: 0.5,
};

const TAU = Math.PI * 2;

/** Die Höhe der Wellengruppe an dieser Stelle (um 1 herum). */
function groupAt(x: number, t: number) {
  return 1 + SWELL.group * Math.sin(TAU * (x / SWELL.groupLen - t / SWELL.groupPeriod));
}

function theta(w: Wave, x: number, t: number) {
  return (TAU / w.len) * (x - w.speed * t) + w.phase;
}

/**
 * Wie sich die Oberfläche an der Stelle x (Welt) zur Zeit t (Sekunden) verschiebt: dx waagrecht (zum Kamm hin), dy
 * senkrecht (negativ = höher, wie auf dem Bildschirm). strength skaliert alles (ruhige Orte < 1).
 */
export function surface(x: number, t: number, strength = 1) {
  const g = groupAt(x, t) * strength, n = SWELL.waves.length;
  let dx = 0, dy = 0;
  for (const w of SWELL.waves) {
    const th = theta(w, x, t), k = TAU / w.len;
    // Gerstner: Die Punkte rücken zum Kamm (θ = 0) zusammen – der Kamm wird schmal und spitz, das Tal breit. Die waagrechte
    // Verschiebung hängt an der Wellenlänge, nicht an der Höhe (so bleibt die Form bei jeder Höhe ohne Überschlag).
    dx -= (w.steep * g / (k * n)) * Math.sin(th);
    dy -= w.amp * g * Math.cos(th);
  }
  return { dx, dy };
}

/** Die größte mögliche Auslenkung der Oberfläche nach oben bzw. unten (Bildpunkte, bei strength 1). */
export function surfaceReach() {
  return SWELL.waves.reduce((s, w) => s + w.amp, 0) * (1 + SWELL.group);
}

/**
 * Wie sich ein Wasserteilchen depth Bildpunkte unter der Oberfläche bewegt (Auslenkung, Bildpunkte): Es kreist mit den
 * Wellen darüber, nach unten immer schwächer – und ganz unten bleibt eine träge Dünung.
 */
export function orbit(x: number, depth: number, t: number, strength = 1) {
  const g = groupAt(x, t) * strength;
  const z = Math.max(0, depth);
  let dx = 0, dy = 0;
  for (const w of SWELL.waves) {
    const th = theta(w, x, t), a = w.amp * g * Math.exp((-TAU / w.len) * z / SWELL.reach);
    dx -= a * Math.sin(th);
    dy -= a * Math.cos(th);
  }
  // die träge Dünung am Grund: Sie schiebt alles langsam hin und her (etwas schief, nie ganz waagrecht)
  const s = Math.sin(TAU * (t / SWELL.surgePeriod - x / 5200));
  dx += SWELL.surge * strength * s;
  dy += SWELL.surge * strength * 0.25 * Math.sin(TAU * (t / SWELL.surgePeriod) * 1.37 + x / 900);
  return { dx, dy };
}

/**
 * Wie sehr sich das Licht unter der Stelle x bündelt (0 … 1, Mittel etwa 0,5): Unter einem Kamm wirkt die Oberfläche wie eine
 * Sammellinse (hell), unter einem Tal wie eine Zerstreuungslinse (dunkler). minLen: nur Wellen ab dieser Länge zählen – breite
 * Lichtbahnen spüren nur die langen Wellen, ein feiner Lichtsaum auch das Gekräusel.
 */
export function focus(x: number, t: number, minLen = 0, strength = 1) {
  const g = groupAt(x, t) * strength;
  let c = 0, norm = 0;
  for (const w of SWELL.waves) {
    if (w.len < minLen) continue;
    const k = TAU / w.len, curv = w.amp * k * k;
    // Krümmung der Oberfläche (zweite Ableitung der Höhe): am Kamm nach unten gewölbt – dort sammelt sich das Licht
    c += curv * g * Math.cos(theta(w, x, t));
    norm += curv * (1 + SWELL.group);
  }
  if (!norm) return 0.5;
  const f = 0.5 + 0.5 * SWELL.focus * (c / norm);
  return Math.min(1, Math.max(0, f));
}

/**
 * Wie weit sich eine Pflanze an der Stelle (x, y) gerade mit dem Wasser neigt (Grad): Das Wasser darüber schiebt sie im Takt
 * des Seegangs hin und her – nebeneinander stehende Pflanzen folgen derselben Welle, ein Stück versetzt.
 */
export function lean(x: number, y: number, surfaceY: number, t: number, strength = 1) {
  return orbit(x, y - surfaceY, t, strength).dx * SWELL.lean;
}

/** Wie stark der Seegang an einem Ort ist: Im geschützten Laichfluss ist es ruhiger. */
export function swellAt(kind: string) {
  return kind === 'start' ? 0.7 : 1;
}
