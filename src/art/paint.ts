import { newCanvas, type Ctx, ell } from '../util/canvas';
import { css, mix, shade } from '../util/color';

// ---------------------------------------------------------------------------
// Malwerkzeuge für den dunklen, organischen Stil:
// kachelbares Rauschen (Haut, Stein, Nebel), Hautschattierung mit Randlicht,
// realistische Augen und Zähne.
// ---------------------------------------------------------------------------

function hash(x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Wertrauschen, kachelbar mit der Periode p. */
function vnoise(x: number, y: number, p: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (n: number) => ((n % p) + p) % p;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fraktales Rauschen (0..1) an Position (x, y) in 0..1, kachelbar. */
export function fbm(x: number, y: number, base: number, oct: number, seed: number, ridged = false) {
  let sum = 0, amp = 0.5, tot = 0, f = base;
  for (let o = 0; o < oct; o++) {
    let n = vnoise(x * f, y * f, f, seed + o * 31);
    if (ridged) n = 1 - Math.abs(n * 2 - 1);
    sum += n * amp;
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / tot;
}

export type NoiseKind = 'mottle' | 'grain' | 'stone' | 'cloud' | 'streak' | 'blotch';

const cache = new Map<NoiseKind, HTMLCanvasElement>();

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * 256×256 kachelbare Rauschtextur.
 * Graustufen-Texturen (hell = keine Änderung) sind für "multiply" gedacht,
 * "cloud" ist weiß mit Alpha (für Nebel).
 */
export function noiseTex(kind: NoiseKind): HTMLCanvasElement {
  const hit = cache.get(kind);
  if (hit) return hit;
  const S = 256;
  const [c, ctx] = newCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let g = 255, a = 255;
      switch (kind) {
        case 'mottle': {
          const n = fbm(u, v, 5, 4, 11);
          g = 255 * (1 - 0.5 * smooth(0.42, 0.78, n));
          break;
        }
        case 'blotch': {
          const n = fbm(u, v, 3, 3, 23);
          g = 255 * (1 - 0.8 * smooth(0.5, 0.62, n));
          break;
        }
        case 'grain': {
          const n = fbm(u, v, 64, 2, 5);
          g = 255 * (0.78 + 0.22 * n);
          break;
        }
        case 'stone': {
          const n = fbm(u, v, 6, 5, 7, true);
          const m = fbm(u, v, 3, 3, 17);
          g = 255 * (0.55 + 0.45 * smooth(0.25, 0.85, n) * (0.7 + 0.3 * m));
          break;
        }
        case 'streak': {
          const n = fbm(u, v * 0.125, 32, 3, 13);
          g = 255 * (0.62 + 0.38 * n);
          break;
        }
        case 'cloud': {
          const n = fbm(u, v, 3, 5, 29);
          g = 255;
          a = 255 * smooth(0.35, 0.85, n);
          break;
        }
      }
      const i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(kind, c);
  return c;
}

export function pattern(ctx: Ctx, kind: NoiseKind, scale = 1, ox = 0, oy = 0) {
  const p = ctx.createPattern(noiseTex(kind), 'repeat')!;
  if ((scale !== 1 || ox || oy) && typeof p.setTransform === 'function') {
    p.setTransform(new DOMMatrix().translate(ox, oy).scale(scale));
  }
  return p;
}

/** Legt eine Rauschtextur über die Form (innerhalb des Pfads). */
export function texture(ctx: Ctx, path: () => void, kind: NoiseKind, alpha: number, op: GlobalCompositeOperation = 'multiply', scale = 1, seed = 0) {
  ctx.save();
  path();
  ctx.clip();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern(ctx, kind, scale, seed * 37, seed * 53);
  ctx.fillRect(-2000, -2000, 4000, 4000);
  ctx.restore();
}

export interface SkinOpts {
  base: number;
  /** dunklere Rückenfarbe */
  top?: number;
  /** helle Bauchfarbe */
  belly?: number;
  /** Bauchband: Mitte (y), halbe Höhe, halbe Breite, x-Mitte */
  bellyBand?: [number, number, number, number];
  y0: number;
  y1: number;
  noise?: NoiseKind | null;
  noiseAlpha?: number;
  noiseScale?: number;
  seed?: number;
  /** Muster innerhalb der Form (Tarnung, Schuppen, Fell …) */
  inner?: (ctx: Ctx) => void;
  rim?: number;
  edge?: number;
  edgeW?: number;
  wet?: boolean;
  /** Umriss für Randlicht und Kante (z. B. ohne die Seite, die im Körper steckt) */
  outline?: () => void;
}

/** Füllt eine Körperform mit Verlauf, Textur, Randlicht und dunkler Kante. */
export function skin(ctx: Ctx, path: () => void, o: SkinOpts) {
  path();
  const g = ctx.createLinearGradient(0, o.y0, 0, o.y1);
  g.addColorStop(0, css(o.top ?? shade(o.base, -0.35)));
  g.addColorStop(0.5, css(o.base));
  g.addColorStop(1, css(shade(o.belly ?? o.base, -0.18)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  if (o.belly !== undefined && o.bellyBand) {
    const [cy, hh, hw, cx] = o.bellyBand;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(hw / Math.max(1, hh), 1);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, hh);
    rg.addColorStop(0, css(o.belly, 0.85));
    rg.addColorStop(0.6, css(o.belly, 0.45));
    rg.addColorStop(1, css(o.belly, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(-hh, -hh, hh * 2, hh * 2);
    ctx.restore();
  }
  o.inner?.(ctx);
  if (o.noise) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = o.noiseAlpha ?? 0.5;
    ctx.fillStyle = pattern(ctx, o.noise, o.noiseScale ?? 0.35, (o.seed ?? 0) * 41, (o.seed ?? 0) * 17);
    ctx.fillRect(-2000, -2000, 4000, 4000);
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pattern(ctx, 'grain', 0.5);
  ctx.fillRect(-2000, -2000, 4000, 4000);
  ctx.restore();
  // Licht von oben
  const lg = ctx.createLinearGradient(0, o.y0, 0, o.y1);
  lg.addColorStop(0, 'rgba(255,236,200,0.16)');
  lg.addColorStop(0.45, 'rgba(255,236,200,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = lg;
  ctx.fillRect(-2000, o.y0 - 2, 4000, o.y1 - o.y0 + 4);
  // Plastizität: weiche Schatten unten und an den Rändern, Licht von oben – statt harter Striche
  const op = o.outline ?? path;
  const ht = Math.max(4, o.y1 - o.y0);
  const rim = o.rim ?? 0.3;
  innerShade(ctx, path, op, 'rgba(0,0,0,0.5)', ht * 0.22, 0, -ht * 0.14, ht * 0.12);
  innerShade(ctx, path, op, 'rgba(0,0,0,0.32)', ht * 0.08, 0, 0, ht * 0.05);
  innerShade(ctx, path, op, `rgba(255,236,200,${Math.min(0.5, rim * 1.2)})`, ht * 0.12, 0, ht * 0.1, ht * 0.06);
  if (o.wet) {
    // nasser Glanz: ein weicher Lichtstreif auf dem Rücken
    ctx.save();
    path();
    ctx.clip();
    const sg = ctx.createLinearGradient(0, o.y0, 0, o.y0 + ht * 0.45);
    sg.addColorStop(0, 'rgba(230,255,245,0)');
    sg.addColorStop(0.45, 'rgba(230,255,245,0.16)');
    sg.addColorStop(1, 'rgba(230,255,245,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(-2000, o.y0, 4000, ht * 0.45);
    ctx.restore();
  }
  ctx.restore();
  // zarte Kante: Die Form soll sich abheben, aber nicht wie ausgeschnitten wirken
  op();
  ctx.strokeStyle = css(o.edge ?? shade(o.base, -0.6), 0.5);
  ctx.lineWidth = (o.edgeW ?? 1.3) * 0.75;
  ctx.stroke();
}

/**
 * Weicher Innenschatten (oder Innenlicht) entlang einer Linie: Die Linie wird weit außerhalb
 * gezeichnet, nur ihr verschwommener Schatten fällt – verschoben – in die Form.
 */
export function innerShade(ctx: Ctx, clip: () => void, line: () => void, color: string, blur: number, dx: number, dy: number, w: number) {
  const m = ctx.getTransform();
  const k = Math.hypot(m.a, m.b) || 1;
  const OFF = 6000;
  ctx.save();
  clip();
  ctx.clip();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = OFF * m.a + dx * k;
  ctx.shadowOffsetY = OFF * m.b + dy * k;
  ctx.translate(-OFF, 0);
  line();
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.restore();
}

/** Ein Tierauge: wenig Weiß, dunkle Iris, kleiner Glanzpunkt. */
export function eye(ctx: Ctx, x: number, y: number, r: number, iris: number, o: { slit?: boolean; lid?: number; glow?: boolean; keen?: number } = {}) {
  // keen (0 … 1): ein wacher, scharfer Blick – die Iris leuchtet kräftiger, ein heller Ring um die Pupille, der Lichtreflex
  // wird größer und bekommt einen zweiten, kleinen Glanzpunkt
  const kn = Math.max(0, Math.min(1, o.keen ?? 0));
  ell(ctx, x, y + r * 0.1, r * 1.45, r * 1.3);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  if (o.glow) {
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    gg.addColorStop(0, css(iris, 0.35));
    gg.addColorStop(1, css(iris, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }
  ell(ctx, x, y, r, r);
  const ir = kn > 0 ? mix(iris, 0xf4c24a, 0.35 * kn) : iris;
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, css(shade(ir, 0.35 + 0.3 * kn)));
  g.addColorStop(0.55, css(ir));
  g.addColorStop(1, css(shade(ir, -0.6 - 0.15 * kn)));
  ctx.fillStyle = g;
  ctx.fill();
  if (kn > 0) {
    // ein heller Ring in der Iris, wie ein Lichtkranz um die Pupille
    ctx.beginPath();
    ctx.arc(x + r * 0.08, y, r * 0.66, 0, Math.PI * 2);
    ctx.strokeStyle = css(shade(ir, 0.6), 0.25 + 0.45 * kn);
    ctx.lineWidth = r * (0.1 + 0.08 * kn);
    ctx.stroke();
  }
  if (o.slit) ell(ctx, x + r * 0.05, y, r * 0.2, r * 0.82);
  else ell(ctx, x + r * 0.1, y, r * 0.48, r * 0.48);
  ctx.fillStyle = '#050403';
  ctx.fill();
  const hr = 1 + 0.4 * kn;
  ell(ctx, x - r * 0.38, y - r * 0.38, r * 0.24 * hr, r * 0.18 * hr);
  ctx.fillStyle = `rgba(255,250,235,${0.9 + 0.1 * kn})`;
  ctx.fill();
  if (kn > 0.15) {
    ell(ctx, x + r * 0.34, y + r * 0.3, r * 0.1 * hr, r * 0.08 * hr);
    ctx.fillStyle = `rgba(255,252,240,${0.4 + 0.45 * kn})`;
    ctx.fill();
  }
  if (o.lid && o.lid > 0) {
    // schweres Oberlid: grimmiger Blick
    ctx.save();
    ell(ctx, x, y, r * 1.08, r * 1.08);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x - r * 1.2, y - r * 1.2);
    ctx.lineTo(x + r * 1.2, y - r * 1.2);
    ctx.lineTo(x + r * 1.2, y - r * (1 - o.lid * 1.1));
    ctx.lineTo(x - r * 1.2, y - r * (1 - o.lid * 0.5));
    ctx.closePath();
    ctx.fillStyle = 'rgba(18,14,10,0.95)';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

export function ivory(ctx: Ctx, y0: number, y1: number, old = 0) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, old > 0.5 ? '#e4d6b4' : '#f2ead6');
  g.addColorStop(1, old > 0.5 ? '#a08a5c' : '#c2ae86');
  return g;
}

/** Ein Zahn von (x, y) aus, Spitze in Richtung dir (1 = nach unten, -1 = nach oben). */
export function tooth(ctx: Ctx, x: number, y: number, w: number, len: number, dir: number, blunt = false, curve = 0.15) {
  ctx.beginPath();
  if (blunt) {
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y + dir * len * 0.7);
    ctx.quadraticCurveTo(x, y + dir * len * 1.05, x + w / 2, y + dir * len * 0.7);
    ctx.lineTo(x + w / 2, y);
  } else {
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.3, y + dir * len * 0.6, x + w * curve * 2, y + dir * len);
    ctx.quadraticCurveTo(x + w * 0.35, y + dir * len * 0.5, x + w / 2, y);
  }
  ctx.closePath();
  ctx.fillStyle = ivory(ctx, Math.min(y, y + dir * len), Math.max(y, y + dir * len));
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,18,0.75)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/** Weicher Schatten unter einer Form (Kontakt mit dem Boden). */
export function softShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.45) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}
