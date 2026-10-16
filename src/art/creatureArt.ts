import Phaser from 'phaser';
import type { ClassId } from '../data/classes';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, fillStroke, newCanvas } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { PALETTES, type Palette } from './palettes';

// Die Spielfigur besteht aus einzelnen Teilen (Körper, Kopf, Unterkiefer, Zähne,
// Schwanz, Beine, Flosse). Jedes Teil wird passend zur Evolution gezeichnet und
// in CreatureView zu einer animierten Figur zusammengesetzt.

export interface Appearance {
  cls: ClassId;
  kiefer: number;
  horn: number;
  koerper: number;
  haut: number;
  schwanz: number;
  beine: number;
  farbe: number;
}

interface Shape {
  bw: number;
  bh: number;
  neck: [number, number];
  tail: [number, number];
  legF: [number, number];
  legB: [number, number];
  leg: number;
  legW: number;
}

const SHAPES: Record<ClassId, Shape> = {
  fish: { bw: 60, bh: 34, neck: [17, 0], tail: [-28, 0], legF: [0, 0], legB: [0, 0], leg: 0, legW: 0 },
  amphibian: { bw: 64, bh: 26, neck: [27, -2], tail: [-29, -2], legF: [18, 6], legB: [-18, 6], leg: 15, legW: 9 },
  reptile: { bw: 70, bh: 32, neck: [31, -7], tail: [-32, -4], legF: [21, 9], legB: [-21, 9], leg: 21, legW: 10 },
  mammal: { bw: 72, bh: 38, neck: [33, -11], tail: [-34, -9], legF: [23, 11], legB: [-23, 11], leg: 27, legW: 11 },
};

const BODY_SCALE = [0.9, 1, 1.12, 1.25, 1.38];
const LEG_ADD = [0, 4, 7, 6, 12];
const TEETH = [
  { n: 0, s: 0 },
  { n: 4, s: 2.6 },
  { n: 5, s: 3.4 },
  { n: 5, s: 4.4 },
  { n: 6, s: 5.4 },
  { n: 4, s: 3.4 },
];

export interface HeadGeo {
  L: number;
  H: number;
  mouthY: number;
  hingeX: number;
  snoutH: number;
  ex: number;
  ey: number;
  er: number;
  jawH: number;
}

function headGeo(cls: ClassId, jaw: number): HeadGeo {
  const jl = 1 + jaw * 0.055;
  switch (cls) {
    case 'fish':
      return { L: 25 * jl, H: 30, mouthY: 5, hingeX: 6, snoutH: 9, ex: 9, ey: -5, er: 5.2, jawH: 5 + jaw * 0.9 };
    case 'amphibian':
      return { L: 30 * jl, H: 22, mouthY: 4, hingeX: 4, snoutH: 7, ex: 11, ey: -9, er: 4.8, jawH: 5 + jaw * 0.8 };
    case 'reptile':
      return { L: 36 * jl, H: 24, mouthY: 5, hingeX: 6, snoutH: 7, ex: 12, ey: -6, er: 4.2, jawH: 6 + jaw * 0.9 };
    case 'mammal':
      return { L: 33 * jl, H: 28, mouthY: 7, hingeX: 10, snoutH: 9, ex: 13, ey: -5, er: 4, jawH: 6 + jaw * 0.9 };
  }
}

export interface Layout {
  s: number;
  sh: Shape;
  hg: HeadGeo;
  leg: number;
  legW: number;
  neck: [number, number];
  tail: [number, number];
  legF: [number, number];
  legB: [number, number];
  topY: number;
  footY: number;
  halfW: number;
  /** Bissbereich bei Blick nach rechts, relativ zum Ursprung. */
  bite: { x: number; y: number; w: number; h: number };
  land: boolean;
}

export function layoutOf(a: Appearance): Layout {
  const sh = SHAPES[a.cls];
  const s = BODY_SCALE[a.koerper] ?? 1;
  const hg = headGeo(a.cls, a.kiefer);
  const land = a.cls !== 'fish';
  const leg = land ? sh.leg + (LEG_ADD[a.beine] ?? 0) : 0;
  const legW = sh.legW * (a.beine === 2 ? 1.2 : 1);
  const m = (p: [number, number]): [number, number] => [p[0] * s, p[1] * s];
  const footY = land ? (sh.legF[1] + leg) * s : sh.bh * 0.42 * s;
  const topY = -sh.bh * (land ? 0.45 : 0.42) * s;
  const neck = m(sh.neck);
  return {
    s, sh, hg, leg, legW, neck,
    tail: m(sh.tail), legF: m(sh.legF), legB: m(sh.legB),
    topY, footY, halfW: sh.bw * 0.46 * s,
    bite: { x: neck[0] - 4 * s, y: neck[1] + (hg.mouthY - 18) * s, w: (hg.L + 22) * s, h: 36 * s },
    land,
  };
}

// ---------------------------------------------------------------------------
// Zeichenhilfen

const RES = 2;
export const CREATURE_RES = RES;

export interface PartTex {
  key: string;
  ox: number;
  oy: number;
}

export interface CreatureTex {
  body: PartTex;
  head: PartTex;
  jaw: PartTex;
  teeth: PartTex;
  tail: PartTex;
  leg?: PartTex;
  fin?: PartTex;
  layout: Layout;
}

function part(scene: Phaser.Scene, key: string, w: number, h: number, px: number, py: number, draw: (ctx: Ctx) => void): PartTex {
  if (!scene.textures.exists(key)) {
    const [c, ctx] = newCanvas(w * RES, h * RES);
    ctx.scale(RES, RES);
    ctx.translate(px, py);
    draw(ctx);
    scene.textures.addCanvas(key, c);
  }
  return { key, ox: px / w, oy: py / h };
}

const IVORY_STROKE = '#5e4a2c';

function ivory(ctx: Ctx, y0: number, y1: number, gold = false) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, gold ? '#fff6b0' : '#fffaf0');
  g.addColorStop(1, gold ? '#e0a020' : '#cdb68a');
  return g;
}

function eye(ctx: Ctx, x: number, y: number, r: number, iris: number) {
  ell(ctx, x, y, r, r);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ell(ctx, x + r * 0.25, y, r * 0.62, r * 0.62);
  ctx.fillStyle = css(iris);
  ctx.fill();
  ell(ctx, x + r * 0.32, y, r * 0.33, r * 0.4);
  ctx.fillStyle = '#111';
  ctx.fill();
  ell(ctx, x + r * 0.05, y - r * 0.35, r * 0.22, r * 0.22);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Körper

function bodyPath(ctx: Ctx, cls: ClassId) {
  ctx.beginPath();
  switch (cls) {
    case 'fish':
      ctx.moveTo(22, -15);
      ctx.bezierCurveTo(6, -19, -16, -15, -29, -5);
      ctx.lineTo(-29, 5);
      ctx.bezierCurveTo(-16, 15, 6, 19, 22, 15);
      ctx.bezierCurveTo(27, 8, 27, -8, 22, -15);
      break;
    case 'amphibian':
      ctx.moveTo(28, -9);
      ctx.bezierCurveTo(14, -15, -14, -15, -30, -6);
      ctx.bezierCurveTo(-34, -1, -33, 6, -28, 8);
      ctx.bezierCurveTo(-12, 15, 12, 15, 28, 9);
      ctx.bezierCurveTo(33, 4, 33, -4, 28, -9);
      break;
    case 'reptile':
      ctx.moveTo(31, -12);
      ctx.bezierCurveTo(16, -19, -14, -19, -31, -8);
      ctx.bezierCurveTo(-36, -2, -35, 6, -30, 9);
      ctx.bezierCurveTo(-12, 18, 14, 18, 31, 10);
      ctx.bezierCurveTo(37, 4, 37, -6, 31, -12);
      break;
    case 'mammal':
      ctx.moveTo(33, -15);
      ctx.bezierCurveTo(18, -23, -16, -22, -32, -11);
      ctx.bezierCurveTo(-38, -4, -37, 8, -31, 13);
      ctx.bezierCurveTo(-12, 21, 14, 21, 32, 14);
      ctx.bezierCurveTo(39, 7, 39, -8, 33, -15);
      break;
  }
  ctx.closePath();
}

/** Ungefähre Oberkante des Körpers an Position x. */
function topAt(sh: Shape, x: number) {
  const hw = sh.bw / 2, hh = sh.bh / 2;
  const k = Math.max(0, 1 - (x / hw) ** 2);
  return -hh * Math.sqrt(k) * 0.98;
}

function bodyPattern(ctx: Ctx, a: Appearance, P: Palette, sh: Shape) {
  const hw = sh.bw / 2, hh = sh.bh / 2;
  const r = mulberry32(11 + a.farbe * 13 + a.haut * 31 + a.koerper * 7);
  const dark = css(P.dark, 0.32);
  const kind = a.haut === 0 ? `plain-${a.cls}` : `skin-${a.haut}`;
  switch (kind) {
    case 'plain-fish':
      for (let i = 0; i < 14; i++) {
        ell(ctx, -hw + r() * sh.bw, -hh + r() * hh * 1.1, 1 + r(), 1 + r());
        ctx.fillStyle = dark;
        ctx.fill();
      }
      break;
    case 'plain-amphibian':
      for (let i = 0; i < 9; i++) {
        ell(ctx, -hw + 6 + r() * (sh.bw - 12), -hh + 2 + r() * hh, 2 + r() * 2.6, 1.6 + r() * 2);
        ctx.fillStyle = css(P.dark, 0.35);
        ctx.fill();
      }
      break;
    case 'plain-reptile':
      for (let y = -hh; y < hh; y += 4.5) {
        for (let x = -hw; x < hw; x += 5) {
          ell(ctx, x + ((y / 4.5) % 2 ? 2.5 : 0), y, 1, 1);
          ctx.fillStyle = css(P.dark, 0.18);
          ctx.fill();
        }
      }
      break;
    case 'plain-mammal':
      ctx.strokeStyle = css(shade(P.base, -0.25), 0.4);
      ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        const x = -hw + r() * sh.bw, y = -hh + r() * sh.bh;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 2);
        ctx.stroke();
      }
      break;
    case 'skin-1': // Schuppen
      ctx.strokeStyle = css(P.dark, 0.35);
      ctx.lineWidth = 1;
      for (let row = 0, y = -hh; y < hh + 4; y += 5.5, row++) {
        for (let x = -hw - 4; x < hw + 4; x += 7) {
          ctx.beginPath();
          ctx.arc(x + (row % 2) * 3.5, y, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      }
      break;
    case 'skin-2': {
      // Knochenplatten
      const bone = mix(P.base, 0xe6dcc0, 0.6);
      for (let i = 0; i < 5; i++) {
        const x = hw * 0.75 - i * 13;
        ctx.beginPath();
        ctx.moveTo(x, -hh - 2);
        ctx.quadraticCurveTo(x + 6, -hh * 0.2, x + 1, hh * 0.25);
        ctx.lineTo(x - 11, hh * 0.25);
        ctx.quadraticCurveTo(x - 7, -hh * 0.2, x - 12, -hh - 2);
        ctx.closePath();
        fillStroke(ctx, css(bone, 0.95), css(P.dark, 0.6), 1.2);
        ell(ctx, x - 5, -hh * 0.45, 1.2, 1.2);
        ctx.fillStyle = css(P.dark, 0.5);
        ctx.fill();
      }
      break;
    }
    case 'skin-3':
    case 'skin-4': {
      // Hornschuppen (Rauten), beim Stachelpanzer zusätzlich Bänder
      ctx.strokeStyle = css(P.dark, 0.32);
      ctx.lineWidth = 1.1;
      for (let x = -hw - sh.bh; x < hw + sh.bh; x += 7) {
        ctx.beginPath();
        ctx.moveTo(x, -hh - 2);
        ctx.lineTo(x + sh.bh, hh + 2);
        ctx.moveTo(x, hh + 2);
        ctx.lineTo(x + sh.bh, -hh - 2);
        ctx.stroke();
      }
      ell(ctx, 0, -hh * 0.9, hw * 0.9, hh * 0.3);
      ctx.fillStyle = css(P.dark, 0.25);
      ctx.fill();
      if (a.haut === 4) {
        for (let i = -2; i <= 2; i++) {
          ctx.fillStyle = css(P.dark, 0.22);
          ctx.fillRect(i * 13 - 3, -hh, 5, sh.bh * 0.7);
        }
      }
      break;
    }
    case 'skin-5': {
      // Dichter Pelz
      for (let i = 0; i < 160; i++) {
        const x = -hw + r() * sh.bw, y = -hh + r() * sh.bh;
        ctx.strokeStyle = css(r() > 0.5 ? shade(P.base, 0.25) : shade(P.base, -0.25), 0.55);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - 2, y + 2, x - 4, y + 3);
        ctx.stroke();
      }
      break;
    }
  }
}

function drawBody(ctx: Ctx, a: Appearance, P: Palette, sh: Shape) {
  const cls = a.cls;
  const hw = sh.bw / 2, hh = sh.bh / 2;
  const furry = a.haut === 5;

  // Teile hinter dem Körper
  if (cls === 'fish') {
    const k = 1 + a.schwanz * 0.25;
    ctx.beginPath();
    ctx.moveTo(8, -15);
    ctx.quadraticCurveTo(-2, -15 - 14 * k, -12, -15 - 12 * k);
    ctx.quadraticCurveTo(-13, -13, -17, -10);
    ctx.closePath();
    fillStroke(ctx, css(P.accent, 0.9), css(P.dark, 0.7), 1.4);
    ctx.strokeStyle = css(shade(P.accent, -0.3), 0.6);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(4 - i * 5, -14);
      ctx.lineTo(-2 - i * 3.5, -15 - 11 * k + i * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.quadraticCurveTo(-12, 24, -20, 22);
    ctx.quadraticCurveTo(-16, 16, -17, 11);
    ctx.closePath();
    fillStroke(ctx, css(P.accent, 0.85), css(P.dark, 0.6), 1.2);
  }
  if (a.haut === 4) {
    // Rückenstacheln
    for (let i = 0; i < 7; i++) {
      const x = -hw * 0.8 + i * ((hw * 1.6) / 6);
      const y = topAt(sh, x);
      const hgt = 9 + (i % 2) * 4;
      ctx.beginPath();
      ctx.moveTo(x - 4.5, y + 4);
      ctx.lineTo(x + 1, y - hgt);
      ctx.lineTo(x + 4.5, y + 4);
      ctx.closePath();
      fillStroke(ctx, ivory(ctx, y - hgt, y + 4), IVORY_STROKE, 1.2);
    }
  } else if (a.haut === 3) {
    for (let i = 0; i < 9; i++) {
      const x = -hw * 0.85 + i * ((hw * 1.7) / 8);
      const y = topAt(sh, x);
      ell(ctx, x, y + 0.5, 3.6, 3.4);
      fillStroke(ctx, css(shade(P.base, -0.2)), css(P.dark), 1.2);
    }
  } else if (a.haut === 2 && cls !== 'fish') {
    for (let i = 0; i < 4; i++) {
      const x = -hw * 0.55 + i * ((hw * 1.1) / 3);
      const y = topAt(sh, x);
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 4);
      ctx.quadraticCurveTo(x - 3, y - 11, x + 1, y - 11);
      ctx.quadraticCurveTo(x + 6, y - 8, x + 6, y + 4);
      ctx.closePath();
      fillStroke(ctx, css(mix(P.base, 0xe6dcc0, 0.55)), css(P.dark, 0.8), 1.2);
    }
  }

  // Körper
  bodyPath(ctx, cls);
  const g = ctx.createLinearGradient(0, -hh, 0, hh);
  g.addColorStop(0, css(shade(P.base, 0.12)));
  g.addColorStop(0.55, css(P.base));
  g.addColorStop(1, css(shade(P.base, -0.15)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  bodyPath(ctx, cls);
  ctx.clip();
  ell(ctx, 2, hh * 0.78, hw * 0.88, hh * 0.55);
  ctx.fillStyle = css(P.belly, 0.92);
  ctx.fill();
  bodyPattern(ctx, a, P, sh);
  ell(ctx, hw * 0.15, -hh * 0.55, hw * 0.6, hh * 0.32);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
  bodyPath(ctx, cls);
  ctx.strokeStyle = css(P.dark);
  ctx.lineWidth = 2;
  ctx.stroke();

  if (cls === 'fish') {
    ctx.beginPath();
    ctx.moveTo(18, -1);
    ctx.quadraticCurveTo(-5, 2, -27, 0);
    ctx.strokeStyle = css(P.belly, 0.45);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (furry || cls === 'mammal') {
    // fransige Fellkante
    const n = furry ? 26 : 14;
    ctx.strokeStyle = css(furry ? shade(P.base, -0.15) : P.dark, 0.8);
    ctx.lineWidth = furry ? 1.6 : 1.1;
    for (let i = 0; i <= n; i++) {
      const ang = Math.PI + 0.25 + (i / n) * (Math.PI - 0.5);
      const x = Math.cos(ang) * hw * 0.98, y = Math.sin(ang) * hh * 0.98;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (furry ? 3 : 2), y - (furry ? 3.5 : 2));
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Kopf

/** Kopfumriss. Mit open=true ohne Hinterkante (die geht in den Hals über). */
function headPath(ctx: Ctx, hg: HeadGeo, open = false) {
  const { L, H, mouthY, hingeX, snoutH } = hg;
  const top = -H / 2, bot = H / 2;
  ctx.beginPath();
  ctx.moveTo(-6, top * 0.85);
  ctx.bezierCurveTo(L * 0.2, top * 1.12, L * 0.62, top * 0.9, L * 0.9, mouthY - snoutH);
  ctx.quadraticCurveTo(L + 2.5, mouthY - snoutH * 0.55, L, mouthY);
  ctx.lineTo(hingeX, mouthY);
  ctx.quadraticCurveTo(hingeX - 3, bot * 0.95, -2, bot * 0.88);
  if (open) return;
  ctx.bezierCurveTo(-9, bot * 0.6, -10, top * 0.4, -6, top * 0.85);
  ctx.closePath();
}

function drawHorn(ctx: Ctx, lvl: number, hg: HeadGeo) {
  if (!lvl) return;
  const { L, H, mouthY, snoutH } = hg;
  const top = -H / 2;
  const fx = L * 0.3, fy = top * 1.02;
  const nx = L * 0.78, ny = mouthY - snoutH - 1;
  const cone = (bx: number, by: number, w: number, tx: number, ty: number, gold = false) => {
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, by + 2);
    ctx.quadraticCurveTo(bx - w * 0.2, by - (by - ty) * 0.5, tx, ty);
    ctx.quadraticCurveTo(bx + w * 0.3, by - (by - ty) * 0.3, bx + w / 2, by + 2);
    ctx.closePath();
    fillStroke(ctx, ivory(ctx, ty, by, gold), IVORY_STROKE, 1.2);
    // Rillen
    ctx.strokeStyle = 'rgba(94,74,44,.35)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 3; i++) {
      const t = i / 3;
      ctx.beginPath();
      ctx.moveTo(bx - (w / 2) * (1 - t) + (tx - bx) * t * 0.6, by - (by - ty) * t * 0.6);
      ctx.lineTo(bx + (w / 2) * (1 - t) + (tx - bx) * t * 0.6, by - (by - ty) * t * 0.6);
      ctx.stroke();
    }
  };
  switch (lvl) {
    case 1:
      ell(ctx, fx, fy + 1.5, 6, 4.5);
      fillStroke(ctx, ivory(ctx, fy - 4, fy + 6), IVORY_STROKE, 1.2);
      break;
    case 2:
      cone(fx, fy + 1, 11, fx + 6, fy - 16);
      break;
    case 3:
      ell(ctx, fx - 2, fy + 2, 4, 3);
      fillStroke(ctx, ivory(ctx, fy - 2, fy + 5), IVORY_STROKE, 1);
      cone(nx, ny + 1, 13, nx + 4, ny - 20);
      break;
    case 4:
      for (const off of [-3, 0]) {
        ctx.beginPath();
        ctx.moveTo(fx - 5 + off, fy + 3);
        ctx.quadraticCurveTo(fx + 2 + off, fy - 16, fx + L * 0.75 + off, fy - 19);
        ctx.quadraticCurveTo(fx + 8 + off, fy - 6, fx + 6 + off, fy + 3);
        ctx.closePath();
        fillStroke(ctx, ivory(ctx, fy - 19, fy + 3), IVORY_STROKE, 1.2);
      }
      cone(nx, ny + 1, 8, nx + 2, ny - 8);
      break;
    case 5:
      for (let i = 0; i < 5; i++) {
        const x = -2 + i * (L * 0.16);
        const hgt = 9 + (i === 2 ? 8 : i % 2 ? 4 : 2);
        cone(x, top * 0.95 + Math.abs(i - 2) * 0.8, 7, x + 2, top - hgt, true);
      }
      cone(nx, ny + 1, 12, nx + 4, ny - 18, true);
      break;
  }
}

function drawHead(ctx: Ctx, a: Appearance, P: Palette, hg: HeadGeo) {
  const { L, H, mouthY, hingeX, snoutH } = hg;
  const top = -H / 2;
  const cls = a.cls;

  // Nackenschild (Doppelhorn)
  if (a.horn === 4) {
    ctx.beginPath();
    ctx.moveTo(-2, top * 0.2);
    for (let i = 0; i <= 6; i++) {
      const ang = -Math.PI * 0.55 - (i / 6) * Math.PI * 0.55;
      const r = H * 0.95 + (i % 2 ? 0 : 3);
      ctx.lineTo(-2 + Math.cos(ang) * r, top * 0.2 + Math.sin(ang) * r);
    }
    ctx.closePath();
    fillStroke(ctx, css(shade(P.accent, -0.05)), css(P.dark), 1.6);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.62 - (i / 4) * Math.PI * 0.42;
      ell(ctx, -2 + Math.cos(ang) * H * 0.7, top * 0.2 + Math.sin(ang) * H * 0.7, 2, 2);
      ctx.fillStyle = css(P.dark, 0.5);
      ctx.fill();
    }
  }
  // Ohren
  if (cls === 'mammal') {
    for (const [ox, dark] of [[3, true], [9, false]] as const) {
      ctx.beginPath();
      ctx.moveTo(ox - 5, top * 0.7);
      ctx.lineTo(ox - 1, top - 9);
      ctx.lineTo(ox + 5, top * 0.6);
      ctx.closePath();
      fillStroke(ctx, css(dark ? shade(P.base, -0.25) : P.base), css(P.dark), 1.4);
      ctx.beginPath();
      ctx.moveTo(ox - 2.5, top * 0.7);
      ctx.lineTo(ox - 1, top - 5);
      ctx.lineTo(ox + 2.5, top * 0.65);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,170,170,.8)';
      ctx.fill();
    }
  }
  // Maulhöhle (sichtbar, wenn der Kiefer aufgeht)
  ctx.beginPath();
  ctx.moveTo(hingeX, mouthY);
  ctx.lineTo(L - 1, mouthY);
  ctx.lineTo(L - 5, mouthY + hg.jawH);
  ctx.lineTo(hingeX + 1, mouthY + hg.jawH * 0.85);
  ctx.closePath();
  ctx.fillStyle = '#5b1820';
  ctx.fill();
  ell(ctx, hingeX + (L - hingeX) * 0.45, mouthY + hg.jawH * 0.65, (L - hingeX) * 0.25, 2.2);
  ctx.fillStyle = '#d9606a';
  ctx.fill();

  // Kopfform
  headPath(ctx, hg);
  const g = ctx.createLinearGradient(0, top, 0, H / 2);
  g.addColorStop(0, css(shade(P.base, 0.14)));
  g.addColorStop(0.6, css(P.base));
  g.addColorStop(1, css(shade(P.base, -0.12)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  headPath(ctx, hg);
  ctx.clip();
  ell(ctx, L * 0.35, H * 0.42, L * 0.6, H * 0.28);
  ctx.fillStyle = css(P.belly, 0.85);
  ctx.fill();
  if (a.haut === 2) {
    ctx.beginPath();
    ctx.moveTo(-8, top);
    ctx.lineTo(L * 0.7, top);
    ctx.lineTo(L * 0.55, mouthY - 2);
    ctx.lineTo(-8, mouthY - 1);
    ctx.closePath();
    fillStroke(ctx, css(mix(P.base, 0xe6dcc0, 0.6), 0.95), css(P.dark, 0.6), 1.2);
  }
  if (a.haut === 5 || cls === 'mammal') {
    const r = mulberry32(5 + a.farbe);
    ctx.strokeStyle = css(shade(P.base, -0.25), 0.45);
    ctx.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const x = -6 + r() * L * 0.6, y = top + r() * H * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 2);
      ctx.stroke();
    }
  }
  ell(ctx, L * 0.3, top * 0.55, L * 0.35, H * 0.18);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.restore();
  headPath(ctx, hg, true);
  ctx.strokeStyle = css(P.dark);
  ctx.lineWidth = 2;
  ctx.stroke();

  if (cls === 'fish') {
    ctx.beginPath();
    ctx.arc(-12, 0, 15, -0.5, 0.5);
    ctx.strokeStyle = css(P.dark, 0.35);
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  drawHorn(ctx, a.horn, hg);

  // Auge
  if (cls === 'amphibian') {
    ell(ctx, hg.ex, hg.ey, hg.er + 2.6, hg.er + 2.2);
    fillStroke(ctx, css(shade(P.base, 0.08)), css(P.dark), 1.5);
  }
  eye(ctx, hg.ex, hg.ey, hg.er, P.eye);
  if (cls === 'reptile' || a.kiefer >= 4) {
    ctx.beginPath();
    ctx.moveTo(hg.ex - hg.er - 1, hg.ey - hg.er - 0.5);
    ctx.quadraticCurveTo(hg.ex, hg.ey - hg.er - 3, hg.ex + hg.er + 2, hg.ey - hg.er + 1.5);
    ctx.strokeStyle = css(P.dark);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Nase
  if (cls === 'mammal') {
    ell(ctx, L - 1, mouthY - snoutH * 0.7, 3.4, 2.6);
    ctx.fillStyle = '#2a1e1e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,30,.55)';
    ctx.lineWidth = 0.7;
    for (const dy of [-1.5, 0.5, 2.5]) {
      ctx.beginPath();
      ctx.moveTo(L - 7, mouthY - 3 + dy * 0.4);
      ctx.lineTo(L + 6, mouthY - 4 + dy * 1.6);
      ctx.stroke();
    }
  } else if (cls !== 'fish') {
    ell(ctx, L - 4, mouthY - snoutH * 0.75, 1.2, 0.9);
    ctx.fillStyle = css(P.dark);
    ctx.fill();
  }
}

function drawTeeth(ctx: Ctx, a: Appearance, hg: HeadGeo) {
  const t = TEETH[a.kiefer] ?? TEETH[0];
  const { L, mouthY, hingeX } = hg;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < t.n; i++) {
    const x = hingeX + 3 + ((i + 0.5) * (L - hingeX - 6)) / t.n;
    const s = t.s * (a.kiefer === 4 ? (i % 2 ? 0.75 : 1.15) : 1) * (a.kiefer === 3 && i === t.n - 2 ? 1.6 : 1);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, mouthY - 0.6);
    ctx.lineTo(x + s * 0.5, mouthY - 0.6);
    ctx.lineTo(x + s * 0.12, mouthY + s);
    ctx.closePath();
    fillStroke(ctx, '#fffef5', '#8a7a6a', 0.8);
  }
  if (a.kiefer === 5) {
    const x = L * 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 3, mouthY - 0.5);
    ctx.quadraticCurveTo(x - 2.5, mouthY + 12, x + 1, mouthY + 18);
    ctx.quadraticCurveTo(x + 2.5, mouthY + 9, x + 3, mouthY - 0.5);
    ctx.closePath();
    fillStroke(ctx, ivory(ctx, mouthY, mouthY + 18), IVORY_STROKE, 1);
  }
}

function drawJaw(ctx: Ctx, a: Appearance, P: Palette, hg: HeadGeo) {
  const len = hg.L - hg.hingeX - 1;
  const h = hg.jawH;
  const t = TEETH[a.kiefer] ?? TEETH[0];
  const n = Math.max(0, t.n - 1);
  for (let i = 0; i < n; i++) {
    const x = 4 + ((i + 0.5) * (len - 8)) / n;
    const s = t.s * 0.85;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, 0.5);
    ctx.lineTo(x + s * 0.5, 0.5);
    ctx.lineTo(x, -s * 0.85);
    ctx.closePath();
    fillStroke(ctx, '#fffef5', '#8a7a6a', 0.8);
  }
  ctx.beginPath();
  ctx.moveTo(-1, -0.5);
  ctx.lineTo(len, -0.5);
  ctx.quadraticCurveTo(len + 1.5, h * 0.55, len - 4, h);
  ctx.quadraticCurveTo(len * 0.45, h * 1.2, -2, h * 0.75);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(P.belly));
  g.addColorStop(1, css(shade(P.base, -0.05)));
  fillStroke(ctx, g, css(P.dark), 1.6);
}

// ---------------------------------------------------------------------------
// Schwanz / Flosse

function drawTail(ctx: Ctx, a: Appearance, P: Palette, sh: Shape) {
  if (a.cls === 'fish') {
    const k = Math.min(2, a.schwanz);
    ctx.beginPath();
    if (k === 0) {
      ctx.moveTo(-4, -4);
      ctx.quadraticCurveTo(-16, -16, -22, -12);
      ctx.quadraticCurveTo(-17, 0, -22, 12);
      ctx.quadraticCurveTo(-16, 16, -4, 4);
    } else if (k === 1) {
      ctx.moveTo(-4, -4);
      ctx.quadraticCurveTo(-18, -20, -30, -21);
      ctx.quadraticCurveTo(-21, -6, -18, 0);
      ctx.quadraticCurveTo(-21, 6, -30, 21);
      ctx.quadraticCurveTo(-18, 20, -4, 4);
    } else {
      ctx.moveTo(-4, -4);
      ctx.quadraticCurveTo(-14, -14, -34, -30);
      ctx.quadraticCurveTo(-24, -10, -22, 0);
      ctx.quadraticCurveTo(-24, 10, -34, 30);
      ctx.quadraticCurveTo(-14, 14, -4, 4);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, -30, 0);
    g.addColorStop(0, css(P.accent));
    g.addColorStop(1, css(shade(P.accent, -0.2), 0.85));
    fillStroke(ctx, g, css(P.dark, 0.8), 1.4);
    ctx.strokeStyle = css(shade(P.accent, -0.35), 0.55);
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-6, i * 1.2);
      ctx.lineTo(-18 - k * 4, i * (6 + k * 3));
      ctx.stroke();
    }
    // Schwanzstiel
    ctx.beginPath();
    ctx.moveTo(4, -6);
    ctx.lineTo(-6, -4.5);
    ctx.lineTo(-6, 4.5);
    ctx.lineTo(4, 6);
    ctx.closePath();
    ctx.fillStyle = css(P.base);
    ctx.fill();
    return;
  }

  const kind = a.schwanz;
  const baseH = sh.bh * 0.42;
  const len = [26, 44, 40, 42, 40][kind] ?? 30;
  const tipY = a.cls === 'mammal' ? -8 : -3;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(5, -baseH / 2);
    ctx.quadraticCurveTo(-len * 0.5, -baseH * 0.45 - 2, -len, tipY);
    ctx.quadraticCurveTo(-len * 0.5, baseH * 0.28, 5, baseH / 2);
    ctx.closePath();
  };

  if (kind === 4) {
    // Buschschwanz
    const r = mulberry32(3);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = -t * len, y = tipY * t - 2 + Math.sin(t * 3) * 2;
      ell(ctx, x, y, 7 + t * 4, 6 + t * 3, -0.3);
      fillStroke(ctx, css(i > 6 ? shade(P.base, 0.35) : shade(P.base, (r() - 0.5) * 0.15)), css(P.dark, 0.7), 1.2);
    }
    return;
  }
  if (kind === 2) {
    ctx.beginPath();
    ctx.moveTo(2, -baseH / 2);
    ctx.quadraticCurveTo(-len * 0.5, -baseH - 7, -len, tipY - 2);
    ctx.lineTo(-len, tipY + 2);
    ctx.quadraticCurveTo(-len * 0.5, baseH + 6, 2, baseH / 2);
    ctx.closePath();
    fillStroke(ctx, css(P.accent, 0.85), css(P.dark, 0.8), 1.3);
  }
  path();
  const g = ctx.createLinearGradient(0, -baseH, 0, baseH);
  g.addColorStop(0, css(shade(P.base, 0.1)));
  g.addColorStop(1, css(shade(P.base, -0.18)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  if (a.cls !== 'mammal' && a.haut !== 5) {
    for (let i = 1; i < 5; i++) {
      ctx.fillStyle = css(P.dark, 0.2);
      ctx.fillRect(-len * (i / 5) - 2, -baseH, 3.5, baseH * 2);
    }
  } else {
    ctx.strokeStyle = css(shade(P.base, -0.3), 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const x = -((i * 37) % 100) / 100 * len, y = ((i * 53) % 100) / 100 * baseH - baseH / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 1.5);
      ctx.stroke();
    }
  }
  ctx.restore();
  path();
  ctx.strokeStyle = css(P.dark);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  if (a.cls === 'mammal' && kind < 2) {
    ell(ctx, -len + 1, tipY, 5, 4);
    fillStroke(ctx, css(shade(P.base, -0.3)), css(P.dark), 1.2);
  }
  if (kind === 3) {
    ell(ctx, -len - 2, tipY, 8, 7);
    fillStroke(ctx, ivory(ctx, tipY - 7, tipY + 7), IVORY_STROKE, 1.4);
    for (const [dx, dy] of [[-4, -8], [2, -8], [-10, -2]]) {
      ctx.beginPath();
      ctx.moveTo(-len - 2 + dx * 0.4, tipY + dy * 0.4);
      ctx.lineTo(-len - 2 + dx, tipY + dy);
      ctx.lineTo(-len - 2 + dx * 0.4 + 3, tipY + dy * 0.4 + 2);
      ctx.closePath();
      fillStroke(ctx, '#f6edd6', IVORY_STROKE, 1);
    }
  }
  if (a.haut === 4) {
    for (let i = 0; i < 3; i++) {
      const x = -len * (0.2 + i * 0.25);
      const y = -baseH * 0.45 + (tipY + baseH * 0.4) * (0.2 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 2);
      ctx.lineTo(x - 1, y - 7);
      ctx.lineTo(x + 3, y + 2);
      ctx.closePath();
      fillStroke(ctx, ivory(ctx, y - 7, y + 2), IVORY_STROKE, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Beine & Flosse

function drawLeg(ctx: Ctx, a: Appearance, P: Palette, len: number, w: number) {
  const thigh = w * (a.beine === 2 ? 1.45 : 1.2);
  const ankle = w * (a.beine === 4 ? 0.4 : 0.5);
  // Knie leicht nach vorne (Säuger/Reptil), Oberschenkel geht weich in den Körper über
  const knee = a.cls === 'amphibian' ? 0 : len * (a.cls === 'mammal' ? 0.1 : 0.14);
  const legPath = () => {
    ctx.beginPath();
    ctx.moveTo(-thigh * 0.6, -6);
    ctx.bezierCurveTo(-thigh * 0.85, len * 0.3, -ankle * 0.5 + knee, len * 0.5, -ankle * 0.55, len - 3);
    ctx.lineTo(ankle * 0.55 + 1, len - 3);
    ctx.bezierCurveTo(ankle * 0.7 + knee, len * 0.5, thigh * 0.8, len * 0.28, thigh * 0.6, -6);
  };
  legPath();
  const g = ctx.createLinearGradient(0, -6, 0, len);
  g.addColorStop(0, css(P.base));
  g.addColorStop(0.35, css(P.base));
  g.addColorStop(1, css(shade(P.base, -0.28)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  legPath();
  ctx.clip();
  ell(ctx, -thigh * 0.15, len * 0.25, thigh * 0.25, len * 0.22);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.restore();
  legPath();
  ctx.strokeStyle = css(P.dark);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (a.cls === 'mammal' || a.haut === 5) {
    ctx.strokeStyle = css(shade(P.base, -0.3), 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-thigh * 0.3 + (i % 3) * 3, len * (0.15 + i * 0.12));
      ctx.lineTo(-thigh * 0.3 + (i % 3) * 3 - 2, len * (0.15 + i * 0.12) + 3);
      ctx.stroke();
    }
  }
  // Fuß
  if (a.cls === 'amphibian') {
    ell(ctx, 2, len - 2, w * 0.7, 2.6);
    fillStroke(ctx, css(shade(P.base, -0.15)), css(P.dark), 1.2);
    for (let i = 0; i < 3; i++) {
      ell(ctx, w * 0.5 + i * 2.2, len - 1.5 + (i - 1) * 0.6, 1.5, 1.5);
      ctx.fillStyle = css(shade(P.base, 0.1));
      ctx.fill();
    }
  } else if (a.cls === 'mammal' && a.beine === 4) {
    ctx.beginPath();
    ctx.moveTo(-ankle / 2 - 1, len - 4);
    ctx.lineTo(ankle / 2 + 3, len - 4);
    ctx.lineTo(ankle / 2 + 4, len);
    ctx.lineTo(-ankle / 2 - 2, len);
    ctx.closePath();
    fillStroke(ctx, '#3a2a22', css(P.dark), 1);
  } else {
    ell(ctx, 2.5, len - 2.5, w * 0.72, 3);
    fillStroke(ctx, css(shade(P.base, -0.15)), css(P.dark), 1.2);
  }
  if (a.beine === 3 || (a.cls === 'reptile' && a.kiefer >= 4)) {
    for (let i = 0; i < 3; i++) {
      const x = w * 0.45 + i * 2.4;
      ctx.beginPath();
      ctx.moveTo(x - 1, len - 3.5);
      ctx.quadraticCurveTo(x + 3, len - 2, x + 3, len + 1.5);
      ctx.lineTo(x, len - 1);
      ctx.closePath();
      fillStroke(ctx, '#f4efe2', '#4a3a2a', 0.8);
    }
  }
}

function drawFin(ctx: Ctx, P: Palette) {
  ctx.beginPath();
  ctx.moveTo(1, -2.5);
  ctx.quadraticCurveTo(-5, 9, -15, 10);
  ctx.quadraticCurveTo(-9, 4, -1, 3);
  ctx.closePath();
  fillStroke(ctx, css(P.accent, 0.88), css(P.dark, 0.7), 1.2);
  ctx.strokeStyle = css(shade(P.accent, -0.35), 0.55);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-8 - i * 2, 4 + i * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------

export function appearanceKey(a: Appearance) {
  return `${a.cls}_${a.kiefer}_${a.horn}_${a.koerper}_${a.haut}_${a.schwanz}_${a.beine}_${a.farbe}`;
}

/** Erzeugt (einmalig) alle Teil-Texturen für dieses Aussehen. */
export function creatureTextures(scene: Phaser.Scene, a: Appearance): CreatureTex {
  const L = layoutOf(a);
  const P = PALETTES[a.farbe] ?? PALETTES[0];
  const id = 'cr_' + appearanceKey(a);
  const s = L.s;
  const sh = L.sh;
  const hg = L.hg;

  const body = part(scene, id + '_b', (sh.bw + 56) * s, (sh.bh + 64) * s, (sh.bw / 2 + 28) * s, (sh.bh / 2 + 36) * s, (ctx) => {
    ctx.scale(s, s);
    drawBody(ctx, a, P, sh);
  });

  const hw = hg.L + 46, hh = hg.H + 70;
  const hpx = 34, hpy = hg.H / 2 + 44;
  const head = part(scene, id + '_h', hw * s, hh * s, hpx * s, hpy * s, (ctx) => {
    ctx.scale(s, s);
    drawHead(ctx, a, P, hg);
  });
  const teeth = part(scene, id + '_t', hw * s, hh * s, hpx * s, hpy * s, (ctx) => {
    ctx.scale(s, s);
    drawTeeth(ctx, a, hg);
  });
  const jlen = hg.L - hg.hingeX + 8;
  const jaw = part(scene, id + '_j', (jlen + 6) * s, (hg.jawH + 16) * s, 4 * s, 8 * s, (ctx) => {
    ctx.scale(s, s);
    drawJaw(ctx, a, P, hg);
  });
  const tail = part(scene, id + '_s', 72 * s, 72 * s, 62 * s, 36 * s, (ctx) => {
    ctx.scale(s, s);
    drawTail(ctx, a, P, sh);
  });
  const out: CreatureTex = { body, head, teeth, jaw, tail, layout: L };
  if (L.land) {
    const lw = L.legW * 1.6 + 14;
    out.leg = part(scene, id + '_l', lw * s, (L.leg + 8) * s, (lw / 2 - 1) * s, 2 * s, (ctx) => {
      ctx.scale(s, s);
      drawLeg(ctx, a, P, L.leg, L.legW);
    });
  } else {
    out.fin = part(scene, id + '_f', 22 * s, 18 * s, 18 * s, 5 * s, (ctx) => {
      ctx.scale(s, s);
      drawFin(ctx, P);
    });
  }
  return out;
}
