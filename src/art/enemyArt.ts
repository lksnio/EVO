import Phaser from 'phaser';
import type { Art, EnemyDef } from '../data/enemies';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, fillStroke, newCanvas, rgrad, trimCanvases } from '../util/canvas';
import { mulberry32 } from '../util/math';

// Gegner werden für 2 Animations-Bilder gezeichnet (Beine/Flügel/Flossen
// in zwei Stellungen) und auf die sichtbare Fläche zugeschnitten.

const OUT = (c: number) => css(shade(c, -0.6));

function angryEye(ctx: Ctx, x: number, y: number, r: number, iris = '#ffcc33', brow = true) {
  ell(ctx, x, y, r, r);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ell(ctx, x + r * 0.25, y, r * 0.55, r * 0.6);
  ctx.fillStyle = iris;
  ctx.fill();
  ell(ctx, x + r * 0.32, y, r * 0.28, r * 0.42);
  ctx.fillStyle = '#111';
  ctx.fill();
  ell(ctx, x + r * 0.05, y - r * 0.35, r * 0.2, r * 0.2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  if (brow) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.1, y - r * 1.2);
    ctx.lineTo(x + r * 1.1, y - r * 0.55);
    ctx.strokeStyle = '#1a1010';
    ctx.lineWidth = Math.max(1.5, r * 0.45);
    ctx.stroke();
  }
}

function bodyGrad(ctx: Ctx, c: number, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, css(shade(c, 0.15)));
  g.addColorStop(0.6, css(c));
  g.addColorStop(1, css(shade(c, -0.2)));
  return g;
}

// ---------------------------------------------------------------------------

function drawFish(ctx: Ctx, p: Extract<Art, { t: 'fish' }>, f: number) {
  const { len, h, c } = p;
  const hw = len / 2, hh = h / 2;
  const sw = f ? 0.22 : -0.22;
  const lw = Math.max(1.5, len / 40);
  // Schwanzflosse
  ctx.save();
  ctx.translate(-hw + len * 0.05, 0);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(0, -hh * 0.25);
  ctx.quadraticCurveTo(-len * 0.2, -hh * 1.1, -len * 0.3, -hh * 1.15);
  ctx.quadraticCurveTo(-len * 0.2, 0, -len * 0.3, hh * 1.15);
  ctx.quadraticCurveTo(-len * 0.2, hh * 1.1, 0, hh * 0.25);
  ctx.closePath();
  fillStroke(ctx, css(p.fin), OUT(p.fin), lw);
  ctx.restore();
  // Rückenflosse
  ctx.beginPath();
  ctx.moveTo(hw * 0.3, -hh * 0.85);
  ctx.quadraticCurveTo(-hw * 0.1, -hh * 1.9, -hw * 0.5, -hh * 1.4);
  ctx.lineTo(-hw * 0.55, -hh * 0.7);
  ctx.closePath();
  fillStroke(ctx, css(p.fin), OUT(p.fin), lw);
  // Körper
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hw, hh * 0.1);
    ctx.bezierCurveTo(hw * 0.9, -hh * 1.2, -hw * 0.6, -hh * 1.1, -hw, -hh * 0.2);
    ctx.lineTo(-hw, hh * 0.2);
    ctx.bezierCurveTo(-hw * 0.6, hh * 1.1, hw * 0.8, hh * 1.2, hw, hh * 0.1);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = bodyGrad(ctx, c, -hh, hh);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ell(ctx, 0, hh * 0.8, hw, hh * 0.6);
  ctx.fillStyle = css(p.belly, 0.9);
  ctx.fill();
  if (p.armor) {
    // Knochenpanzer am Kopf (Panzerfisch)
    const bone = mix(c, 0xd8d2c0, 0.55);
    ctx.beginPath();
    ctx.moveTo(hw + 4, -hh * 1.2);
    ctx.lineTo(hw * 0.05, -hh * 1.2);
    ctx.quadraticCurveTo(-hw * 0.1, 0, hw * 0.05, hh * 1.2);
    ctx.lineTo(hw + 4, hh * 1.2);
    ctx.closePath();
    fillStroke(ctx, css(bone), OUT(c), lw);
    ctx.strokeStyle = css(shade(bone, -0.4), 0.7);
    ctx.lineWidth = lw * 0.8;
    for (const [x0, y0, x1, y1] of [[hw * 0.45, -hh, hw * 0.4, hh * 0.3], [hw * 0.05, -hh * 0.2, hw * 0.9, -hh * 0.3], [hw * 0.7, -hh, hw * 0.75, -hh * 0.3]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      ell(ctx, hw * (0.15 + (i % 3) * 0.25), -hh * (0.75 - Math.floor(i / 3) * 0.9), lw * 0.9, lw * 0.9);
      ctx.fillStyle = css(shade(bone, -0.35));
      ctx.fill();
    }
  }
  ctx.restore();
  path();
  ctx.strokeStyle = OUT(c);
  ctx.lineWidth = lw;
  ctx.stroke();
  // Maul
  const my = hh * 0.25;
  ctx.beginPath();
  ctx.moveTo(hw, my);
  ctx.lineTo(hw * 0.65, my + hh * 0.05);
  ctx.strokeStyle = OUT(c);
  ctx.lineWidth = lw;
  ctx.stroke();
  if (p.teeth) {
    const n = p.armor ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = hw * 0.7 + (i * hw * 0.3) / n;
      const s = p.armor ? hh * 0.32 : hh * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, my - 0.5);
      ctx.lineTo(x + s * 0.6, my - 0.5);
      ctx.lineTo(x + s * 0.3, my + s);
      ctx.closePath();
      fillStroke(ctx, '#fffef2', '#6a5a4a', 0.8);
    }
  }
  // Brustflosse
  ctx.save();
  ctx.translate(hw * 0.2, hh * 0.35);
  ctx.rotate(f ? 0.5 : 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-hw * 0.3, hh * 0.6, -hw * 0.45, hh * 0.45);
  ctx.quadraticCurveTo(-hw * 0.25, hh * 0.15, 0, 0);
  ctx.closePath();
  fillStroke(ctx, css(p.fin, 0.9), OUT(p.fin), lw * 0.8);
  ctx.restore();
  angryEye(ctx, hw * 0.55, -hh * 0.3, Math.max(2.4, hh * (p.armor ? 0.16 : 0.28)), p.armor ? '#ff5533' : '#ffdd44', !!p.teeth);
}

function drawJelly(ctx: Ctx, p: Extract<Art, { t: 'jelly' }>, f: number) {
  const r = p.r;
  ctx.strokeStyle = css(p.c, 0.75);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const x0 = -r * 0.75 + (i * r * 1.5) / 5;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let k = 1; k <= 6; k++) {
      ctx.lineTo(x0 + Math.sin(k * 1.2 + i + f * 1.6) * 3, (k * r * 1.4) / 6);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-r, 1);
  ctx.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, 1);
  for (let i = 0; i <= 6; i++) ctx.lineTo(r - (i * 2 * r) / 6, 1 + (i % 2 ? 3 : 0));
  ctx.closePath();
  ctx.fillStyle = rgrad(ctx, -r * 0.3, -r * 0.5, 1, r * 1.3, [[0, 'rgba(255,255,255,.95)'], [0.35, css(p.c, 0.85)], [1, css(shade(p.c, -0.3), 0.75)]]);
  ctx.fill();
  ctx.strokeStyle = css(shade(p.c, -0.4), 0.9);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ell(ctx, 0, -r * 0.35, r * 0.4, r * 0.25);
  ctx.fillStyle = css(shade(p.c, 0.4), 0.6);
  ctx.fill();
  ell(ctx, -r * 0.3, -r * 0.2, 1.8, 2.2);
  ell(ctx, r * 0.2, -r * 0.2, 1.8, 2.2);
  ctx.fillStyle = '#4a1840';
  ctx.fill();
}

function drawTrilo(ctx: Ctx, p: Extract<Art, { t: 'trilo' }>, f: number) {
  const hw = p.len / 2, c = p.c;
  ctx.strokeStyle = OUT(c);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const x = -hw * 0.7 + i * hw * 0.28;
    const a = (i % 2 ? 1 : -1) * (f ? 0.4 : -0.4);
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + Math.sin(a) * 5, 9);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-hw, 3);
  ctx.quadraticCurveTo(-hw * 0.8, -hw * 0.6, hw * 0.2, -hw * 0.55);
  ctx.quadraticCurveTo(hw * 1.05, -hw * 0.5, hw, 3);
  ctx.closePath();
  fillStroke(ctx, bodyGrad(ctx, c, -hw * 0.6, 3), OUT(c), 1.6);
  ctx.strokeStyle = css(shade(c, -0.45), 0.8);
  ctx.lineWidth = 1.1;
  for (let i = 1; i < 7; i++) {
    const x = -hw + i * hw * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.quadraticCurveTo(x + 2, -hw * 0.3, x, -hw * 0.5 + Math.abs(x) * 0.15);
    ctx.stroke();
  }
  ell(ctx, hw * 0.55, -hw * 0.3, 3, 2.4);
  fillStroke(ctx, '#2a2018', '#000', 0.6);
  ell(ctx, hw * 0.5, -hw * 0.36, 1, 0.8);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-hw, 2);
  ctx.lineTo(-hw - 6, 4);
  ctx.stroke();
}

function drawShell(ctx: Ctx, p: Extract<Art, { t: 'shell' }>, f: number) {
  const r = p.r, c = p.c;
  // Tentakel
  ctx.strokeStyle = css(mix(c, 0xffb0a0, 0.5));
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.25 + i * 1.6);
    ctx.quadraticCurveTo(r * 1.2, r * 0.2 + i * 2.5 + (f ? 3 : -2), r * 1.55, r * 0.35 + i * 3 + (f ? -1 : 2));
    ctx.stroke();
  }
  ell(ctx, r * 0.8, r * 0.15, r * 0.35, r * 0.32);
  fillStroke(ctx, css(mix(c, 0xffc0b0, 0.4)), OUT(c), 1.2);
  // Schale
  ell(ctx, 0, 0, r, r);
  fillStroke(ctx, rgrad(ctx, -r * 0.3, -r * 0.3, 1, r * 1.2, [[0, css(shade(c, 0.45))], [1, css(shade(c, -0.15))]]), OUT(c), 1.8);
  ctx.strokeStyle = css(shade(c, -0.35), 0.85);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.1) {
    const rr = r * 0.95 * Math.exp(-a * 0.16);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
  angryEye(ctx, r * 0.85, -r * 0.05, 2.6);
}

function drawBug(ctx: Ctx, p: Extract<Art, { t: 'bug' }>, f: number) {
  if (p.wings) return drawDragonfly(ctx, p, f);
  const { len, h, segs, c } = p;
  const hw = len / 2;
  const lw = Math.max(1.3, len / 70);
  const segX = (i: number) => hw - h * 0.6 - (i * (len - h * 1.1)) / Math.max(1, segs - 1);
  const segR = (i: number) => (h / 2) * (1 - (i / segs) * 0.45);
  // Beine
  ctx.strokeStyle = css(shade(c, -0.45));
  ctx.lineWidth = lw * 1.2;
  const legN = p.legs;
  for (let i = 0; i < legN; i++) {
    const x = hw - h - (i * len * 0.75) / Math.max(1, legN);
    const a = (i % 2 ? 1 : -1) * (f ? 0.35 : -0.35);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.2);
    ctx.lineTo(x + Math.sin(a) * h * 0.4 + h * 0.15, h * 0.65);
    ctx.lineTo(x + Math.sin(a) * h * 0.8, h * 1.15);
    ctx.stroke();
  }
  // Ruderbeine (Seeskorpion)
  if (p.paddles) {
    ctx.save();
    ctx.translate(hw * 0.2, h * 0.3);
    ctx.rotate(f ? 0.5 : -0.1);
    ell(ctx, -h * 0.6, h * 0.5, h * 0.7, h * 0.3, 0.6);
    fillStroke(ctx, css(shade(c, 0.1)), OUT(c), lw);
    ctx.restore();
  }
  // Stachel
  if (p.stinger === 'straight') {
    ctx.beginPath();
    ctx.moveTo(-hw + h * 0.4, -2);
    ctx.lineTo(-hw - h * 0.9, 0);
    ctx.lineTo(-hw + h * 0.4, 2);
    ctx.closePath();
    fillStroke(ctx, css(shade(c, -0.2)), OUT(c), lw);
  }
  // Segmente von hinten nach vorne
  for (let i = segs - 1; i >= 0; i--) {
    if (p.stinger === 'up' && i >= segs - 2) continue;
    const r = segR(i);
    ell(ctx, segX(i), 0, r * 1.05, r);
    fillStroke(ctx, bodyGrad(ctx, i % 2 ? shade(c, -0.08) : c, -r, r), OUT(c), lw);
  }
  if (p.stinger === 'up') {
    // Schwanz nach oben gebogen
    let x = segX(segs - 3) - h * 0.3, y = -h * 0.3;
    const pts: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.95 - i * 0.42;
      x += Math.cos(a) * h * 0.55;
      y -= Math.sin(a) * h * 0.55 * 1.1;
      pts.push([x, y]);
    }
    pts.forEach(([px, py], i) => {
      ell(ctx, px, py, h * (0.32 - i * 0.03), h * (0.28 - i * 0.025));
      fillStroke(ctx, bodyGrad(ctx, c, py - 5, py + 5), OUT(c), lw);
    });
    const [sx, sy] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 2);
    ctx.quadraticCurveTo(sx + h * 0.5, sy - h * 0.1, sx + h * 0.55, sy + h * 0.35);
    ctx.quadraticCurveTo(sx + h * 0.2, sy + h * 0.05, sx + 2, sy + 3);
    ctx.closePath();
    fillStroke(ctx, '#e8d050', '#3a2a10', lw);
  }
  // Kristallpanzer
  if (p.crystal) {
    for (let i = 0; i < 5; i++) {
      const x = -hw * 0.5 + i * hw * 0.25;
      const ht = h * (0.8 + (i % 2) * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - 5, -h * 0.25);
      ctx.lineTo(x - 2, -h * 0.25 - ht);
      ctx.lineTo(x + 2, -h * 0.25 - ht - 3);
      ctx.lineTo(x + 5, -h * 0.25);
      ctx.closePath();
      const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
      g.addColorStop(0, '#c8f8ff');
      g.addColorStop(0.5, '#6ad8ff');
      g.addColorStop(1, '#3a7ad0');
      fillStroke(ctx, g, '#1a3a70', lw);
    }
  }
  // Kopf
  const hx = hw - h * 0.45;
  ell(ctx, hx, 0, h * 0.55, h * 0.48);
  fillStroke(ctx, bodyGrad(ctx, shade(c, 0.05), -h * 0.5, h * 0.5), OUT(c), lw);
  ell(ctx, hx + h * 0.15, -h * 0.12, h * 0.26, h * 0.24);
  ctx.fillStyle = '#1a1010';
  ctx.fill();
  ell(ctx, hx + h * 0.08, -h * 0.2, h * 0.08, h * 0.08);
  ctx.fillStyle = '#fff';
  ctx.fill();
  if (p.antenna) {
    ctx.strokeStyle = css(shade(c, -0.4));
    ctx.lineWidth = lw;
    for (const d of [0, 3]) {
      ctx.beginPath();
      ctx.moveTo(hx + h * 0.2, -h * 0.35);
      ctx.quadraticCurveTo(hx + h * 0.8 + d, -h * 1.1, hx + h * 1.2 + d, -h * (f ? 0.95 : 1.05));
      ctx.stroke();
    }
  }
  if (p.pincers) {
    for (const [dy, sc] of [[-0.2, 0.9], [0.25, 1]] as const) {
      ctx.save();
      ctx.translate(hx + h * 0.35, h * dy);
      ctx.rotate(f ? -0.1 : 0.15);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(h * 0.7 * sc, -h * 0.1);
      ctx.strokeStyle = OUT(c);
      ctx.lineWidth = lw * 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h * 0.6 * sc, -h * 0.1);
      ctx.quadraticCurveTo(h * 1.2 * sc, -h * 0.55, h * 1.35 * sc, -h * 0.05);
      ctx.lineTo(h * 0.95 * sc, -h * 0.05);
      ctx.quadraticCurveTo(h * 1.25 * sc, h * 0.35, h * 0.6 * sc, h * 0.1);
      ctx.closePath();
      fillStroke(ctx, bodyGrad(ctx, c, -h * 0.4, h * 0.3), OUT(c), lw);
      ctx.restore();
    }
  } else {
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    ctx.moveTo(hx + h * 0.45, h * 0.15);
    ctx.quadraticCurveTo(hx + h * 0.75, h * 0.2, hx + h * 0.7, h * 0.45);
    ctx.stroke();
  }
}

function drawFrog(ctx: Ctx, p: Extract<Art, { t: 'frog' }>, f: number) {
  const { w, h, c } = p;
  const hw = w / 2, hh = h / 2;
  // Hinterbein
  ctx.save();
  ctx.translate(-hw * 0.45, hh * 0.25);
  if (f) {
    ctx.rotate(0.6);
    ell(ctx, -hw * 0.4, hh * 0.35, hw * 0.55, hh * 0.25);
  } else {
    ell(ctx, -hw * 0.05, hh * 0.25, hw * 0.45, hh * 0.4);
  }
  fillStroke(ctx, bodyGrad(ctx, c, -hh * 0.3, hh * 0.6), OUT(c), 1.6);
  ctx.restore();
  // Kehlsack
  if (p.sac && f) {
    ell(ctx, hw * 0.45, hh * 0.45, hw * 0.4, hh * 0.45);
    fillStroke(ctx, rgrad(ctx, hw * 0.4, hh * 0.3, 1, hw * 0.5, [[0, '#ffd0ff'], [1, css(p.sac)]]), OUT(p.sac), 1.4);
  }
  // Körper
  ctx.beginPath();
  ctx.moveTo(-hw, hh * 0.6);
  ctx.bezierCurveTo(-hw * 1.05, -hh * 0.8, hw * 0.4, -hh * 1.1, hw, -hh * 0.1);
  ctx.quadraticCurveTo(hw * 1.05, hh * 0.6, hw * 0.5, hh * 0.75);
  ctx.lineTo(-hw, hh * 0.75);
  ctx.closePath();
  fillStroke(ctx, bodyGrad(ctx, c, -hh, hh), OUT(c), 1.8);
  ell(ctx, hw * 0.1, hh * 0.45, hw * 0.6, hh * 0.3);
  ctx.fillStyle = css(p.belly, 0.85);
  ctx.fill();
  const r = mulberry32(9);
  for (let i = 0; i < 7; i++) {
    ell(ctx, -hw * 0.7 + r() * hw * 1.1, -hh * 0.4 + r() * hh * 0.6, 1.5 + r() * 2, 1.2 + r() * 1.5);
    ctx.fillStyle = css(shade(c, -0.35), 0.6);
    ctx.fill();
  }
  // Vorderbein
  ctx.beginPath();
  ctx.moveTo(hw * 0.35, hh * 0.3);
  ctx.lineTo(hw * 0.45, hh * 0.85);
  ctx.strokeStyle = OUT(c);
  ctx.lineWidth = 4.5;
  ctx.stroke();
  ctx.strokeStyle = css(c);
  ctx.lineWidth = 3;
  ctx.stroke();
  // Maul & Augen
  ctx.beginPath();
  ctx.moveTo(hw * 0.98, hh * 0.05);
  ctx.quadraticCurveTo(hw * 0.6, hh * 0.3, hw * 0.25, hh * 0.05);
  ctx.strokeStyle = OUT(c);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ell(ctx, hw * 0.45, -hh * 0.75, hh * 0.33, hh * 0.3);
  fillStroke(ctx, css(c), OUT(c), 1.4);
  angryEye(ctx, hw * 0.48, -hh * 0.78, hh * 0.24, '#ffaa22', false);
}

function drawQuad(ctx: Ctx, p: Extract<Art, { t: 'quad' }>, f: number) {
  const { len, bh, leg, c } = p;
  const hw = len / 2, hh = bh / 2;
  const D = shade(c, -0.55);
  const lw = Math.max(1.6, len / 45);
  const step = f ? 1 : -1;
  const r = mulberry32(len * 7 + bh);

  const drawLeg = (x: number, y: number, ang: number, L: number, W: number, col: number, front: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (p.biped) {
      ell(ctx, 0, L * 0.25, W * 0.75, L * 0.38);
      fillStroke(ctx, bodyGrad(ctx, col, -L * 0.1, L * 0.6), css(D), lw);
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, L * 0.45);
      ctx.lineTo(-W * 0.45, L - 2);
      ctx.lineTo(W * 0.2, L - 2);
      ctx.lineTo(W * 0.35, L * 0.45);
      ctx.closePath();
      fillStroke(ctx, css(shade(col, -0.1)), css(D), lw);
    } else {
      ctx.beginPath();
      ctx.moveTo(-W / 2, 0);
      ctx.quadraticCurveTo(-W * 0.65, L * 0.5, -W * 0.32, L - 2);
      ctx.lineTo(W * 0.36, L - 2);
      ctx.quadraticCurveTo(W * 0.6, L * 0.45, W / 2, 0);
      ctx.closePath();
      fillStroke(ctx, bodyGrad(ctx, col, 0, L), css(D), lw);
    }
    // Fuß
    ell(ctx, W * 0.15, L - 1.5, W * (p.fur ? 0.55 : 0.6), Math.max(2.4, W * 0.22));
    fillStroke(ctx, css(p.stone ? shade(col, -0.2) : shade(col, -0.25)), css(D), lw * 0.8);
    if (!p.fur && !p.stone && (front || p.biped)) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.35 + i * 2, L - 3);
        ctx.lineTo(W * 0.6 + i * 2.3, L + 1);
        ctx.strokeStyle = '#f2ead8';
        ctx.lineWidth = lw * 0.9;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const legW = Math.max(6, p.biped ? bh * 0.5 : bh * 0.38);
  const hipY = hh * 0.35;
  const hips = p.biped ? [-hw * 0.15] : [hw * 0.55, -hw * 0.55];
  const darkC = shade(c, -0.28);
  // hintere Beine
  hips.forEach((x, i) => drawLeg(x + 4, hipY - 2, (i % 2 ? 1 : -1) * step * 0.3, leg, legW, darkC, i === 0));

  // Schwanz
  const tw = p.tailW ?? bh * 0.45;
  const tailPath = () => {
    ctx.beginPath();
    ctx.moveTo(-hw + 6, -hh * 0.55);
    ctx.quadraticCurveTo(-hw - p.tail * 0.5, -hh * 0.5 - (p.biped ? 4 : 0), -hw - p.tail, -hh * (p.biped ? 0.6 : 0.1) + step * 2);
    ctx.quadraticCurveTo(-hw - p.tail * 0.5, -hh * 0.5 + tw * 0.75, -hw + 6, -hh * 0.55 + tw);
    ctx.closePath();
  };
  if (p.tail > 0) {
    if (p.fur) {
      ell(ctx, -hw - p.tail * 0.45, -hh * 0.35, p.tail * 0.6, tw * 0.45, -0.3);
      fillStroke(ctx, bodyGrad(ctx, c, -hh, 0), css(D), lw);
    } else {
      tailPath();
      fillStroke(ctx, bodyGrad(ctx, c, -hh, hh * 0.3), css(D), lw);
    }
    if (p.club) {
      ell(ctx, -hw - p.tail, -hh * 0.1, tw * 0.55, tw * 0.45);
      fillStroke(ctx, css(mix(c, 0xe0d0b0, 0.5)), css(D), lw);
    }
  }
  // Rückenplatten / Stacheln
  if (p.plates || p.spikes || p.crest) {
    const n = p.plates ? 6 : p.spikes ? 7 : 0;
    for (let i = 0; i < n; i++) {
      const x = -hw * 0.75 + (i * hw * 1.5) / (n - 1);
      const y = -hh * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2)) * 0.95;
      const ht = p.plates ? bh * 0.35 : bh * (0.45 + (i % 2) * 0.15);
      ctx.beginPath();
      ctx.moveTo(x - (p.plates ? 6 : 4), y + 4);
      if (p.plates) ctx.quadraticCurveTo(x, y - ht * 1.4, x + 6, y + 4);
      else ctx.lineTo(x + 1, y - ht);
      ctx.lineTo(x + 4, y + 4);
      ctx.closePath();
      fillStroke(ctx, p.plates ? css(mix(c, 0xe8dcc0, 0.4)) : '#f4ead2', css(D), lw);
    }
  }
  // Körper
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(hw, -hh * 0.6);
    ctx.bezierCurveTo(hw * 0.6, -hh * 1.25, -hw * 0.7, -hh * 1.2, -hw, -hh * 0.3);
    ctx.bezierCurveTo(-hw * 1.08, hh * 0.4, -hw * 0.6, hh * 1.05, 0, hh);
    ctx.bezierCurveTo(hw * 0.7, hh * 1.05, hw * 1.15, hh * 0.3, hw, -hh * 0.6);
    ctx.closePath();
  };
  bodyPath();
  ctx.fillStyle = bodyGrad(ctx, c, -hh, hh);
  ctx.fill();
  ctx.save();
  bodyPath();
  ctx.clip();
  ell(ctx, hw * 0.1, hh * 0.85, hw * 0.85, hh * 0.5);
  ctx.fillStyle = css(p.belly, 0.85);
  ctx.fill();
  if (p.stripes) {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const x = -hw * 0.8 + i * hw * 0.32;
      ctx.moveTo(x, -hh * 1.1);
      ctx.quadraticCurveTo(x + 5, -hh * 0.3, x - 2, hh * 0.1);
      ctx.lineWidth = Math.max(2, bh * 0.08);
      ctx.strokeStyle = css(shade(c, -0.4), 0.55);
      ctx.stroke();
    }
  }
  if (p.spots) {
    for (let i = 0; i < 14; i++) {
      ell(ctx, -hw + r() * len, -hh + r() * bh * 0.7, bh * 0.05 + r() * bh * 0.04, bh * 0.04 + r() * bh * 0.03);
      ctx.fillStyle = css(shade(c, -0.45), 0.6);
      ctx.fill();
    }
  }
  if (p.plates) {
    ctx.strokeStyle = css(shade(c, -0.35), 0.7);
    ctx.lineWidth = lw * 0.8;
    for (let x = -hw; x < hw; x += bh * 0.35) {
      for (let y = -hh; y < hh * 0.3; y += bh * 0.3) {
        ell(ctx, x + ((y / (bh * 0.3)) % 2) * bh * 0.17, y, bh * 0.13, bh * 0.1);
        ctx.stroke();
      }
    }
  }
  if (p.fur) {
    for (let i = 0; i < len * 1.5; i++) {
      const x = -hw + r() * len, y = -hh + r() * bh;
      ctx.strokeStyle = css(r() > 0.5 ? shade(c, 0.2) : shade(c, -0.3), 0.55);
      ctx.lineWidth = Math.max(1, lw * 0.7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 2, y + 3, x - 4, y + 5);
      ctx.stroke();
    }
  }
  if (p.stone) {
    ctx.strokeStyle = css(shade(c, -0.45), 0.8);
    ctx.lineWidth = lw;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const x = -hw + r() * len, y = -hh + r() * bh;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + r() * 6, y + 4 + r() * 6);
      ctx.lineTo(x + 2, y + 10);
      ctx.stroke();
    }
    if (p.glow) {
      ctx.strokeStyle = css(p.glow, 0.9);
      ctx.lineWidth = lw * 1.2;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -hh * 0.2);
      ctx.lineTo(-hw * 0.1, hh * 0.2);
      ctx.lineTo(hw * 0.2, -hh * 0.3);
      ctx.lineTo(hw * 0.5, hh * 0.1);
      ctx.stroke();
    }
  }
  ell(ctx, hw * 0.1, -hh * 0.6, hw * 0.6, hh * 0.25);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fill();
  ctx.restore();
  bodyPath();
  ctx.strokeStyle = css(D);
  ctx.lineWidth = lw;
  ctx.stroke();
  if (p.fur) {
    ctx.strokeStyle = css(shade(c, -0.15));
    ctx.lineWidth = lw;
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + 0.15 + (i / 20) * (Math.PI - 0.3);
      const x = Math.cos(a) * hw, y = Math.sin(a) * hh * 1.05;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y - 4);
      ctx.stroke();
    }
  }

  // vordere Beine
  hips.forEach((x, i) => drawLeg(x, hipY, (i % 2 ? -1 : 1) * step * 0.3, leg, legW, c, i === 0));

  // Ärmchen
  if (p.arms) {
    ctx.save();
    ctx.translate(hw * 0.7, hh * 0.1);
    ctx.rotate(0.5 + step * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(bh * 0.4, bh * 0.05);
    ctx.lineTo(bh * 0.45, bh * 0.2);
    ctx.lineTo(0, 3);
    ctx.closePath();
    fillStroke(ctx, css(c), css(D), lw * 0.8);
    ctx.restore();
  }

  // Kopf
  const hx = hw + p.head * 0.15;
  const hy = -hh * (p.biped ? 0.95 : p.trunk ? 0.2 : 0.45) - (p.biped ? bh * 0.25 : 0);
  const HL = p.head, HH = p.headH;
  // Hals
  ctx.beginPath();
  ctx.moveTo(hw * 0.55, -hh * 0.85);
  ctx.quadraticCurveTo(hx - HL * 0.1, hy - HH * 0.6, hx + HL * 0.1, hy - HH * 0.3);
  ctx.lineTo(hx + HL * 0.15, hy + HH * 0.4);
  ctx.quadraticCurveTo(hw * 0.8, hh * 0.1, hw * 0.6, hh * 0.3);
  ctx.closePath();
  fillStroke(ctx, bodyGrad(ctx, c, hy - HH, hh), css(D), lw);
  if (p.frill) {
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.05, hy);
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI * 0.45 - (i / 6) * Math.PI * 0.75;
      const rr = HH * 1.25 + (i % 2 ? 0 : HH * 0.25);
      ctx.lineTo(hx - HL * 0.05 + Math.cos(a) * rr, hy + Math.sin(a) * rr);
    }
    ctx.closePath();
    fillStroke(ctx, 'rgba(240,120,60,.9)', css(D), lw);
  }
  if (p.ears) {
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.05, hy - HH * 0.3);
    ctx.lineTo(hx + HL * 0.02, hy - HH * 0.95);
    ctx.lineTo(hx + HL * 0.22, hy - HH * 0.35);
    ctx.closePath();
    fillStroke(ctx, css(shade(c, -0.1)), css(D), lw);
  }
  const headPath = () => {
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.15, hy - HH * 0.35);
    ctx.bezierCurveTo(hx + HL * 0.2, hy - HH * 0.7, hx + HL * 0.75, hy - HH * 0.5, hx + HL, hy - HH * 0.1);
    ctx.quadraticCurveTo(hx + HL * 1.05, hy + HH * 0.2, hx + HL * 0.92, hy + HH * 0.18);
    ctx.lineTo(hx + HL * 0.3, hy + HH * 0.2);
    ctx.quadraticCurveTo(hx + HL * 0.5, hy + HH * 0.55, hx + HL * 0.15, hy + HH * 0.5);
    ctx.quadraticCurveTo(hx - HL * 0.2, hy + HH * 0.35, hx - HL * 0.15, hy - HH * 0.35);
    ctx.closePath();
  };
  headPath();
  fillStroke(ctx, bodyGrad(ctx, c, hy - HH * 0.6, hy + HH * 0.5), css(D), lw);
  ctx.save();
  headPath();
  ctx.clip();
  ell(ctx, hx + HL * 0.5, hy + HH * 0.45, HL * 0.55, HH * 0.3);
  ctx.fillStyle = css(p.belly, 0.8);
  ctx.fill();
  if (p.stripes) {
    ctx.strokeStyle = css(shade(c, -0.4), 0.5);
    ctx.lineWidth = Math.max(2, HH * 0.1);
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.2, hy - HH);
    ctx.lineTo(hx + HL * 0.25, hy);
    ctx.stroke();
  }
  ctx.restore();
  // Maul
  ctx.beginPath();
  ctx.moveTo(hx + HL * 0.95, hy + HH * 0.15);
  ctx.lineTo(hx + HL * 0.32, hy + HH * 0.18);
  ctx.strokeStyle = css(D);
  ctx.lineWidth = lw;
  ctx.stroke();
  if (p.fangs) {
    const n = Math.max(3, Math.round(HL / 9));
    for (let i = 0; i < n; i++) {
      const x = hx + HL * 0.38 + (i * HL * 0.52) / n;
      const s = HH * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, hy + HH * 0.15);
      ctx.lineTo(x + s * 0.6, hy + HH * 0.15);
      ctx.lineTo(x + s * 0.3, hy + HH * 0.15 + s);
      ctx.closePath();
      fillStroke(ctx, '#fffef2', '#6a5a4a', 0.8);
    }
  }
  if (p.sabre) {
    const x = hx + HL * 0.7;
    ctx.beginPath();
    ctx.moveTo(x - HH * 0.08, hy + HH * 0.15);
    ctx.quadraticCurveTo(x - HH * 0.06, hy + HH * 0.7, x + HH * 0.05, hy + HH * 0.85);
    ctx.quadraticCurveTo(x + HH * 0.08, hy + HH * 0.45, x + HH * 0.1, hy + HH * 0.15);
    ctx.closePath();
    fillStroke(ctx, '#fffaf0', '#6a5a3a', lw * 0.8);
  }
  if (p.tusks) {
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.55, hy + HH * 0.25);
    ctx.bezierCurveTo(hx + HL * 1.0, hy + HH * 1.1, hx + HL * 1.4, hy + HH * 0.6, hx + HL * 1.35, hy + HH * 0.15);
    ctx.lineWidth = Math.max(4, HH * 0.14);
    ctx.strokeStyle = '#6a5a3a';
    ctx.stroke();
    ctx.lineWidth = Math.max(2.5, HH * 0.1);
    ctx.strokeStyle = '#fff6e0';
    ctx.stroke();
  }
  if (p.trunk) {
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.85, hy - HH * 0.1);
    ctx.bezierCurveTo(hx + HL * 1.2, hy + HH * 0.2, hx + HL * 1.05, hy + HH * 0.9, hx + HL * (1.1 + step * 0.05), hy + HH * 1.3);
    ctx.lineWidth = HH * 0.32;
    ctx.strokeStyle = css(D);
    ctx.stroke();
    ctx.lineWidth = HH * 0.24;
    ctx.strokeStyle = css(c);
    ctx.stroke();
  }
  if (p.horn === 'rhino') {
    for (const [x, ht, w] of [[HL * 0.82, HH * 0.75, HH * 0.3], [HL * 0.55, HH * 0.45, HH * 0.22]] as const) {
      ctx.beginPath();
      ctx.moveTo(hx + x - w / 2, hy - HH * 0.3);
      ctx.quadraticCurveTo(hx + x, hy - HH * 0.3 - ht * 0.6, hx + x + w * 0.4, hy - HH * 0.3 - ht);
      ctx.quadraticCurveTo(hx + x + w * 0.3, hy - HH * 0.3 - ht * 0.3, hx + x + w / 2, hy - HH * 0.3);
      ctx.closePath();
      fillStroke(ctx, '#e8dcc0', '#5a4a30', lw * 0.8);
    }
  }
  if (p.crest) {
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.1, hy - HH * 0.45);
    ctx.quadraticCurveTo(hx + HL * 0.35, hy - HH * 1.2, hx + HL * 0.6, hy - HH * 0.55);
    ctx.closePath();
    fillStroke(ctx, 'rgba(230,80,60,.95)', css(D), lw * 0.8);
  }
  ell(ctx, hx + HL * 0.88, hy - HH * 0.12, Math.max(1, HH * 0.05), Math.max(0.8, HH * 0.04));
  ctx.fillStyle = css(D);
  ctx.fill();
  if (p.stone && p.glow) {
    ell(ctx, hx + HL * 0.42, hy - HH * 0.15, HH * 0.14, HH * 0.1);
    ctx.fillStyle = css(p.glow);
    ctx.fill();
  } else {
    angryEye(ctx, hx + HL * 0.42, hy - HH * 0.15, Math.max(2.4, HH * 0.13));
  }
}

function drawBird(ctx: Ctx, p: Extract<Art, { t: 'bird' }>, f: number) {
  const { span, c } = p;
  const bw = span * 0.22, bh = span * 0.09;
  const D = shade(c, -0.55);
  const lw = Math.max(1.5, span / 60);
  const up = f === 0;
  const wing = (far: boolean) => {
    const sx = bw * 0.1 + (far ? 5 : 0), sy = -bh * 0.3 - (far ? 3 : 0);
    const tip = up ? { x: sx - span * 0.12, y: sy - span * 0.42 } : { x: sx - span * 0.22, y: sy + span * 0.26 };
    const rear = { x: -bw * 0.75, y: bh * 0.25 };
    const mx = (tip.x + rear.x) / 2, my = (tip.y + rear.y) / 2;
    ctx.beginPath();
    ctx.moveTo(sx + bw * 0.3, sy);
    ctx.quadraticCurveTo(sx + span * 0.03, (sy + tip.y) / 2, tip.x, tip.y);
    if (p.ptero) {
      ctx.quadraticCurveTo(mx + (sx - mx) * 0.4, my + (sy - my) * 0.4, rear.x, rear.y);
    } else {
      // Federspitzen an der Hinterkante
      const n = 5;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = tip.x + (rear.x - tip.x) * t, y = tip.y + (rear.y - tip.y) * t;
        const ox = (sx - x) * 0.12, oy = (sy - y) * 0.12;
        ctx.lineTo(x + ox + (up ? -4 : -3), y + oy + (up ? 3 : -4));
        ctx.lineTo(x + ox, y + oy);
      }
    }
    ctx.lineTo(sx - bw * 0.1, sy + bh * 0.4);
    ctx.closePath();
    const col = far ? shade(c, -0.28) : c;
    fillStroke(ctx, p.ptero ? css(mix(col, 0xd08060, 0.35), 0.96) : css(col), css(D), lw);
    ctx.strokeStyle = css(D, 0.5);
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(sx + bw * 0.2, sy);
    ctx.quadraticCurveTo(sx + span * 0.02, (sy + tip.y) / 2, tip.x + (sx - tip.x) * 0.08, tip.y + (sy - tip.y) * 0.08);
    ctx.stroke();
  };
  wing(true);
  // Schwanz
  if (p.ptero) {
    ctx.beginPath();
    ctx.moveTo(-bw * 0.4, 0);
    ctx.lineTo(-bw * 1.4, bh * 0.1);
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
    ell(ctx, -bw * 1.45, bh * 0.1, 4, 3, 0.7);
    fillStroke(ctx, css(c), css(D), lw * 0.8);
  } else {
    ctx.beginPath();
    ctx.moveTo(-bw * 0.4, -bh * 0.2);
    ctx.lineTo(-bw * 1.05, -bh * 0.35);
    ctx.lineTo(-bw * 1.0, bh * 0.55);
    ctx.lineTo(-bw * 0.4, bh * 0.3);
    ctx.closePath();
    fillStroke(ctx, css(shade(c, -0.1)), css(D), lw);
  }
  // Körper
  ell(ctx, 0, 0, bw * 0.6, bh * 0.8);
  fillStroke(ctx, bodyGrad(ctx, c, -bh, bh), css(D), lw);
  ell(ctx, bw * 0.05, bh * 0.25, bw * 0.42, bh * 0.42);
  ctx.fillStyle = css(p.belly, 0.8);
  ctx.fill();
  // Beine
  ctx.strokeStyle = css(D);
  ctx.lineWidth = lw;
  for (const dx of [-0.1, 0.1]) {
    ctx.beginPath();
    ctx.moveTo(bw * dx, bh * 0.6);
    ctx.lineTo(bw * dx - 6, bh * 1.2);
    ctx.stroke();
  }
  // Kopf
  const hx = bw * 0.62, hy = -bh * 0.6;
  if (!p.ptero) {
    ell(ctx, hx - bw * 0.12, hy + bh * 0.35, bw * 0.3, bh * 0.45);
    fillStroke(ctx, '#f4f0ea', css(D), lw);
  }
  ell(ctx, hx, hy, bw * 0.24, bh * 0.52);
  fillStroke(ctx, css(p.ptero ? c : 0xe8a090), css(D), lw);
  if (p.crest) {
    ctx.beginPath();
    ctx.moveTo(hx - bw * 0.05, hy - bh * 0.3);
    ctx.quadraticCurveTo(hx - bw * 0.4, hy - bh * 1.3, hx - bw * 0.75, hy - bh * 1.05);
    ctx.lineTo(hx + bw * 0.12, hy - bh * 0.05);
    ctx.closePath();
    fillStroke(ctx, css(0xd04a3a), css(D), lw);
  }
  ctx.beginPath();
  if (p.ptero) {
    ctx.moveTo(hx + bw * 0.15, hy - bh * 0.2);
    ctx.lineTo(hx + bw * 1.15, hy + bh * 0.2);
    ctx.lineTo(hx + bw * 0.15, hy + bh * 0.32);
  } else {
    ctx.moveTo(hx + bw * 0.15, hy - bh * 0.25);
    ctx.quadraticCurveTo(hx + bw * 0.6, hy - bh * 0.2, hx + bw * 0.48, hy + bh * 0.5);
    ctx.lineTo(hx + bw * 0.15, hy + bh * 0.25);
  }
  ctx.closePath();
  fillStroke(ctx, '#e8c050', css(D), lw);
  angryEye(ctx, hx + bw * 0.02, hy - bh * 0.1, Math.max(2.2, bh * 0.22));
  wing(false);
}

/** Libellen: großer Kopf, Brust, langer dünner Hinterleib und vier Flügel. */
function drawDragonfly(ctx: Ctx, p: Extract<Art, { t: 'bug' }>, f: number) {
  const { len, c } = p;
  const hw = len / 2;
  const lw = Math.max(1.2, len / 80);
  const thx = hw * 0.45, thr = len * 0.085;
  const wl = len * 0.5, ww = len * 0.1;
  const wing = (ax: number, ang: number, alpha: number) => {
    ctx.save();
    ctx.translate(ax, -thr * 0.55);
    ctx.rotate(ang);
    ell(ctx, wl / 2, 0, wl / 2, ww / 2);
    fillStroke(ctx, `rgba(215,245,255,${alpha})`, 'rgba(50,100,120,.75)', lw * 0.8);
    ctx.strokeStyle = 'rgba(50,100,120,.4)';
    ctx.lineWidth = lw * 0.5;
    for (const k of [-0.2, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.quadraticCurveTo(wl * 0.5, ww * k, wl * 0.95, ww * k * 0.5);
      ctx.stroke();
    }
    ell(ctx, wl * 0.85, -ww * 0.15, wl * 0.05, ww * 0.12);
    ctx.fillStyle = 'rgba(40,60,70,.6)';
    ctx.fill();
    ctx.restore();
  };
  const upA = f === 0 ? -2.1 : -2.85;
  // ferne Flügel
  wing(thx + thr * 0.3, upA + 0.25, 0.35);
  wing(thx - thr * 0.4, upA + 0.4, 0.35);
  // Beine
  ctx.strokeStyle = css(shade(c, -0.5));
  ctx.lineWidth = lw;
  for (let i = 0; i < 3; i++) {
    const x = thx - thr * 0.5 + i * thr * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, thr * 0.5);
    ctx.lineTo(x + 3, thr * 1.4);
    ctx.lineTo(x - 1, thr * 2);
    ctx.stroke();
  }
  // Hinterleib
  ctx.beginPath();
  ctx.moveTo(thx - thr * 0.6, -thr * 0.4);
  ctx.quadraticCurveTo(-hw * 0.2, -thr * 0.45, -hw, -thr * 0.12);
  ctx.lineTo(-hw, thr * 0.12);
  ctx.quadraticCurveTo(-hw * 0.2, thr * 0.45, thx - thr * 0.6, thr * 0.5);
  ctx.closePath();
  fillStroke(ctx, bodyGrad(ctx, c, -thr * 0.5, thr * 0.5), css(shade(c, -0.6)), lw);
  ctx.strokeStyle = css(shade(c, -0.5), 0.8);
  ctx.lineWidth = lw * 0.8;
  for (let i = 1; i < 8; i++) {
    const x = thx - thr * 0.6 - (i / 8) * (thx - thr * 0.6 + hw);
    const r = thr * (0.45 - (i / 8) * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, -r);
    ctx.lineTo(x, r);
    ctx.stroke();
  }
  // Brust und Kopf
  ell(ctx, thx, 0, thr * 1.1, thr);
  fillStroke(ctx, bodyGrad(ctx, shade(c, 0.05), -thr, thr), css(shade(c, -0.6)), lw);
  const hx = thx + thr * 1.55;
  ell(ctx, hx, -thr * 0.05, thr * 0.75, thr * 0.7);
  fillStroke(ctx, bodyGrad(ctx, c, -thr, thr), css(shade(c, -0.6)), lw);
  ell(ctx, hx + thr * 0.2, -thr * 0.25, thr * 0.5, thr * 0.45);
  ctx.fillStyle = '#123a3a';
  ctx.fill();
  ell(ctx, hx + thr * 0.05, -thr * 0.4, thr * 0.15, thr * 0.12);
  ctx.fillStyle = '#fff';
  ctx.fill();
  // nahe Flügel
  wing(thx + thr * 0.1, upA, 0.5);
  wing(thx - thr * 0.6, upA + 0.15, 0.5);
}

function drawShade(ctx: Ctx, p: Extract<Art, { t: 'shade' }>, f: number) {
  const r = p.r;
  ctx.fillStyle = rgrad(ctx, 0, 0, 1, r * 2, [[0, css(p.glow, 0.35)], [1, css(p.glow, 0)]]);
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.3 + i * r * 0.25);
    ctx.quadraticCurveTo(-r * 1.2, -r * 0.2 + i * r * 0.3 + (f ? 6 : -6), -r * 1.8, i * r * 0.35 - r * 0.3 + (f ? -4 : 4));
    ctx.strokeStyle = css(p.c, 0.8);
    ctx.lineWidth = r * 0.25 - i * 1.2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.bezierCurveTo(r, -r * 1.2, -r * 0.8, -r * 1.1, -r * 0.9, 0);
  ctx.bezierCurveTo(-r * 0.8, r * 0.9, r * 0.6, r * 1.1, r, 0);
  ctx.closePath();
  fillStroke(ctx, rgrad(ctx, r * 0.2, -r * 0.3, 1, r * 1.2, [[0, css(shade(p.c, 0.3))], [1, css(shade(p.c, -0.3))]]), css(shade(p.c, -0.6)), 2);
  for (const dx of [0.15, 0.55]) {
    ell(ctx, r * dx, -r * 0.15, r * 0.14, r * 0.2);
    ctx.fillStyle = css(p.glow);
    ctx.fill();
    ell(ctx, r * dx, -r * 0.15, r * 0.06, r * 0.1);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function drawCrystal(ctx: Ctx, p: Extract<Art, { t: 'crystal' }>, f: number) {
  const { w, h, c } = p;
  ctx.fillStyle = rgrad(ctx, 0, 0, 1, Math.max(w, h) * 0.8, [[0, css(p.glow, 0.45)], [1, css(p.glow, 0)]]);
  ctx.fillRect(-w * 1.2, -h, w * 2.4, h * 2);
  const shard = (x: number, y: number, sw: number, sh: number, rot: number, col: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -sh / 2);
    ctx.lineTo(sw / 2, -sh * 0.25);
    ctx.lineTo(sw / 2, sh * 0.3);
    ctx.lineTo(0, sh / 2);
    ctx.lineTo(-sw / 2, sh * 0.3);
    ctx.lineTo(-sw / 2, -sh * 0.25);
    ctx.closePath();
    const g = ctx.createLinearGradient(-sw / 2, 0, sw / 2, 0);
    g.addColorStop(0, css(shade(col, 0.6)));
    g.addColorStop(0.5, css(col));
    g.addColorStop(1, css(shade(col, -0.35)));
    fillStroke(ctx, g, css(shade(col, -0.6)), Math.max(1.4, sw / 14));
    ctx.beginPath();
    ctx.moveTo(0, -sh / 2);
    ctx.lineTo(0, sh / 2);
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = Math.max(1, sw / 18);
    ctx.stroke();
    ctx.restore();
  };
  const sp = f ? 0.12 : -0.12;
  if (p.eye) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + sp;
      shard(Math.cos(a) * w * 0.62, Math.sin(a) * h * 0.42, w * 0.18, h * 0.24, a + Math.PI / 2, shade(c, i % 2 ? 0.2 : -0.1));
    }
  }
  shard(-w * 0.22, h * 0.05, w * 0.35, h * 0.55, -0.35 + sp * 0.3, shade(c, -0.15));
  shard(w * 0.22, h * 0.05, w * 0.35, h * 0.55, 0.35 - sp * 0.3, shade(c, -0.05));
  shard(0, 0, w * 0.5, h * 0.85, 0, c);
  if (p.eye) {
    ell(ctx, 0, -h * 0.05, w * 0.15, h * 0.09);
    fillStroke(ctx, '#fff', css(shade(c, -0.6)), 2);
    ell(ctx, 0, -h * 0.05, w * 0.07, h * 0.08);
    ctx.fillStyle = '#ff2a6a';
    ctx.fill();
    ell(ctx, -w * 0.03, -h * 0.08, w * 0.025, w * 0.025);
    ctx.fillStyle = '#fff';
    ctx.fill();
  } else {
    for (const dx of [-0.12, 0.12]) {
      ell(ctx, w * dx, -h * 0.05, w * 0.06, h * 0.05);
      ctx.fillStyle = '#1a2a5a';
      ctx.fill();
    }
  }
}

function drawArt(ctx: Ctx, art: Art, f: number) {
  switch (art.t) {
    case 'fish': return drawFish(ctx, art, f);
    case 'jelly': return drawJelly(ctx, art, f);
    case 'trilo': return drawTrilo(ctx, art, f);
    case 'shell': return drawShell(ctx, art, f);
    case 'bug': return drawBug(ctx, art, f);
    case 'frog': return drawFrog(ctx, art, f);
    case 'quad': return drawQuad(ctx, art, f);
    case 'bird': return drawBird(ctx, art, f);
    case 'shade': return drawShade(ctx, art, f);
    case 'crystal': return drawCrystal(ctx, art, f);
  }
}

export const enemyKey = (id: string, f: number) => `en_${id}_${f}`;

/** Erzeugt beide Animationsbilder eines Gegners und die Animation dazu. */
export function makeEnemyTextures(scene: Phaser.Scene, def: EnemyDef) {
  if (scene.textures.exists(enemyKey(def.id, 0))) return;
  const big = !!def.boss;
  const W = big ? 900 : 360, H = big ? 760 : 300;
  const cs = [0, 1].map((f) => {
    const [c, ctx] = newCanvas(W, H);
    ctx.translate(W / 2, H / 2);
    drawArt(ctx, def.art, f);
    return c;
  });
  const t = trimCanvases(cs);
  t.canvases.forEach((c, f) => scene.textures.addCanvas(enemyKey(def.id, f), c));
  scene.anims.create({
    key: `anim_${def.id}`,
    frames: [{ key: enemyKey(def.id, 0) }, { key: enemyKey(def.id, 1) }],
    frameRate: def.air ? 10 : def.boss ? 5 : 6,
    repeat: -1,
  });
}
