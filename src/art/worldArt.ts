import Phaser from 'phaser';
import type { Theme } from '../data/epochs';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, fillStroke, newCanvas, rgrad, smooth, tex, vgrad, wrapX } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';
import { W, H } from '../config';
import { noiseTex, pattern } from './paint';

// ---------------------------------------------------------------------------
// Hilfen

function tile9(w: number, h: number, fn: (dx: number, dy: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy);
}

function blob(ctx: Ctx, r: Rng, x: number, y: number, rx: number, ry: number, n = 9) {
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.72 + r() * 0.45;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  smooth(ctx, pts, true);
}

/** Hügel-/Felskette als Silhouette, kachelbar. */
function ridge(ctx: Ctx, r: Rng, base: number, amp: number, n: number, color: string, jag = 0.15) {
  const step = W / n;
  const ys: number[] = [];
  for (let i = 0; i < n; i++) ys.push(base - r() * amp);
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, ys[0]);
  for (let i = 0; i < n; i++) {
    const x0 = i * step, y0 = ys[i], y1 = ys[(i + 1) % n];
    const mx = x0 + step / 2;
    ctx.quadraticCurveTo(mx, Math.min(y0, y1) - amp * jag + (r() - 0.5) * amp * 0.2, x0 + step, y1);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Nebelband aus Rauschen. */
function fogBand(ctx: Ctx, y: number, h: number, color: number, alpha: number, scale = 1.4, ox = 0) {
  // auf eigener Leinwand zeichnen, damit das Ausstanzen der Wolken nicht den Hintergrund löscht
  const hh = Math.max(1, Math.ceil(h));
  const [c, fx] = newCanvas(W, hh);
  const g = fx.createLinearGradient(0, 0, 0, hh);
  g.addColorStop(0, css(color, 0));
  g.addColorStop(0.5, css(color, 1));
  g.addColorStop(1, css(color, 0));
  fx.fillStyle = g;
  fx.fillRect(0, 0, W, hh);
  fx.globalCompositeOperation = 'destination-out';
  fx.globalAlpha = 0.55;
  fx.fillStyle = pattern(fx, 'cloud', scale, ox, y);
  fx.fillRect(0, 0, W, hh);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, 0, y);
  ctx.restore();
}

function grainAll(ctx: Ctx, w: number, h: number, a = 0.25) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = a;
  ctx.fillStyle = pattern(ctx, 'grain', 1);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function rays(ctx: Ctx, r: Rng, n: number, color: string, alpha: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * W, w = 40 + r() * 90;
    wrapX(W, x, 300, (xx) => {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.85);
      g.addColorStop(0, color.replace('A', String(alpha * (0.6 + r() * 0.6))));
      g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(xx - w / 2, 0);
      ctx.lineTo(xx + w / 2, 0);
      ctx.lineTo(xx + w / 2 + 240, H * 0.85);
      ctx.lineTo(xx - w / 2 + 140, H * 0.85);
      ctx.closePath();
      ctx.fill();
    });
  }
}

function specks(ctx: Ctx, r: Rng, n: number, color: (r: Rng) => string, y0 = 0, y1 = H, size = 1.6) {
  for (let i = 0; i < n; i++) {
    ell(ctx, r() * W, y0 + r() * (y1 - y0), 0.5 + r() * size, 0.5 + r() * size);
    ctx.fillStyle = color(r);
    ctx.fill();
  }
}

/** Uralter Schuppenbaum (Lepidodendron) als Silhouette. */
function scaleTree(ctx: Ctx, x: number, base: number, ht: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, base);
  ctx.quadraticCurveTo(x - w * 0.4, base - ht * 0.5, x - w * 0.3, base - ht);
  ctx.lineTo(x + w * 0.3, base - ht);
  ctx.quadraticCurveTo(x + w * 0.4, base - ht * 0.5, x + w * 0.6, base);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.42;
    ctx.beginPath();
    ctx.moveTo(x, base - ht);
    ctx.quadraticCurveTo(x + Math.cos(a) * w * 3, base - ht + Math.sin(a) * w * 2.2, x + Math.cos(a) * w * 4.4, base - ht + Math.sin(a) * w * 0.6 + w * 2.4);
    ctx.lineWidth = w * 0.7;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

function conifer(ctx: Ctx, x: number, base: number, ht: number, color: string, snow?: string) {
  const tiers = 6;
  ctx.fillStyle = color;
  ctx.fillRect(x - ht * 0.02, base - ht * 0.2, ht * 0.04, ht * 0.2);
  for (let k = 0; k < tiers; k++) {
    const y = base - ht * 0.12 - k * ht * 0.14;
    const w = ht * (0.3 - k * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.3, y - ht * 0.08, x, y - ht * 0.2);
    ctx.quadraticCurveTo(x + w * 0.3, y - ht * 0.08, x + w, y);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, y - ht * 0.03);
      ctx.quadraticCurveTo(x - w * 0.2, y - ht * 0.1, x, y - ht * 0.19);
      ctx.quadraticCurveTo(x + w * 0.2, y - ht * 0.1, x + w * 0.7, y - ht * 0.03);
      ctx.lineTo(x, y - ht * 0.09);
      ctx.closePath();
      ctx.fillStyle = snow;
      ctx.fill();
      ctx.fillStyle = color;
    }
  }
}

// ---------------------------------------------------------------------------
// Level-Hintergründe

export type BgVariant = 'normal' | 'dark' | 'cave';

const SKY: Record<Theme, [string, string, string]> = {
  ozean: ['#16343c', '#0b1f25', '#03090b'],
  sumpf: ['#161d12', '#3a4227', '#121810'],
  reptil: ['#190c0a', '#4c1c10', '#120808'],
  eis: ['#09111a', '#27384b', '#0b131b'],
  eden: ['#1c1810', '#6a5026', '#14120a'],
};

const FOG: Record<Theme, number> = {
  ozean: 0x1c4048,
  sumpf: 0x4a5236,
  reptil: 0x4a2418,
  eis: 0x3a4a5e,
  eden: 0x5a4a2a,
};

function farBg(ctx: Ctx, theme: Theme, v: BgVariant) {
  const r = mulberry32(theme.length * 99 + v.length * 7);
  if (v === 'cave') {
    const warm = theme === 'sumpf';
    ctx.fillStyle = vgrad(ctx, 0, H, warm ? [[0, '#100c08'], [0.6, '#16110b'], [1, '#050403']] : [[0, '#0a1622'], [0.6, '#0e1c2a'], [1, '#03070c']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 44; i++) {
      const x = r() * W, len = 60 + r() * 220, w = 16 + r() * 40;
      wrapX(W, x, w, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, 0);
        ctx.quadraticCurveTo(xx - w * 0.1, len * 0.7, xx, len);
        ctx.quadraticCurveTo(xx + w * 0.1, len * 0.7, xx + w / 2, 0);
        ctx.closePath();
        ctx.fillStyle = warm ? 'rgba(26,20,14,.9)' : 'rgba(22,36,52,.85)';
        ctx.fill();
      });
    }
    if (warm) {
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 10, 80, x - 12, 160, x + 4, 200 + r() * 160);
        ctx.strokeStyle = 'rgba(30,24,16,.9)';
        ctx.lineWidth = 2 + r() * 3;
        ctx.stroke();
      }
    }
    specks(ctx, r, 90, (rr) => (warm ? `rgba(150,230,110,${0.15 + rr() * 0.5})` : `rgba(140,210,255,${0.12 + rr() * 0.4})`));
    fogBand(ctx, H * 0.55, H * 0.45, warm ? 0x1a1610 : 0x10202e, 0.8);
    grainAll(ctx, W, H, 0.3);
    return;
  }
  const [c0, c1, c2] = SKY[theme];
  const dark = v === 'dark';
  ctx.fillStyle = vgrad(ctx, 0, H, dark ? [[0, '#06111a'], [0.5, '#03080b'], [1, '#010203']] : [[0, c0], [0.6, c1], [1, c2]]);
  ctx.fillRect(0, 0, W, H);
  const fog = FOG[theme];
  switch (theme) {
    case 'ozean': {
      if (!dark) rays(ctx, r, 7, 'rgba(160,220,210,A)', 0.07);
      else specks(ctx, r, 120, (rr) => `rgba(${rr() > 0.5 ? '90,240,210' : '120,180,255'},${0.15 + rr() * 0.55})`, 0, H, 1.4);
      ridge(ctx, r, H - 200, 140, 6, dark ? 'rgba(4,12,16,.95)' : 'rgba(10,28,34,.85)');
      fogBand(ctx, H - 300, 200, dark ? 0x061216 : fog, 0.5);
      ridge(ctx, r, H - 110, 110, 8, dark ? 'rgba(2,6,8,.97)' : 'rgba(6,18,22,.92)');
      specks(ctx, r, 160, (rr) => `rgba(200,220,210,${0.05 + rr() * 0.15})`, 0, H, 1);
      break;
    }
    case 'sumpf': {
      fogBand(ctx, H * 0.35, H * 0.4, fog, 0.5);
      for (let i = 0; i < 7; i++) scaleTree(ctx, (i + r()) * (W / 7), H - 120, 300 + r() * 160, 10 + r() * 6, 'rgba(28,36,22,.7)');
      fogBand(ctx, H * 0.5, H * 0.35, fog, 0.45);
      for (let i = 0; i < 6; i++) scaleTree(ctx, (i + r()) * (W / 6), H - 40, 360 + r() * 200, 14 + r() * 8, 'rgba(14,18,10,.92)');
      fogBand(ctx, H * 0.7, H * 0.3, fog, 0.35);
      break;
    }
    case 'reptil': {
      ell(ctx, 880, 210, 50, 50);
      ctx.fillStyle = rgrad(ctx, 880, 210, 10, 220, [[0, 'rgba(255,170,90,.55)'], [0.3, 'rgba(200,80,30,.22)'], [1, 'rgba(120,40,10,0)']]);
      ctx.fillRect(600, 0, 560, 460);
      ridge(ctx, r, H - 240, 120, 5, 'rgba(40,18,14,.85)');
      for (const [x, s] of [[320, 1], [900, 0.7]] as const) {
        wrapX(W, x, 340, (xx) => {
          ctx.beginPath();
          ctx.moveTo(xx - 320 * s, H - 140);
          ctx.lineTo(xx - 50 * s, H - 140 - 340 * s);
          ctx.lineTo(xx + 50 * s, H - 140 - 340 * s);
          ctx.lineTo(xx + 320 * s, H - 140);
          ctx.closePath();
          ctx.fillStyle = 'rgba(16,8,6,.96)';
          ctx.fill();
          ctx.fillStyle = rgrad(ctx, xx, H - 140 - 340 * s, 4, 90 * s, [[0, 'rgba(255,110,30,.8)'], [1, 'rgba(255,60,10,0)']]);
          ctx.fillRect(xx - 100 * s, H - 240 - 340 * s, 200 * s, 200 * s);
          for (let k = 0; k < 6; k++) {
            ell(ctx, xx + k * 32 * s, H - 170 - 340 * s - k * 50 * s, (34 + k * 14) * s, (24 + k * 9) * s);
            ctx.fillStyle = `rgba(36,22,20,${0.6 - k * 0.07})`;
            ctx.fill();
          }
        });
      }
      fogBand(ctx, H * 0.55, H * 0.3, fog, 0.45);
      ridge(ctx, r, H - 70, 70, 8, 'rgba(14,6,4,.95)');
      specks(ctx, r, 60, (rr) => `rgba(255,${120 + Math.floor(rr() * 80)},40,${0.2 + rr() * 0.5})`, 0, H * 0.8, 1.2);
      break;
    }
    case 'eis': {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) {
          const y = 80 + i * 36 + Math.sin((x / W) * Math.PI * 4 + i) * 26;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 2 ? 'rgba(90,220,170,.07)' : 'rgba(90,190,220,.08)';
        ctx.lineWidth = 30;
        ctx.stroke();
      }
      specks(ctx, r, 70, (rr) => `rgba(220,235,255,${0.2 + rr() * 0.6})`, 0, H * 0.4, 1);
      const peaks = (base: number, ht: number, n: number, col: string, snow: string) => {
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * (W / n) + (r() - 0.5) * 60, h = ht * (0.6 + r() * 0.5), w = h * 0.9;
          wrapX(W, x, w, (xx) => {
            ctx.beginPath();
            ctx.moveTo(xx - w, base);
            ctx.lineTo(xx, base - h);
            ctx.lineTo(xx + w, base);
            ctx.closePath();
            ctx.fillStyle = col;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(xx - w * 0.3, base - h * 0.7);
            ctx.lineTo(xx, base - h);
            ctx.lineTo(xx + w * 0.3, base - h * 0.7);
            ctx.lineTo(xx + w * 0.1, base - h * 0.62);
            ctx.lineTo(xx - w * 0.05, base - h * 0.72);
            ctx.closePath();
            ctx.fillStyle = snow;
            ctx.fill();
          });
        }
      };
      peaks(H - 150, 330, 4, 'rgba(18,28,40,.92)', 'rgba(110,130,150,.45)');
      fogBand(ctx, H * 0.5, H * 0.3, fog, 0.4);
      peaks(H - 60, 220, 6, 'rgba(12,20,28,.96)', 'rgba(130,150,170,.4)');
      break;
    }
    case 'eden': {
      ctx.fillStyle = rgrad(ctx, 640, 300, 30, 460, [[0, 'rgba(255,220,150,.32)'], [0.4, 'rgba(200,150,80,.12)'], [1, 'rgba(120,80,30,0)']]);
      ctx.fillRect(0, 0, W, H);
      rays(ctx, r, 6, 'rgba(255,220,160,A)', 0.06);
      for (let i = 0; i < 5; i++) {
        const x = (i + r()) * (W / 5);
        wrapX(W, x, 140, (xx) => {
          ctx.fillStyle = 'rgba(30,24,14,.75)';
          ctx.fillRect(xx - 14, H - 520, 28, 520);
          for (let k = 0; k < 8; k++) {
            ell(ctx, xx + Math.cos(k * 1.3) * 90, H - 520 + Math.sin(k * 2.1) * 50, 90, 60);
            ctx.fill();
          }
        });
      }
      fogBand(ctx, H * 0.5, H * 0.35, fog, 0.45);
      ridge(ctx, r, H - 90, 70, 7, 'rgba(14,12,6,.95)');
      specks(ctx, r, 60, (rr) => `rgba(255,230,170,${0.15 + rr() * 0.5})`, 0, H * 0.8, 1.3);
      break;
    }
  }
  grainAll(ctx, W, H, 0.3);
}

function midBg(ctx: Ctx, theme: Theme, v: BgVariant) {
  const r = mulberry32(theme.length * 7 + 3 + v.length);
  const ground = (c: string) => ridge(ctx, r, H - 30, 50, 9, c, 0.25);
  if (v === 'cave') {
    const col = theme === 'sumpf' ? 'rgba(12,9,6,.95)' : 'rgba(8,16,24,.95)';
    for (let i = 0; i < 16; i++) {
      const x = r() * W, ht = 60 + r() * 180, w = 30 + r() * 50;
      wrapX(W, x, w, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, H);
        ctx.quadraticCurveTo(xx - w * 0.1, H - ht * 0.6, xx, H - ht);
        ctx.quadraticCurveTo(xx + w * 0.1, H - ht * 0.6, xx + w / 2, H);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      });
    }
    return;
  }
  switch (theme) {
    case 'ozean': {
      const col = v === 'dark' ? 'rgba(2,6,8,.95)' : 'rgba(5,16,16,.92)';
      for (let i = 0; i < 18; i++) {
        const x = r() * W, ht = 200 + r() * 380;
        wrapX(W, x, 50, (xx) => {
          ctx.beginPath();
          ctx.moveTo(xx, H);
          for (let y = H; y > H - ht; y -= 18) ctx.lineTo(xx + Math.sin(y * 0.025 + i) * 12, y);
          ctx.strokeStyle = col;
          ctx.lineWidth = 7 + r() * 5;
          ctx.stroke();
          for (let y = H - 40; y > H - ht; y -= 34) {
            ell(ctx, xx + Math.sin(y * 0.025 + i) * 12 + 9, y, 10, 4, 0.5);
            ctx.fillStyle = col;
            ctx.fill();
          }
        });
      }
      ground(v === 'dark' ? 'rgba(1,3,4,.98)' : 'rgba(4,12,12,.96)');
      break;
    }
    case 'sumpf': {
      for (let i = 0; i < 16; i++) {
        const x = r() * W, s = 0.7 + r() * 0.8;
        wrapX(W, x, 110, (xx) => {
          for (let k = 0; k < 8; k++) {
            const a = -Math.PI / 2 + (k - 3.5) * 0.32;
            ctx.beginPath();
            ctx.moveTo(xx, H - 30);
            ctx.quadraticCurveTo(xx + Math.cos(a) * 60 * s, H - 30 + Math.sin(a) * 100 * s, xx + Math.cos(a) * 110 * s, H - 30 + Math.sin(a) * 70 * s);
            ctx.strokeStyle = 'rgba(8,12,6,.92)';
            ctx.lineWidth = 8 * s;
            ctx.stroke();
          }
        });
      }
      ground('rgba(6,8,4,.97)');
      break;
    }
    case 'reptil': {
      for (let i = 0; i < 9; i++) {
        const x = r() * W, ht = 200 + r() * 160;
        wrapX(W, x, 100, (xx) => {
          ctx.strokeStyle = 'rgba(10,5,4,.95)';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(xx, H);
          ctx.quadraticCurveTo(xx + 15, H - ht / 2, xx + 5, H - ht);
          ctx.stroke();
          for (let k = 0; k < 8; k++) {
            const a = -Math.PI / 2 + (k - 3.5) * 0.42;
            ctx.beginPath();
            ctx.moveTo(xx + 5, H - ht);
            ctx.quadraticCurveTo(xx + 5 + Math.cos(a) * 55, H - ht + Math.sin(a) * 40, xx + 5 + Math.cos(a) * 90, H - ht + Math.sin(a) * 10 + 34);
            ctx.lineWidth = 7;
            ctx.stroke();
          }
        });
      }
      ground('rgba(8,4,3,.97)');
      break;
    }
    case 'eis': {
      for (let i = 0; i < 18; i++) conifer(ctx, r() * W, H - 20, 120 + r() * 160, 'rgba(6,10,15,.95)', 'rgba(110,128,146,.45)');
      ground('rgba(30,40,52,.97)');
      break;
    }
    case 'eden': {
      for (let i = 0; i < 9; i++) {
        const x = r() * W, ht = 180 + r() * 120;
        wrapX(W, x, 120, (xx) => {
          ctx.fillStyle = 'rgba(10,8,4,.92)';
          ctx.fillRect(xx - 9, H - ht, 18, ht);
          for (let k = 0; k < 7; k++) {
            ell(ctx, xx + Math.cos(k) * 55, H - ht - 20 + Math.sin(k * 2) * 30, 64, 46);
            ctx.fill();
          }
        });
      }
      ground('rgba(6,6,3,.97)');
      break;
    }
  }
}

export function levelBackgrounds(scene: Phaser.Scene, theme: Theme, v: BgVariant): [string, string, string] {
  const far = tex(scene, `bgf2_${theme}_${v}`, W, H, (ctx) => farBg(ctx, theme, v));
  const mid = tex(scene, `bgm2_${theme}_${v}`, W, H, (ctx) => midBg(ctx, theme, v));
  // Nebel: nur waagerecht gekachelt, nach oben weich auslaufend (keine harte Kante)
  const FH = Math.round(H * 0.65);
  const fog = tex(scene, `fog2_${theme}_${v}`, 512, FH, (ctx) => {
    const col = v === 'cave' ? (theme === 'sumpf' ? 0x241c14 : 0x1a2a3a) : v === 'dark' ? 0x0a1a20 : FOG[theme];
    ctx.fillStyle = css(col);
    ctx.fillRect(0, 0, 512, FH);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = ctx.createPattern(noiseTex('cloud'), 'repeat')!;
    ctx.fillRect(0, 0, 512, FH);
    const g = ctx.createLinearGradient(0, 0, 0, FH);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, FH);
  });
  return [far, mid, fog];
}

// ---------------------------------------------------------------------------
// Boden, Plattformen, Fallen

interface GroundStyle {
  fill: number;
  top: number;
  plat: number;
}

const GROUND: Record<Theme, GroundStyle> = {
  ozean: { fill: 0x1c2628, top: 0x46423a, plat: 0x2a3436 },
  sumpf: { fill: 0x1e1810, top: 0x2a3418, plat: 0x3a2a1a },
  reptil: { fill: 0x26160f, top: 0x3c311a, plat: 0x3a2a22 },
  eis: { fill: 0x1c2832, top: 0xaab6be, plat: 0x5a7486 },
  eden: { fill: 0x1e160c, top: 0x2e3a18, plat: 0x3a3428 },
};

export function groundTextures(scene: Phaser.Scene, theme: Theme) {
  const g = GROUND[theme];
  const gnd = tex(scene, `gnd2_${theme}`, 128, 128, (ctx) => {
    ctx.fillStyle = css(g.fill);
    ctx.fillRect(0, 0, 128, 128);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.5);
    ctx.fillRect(0, 0, 128, 128);
    ctx.restore();
    const r = mulberry32(theme.length * 5);
    for (let i = 0; i < 26; i++) {
      const x = r() * 128, y = r() * 128, rx = 2 + r() * 7, ry = 1.5 + r() * 4;
      const c = r() > 0.5 ? shade(g.fill, 0.15 + r() * 0.1) : shade(g.fill, -0.35);
      tile9(128, 128, (dx, dy) => {
        ell(ctx, x + dx, y + dy, rx, ry, r() * 0.3);
        ctx.fillStyle = css(c, 0.7);
        ctx.fill();
      });
    }
    if (theme === 'sumpf' || theme === 'eden') {
      ctx.strokeStyle = css(shade(g.fill, -0.5), 0.8);
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const x = r() * 128, y = r() * 128;
        tile9(128, 128, (dx, dy) => {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.bezierCurveTo(x + dx + 10, y + dy + 8, x + dx - 6, y + dy + 20, x + dx + 8, y + dy + 30);
          ctx.stroke();
        });
      }
    }
    if (theme === 'eis') {
      ctx.strokeStyle = 'rgba(160,200,230,.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = r() * 128, y = r() * 128;
        tile9(128, 128, (dx, dy) => {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + 18, y + dy + 10);
          ctx.stroke();
        });
      }
    }
    if (theme === 'reptil') {
      for (let i = 0; i < 3; i++) {
        const x = r() * 128, y = r() * 128;
        tile9(128, 128, (dx, dy) => {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + 14, y + dy + 6);
          ctx.lineTo(x + dx + 20, y + dy + 16);
          ctx.strokeStyle = 'rgba(255,90,20,.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
    }
  });
  const top = tex(scene, `top2_${theme}`, 128, 30, (ctx) => {
    const r = mulberry32(theme.length * 3);
    // dunkle Unterkante (Übergang zur Erde)
    ctx.fillStyle = vgrad(ctx, 8, 30, [[0, css(g.top)], [0.6, css(shade(g.top, -0.45))], [1, css(shade(g.top, -0.6), 0)]]);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    for (let x = 0; x <= 128; x += 8) ctx.quadraticCurveTo(x + 4, 7 + (x % 16 ? 2 : -1), x + 8, 10);
    ctx.lineTo(128, 24);
    for (let x = 128; x >= 0; x -= 8) ctx.lineTo(x, 22 + (x % 16 ? 6 : 2));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(shade(g.top, 0.15), 0.8);
    ctx.fillRect(0, 9, 128, 2);
    if (theme === 'sumpf' || theme === 'reptil' || theme === 'eden') {
      for (let i = 0; i < 34; i++) {
        const x = (i / 34) * 128 + r() * 3;
        ctx.beginPath();
        ctx.moveTo(x, 11);
        ctx.quadraticCurveTo(x + 1, 4, x + 2 + r() * 3, r() * 4);
        ctx.lineTo(x + 2.5, 11);
        ctx.closePath();
        ctx.fillStyle = css(shade(g.top, (r() - 0.6) * 0.5));
        ctx.fill();
      }
    }
    if (theme === 'ozean') {
      for (let i = 0; i < 18; i++) {
        ell(ctx, r() * 128, 12 + r() * 8, 1.2, 0.8);
        ctx.fillStyle = 'rgba(20,18,14,.6)';
        ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const x = r() * 128;
        ctx.beginPath();
        ctx.moveTo(x, 11);
        ctx.quadraticCurveTo(x + 3, 4, x + 1, 0);
        ctx.strokeStyle = 'rgba(46,60,36,.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (theme === 'eis') {
      ctx.fillStyle = 'rgba(60,80,100,.5)';
      ctx.fillRect(0, 18, 128, 3);
    }
    if (theme === 'eden') {
      for (let i = 0; i < 4; i++) {
        ell(ctx, 10 + i * 32 + r() * 8, 6, 1.8, 1.8);
        ctx.fillStyle = ['rgba(160,60,60,.8)', 'rgba(170,150,70,.8)', 'rgba(200,190,170,.7)', 'rgba(110,80,150,.8)'][i];
        ctx.fill();
      }
    }
  });
  const plat = tex(scene, `plat2_${theme}`, 80, 22, (ctx) => {
    if (theme === 'sumpf' || theme === 'eden') {
      ctx.beginPath();
      ctx.moveTo(4, 2);
      ctx.lineTo(80, 2);
      ctx.lineTo(80, 20);
      ctx.lineTo(4, 20);
      ctx.quadraticCurveTo(0, 11, 4, 2);
      ctx.closePath();
      fillStroke(ctx, vgrad(ctx, 2, 20, [[0, css(shade(g.plat, 0.15))], [1, css(shade(g.plat, -0.5))]]), css(shade(g.plat, -0.75)), 1.5);
      ctx.strokeStyle = css(shade(g.plat, -0.6), 0.7);
      ctx.lineWidth = 1;
      for (let x = 10; x < 80; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x + 9, 7);
        ctx.stroke();
      }
      ctx.fillStyle = css(theme === 'sumpf' ? 0x2a3418 : 0x2e3a18);
      ctx.fillRect(12, 1, 22, 3);
      ctx.fillRect(48, 1, 16, 3);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.quadraticCurveTo(10, 1, 40, 2);
    ctx.quadraticCurveTo(70, 1, 80, 6);
    ctx.lineTo(78, 20);
    ctx.quadraticCurveTo(40, 22, 2, 20);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 2, 20, [[0, css(shade(g.plat, theme === 'eis' ? 0.25 : 0.1))], [1, css(shade(g.plat, -0.55))]]), css(shade(g.plat, -0.75)), 1.5);
    ctx.save();
    ctx.clip(); // nur innerhalb der Form färben
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.4);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, 0, 80, 22);
    ctx.restore();
  });
  const hz = tex(scene, `hz2_${theme}`, 80, 40, (ctx) => {
    const r = mulberry32(5);
    switch (theme) {
      case 'reptil': {
        ctx.fillStyle = vgrad(ctx, 8, 40, [[0, '#ffb04a'], [0.3, '#d8501a'], [1, '#5a1206']]);
        ctx.beginPath();
        ctx.moveTo(0, 10);
        for (let x = 0; x <= 80; x += 10) ctx.quadraticCurveTo(x + 5, 4, x + 10, 10);
        ctx.lineTo(80, 40);
        ctx.lineTo(0, 40);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          blob(ctx, r, r() * 80, 18 + r() * 18, 4 + r() * 5, 2 + r() * 2, 6);
          ctx.fillStyle = 'rgba(30,8,4,.75)';
          ctx.fill();
        }
        break;
      }
      case 'ozean': {
        for (const x of [20, 60]) {
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(x, 28);
            ctx.lineTo(x + Math.cos(a) * 19, 28 + Math.sin(a) * 19);
            ctx.strokeStyle = '#0c0610';
            ctx.lineWidth = 1.6;
            ctx.stroke();
          }
          ell(ctx, x, 30, 11, 9);
          fillStroke(ctx, rgrad(ctx, x - 3, 26, 1, 13, [[0, '#4a2a5a'], [1, '#120816']]), '#06030a', 1.2);
        }
        break;
      }
      default: {
        const col = theme === 'sumpf' ? ['#2a2014', '#0c0804'] : theme === 'eis' ? ['#c8dceb', '#3a5266'] : ['#3a1a1a', '#0c0606'];
        for (let i = 0; i < 9; i++) {
          const x = 4 + i * 9, ht = 18 + (i % 3) * 8;
          ctx.beginPath();
          ctx.moveTo(x - 5, 40);
          ctx.quadraticCurveTo(x - 1, 40 - ht * 0.5, x + (i % 2 ? 2 : -2), 40 - ht);
          ctx.quadraticCurveTo(x + 1, 40 - ht * 0.5, x + 5, 40);
          ctx.closePath();
          fillStroke(ctx, vgrad(ctx, 40 - ht, 40, [[0, col[0]], [1, col[1]]]), 'rgba(0,0,0,.6)', 1);
        }
        if (theme !== 'eis') {
          ctx.strokeStyle = theme === 'sumpf' ? '#1a2010' : '#2a1010';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 34);
          ctx.bezierCurveTo(20, 22, 40, 40, 80, 28);
          ctx.stroke();
        }
      }
    }
  });
  if (theme === 'reptil') {
    tex(scene, 'spk2_reptil', 80, 40, (ctx) => {
      for (let i = 0; i < 8; i++) {
        const x = 5 + i * 10, ht = 16 + (i % 3) * 7;
        ctx.beginPath();
        ctx.moveTo(x - 6, 40);
        ctx.lineTo(x - 1, 40 - ht);
        ctx.lineTo(x + 6, 40);
        ctx.closePath();
        fillStroke(ctx, vgrad(ctx, 40 - ht, 40, [[0, '#4a3e4a'], [0.6, '#16101a'], [1, '#c8401a']]), '#060406', 1);
      }
    });
  }
  return { gnd, top, plat, hz };
}

// ---------------------------------------------------------------------------
// Fressbare Pflanzen (3 Stufen: voll, angefressen, kahl)

export function foodKey(theme: Theme, stage: number) {
  return `food_${theme}_${stage}`;
}

export function plantTextures(scene: Phaser.Scene, theme: Theme) {
  for (let stage = 0; stage < 3; stage++) {
    tex(scene, foodKey(theme, stage), 70, 64, (ctx) => drawPlant(ctx, theme, stage));
  }
}

function drawPlant(ctx: Ctx, theme: Theme, stage: number) {
  const r = mulberry32(theme.length * 13 + 1);
  const full = stage === 0, half = stage === 1;
  const n = full ? 1 : half ? 0.55 : 0;
  const bx = 35, by = 62;
  switch (theme) {
    case 'ozean': {
      // Algenpolster auf einem Stein
      blob(ctx, r, bx, by - 6, 22, 9);
      fillStroke(ctx, vgrad(ctx, by - 16, by, [[0, '#3a4446'], [1, '#121818']]), '#0a0e0e', 1.2);
      const fronds = Math.round(14 * n);
      for (let i = 0; i < fronds; i++) {
        const x = bx - 18 + r() * 36, ht = 14 + r() * 24;
        ctx.beginPath();
        ctx.moveTo(x, by - 10);
        ctx.bezierCurveTo(x + 6, by - 10 - ht * 0.4, x - 6, by - 10 - ht * 0.7, x + (r() - 0.5) * 8, by - 10 - ht);
        ctx.strokeStyle = i % 3 ? '#4e5a26' : '#6a7430';
        ctx.lineWidth = 3;
        ctx.stroke();
        ell(ctx, x + (r() - 0.5) * 6, by - 10 - ht, 2.5, 2);
        ctx.fillStyle = '#9aa042';
        ctx.fill();
      }
      if (!full) for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(bx - 14 + i * 6, by - 10);
        ctx.lineTo(bx - 13 + i * 6, by - 15);
        ctx.strokeStyle = '#3a4220';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'sumpf': {
      // Farn mit eingerollten jungen Trieben
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.42;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + Math.cos(a) * 20, by + Math.sin(a) * 40, bx + Math.cos(a) * 32, by + Math.sin(a) * 30);
        ctx.strokeStyle = '#1e2a12';
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let i = 1; i < 6; i++) {
          const t = i / 6;
          ell(ctx, bx + Math.cos(a) * 32 * t, by + Math.sin(a) * (40 * t - 10 * t * t) , 5 * (1 - t * 0.5), 1.8, a + Math.PI / 2);
          ctx.fillStyle = '#26361a';
          ctx.fill();
        }
      }
      const shoots = Math.round(4 * n);
      for (let i = 0; i < shoots; i++) {
        const x = bx - 12 + i * 8, ht = 26 + (i % 2) * 10;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.quadraticCurveTo(x - 2, by - ht * 0.6, x, by - ht);
        ctx.strokeStyle = '#6a8a2a';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 3, by - ht, 3.5, Math.PI, Math.PI * 2.6);
        ctx.strokeStyle = '#8aa83a';
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }
      break;
    }
    case 'reptil': {
      // Palmfarn mit Zapfenfrüchten
      ctx.fillStyle = '#2a1c10';
      for (let y = by; y > by - 22; y -= 5) ctx.fillRect(bx - 6, y - 5, 12, 4);
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2 + (k - 3.5) * 0.4;
        ctx.beginPath();
        ctx.moveTo(bx, by - 22);
        ctx.quadraticCurveTo(bx + Math.cos(a) * 18, by - 22 + Math.sin(a) * 26, bx + Math.cos(a) * 32, by - 22 + Math.sin(a) * 14 + 14);
        ctx.strokeStyle = k % 2 ? '#2a3a16' : '#34461a';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const fr = Math.round(3 * n);
      for (let i = 0; i < fr; i++) {
        ell(ctx, bx - 7 + i * 7, by - 24 - (i % 2) * 3, 4, 6);
        fillStroke(ctx, vgrad(ctx, by - 30, by - 18, [[0, '#d0702a'], [1, '#6a2a0e']]), '#2a0e04', 1);
      }
      break;
    }
    case 'eis': {
      // Beerenstrauch im Schnee
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + Math.cos(a) * 16, by + Math.sin(a) * 30, bx + Math.cos(a) * 28, by + Math.sin(a) * 34);
        ctx.strokeStyle = '#2a1e18';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ell(ctx, bx, by - 22, 24, 12);
      ctx.fillStyle = 'rgba(32,46,40,.9)';
      ctx.fill();
      ell(ctx, bx - 4, by - 30, 18, 5);
      ctx.fillStyle = 'rgba(170,186,196,.85)';
      ctx.fill();
      const b = Math.round(9 * n);
      for (let i = 0; i < b; i++) {
        ell(ctx, bx - 16 + r() * 32, by - 26 + r() * 14, 2.6, 2.6);
        fillStroke(ctx, rgrad(ctx, bx, by - 22, 0, 30, [[0, '#a02030'], [1, '#5a0a18']]), '#200408', 0.8);
      }
      break;
    }
    case 'eden': {
      ell(ctx, bx, by - 20, 26, 18);
      fillStroke(ctx, vgrad(ctx, by - 38, by, [[0, '#34421c'], [1, '#141a0a']]), '#0a0e06', 1.2);
      for (let i = 0; i < 18; i++) {
        ell(ctx, bx - 22 + r() * 44, by - 34 + r() * 28, 4, 2.4, r() * 3);
        ctx.fillStyle = r() > 0.5 ? '#3e4e22' : '#26321a';
        ctx.fill();
      }
      const f = Math.round(6 * n);
      for (let i = 0; i < f; i++) {
        ell(ctx, bx - 14 + r() * 28, by - 30 + r() * 18, 4, 4);
        fillStroke(ctx, rgrad(ctx, bx - 2, by - 26, 0, 20, [[0, '#e8b84a'], [1, '#8a5a14']]), '#2a1a04', 0.8);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Dichtes Gestrüpp zum Verstecken (wird vor die Figur gezeichnet)

/** Dichtes Gestrüpp zum Verstecken: einzelne Büsche mit weichem, unregelmäßigem Umriss (3 Varianten). */
export function coverTextures(scene: Phaser.Scene, theme: Theme): string[] {
  const keys: string[] = [];
  for (let k = 0; k < 3; k++) {
    keys.push(tex(scene, `bush_${theme}_${k}`, 150, 210, (ctx, w, h) => {
      const r = mulberry32(theme.length * 31 + k * 977);
      const base = h - 2;
      const cx = w / 2;
      const strand = (x: number, ht: number, col: string, lw: number, sway: number) => {
        ctx.beginPath();
        ctx.moveTo(x, base);
        for (let y = base; y > base - ht; y -= 10) ctx.lineTo(x + Math.sin(y * 0.035 + sway) * 7 * ((base - y) / ht), y);
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.stroke();
      };
      switch (theme) {
        case 'ozean':
          for (let i = 0; i < 9; i++) {
            const x = cx + (r() - 0.5) * 90;
            const ht = 120 + r() * 80;
            const col = i % 2 ? '#1a2412' : '#24301a';
            strand(x, ht, col, 5, i + k);
            for (let y = base - 16; y > base - ht + 10; y -= 18) {
              const t = (base - y) / ht;
              ell(ctx, x + Math.sin(y * 0.035 + i + k) * 7 * t + (i % 2 ? 7 : -7), y, 9 - t * 3, 3.6, i % 2 ? 0.5 : -0.5);
              ctx.fillStyle = i % 2 ? '#202c16' : '#2c381c';
              ctx.fill();
            }
          }
          break;
        case 'sumpf':
        case 'reptil':
          for (let i = 0; i < 6; i++) {
            const x = cx + (r() - 0.5) * 70;
            const sc = 0.75 + r() * 0.35;
            for (let f = 0; f < 7; f++) {
              const a = -Math.PI / 2 + (f - 3) * 0.28;
              const ex = x + Math.cos(a) * 66 * sc, ey = base + Math.sin(a) * 170 * sc;
              ctx.beginPath();
              ctx.moveTo(x, base);
              ctx.quadraticCurveTo(x + Math.cos(a) * 30 * sc, base + Math.sin(a) * 150 * sc, ex, ey);
              ctx.strokeStyle = theme === 'sumpf' ? (f % 2 ? '#141c0e' : '#1c2612') : f % 2 ? '#16180c' : '#1e2410';
              ctx.lineWidth = 4;
              ctx.stroke();
              // Fiederblättchen
              for (let t = 0.3; t < 0.95; t += 0.12) {
                const px = x + (ex - x) * t + Math.cos(a) * 6, py = base + (ey - base) * t;
                ell(ctx, px - 5, py, 6 * (1 - t * 0.5), 2.2, 0.6);
                ell(ctx, px + 5, py, 6 * (1 - t * 0.5), 2.2, -0.6);
                ctx.fillStyle = theme === 'sumpf' ? '#18220f' : '#1a1e0e';
                ctx.fill();
              }
            }
          }
          break;
        case 'eis':
          for (let i = 0; i < 3; i++) {
            const x = cx + (i - 1) * 38 + (r() - 0.5) * 10;
            conifer(ctx, x, base, 130 + r() * 60, '#0c141a', 'rgba(150,166,178,.6)');
          }
          break;
        case 'eden':
          for (let i = 0; i < 16; i++) {
            const t = r();
            const y = base - 18 - t * 150;
            const x = cx + (r() - 0.5) * (110 - t * 50);
            ell(ctx, x, y, 22 + r() * 12, 17 + r() * 8);
            ctx.fillStyle = i % 2 ? '#141a0a' : '#1a220e';
            ctx.fill();
          }
          ctx.fillStyle = '#0e0a06';
          ctx.fillRect(cx - 4, base - 40, 8, 40);
          break;
      }
    }));
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Deko (Hintergrund, nicht interaktiv) – Ursprung unten Mitte

export const DECOR: Record<Theme, string[]> = {
  ozean: ['rock', 'shell', 'seaweed', 'rock', 'bones'],
  sumpf: ['stump', 'mushroom', 'reed', 'bones', 'rock'],
  reptil: ['boulder', 'bones', 'skull', 'stump', 'rock'],
  eis: ['rock_snow', 'bones', 'deadtree', 'rock_snow'],
  eden: ['rock', 'skull', 'stump', 'reed', 'bones'],
};

export function decorTextures(scene: Phaser.Scene) {
  const T = (k: string, w: number, h: number, fn: (ctx: Ctx, w: number, h: number) => void) => tex(scene, 'd2_' + k, w, h, fn);
  const r = mulberry32(77);
  T('rock', 64, 38, (ctx, w, h) => {
    blob(ctx, r, w / 2, h * 0.62, w * 0.45, h * 0.45);
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#3a3a36'], [1, '#121210']]), '#060605', 1.5);
    ctx.save();
    ctx.clip(); // nur innerhalb der Form färben
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.5);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });
  T('rock_snow', 70, 40, (ctx, w, h) => {
    blob(ctx, r, w / 2, h * 0.62, w * 0.45, h * 0.45);
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#2a3440'], [1, '#0c1016']]), '#05070a', 1.5);
    blob(ctx, r, w / 2 - 3, h * 0.36, w * 0.32, h * 0.16);
    ctx.fillStyle = 'rgba(170,186,198,.9)';
    ctx.fill();
  });
  T('boulder', 70, 46, (ctx, w, h) => {
    blob(ctx, r, w / 2, h * 0.6, w * 0.46, h * 0.5);
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#3a241c'], [1, '#120a08']]), '#060403', 1.5);
  });
  T('shell', 22, 14, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(2, h);
    ctx.quadraticCurveTo(w / 2, -4, w - 2, h);
    ctx.closePath();
    fillStroke(ctx, '#6a5a48', '#1a140e', 1);
  });
  T('seaweed', 30, 70, (ctx, w, h) => {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + (k - 1) * 6, h);
      for (let y = h; y > 10 + k * 12; y -= 8) ctx.lineTo(w / 2 + (k - 1) * 6 + Math.sin(y * 0.15 + k) * 5, y);
      ctx.strokeStyle = ['#1a2a14', '#24321a', '#121e0e'][k];
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  });
  T('bones', 58, 22, (ctx, w, h) => {
    ctx.strokeStyle = '#a89c84';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(6, h - 6);
    ctx.lineTo(w - 12, h - 10);
    ctx.stroke();
    for (const x of [6, w - 12]) {
      ell(ctx, x, h - 8, 3.6, 3.6);
      ctx.fillStyle = '#a89c84';
      ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(w / 2 + 4, h + 2, 6 + i * 3, Math.PI * 1.1, Math.PI * 1.7);
      ctx.strokeStyle = 'rgba(150,140,118,.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  T('skull', 44, 30, (ctx, _w, h) => {
    ctx.beginPath();
    ctx.moveTo(4, h - 4);
    ctx.quadraticCurveTo(6, 6, 22, 5);
    ctx.quadraticCurveTo(40, 6, 42, 18);
    ctx.lineTo(40, h - 4);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 4, h, [[0, '#b4a88e'], [1, '#5a5040']]), '#141008', 1.2);
    ell(ctx, 16, 14, 4, 3.5);
    ctx.fillStyle = '#0a0806';
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(26 + i * 4, h - 4);
      ctx.lineTo(27 + i * 4, h + 1);
      ctx.strokeStyle = '#d8ccb0';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  T('stump', 46, 40, (ctx, _w, h) => {
    ctx.beginPath();
    ctx.moveTo(6, h);
    ctx.lineTo(10, 10);
    ctx.lineTo(16, 6);
    ctx.lineTo(22, 12);
    ctx.lineTo(30, 4);
    ctx.lineTo(36, 10);
    ctx.lineTo(40, h);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#2e2216'], [1, '#100a06']]), '#060402', 1.2);
  });
  T('mushroom', 26, 26, (ctx, w, h) => {
    ctx.fillStyle = '#8a8270';
    ctx.fillRect(w / 2 - 2.5, h - 12, 5, 12);
    ctx.beginPath();
    ctx.arc(w / 2, h - 11, 10, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, h - 22, h - 10, [[0, '#7a3a24'], [1, '#3a160c']]), '#140604', 1);
    for (const [x, y] of [[-4, -15], [3, -17]]) {
      ell(ctx, w / 2 + x, h + y, 1.6, 1.6);
      ctx.fillStyle = 'rgba(200,190,170,.7)';
      ctx.fill();
    }
  });
  T('reed', 26, 76, (ctx, w, h) => {
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + (k - 1.5) * 3, h);
      ctx.quadraticCurveTo(w / 2 + (k - 1.5) * 6, h / 2, w / 2 + (k - 1.5) * 8, 10 + k * 6);
      ctx.strokeStyle = '#26301a';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    ell(ctx, w / 2 + 3, 12, 3, 9);
    ctx.fillStyle = '#2a1c10';
    ctx.fill();
  });
  T('deadtree', 70, 120, (ctx, w, h) => {
    ctx.strokeStyle = '#1a1612';
    ctx.lineCap = 'round';
    const br = (x: number, y: number, a: number, l: number, wdt: number, d: number) => {
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (d < 3) {
        br(x2, y2, a - 0.5, l * 0.7, wdt * 0.6, d + 1);
        br(x2, y2, a + 0.45, l * 0.65, wdt * 0.6, d + 1);
      }
    };
    br(w / 2, h, -Math.PI / 2, 46, 8, 0);
  });
  tex(scene, 'd2_stalactite', 34, 90, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w * 0.35, h * 0.6, w / 2, h);
    ctx.quadraticCurveTo(w * 0.65, h * 0.6, w, 0);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#2a2218'], [1, '#0a0806']]), '#040302', 1.2);
  });
  tex(scene, 'd2_stalactite_ice', 34, 90, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(w * 0.35, h * 0.6, w / 2, h);
    ctx.quadraticCurveTo(w * 0.65, h * 0.6, w, 0);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, 'rgba(120,160,190,.9)'], [1, 'rgba(40,70,100,.85)']]), '#0a1622', 1.2);
  });
}

// ---------------------------------------------------------------------------
// Weltkarten (dunkel, wie eine alte Karte)

export function mapTexture(scene: Phaser.Scene, era: Theme) {
  return tex(scene, `map2_${era}`, W, H, (ctx) => {
    const r = mulberry32(era.length * 1234);
    const land = (col: string, n: number, rx: number, ry: number) => {
      for (let i = 0; i < n; i++) {
        blob(ctx, r, r() * W, r() * H, rx * (0.6 + r()), ry * (0.6 + r()));
        ctx.fillStyle = col;
        ctx.fill();
      }
    };
    switch (era) {
      case 'ozean': {
        ctx.fillStyle = rgrad(ctx, 640, 360, 50, 900, [[0, '#123038'], [1, '#040c10']]);
        ctx.fillRect(0, 0, W, H);
        for (const [x, y, rx, ry] of [[150, 560, 160, 70], [380, 470, 120, 50], [700, 600, 190, 70], [1150, 560, 150, 110], [250, 200, 90, 50], [1050, 130, 140, 60]]) {
          blob(ctx, r, x, y, rx + 16, ry + 14);
          ctx.fillStyle = 'rgba(40,80,84,.35)';
          ctx.fill();
          blob(ctx, r, x, y, rx, ry);
          fillStroke(ctx, vgrad(ctx, y - ry, y + ry, [[0, '#4a4636'], [1, '#262418']]), 'rgba(10,10,6,.6)', 2);
        }
        ctx.fillStyle = rgrad(ctx, 660, 200, 10, 260, [[0, 'rgba(0,4,8,.85)'], [1, 'rgba(0,4,8,0)']]);
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 120; i++) {
          const x = r() * W, y = r() * H;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 10, y - 5, x + 22, y);
          ctx.strokeStyle = 'rgba(160,210,210,.05)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        break;
      }
      case 'sumpf': {
        ctx.fillStyle = '#1e2414';
        ctx.fillRect(0, 0, W, H);
        land('rgba(40,48,26,.5)', 60, 50, 36);
        land('rgba(30,24,14,.4)', 30, 40, 30);
        for (const pts of [[[-40, 120], [300, 200], [520, 380], [780, 360], [1320, 560]], [[200, 760], [360, 560], [640, 600], [900, 700]]]) {
          for (const [lw, col] of [[44, '#0e1a18'], [28, '#16262a'], [6, 'rgba(120,150,140,.12)']] as const) {
            smooth(ctx, pts, false);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
        for (let i = 0; i < 22; i++) {
          const x = r() * W, y = r() * H;
          ell(ctx, x, y, 22, 20);
          fillStroke(ctx, rgrad(ctx, x - 6, y - 6, 2, 24, [[0, '#2e3a1e'], [1, '#121a0c']]), 'rgba(0,0,0,.5)', 1.5);
        }
        break;
      }
      case 'reptil': {
        ctx.fillStyle = '#2a1e14';
        ctx.fillRect(0, 0, W, H);
        land('rgba(50,44,22,.45)', 50, 60, 40);
        land('rgba(20,12,8,.4)', 30, 50, 30);
        const vx = 1150, vy = 110;
        ell(ctx, vx, vy, 190, 150);
        ctx.fillStyle = rgrad(ctx, vx, vy, 20, 190, [[0, '#120806'], [0.5, '#2a160e'], [1, 'rgba(42,30,20,0)']]);
        ctx.fill();
        ell(ctx, vx, vy, 36, 26);
        ctx.fillStyle = rgrad(ctx, vx, vy, 4, 36, [[0, '#ffb060'], [1, '#801a06']]);
        ctx.fill();
        for (const pts of [[[vx - 20, vy + 20], [1000, 220], [900, 260], [760, 240]], [[vx, vy + 30], [1120, 300], [1180, 420], [1240, 560]]]) {
          for (const [lw, col] of [[20, 'rgba(200,60,10,.25)'], [10, '#a83a10'], [4, '#ffa040']] as const) {
            smooth(ctx, pts, false);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
        break;
      }
      case 'eis': {
        ctx.fillStyle = '#1e2832';
        ctx.fillRect(0, 0, W, H);
        land('rgba(120,140,156,.25)', 50, 60, 36);
        ell(ctx, 700, 360, 150, 80);
        fillStroke(ctx, vgrad(ctx, 280, 440, [[0, '#2a4256'], [1, '#162636']]), 'rgba(120,160,190,.4)', 3);
        for (let i = 0; i < 22; i++) {
          let x = r() * W, y = r() * H;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += 10 + r() * 20;
            y += (r() - 0.5) * 30;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(10,18,26,.7)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        break;
      }
      case 'eden': {
        ctx.fillStyle = '#1e2414';
        ctx.fillRect(0, 0, W, H);
        land('rgba(52,62,30,.45)', 60, 50, 36);
        for (const [lw, col] of [[38, '#0e1e22'], [24, '#1a3238'], [6, 'rgba(180,200,190,.12)']] as const) {
          smooth(ctx, [[-30, 600], [250, 560], [420, 640], [700, 600], [1000, 660], [1320, 620]], false);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
        ctx.fillStyle = rgrad(ctx, 1050, 300, 10, 300, [[0, 'rgba(255,220,150,.35)'], [0.4, 'rgba(200,160,80,.12)'], [1, 'rgba(120,90,40,0)']]);
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 24; i++) {
          const x = r() * W, y = r() * 520;
          ell(ctx, x, y, 22, 18);
          fillStroke(ctx, rgrad(ctx, x - 6, y - 6, 2, 24, [[0, '#2e3a18'], [1, '#121a0a']]), 'rgba(0,0,0,.5)', 1.2);
        }
        break;
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern(ctx, 'mottle', 2);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    grainAll(ctx, W, H, 0.35);
    ctx.fillStyle = rgrad(ctx, W / 2, H / 2, 260, 820, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.7)']]);
    ctx.fillRect(0, 0, W, H);
  });
}

// ---------------------------------------------------------------------------
// Allgemeine Texturen: Partikel, Licht, Blut, Ausgang …

export function commonTextures(scene: Phaser.Scene) {
  tex(scene, 'p_dot', 16, 16, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 8, 8, 0, 8, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 16, 16);
  });
  tex(scene, 'p_bubble', 16, 16, (ctx) => {
    ell(ctx, 8, 8, 5.5, 5.5);
    fillStroke(ctx, 'rgba(200,230,230,.08)', 'rgba(200,230,230,.6)', 1.2);
    ell(ctx, 6, 6, 1.4, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fill();
  });
  tex(scene, 'p_snow', 10, 10, (ctx) => {
    ell(ctx, 5, 5, 3, 3);
    ctx.fillStyle = 'rgba(230,236,244,.9)';
    ctx.fill();
  });
  tex(scene, 'p_blood', 10, 10, (ctx) => {
    ell(ctx, 5, 5, 3.6, 3.6);
    ctx.fillStyle = '#6a0e0a';
    ctx.fill();
  });
  tex(scene, 'p_crumb', 8, 8, (ctx) => {
    ell(ctx, 4, 4, 2.6, 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  tex(scene, 'blood', 90, 26, (ctx) => {
    const r = mulberry32(3);
    blob(ctx, r, 45, 14, 40, 9, 12);
    ctx.fillStyle = 'rgba(70,6,4,.8)';
    ctx.fill();
    blob(ctx, r, 40, 14, 26, 6, 10);
    ctx.fillStyle = 'rgba(40,2,2,.7)';
    ctx.fill();
  });
  tex(scene, 'exitlight', 160, 360, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 160, 0);
    g.addColorStop(0, 'rgba(255,236,200,0)');
    g.addColorStop(0.5, 'rgba(255,236,200,.5)');
    g.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 360);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, 360);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.3, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 160, 360);
  });
  tex(scene, 'darkness', 512, 512, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 256, 256, 40, 256, [[0, 'rgba(0,3,6,0)'], [0.45, 'rgba(0,3,6,.45)'], [1, 'rgba(0,3,6,.96)']]);
    ctx.fillRect(0, 0, 512, 512);
  });
  tex(scene, 'vignette', 640, 360, (ctx) => {
    const g = ctx.createRadialGradient(320, 180, 120, 320, 180, 380);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
  });
  tex(scene, 'vignette_red', 640, 360, (ctx) => {
    const g = ctx.createRadialGradient(320, 180, 100, 320, 180, 380);
    g.addColorStop(0, 'rgba(120,0,0,0)');
    g.addColorStop(0.7, 'rgba(110,0,0,.5)');
    g.addColorStop(1, 'rgba(90,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
  });
  tex(scene, 'shadow', 80, 20, (ctx) => {
    ell(ctx, 40, 10, 36, 8);
    ctx.fillStyle = rgrad(ctx, 40, 10, 2, 36, [[0, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fill();
  });
  tex(scene, 'surface', 160, 30, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    for (let x = 0; x <= 160; x += 40) ctx.quadraticCurveTo(x + 20, 4, x + 40, 12);
    ctx.lineTo(160, 30);
    ctx.lineTo(0, 30);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 4, 30, [[0, 'rgba(150,190,190,.5)'], [0.4, 'rgba(100,150,150,.18)'], [1, 'rgba(100,150,150,0)']]);
    ctx.fill();
  });
  tex(scene, 'glow', 128, 128, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 64, 64, 0, 64, [[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 128, 128);
  });
  // Druckwelle aus Staub und Steinen (Brüllen/Stampfen der großen Räuber), läuft nach rechts
  tex(scene, 'pr_wave', 96, 64, (ctx) => {
    const r = mulberry32(77);
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = 20 + t * 56, y = 40 - Math.sin(t * Math.PI) * 18 + r() * 6;
      ell(ctx, x, y, 10 + r() * 10, 7 + r() * 8);
      ctx.fillStyle = `rgba(${110 + r() * 40},${90 + r() * 30},${70 + r() * 20},${0.25 + t * 0.35})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(70, 8);
    ctx.quadraticCurveTo(96, 34, 74, 60);
    ctx.strokeStyle = 'rgba(230,210,180,.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      ell(ctx, 50 + r() * 40, 18 + r() * 40, 1.5 + r() * 2.5, 1.5 + r() * 2);
      ctx.fillStyle = 'rgba(40,30,22,.9)';
      ctx.fill();
    }
  });
  // Glühender Brocken (Meteoritenregen)
  tex(scene, 'fireball', 48, 48, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 24, 24, 2, 24, [[0, 'rgba(255,240,190,1)'], [0.35, 'rgba(255,150,50,.95)'], [0.7, 'rgba(160,40,10,.5)'], [1, 'rgba(60,10,0,0)']]);
    ctx.fillRect(0, 0, 48, 48);
    blob(ctx, mulberry32(5), 24, 24, 9, 8, 8);
    ctx.fillStyle = 'rgba(40,16,8,.85)';
    ctx.fill();
    blob(ctx, mulberry32(6), 22, 22, 5, 4, 7);
    ctx.fillStyle = 'rgba(255,170,60,.9)';
    ctx.fill();
  });
  tex(scene, 'pedestal', 220, 60, (ctx) => {
    blob(ctx, mulberry32(9), 110, 34, 100, 18, 12);
    fillStroke(ctx, vgrad(ctx, 12, 56, [[0, '#2a2620'], [1, '#0c0a08']]), '#050403', 2);
    ctx.save();
    ctx.clip(); // nur innerhalb der Form färben
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.5);
    ctx.fillRect(0, 0, 220, 60);
    ctx.restore();
  });
}

export const THEME_TINT: Record<Theme, number> = {
  ozean: 0xa8d8d0,
  sumpf: 0xb8d890,
  reptil: 0xff9a50,
  eis: 0xe8eef4,
  eden: 0xffe0a0,
};

export const mixTint = (a: number, b: number, t: number) => mix(a, b, t);
