import Phaser from 'phaser';
import type { Theme } from '../data/epochs';
import type { Cave, CaveWall, LevelData, MatSpec } from '../level/LevelGen';
import { groundCurve, rockBottom, rockOutline, type Material, type Poly, type RockSpec, type TerrainZone } from '../level/terrain';
import { css, mix, shade } from '../util/color';
import { type Ctx, addTex, newCanvas, smooth, vgrad } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { innerShade, pattern, softShadow, type NoiseKind } from './paint';

// Der Meeresboden wird in unveränderten 640-Pixel-Stücken gemalt. Kühle Stahl-/Violettflächen, abgestufte Schatten,
// Cyan-Lippen und vereinzelte warme Mineraladern geben der Welt die klare Lesbarkeit eines 16-Bit-Actionspiels.
// Fugen und Facetten sind reine Textur; Umrisse, Hitboxen und Levelgeometrie kommen unverändert aus LevelData.

const TAU = Math.PI * 2;
const CHUNK = 640;
/** Wie tief das gemalte Bodenstück unter die Oberfläche reicht (darunter liegt eine einfarbige Fläche). */
const SKIN = 190;
/** halbe Breite der Übergänge zwischen Sand, Fels und Schlamm */
const BLEND = 70;

interface Mat {
  top: number;
  mid: number;
  deep: number;
}

const OCEAN: Record<Material, Mat> = {
  sand: { top: 0x4488af, mid: 0x274971, deep: 0x121e40 },
  rock: { top: 0x6273b2, mid: 0x333c6e, deep: 0x1b2348 },
  mud: { top: 0x535084, mid: 0x302951, deep: 0x15142e },
};
/** Die Farbe, in der jedes Bodenstück unten ausläuft */
const DEEP = 0x080e24;
const TINT: Record<Theme, number> = { ozean: 0x000000, sumpf: 0x265867, reptil: 0x70435f, eis: 0x70ceea, eden: 0x486993 };

/** Farben eines Materials – je nach Ort (Variante 1: bewachsen, grünlich; 2: tief, dunkel und bläulich). */
function colors(theme: Theme, variant: number, m: Material): Mat {
  const base = OCEAN[m];
  const tint = (c: number) => {
    let o = theme === 'ozean' ? c : mix(c, TINT[theme], 0.4);
    if (variant === 1) o = mix(o, m === 'rock' ? 0x24566f : 0x287c82, m === 'rock' ? 0.14 : 0.26);
    else if (variant === 2) o = shade(mix(o, 0x171c49, 0.3), -0.1);
    return o;
  };
  return { top: tint(base.top), mid: tint(base.mid), deep: tint(base.deep) };
}

const deepColor = (theme: Theme, variant: number) => {
  let c = theme === 'ozean' ? DEEP : mix(DEEP, TINT[theme], 0.2);
  if (variant === 2) c = shade(mix(c, 0x0a1620, 0.3), -0.05);
  return c;
};

/** Farbe in der Tiefe u (0 = Oberfläche, 1 = ganz unten): oben hell, dann das Material, dann die gemeinsame Tiefenfarbe. */
function depthColor(m: Mat, deep: number, u: number) {
  u = Math.floor(u * 8) / 8;
  if (u < 0.3) return mix(m.top, m.mid, u / 0.3);
  if (u < 0.75) return mix(m.mid, m.deep, (u - 0.3) / 0.45);
  return mix(m.deep, deep, (u - 0.75) / 0.25);
}

// ---------------------------------------------------------------------------
// Felsen

/** Ein Vieleck mit gerundeten Ecken (Radius r). */
function roundedPoly(ctx: Ctx, pts: Poly, r: number) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i + n - 1) % n], [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const a = Math.hypot(x1 - x0, y1 - y0), b = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.min(r, a / 2, b / 2);
    const sx = x1 + ((x0 - x1) / (a || 1)) * k, sy = y1 + ((y0 - y1) / (a || 1)) * k;
    const ex = x1 + ((x2 - x1) / (b || 1)) * k, ey = y1 + ((y2 - y1) / (b || 1)) * k;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
    ctx.quadraticCurveTo(x1, y1, ex, ey);
  }
  ctx.closePath();
}

export interface RockLook {
  theme: Theme;
  variant: number;
  /** dunkle Silhouette im Vordergrund */
  dark?: boolean;
}

const TONES = [0x477caa, 0x365685, 0x252e57];

/** Sparse, snapped panel seams and mineral inlays, clipped by the caller to the existing terrain silhouette. */
function inlays(ctx: Ctx, x0: number, y0: number, width: number, height: number, seed: number, dark = false) {
  const q = mulberry32(seed ^ 0x53a9be7);
  const step = 64;
  for (let y = Math.ceil(y0 / 40) * 40; y < y0 + height; y += 40) {
    const offset = Math.floor(q() * 3) * 16;
    for (let x = Math.floor(x0 / step) * step + offset; x < x0 + width; x += step + 16) {
      if (q() < 0.4) continue;
      const w = 32 + Math.floor(q() * 3) * 8;
      ctx.fillStyle = dark ? 'rgba(4,9,28,0.5)' : 'rgba(4,9,28,0.7)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x + w - 2, y + 2, 2, 12);
      ctx.fillStyle = dark ? 'rgba(61,105,143,0.18)' : 'rgba(97,165,208,0.25)';
      ctx.fillRect(x + 2, y + 2, w - 6, 2);
      ctx.fillRect(x + w, y + 2, 2, 12);
      if (!dark && q() < 0.3) {
        ctx.fillStyle = '#a45c41';
        ctx.fillRect(x + 7, y - 8, 12, 4);
        ctx.fillStyle = '#e99a55';
        ctx.fillRect(x + 11, y - 8, 4, 2);
      }
      ctx.fillStyle = dark ? 'rgba(29,61,94,0.35)' : 'rgba(115,171,211,0.45)';
      ctx.fillRect(x + 4, y + 7, 3, 3);
    }
  }
}

/** Einen Felsen in Weltkoordinaten malen (die Leinwand ist so verschoben, dass sie passen). */
function paintRock(ctx: Ctx, s: RockSpec, look: RockLook) {
  const r = mulberry32(s.seed ^ 0x9e3779b9);
  const outline = rockOutline(s);
  const pts = outline.map(([x, y]) => [s.x + x, s.y + y] as [number, number]);
  const form = s.form ?? 'boulder';
  const path = () => {
    if (form === 'boulder') smooth(ctx, pts, true);
    else roundedPoly(ctx, pts, form === 'slab' ? 9 : 16);
  };
  let base = TONES[Math.max(0, Math.min(2, s.tone))];
  if (look.variant === 1) base = mix(base, 0x267b83, 0.16);
  else if (look.variant === 2) base = shade(mix(base, 0x10202e, 0.3), -0.1);
  if (look.theme !== 'ozean') base = mix(base, TINT[look.theme], 0.3);
  if (look.dark) base = shade(mix(base, 0x0c1a22, 0.35), -0.3);
  const top = s.y - s.ry, bot = s.y + s.ry, ht = Math.max(8, s.ry * 2);
  if (form === 'boulder') softShadow(ctx, s.x, s.y + rockBottom(outline) - 2, s.rx * 1.12, Math.max(4, s.ry * 0.2), look.dark ? 0.3 : 0.5);
  path();
  const bright = css(shade(base, 0.28)), mid = css(base), low = css(shade(base, -0.18)), dark = css(shade(base, -0.48));
  ctx.fillStyle = vgrad(ctx, top, bot, [[0, bright], [0.17, bright], [0.17, mid], [0.45, mid], [0.45, low], [0.75, low], [0.75, dark], [1, dark]]);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  const box = (fn: () => void) => {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    fn();
    ctx.restore();
  };
  const fillBox = () => ctx.fillRect(s.x - s.rx - 4, top - 4, s.rx * 2 + 8, ht + 8);
  // Gesteinsstruktur
  box(() => {
    ctx.globalAlpha = look.dark ? 0.28 : 0.35;
    ctx.fillStyle = pattern(ctx, 'stone', s.rx < 40 ? 0.7 : 0.5, (s.seed % 97) * 3, (s.seed % 89) * 3);
    fillBox();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = pattern(ctx, 'mottle', 0.6, (s.seed % 53) * 5, (s.seed % 41) * 5);
    fillBox();
  });
  inlays(ctx, s.x - s.rx, top + 8, s.rx * 2, ht * 0.75, s.seed, look.dark);
  // Schichten: Platten und Bögen sind geschichtet, große Brocken haben ein paar Bänder
  const layers = form === 'boulder' ? (s.rx > 70 ? 3 : 0) : Math.max(3, Math.round(ht / 26));
  ctx.lineCap = 'round';
  for (let k = 0; k < layers; k++) {
    const y = top + ((k + 0.6 + r() * 0.6) / (layers + 0.6)) * ht;
    const x0 = s.x - s.rx - 6, x1 = s.x + s.rx + 6;
    const wob = (r() - 0.5) * 12;
    ctx.beginPath();
    ctx.moveTo(x0, y + wob);
    ctx.bezierCurveTo(x0 + (x1 - x0) * 0.33, y - wob, x0 + (x1 - x0) * 0.66, y + wob * 0.6, x1, y - wob * 0.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.translate(0, 2.4);
    ctx.strokeStyle = 'rgba(130,202,255,0.17)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.translate(0, -2.4);
  }
  // Risse
  for (let k = 0, n = form === 'boulder' ? Math.round(s.rx / 40) : 3; k < n; k++) {
    let x = s.x + (r() - 0.5) * s.rx * 1.4, y = top + ht * (0.15 + r() * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (r() - 0.5) * 16;
      y += 7 + r() * 12;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(4,8,8,0.55)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  // Bewuchs oben: dünner Algenfilm, in bewachsenen Orten kräftiger
  if (!look.dark && form !== 'arch') {
    const moss = look.variant === 1 ? 0.7 : s.tone === 0 ? 0.12 : 0.3;
    for (let k = 0, n = Math.round((s.rx / 14) * moss * 2); k < n; k++) {
      const x = s.x + (r() * 2 - 1) * s.rx * 0.85;
      const y = top + ht * (0.04 + r() * 0.22);
      const rad = 4 + Math.floor(r() * 3) * 4;
      ctx.fillStyle = css(0x3fa89e, 0.25 + 0.3 * moss);
      ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, rad, 4);
      ctx.fillStyle = css(0x89d7ce, 0.2 + 0.2 * moss);
      ctx.fillRect(Math.round(x / 4) * 4 + 4, Math.round(y / 4) * 4, 4, 2);
    }
  }
  // Sand am Fuß – der Felsen steckt im Boden
  if (form === 'boulder') {
    const sand = colors(look.theme, look.variant, 'sand').top;
    ctx.fillStyle = vgrad(ctx, bot - ht * 0.34, bot, [[0, css(sand, 0)], [1, css(sand, look.dark ? 0.3 : 0.6)]]);
    ctx.fillRect(s.x - s.rx - 4, bot - ht * 0.34, s.rx * 2 + 8, ht * 0.34 + 4);
  }
  // weiche Schatten an den Kanten, Licht von oben
  innerShade(ctx, path, path, 'rgba(0,0,0,0.55)', ht * 0.22, 0, -ht * 0.12, ht * 0.12);
  innerShade(ctx, path, path, 'rgba(0,0,0,0.3)', ht * 0.07, 0, 0, ht * 0.05);
  innerShade(ctx, path, path, look.dark ? 'rgba(70,120,185,0.18)' : 'rgba(117,207,255,0.3)', ht * 0.1, 0, ht * 0.08, ht * 0.05);
  ctx.restore();
  path();
  ctx.strokeStyle = 'rgba(3,8,25,0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(s.x - s.rx - 6, top - 6, s.rx * 2 + 12, ht * 0.36);
  ctx.clip();
  path();
  ctx.strokeStyle = look.dark ? 'rgba(77,134,185,0.28)' : 'rgba(110,221,248,0.65)';
  ctx.lineWidth = look.dark ? 1.5 : 2.5;
  ctx.stroke();
  ctx.restore();
  if (form === 'arch') {
    // die Pfeiler stecken im Boden: unten blenden sie in den Boden aus
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vgrad(ctx, bot - 26, bot, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillRect(s.x - s.rx - 4, bot - 26, s.rx * 2 + 8, 30);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Mikrobenmatten

const MAT_TONES = [
  { base: 0x248976, light: 0x77e5c2, dark: 0x16383e }, // türkis
  { base: 0x754ba3, light: 0xc993ec, dark: 0x33244c }, // violett
  { base: 0x9a4b85, light: 0xee93cb, dark: 0x492640 }, // magenta
  { base: 0xad6737, light: 0xffbd65, dark: 0x502e2e }, // bernstein
];

/** Eine Matte: ein dünner, runzliger Belag, der der Bodenlinie folgt – an den Rändern auslaufend, mit Gasbläschen. */
function paintMat(ctx: Ctx, hp: number[], m: MatSpec) {
  const q = mulberry32(m.seed);
  const t = MAT_TONES[m.tone % MAT_TONES.length];
  const n = Math.ceil((m.x1 - m.x0) / 4);
  const top: number[][] = [], bot: number[][] = [], thick: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = m.x0 + (m.x1 - m.x0) * (i / n);
    const taper = Math.pow(Math.sin((i / n) * Math.PI), 0.55);
    const th = Math.max(0.5, (3 + 2.2 * Math.sin(x * 0.17 + (m.seed % 97)) + 1.4 * Math.sin(x * 0.43)) * taper);
    const y = groundCurve(hp, x);
    top.push([x, y - th]);
    bot.push([x, y + 4.5 * taper + 0.6]);
    thick.push(th);
  }
  ctx.beginPath();
  top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(m.x0, 0, m.x1, 0);
  g.addColorStop(0, css(t.base, 0.2));
  g.addColorStop(0.12, css(t.base, 0.92));
  g.addColorStop(0.5, css(mix(t.base, t.light, 0.35), 0.95));
  g.addColorStop(0.88, css(t.base, 0.92));
  g.addColorStop(1, css(t.base, 0.2));
  ctx.fillStyle = g;
  ctx.fill();
  // Runzeln: kurze helle Striche quer zur Matte, dazwischen dunkle Fugen
  for (let i = 3; i < n - 2; i += 2 + Math.floor(q() * 3)) {
    const [x, y] = top[i];
    ctx.beginPath();
    ctx.moveTo(x, y + 0.6);
    ctx.lineTo(x + (q() - 0.5) * 3, y + 0.6 + thick[i] * 0.9 + 1.5);
    ctx.strokeStyle = css(t.dark, 0.32);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1.4, y + 0.3);
    ctx.lineTo(x + 1.8, y + 1.3);
    ctx.strokeStyle = css(t.light, 0.5);
    ctx.stroke();
  }
  // der obere Rand: heller Saum
  ctx.beginPath();
  top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = css(t.light, 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Gasbläschen: Sauerstoff, den die Mikroben abgeben, hebt den Belag zu kleinen Blasen
  for (let i = 6; i < n - 5; i += 8 + Math.floor(q() * 10)) {
    if (q() < 0.35) continue;
    const [x, y] = top[i];
    const r = 1.8 + q() * 2.6;
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.2, r * 1.15, r, 0, Math.PI, TAU);
    ctx.lineTo(x + r * 1.15, y + 0.8);
    ctx.lineTo(x - r * 1.15, y + 0.8);
    ctx.closePath();
    ctx.fillStyle = css(mix(t.base, t.light, 0.6), 0.9);
    ctx.fill();
    ctx.strokeStyle = css(t.dark, 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.65, r * 0.28, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,240,0.55)';
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Bodenstücke

export interface ArtPiece {
  key: string;
  /** linke obere Ecke (Welt) und Anzeigegröße */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TerrainArt {
  chunks: (ArtPiece & { deepY: number })[];
  rocks: ArtPiece[];
  fore: ArtPiece[];
  deep: number;
  /** alle angelegten Texturen – am Ende der Szene wieder zu entfernen */
  keys: string[];
}

/** Ein kleines Rauschbild, nur der Maske wegen: in Zonen eines Materials 1, sonst 0, an den Rändern weich. */
function maskGradient(ctx: Ctx, width: number, zones: TerrainZone[], mats: Material[]) {
  // der Verlauf liegt über der ganzen Breite des Ortes, damit er an den Stückgrenzen nahtlos weiterläuft
  const g = ctx.createLinearGradient(0, 0, width, 0);
  const at = (x: number) => Math.max(0, Math.min(1, x / width));
  const stops: [number, number][] = [];
  for (const z of zones) {
    const a = mats.includes(z.kind) ? 1 : 0;
    stops.push([at(z.x0 + BLEND), a], [at(z.x1 - BLEND), a]);
  }
  stops.sort((p, q) => p[0] - q[0]);
  if (!stops.length) stops.push([0, 0]);
  g.addColorStop(0, `rgba(0,0,0,${stops[0][1]})`);
  for (const [p, a] of stops) g.addColorStop(p, `rgba(0,0,0,${a})`);
  g.addColorStop(1, `rgba(0,0,0,${stops[stops.length - 1][1]})`);
  return g;
}

let serial = 0;

function paintChunk(scene: Phaser.Scene, L: LevelData, theme: Theme, variant: number, index: number, pebbles: RockSpec[], keys: string[], tag: number) {
  const hp = L.terrain.hp, zones = L.terrain.zones;
  const x0 = index * CHUNK, x1 = Math.min(L.width, x0 + CHUNK);
  const gx0 = x0 - 6, gx1 = x1 + 6;
  const xs: number[] = [];
  for (let x = gx0; x < gx1; x += 10) xs.push(x);
  xs.push(gx1);
  const ys = xs.map((x) => groundCurve(hp, x));
  let lo = Infinity, hi = -Infinity;
  for (const y of ys) {
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  const oy = Math.floor(lo - 60), bottom = Math.ceil(hi + SKIN);
  const w = gx1 - gx0, h = bottom - oy;
  const res = w * h > 520000 ? 0.5 : 1;
  const [cv, ctx] = newCanvas(w * res, h * res);
  ctx.scale(res, res);
  ctx.translate(-gx0, -oy);
  const deep = deepColor(theme, variant);
  const mats = { sand: colors(theme, variant, 'sand'), rock: colors(theme, variant, 'rock'), mud: colors(theme, variant, 'mud') };
  const at = (x: number) => Math.max(0, Math.min(1, x / L.width));

  // Grundfarbe: Streifen entlang der Höhenlinie (von oben nach unten übermalt: Jeder tiefere Streifen deckt nur noch den Rest ab),
  // je tiefer, desto dunkler; waagerecht gehen die Materialien ineinander über
  const surface = (d: number) => {
    ctx.beginPath();
    ctx.moveTo(xs[0], bottom + 2);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], ys[i] + d);
    ctx.lineTo(xs[xs.length - 1], bottom + 2);
    ctx.closePath();
  };
  for (let d = 0; d <= SKIN; d += 5) {
    const u = d / SKIN;
    const g = ctx.createLinearGradient(0, 0, L.width, 0);
    const stops: [number, number][] = [];
    for (const z of zones) {
      const c = depthColor(mats[z.kind], deep, u);
      stops.push([at(z.x0 + BLEND), c], [at(z.x1 - BLEND), c]);
    }
    stops.sort((p, q) => p[0] - q[0]);
    g.addColorStop(0, css(stops[0][1]));
    for (const [p, c] of stops) g.addColorStop(p, css(c));
    g.addColorStop(1, css(stops[stops.length - 1][1]));
    surface(d);
    ctx.fillStyle = g;
    ctx.fill();
  }
  // alles Weitere nur innerhalb des Bodens
  ctx.save();
  surface(0);
  ctx.clip();
  // Struktur je Material, nach unten ausblendend
  const layer = (kind: NoiseKind, scale: number, alpha: number, on: Material[], op: GlobalCompositeOperation) => {
    // die weiche Struktur reicht in halber Auflösung
    const lr = res * 0.5;
    const [tc, tk] = newCanvas(w * lr, h * lr);
    tk.scale(lr, lr);
    tk.translate(-gx0, -oy);
    tk.fillStyle = pattern(tk, kind, scale);
    tk.fillRect(gx0, oy, w, h);
    tk.globalCompositeOperation = 'destination-in';
    tk.fillStyle = maskGradient(tk, L.width, zones, on);
    tk.fillRect(gx0, oy, w, h);
    // mit der Tiefe verschwindet die Struktur
    tk.globalCompositeOperation = 'destination-out';
    for (let d = 40; d < SKIN; d += 20) {
      tk.fillStyle = `rgba(0,0,0,${Math.min(1, (d - 40) / (SKIN - 60))})`;
      tk.beginPath();
      tk.moveTo(xs[0], bottom + 2);
      for (let i = 0; i < xs.length; i++) tk.lineTo(xs[i], ys[i] + d);
      tk.lineTo(xs[xs.length - 1], bottom + 2);
      tk.closePath();
      tk.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.drawImage(tc, gx0, oy, w, h);
    ctx.restore();
  };
  layer('stone', 0.55, 0.4, ['rock'], 'multiply');
  layer('mottle', 0.45, 0.2, ['sand'], 'multiply');
  layer('blotch', 0.7, 0.2, ['mud'], 'multiply');
  layer('grain', 1, 0.12, ['sand', 'rock', 'mud'], 'multiply');
  inlays(ctx, x0, Math.ceil(lo + 32), x1 - x0, Math.min(SKIN - 40, 120), index * 7919 + L.width);

  // Einzelheiten unter der Oberfläche
  const r = mulberry32(index * 7919 + L.width);
  const matAt = (x: number): Material => zones.find((z) => x >= z.x0 && x < z.x1)?.kind ?? 'sand';
  const base = (x: number) => groundCurve(hp, x);
  for (let x = x0 + 8; x < x1 - 40; x += 18 + r() * 26) {
    const m = matAt(x);
    const c = mats[m];
    const y = base(x);
    if (m === 'sand') {
      // Rippel im Sand: feine Wellenlinien mit hellem Kamm und dunklem Schatten
      const len = 22 + r() * 30, yy = y + 5 + r() * 38;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.quadraticCurveTo(x + len / 2, yy - 2.6 - r() * 2, x + len, yy + (r() - 0.5) * 2);
      ctx.strokeStyle = css(shade(c.top, 0.25), 0.16);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.translate(0, 2);
      ctx.strokeStyle = css(shade(c.mid, -0.5), 0.14);
      ctx.stroke();
      ctx.translate(0, -2);
      if (r() < 0.5) {
        ctx.fillStyle = css(shade(c.mid, -0.55), 0.35);
        ctx.fillRect(x + r() * len, yy + 5 + r() * 20, 1.8, 1.4);
      }
    } else if (m === 'rock') {
      // im Fels: eingebettete Steine – unregelmäßig, nur durch Licht und Schatten zu erkennen – und Risse
      const yy = y + 12 + r() * 60, rad = 5 + r() * 12;
      const pts: number[][] = [];
      for (let k = 0, nk = 7; k < nk; k++) {
        const a = (k / nk) * Math.PI * 2, q = 0.72 + r() * 0.5;
        pts.push([x + Math.cos(a) * rad * q * 1.25, yy + Math.sin(a) * rad * q * 0.8]);
      }
      const blob = () => smooth(ctx, pts, true);
      blob();
      ctx.fillStyle = css(shade(c.mid, -0.3), 0.4);
      ctx.fill();
      ctx.save();
      blob();
      ctx.clip();
      ctx.fillStyle = vgrad(ctx, yy - rad, yy + rad, [[0, 'rgba(255,248,226,0.13)'], [0.55, 'rgba(255,248,226,0)'], [1, 'rgba(0,0,0,0.2)']]);
      ctx.fillRect(x - rad * 1.6, yy - rad, rad * 3.2, rad * 2);
      ctx.restore();
      if (r() < 0.4) {
        ctx.beginPath();
        let px = x, py = y + 4;
        ctx.moveTo(px, py);
        for (let j = 0; j < 3; j++) {
          px += (r() - 0.5) * 12;
          py += 8 + r() * 10;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(4,8,8,0.28)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    } else {
      // Schlamm: dunkle Flecken und Gasbläschen
      const yy = y + 8 + r() * 40;
      const g = ctx.createRadialGradient(x, yy, 0, x, yy, 22);
      g.addColorStop(0, css(shade(c.deep, -0.3), 0.5));
      g.addColorStop(1, css(c.deep, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 22, yy - 22, 44, 44);
      if (r() < 0.4) {
        ctx.beginPath();
        ctx.arc(x + 6, yy - 4, 1.8, 0, Math.PI * 2);
        ctx.strokeStyle = css(shade(c.top, 0.2), 0.3);
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }
  }
  // geschichtetes Sediment: feine, leicht wellige Lagen parallel zur Oberfläche (im Sand und im Schlamm, nicht im Fels)
  for (const [d, a, lightLine] of [[13, 0.07, true], [25, 0.1, false], [39, 0.07, true], [56, 0.09, false]] as const) {
    ctx.beginPath();
    let on = false;
    for (let x = gx0; x <= gx1; x += 8) {
      if (matAt(x) === 'rock') {
        on = false;
        continue;
      }
      const y = groundCurve(hp, x) + d + Math.sin(x * 0.045 + d) * 1.8;
      if (on) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      on = true;
    }
    ctx.strokeStyle = lightLine ? `rgba(135,191,245,${a * 2})` : `rgba(1,4,22,${a * 2})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Licht von oben: ein heller Saum entlang der Oberfläche, darunter ein weicher Schatten – so wölbt sich der Boden
  const edge = () => {
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 14;
  ctx.translate(0, 9);
  edge();
  ctx.stroke();
  ctx.translate(0, -9);
  for (const [lw, a] of [[16, 0.06], [8, 0.12], [3, 0.48]] as const) {
    edge();
    ctx.strokeStyle = `rgba(112,221,246,${a})`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
  // dünne dunkle Kante
  edge();
  ctx.strokeStyle = 'rgba(5,13,40,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Short hard-lit ledges, following the same ground curve. No new obstacles or collision shapes.
  for (let x = Math.ceil(gx0 / 48) * 48; x < gx1; x += 48) {
    const yy = groundCurve(hp, x) + 2;
    ctx.strokeStyle = Math.floor(x / 48) % 9 === 4 ? 'rgba(255,171,87,0.65)' : 'rgba(121,230,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + 9, groundCurve(hp, x + 9) + 2);
    ctx.stroke();
  }
  // Mikrobenmatten liegen obenauf
  for (const m of L.mats) if (m.x1 > gx0 && m.x0 < gx1) paintMat(ctx, hp, m);
  // Kiesel auf dem Boden
  const look: RockLook = { theme, variant };
  for (const p of pebbles) if (p.x >= x0 - 10 && p.x < x1 + 10) paintRock(ctx, p, look);

  const key = `ter_${tag}_${index}`;
  addTex(scene, key, cv);
  keys.push(key);
  return { key, x: gx0, y: oy, w, h, deepY: bottom };
}

/** Das Bild eines Felsen: eine eigene Textur, ein Stück größer als der Umriss. */
function rockPiece(scene: Phaser.Scene, s: RockSpec, look: RockLook, tag: string, keys: string[]): ArtPiece {
  const pad = 14;
  const w = Math.ceil(s.rx * 2 + pad * 2), h = Math.ceil(s.ry * 2 + pad * 2);
  const x = Math.round(s.x - w / 2), y = Math.round(s.y - h / 2);
  const [cv, ctx] = newCanvas(w, h);
  ctx.translate(-x, -y);
  paintRock(ctx, s, look);
  const key = `rock_${tag}_${s.seed}_${Math.round(s.x)}_${Math.round(s.y)}`;
  addTex(scene, key, cv);
  keys.push(key);
  return { key, x, y, w, h };
}

/** Alle Bilder des Bodens und der Felsen eines Ortes. */
export function terrainArt(scene: Phaser.Scene, L: LevelData, theme: Theme, variant: number): TerrainArt {
  const keys: string[] = [];
  const tag = ++serial;
  const pebbles = L.rocks.filter((s) => (s.form ?? 'boulder') === 'boulder' && s.rx < 30);
  const solid = L.rocks.filter((s) => !((s.form ?? 'boulder') === 'boulder' && s.rx < 30));
  const look: RockLook = { theme, variant };
  const chunks: TerrainArt['chunks'] = [];
  for (let i = 0; i * CHUNK < L.width; i++) chunks.push(paintChunk(scene, L, theme, variant, i, pebbles, keys, tag));
  // Platten und Bögen zuerst, die Brocken davor (sie lehnen an der Platte bzw. am Pfeiler)
  const order = (s: RockSpec) => ((s.form ?? 'boulder') === 'boulder' ? 1 : 0);
  const rocks = [...solid].sort((a, b) => order(a) - order(b)).map((s) => rockPiece(scene, s, look, tag + 'g', keys));
  const fore = L.fore.map((s) => rockPiece(scene, s, { ...look, dark: true }, tag + 'f', keys));
  return { chunks, rocks, fore, deep: deepColor(theme, variant), keys };
}

// ---------------------------------------------------------------------------
// Höhlen: Schatten im Hohlraum und das Geröll, das die Öffnung verschüttet

let caveSerial = 0;

/** Der Schatten im Hohlraum: der Umriss der Höhle, hinten am dunkelsten, zur Öffnung hin heller, mit weichem Rand. */
export function caveShade(scene: Phaser.Scene, c: Cave, keys: string[]): ArtPiece {
  const pad = 8;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of c.hollow) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const x = Math.floor(x0 - pad), y = Math.floor(y0 - pad), w = Math.ceil(x1 - x0 + pad * 2), h = Math.ceil(y1 - y0 + pad * 2);
  const [cv, ctx] = newCanvas(w, h);
  ctx.translate(-x, -y);
  const back = c.side > 0 ? x0 : x1, open = c.side > 0 ? x1 : x0;
  const g = ctx.createLinearGradient(back, 0, open, 0);
  for (const [o, a] of [[0, 0.78], [0.55, 0.66], [0.85, 0.42], [1, 0.22]]) g.addColorStop(o, `rgba(2,4,4,${a})`);
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  c.hollow.forEach(([px, py], i) => (i ? ctx.lineTo(px, py + 2) : ctx.moveTo(px, py + 2)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.filter = 'none';
  const key = `cave_shade_${++caveSerial}`;
  addTex(scene, key, cv);
  keys.push(key);
  return { key, x, y, w, h };
}

/**
 * Das Geröll in der Öffnung: lose aufgeschichtete Steine verschiedener Größe mit dunklen Lücken dazwischen, nach außen hin
 * etwas auf den Boden gerutscht – es sieht nicht so fest aus wie der Fels. Dazu eine zweite Ebene mit Rissen (Treffer).
 */
export function rubbleArt(scene: Phaser.Scene, wl: CaveWall, theme: Theme, variant: number, keys: string[]): { wall: ArtPiece; cracks: ArtPiece } {
  const r = mulberry32(wl.seed);
  const spill = 46, pad = 10;
  const x = Math.round(wl.x - spill - pad), y = Math.round(wl.y - pad), w = Math.round(wl.w + 2 * (spill + pad)), h = Math.round(wl.h + 2 * pad);
  const bottom = wl.y + wl.h - 4;
  // Umriss des Haufens: oben so breit wie die Öffnung, nach außen (side) als Schutthalde auf den Boden gerutscht
  const out = wl.side;
  const slope = (yy: number) => {
    const u = Math.max(0, (yy - wl.y) / wl.h);
    return spill * Math.pow(u, 1.6);
  };
  const left = (yy: number) => wl.x - (out < 0 ? slope(yy) : 4 * Math.max(0, (yy - wl.y) / wl.h));
  const right = (yy: number) => wl.x + wl.w + (out > 0 ? slope(yy) : 4 * Math.max(0, (yy - wl.y) / wl.h));
  let base = TONES[1];
  if (variant === 1) base = mix(base, 0x267b83, 0.16);
  else if (variant === 2) base = shade(mix(base, 0x10202e, 0.3), -0.1);
  if (theme !== 'ozean') base = mix(base, TINT[theme], 0.3);
  // etwas heller und wärmer als der Fels: frisch heruntergebrochen
  base = mix(base, 0x9888aa, 0.25);
  // lose Steine: unten große Brocken, oben kleinere, kreuz und quer übereinander
  const stones: { x: number; y: number; rx: number; ry: number; a: number; t: number }[] = [];
  for (let k = 0; k < 900 && stones.length < 46; k++) {
    const yy = wl.y + 4 + r() * (bottom - wl.y - 6);
    const lx = left(yy), rx = right(yy);
    const xx = lx + 3 + r() * Math.max(1, rx - lx - 6);
    const u = (yy - wl.y) / wl.h;
    const sr = (5 + r() * 7) * (0.7 + 0.6 * u) * (r() < 0.12 ? 1.5 : 1);
    if (stones.some((o) => Math.hypot(o.x - xx, (o.y - yy) * 1.3) < (o.rx + sr) * 0.62)) continue;
    stones.push({ x: xx, y: yy, rx: sr, ry: sr * (0.62 + r() * 0.3), a: (r() - 0.5) * 1.4, t: (r() - 0.5) * 0.36 });
  }
  // von hinten nach vorn: oben zuerst, die unteren liegen davor
  stones.sort((p, q) => p.y - q.y);
  const paint = (cracks: boolean) => {
    const [cv, ctx] = newCanvas(w, h);
    ctx.translate(-x, -y);
    if (!cracks) {
      // die Lücken: dahinter ist es dunkel
      ctx.beginPath();
      ctx.moveTo(left(wl.y), wl.y);
      for (let yy = wl.y; yy <= bottom; yy += 6) ctx.lineTo(left(yy), yy);
      for (let yy = bottom; yy >= wl.y; yy -= 6) ctx.lineTo(right(yy), yy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(6,9,9,0.92)';
      ctx.fill();
      for (const st of stones) {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.rotate(st.a);
        ctx.beginPath();
        ctx.ellipse(0, 0, st.rx, st.ry, 0, 0, TAU);
        const c = shade(base, st.t);
        ctx.fillStyle = vgrad(ctx, -st.ry, st.ry, [[0, css(shade(c, 0.25))], [0.5, css(c)], [1, css(shade(c, -0.45))]]);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = pattern(ctx, 'stone', 0.7, (st.x * 3) % 97, (st.y * 3) % 89);
        ctx.fillRect(-st.rx, -st.ry, st.rx * 2, st.ry * 2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(4,8,8,0.75)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        // Licht von oben
        ctx.beginPath();
        ctx.ellipse(-st.rx * 0.2, -st.ry * 0.45, st.rx * 0.5, st.ry * 0.22, 0, 0, TAU);
        ctx.fillStyle = 'rgba(255,244,214,0.16)';
        ctx.fill();
        ctx.restore();
      }
      // Sand, der zwischen den unteren Steinen herausgerieselt ist
      const sand = colors(theme, variant, 'sand').top;
      ctx.fillStyle = vgrad(ctx, bottom - 14, bottom + 6, [[0, css(sand, 0)], [1, css(sand, 0.55)]]);
      ctx.fillRect(left(bottom) - 4, bottom - 14, right(bottom) - left(bottom) + 8, 22);
    } else {
      // Risse: zackige Linien quer über die Steine
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let k = 0; k < 4; k++) {
        let px = wl.x + wl.w * (0.2 + r() * 0.6), py = wl.y + wl.h * (0.1 + r() * 0.3);
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let j = 0; j < 7; j++) {
          px += (r() - 0.5) * 18;
          py += 8 + r() * 10;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(2,4,4,0.95)';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,210,0.18)';
        ctx.lineWidth = 0.8;
        ctx.translate(1, 1);
        ctx.stroke();
        ctx.translate(-1, -1);
      }
    }
    const key = `cave_rubble_${cracks ? 'c' : 'w'}_${++caveSerial}`;
    addTex(scene, key, cv);
    keys.push(key);
    return { key, x, y, w, h };
  };
  return { wall: paint(false), cracks: paint(true) };
}
