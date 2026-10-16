import Phaser from 'phaser';
import type { Art, Role, SpeciesDef } from '../data/species';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, newCanvas, rgrad, trimCanvases } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { eye, ivory, skin, tooth } from './paint';

// Alle Tierarten im dunklen, organischen Stil. Jede Art wird in zwei
// Bewegungsphasen gezeichnet (Beine, Flügel, Flossen) und zugeschnitten.

type Eyes = { iris: number; glow: boolean };

const eyesFor = (role: Role): Eyes =>
  role === 'apex' ? { iris: 0xd0461c, glow: true }
    : role === 'predator' ? { iris: 0xc8902a, glow: true }
      : role === 'defender' ? { iris: 0x6a4a2a, glow: false }
        : { iris: 0x3a3226, glow: false };

const dark = (c: number) => shade(c, -0.72);

function chitin(ctx: Ctx, path: () => void, c: number, y0: number, y1: number, seed = 0) {
  skin(ctx, path, { base: c, top: shade(c, -0.3), y0, y1, noise: 'mottle', noiseAlpha: 0.35, noiseScale: 0.3, seed, rim: 0.38, edge: dark(c), edgeW: 1.1 });
}

// ---------------------------------------------------------------------------

function drawFish(ctx: Ctx, p: Extract<Art, { t: 'fish' }>, f: number, E: Eyes) {
  const { len, h, c } = p;
  const hw = len / 2, hh = h / 2;
  const lw = Math.max(1.2, len / 70);
  const sw = f ? 0.2 : -0.2;
  const finStyle = (y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, css(shade(p.fin, -0.2), 0.8));
    g.addColorStop(1, css(p.fin, 0.95));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = css(dark(p.fin), 0.8);
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  // Schwanzflosse
  ctx.save();
  ctx.translate(-hw + len * 0.06, 0);
  ctx.rotate(sw);
  ctx.beginPath();
  ctx.moveTo(0, -hh * 0.22);
  ctx.quadraticCurveTo(-len * 0.16, -hh * 0.9, -len * 0.3, -hh * (p.armor ? 1.1 : 1.0));
  ctx.quadraticCurveTo(-len * 0.2, 0, -len * 0.3, hh * (p.armor ? 0.7 : 1.0));
  ctx.quadraticCurveTo(-len * 0.16, hh * 0.8, 0, hh * 0.22);
  ctx.closePath();
  finStyle(-hh, hh);
  ctx.restore();
  // Rücken- und Afterflosse
  ctx.beginPath();
  ctx.moveTo(hw * 0.25, -hh * 0.82);
  ctx.quadraticCurveTo(-hw * 0.05, -hh * 1.75, -hw * 0.4, -hh * 1.3);
  ctx.lineTo(-hw * 0.45, -hh * 0.62);
  ctx.closePath();
  finStyle(-hh * 1.7, -hh * 0.6);
  ctx.beginPath();
  ctx.moveTo(-hw * 0.3, hh * 0.7);
  ctx.quadraticCurveTo(-hw * 0.45, hh * 1.3, -hw * 0.62, hh * 1.1);
  ctx.lineTo(-hw * 0.6, hh * 0.5);
  ctx.closePath();
  finStyle(hh * 0.5, hh * 1.3);
  // Körper
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hw, hh * 0.12);
    ctx.bezierCurveTo(hw * 0.92, -hh * 1.15, -hw * 0.55, -hh * 1.12, -hw, -hh * 0.2);
    ctx.lineTo(-hw, hh * 0.2);
    ctx.bezierCurveTo(-hw * 0.55, hh * 1.1, hw * 0.82, hh * 1.18, hw, hh * 0.12);
    ctx.closePath();
  };
  const r = mulberry32(len);
  skin(ctx, path, {
    base: c, top: shade(c, -0.4), belly: p.belly, bellyBand: [hh * 0.75, hh * 0.6, hw, 0], y0: -hh, y1: hh,
    noise: 'mottle', noiseAlpha: 0.5, noiseScale: len > 150 ? 0.6 : 0.3, seed: len, wet: true, edge: dark(c), edgeW: lw,
    inner: (cx) => {
      if (!p.armor) {
        cx.strokeStyle = css(dark(c), 0.18);
        cx.lineWidth = 0.7;
        for (let row = 0, y = -hh; y < hh; y += h / 7, row++) {
          for (let x = -hw; x < hw; x += len / 11) {
            cx.beginPath();
            cx.arc(x + (row % 2) * len / 22, y, len / 22, 0.2 * Math.PI, 0.8 * Math.PI);
            cx.stroke();
          }
        }
      }
      if (p.armor || p.jawless) {
        // Kopfpanzer
        const bone = mix(c, 0x8c8676, 0.6);
        cx.beginPath();
        cx.moveTo(hw + 4, -hh * 1.2);
        cx.lineTo(hw * (p.jawless ? 0.25 : 0.02), -hh * 1.2);
        cx.quadraticCurveTo(hw * (p.jawless ? 0.15 : -0.12), 0, hw * (p.jawless ? 0.25 : 0.02), hh * 1.2);
        cx.lineTo(hw + 4, hh * 1.2);
        cx.closePath();
        cx.fillStyle = css(bone, 0.95);
        cx.fill();
        cx.strokeStyle = css(dark(c), 0.8);
        cx.lineWidth = lw;
        cx.stroke();
        cx.strokeStyle = css(shade(bone, -0.45), 0.7);
        for (const [x0, y0, x1, y1] of [[hw * 0.45, -hh, hw * 0.4, hh * 0.3], [hw * 0.05, -hh * 0.2, hw * 0.9, -hh * 0.3], [hw * 0.7, -hh, hw * 0.75, -hh * 0.3]]) {
          cx.beginPath();
          cx.moveTo(x0, y0);
          cx.lineTo(x1, y1);
          cx.stroke();
        }
        for (let i = 0; i < 18; i++) {
          ell(cx, hw * (0.1 + r() * 0.8), -hh + r() * hh * 1.6, lw * 0.7, lw * 0.7);
          cx.fillStyle = css(shade(bone, -0.5), 0.6);
          cx.fill();
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = hw * 0.4 - i * hw * 0.35;
        cx.fillStyle = css(dark(c), 0.12);
        cx.fillRect(x, -hh, len * 0.05, h * 0.8);
      }
    },
  });
  // Maul
  const my = hh * 0.22;
  if (p.armor) {
    // Knochenklingen statt Zähnen
    ctx.beginPath();
    ctx.moveTo(hw + 2, my - hh * 0.05);
    ctx.lineTo(hw * 0.6, my);
    ctx.lineTo(hw * 0.98, my + hh * 0.32);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, my, my + hh * 0.3, 1);
    ctx.fill();
    ctx.strokeStyle = '#1a140c';
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hw + 1, my - hh * 0.04);
    ctx.lineTo(hw * 0.55, my);
    ctx.strokeStyle = '#120806';
    ctx.lineWidth = lw * 2;
    ctx.stroke();
  } else if (p.jawless) {
    ell(ctx, hw - 1, my * 0.6, hh * 0.12, hh * 0.1);
    ctx.fillStyle = '#140a08';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(hw, my);
    ctx.lineTo(hw * 0.62, my + hh * 0.05);
    ctx.strokeStyle = '#140a08';
    ctx.lineWidth = lw;
    ctx.stroke();
    if (p.teeth) for (let i = 0; i < 4; i++) tooth(ctx, hw * 0.68 + i * hw * 0.07, my, hh * 0.08, hh * 0.18, 1);
  }
  // Brustflosse
  ctx.save();
  ctx.translate(hw * 0.2, hh * 0.4);
  ctx.rotate(f ? 0.45 : 0.1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-hw * 0.3, hh * 0.6, -hw * 0.45, hh * 0.45);
  ctx.quadraticCurveTo(-hw * 0.25, hh * 0.15, 0, 0);
  ctx.closePath();
  finStyle(0, hh * 0.6);
  ctx.restore();
  eye(ctx, hw * 0.62, -hh * 0.3, Math.max(1.8, hh * (p.armor ? 0.12 : 0.2)), E.iris, { glow: E.glow, lid: p.armor ? 0.4 : 0 });
}

function drawJelly(ctx: Ctx, p: Extract<Art, { t: 'jelly' }>, f: number) {
  const r = p.r;
  ctx.fillStyle = rgrad(ctx, 0, -r * 0.2, 1, r * 2.2, [[0, css(p.c, 0.25)], [1, css(p.c, 0)]]);
  ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
  ctx.strokeStyle = css(shade(p.c, 0.2), 0.55);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    const x0 = -r * 0.75 + (i * r * 1.5) / 6;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let k = 1; k <= 8; k++) ctx.lineTo(x0 + Math.sin(k * 1.1 + i + f * 1.7) * 3, (k * r * 1.9) / 8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-r, 1);
  ctx.bezierCurveTo(-r, -r * 1.3, r, -r * 1.3, r, 1);
  for (let i = 0; i <= 8; i++) ctx.lineTo(r - (i * 2 * r) / 8, 1 + (i % 2 ? 2.5 : 0));
  ctx.closePath();
  ctx.fillStyle = rgrad(ctx, -r * 0.3, -r * 0.5, 1, r * 1.4, [[0, css(shade(p.c, 0.6), 0.85)], [0.45, css(p.c, 0.6)], [1, css(shade(p.c, -0.4), 0.5)]]);
  ctx.fill();
  ctx.strokeStyle = css(shade(p.c, 0.3), 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ell(ctx, -r * 0.45 + i * r * 0.3, -r * 0.35, r * 0.1, r * 0.22);
    ctx.fillStyle = css(shade(p.c, 0.7), 0.5);
    ctx.fill();
  }
}

function drawTrilo(ctx: Ctx, p: Extract<Art, { t: 'trilo' }>, f: number) {
  const hw = p.len / 2, c = p.c;
  ctx.strokeStyle = css(dark(c));
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 7; i++) {
    const x = -hw * 0.75 + i * hw * 0.25;
    const a = (i % 2 ? 1 : -1) * (f ? 0.45 : -0.45);
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + Math.sin(a) * 5, 8);
    ctx.stroke();
  }
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-hw - 2, 3);
    ctx.quadraticCurveTo(-hw * 0.85, -hw * 0.6, hw * 0.2, -hw * 0.56);
    ctx.quadraticCurveTo(hw * 1.05, -hw * 0.52, hw, 3);
    ctx.closePath();
  };
  chitin(ctx, path, c, -hw * 0.6, 3, 3);
  ctx.strokeStyle = css(dark(c), 0.7);
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = -hw + i * hw * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.quadraticCurveTo(x + 2, -hw * 0.3, x, -hw * 0.52 + Math.abs(x) * 0.15);
    ctx.stroke();
  }
  ell(ctx, hw * 0.55, -hw * 0.32, 2.6, 2);
  ctx.fillStyle = '#0c0806';
  ctx.fill();
  ell(ctx, hw * 0.5, -hw * 0.37, 0.8, 0.6);
  ctx.fillStyle = 'rgba(255,240,210,0.7)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-hw, 2);
  ctx.lineTo(-hw - 7, 4);
  ctx.strokeStyle = css(dark(c));
  ctx.stroke();
}

function drawCone(ctx: Ctx, p: Extract<Art, { t: 'cone' }>, f: number, E: Eyes) {
  const { len, c } = p;
  const hw = len / 2, r = len * 0.12;
  // Tentakel
  ctx.strokeStyle = css(mix(c, 0x8a5a4a, 0.5));
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(hw * 0.75, -r * 0.4 + i * r * 0.18);
    ctx.bezierCurveTo(hw * 0.95, -r * 0.5 + i * r * 0.25 + (f ? 3 : -2), hw * 1.05, i * r * 0.3 - r * 0.2, hw * 1.2 + (i % 2) * 3, -r * 0.3 + i * r * 0.34 + (f ? -2 : 3));
    ctx.stroke();
  }
  // Kopf
  const head = () => ell(ctx, hw * 0.68, 0, r * 0.95, r * 0.85);
  skin(ctx, head, { base: mix(c, 0x7a5a4a, 0.4), y0: -r, y1: r, noise: 'mottle', noiseAlpha: 0.5, noiseScale: 0.3, wet: true, edge: dark(c) });
  eye(ctx, hw * 0.74, -r * 0.2, r * 0.32, E.iris, { glow: E.glow });
  // Schale
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(hw * 0.55, -r * 1.05);
    ctx.lineTo(-hw, -r * 0.12);
    ctx.quadraticCurveTo(-hw - 3, 0, -hw, r * 0.12);
    ctx.lineTo(hw * 0.55, r * 1.05);
    ctx.quadraticCurveTo(hw * 0.62, 0, hw * 0.55, -r * 1.05);
    ctx.closePath();
  };
  skin(ctx, shell, {
    base: c, top: shade(c, -0.25), belly: shade(c, 0.25), bellyBand: [r * 0.6, r * 0.6, hw, 0], y0: -r, y1: r,
    noise: 'stone', noiseAlpha: 0.4, noiseScale: 0.3, edge: dark(c), rim: 0.4,
    inner: (cx) => {
      for (let i = 0; i < 12; i++) {
        const x = hw * 0.5 - i * (len * 0.12);
        cx.fillStyle = css(dark(c), 0.35);
        cx.fillRect(x, -r * 1.2, len * 0.045, r * 2.4);
      }
    },
  });
}

function drawBug(ctx: Ctx, p: Extract<Art, { t: 'bug' }>, f: number, E: Eyes) {
  const { len, h, segs, c } = p;
  const hw = len / 2;
  const lw = Math.max(1.2, len / 70);
  const segX = (i: number) => hw - h * 0.6 - (i * (len - h * 1.1)) / Math.max(1, segs - 1);
  const segR = (i: number) => (h / 2) * (1 - (i / segs) * 0.45);
  // Beine
  ctx.strokeStyle = css(shade(c, -0.55));
  ctx.lineWidth = lw * 1.3;
  for (let i = 0; i < p.legs; i++) {
    const x = hw - h - (i * len * 0.75) / Math.max(1, p.legs);
    const a = (i % 2 ? 1 : -1) * (f ? 0.35 : -0.35);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.15);
    ctx.lineTo(x + Math.sin(a) * h * 0.45 + h * 0.18, h * 0.62);
    ctx.lineTo(x + Math.sin(a) * h * 0.85, h * 1.15);
    ctx.stroke();
  }
  if (p.paddles) {
    ctx.save();
    ctx.translate(hw * 0.2, h * 0.3);
    ctx.rotate(f ? 0.5 : -0.1);
    const pad = () => {
      ell(ctx, -h * 0.6, h * 0.5, h * 0.75, h * 0.3, 0.6);
    };
    chitin(ctx, pad, shade(c, 0.1), 0, h);
    ctx.restore();
  }
  if (p.stinger === 'straight') {
    ctx.beginPath();
    ctx.moveTo(-hw + h * 0.4, -2);
    ctx.lineTo(-hw - h, 0);
    ctx.lineTo(-hw + h * 0.4, 2);
    ctx.closePath();
    ctx.fillStyle = css(shade(c, -0.3));
    ctx.fill();
  }
  for (let i = segs - 1; i >= 0; i--) {
    if (p.stinger === 'up' && i >= segs - 2) continue;
    const r = segR(i);
    const x = segX(i);
    chitin(ctx, () => ell(ctx, x, 0, r * 1.08, r), i % 2 ? shade(c, -0.08) : c, -r, r, i);
  }
  if (p.stinger === 'up') {
    let x = segX(segs - 3) - h * 0.3, y = -h * 0.3;
    const pts: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.95 - i * 0.42;
      x += Math.cos(a) * h * 0.55;
      y -= Math.sin(a) * h * 0.6;
      pts.push([x, y]);
    }
    pts.forEach(([px, py], i) => chitin(ctx, () => ell(ctx, px, py, h * (0.32 - i * 0.03), h * (0.28 - i * 0.025)), c, py - 5, py + 5, i + 9));
    const [sx, sy] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 2);
    ctx.quadraticCurveTo(sx + h * 0.5, sy - h * 0.1, sx + h * 0.55, sy + h * 0.35);
    ctx.quadraticCurveTo(sx + h * 0.2, sy + h * 0.05, sx + 2, sy + 3);
    ctx.closePath();
    ctx.fillStyle = '#8a6a2a';
    ctx.fill();
    ctx.strokeStyle = '#140c04';
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // Kopf
  const hx = hw - h * 0.45;
  chitin(ctx, () => ell(ctx, hx, 0, h * 0.55, h * 0.48), shade(c, 0.05), -h * 0.5, h * 0.5, 21);
  eye(ctx, hx + h * 0.18, -h * 0.14, h * 0.15, E.iris, { glow: E.glow });
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
      ctx.strokeStyle = css(dark(c));
      ctx.lineWidth = lw * 2;
      ctx.stroke();
      const claw = () => {
        ctx.beginPath();
        ctx.moveTo(h * 0.6 * sc, -h * 0.1);
        ctx.quadraticCurveTo(h * 1.2 * sc, -h * 0.55, h * 1.35 * sc, -h * 0.05);
        ctx.lineTo(h * 0.95 * sc, -h * 0.05);
        ctx.quadraticCurveTo(h * 1.25 * sc, h * 0.35, h * 0.6 * sc, h * 0.1);
        ctx.closePath();
      };
      chitin(ctx, claw, c, -h * 0.4, h * 0.3, 30);
      ctx.restore();
    }
  }
}

function drawDragonfly(ctx: Ctx, p: Extract<Art, { t: 'dragonfly' }>, f: number, E: Eyes) {
  const { len, c } = p;
  const hw = len / 2;
  const lw = Math.max(1, len / 90);
  const thx = hw * 0.45, thr = len * 0.085;
  const wl = len * 0.5, ww = len * 0.1;
  const wing = (ax: number, ang: number, alpha: number) => {
    ctx.save();
    ctx.translate(ax, -thr * 0.55);
    ctx.rotate(ang);
    ell(ctx, wl / 2, 0, wl / 2, ww / 2);
    ctx.fillStyle = `rgba(150,170,160,${alpha})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,28,.7)';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,30,28,.35)';
    ctx.lineWidth = lw * 0.5;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      ctx.moveTo(wl * (0.1 + k * 0.1), -ww * 0.45);
      ctx.lineTo(wl * (0.1 + k * 0.1) + 2, ww * 0.45);
      ctx.stroke();
    }
    for (const k of [-0.2, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.quadraticCurveTo(wl * 0.5, ww * k, wl * 0.95, ww * k * 0.5);
      ctx.stroke();
    }
    ell(ctx, wl * 0.85, -ww * 0.15, wl * 0.05, ww * 0.12);
    ctx.fillStyle = 'rgba(30,20,14,.7)';
    ctx.fill();
    ctx.restore();
  };
  const upA = f === 0 ? -2.1 : -2.85;
  wing(thx + thr * 0.3, upA + 0.25, 0.22);
  wing(thx - thr * 0.4, upA + 0.4, 0.22);
  ctx.strokeStyle = css(shade(c, -0.6));
  ctx.lineWidth = lw;
  for (let i = 0; i < 3; i++) {
    const x = thx - thr * 0.5 + i * thr * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, thr * 0.5);
    ctx.lineTo(x + 3, thr * 1.4);
    ctx.lineTo(x - 1, thr * 2);
    ctx.stroke();
  }
  const abd = () => {
    ctx.beginPath();
    ctx.moveTo(thx - thr * 0.6, -thr * 0.4);
    ctx.quadraticCurveTo(-hw * 0.2, -thr * 0.45, -hw, -thr * 0.12);
    ctx.lineTo(-hw, thr * 0.12);
    ctx.quadraticCurveTo(-hw * 0.2, thr * 0.45, thx - thr * 0.6, thr * 0.5);
    ctx.closePath();
  };
  chitin(ctx, abd, c, -thr * 0.5, thr * 0.5, 2);
  ctx.strokeStyle = css(dark(c), 0.8);
  ctx.lineWidth = lw * 0.8;
  for (let i = 1; i < 9; i++) {
    const x = thx - thr * 0.6 - (i / 9) * (thx - thr * 0.6 + hw);
    const rr = thr * (0.45 - (i / 9) * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, -rr);
    ctx.lineTo(x, rr);
    ctx.stroke();
  }
  chitin(ctx, () => ell(ctx, thx, 0, thr * 1.1, thr), shade(c, 0.05), -thr, thr, 5);
  const hx = thx + thr * 1.55;
  chitin(ctx, () => ell(ctx, hx, -thr * 0.05, thr * 0.75, thr * 0.7), c, -thr, thr, 6);
  ell(ctx, hx + thr * 0.2, -thr * 0.25, thr * 0.5, thr * 0.45);
  ctx.fillStyle = css(E.glow ? 0x5a1a10 : 0x101a18);
  ctx.fill();
  ell(ctx, hx + thr * 0.05, -thr * 0.4, thr * 0.14, thr * 0.11);
  ctx.fillStyle = E.glow ? 'rgba(255,140,80,.85)' : 'rgba(220,240,230,.7)';
  ctx.fill();
  wing(thx + thr * 0.1, upA, 0.34);
  wing(thx - thr * 0.6, upA + 0.15, 0.34);
}

function drawQuad(ctx: Ctx, p: Extract<Art, { t: 'quad' }>, f: number, E: Eyes) {
  const { len, bh, leg, c } = p;
  const hw = len / 2, hh = bh / 2;
  const D = dark(c);
  const lw = Math.max(1.2, len / 60);
  const step = f ? 1 : -1;
  const r = mulberry32(len * 7 + bh);
  const seed = len + bh;

  const drawLeg = (x: number, y: number, ang: number, L: number, W: number, col: number, front: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + (p.sprawl ? (front ? -0.45 : 0.45) : 0));
    const line = () => {
      ctx.beginPath();
      if (p.biped) {
        ctx.moveTo(-W * 0.75, -L * 0.1);
        ctx.bezierCurveTo(-W * 0.95, L * 0.35, -W * 0.2, L * 0.55, -W * 0.35, L - 2);
        ctx.lineTo(W * 0.3, L - 2);
        ctx.bezierCurveTo(W * 0.35, L * 0.55, W * 0.9, L * 0.35, W * 0.7, -L * 0.1);
      } else {
        const knee = L * 0.12;
        ctx.moveTo(-W * 0.55, -3);
        ctx.bezierCurveTo(-W * 0.8, L * 0.3, -W * 0.3 + knee, L * 0.5, -W * 0.3, L - 2);
        ctx.lineTo(W * 0.35, L - 2);
        ctx.bezierCurveTo(W * 0.45 + knee, L * 0.5, W * 0.75, L * 0.28, W * 0.55, -3);
      }
    };
    const path = () => {
      line();
      ctx.closePath();
    };
    skin(ctx, path, { outline: line, base: col, top: col, belly: shade(col, -0.2), y0: 0, y1: L, noise: p.fur ? 'streak' : 'mottle', noiseAlpha: 0.45, noiseScale: 0.4, seed, edge: D, edgeW: lw, rim: 0.18 });
    // Fuß, Huf oder Krallen
    if (p.antlers || (p.mane && !p.claws)) {
      ctx.beginPath();
      ctx.moveTo(-W * 0.4, L - 4);
      ctx.lineTo(W * 0.45, L - 4);
      ctx.lineTo(W * 0.55, L + 0.5);
      ctx.lineTo(-W * 0.45, L + 0.5);
      ctx.closePath();
      ctx.fillStyle = '#16100c';
      ctx.fill();
    } else {
      ell(ctx, W * 0.15, L - 1.5, W * 0.6, Math.max(2.2, W * 0.2));
      ctx.fillStyle = css(shade(col, -0.35));
      ctx.fill();
      const cl = p.claws && front ? W * 0.7 : W * 0.3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.3 + i * 2, L - 3);
        ctx.quadraticCurveTo(W * 0.4 + i * 2 + cl, L - 2, W * 0.35 + i * 2 + cl * 0.8, L + 1.5);
        ctx.strokeStyle = '#d4c8ac';
        ctx.lineWidth = lw * (p.claws && front ? 1.3 : 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const legW = Math.max(6, p.biped ? bh * 0.5 : p.sprawl ? bh * 0.45 : bh * 0.36);
  const hipY = hh * (p.sprawl ? 0.15 : 0.35);
  const hips = p.biped ? [-hw * 0.15] : [hw * 0.55, -hw * 0.55];
  const farC = shade(c, -0.32);
  hips.forEach((x, i) => drawLeg(x + 4, hipY - 2, (i % 2 ? 1 : -1) * step * 0.3, leg, legW, farC, i === 0));

  // Schwanz
  const tw = p.tailW ?? bh * 0.45;
  if (p.tail > 0) {
    const tLine = () => {
      ctx.beginPath();
      ctx.moveTo(-hw + 8, -hh * 0.55);
      ctx.quadraticCurveTo(-hw - p.tail * 0.5, -hh * 0.5 - (p.biped ? 4 : 0), -hw - p.tail, -hh * (p.biped ? 0.6 : 0.1) + step * 2);
      ctx.quadraticCurveTo(-hw - p.tail * 0.5, -hh * 0.5 + tw * 0.75, -hw + 8, -hh * 0.55 + tw);
    };
    if (p.fur && p.tail < 30) {
      skin(ctx, () => ell(ctx, -hw - p.tail * 0.3, -hh * 0.3, p.tail * 0.55, tw * 0.4, -0.3), { base: c, belly: p.belly, y0: -hh, y1: 0, noise: 'streak', noiseAlpha: 0.5, noiseScale: 0.4, seed, edge: D, edgeW: lw });
    } else {
      skin(ctx, () => { tLine(); ctx.closePath(); }, { outline: tLine, base: c, belly: p.belly, y0: -hh, y1: hh * 0.3, noise: p.fur ? 'streak' : 'mottle', noiseAlpha: 0.45, noiseScale: 0.4, seed, edge: D, edgeW: lw });
    }
    if (p.club) {
      ell(ctx, -hw - p.tail, -hh * 0.1, tw * 0.55, tw * 0.45);
      ctx.fillStyle = ivory(ctx, -hh * 0.1 - tw * 0.5, -hh * 0.1 + tw * 0.5, 1);
      ctx.fill();
      ctx.strokeStyle = css(D);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  // Rückenplatten / Stacheln
  if (p.plates || p.spikes) {
    const n = p.plates ? 7 : 8;
    for (let i = 0; i < n; i++) {
      const x = -hw * 0.75 + (i * hw * 1.5) / (n - 1);
      const y = -hh * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2)) * 0.95;
      const ht = p.plates ? bh * 0.3 : bh * (0.4 + (i % 2) * 0.15);
      ctx.beginPath();
      ctx.moveTo(x - (p.plates ? 6 : 4), y + 4);
      if (p.plates) ctx.quadraticCurveTo(x, y - ht * 1.3, x + 6, y + 4);
      else ctx.lineTo(x + 1, y - ht);
      ctx.lineTo(x + 4, y + 4);
      ctx.closePath();
      ctx.fillStyle = ivory(ctx, y - ht, y + 4, 1);
      ctx.fill();
      ctx.strokeStyle = css(D);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  // Körper
  const hump = p.hump ? hh * 0.35 : 0;
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(hw, -hh * 0.6);
    ctx.bezierCurveTo(hw * 0.6, -hh * 1.25 - hump, -hw * 0.7, -hh * 1.2, -hw, -hh * 0.3);
    ctx.bezierCurveTo(-hw * 1.08, hh * 0.4, -hw * 0.6, hh * 1.05, 0, hh);
    ctx.bezierCurveTo(hw * 0.7, hh * 1.05, hw * 1.15, hh * 0.3, hw, -hh * 0.6);
    ctx.closePath();
  };
  skin(ctx, bodyPath, {
    base: c, top: shade(c, -0.38), belly: p.belly, bellyBand: [hh * 0.8, hh * 0.55, hw * 0.85, hw * 0.1], y0: -hh - hump, y1: hh,
    noise: p.fur ? 'streak' : 'mottle', noiseAlpha: p.fur ? 0.5 : 0.45, noiseScale: p.fur ? 0.45 : 0.32, seed, edge: D, edgeW: lw,
    wet: p.sprawl,
    inner: (cx) => {
      if (p.stripes) {
        for (let i = 0; i < 7; i++) {
          cx.beginPath();
          const x = -hw * 0.8 + i * hw * 0.28;
          cx.moveTo(x, -hh * 1.2);
          cx.quadraticCurveTo(x + 5, -hh * 0.3, x - 2, hh * 0.15);
          cx.lineWidth = Math.max(2, bh * 0.09);
          cx.strokeStyle = css(D, 0.4);
          cx.stroke();
        }
      }
      if (p.spots) {
        for (let i = 0; i < 18; i++) {
          ell(cx, -hw + r() * len, -hh + r() * bh * 0.75, bh * 0.05 + r() * bh * 0.04, bh * 0.04 + r() * bh * 0.03, r() * 3);
          cx.fillStyle = css(D, 0.45);
          cx.fill();
        }
      }
      if (p.plates) {
        cx.strokeStyle = css(D, 0.55);
        cx.lineWidth = lw * 0.8;
        for (let x = -hw; x < hw; x += bh * 0.32) {
          for (let y = -hh; y < hh * 0.3; y += bh * 0.28) {
            ell(cx, x + ((y / (bh * 0.28)) % 2) * bh * 0.16, y, bh * 0.12, bh * 0.09);
            cx.stroke();
          }
        }
      }
      if (p.fur) {
        for (let i = 0; i < len * 3; i++) {
          const x = -hw + r() * len, y = -hh - hump + r() * (bh + hump);
          cx.strokeStyle = r() > 0.5 ? css(shade(c, 0.18), 0.35) : css(D, 0.35);
          cx.lineWidth = Math.max(0.8, lw * 0.6);
          cx.beginPath();
          cx.moveTo(x, y);
          cx.quadraticCurveTo(x - 2, y + 3, x - 4, y + 5);
          cx.stroke();
        }
      }
      if (p.mane) {
        cx.beginPath();
        cx.moveTo(hw, -hh * 0.9);
        cx.quadraticCurveTo(hw * 0.2, -hh * 1.4 - hump, -hw * 0.2, -hh * 1.0);
        cx.lineWidth = bh * 0.22;
        cx.strokeStyle = css(D, 0.5);
        cx.stroke();
      }
    },
  });
  if (p.fur) {
    ctx.strokeStyle = css(shade(c, -0.25));
    ctx.lineWidth = lw;
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + 0.15 + (i / 24) * (Math.PI - 0.3);
      const x = Math.cos(a) * hw, y = Math.sin(a) * (hh * 1.05 + hump * Math.max(0, Math.cos((x / hw) * 1.2)));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y - 4);
      ctx.stroke();
    }
  }
  // Flügelstummel (Terrorvogel)
  if (p.beak && p.biped && !p.arms) {
    ctx.beginPath();
    ctx.moveTo(hw * 0.3, -hh * 0.4);
    ctx.quadraticCurveTo(-hw * 0.2, -hh * 0.5, -hw * 0.6, hh * 0.1);
    ctx.quadraticCurveTo(-hw * 0.1, hh * 0.1, hw * 0.3, -hh * 0.1);
    ctx.closePath();
    ctx.fillStyle = css(shade(c, -0.2));
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  hips.forEach((x, i) => drawLeg(x, hipY, (i % 2 ? -1 : 1) * step * 0.3, leg, legW, c, i === 0));
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
    ctx.fillStyle = css(c);
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.restore();
  }

  // Kopf
  const hx = hw + p.head * 0.15;
  const hy = -hh * (p.biped ? 0.95 : p.trunk ? 0.2 : p.sprawl ? 0.1 : 0.45) - (p.biped ? bh * 0.25 : 0);
  const HL = p.head, HH = p.headH;
  // Hals
  const neck = () => {
    ctx.beginPath();
    ctx.moveTo(hw * 0.55, -hh * 0.85);
    ctx.quadraticCurveTo(hx - HL * 0.1, hy - HH * 0.6, hx + HL * 0.1, hy - HH * 0.3);
    ctx.lineTo(hx + HL * 0.15, hy + HH * 0.4);
    ctx.quadraticCurveTo(hw * 0.8, hh * 0.1, hw * 0.6, hh * 0.3);
    ctx.closePath();
  };
  skin(ctx, neck, { base: c, top: shade(c, -0.38), belly: p.belly, bellyBand: [hy + HH * 0.4, HH * 0.4, HL * 0.3, hx], y0: hy - HH, y1: hh, noise: p.fur ? 'streak' : 'mottle', noiseAlpha: 0.45, noiseScale: 0.4, seed, edge: D, edgeW: lw });
  if (p.frill) {
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.05, hy);
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI * 0.45 - (i / 6) * Math.PI * 0.75;
      const rr = HH * 1.25 + (i % 2 ? 0 : HH * 0.25);
      ctx.lineTo(hx - HL * 0.05 + Math.cos(a) * rr, hy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,52,30,.92)';
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  if (p.ears) {
    const tall = p.ears === 'long' ? 2.2 : p.ears === 'round' ? 0.6 : 1;
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.05, hy - HH * 0.3);
    if (p.ears === 'round') ctx.quadraticCurveTo(hx + HL * 0.02, hy - HH * 0.95, hx + HL * 0.2, hy - HH * 0.35);
    else {
      ctx.lineTo(hx + HL * 0.02 - (tall - 1) * HL * 0.1, hy - HH * (0.95 * tall));
      ctx.lineTo(hx + HL * 0.22, hy - HH * 0.35);
    }
    ctx.closePath();
    ctx.fillStyle = css(shade(c, -0.15));
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  const headLine = () => {
    ctx.beginPath();
    ctx.moveTo(hx - HL * 0.15, hy - HH * 0.35);
    if (p.beak) {
      ctx.bezierCurveTo(hx + HL * 0.25, hy - HH * 0.75, hx + HL * 0.75, hy - HH * 0.6, hx + HL * 1.02, hy - HH * 0.05);
      ctx.quadraticCurveTo(hx + HL * 1.06, hy + HH * 0.2, hx + HL * 0.92, hy + HH * 0.25);
      ctx.lineTo(hx + HL * 0.4, hy + HH * 0.12);
    } else {
      ctx.bezierCurveTo(hx + HL * 0.2, hy - HH * 0.7, hx + HL * 0.75, hy - HH * 0.5, hx + HL, hy - HH * 0.1);
      ctx.quadraticCurveTo(hx + HL * 1.05, hy + HH * 0.2, hx + HL * 0.92, hy + HH * 0.18);
      ctx.lineTo(hx + HL * 0.3, hy + HH * 0.2);
    }
    ctx.quadraticCurveTo(hx + HL * 0.5, hy + HH * 0.55, hx + HL * 0.15, hy + HH * 0.5);
    ctx.quadraticCurveTo(hx - HL * 0.2, hy + HH * 0.35, hx - HL * 0.15, hy - HH * 0.35);
  };
  skin(ctx, () => { headLine(); ctx.closePath(); }, {
    base: c, top: shade(c, -0.38), belly: p.belly, bellyBand: [hy + HH * 0.45, HH * 0.3, HL * 0.55, hx + HL * 0.5], y0: hy - HH * 0.7, y1: hy + HH * 0.5,
    noise: p.fur ? 'streak' : 'mottle', noiseAlpha: 0.45, noiseScale: 0.4, seed: seed + 1, edge: D, edgeW: lw, wet: p.sprawl,
    inner: (cx) => {
      if (p.stripes) {
        cx.strokeStyle = css(D, 0.45);
        cx.lineWidth = Math.max(2, HH * 0.1);
        cx.beginPath();
        cx.moveTo(hx + HL * 0.2, hy - HH);
        cx.lineTo(hx + HL * 0.25, hy);
        cx.stroke();
      }
    },
  });
  if (p.beak) {
    // Hornschnabel
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.62, hy - HH * 0.5);
    ctx.quadraticCurveTo(hx + HL * 1.0, hy - HH * 0.45, hx + HL * 1.06, hy + HH * 0.05);
    ctx.quadraticCurveTo(hx + HL * 1.02, hy + HH * 0.32, hx + HL * 0.9, hy + HH * 0.3);
    ctx.lineTo(hx + HL * 0.6, hy + HH * 0.1);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, hy - HH * 0.5, hy + HH * 0.3, 1);
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // Maul
  ctx.beginPath();
  ctx.moveTo(hx + HL * 0.95, hy + HH * 0.16);
  ctx.lineTo(hx + HL * 0.32, hy + HH * 0.18);
  ctx.strokeStyle = '#120806';
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  if (p.fangs) {
    const n = Math.max(3, Math.round(HL / 8));
    for (let i = 0; i < n; i++) {
      const x = hx + HL * 0.38 + (i * HL * 0.54) / n;
      tooth(ctx, x, hy + HH * 0.16, HH * 0.1, HH * (0.14 + (i % 2) * 0.06), 1);
    }
  }
  if (p.sabre) {
    const x = hx + HL * 0.7;
    ctx.beginPath();
    ctx.moveTo(x - HH * 0.08, hy + HH * 0.15);
    ctx.quadraticCurveTo(x - HH * 0.06, hy + HH * 0.7, x + HH * 0.05, hy + HH * 0.88);
    ctx.quadraticCurveTo(x + HH * 0.08, hy + HH * 0.45, x + HH * 0.1, hy + HH * 0.15);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, hy, hy + HH * 0.9, 1);
    ctx.fill();
    ctx.strokeStyle = '#1a120a';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }
  if (p.tusks) {
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.55, hy + HH * 0.25);
    ctx.bezierCurveTo(hx + HL * 1.0, hy + HH * 1.1, hx + HL * 1.4, hy + HH * 0.6, hx + HL * 1.35, hy + HH * 0.15);
    ctx.lineWidth = Math.max(4, HH * 0.15);
    ctx.strokeStyle = '#2a2014';
    ctx.stroke();
    ctx.lineWidth = Math.max(2.5, HH * 0.11);
    ctx.strokeStyle = '#d8ccae';
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
    ctx.strokeStyle = css(shade(c, -0.1));
    ctx.stroke();
  }
  if (p.horn === 'rhino') {
    for (const [x, ht, w] of [[HL * 0.82, HH * 0.75, HH * 0.3], [HL * 0.55, HH * 0.45, HH * 0.22]] as const) {
      ctx.beginPath();
      ctx.moveTo(hx + x - w / 2, hy - HH * 0.3);
      ctx.quadraticCurveTo(hx + x, hy - HH * 0.3 - ht * 0.6, hx + x + w * 0.4, hy - HH * 0.3 - ht);
      ctx.quadraticCurveTo(hx + x + w * 0.3, hy - HH * 0.3 - ht * 0.3, hx + x + w / 2, hy - HH * 0.3);
      ctx.closePath();
      ctx.fillStyle = ivory(ctx, hy - HH, hy, 1);
      ctx.fill();
      ctx.strokeStyle = css(D);
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    }
  }
  if (p.antlers) {
    ctx.strokeStyle = '#3a2c1c';
    ctx.lineCap = 'round';
    for (const off of [0, 5]) {
      const bx = hx + HL * 0.1 + off, by = hy - HH * 0.45;
      ctx.lineWidth = Math.max(3, HH * 0.18);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx - HL * 0.6, by - HH * 1.6, bx - HL * 1.3, by - HH * 1.4);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, HH * 0.12);
      for (let i = 0; i < 4; i++) {
        const t = 0.3 + i * 0.18;
        const px = bx - HL * 1.3 * t, py = by - HH * 1.5 * Math.sin(t * Math.PI * 0.6);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - HL * 0.1, py - HH * 0.6);
        ctx.stroke();
      }
    }
  }
  if (p.crest) {
    ctx.beginPath();
    ctx.moveTo(hx + HL * 0.05, hy - HH * 0.45);
    ctx.quadraticCurveTo(hx + HL * 0.25, hy - HH * 1.25, hx + HL * 0.55, hy - HH * 0.6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(96,40,26,.95)';
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }
  ell(ctx, hx + HL * 0.88, hy - HH * 0.12, Math.max(1, HH * 0.05), Math.max(0.8, HH * 0.04));
  ctx.fillStyle = '#0c0806';
  ctx.fill();
  eye(ctx, hx + HL * 0.42, hy - HH * 0.18, Math.max(1.8, HH * 0.11), E.iris, { glow: E.glow, slit: !p.fur, lid: E.glow ? 0.35 : 0.1 });
}

function drawBird(ctx: Ctx, p: Extract<Art, { t: 'bird' }>, f: number, E: Eyes) {
  const { span, c } = p;
  const bw = span * 0.22, bh = span * 0.09;
  const D = dark(c);
  const lw = Math.max(1.3, span / 70);
  const up = f === 0;
  const wing = (far: boolean) => {
    const sx = bw * 0.1 + (far ? 5 : 0), sy = -bh * 0.3 - (far ? 3 : 0);
    const tip = up ? { x: sx - span * 0.12, y: sy - span * 0.42 } : { x: sx - span * 0.22, y: sy + span * 0.26 };
    const rear = { x: -bw * 0.75, y: bh * 0.25 };
    const mx = (tip.x + rear.x) / 2, my = (tip.y + rear.y) / 2;
    ctx.beginPath();
    ctx.moveTo(sx + bw * 0.3, sy);
    ctx.quadraticCurveTo(sx + span * 0.03, (sy + tip.y) / 2, tip.x, tip.y);
    ctx.quadraticCurveTo(mx + (sx - mx) * 0.4, my + (sy - my) * 0.4, rear.x, rear.y);
    ctx.lineTo(sx - bw * 0.1, sy + bh * 0.4);
    ctx.closePath();
    const col = far ? shade(c, -0.35) : c;
    const g = ctx.createLinearGradient(sx, sy, tip.x, tip.y);
    g.addColorStop(0, css(col, 0.98));
    g.addColorStop(1, css(mix(col, 0x6a3a2a, 0.4), 0.85));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.strokeStyle = css(D, 0.55);
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(sx + bw * 0.2, sy);
    ctx.quadraticCurveTo(sx + span * 0.02, (sy + tip.y) / 2, tip.x + (sx - tip.x) * 0.08, tip.y + (sy - tip.y) * 0.08);
    ctx.stroke();
  };
  wing(true);
  ctx.beginPath();
  ctx.moveTo(-bw * 0.4, 0);
  ctx.lineTo(-bw * 1.4, bh * 0.1);
  ctx.strokeStyle = css(D);
  ctx.lineWidth = lw;
  ctx.stroke();
  skin(ctx, () => ell(ctx, 0, 0, bw * 0.6, bh * 0.8), { base: c, belly: p.belly, bellyBand: [bh * 0.4, bh * 0.5, bw * 0.5, 0], y0: -bh, y1: bh, noise: 'mottle', noiseAlpha: 0.4, edge: D, edgeW: lw });
  const hx = bw * 0.62, hy = -bh * 0.6;
  skin(ctx, () => ell(ctx, hx, hy, bw * 0.24, bh * 0.52), { base: c, y0: hy - bh * 0.5, y1: hy + bh * 0.5, noise: 'mottle', noiseAlpha: 0.4, edge: D, edgeW: lw });
  if (p.crest) {
    ctx.beginPath();
    ctx.moveTo(hx - bw * 0.05, hy - bh * 0.3);
    ctx.quadraticCurveTo(hx - bw * 0.4, hy - bh * 1.3, hx - bw * 0.8, hy - bh * 1.05);
    ctx.lineTo(hx + bw * 0.12, hy - bh * 0.05);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,40,26,.95)';
    ctx.fill();
    ctx.strokeStyle = css(D);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx + bw * 0.15, hy - bh * 0.2);
  ctx.lineTo(hx + bw * 1.15, hy + bh * 0.2);
  ctx.lineTo(hx + bw * 0.15, hy + bh * 0.32);
  ctx.closePath();
  ctx.fillStyle = ivory(ctx, hy - bh * 0.2, hy + bh * 0.3, 1);
  ctx.fill();
  ctx.strokeStyle = css(D);
  ctx.lineWidth = lw;
  ctx.stroke();
  eye(ctx, hx + bw * 0.02, hy - bh * 0.1, Math.max(1.6, bh * 0.16), E.iris, { glow: E.glow, lid: 0.3 });
  wing(false);
}

function drawArt(ctx: Ctx, art: Art, f: number, E: Eyes) {
  switch (art.t) {
    case 'fish': return drawFish(ctx, art, f, E);
    case 'jelly': return drawJelly(ctx, art, f);
    case 'trilo': return drawTrilo(ctx, art, f);
    case 'cone': return drawCone(ctx, art, f, E);
    case 'bug': return drawBug(ctx, art, f, E);
    case 'dragonfly': return drawDragonfly(ctx, art, f, E);
    case 'quad': return drawQuad(ctx, art, f, E);
    case 'bird': return drawBird(ctx, art, f, E);
  }
}

export const speciesKey = (id: string, f: number) => `sp_${id}_${f}`;

/** Erzeugt beide Bewegungsphasen einer Art und die Animation dazu. */
export function makeSpeciesTextures(scene: Phaser.Scene, def: SpeciesDef) {
  if (scene.textures.exists(speciesKey(def.id, 0))) return;
  const big = !!def.boss;
  const W = big ? 900 : 380, H = big ? 760 : 320;
  const E = eyesFor(def.role);
  const cs = [0, 1].map((f) => {
    const [c, ctx] = newCanvas(W, H);
    ctx.translate(W / 2, H / 2);
    drawArt(ctx, def.art, f, E);
    return c;
  });
  const t = trimCanvases(cs);
  t.canvases.forEach((c, f) => scene.textures.addCanvas(speciesKey(def.id, f), c));
  scene.anims.create({
    key: `anim_${def.id}`,
    frames: [{ key: speciesKey(def.id, 0) }, { key: speciesKey(def.id, 1) }],
    frameRate: def.habitat === 'air' ? 10 : def.boss ? 5 : 6,
    repeat: -1,
  });
}
