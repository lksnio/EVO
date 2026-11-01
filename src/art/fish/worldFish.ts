import Phaser from 'phaser';
import { css, mix, shade } from '../../util/color';
import { newCanvas, type Ctx } from '../../util/canvas';
import type { SpeciesDef } from '../../data/species';
import { INK, lightOf, shadowOf } from '../ink';
import type { Morph, Pal } from '../creatureArt';
import type { FinSpec, FishAnatomy, P2 } from './anatomy';
import { eyeBox, finBox } from './paint';
import { jawLongWeight, paintEyePainted, paintFinPainted, paintJawPainted, paintOverlayPainted, paintedReady } from './painted';
import { FISH_RES, makeTex, type Box, type FishTex } from './rig';
import data from './worldFish.json';

// ---------------------------------------------------------------------------
// Feste Weltarten im Fisch-Rig (art/EVO_world_rayfins_part2_v1): die acht normalen Strahlenflosser.
//
// Die Arten haben feste Gestalt – es gibt keine Evolutionswerte. Aus den gemalten Körperflächen (rig_bodies), den Ansatzpunkten der
// Zeichnerin und den vorhandenen gemalten Standardteilen (Auge, Flossen, Kiefer, Maulinneres) entsteht hier je Art ein `FishTex`, mit dem
// das vorhandene Rig (FishRig: Wirbelsäule, Netz, Kiefer, Flossen) unverändert arbeitet. Der Körper wird nicht verzerrt, sondern
// maßstabsgetreu eingesetzt (ein Maßstab für beide Achsen); Kiefer und Maulspalte werden aus dem Körper ausgeschnitten, damit der
// bewegliche Unterkiefer ihn ersetzt, ohne dass eine Kinnkante stehen bleibt. Die Art selbst (Name, Größe, Verhalten) kommt aus `SpeciesDef`.
//
// Die Registrierung (PROFILES) bezieht sich auf Pixel der ORIGINALE (`bounds`, `cx`, `cy`, `k` in worldFish.json), nicht des Laufzeitbildes.
// ---------------------------------------------------------------------------

export type WorldId = 'cheirolepis' | 'moythomasia' | 'elonichthys' | 'apsopelix' | 'gillicus' | 'enchodus' | 'protosphyraena' | 'xiphactinus';

interface Reg { cx: number; cy: number; k: number; w: number; h: number; bounds: [number, number, number, number] }
const REGS = data as unknown as Record<string, Reg>;

type PtKey = 'tail' | 'head' | 'eye' | 'hinge' | 'lip' | 'dorsal' | 'anal' | 'pelvic' | 'pectoral';

interface Profile {
  /** Ansatzpunkte in Pixeln des Originals (aus species_profiles.json; Flossenwurzeln werden an die Körperkante gelegt) */
  pts: Record<PtKey, P2>;
  /** Radius des gemalten Augapfels (Zeicheneinheiten) */
  eyeR: number;
  /** Kiefer: Tiefe (Einheiten), Stärke des Bisses (Morph.jaw), schwerer Sonderkiefer */
  jawH: number;
  jaw: number;
  heavyJaw?: boolean;
  /** Zähne (Stufe) – 0 keine */
  teeth: number;
  /** Flossen in Einheiten: Rückenflosse (Breite, Höhe), Afterflosse, Bauchflosse, Brustflosse (Länge) */
  fins: { dorsal: [number, number]; anal: [number, number]; pelvic: [number, number]; pec: number };
  /** Sonderteile */
  fang?: P2;
  specialAnal?: boolean;
  specialPec?: boolean;
  /** Maulspalte: Zusatzneigung (Bogenmaß), um das die gemessene Neigung ergänzt wird */
  jawTilt?: number;
}

export const PROFILES: Record<WorldId, Profile> = {
  cheirolepis: {
    pts: { tail: [409, 474], head: [1295, 444], eye: [1520, 464], hinge: [1426, 554], lip: [1646, 489], dorsal: [822, 324], anal: [773, 634], pelvic: [1066, 664], pectoral: [1344, 579] },
    eyeR: 2.0, jawH: 5.4, jaw: 0.35, teeth: 3,
    fins: { dorsal: [12, 9], anal: [9, 7], pelvic: [6, 6], pec: 12 },
  },
  moythomasia: {
    pts: { tail: [420, 499], head: [1296, 463], eye: [1483, 494], hinge: [1515, 550], lip: [1616, 540], dorsal: [858, 289], anal: [764, 673], pelvic: [1061, 714], pectoral: [1327, 612] },
    eyeR: 2.4, jawH: 4.6, jaw: 0, teeth: 0,
    fins: { dorsal: [15, 11], anal: [10, 9], pelvic: [6, 7], pec: 11 },
  },
  elonichthys: {
    pts: { tail: [374, 477], head: [1330, 445], eye: [1518, 480], hinge: [1527, 550], lip: [1653, 500], dorsal: [886, 340], anal: [771, 629], pelvic: [1067, 669], pectoral: [1330, 589] },
    eyeR: 2.1, jawH: 4.6, jaw: 0, teeth: 0,
    fins: { dorsal: [14, 9], anal: [9, 7], pelvic: [6, 6], pec: 11 },
  },
  apsopelix: {
    pts: { tail: [418, 406], head: [1549, 394], eye: [1766, 411], hinge: [1794, 479], lip: [1920, 406], dorsal: [1002, 191], anal: [852, 632], pelvic: [1229, 671], pectoral: [1568, 558] },
    eyeR: 2.4, jawH: 4.4, jaw: 0, teeth: 0,
    fins: { dorsal: [13, 10], anal: [9, 8], pelvic: [5, 6], pec: 10 },
  },
  gillicus: {
    pts: { tail: [380, 478], head: [1321, 459], eye: [1497, 496], hinge: [1545, 543], lip: [1636, 506], dorsal: [873, 317], anal: [930, 689], pelvic: [1129, 699], pectoral: [1369, 605] },
    eyeR: 2.1, jawH: 4.6, jaw: 0, teeth: 0,
    fins: { dorsal: [13, 10], anal: [28, 8], pelvic: [6, 6], pec: 11 },
    specialAnal: true,
  },
  enchodus: {
    pts: { tail: [443, 393], head: [1567, 387], eye: [1784, 387], hinge: [1646, 483], lip: [1995, 399], dorsal: [897, 309], anal: [759, 595], pelvic: [1173, 652], pectoral: [1567, 539] },
    eyeR: 2.0, jawH: 5.6, jaw: 0.5, teeth: 3,
    fins: { dorsal: [12, 9], anal: [9, 7], pelvic: [6, 6], pec: 12 },
    fang: [1950, 421],
  },
  protosphyraena: {
    pts: { tail: [374, 386], head: [1391, 386], eye: [1494, 370], hinge: [1453, 469], lip: [1700, 436], dorsal: [815, 276], anal: [650, 568], pelvic: [1103, 656], pectoral: [1391, 518] },
    eyeR: 1.7, jawH: 4.2, jaw: 0.3, teeth: 3,
    fins: { dorsal: [13, 9], anal: [6, 4], pelvic: [5, 4], pec: 22 },
    specialPec: true,
  },
  xiphactinus: {
    pts: { tail: [344, 484], head: [1306, 460], eye: [1517, 470], hinge: [1436, 588], lip: [1640, 504], dorsal: [838, 307], anal: [643, 652], pelvic: [1032, 706], pectoral: [1323, 622] },
    eyeR: 2.4, jawH: 8.2, jaw: 0.9, teeth: 5,
    fins: { dorsal: [14, 11], anal: [9, 8], pelvic: [6, 6], pec: 12 },
    heavyJaw: true,
  },
};

export const WORLD_FISH_IDS = Object.keys(PROFILES) as WorldId[];
const FORCE_OLD = typeof location !== 'undefined' && new URLSearchParams(location.search).has('oldworld');
/** Entwickler: ?oldworld zeigt die Weltfische wie früher (vorgemalte Bilder) – für Vergleiche und als Rückfall ohne WebGL */
export const isWorldFish = (id: string): id is WorldId => !FORCE_OLD && id in PROFILES;

const FILES = {
  cheirolepis: new URL('../../assets/fish/world/cheirolepis.webp', import.meta.url).href,
  moythomasia: new URL('../../assets/fish/world/moythomasia.webp', import.meta.url).href,
  elonichthys: new URL('../../assets/fish/world/elonichthys.webp', import.meta.url).href,
  apsopelix: new URL('../../assets/fish/world/apsopelix.webp', import.meta.url).href,
  gillicus: new URL('../../assets/fish/world/gillicus.webp', import.meta.url).href,
  enchodus: new URL('../../assets/fish/world/enchodus.webp', import.meta.url).href,
  protosphyraena: new URL('../../assets/fish/world/protosphyraena.webp', import.meta.url).href,
  xiphactinus: new URL('../../assets/fish/world/xiphactinus.webp', import.meta.url).href,
  protosphyraena_pectoral: new URL('../../assets/fish/world/protosphyraena_pectoral.webp', import.meta.url).href,
  gillicus_anal: new URL('../../assets/fish/world/gillicus_anal.webp', import.meta.url).href,
  xiphactinus_jaw: new URL('../../assets/fish/world/xiphactinus_jaw.webp', import.meta.url).href,
  enchodus_fang: new URL('../../assets/fish/world/enchodus_fang.webp', import.meta.url).href,
};
type FileKey = keyof typeof FILES;
const tkey = (k: FileKey) => 'wfp_' + k;

export function preloadWorldFish(scene: Phaser.Scene) {
  for (const k of Object.keys(FILES) as FileKey[]) if (!scene.textures.exists(tkey(k))) scene.load.image(tkey(k), FILES[k]);
}

export const worldFishReady = (scene: Phaser.Scene) => paintedReady(scene) && (Object.keys(FILES) as FileKey[]).every((k) => scene.textures.exists(tkey(k)));

type Img = HTMLImageElement | HTMLCanvasElement;
const imgOf = (scene: Phaser.Scene, k: FileKey) => scene.textures.get(tkey(k)).getSourceImage() as Img;

// ---------------------------------------------------------------------------
// Bilder verkleinert zeichnen: Das Ziel braucht oft ein Zehntel der Pixel; in Stufen halbieren glättet ohne Flimmern.

const mipCache = new WeakMap<object, Img[]>();
function mipFor(img: Img, wantW: number): Img {
  let levels = mipCache.get(img);
  if (!levels) mipCache.set(img, (levels = [img]));
  let cur = levels[levels.length - 1];
  let i = levels.length - 1;
  while (cur.width * 0.5 >= wantW * 1.2 && cur.width > 8) {
    const [c, x] = newCanvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, c.width, c.height);
    levels.push(c);
    cur = c;
    i++;
  }
  // die kleinste Stufe, die noch mindestens wantW Pixel breit ist
  let pick = levels[0];
  for (const l of levels) if (l.width >= wantW) pick = l;
  void i;
  return pick;
}

/** Zeichnet das Bild in das Rechteck (Einheiten) von ctx; wählt dafür die passende Verkleinerungsstufe. */
function drawFit(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number) {
  const scale = Math.abs(ctx.getTransform().a);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mipFor(img, Math.max(2, w * scale)), x, y, w, h);
}

// ---------------------------------------------------------------------------
// Körperkanten aus der Alpha-Maske des gemalten Körpers (Pixel des Originals)

interface Alpha { top: (x: number) => number; bottom: (x: number) => number; ext: (x0: number, x1: number) => number }
const alphaCache = new Map<string, Alpha>();

function alphaOf(scene: Phaser.Scene, id: WorldId): Alpha {
  const hit = alphaCache.get(id);
  if (hit) return hit;
  const R = REGS[id], img = imgOf(scene, id);
  const W = Math.min(img.width, 400), H = Math.max(1, Math.round((img.height * W) / img.width));
  const [, x] = newCanvas(W, H, true);
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  // Pixel des Originals → Spalte der Maske
  const colOf = (px: number) => Math.max(0, Math.min(W - 1, Math.round(((px - R.cx) * R.k * W) / img.width)));
  const rowToOrig = (r: number) => (r * img.height) / H / R.k + R.cy;
  const edge = (px: number, up: boolean) => {
    const col = colOf(px);
    if (up) for (let r = 0; r < H; r++) if (d[(r * W + col) * 4 + 3] > 128) return rowToOrig(r);
    if (!up) for (let r = H - 1; r >= 0; r--) if (d[(r * W + col) * 4 + 3] > 128) return rowToOrig(r + 1);
    return rowToOrig(H / 2);
  };
  const a: Alpha = {
    top: (px) => edge(px, true),
    bottom: (px) => edge(px, false),
    // größte Höhe (Pixel des Originals) zwischen zwei Spalten
    ext: (p0, p1) => {
      let m = 0;
      const a0 = colOf(Math.min(p0, p1)), a1 = colOf(Math.max(p0, p1));
      for (let col = a0; col <= a1; col++) {
        let t = -1, b = -1;
        for (let r = 0; r < H; r++) if (d[(r * W + col) * 4 + 3] > 128) { if (t < 0) t = r; b = r; }
        if (t >= 0) m = Math.max(m, ((b - t + 1) * img.height) / H / R.k);
      }
      return m;
    },
  };
  alphaCache.set(id, a);
  return a;
}

// ---------------------------------------------------------------------------
// Anatomie der festen Art

export interface WorldSpec {
  id: WorldId;
  A: FishAnatomy;
  P: Pal;
  prof: Profile;
  /** Pixel des Originals → Einheiten: u = (p − ref) · U */
  U: number;
  ref: P2;
}

const LEN_UNITS = 90;

function worldMorph(prof: Profile, id: WorldId): Morph {
  let seed = 1;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return { cls: 'fish', size: 1, jaw: prof.jaw, skull: 0, stealth: 0, diet: prof.teeth ? 1 : -0.5, scars: 0, belly: 1, fierce: 0, hue: 0, seed: seed % 997, sex: 0, toothTier: 0, spike: 0 } as Morph;
}

export function worldPalette(def: SpeciesDef): Pal {
  const art = def.art as { c: number; belly: number; fin: number };
  return { base: art.c, belly: art.belly, dark: shade(art.c, -0.6), camo: shade(art.c, -0.4), eye: 0xe0c070, fin: mix(art.fin, art.belly, 0.35) };
}

/** Reine Maße einer Art aus der Registrierung (ohne Bild): Einheiten je Pixel, Körperlänge, Maul – dieselbe Rechnung wie worldSpec. */
export function profileMetrics(id: WorldId) {
  const prof = PROFILES[id], R = REGS[id];
  const U = LEN_UNITS / (R.bounds[2] - R.bounds[0]);
  const hinge: P2 = [prof.pts.hinge[0] * U, prof.pts.hinge[1] * U], tip: P2 = [prof.pts.lip[0] * U, prof.pts.lip[1] * U];
  return {
    U,
    bw: (prof.pts.head[0] - prof.pts.tail[0]) * U,
    jawLen: Math.hypot(tip[0] - hinge[0], tip[1] - hinge[1]) * 0.99,
    jawRest: Math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]) + (prof.jawTilt ?? 0),
  };
}

/** Anatomie und Registrierung einer Art; `texW` ist die Breite der alten Textur (Pixel) – daraus folgt der Maßstab (Pixel je Einheit). */
export function worldSpec(scene: Phaser.Scene, def: SpeciesDef, texW: number): WorldSpec {
  const id = def.id as WorldId, prof = PROFILES[id], R = REGS[id];
  const al = alphaOf(scene, id);
  const bw0 = R.bounds[2] - R.bounds[0];
  const U = LEN_UNITS / bw0;
  const mid = (prof.pts.tail[0] + prof.pts.head[0]) / 2, axis = prof.pts.tail[1];
  const ref: P2 = [mid, axis];
  const u = (p: P2): P2 => [(p[0] - mid) * U, (p[1] - axis) * U];
  const bw = (prof.pts.head[0] - prof.pts.tail[0]) * U;
  const hxU = u(prof.pts.head)[0];
  const top = (x: number) => (al.top(x) - axis) * U, bot = (x: number) => (al.bottom(x) - axis) * U;
  const hy = (top(prof.pts.head[0]) + bot(prof.pts.head[0])) / 2;
  const H = bot(prof.pts.head[0]) - top(prof.pts.head[0]);
  const hinge = u(prof.pts.hinge), tip = u(prof.pts.lip), eyeP = u(prof.pts.eye);
  const jawRest = Math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]) + (prof.jawTilt ?? 0);
  const jawLen = Math.hypot(tip[0] - hinge[0], tip[1] - hinge[1]) * 0.99;
  const bounds = { x0: (R.bounds[0] - mid) * U - 3, x1: (R.bounds[2] - mid) * U + 3, y0: (R.bounds[1] - axis) * U - 3, y1: (R.bounds[3] - axis) * U + 3 };
  const bh = al.ext(prof.pts.tail[0] + 80, prof.pts.head[0]) * U * 0.5;
  const pedH = Math.max(1.6, (al.bottom(prof.pts.tail[0] + 20) - al.top(prof.pts.tail[0] + 20)) * U * 0.5);
  const spread = Math.max(6, al.ext(R.bounds[0], prof.pts.tail[0] - 40) * U * 0.5);
  // Flossenansätze: unter der Haut, an der Körperkante der Art
  const edge = (p: P2, up: boolean): P2 => { const q = u(p); return [q[0], up ? top(p[0]) + 2.4 : bot(p[0]) - 2.4]; };
  const mk = (at: P2, base: number, len: number): FinSpec => ({ k: 1, at, base, len });
  const pec = u(prof.pts.pectoral);
  const pecAt: P2 = [pec[0], Math.max(top(prof.pts.pectoral[0]) + 3, Math.min(bot(prof.pts.pectoral[0]) - 3, pec[1]))];
  const hg = { L: tip[0] - hxU, H, mouthY: hinge[1] - hy, hingeX: hinge[0] - hxU, jawH: prof.jawH, dome: 0, snoutH: H * 0.3, ex: eyeP[0] - hxU, ey: eyeP[1] - hy, er: 2 };
  const m = worldMorph(prof, id);
  const A: FishAnatomy = {
    m, s: texW / LEN_UNITS, bw, bh, bb: bh, hx: hxU, hy, hg, pedH, pedX: u(prof.pts.tail)[0],
    tail: { lobe: u(prof.pts.tail)[0] - bounds.x0, spread, fork: 3, up: 0.14 },
    hinge, tip, jawLen, jawH: prof.jawH, jawRest,
    loop: [[bounds.x0, bounds.y0], [bounds.x1, bounds.y0], [bounds.x1, bounds.y1], [bounds.x0, bounds.y1]],
    eye: { x: eyeP[0], y: eyeP[1], r: 2 },
    eyeK: prof.eyeR / 2.6,
    plate: 0,
    dorsal: mk(edge(prof.pts.dorsal, true), prof.fins.dorsal[0], prof.fins.dorsal[1]),
    anal: mk(edge(prof.pts.anal, false), prof.fins.anal[0], prof.fins.anal[1]),
    pelvic: mk(edge(prof.pts.pelvic, false), prof.fins.pelvic[0], prof.fins.pelvic[1]),
    pectoral: { ...mk(pecAt, 6, prof.fins.pec), lobed: false },
    bounds,
    anchorX: hxU - bw * 0.22,
    neckX: hxU - bw * 0.06,
  };
  return { id, A, P: worldPalette(def), prof, U, ref };
}

// ---------------------------------------------------------------------------
// Zeichnung

/** Alpha des Körperbildes dort abschwächen, wo der bewegliche Unterkiefer sitzt (unterhalb der Maulspalte, vor dem Gelenk). */
function cutJaw(c: Ctx, S: WorldSpec) {
  const A = S.A, t = c.getTransform();
  const cv = c.canvas, id = c.getImageData(0, 0, cv.width, cv.height), d = id.data;
  const ca = Math.cos(A.jawRest ?? 0), sa = Math.sin(A.jawRest ?? 0);
  const sm = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  for (let j = 0; j < cv.height; j++) {
    for (let i = 0; i < cv.width; i++) {
      const o = (j * cv.width + i) * 4;
      if (!d[o + 3]) continue;
      const x = (i + 0.5 - t.e) / t.a, y = (j + 0.5 - t.f) / t.d;
      const dx = x - A.hinge[0], dy = y - A.hinge[1];
      const along = dx * ca + dy * sa, perp = -dx * sa + dy * ca;
      // unter der Lippenlinie (perp > 0), von kurz hinter dem Gelenk an nach vorn: weich ausgeblendet
      const f = sm(-0.5, 0.9, perp) * sm(-2.6, 0.4, along);
      if (f > 0) d[o + 3] = Math.round(d[o + 3] * (1 - f));
    }
  }
  c.putImageData(id, 0, 0);
}

function paintWorldBody(ctx: Ctx, scene: Phaser.Scene, S: WorldSpec) {
  const { A, id, prof, U, ref } = S, R = REGS[id];
  // Zähne (und Fangzahn) zuerst: Die Oberlippe des Körpers deckt ihre Wurzeln
  if (prof.teeth) paintLipTeeth(ctx, A, prof.teeth);
  if (prof.fang) drawFang(ctx, scene, S);
  const [lay, lx] = newCanvas(ctx.canvas.width, ctx.canvas.height, true);
  lx.setTransform(ctx.getTransform());
  const img = imgOf(scene, id);
  drawFit(lx, img, (R.cx - ref[0]) * U, (R.cy - ref[1]) * U, (img.width / R.k) * U, (img.height / R.k) * U);
  cutJaw(lx, S);
  // die Lippenlinie: eine feine Tuschelinie vom Maulwinkel zur Schnauze (die Maulspalte)
  lx.save();
  lx.beginPath();
  lx.moveTo(A.hinge[0] - 0.4, A.hinge[1]);
  lx.lineTo(A.tip[0], A.tip[1]);
  lx.strokeStyle = css(INK, 0.78);
  lx.lineWidth = 0.55;
  lx.lineCap = 'round';
  lx.stroke();
  lx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lay, 0, 0);
  ctx.restore();
}

/** Kleine, spitze Zähne an der Oberlippe: die Wurzeln unter der Lippenlinie (den schrägen Maulwinkel entlang), vorn die längsten. */
function paintLipTeeth(ctx: Ctx, A: FishAnatomy, n: number) {
  const a = A.jawRest ?? 0, ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, d = A.jawLen * (0.3 + 0.62 * t);
    const x = A.hinge[0] + d * ca, y = A.hinge[1] + d * sa;
    const len = 1.2 + 1.1 * t, w = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - 0.5);
    ctx.lineTo(x - 0.15 * len, y + len);
    ctx.lineTo(x + w / 2, y - 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(238,232,216,0.97)';
    ctx.fill();
    ctx.strokeStyle = css(INK, 0.65);
    ctx.lineWidth = 0.25;
    ctx.stroke();
  }
}

/** Der Fangzahn hängt am oberen Gaumen: Teil der ruhigen Kopfzeichnung, dreht sich nie mit dem Unterkiefer. */
function drawFang(ctx: Ctx, scene: Phaser.Scene, S: WorldSpec) {
  const img = imgOf(scene, 'enchodus_fang');
  const root = S.prof.fang!, rootU: P2 = [(root[0] - S.ref[0]) * S.U, (root[1] - S.ref[1]) * S.U];
  const len = 7.4; // Einheiten von der Wurzel bis zur Spitze
  const b = REGS['enchodus_fang'].bounds, w0 = b[2] - b[0], h0 = b[3] - b[1];
  const k = len / (h0 * 0.955);
  const w = w0 * k, h = h0 * k;
  // Wurzel im Bild: u 0,62, v 0,035
  drawFit(ctx, img, rootU[0] - w * 0.62 - 0.4, rootU[1] - h * 0.035 + 0.3, w, h);
}

function paintHeavyJaw(ctx: Ctx, scene: Phaser.Scene, S: WorldSpec) {
  const A = S.A, img = imgOf(scene, 'xiphactinus_jaw'), R = REGS['xiphactinus_jaw'];
  // Gelenk (u 0,035 / v 0,2) links, Lippenspitze (u 0,975 / v 0,32) rechts: Das Bild wird so gelegt, dass diese Linie auf der x-Achse des Kiefers liegt
  const bw = R.bounds[2] - R.bounds[0], bh = R.bounds[3] - R.bounds[1];
  const px = R.bounds[0] + 0.035 * bw, py = R.bounds[1] + 0.2 * bh;
  const qx = R.bounds[0] + 0.975 * bw, qy = R.bounds[1] + 0.32 * bh;
  const ang = Math.atan2(qy - py, qx - px), dist = Math.hypot(qx - px, qy - py);
  // der schwere Unterkiefer ragt (wie in der Vorlage) ein Stück über die Oberlippe hinaus
  const k = (A.jawLen * 1.2) / dist;
  const F = fillBase(S);
  const [lay, lx] = newCanvas(ctx.canvas.width, ctx.canvas.height, true);
  lx.setTransform(ctx.getTransform());
  lx.translate(0, -0.2);
  lx.rotate(-ang);
  drawFit(lx, img, (R.cx - px) * k, (R.cy - py) * k, (img.width / R.k) * k, (img.height / R.k) * k);
  // untere Zähne
  lx.setTransform(ctx.getTransform());
  void F;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lay, 0, 0);
  ctx.restore();
  // Zähne im Kiefer (wachsen aus der Oberkante)
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = A.jawLen * (0.3 + 0.62 * t);
    ctx.beginPath();
    ctx.moveTo(x - 0.45, 0.4);
    ctx.lineTo(x - 0.1, -1.5 - 0.6 * t);
    ctx.lineTo(x + 0.45, 0.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(236,230,214,0.96)';
    ctx.fill();
    ctx.strokeStyle = css(INK, 0.7);
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
}

const fillBase = (S: WorldSpec) => S.P.base;

/** Sonderflosse (Gillicus-After, Protosphyraena-Brust): das Bild füllt den Rahmen der Flosse. */
function paintSpecialFin(ctx: Ctx, scene: Phaser.Scene, key: FileKey, box: Box, to: [number, number, number, number], tintTo: number | null) {
  const img = imgOf(scene, key);
  const [lay, lx] = newCanvas(ctx.canvas.width, ctx.canvas.height, true);
  lx.setTransform(ctx.getTransform());
  const R = REGS[key];
  const bw = R.bounds[2] - R.bounds[0], bh = R.bounds[3] - R.bounds[1];
  const sx = (to[2] - to[0]) / bw, sy = (to[3] - to[1]) / bh;
  drawFit(lx, img, to[0] + (R.cx - R.bounds[0]) * sx, to[1] + (R.cy - R.bounds[1]) * sy, (img.width / R.k) * sx, (img.height / R.k) * sy);
  void box;
  void tintTo;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lay, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// alle Texturen einer Art (einmal je Art)

const cache = new Map<string, { T: FishTex; S: WorldSpec }>();

export function worldFishTex(scene: Phaser.Scene, def: SpeciesDef, texW: number): { T: FishTex; S: WorldSpec } {
  const hit = cache.get(def.id);
  if (hit && scene.textures.exists(hit.T.keys.body)) return hit;
  const S = worldSpec(scene, def, texW);
  const { A, P, prof } = S, s = A.s, id = 'wf_' + def.id;
  const eyeB = eyeBox(A);
  const ovBox: Box = { x0: A.hx - 13, x1: A.hx + 9, y0: A.hy - A.hg.H * 0.34, y1: A.hy + A.hg.H * 0.54 };
  const jawBox: Box = { x0: -4, x1: A.jawLen + 4, y0: -5, y1: A.jawH + 3 };
  const dBox = finBox('dorsal', A.dorsal), aBox = finBox('anal', A.anal), vBox = finBox('pelvic', A.pelvic), pBox = finBox('pectoral', A.pectoral);
  const keys = {
    body: makeTex(scene, id + '_fb', A.bounds, s, (ctx) => paintWorldBody(ctx, scene, S)),
    eye: makeTex(scene, id + '_fe', eyeB, s, (ctx) => paintEyePainted(ctx, scene, A, P)),
    overlay: makeTex(scene, id + '_fo', ovBox, s, (ctx) => paintOverlayPainted(ctx, scene, A, P)),
    jaw: makeTex(scene, id + '_fj', jawBox, s, (ctx) => (prof.heavyJaw ? paintHeavyJaw(ctx, scene, S) : paintJawPainted(ctx, scene, A, P))),
    dorsal: makeTex(scene, id + '_fd', dBox, s, (ctx) => paintFinPainted(ctx, scene, 'dorsal', A, P)),
    anal: makeTex(scene, id + '_fa', aBox, s, (ctx) => (prof.specialAnal
      ? paintSpecialFin(ctx, scene, 'gillicus_anal', aBox, [-A.anal.base * 0.5, -1.2, A.anal.base * 0.5, A.anal.len], null)
      : paintFinPainted(ctx, scene, 'anal', A, P))),
    pelvic: makeTex(scene, id + '_fv', vBox, s, (ctx) => paintFinPainted(ctx, scene, 'pelvic', A, P)),
    pec: makeTex(scene, id + '_fp', pBox, s, (ctx) => (prof.specialPec
      ? paintSpecialFin(ctx, scene, 'protosphyraena_pectoral', pBox, [-A.pectoral.len * 1.02, -1.5, 1.5, -1.5 + A.pectoral.len * 0.78], null)
      : paintFinPainted(ctx, scene, 'pectoral', A, P))),
    pecFar: makeTex(scene, id + '_fq', pBox, s, (ctx) => (prof.specialPec
      ? paintSpecialFin(ctx, scene, 'protosphyraena_pectoral', pBox, [-A.pectoral.len * 1.02, -1.5, 1.5, -1.5 + A.pectoral.len * 0.78], null)
      : paintFinPainted(ctx, scene, 'pectoral', A, P, true))),
  };
  const T: FishTex = {
    A, keys,
    box: { body: A.bounds, eye: eyeB, overlay: ovBox, jaw: jawBox, dorsal: dBox, anal: aBox, pelvic: vBox, pec: pBox },
    lid: P.base, lidEdge: P.dark,
  };
  const out = { T, S };
  cache.set(def.id, out);
  void lightOf; void shadowOf; void jawLongWeight; void FISH_RES;
  return out;
}
