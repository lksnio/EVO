import Phaser from 'phaser';
import { css, mix } from '../../util/color';
import { type Ctx, newCanvas } from '../../util/canvas';
import { palette, type Morph, type Pal } from '../creatureArt';
import { gradeAnimal as grade } from '../ink';
import { eyeBall, fishAnatomy, type FishAnatomy } from './anatomy';
import { bodyPath, fillOf, gillCurve, paintBodyFeatures, paintLowerTeeth, paintUpperTeeth } from './paint';

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
const JAW_TOP_C = -0.9;

export type RegKey = 'body' | 'jaw' | 'eye' | 'overlay' | 'dorsal' | 'anal' | 'pelvic' | 'pectoral';
/** Dazu die Sonderzeichnungen (art/im1–im4): Körper kurz/massig und lang/schlank, langer Unterkiefer, Maulinneres */
export type PartKey = RegKey | 'body_kurz' | 'body_lang' | 'jaw_lang' | 'mouth';

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

/**
 * Die gemalte Körperfläche, abschnittsweise an die Anatomie des Tiers angepasst – als Rückwärtsabbildung Pixel für Pixel
 * (jedes Pixel des Ziels fragt das Bild, mit 2 × 2 Stichproben gegen Kanten): x stückweise linear durch Schwanzflosse – Stielende –
 * Hals – Schnauze, in der Höhe nach Spannweite der Flosse, Stielhöhe, Körperhöhe und Kopfhöhe, dazwischen weich.
 */
function warpBody(dest: HTMLCanvasElement, tr: DOMMatrix, img: HTMLImageElement | HTMLCanvasElement, A: FishAnatomy, N: FishAnatomy, r: Reg) {
  const sxN = (r.dst[2] - r.dst[0]) / (r.src[2] - r.src[0]), syN = (r.dst[3] - r.dst[1]) / (r.src[3] - r.src[1]);
  const xn = [N.bounds.x0, N.pedX - 1, N.hx - 6, N.tip[0], N.bounds.x1];
  const xa = [A.bounds.x0, A.pedX - 1, A.hx - 6, A.tip[0], A.bounds.x1];
  const finK = A.tail.spread / N.tail.spread, pedK = A.pedH / N.pedH, bhK = A.bh / N.bh, hK = A.hg.H / N.hg.H;
  const kx = [N.bounds.x0, N.pedX - 1 - N.tail.lobe * 0.6, N.pedX - 1, N.pedX + 12, N.hx - 6, N.hx + 4, N.bounds.x1];
  const kv = [finK, finK, pedK, bhK, bhK, hK, hK];
  // Pixel je Einheit im Ziel (Maßstab der Leinwand) gegenüber Pixel je Einheit im Bild
  const pxPerUnitSrc = (img.width / r.orig[0]) / sxN;
  const lvl = pixelsOf(img, (tr.a * 1.1) / pxPerUnitSrc);
  const src = lvl.d;
  const k2 = lvl.k * (img.width / r.orig[0]);
  const dx = dest.getContext('2d', { willReadFrequently: true })!;
  const out = dx.createImageData(dest.width, dest.height), od = out.data;
  const tmp = [0, 0, 0, 0];
  const offs = [0.5];
  for (let j = 0; j < dest.height; j++) {
    for (let i = 0; i < dest.width; i++) {
      let R = 0, G = 0, B = 0, Al = 0;
      for (const oy of offs) {
        for (const ox of offs) {
          const xu = (i + ox - tr.e) / tr.a, yu = (j + oy - tr.f) / tr.d;
          const xN = pw(xa, xn, xu);
          const yN = yu / pw(kx, kv, xN);
          const u = ((xN - r.dst[0]) / sxN + r.src[0]) * k2 - 0.5, v = ((yN - r.dst[1]) / syN + r.src[1]) * k2 - 0.5;
          if (sample(src, u, v, tmp)) {
            R += tmp[0]; G += tmp[1]; B += tmp[2]; Al += tmp[3];
          }
        }
      }
      if (Al > 0) {
        const o = (j * dest.width + i) * 4;
        od[o] = R / Al; od[o + 1] = G / Al; od[o + 2] = B / Al; od[o + 3] = (Al / offs.length / offs.length) * 255;
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
    warpBody(one, ctx.getTransform(), imgOf(scene, v.key), A, v.N, v.reg);
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
  const feat = layer(ctx, (x) => paintBodyFeatures(x, A, P), null, null);
  applyMask(feat, mask);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(feat, 0, 0);
  ctx.restore();
  ctx.setTransform(t);
  void bodyPath;
}

/** y-Versatz der oberen Zähne gegenüber der programmierten Lippenlinie (die gemalte Lippe liegt etwas anders) */
const TEETH_DY = -0.8;
/** (siehe oben) */
const JAW_TOP = JAW_TOP_C;

// ---------------------------------------------------------------------------
// Die übrigen Teile

export function paintJawPainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  // untere Zähne zuerst: Der gemalte Kiefer deckt ihre Wurzeln
  paintLowerTeeth(ctx, A);
  const F = fillOf(P);
  const target = mix(F.belly, F.base, 0.55);
  const wl = jawLongWeight(A);
  // Die gemalte Oberlippe liegt 0,9 Einheiten über der programmierten Maulspalte: Der Kiefer wird um so viel angehoben. Sein hinterer
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
  const h = eyeBall(A.eye.r) * 1.218;
  // Der Blick: finster (fierce) färbt den hellen Augapfel zur Iris-Farbe
  const k = Math.min(1, A.m.fierce * 0.8);
  const c = layer(ctx, (x) => drawFitted(x, imgOf(scene, 'eye'), REG.eye, [-h, -h, h, h], NUDGE.eye), [255, 255, 255], k > 0 ? mix(0xffffff, P.eye, 0.6) : null, k);
  blit(ctx, c);
}

export function paintOverlayPainted(ctx: Ctx, scene: Phaser.Scene, A: FishAnatomy, P: Pal) {
  const { hx, hy, hg } = A;
  const F = fillOf(P);
  const to: [number, number, number, number] = [hx - 3.0, hy - hg.H * 0.285, hx + 5.2, hy + hg.H * 0.34];
  const c = layer(ctx, (x) => drawFitted(x, imgOf(scene, 'overlay'), REG.overlay, to, NUDGE.overlay), reference(scene, 'overlay'), F.base);
  ctx.save();
  ctx.globalAlpha = 0.72;
  blit(ctx, c);
  ctx.restore();
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
