import Phaser from 'phaser';
import { css, mix } from '../../util/color';
import { type Ctx, newCanvas } from '../../util/canvas';
import { palette, type Morph, type Pal } from '../creatureArt';
import { gradeAnimal as grade } from '../ink';
import { eyeBall, fishAnatomy, type FishAnatomy } from './anatomy';
import { INK, lightOf, shadowOf } from '../ink';
import { bodyPath, fillOf, gillCurve, paintBodyFeatures, paintEyeSocket, paintLowerTeeth, paintUpperTeeth, socketRadius } from './paint';

// ---------------------------------------------------------------------------
// Die gemalten Fischtexturen (art/EVO_fish_painted_v1, Laufzeitfassung in src/assets/fish/painted) im Rig.
//
// Die Bilder gehören zur NEUTRALEN Form. Sie werden hier (1) anhand ihrer Ansatzpunkte in den Vorlagenrahmen des Teils gelegt
// (REG: Pixel des Originals → Einheiten im Teilrahmen), (2) an die Anatomie des Tiers angepasst (Körper: abschnittsweise
// verzerrt; Flossen, Kiefer, Auge: nach ihren Maßen), (3) mit der Farbe der Linie eingefärbt (Verhältnis Zielfarbe : Mittelwert des
// Bildes – Licht und Schatten der Zeichnung bleiben) und (4) mit den prozeduralen Merkmalen versehen (Muster, Schuppen, Kopfplatten,
// Narben, Zähne), die nur innerhalb der gemalten Fläche und nicht auf ihrer Kontur liegen.
// Alles hier ist Registrierung: Die Zahlen lassen sich pro Teil nachstellen, ohne ein Bild anzufassen.
// ---------------------------------------------------------------------------

/** (siehe oben) */
const JAW_TOP_C = -0.6;

export type RegKey = 'body' | 'jaw' | 'eye' | 'overlay' | 'dorsal' | 'anal' | 'pelvic' | 'pectoral';
/** Dazu die Sonderzeichnungen (art/im1–im4): Körper kurz/massig und lang/schlank, langer Unterkiefer, Maulinneres */
export type PartKey = RegKey | 'body_kurz' | 'body_lang' | 'jaw_lang' | 'mouth' | 'armor';

export interface Reg {
  /** Pixel des Originals (vor der Verkleinerung in tools/fish_assets.py) */
  orig: [number, number];
  /** Begrenzung der gemalten Fläche im Original (Alpha ≥ 128): x0, y0, x1, y1 */
  src: [number, number, number, number];
  /** Wohin diese Begrenzung in der NEUTRALEN Form kommt: Einheiten, relativ zum Ursprung des Teils (Körper: Fischkoordinaten) */
  dst: [number, number, number, number];
}

/**
 * Registrierung der neutralen Form. Quelle: art/EVO_fish_painted_v1/registration.json (src = paintedBounds128, dst = templateBounds128
 * in Einheiten) – mit Korrekturen an den anatomischen Bezugspunkten:
 *   jaw     dst: Oberkante = Maulspalte (y 0), Gelenk links, Kinn/Spitze rechts – nicht die Zähne der alten Vorlage;
 *   overlay dst: der Bogen läuft vom Ansatz hinter dem Auge (oben) zur Kehle (unten) und holt hinten zur Kiemenfalte aus.
 */
export const REG: Record<RegKey, Reg> = {
  body: { orig: [1954, 805], src: [113, 58, 1872, 714], dst: [-49.19, -18.92, 41.25, 15.45] },
  jaw: { orig: [1411, 1115], src: [265, 526, 1170, 842], dst: [-2.4, 0, 10.75, 6.9] },
  eye: { orig: [1254, 1254], src: [254, 254, 999, 987], dst: [-3.72, -3.72, 3.72, 3.72] },
  overlay: { orig: [1193, 1319], src: [380, 122, 782, 1164], dst: [17.4, -8.7, 26.2, 12.1] },
  dorsal: { orig: [1530, 1028], src: [122, 172, 1410, 869], dst: [-13.41, -14.81, 13.4, 3.31] },
  anal: { orig: [1234, 1274], src: [149, 132, 1096, 1149], dst: [-6.51, -3.31, 6.49, 11.81] },
  pelvic: { orig: [1254, 1254], src: [324, 237, 994, 1021], dst: [-4.31, -3.31, 3.94, 6.81] },
  pectoral: { orig: [1281, 1227], src: [237, 294, 1118, 968], dst: [-14.56, -4, 2.94, 10.06] },
};

/** Maße der neutralen Form, auf die sich REG bezieht (für die Verhältnisse zu anderen Formen) */
const NEUTRAL = { base: 25.2, dLen: 14, aBase: 11.4, aLen: 11, vBase: 7, vLen: 6, pLen: 15 };

/** Nachstellbare Korrekturen je Teil (Einheiten, im Teilrahmen): Verschiebung und Skalierung nach der Registrierung. */
export const NUDGE: Partial<Record<RegKey | 'jawLang', { dx?: number; dy?: number; sx?: number; sy?: number }>> = {};

export const FILES: Record<PartKey, string> = {
  body: new URL('../../assets/fish/painted/body.webp', import.meta.url).href,
  jaw: new URL('../../assets/fish/painted/jaw.webp', import.meta.url).href,
  eye: new URL('../../assets/fish/painted/eye.webp', import.meta.url).href,
  overlay: new URL('../../assets/fish/painted/overlay.webp', import.meta.url).href,
  dorsal: new URL('../../assets/fish/painted/dorsal.webp', import.meta.url).href,
  anal: new URL('../../assets/fish/painted/anal.webp', import.meta.url).href,
  pelvic: new URL('../../assets/fish/painted/pelvic.webp', import.meta.url).href,
  pectoral: new URL('../../assets/fish/painted/pectoral.webp', import.meta.url).href,
  body_kurz: new URL('../../assets/fish/painted/body_kurz.webp', import.meta.url).href,
  body_lang: new URL('../../assets/fish/painted/body_lang.webp', import.meta.url).href,
  jaw_lang: new URL('../../assets/fish/painted/jaw_lang.webp', import.meta.url).href,
  mouth: new URL('../../assets/fish/painted/mouth.webp', import.meta.url).href,
  armor: new URL('../../assets/fish/painted/armor.webp', import.meta.url).href,
};

/**
 * Sonderzeichnungen. Jede gehört zu einer Referenzform (Morph), deren Anatomie die Zeichnung trägt; `dst` ist die Begrenzung der gemalten
 * Fläche in der Vorlage dieser Form (art/vorlagen/fisch/<form>/teil_*.png, Alpha ≥ 128, in Einheiten), `src` die im Bild (Alpha ≥ 128).
 */
export const VARIANTS = {
  kurz: { file: 'body_kurz' as PartKey, morph: { len: -1, girth: 1 }, reg: { orig: [1322, 1190], src: [98, 72, 1285, 1114], dst: [-36.65, -33.53, 32.72, 29.9] } as Reg },
  lang: { file: 'body_lang' as PartKey, morph: { len: 1, girth: -1, swift: 1 }, reg: { orig: [2084, 754], src: [96, 68, 2036, 677], dst: [-67.89, -20.91, 49.86, 17.09] } as Reg },
  /** langer Unterkiefer: Gelenk-Rahmen wie beim neutralen Kiefer; Maße der Form „starkes Gebiss“ (jawLen 38,7, jawH 11,1) */
  jawLang: { file: 'jaw_lang' as PartKey, reg: { orig: [1956, 804], src: [97, 228, 1896, 655], dst: [-4.2, JAW_TOP_C, 40.0, JAW_TOP_C + 10.4] } as Reg },
};
const PARTS = Object.keys(FILES) as PartKey[];
const key = (k: PartKey) => 'fishp_' + k;
/** Textur des gemalten Maulinneren (Schlüssel im Texturmanager) */
export const MOUTH_KEY = 'fishp_mouth';

/** Entwickler: ?procfish zeigt den Fisch mit der programmierten Zeichnung (statt der gemalten) – für Vergleiche */
const FORCE_PROC = typeof location !== 'undefined' && new URLSearchParams(location.search).has('procfish');

export function preloadPainted(scene: Phaser.Scene) {
  for (const k of PARTS) if (!scene.textures.exists(key(k))) scene.load.image(key(k), FILES[k]);
}

export const paintedReady = (scene: Phaser.Scene) => !FORCE_PROC && PARTS.every((k) => scene.textures.exists(key(k)));

const imgOf = (scene: Phaser.Scene, k: PartKey) => scene.textures.get(key(k)).getSourceImage() as HTMLImageElement | HTMLCanvasElement;

// ---------------------------------------------------------------------------
// Farben: Mittelwert des Bildes (nur ruhige Flächen, ohne Kontur und Glanz) als Bezug für die Einfärbung

const refCache = new Map<PartKey, [number, number, number]>();
function reference(scene: Phaser.Scene, k: PartKey): [number, number, number] {
  const hit = refCache.get(k);
  if (hit) return hit;
  const img = imgOf(scene, k);
  const [c, x] = newCanvas(64, Math.max(8, Math.round((64 * img.height) / img.width)), true);
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (d[i + 3] > 250 && lum > 70 && lum < 215) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
  }
  const out: [number, number, number] = n ? [r / n, g / n, b / n] : [128, 128, 128];
  refCache.set(k, out);
  return out;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Färbt die Pixel so ein, dass die Durchschnittsfarbe des Bildes zur Zielfarbe wird (Licht und Schatten bleiben). */
function tint(ctx: Ctx, ref: [number, number, number], target: number, strength = 1) {
  const t = rgb(target);
  const gain = ref.map((r, i) => 1 + (Math.max(0.25, Math.min(1.7, t[i] / Math.max(20, r))) - 1) * strength);
  const c = ctx.canvas, id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    d[i] = Math.min(255, d[i] * gain[0]);
    d[i + 1] = Math.min(255, d[i + 1] * gain[1]);
    d[i + 2] = Math.min(255, d[i + 2] * gain[2]);
  }
  ctx.putImageData(id, 0, 0);
}

/** Zeichnet das Bild in ein Rechteck (Einheiten) des Teilrahmens, danach wird eingefärbt – auf einer eigenen, gleich großen Leinwand. */
function layer(ctx: Ctx, draw: (c: Ctx) => void, ref: [number, number, number] | null, target: number | null, strength = 1) {
  const src = ctx.canvas;
  const [c, x] = newCanvas(src.width, src.height, true);
  x.setTransform(ctx.getTransform());
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  draw(x);
  if (ref && target !== null) {
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    tint(x, ref, target, strength);
    x.restore();
  }
  return c;
}

/** Legt das Bild so in den Teilrahmen, dass seine gemalte Begrenzung (REG.src) auf `to` (Einheiten) fällt. */
function drawFitted(c: Ctx, img: CanvasImageSource & { width: number; height: number }, r: Reg, to: [number, number, number, number], nudge?: { dx?: number; dy?: number; sx?: number; sy?: number }) {
  const sx = (to[2] - to[0]) / (r.src[2] - r.src[0]) * (nudge?.sx ?? 1), sy = (to[3] - to[1]) / (r.src[3] - r.src[1]) * (nudge?.sy ?? 1);
  const x0 = to[0] - r.src[0] * sx + (nudge?.dx ?? 0), y0 = to[1] - r.src[1] * sy + (nudge?.dy ?? 0);
  c.drawImage(img, x0, y0, r.orig[0] * sx, r.orig[1] * sy);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Stückweise lineare Abbildung durch Stützpunkte (xs aufsteigend). */
function pw(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1));
  return ys[ys.length - 1];
}

let neutralA: FishAnatomy | undefined;
const neutral = () => (neutralA ??= fishAnatomy({ cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 0, seed: 1, sex: 0, spike: 0, green: 0, sand: 0, len: 0, girth: 0, swift: 0, fang: 0, toothTier: 0, light: 0, limb: 0, fin: 0, tail: 0, crest: 0, tint: 0, snout: 0, coat: 0, armor: 0, st: 0, bs: 0, vf: 0, sw: 0, fUp: 0, fDown: 0, fSide: 0, fTail: 0, eye: 0, stamUp: 0, grip: 0, gills: 0 } as Morph));

const refAnat = new Map<string, FishAnatomy>();
const BASE_MORPH = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 0, seed: 1, sex: 0 } as Morph;
function variantAnatomy(name: 'kurz' | 'lang') {
  let a = refAnat.get(name);
  if (!a) refAnat.set(name, (a = fishAnatomy({ ...BASE_MORPH, ...VARIANTS[name].morph } as Morph)));
  return a;
}

/**
 * Welche Körperzeichnung gilt für diese Anatomie: Das Seitenverhältnis des Körpers (Länge : Höhe) gegenüber der neutralen Form entscheidet.
 * Zwischen den Zeichnungen wird übergeblendet (kurz → neutral → lang), damit die Entwicklung keinen Sprung macht.
 */
export function bodyWeights(A: FishAnatomy) {
  const N = neutral();
  const q = Math.log((A.bw / A.bh) / (N.bw / N.bh));
  const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const kurz = sm(-0.15, -0.55, q), lang = sm(0.15, 0.55, q);
  return { kurz, lang, neutral: 1 - kurz - lang };
}

/** Der lange Unterkiefer löst den neutralen ab, wenn das Maul sehr lang wird (Gebiss). */
export const jawLongWeight = (A: FishAnatomy) => { const t = Math.max(0, Math.min(1, (A.jawLen - 14) / 10)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// Körper: gemalte Fläche, abschnittsweise an die Anatomie angepasst

/**
 * Pixel des Bildes in Verkleinerungsstufen (1, 1/2, 1/4): Das Ziel braucht je Einheit nur wenige Pixel, also fragt es die kleinste
 * Stufe, die dafür noch reicht – das ist schneller und glättet zugleich (kein Flimmern an Kanten).
 */
const mips = new WeakMap<object, { k: number; d: ImageData }[]>();
function pixelsOf(img: HTMLImageElement | HTMLCanvasElement, needPerOrig: number) {
  let levels = mips.get(img);
  if (!levels) {
    levels = [];
    for (const k of [1, 0.5, 0.25]) {
      const [c, x] = newCanvas(Math.round(img.width * k), Math.round(img.height * k), true);
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      levels.push({ k, d: x.getImageData(0, 0, c.width, c.height) });
    }
    mips.set(img, levels);
  }
  // kleinste Stufe, die noch mindestens needPerOrig Pixel je Original-Pixel hat
  let pick = levels[0];
  for (const l of levels) if (l.k >= needPerOrig) pick = l;
  return pick;
}

/** Bilinear gewichtete Farbe (vormultipliziert) an der Stelle (u, v) des Bildes; ergibt Alpha 0 außerhalb. */
function sample(d: ImageData, u: number, v: number, out: number[]) {
  const w = d.width, h = d.height;
  if (u < 0 || v < 0 || u > w - 1 || v > h - 1) return false;
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const px = d.data;
  let r = 0, g = 0, b = 0, a = 0;
  for (const [xx, yy, wgt] of [[x0, y0, (1 - fx) * (1 - fy)], [x1, y0, fx * (1 - fy)], [x0, y1, (1 - fx) * fy], [x1, y1, fx * fy]] as [number, number, number][]) {
    const i = (yy * w + xx) * 4, al = (px[i + 3] / 255) * wgt;
    r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al;
  }
  out[0] = r; out[1] = g; out[2] = b; out[3] = a;
  return true;
}

/** Halbe Strichstärke der gemalten Kontur (Einheiten): Die äußere Kante der gemalten Fläche liegt so weit außerhalb der Mitte der Linie. */
const OUTER = 0.58;

/** Ober- und Unterkante einer Fläche je Spalte (Einheiten, Spaltenabstand step, erste Spalte bei x0); NaN, wo es keine Fläche gibt. */
interface Profile { x0: number; step: number; top: Float32Array; bot: Float32Array }

/** Silhouette des gemalten Körpers in den Einheiten seiner Referenzform (aus dem Alpha-Kanal, Kontur eingeschlossen). */
const srcProfiles = new Map<string, Profile>();
function sourceProfile(img: HTMLImageElement | HTMLCanvasElement, name: string, r: Reg): Profile {
  const hit = srcProfiles.get(name);
  if (hit) return hit;
  const lvl = pixelsOf(img, 0.5), d = lvl.d, k = lvl.k * (img.width / r.orig[0]);
  const sxN = (r.dst[2] - r.dst[0]) / (r.src[2] - r.src[0]), syN = (r.dst[3] - r.dst[1]) / (r.src[3] - r.src[1]);
  const step = 0.25, x0 = r.dst[0], n = Math.floor((r.dst[2] - r.dst[0]) / step);
  const top = new Float32Array(n).fill(NaN), bot = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const px = Math.round((((x0 + (i + 0.5) * step) - r.dst[0]) / sxN + r.src[0]) * k);
    if (px < 0 || px >= d.width) continue;
    let y0 = -1, y1 = -1;
    for (let y = 0; y < d.height; y++) if (d.data[(y * d.width + px) * 4 + 3] >= 128) { if (y0 < 0) y0 = y; y1 = y; }
    if (y0 < 0) continue;
    top[i] = r.dst[1] + (y0 / k - r.src[1]) * syN;
    bot[i] = r.dst[1] + ((y1 + 1) / k - r.src[1]) * syN;
  }
  const p = { x0, step, top: smoothArr(top), bot: smoothArr(bot) };
  srcProfiles.set(name, p);
  return p;
}

/** Das Formprofil des Tiers: Silhouette der programmierten Form (bodyPath) + halbe Kontur, Spalte für Spalte. */
function targetProfile(A: FishAnatomy): Profile {
  const ppu = 4, b = A.bounds;
  const [c, x] = newCanvas((b.x1 - b.x0) * ppu, (b.y1 - b.y0) * ppu, true);
  x.scale(ppu, ppu);
  x.translate(-b.x0, -b.y0);
  bodyPath(x, A);
  x.fillStyle = '#fff';
  x.fill();
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const step = 1 / ppu, top = new Float32Array(c.width).fill(NaN), bot = new Float32Array(c.width).fill(NaN);
  for (let i = 0; i < c.width; i++) {
    let y0 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) if (d[(y * c.width + i) * 4 + 3] >= 128) { if (y0 < 0) y0 = y; y1 = y; }
    if (y0 < 0) continue;
    top[i] = b.y0 + y0 / ppu - OUTER;
    bot[i] = b.y0 + (y1 + 1) / ppu + OUTER;
  }
  return { x0: b.x0, step, top: smoothArr(top), bot: smoothArr(bot) };
}

function smoothArr(a: Float32Array) {
  const o = new Float32Array(a.length).fill(NaN);
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i])) continue;
    let s = 0, n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(a.length - 1, i + 2); j++) if (!Number.isNaN(a[j])) { s += a[j]; n++; }
    o[i] = s / n;
  }
  return o;
}

const at = (p: Profile, x: number): [number, number] | null => {
  const i = Math.floor((x - p.x0) / p.step);
  if (i < 0 || i >= p.top.length) return null;
  const t = p.top[i], bt = p.bot[i];
  return Number.isNaN(t) || Number.isNaN(bt) ? null : [t, bt];
};

/**
 * Die gemalte Körperfläche, an die Anatomie des Tiers angepasst – als Rückwärtsabbildung Pixel für Pixel (eine gefilterte Stichprobe
 * aus der passenden Verkleinerungsstufe des Bildes):
 *   x: stückweise linear durch Schwanzflosse – Stielende – Hals – Schnauze;
 *   y im Schwanz: nach Spannweite der Flosse; ab dem Stiel nach dem FORMPROFIL: Ober- und Unterkante der gemalten Fläche werden Spalte
 *   für Spalte auf die Silhouette der programmierten Form gelegt (src → Ziel, dazwischen linear). So bestimmt die Anatomie die Gestalt
 *   (rund oder schlank, Schulter, Kehle, Schnauze), die Malerei trägt Licht, Kontur und Material.
 */
function warpBody(dest: HTMLCanvasElement, tr: DOMMatrix, img: HTMLImageElement | HTMLCanvasElement, A: FishAnatomy, N: FishAnatomy, r: Reg, name: string) {
  const sxN = (r.dst[2] - r.dst[0]) / (r.src[2] - r.src[0]), syN = (r.dst[3] - r.dst[1]) / (r.src[3] - r.src[1]);
  const xn = [N.bounds.x0, N.pedX - 1, N.hx - 6, N.tip[0], N.bounds.x1];
  const xa = [A.bounds.x0, A.pedX - 1, A.hx - 6, A.tip[0], A.bounds.x1];
  const finK = A.tail.spread / N.tail.spread, pedK = A.pedH / N.pedH;
  const kx = [N.bounds.x0, N.pedX - 1 - N.tail.lobe * 0.6, N.pedX - 1];
  const kv = [finK, finK, pedK];
  const sp = sourceProfile(img, name, r), tp = targetProfile(A);
  const pxPerUnitSrc = (img.width / r.orig[0]) / sxN;
  const lvl = pixelsOf(img, (tr.a * 1.1) / pxPerUnitSrc);
  const src = lvl.d;
  const k2 = lvl.k * (img.width / r.orig[0]);
  const dx = dest.getContext('2d', { willReadFrequently: true })!;
  const out = dx.createImageData(dest.width, dest.height), od = out.data;
  const tmp = [0, 0, 0, 0];
  const joint0 = A.pedX - 1, joint1 = A.pedX + 4;
  for (let j = 0; j < dest.height; j++) {
    for (let i = 0; i < dest.width; i++) {
      const xu = (i + 0.5 - tr.e) / tr.a, yu = (j + 0.5 - tr.f) / tr.d;
      const xN = pw(xa, xn, xu);
      // Höhe: Flossenmaß im Schwanz, Formprofil ab dem Stiel (weich am Übergang)
      let yN = yu / pw(kx, kv, xN);
      if (xu > joint0) {
        const t = at(tp, xu), s = at(sp, xN);
        if (t && s) {
          const w = Math.max(0, Math.min(1, (xu - joint0) / (joint1 - joint0)));
          const yP = s[0] + (yu - t[0]) * ((s[1] - s[0]) / Math.max(1, t[1] - t[0]));
          yN = yN + (yP - yN) * (w * w * (3 - 2 * w));
        }
      }
      const u = ((xN - r.dst[0]) / sxN + r.src[0]) * k2 - 0.5, v = ((yN - r.dst[1]) / syN + r.src[1]) * k2 - 0.5;
      if (sample(src, u, v, tmp)) {
        const o = (j * dest.width + i) * 4, al = tmp[3];
        if (al > 0) { od[o] = tmp[0] / al; od[o + 1] = tmp[1] / al; od[o + 2] = tmp[2] / al; od[o + 3] = al * 255; }
      }
    }
  }
  dx.putImageData(out, 0, 0);
}

/** Maske der Fläche, auf der Merkmale liegen dürfen: gemalte Fläche ohne die dunkle Kontur (aus dem unveränderten Bild). */
function interiorMask(c: HTMLCanvasElement): Uint8ClampedArray {
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const e = Math.max(0, Math.min(1, (lum - 38) / 40));
    m[j] = Math.round((d[i + 3] / 255) * e * 255);
  }
  return m;
}

function applyMask(c: HTMLCanvasElement, m: Uint8ClampedArray) {
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 3, j = 0; i < d.length; i += 4, j++) d[i] = (d[i] * m[j]) / 255;
  x.putImageData(id, 0, 0);
}


// ---------------------------------------------------------------------------
// Kopfpanzer (art/EVO_player_head_armor_v1): gemalte Auflage statt der programmierten Kopfplatte
//
// Registrierung am AUGE (stabilster Bezugspunkt): Der Mittelpunkt der gemessenen Öffnung der Alternativzeichnung liegt auf A.eye. Vertikal
// skaliert das Bild mit der Kopfhöhe, zur Schnauze hin mit der Kopflänge; die Hinterkante hängt nicht an der Schnauze, sondern bleibt eine feste
// Strecke hinter dem Kopfursprung (sonst würde sie bei langem Maul hinter den Körper wandern). Dazwischen wird weich übergeblendet.
// A.plate bleibt die Stärke: Deckung blendet ein, die Auflage wird mit schwächerem Schild kleiner (Hinterkante zieht sich zum Auge zurück).

/** Maße des gelieferten Bildes (Pixel des Originals), Augenmitte darin, g-Einheiten je Pixel und die Referenzform (skull 1, spike −1) */
export const ARMOR = { w: 1334, h: 1179, eye: [710.522, 638.41] as [number, number], gpp: 0.0401586, L: 28.4, H: 39.192, hx: 20.4, eyeX: 30.908 };
/** Strecke der Hinterkante hinter dem Kopfursprung (Einheiten) in der Referenzform */
const ARMOR_REAR = ARMOR.eye[0] * ARMOR.gpp - (ARMOR.eyeX - ARMOR.hx);
/** Nachstellbare Korrektur (Einheiten, Faktor) der Auflage nach der Registrierung */
export const ARMOR_NUDGE = { dx: 0, dy: 0, sx: 1, sy: 1 };

/** Wie stark die Auflage deckt (0 … 1): blendet zwischen A.plate 0,04 und 0,4 ein. */
export const armorCover = (A: FishAnatomy) => { const t = Math.max(0, Math.min(1, (A.plate - 0.04) / 0.36)); return t * t * (3 - 2 * t); };

/** Größe der Auflage nach der Stärke: ein schwacher Schild ist kleiner (Hinterkante näher am Auge), behält aber seine geschwungene Kante. */
const armorGrow = (A: FishAnatomy, min: number) => { const t = Math.max(0, Math.min(1, (A.plate - 0.15) / 0.75)); return min + (1 - min) * t * t * (3 - 2 * t); };

/** x-Einheit (im Körperrahmen) der Pixelspalte px des Bildes: Abbildung mit zwei Maßstäben (hinten Körper, vorn Kopf), weich verbunden. */
export function armorMapper(A: FishAnatomy) {
  const kR = (ARMOR.gpp * A.hg.L / ARMOR.L) * ARMOR_NUDGE.sx;
  const kL = (((A.eye.x - A.hx) + ARMOR_REAR) / ARMOR.eye[0]) * ARMOR_NUDGE.sx * armorGrow(A, 0.5);
  const e = ARMOR.eye[0];
  const k = (px: number) => { const t = Math.max(0, Math.min(1, (px - (e - 120)) / 240)); const w = t * t * (3 - 2 * t); return kL + (kR - kL) * w; };
  // Stammfunktion ab der Augenspalte, numerisch (Schritt 4 Pixel)
  return (px: number) => {
    let x = 0;
    const dir = px >= e ? 1 : -1, n = Math.ceil(Math.abs(px - e) / 4);
    for (let i = 0; i < n; i++) {
      const a = e + dir * i * 4, b = e + dir * Math.min(Math.abs(px - e), (i + 1) * 4);
      x += (b - a) * k((a + b) / 2);
    }
    return A.eye.x + x + ARMOR_NUDGE.dx;
  };
}

/**
 * Die geformte Auflage (ungefärbt) auf einer eigenen Leinwand von der Größe von ctx (Transform wie ctx): registriert, mit Rückkante
 * nach A.plate (Größe und Deckung), mit Aussparung für die Augenhöhle. null, wenn kein Panzer.
 */
function armorLayer(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy): HTMLCanvasElement | null {
  if (A.plate <= 0.04) return null;
  const img = imgOf(scene, 'armor'), f = img.width / ARMOR.w;
  const [c, x] = newCanvas(ctx.canvas.width, ctx.canvas.height, true);
  x.setTransform(ctx.getTransform());
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  const map = armorMapper(A);
  const sy = (ARMOR.gpp * A.hg.H / ARMOR.H) * ARMOR_NUDGE.sy * armorGrow(A, 0.78), y0 = A.eye.y - ARMOR.eye[1] * sy + ARMOR_NUDGE.dy;
  const STEP = 6, ov = 0.7 / Math.max(1, x.getTransform().a); // Streifen überlappen um knapp einen Bildschirmpixel: keine Fugen
  for (let px = 0; px < ARMOR.w; px += STEP) {
    const x0 = map(px), x1 = map(Math.min(ARMOR.w, px + STEP));
    const k = (x1 - x0) / Math.max(1, Math.min(STEP, ARMOR.w - px)); // Einheiten je Bildpixel in diesem Streifen
    const pad = Math.min(2.5, ov / Math.max(1e-6, k)); // Bildpixel Zugabe an beiden Seiten
    const sx0 = Math.max(0, px - pad), sx1 = Math.min(ARMOR.w, px + Math.min(STEP, ARMOR.w - px) + pad);
    x.drawImage(img, sx0 * f, 0, (sx1 - sx0) * f, img.height, x0 - (px - sx0) * k, y0, (sx1 - sx0) * k, ARMOR.h * sy);
  }
  // die Augenhöhle wird ausgespart (das Auge sitzt in der Öffnung, die gezeichnet wird – nicht im Bild)
  const [rx, ry] = socketRadius(A);
  x.save();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath();
  x.ellipse(A.eye.x, A.eye.y, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
  x.fillStyle = '#000';
  x.fill();
  x.restore();
  return c;
}


/** Ein dunkler Saum der Breite w (Einheiten) um die Form eines Bildes, ohne die Form selbst. */
function ringOf(ctx: Ctx, shape: HTMLCanvasElement, w: number) {
  const [c, x] = newCanvas(shape.width, shape.height, true);
  const ppu = ctx.getTransform().a, r = w * ppu;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    x.drawImage(shape, Math.cos(a) * r, Math.sin(a) * r);
  }
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = css(INK);
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(shape, 0, 0);
  return c;
}

/** Zeichnet den Kopfpanzer auf den fertig gemalten Körper (nur auf die Fläche ohne Kontur, `mask`), danach die Augenhöhle einmal. */
function paintArmor(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal, mask: Uint8ClampedArray) {
  const lay = armorLayer(ctx, scene, A);
  if (!lay) return;
  const F = fillOf(P);
  // helleres mineralisches Material: nur zum Teil auf die Hautfarbe gefärbt, damit die gemalte Modellierung bleibt
  const lx = lay.getContext('2d', { willReadFrequently: true })!;
  tint(lx, reference(scene, 'armor'), mix(0xb9ae9a, F.base, 0.2), 0.9);
  // Tuschekante: ein schmaler dunkler Saum um die Auflage (auf der Haut), so wie die gemalten Flossen und der Körper umrandet sind
  const ring = ringOf(ctx, lay, 0.5);
  applyMask(ring, mask);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = armorCover(A) * 0.8;
  ctx.drawImage(ring, 0, 0);
  ctx.restore();
  applyMask(lay, mask);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = armorCover(A);
  ctx.drawImage(lay, 0, 0);
  ctx.restore();
  const soc = layer(ctx, (x) => paintEyeSocket(x, A, P, true), null, null);
  applyMask(soc, mask);
  blit(ctx, soc);
}

export function paintBodyPainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  const F = fillOf(P);
  // Zähne zuerst: Die gemalte Oberlippe deckt ihre Wurzeln
  paintUpperTeeth(ctx, A, TEETH_DY);
  const w = bodyWeights(A);
  type Src = { weight: number; key: PartKey; N: FishAnatomy; reg: Reg };
  const src = ([
    { weight: w.neutral, key: 'body', N: neutral(), reg: REG.body },
    { weight: w.kurz, key: 'body_kurz', N: variantAnatomy('kurz'), reg: VARIANTS.kurz.reg },
    { weight: w.lang, key: 'body_lang', N: variantAnatomy('lang'), reg: VARIANTS.lang.reg },
  ] as Src[]).filter((v) => v.weight > 0.003);
  const [flat] = newCanvas(ctx.canvas.width, ctx.canvas.height, true); // ungefärbte Mischung (für die Maske)
  const [base] = newCanvas(ctx.canvas.width, ctx.canvas.height, true); // gefärbte Mischung
  const fx = flat.getContext('2d', { willReadFrequently: true })!, bx = base.getContext('2d', { willReadFrequently: true })!;
  fx.globalCompositeOperation = bx.globalCompositeOperation = 'lighter';
  for (const v of src) {
    const [one] = newCanvas(ctx.canvas.width, ctx.canvas.height, true);
    warpBody(one, ctx.getTransform(), imgOf(scene, v.key), A, v.N, v.reg, v.key);
    fx.globalAlpha = v.weight;
    fx.drawImage(one, 0, 0);
    tint(one.getContext('2d', { willReadFrequently: true })!, reference(scene, v.key), F.base);
    bx.globalAlpha = v.weight;
    bx.drawImage(one, 0, 0);
  }
  const mask = interiorMask(flat);
  const t = ctx.getTransform();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(base, 0, 0);
  ctx.restore();
  // Merkmale auf eigener Ebene, auf die Fläche (ohne Kontur) begrenzt
  const feat = layer(ctx, (x) => paintBodyFeatures(x, A, P, true), null, null);
  applyMask(feat, mask);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(feat, 0, 0);
  ctx.restore();
  ctx.setTransform(t);
  // gemalter Kopfpanzer über Haut und Merkmalen, mit der Augenhöhle
  paintArmor(ctx, scene, A, P, mask);
  void bodyPath;
}

/** y-Versatz der oberen Zähne gegenüber der programmierten Lippenlinie (die gemalte Lippe liegt etwas anders) */
const TEETH_DY = 0;
/** (siehe oben) */
const JAW_TOP = JAW_TOP_C;

// ---------------------------------------------------------------------------
// Die übrigen Teile

export function paintJawPainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  // untere Zähne zuerst: Der gemalte Kiefer deckt ihre Wurzeln
  paintLowerTeeth(ctx, A);
  const F = fillOf(P);
  const target = mix(F.belly, F.base, 0.8); // der Kiefer ist ähnlich schattiert wie die benachbarte Haut, keine helle Klinge
  const wl = jawLongWeight(A);
  // Die Silhouette des Körpers wird auf die programmierte Form gelegt (Formprofil), die gemalte Lippenmitte liegt dann auf der Maulspalte; die Kieferoberkante (Kontur) sitzt 0,6 Einheiten darüber. Sein hinterer
  // Teil reicht weit unter den Körper (die gemalte Kehle deckt ihn), vorn endet er an der Schnauzenspitze; die Tiefe folgt jawH.
  const draw = (key: 'jaw' | 'jaw_lang', reg: Reg, to: [number, number, number, number], weight: number) => {
    const c = layer(ctx, (x) => drawFitted(x, imgOf(scene, key), reg, to, key === 'jaw' ? NUDGE.jaw : NUDGE.jawLang), reference(scene, key), target);
    ctx.save();
    ctx.globalAlpha = weight;
    blit(ctx, c);
    ctx.restore();
  };
  const len = A.jawLen * 1.034;
  const depth = 6.1 * (A.jawH / 6.56);
  // (zwei Lagen mit Gewichten w und 1 − w ergeben bei w = 0 oder 1 genau eine Zeichnung; dazwischen eine Überblendung)
  if (wl < 0.997) draw('jaw', REG.jaw, [-4.2, JAW_TOP, len, JAW_TOP + depth], 1 - wl);
  if (wl > 0.003) draw('jaw_lang', VARIANTS.jawLang.reg, [-4.2, JAW_TOP, len, JAW_TOP + depth], wl);
}

export function paintEyePainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  const h = eyeBall(A.eye.r) * (A.eyeK ?? 1) * 1.218;
  // Der Blick: finster (fierce) färbt den hellen Augapfel zur Iris-Farbe
  const k = Math.min(1, A.m.fierce * 0.8);
  const c = layer(ctx, (x) => drawFitted(x, imgOf(scene, 'eye'), REG.eye, [-h, -h, h, h], NUDGE.eye), [255, 255, 255], k > 0 ? mix(0xffffff, P.eye, 0.6) : null, k);
  blit(ctx, c);
}

/**
 * Die Kiemenfalte: eine dünne, nach unten auslaufende dunkle Furche (oben kräftiger, unten dünn) mit einem kaum sichtbaren Schatten dahinter
 * – kein heller Ring, kein eigenes Teil. Die gemalte Sichel (art/EVO_fish_painted_v1/textures/teil_overlay.png) wird dafür nicht mehr
 * verwendet: Ihre helle Kante machte die Falte zum angesetzten Bogen.
 */
export function paintOverlayPainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  const F = fillOf(P);
  const { hx, hy, hg } = A;
  const pt = (t: number, dx: number): [number, number] => {
    const P0: [number, number] = [hx + 5.6 + dx, hy - hg.H * 0.27], C1: [number, number] = [hx - 4.5 + dx, hy - hg.H * 0.2], C2: [number, number] = [hx - 5.5 + dx, hy + hg.H * 0.28], P3: [number, number] = [hx + 3.4 + dx, hy + hg.H * 0.46];
    const u = 1 - t;
    return [u * u * u * P0[0] + 3 * u * u * t * C1[0] + 3 * u * t * t * C2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * C1[1] + 3 * u * t * t * C2[1] + t * t * t * P3[1]];
  };
  const stroke = (c: Ctx, dx: number, w0: number, w1: number, color: string, aMul: number, from = 0, to = 1) => {
    const n = 26;
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const t0 = from + (to - from) * (i / n), t1 = from + (to - from) * ((i + 1) / n), tm = (t0 + t1) / 2;
      const a = pt(t0, dx), b = pt(t1, dx);
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.lineWidth = w0 + (w1 - w0) * tm;
      c.globalAlpha = aMul * (1 - 0.65 * tm * tm);
      c.strokeStyle = color;
      c.stroke();
    }
    c.globalAlpha = 1;
  };
  // weicher Schatten dahinter (auf dem Rumpf), die Furche selbst, ein Hauch Licht davor
  // feste Weltarten (jawRest gesetzt): nur eine leise Kiemenspalte, kleiner Fisch, kein kräftiger Bogen
  const q = A.jawRest !== undefined ? 0.6 : 1;
  const furrow = (c: Ctx) => {
    stroke(c, -1.7, 2.6 * q, 0.8 * q, css(shadowOf(F.base)), 0.2 * q);
    stroke(c, 0, 1.25 * q, 0.25 * q, css(INK), 0.62 * q);
    stroke(c, 1.1, 0.6 * q, 0.15 * q, css(lightOf(F.base, 0.2)), 0.16 * q, 0.05, 0.85);
  };
  // Der Kopfpanzer liegt über der Falte (sie verläuft hinter ihm): dort wird die Furche ausgespart
  const arm = armorLayer(ctx, scene, A);
  if (!arm) return furrow(ctx);
  const lay = layer(ctx, furrow, null, null);
  const lx = lay.getContext('2d')!;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.globalCompositeOperation = 'destination-out';
  lx.globalAlpha = armorCover(A);
  lx.drawImage(arm, 0, 0);
  blit(ctx, lay);
}

export function paintFinPainted(ctx: Ctx, scene: Phaser.Scene, kind: 'dorsal' | 'anal' | 'pelvic' | 'pectoral', A: FishAnatomy, P: Pal, far = false) {
  const F = fillOf(P);
  const r = REG[kind];
  let to: [number, number, number, number];
  if (kind === 'dorsal') {
    const kb = A.dorsal.base / NEUTRAL.base, kl = A.dorsal.len / NEUTRAL.dLen;
    to = [r.dst[0] * kb, r.dst[1] * kl, r.dst[2] * kb, r.dst[3]];
  } else if (kind === 'anal') {
    const kb = A.anal.base / NEUTRAL.aBase, kl = A.anal.len / NEUTRAL.aLen;
    to = [r.dst[0] * kb, r.dst[1], r.dst[2] * kb, r.dst[3] * kl];
  } else if (kind === 'pelvic') {
    const kb = A.pelvic.base / NEUTRAL.vBase, kl = A.pelvic.len / NEUTRAL.vLen;
    to = [r.dst[0] * kb, r.dst[1], r.dst[2] * kb, r.dst[3] * kl];
  } else {
    const kl = A.pectoral.len / NEUTRAL.pLen;
    to = [r.dst[0] * kl, r.dst[1], r.dst[2], r.dst[3] * kl];
  }
  const fin = mix(F.fin, 0x000000, far ? 0.32 : 0);
  const c = layer(ctx, (x) => drawFitted(x, imgOf(scene, kind), r, to, NUDGE[kind]), reference(scene, kind), fin);
  if (kind === 'pectoral' && !far) {
    // Die Brustflosse kommt unter der Kiemenfalte hervor: alles vor dem Rand des Kiemendeckels wird abgeschnitten
    const x = c.getContext('2d')!;
    x.setTransform(ctx.getTransform());
    x.globalCompositeOperation = 'destination-out';
    x.save();
    x.translate(-A.pectoral.at[0], -A.pectoral.at[1]);
    x.beginPath();
    gillCurve(x, A, -0.9, 0);
    x.lineTo(A.hx + 60, A.hy + hgH(A) * 0.6);
    x.lineTo(A.hx + 60, A.hy - hgH(A) * 0.6);
    x.closePath();
    x.fill();
    x.restore();
  }
  blit(ctx, c);
}

const hgH = (A: FishAnatomy) => A.hg.H;

function blit(ctx: Ctx, c: HTMLCanvasElement) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

/** Für Vergleiche und die Werkstatt: Die Farbe, auf die ein Bild eingefärbt wird. */
export const targetColors = (m: Morph) => {
  const P = palette(m);
  return { base: grade(P.base), fin: grade(P.fin), css: css(grade(P.base)) };
};
