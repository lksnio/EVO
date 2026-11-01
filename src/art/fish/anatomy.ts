import { FIN_UP, fishJawK, geo, type HeadGeo, type Morph } from '../creatureArt';

// ---------------------------------------------------------------------------
// Die Anatomie des Fisches: aus den Evolutionswerten (Morph) werden hier alle Maße und Ansatzpunkte bestimmt – als reine
// Rechnung ohne Phaser und ohne Malerei. Aus ihnen entstehen (paint.ts) die Zeichnungen und (rig.ts) die Verformung.
// Alle Zahlen sind „Zeicheneinheiten“ (g-Einheiten): Das Tier hat die Größe size, die Texturen und das Netz werden damit
// skaliert. Der Ursprung liegt in der Körpermitte, +x zeigt zur Schnauze, +y nach unten.
//
// Aufbau (von hinten nach vorn): Schwanzflosse – Schwanzstiel – Rumpf – Nacken – Kopf mit Oberkiefer. Rumpf und Kopf sind EINE
// Silhouette (`loop`), nur der Unterkiefer ist ein eigenes, drehbares Teil mit dem Gelenk `hinge`. Rückenflosse, Afterflosse,
// Bauchflossen und die Brustflossen sind eigene Teile, deren Ansatz unter der Körperoberfläche liegt.
// ---------------------------------------------------------------------------

export type P2 = [number, number];

/** Eine Flosse, die am Körper ansetzt: Ansatzpunkt (Körperkoordinaten), Länge und Breite in Zeicheneinheiten. */
export interface FinSpec {
  /** wie stark sie ausgeprägt ist (0 = fehlt) */
  k: number;
  shape?: 'sail' | 'shark' | 'anvil' | 'arm';
  stiffness?: number;
  /** Mitte des Ansatzes (Körperkoordinaten) */
  at: P2;
  /** Länge des Ansatzes entlang des Körpers, Höhe der Flosse */
  base: number;
  len: number;
}

export interface FishAnatomy {
  m: Morph;
  /** Starre Vorderpartie: ab hier keine Biegung, Streckung oder Stauchung. */
  rigidFrom?: number;
  jawless?: boolean;
  jawRest?: number;
  teeth?: 'none' | 'teeth' | 'blades';
  dorsal2?: FinSpec;
  /** Größe des Tiers (Faktor auf alle Zeicheneinheiten) */
  s: number;
  bw: number;
  bh: number;
  /** Tiefe des Bauchs (unterhalb der Mittellinie) */
  bb: number;
  /** Ursprung des Kopfes (Nacken) in Körperkoordinaten */
  hx: number;
  hy: number;
  hg: HeadGeo;
  /** halbe Höhe des Schwanzstiels an seinem Ende und seine Lage */
  pedH: number;
  pedX: number;
  /** Schwanzflosse: Länge, halbe Spannweite, Einkerbung, Asymmetrie (oberer Lappen länger) */
  tail: { lobe: number; spread: number; fork: number; up: number; kind?: 'shark' | 'lobed' | 'eel' };
  /** Maul: Gelenk, Spitze des Oberkiefers (Körperkoordinaten), Länge des Unterkiefers ab Gelenk */
  hinge: P2;
  tip: P2;
  jawLen: number;
  jawH: number;
  /** Stützpunkte der Silhouette: vom Maul über Stirn, Rücken, Schwanzstiel und Bauch zur Kehle */
  loop: P2[];
  /** Auge (Mitte und Radius des Rohwerts; der gezeichnete Augapfel ist etwas größer, siehe eyeBall) */
  eye: { x: number; y: number; r: number };
  /** Kopfpanzer 0 … 1: Stirn- und Wangenplatten (aus Schädel und Kopfpanzer) */
  plate: number;
  /** Rückenflosse, Afterflosse, Bauchflosse, Brustflosse */
  dorsal: FinSpec;
  anal: FinSpec;
  pelvic: FinSpec;
  pectoral: FinSpec & { lobed: boolean };
  /** Umfang des Körpernetzes (Körperkoordinaten): x0 … x1 (Schwanzflossenspitze … Schnauze), y0 … y1 */
  bounds: { x0: number; x1: number; y0: number; y1: number };
  /** Drehpunkt der Verformung: dort bleibt der Rumpf in Ruhe, nach vorn (Kopf) und hinten (Schwanz) bewegt er sich */
  anchorX: number;
  /** Beginn der Kopfzone: ab hier folgen die Netzspalten dem Kopf */
  neckX: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Die Maße eines Fisches aus seinen Evolutionswerten. */
export function fishAnatomy(m: Morph): FishAnatomy {
  const g = geo(m);
  const s = g.s, bw = g.bw, bh = g.bh;
  const bellyK = [0.9, 1, 1.08][m.belly] + (m.diet < 0 ? -m.diet * 0.05 : 0) + 0.1 * (m.girth ?? 0);
  const bb = bh * bellyK;
  const hg = g.hg;
  const hx = g.neck[0], hy = g.neck[1];
  const st = m.stealth, sk = m.skull;

  const ym = hy + hg.mouthY;
  const top = -hg.H / 2;
  const crownY = hy + top - hg.dome - 0.4;
  // der Rücken wölbt sich hinter dem Kopf zu einem flachen Buckel (die Stirn liegt etwas tiefer): kein gerader Kasten
  // Massige Formen (hoch im Verhältnis zur Länge) werden rund statt spitz: Die Rückenlinie nähert sich einer Ellipse, der Buckel hinter
  // dem Kopf flacht ab, Schulter und Bauch werden voller (fat: 0 schlank/normal … 1 kurz und hoch).
  const fat = Math.max(0, Math.min(1, (bh / bw - 0.5) / 0.85));
  const backY = Math.min(-bh * (0.64 - 0.1 * fat), crownY - 1.0 - 0.6 * (1 - fat));
  const pedH = Math.max(2.4, bh * 0.1 + 1);
  const pedX = -bw * 0.5;

  // Schwanzflosse (wie bisher; der obere Lappen ist etwas länger – wie bei den frühen Knochenfischen des Devons)
  const sw = (1 + 0.35 * (m.swift ?? 0)) * (1 + 0.8 * FIN_UP * (m.stamUp ?? 0)), tw = m.tail ?? 0, ft = m.fTail ?? 0;
  const lobe = (16 + 16 * st) * sw * (1 + 0.28 * tw) * (1 + 0.3 * ft);
  const fork = 3 + 11 * st + 6 * ft;
  const spread = (13 + 9 * st) * sw * (1 + 0.65 * tw) * (1 + 0.5 * ft);

  // der Unterkiefer reicht bis zur Kehle hinunter, damit Kinn und Hals eine Linie bilden
  // Bei starkem Gebiss sitzt die Kehle tiefer (kräftiger Vorderkopf und Kieferwurzel).
  const deepK = 1 + 0.14 * Math.min(1, fishJawK(m));
  const throat = (hg.H * 0.5 * deepK - hg.mouthY) * 0.78;
  const jawH = Math.min(Math.max(hg.jawH, throat), throat * 1.5);
  const tip: P2 = [hx + hg.L, ym - 0.2];
  const hinge: P2 = [hx + hg.hingeX, ym];

  // Die Linie von der Schulter zum Schwanzstiel: schlanke Formen laufen spindelförmig aus, massige halten eine Ellipse (Ansatz des Stiels nach
  // ein paar Einheiten wie bei einem runden Körper mit schmalem Stiel). dir −1: Rücken, +1: Bauch. Von vorn nach hinten.
  const span = hx - pedX;
  const topPeak = -backY * 0.98, botPeak = bb * (0.6 - 0.07 * fat);
  const ell = (x: number, peak: number) => {
    const xc = pedX + 0.66 * span, a = xc - pedX;
    const r = Math.max(-1, Math.min(1, (x - xc) / a));
    return pedH + (peak - pedH) * Math.sqrt(1 - r * r);
  };
  const taper = (dir: number): P2[] => {
    const peak = dir < 0 ? topPeak : botPeak;
    const base = dir < 0 ? [-pedH * 1.8, -bh * 0.32, -bh * 0.5] : [pedH * 1.7, bb * 0.34, bb * 0.5];
    const nx = [-bw * 0.15, -bw * 0.3, -bw * 0.41], fx = [pedX + 18, pedX + 11.5, pedX + 5.5];
    return [0, 1, 2].map((k): P2 => {
      const x = mix(nx[k], fx[k], fat);
      const y = mix(Math.abs(base[2 - k]), ell(x, peak), fat);
      return [x, dir * y];
    });
  };

  const loop: P2[] = [
    tip,
    [hx + hg.L * 0.94, ym - hg.snoutH * 0.55],
    [hx + hg.L * 0.74, ym - hg.snoutH * 0.97 - hg.dome * 0.3],
    [hx + hg.L * 0.42, hy + top * 0.99 - hg.dome * 0.82],
    [hx + hg.L * 0.1, crownY],
    [hx - bw * 0.1, crownY * 0.4 + backY * 0.6],
    [bw * 0.08, backY],
    ...taper(-1),
    [pedX + 1, -pedH],
    [pedX - 5, -pedH * 0.82],
    [pedX - 6, 0],
    [pedX - 5, pedH * 0.82],
    [pedX + 1, pedH],
    ...taper(1).reverse(),
    [bw * 0.08, bb * 0.55],
    [bw * 0.26, bb * 0.47],
    [hx - 0.5, hy + hg.H * 0.5 * deepK],
  ];

  // Kopfpanzer: die Platten wachsen mit dem Schädel und dem Kopfschild (Stoßfisch); das Auge wird mit ihnen größer, damit es lesbar bleibt
  const plate = Math.min(1, Math.sqrt((Math.max(0, -(m.spike ?? 0)) * (0.4 + sk) + (sk > 0.15 ? (sk - 0.15) * 0.9 : 0)) / 0.7));

  const su = 1 + FIN_UP * (m.stamUp ?? 0);
  const kd = (1 + 0.6 * st) * (1 + 0.75 * (m.crest ?? 0)) * (1 + 0.8 * (m.fUp ?? 0)) * su;
  const ka = (1 + 0.6 * st) * (1 + 0.6 * (m.fin ?? 0)) * (1 + 0.9 * (m.fDown ?? 0)) * su;
  const fd = m.fDown ?? 0;
  const lb = m.limb ?? 0;
  const kp = (1 + 0.5 * st) * (1 + 0.6 * (m.fin ?? 0)) * (1 + 0.95 * (m.fSide ?? 0)) * su;

  const dorsal: FinSpec = { k: kd, at: [-bw * 0.1, -bh * 0.4], base: bw * 0.42, len: 10.5 * kd + 3.5 };
  const anal: FinSpec = { k: ka, at: [-bw * 0.27, bb * 0.3], base: bw * 0.19, len: 8 * ka + 3 };
  const pelvic: FinSpec = { k: 0.55 + fd, at: [bw * 0.0, bb * 0.4], base: 7, len: 6 + 14 * fd };
  const pectoral = {
    k: kp, at: [hx - 3.4, hy + hg.H * 0.16] as P2, base: 6, len: lb > 0.1 ? (8 + 10 * lb) * (1 + 0.2 * (m.fin ?? 0)) * (1 + 0.6 * (m.fSide ?? 0)) + 6 : 15 * kp,
    lobed: lb > 0.1,
  };

  // Umfang des Netzes: Schwanzflossenspitze bis Schnauze, Kopfwölbung bis Bauch bzw. Schwanzspannweite
  const x0 = pedX - 5 - lobe - 4, x1 = tip[0] + 3;
  const yTop = Math.min(crownY, backY, -spread * (1 + 0.12)) - 4;
  const yBot = Math.max(bb * 0.52, spread, hy + hg.H * 0.5 + hg.jawH * 0.4) + 4;

  return {
    m, s, bw, bh, bb, hx, hy, hg, pedH, pedX,
    tail: { lobe, spread, fork, up: 0.14 + 0.1 * sk },
    hinge, tip, jawLen: Math.max(6, hg.L - hg.hingeX - 1.2), jawH,
    loop,
    eye: { x: hx + hg.L * 0.37, y: hy + hg.ey * 0.92, r: Math.min(hg.er, 2.35) * (1 + 0.22 * plate) },
    plate,
    dorsal, anal, pelvic, pectoral,
    bounds: { x0, x1, y0: yTop, y1: yBot },
    anchorX: hx - bw * 0.22,
    neckX: hx - bw * 0.06,
  };
}

/** Radius des gezeichneten Augapfels (Zeicheneinheiten, so wie ihn eye() im Tuschestil malt). */
export const eyeBall = (r: number) => Math.max(2.6, r * 1.3);

/** Wie breit (in Zeicheneinheiten) eine Fläche zwischen zwei Werten ausgeblendet wird – für sanfte Übergänge der Verformung. */
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
};
