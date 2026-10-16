import Phaser from 'phaser';
import type { Theme } from '../data/eras';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, fillStroke, rgrad, rrect, smooth, tex, vgrad, wrapX } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';
import { W, H } from '../config';

// ---------------------------------------------------------------------------
// Hilfen

/** Zeichnet ein Element so, dass die Textur in x und y nahtlos kachelt. */
function tile9(w: number, h: number, fn: (dx: number, dy: number) => void) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy);
}

function blob(ctx: Ctx, r: Rng, x: number, y: number, rx: number, ry: number, n = 9) {
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + r() * 0.4;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  smooth(ctx, pts, true);
}

/** Hügelkette als Silhouette (kachelbar). */
function hills(ctx: Ctx, r: Rng, base: number, amp: number, n: number, color: string) {
  const pts: number[][] = [];
  const step = W / n;
  const ys: number[] = [];
  for (let i = 0; i < n; i++) ys.push(base - r() * amp);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let i = 0; i <= n; i++) pts.push([i * step, ys[i % n]]);
  ctx.lineTo(0, ys[0]);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ctx.quadraticCurveTo(x0 + step / 2, Math.min(y0, y1) - amp * 0.15, x1, y1);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Level-Hintergründe (zwei Ebenen für Parallax)

export type BgVariant = 'normal' | 'dark' | 'cave';

function farBg(ctx: Ctx, theme: Theme, v: BgVariant) {
  const r = mulberry32(theme.length * 99 + v.length);
  if (v === 'cave') {
    const warm = theme === 'sumpf';
    ctx.fillStyle = vgrad(ctx, 0, H, warm ? [[0, '#2e2418'], [1, '#0e0a06']] : [[0, '#1e3a5a'], [1, '#081422']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = r() * W, len = 40 + r() * 140, w = 14 + r() * 30;
      wrapX(W, x, w, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, 0);
        ctx.lineTo(xx, len);
        ctx.lineTo(xx + w / 2, 0);
        ctx.closePath();
        ctx.fillStyle = warm ? 'rgba(70,52,36,.7)' : 'rgba(90,140,190,.35)';
        ctx.fill();
      });
    }
    for (let i = 0; i < 60; i++) {
      ell(ctx, r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
      ctx.fillStyle = warm ? `rgba(180,255,120,${0.2 + r() * 0.4})` : `rgba(160,230,255,${0.2 + r() * 0.4})`;
      ctx.fill();
    }
    return;
  }
  switch (theme) {
    case 'ozean': {
      const dark = v === 'dark';
      ctx.fillStyle = vgrad(ctx, 0, H, dark ? [[0, '#0f3a5e'], [1, '#03101e']] : [[0, '#46b4e6'], [0.5, '#1c74ae'], [1, '#0b2f55']]);
      ctx.fillRect(0, 0, W, H);
      if (!dark) {
        for (let i = 0; i < 8; i++) {
          const x = r() * W, w = 30 + r() * 60;
          wrapX(W, x, 260, (xx) => {
            ctx.beginPath();
            ctx.moveTo(xx - w / 2, 0);
            ctx.lineTo(xx + w / 2, 0);
            ctx.lineTo(xx + w / 2 + 220, H);
            ctx.lineTo(xx - w / 2 + 130, H);
            ctx.closePath();
            ctx.fillStyle = `rgba(255,255,255,${0.035 + r() * 0.04})`;
            ctx.fill();
          });
        }
      } else {
        for (let i = 0; i < 90; i++) {
          ell(ctx, r() * W, r() * H, 1 + r() * 1.8, 1 + r() * 1.8);
          ctx.fillStyle = `rgba(120,255,230,${0.15 + r() * 0.5})`;
          ctx.fill();
        }
      }
      hills(ctx, r, H - 90, 160, 7, dark ? 'rgba(4,20,36,.9)' : 'rgba(18,63,102,.75)');
      for (let i = 0; i < 18; i++) {
        const x = r() * W, y = 150 + r() * 300;
        wrapX(W, x, 10, (xx) => {
          ell(ctx, xx, y, 7, 3);
          ctx.fillStyle = dark ? 'rgba(0,0,0,.25)' : 'rgba(10,40,70,.22)';
          ctx.fill();
        });
      }
      break;
    }
    case 'sumpf': {
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#a9cc8c'], [0.65, '#efe2a8'], [1, '#c8c890']]);
      ctx.fillRect(0, 0, W, H);
      hills(ctx, r, H - 160, 90, 6, 'rgba(120,150,110,.55)');
      for (let i = 0; i < 9; i++) {
        const x = r() * W, ht = 280 + r() * 260, w = 14 + r() * 12;
        wrapX(W, x, 90, (xx) => {
          ctx.fillStyle = 'rgba(92,120,84,.75)';
          ctx.fillRect(xx - w / 2, H - ht, w, ht);
          for (let k = 0; k < 5; k++) {
            ell(ctx, xx + (k - 2) * 18, H - ht - 10 + Math.abs(k - 2) * 8, 26, 16, (k - 2) * 0.4);
            ctx.fill();
          }
        });
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255,255,240,.18)';
        ctx.fillRect(0, H - 260 + i * 50, W, 22);
      }
      break;
    }
    case 'reptil': {
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#ff9e6a'], [0.6, '#ffe2a8'], [1, '#f6c890']]);
      ctx.fillRect(0, 0, W, H);
      ell(ctx, 900, 170, 70, 70);
      ctx.fillStyle = rgrad(ctx, 900, 170, 20, 160, [[0, 'rgba(255,250,210,1)'], [0.4, 'rgba(255,240,180,.6)'], [1, 'rgba(255,220,150,0)']]);
      ctx.fillRect(700, 0, 400, 380);
      hills(ctx, r, H - 220, 120, 5, 'rgba(160,100,120,.5)');
      for (const [x, s] of [[300, 1], [820, 0.75]]) {
        wrapX(W, x, 320, (xx) => {
          ctx.beginPath();
          ctx.moveTo(xx - 300 * s, H - 120);
          ctx.lineTo(xx - 50 * s, H - 120 - 330 * s);
          ctx.lineTo(xx + 50 * s, H - 120 - 330 * s);
          ctx.lineTo(xx + 300 * s, H - 120);
          ctx.closePath();
          ctx.fillStyle = 'rgba(120,70,80,.85)';
          ctx.fill();
          ell(ctx, xx, H - 120 - 330 * s, 50 * s, 10 * s);
          ctx.fillStyle = 'rgba(255,120,40,.8)';
          ctx.fill();
          for (let k = 0; k < 5; k++) {
            ell(ctx, xx + k * 30 * s, H - 150 - 330 * s - k * 45 * s, (30 + k * 12) * s, (22 + k * 8) * s);
            ctx.fillStyle = `rgba(110,100,110,${0.45 - k * 0.07})`;
            ctx.fill();
          }
        });
      }
      hills(ctx, r, H - 70, 60, 8, 'rgba(140,90,70,.6)');
      break;
    }
    case 'eis': {
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#7fbfe8'], [0.7, '#e8f6ff'], [1, '#d8ecf8']]);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) {
          const y = 70 + i * 40 + Math.sin((x / W) * Math.PI * 4 + i) * 25;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = i % 2 ? 'rgba(120,255,200,.22)' : 'rgba(120,220,255,.25)';
        ctx.lineWidth = 26;
        ctx.stroke();
      }
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
      peaks(H - 120, 330, 4, 'rgba(150,180,215,.8)', 'rgba(255,255,255,.95)');
      peaks(H - 40, 220, 6, 'rgba(190,215,240,.9)', 'rgba(255,255,255,.95)');
      break;
    }
    case 'eden': {
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#ffc98a'], [0.55, '#fff4d6'], [1, '#e8f4c0']]);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = rgrad(ctx, 640, 260, 30, 420, [[0, 'rgba(255,255,230,1)'], [0.3, 'rgba(255,240,180,.5)'], [1, 'rgba(255,230,160,0)']]);
      ctx.fillRect(0, 0, W, H);
      hills(ctx, r, H - 200, 100, 5, 'rgba(160,210,140,.7)');
      hills(ctx, r, H - 110, 80, 7, 'rgba(120,190,100,.8)');
      for (let i = 0; i < 50; i++) {
        ell(ctx, r() * W, r() * H * 0.7, 1.5 + r() * 2, 1.5 + r() * 2);
        ctx.fillStyle = `rgba(255,255,220,${0.3 + r() * 0.5})`;
        ctx.fill();
      }
      break;
    }
  }
}

function midBg(ctx: Ctx, theme: Theme, v: BgVariant) {
  const r = mulberry32(theme.length * 7 + 3 + v.length);
  if (v === 'cave') {
    const col = theme === 'sumpf' ? 'rgba(40,30,20,.85)' : 'rgba(20,40,64,.85)';
    for (let i = 0; i < 14; i++) {
      const x = r() * W, ht = 60 + r() * 160, w = 30 + r() * 40;
      wrapX(W, x, w, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - w / 2, H);
        ctx.lineTo(xx, H - ht);
        ctx.lineTo(xx + w / 2, H);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      });
    }
    return;
  }
  switch (theme) {
    case 'ozean': {
      const col = v === 'dark' ? 'rgba(2,14,26,.8)' : 'rgba(12,70,96,.6)';
      for (let i = 0; i < 16; i++) {
        const x = r() * W, ht = 160 + r() * 300;
        wrapX(W, x, 40, (xx) => {
          ctx.beginPath();
          ctx.moveTo(xx, H);
          for (let y = H; y > H - ht; y -= 20) ctx.lineTo(xx + Math.sin(y * 0.03 + i) * 10, y);
          ctx.strokeStyle = col;
          ctx.lineWidth = 9;
          ctx.stroke();
        });
      }
      hills(ctx, r, H - 30, 70, 9, v === 'dark' ? 'rgba(2,10,20,.95)' : 'rgba(10,52,82,.85)');
      break;
    }
    case 'sumpf': {
      for (let i = 0; i < 14; i++) {
        const x = r() * W, s = 0.7 + r() * 0.7;
        wrapX(W, x, 90, (xx) => {
          for (let k = 0; k < 7; k++) {
            const a = -Math.PI / 2 + (k - 3) * 0.35;
            ctx.beginPath();
            ctx.moveTo(xx, H - 40);
            ctx.quadraticCurveTo(xx + Math.cos(a) * 60 * s, H - 40 + Math.sin(a) * 90 * s, xx + Math.cos(a) * 95 * s, H - 40 + Math.sin(a) * 70 * s);
            ctx.strokeStyle = 'rgba(50,80,40,.75)';
            ctx.lineWidth = 9 * s;
            ctx.stroke();
          }
        });
      }
      hills(ctx, r, H - 20, 40, 9, 'rgba(50,70,40,.85)');
      break;
    }
    case 'reptil': {
      for (let i = 0; i < 9; i++) {
        const x = r() * W, ht = 160 + r() * 140;
        wrapX(W, x, 90, (xx) => {
          ctx.strokeStyle = 'rgba(90,70,50,.8)';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(xx, H);
          ctx.quadraticCurveTo(xx + 15, H - ht / 2, xx + 5, H - ht);
          ctx.stroke();
          for (let k = 0; k < 7; k++) {
            const a = -Math.PI / 2 + (k - 3) * 0.45;
            ctx.beginPath();
            ctx.moveTo(xx + 5, H - ht);
            ctx.quadraticCurveTo(xx + 5 + Math.cos(a) * 50, H - ht + Math.sin(a) * 40, xx + 5 + Math.cos(a) * 80, H - ht + Math.sin(a) * 10 + 30);
            ctx.strokeStyle = 'rgba(70,90,50,.8)';
            ctx.lineWidth = 7;
            ctx.stroke();
          }
        });
      }
      hills(ctx, r, H - 20, 40, 8, 'rgba(100,70,50,.85)');
      break;
    }
    case 'eis': {
      for (let i = 0; i < 16; i++) {
        const x = r() * W, ht = 90 + r() * 120;
        wrapX(W, x, 50, (xx) => {
          for (let k = 0; k < 4; k++) {
            const y = H - 30 - k * ht * 0.22, w = ht * (0.45 - k * 0.08);
            ctx.beginPath();
            ctx.moveTo(xx - w, y);
            ctx.lineTo(xx, y - ht * 0.38);
            ctx.lineTo(xx + w, y);
            ctx.closePath();
            ctx.fillStyle = 'rgba(80,120,150,.7)';
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(xx - w * 0.6, y - ht * 0.1);
            ctx.lineTo(xx, y - ht * 0.38);
            ctx.lineTo(xx + w * 0.6, y - ht * 0.1);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            ctx.fill();
          }
        });
      }
      hills(ctx, r, H - 15, 30, 9, 'rgba(230,242,252,.95)');
      break;
    }
    case 'eden': {
      for (let i = 0; i < 8; i++) {
        const x = r() * W, ht = 160 + r() * 120;
        wrapX(W, x, 110, (xx) => {
          ctx.fillStyle = 'rgba(110,80,50,.7)';
          ctx.fillRect(xx - 8, H - ht, 16, ht);
          for (let k = 0; k < 6; k++) {
            ell(ctx, xx + Math.cos(k) * 45, H - ht - 20 + Math.sin(k * 2) * 25, 55, 42);
            ctx.fillStyle = k % 2 ? 'rgba(90,170,80,.8)' : 'rgba(110,190,90,.8)';
            ctx.fill();
          }
        });
      }
      hills(ctx, r, H - 20, 40, 9, 'rgba(90,160,70,.9)');
      break;
    }
  }
}

export function levelBackgrounds(scene: Phaser.Scene, theme: Theme, v: BgVariant): [string, string] {
  const far = tex(scene, `bgf_${theme}_${v}`, W, H, (ctx) => farBg(ctx, theme, v));
  const mid = tex(scene, `bgm_${theme}_${v}`, W, H, (ctx) => midBg(ctx, theme, v));
  return [far, mid];
}

// ---------------------------------------------------------------------------
// Boden, Plattformen, Fallen

interface GroundStyle {
  fill: number;
  speck: number;
  top: number;
  plat: number;
}

const GROUND: Record<Theme, GroundStyle> = {
  ozean: { fill: 0x3c5470, speck: 0x5a7590, top: 0xdcc890, plat: 0x56708a },
  sumpf: { fill: 0x4a3a28, speck: 0x6a5238, top: 0x5f8a2e, plat: 0x7a5434 },
  reptil: { fill: 0x8a4a30, speck: 0xa86040, top: 0xa0a040, plat: 0x9a6a50 },
  eis: { fill: 0x8fbadc, speck: 0xc8e2f4, top: 0xf6fbff, plat: 0xb8e0f6 },
  eden: { fill: 0x6b4a2e, speck: 0x8a6440, top: 0x5cc040, plat: 0x8a8a7a },
};

export function groundTextures(scene: Phaser.Scene, theme: Theme) {
  const g = GROUND[theme];
  const gnd = tex(scene, `gnd_${theme}`, 80, 80, (ctx) => {
    ctx.fillStyle = css(g.fill);
    ctx.fillRect(0, 0, 80, 80);
    const r = mulberry32(theme.length);
    for (let i = 0; i < 26; i++) {
      const x = r() * 80, y = r() * 80, rx = 2 + r() * 6, ry = 2 + r() * 4;
      const c = r() > 0.5 ? shade(g.speck, (r() - 0.5) * 0.2) : shade(g.fill, -0.18);
      tile9(80, 80, (dx, dy) => {
        ell(ctx, x + dx, y + dy, rx, ry);
        ctx.fillStyle = css(c, 0.8);
        ctx.fill();
      });
    }
    if (theme === 'reptil' || theme === 'ozean') {
      ctx.strokeStyle = css(shade(g.fill, -0.3), 0.6);
      ctx.lineWidth = 2;
      for (const y of [22, 58]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(25, y - 6, 55, y + 6, 80, y);
        ctx.stroke();
      }
    }
    if (theme === 'eis') {
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = r() * 80, y = r() * 80;
        tile9(80, 80, (dx, dy) => {
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + 12, y + dy + 8);
          ctx.stroke();
        });
      }
    }
  });
  const top = tex(scene, `top_${theme}`, 80, 26, (ctx) => {
    const r = mulberry32(theme.length * 3);
    ctx.fillStyle = css(g.top);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    for (let x = 0; x <= 80; x += 10) ctx.quadraticCurveTo(x + 5, 6 + (x % 20 ? 2 : -1), x + 10, 10);
    ctx.lineTo(80, 18);
    for (let x = 80; x >= 0; x -= 8) ctx.lineTo(x, 18 + (x % 16 ? 6 : 2));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(shade(g.top, 0.25));
    ctx.fillRect(0, 8, 80, 3);
    if (theme === 'sumpf' || theme === 'reptil' || theme === 'eden') {
      for (let i = 0; i < 16; i++) {
        const x = (i / 16) * 80 + r() * 4;
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x + 1 + r() * 2, 0 + r() * 4);
        ctx.lineTo(x + 3, 10);
        ctx.closePath();
        ctx.fillStyle = css(shade(g.top, (r() - 0.3) * 0.3));
        ctx.fill();
      }
    }
    if (theme === 'eden') {
      for (let i = 0; i < 4; i++) {
        ell(ctx, 8 + i * 20 + r() * 6, 6, 2.5, 2.5);
        ctx.fillStyle = ['#ff6a8a', '#ffe14a', '#ffffff', '#b07aff'][i];
        ctx.fill();
      }
    }
    if (theme === 'ozean') {
      for (let i = 0; i < 10; i++) {
        ell(ctx, r() * 80, 12 + r() * 8, 1.2, 1);
        ctx.fillStyle = 'rgba(120,100,60,.6)';
        ctx.fill();
      }
    }
    if (theme === 'eis') {
      ctx.fillStyle = 'rgba(150,200,240,.6)';
      ctx.fillRect(0, 16, 80, 2);
    }
  });
  const plat = tex(scene, `plat_${theme}`, 80, 22, (ctx) => {
    if (theme === 'sumpf') {
      rrect(ctx, 0, 2, 80, 18, 8);
      fillStroke(ctx, vgrad(ctx, 2, 20, [[0, '#9a6a44'], [1, '#5a3a22']]), '#3a2414', 2);
      ctx.strokeStyle = 'rgba(40,24,12,.5)';
      ctx.lineWidth = 1.5;
      for (let x = 8; x < 80; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x + 8, 7);
        ctx.stroke();
      }
      ctx.fillStyle = '#5f8a2e';
      ctx.fillRect(10, 2, 20, 3);
      ctx.fillRect(50, 2, 14, 3);
      return;
    }
    if (theme === 'eis') {
      rrect(ctx, 0, 2, 80, 18, 5);
      fillStroke(ctx, vgrad(ctx, 2, 20, [[0, 'rgba(235,250,255,.95)'], [1, 'rgba(140,200,235,.9)']]), '#5a8ab0', 2);
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.moveTo(8, 7);
      ctx.lineTo(30, 7);
      ctx.stroke();
      return;
    }
    rrect(ctx, 0, 2, 80, 18, 6);
    fillStroke(ctx, vgrad(ctx, 2, 20, [[0, css(shade(g.plat, 0.15))], [1, css(shade(g.plat, -0.25))]]), css(shade(g.plat, -0.55)), 2);
    ctx.fillStyle = css(theme === 'eden' ? 0x5cc040 : theme === 'ozean' ? 0x4f9a5a : 0xa0a040, 0.9);
    ctx.fillRect(4, 2, 72, 4);
  });
  const hz = tex(scene, `hz_${theme}`, 80, 40, (ctx) => {
    const r = mulberry32(5);
    switch (theme) {
      case 'reptil': {
        ctx.fillStyle = vgrad(ctx, 8, 40, [[0, '#ffe36a'], [0.3, '#ff9a2a'], [1, '#c8381a']]);
        ctx.beginPath();
        ctx.moveTo(0, 10);
        for (let x = 0; x <= 80; x += 10) ctx.quadraticCurveTo(x + 5, 4, x + 10, 10);
        ctx.lineTo(80, 40);
        ctx.lineTo(0, 40);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          ell(ctx, r() * 80, 16 + r() * 20, 3 + r() * 4, 2 + r() * 2);
          ctx.fillStyle = 'rgba(120,30,10,.5)';
          ctx.fill();
        }
        break;
      }
      case 'ozean': {
        for (const x of [20, 60]) {
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(x, 28);
            ctx.lineTo(x + Math.cos(a) * 18, 28 + Math.sin(a) * 18);
            ctx.strokeStyle = '#2a1238';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ell(ctx, x, 30, 12, 10);
          fillStroke(ctx, rgrad(ctx, x - 3, 26, 1, 14, [[0, '#9a5ac0'], [1, '#3a1a50']]), '#1a0a24', 1.5);
        }
        break;
      }
      default: {
        const col = theme === 'sumpf' ? ['#5a3a2a', '#3a2418'] : theme === 'eis' ? ['#f0faff', '#7ab0d8'] : ['#e0b0ff', '#6a3ab0'];
        for (let i = 0; i < 7; i++) {
          const x = 6 + i * 11.5, ht = 20 + (i % 3) * 8;
          ctx.beginPath();
          ctx.moveTo(x - 6, 40);
          ctx.lineTo(x, 40 - ht);
          ctx.lineTo(x + 6, 40);
          ctx.closePath();
          fillStroke(ctx, vgrad(ctx, 40 - ht, 40, [[0, col[0]], [1, col[1]]]), 'rgba(0,0,0,.4)', 1.2);
        }
        if (theme === 'sumpf') {
          ctx.strokeStyle = '#3f5a22';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 34);
          ctx.bezierCurveTo(20, 24, 40, 40, 80, 30);
          ctx.stroke();
        }
      }
    }
  });
  if (theme === 'reptil') {
    tex(scene, 'spk_reptil', 80, 40, (ctx) => {
      for (let i = 0; i < 7; i++) {
        const x = 6 + i * 11.5, ht = 18 + (i % 3) * 7;
        ctx.beginPath();
        ctx.moveTo(x - 6, 40);
        ctx.lineTo(x - 1, 40 - ht);
        ctx.lineTo(x + 6, 40);
        ctx.closePath();
        fillStroke(ctx, vgrad(ctx, 40 - ht, 40, [[0, '#6a5a7a'], [0.5, '#2a2030'], [1, '#ff6a2a']]), '#120a10', 1.2);
      }
    });
  }
  return { gnd, top, plat, hz };
}

// ---------------------------------------------------------------------------
// Pflanzen & Deko (Ursprung unten Mitte)

export const DECOR: Record<Theme, string[]> = {
  ozean: ['seaweed', 'seaweed', 'coral_a', 'coral_b', 'rock', 'anemone', 'shell'],
  sumpf: ['fern', 'fern', 'horsetail', 'mushroom', 'reed'],
  reptil: ['cycad', 'fernr', 'boulder', 'bones', 'fernr'],
  eis: ['pine', 'icecr', 'snowbush', 'snowbush'],
  eden: ['flower_a', 'flower_b', 'flower_c', 'bush', 'tree', 'flower_a'],
};

export function decorTextures(scene: Phaser.Scene) {
  const T = (k: string, w: number, h: number, fn: (ctx: Ctx, w: number, h: number) => void) => tex(scene, 'd_' + k, w, h, fn);
  T('seaweed', 30, 90, (ctx, w, h) => {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + (k - 1) * 6, h);
      for (let y = h; y > 10 + k * 12; y -= 8) ctx.lineTo(w / 2 + (k - 1) * 6 + Math.sin(y * 0.15 + k) * 5, y);
      ctx.strokeStyle = ['#2f8a4a', '#4aa85a', '#23703a'][k];
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  });
  T('kelp', 50, 300, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    for (let y = h; y > 0; y -= 10) ctx.lineTo(w / 2 + Math.sin(y * 0.04) * 8, y);
    ctx.strokeStyle = '#6a5a2a';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let y = h - 20; y > 10; y -= 22) {
      const x = w / 2 + Math.sin(y * 0.04) * 8;
      ell(ctx, x + 10, y, 12, 5, 0.5);
      ctx.fillStyle = '#8a7a2a';
      ctx.fill();
      ell(ctx, x - 10, y - 10, 12, 5, -0.5);
      ctx.fillStyle = '#7a6a24';
      ctx.fill();
      ell(ctx, x + 3, y - 2, 3, 3);
      ctx.fillStyle = '#c0a840';
      ctx.fill();
    }
  });
  T('coral_a', 80, 60, (ctx, w, h) => {
    const branch = (x: number, y: number, a: number, len: number, d: number) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#ff6a8a';
      ctx.lineWidth = 7 - d * 1.5;
      ctx.stroke();
      if (d < 3) {
        branch(x2, y2, a - 0.45, len * 0.75, d + 1);
        branch(x2, y2, a + 0.45, len * 0.75, d + 1);
      } else {
        ell(ctx, x2, y2, 3, 3);
        ctx.fillStyle = '#ffc0d0';
        ctx.fill();
      }
    };
    branch(w / 2, h, -Math.PI / 2, 20, 0);
  });
  T('coral_b', 64, 50, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.quadraticCurveTo(0, h * 0.4, w * 0.15, 6);
    ctx.quadraticCurveTo(w / 2, -4, w * 0.85, 6);
    ctx.quadraticCurveTo(w, h * 0.4, w / 2, h);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#ffb04a'], [1, '#e0602a']]), '#8a3a10', 2);
    ctx.strokeStyle = 'rgba(140,60,20,.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h);
      ctx.lineTo(w * 0.1 + i * w * 0.13, 8);
      ctx.stroke();
    }
  });
  T('rock', 64, 36, (ctx, w, h) => {
    blob(ctx, mulberry32(3), w / 2, h * 0.65, w * 0.45, h * 0.45);
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#7a8aa0'], [1, '#3a4658']]), '#232b38', 2);
  });
  T('anemone', 34, 30, (ctx, w, h) => {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + 0.3 + (i / 8) * (Math.PI - 0.6);
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 8);
      ctx.quadraticCurveTo(w / 2 + Math.cos(a) * 10, h - 8 + Math.sin(a) * 18, w / 2 + Math.cos(a) * 15, h - 8 + Math.sin(a) * 18);
      ctx.strokeStyle = '#ff7ab8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ell(ctx, w / 2, h - 5, 9, 6);
    fillStroke(ctx, '#c03a7a', '#7a1a4a', 1.5);
  });
  T('shell', 20, 14, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(2, h);
    ctx.quadraticCurveTo(w / 2, -4, w - 2, h);
    ctx.closePath();
    fillStroke(ctx, '#ffe0c0', '#a07050', 1.2);
  });
  T('fern', 90, 60, (ctx, w, h) => {
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32;
      const ex = w / 2 + Math.cos(a) * 44, ey = h + Math.sin(a) * 56;
      ctx.beginPath();
      ctx.moveTo(w / 2, h);
      ctx.quadraticCurveTo(w / 2 + Math.cos(a) * 30, h + Math.sin(a) * 60, ex, ey + 10);
      ctx.strokeStyle = '#2f6a24';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const x = w / 2 + (ex - w / 2) * t, y = h + (ey + 10 - h) * t - Math.sin(t * Math.PI) * 10;
        ell(ctx, x, y, 6 * (1 - t * 0.6), 2.4, a + Math.PI / 2);
        ctx.fillStyle = k % 2 ? '#4a8a30' : '#3a7a28';
        ctx.fill();
      }
    }
  });
  T('fernr', 90, 60, (ctx, w, h) => {
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(w / 2, h);
      ctx.quadraticCurveTo(w / 2 + Math.cos(a) * 30, h + Math.sin(a) * 60, w / 2 + Math.cos(a) * 44, h + Math.sin(a) * 50);
      ctx.strokeStyle = '#7a8a2a';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  });
  T('horsetail', 30, 130, (ctx, w, h) => {
    for (let y = h; y > 8; y -= 14) {
      ctx.fillStyle = '#5a7a3a';
      ctx.fillRect(w / 2 - 4, y - 14, 8, 13);
      ctx.fillStyle = '#2a3a1a';
      ctx.fillRect(w / 2 - 5, y - 2, 10, 2);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2, y - 2);
        ctx.lineTo(w / 2 + s * 12, y + 4);
        ctx.strokeStyle = '#4a6a2a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ell(ctx, w / 2, 8, 5, 9);
    ctx.fillStyle = '#7a6a3a';
    ctx.fill();
  });
  T('mushroom', 30, 30, (ctx, w, h) => {
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(w / 2 - 3, h - 14, 6, 14);
    ctx.beginPath();
    ctx.arc(w / 2, h - 12, 12, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, '#c0502a', '#6a2410', 1.5);
    for (const [x, y] of [[-5, -16], [4, -18], [0, -21]]) {
      ell(ctx, w / 2 + x, h + y, 2, 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  });
  T('reed', 26, 76, (ctx, w, h) => {
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + (k - 1.5) * 3, h);
      ctx.quadraticCurveTo(w / 2 + (k - 1.5) * 6, h / 2, w / 2 + (k - 1.5) * 8, 10 + k * 6);
      ctx.strokeStyle = '#6a8a3a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ell(ctx, w / 2 + 3, 12, 3, 9);
    ctx.fillStyle = '#6a4a2a';
    ctx.fill();
  });
  T('cycad', 100, 110, (ctx, w, h) => {
    ctx.fillStyle = '#7a5a34';
    for (let y = h; y > 50; y -= 8) {
      ctx.fillRect(w / 2 - 9, y - 8, 18, 7);
    }
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.36;
      ctx.beginPath();
      ctx.moveTo(w / 2, 52);
      ctx.quadraticCurveTo(w / 2 + Math.cos(a) * 30, 52 + Math.sin(a) * 50, w / 2 + Math.cos(a) * 50, 52 + Math.sin(a) * 30 + 20);
      ctx.strokeStyle = k % 2 ? '#4a7a2a' : '#5a8a32';
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  });
  T('boulder', 60, 40, (ctx, w, h) => {
    blob(ctx, mulberry32(8), w / 2, h * 0.6, w * 0.45, h * 0.5);
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#b08060'], [1, '#6a4030']]), '#3a2418', 2);
  });
  T('bones', 56, 22, (ctx, w, h) => {
    ctx.strokeStyle = '#f0e6d0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, h - 6);
    ctx.lineTo(w - 10, h - 10);
    ctx.stroke();
    for (const x of [6, w - 10]) {
      ell(ctx, x, h - 8, 4, 4);
      ctx.fillStyle = '#f0e6d0';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(w / 2, h, 10, Math.PI, Math.PI * 1.9);
    ctx.stroke();
  });
  T('pine', 80, 130, (ctx, w, h) => {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(w / 2 - 5, h - 20, 10, 20);
    for (let k = 0; k < 4; k++) {
      const y = h - 18 - k * 26, hw = 36 - k * 7;
      ctx.beginPath();
      ctx.moveTo(w / 2 - hw, y);
      ctx.lineTo(w / 2, y - 42);
      ctx.lineTo(w / 2 + hw, y);
      ctx.closePath();
      fillStroke(ctx, '#2f5a3a', '#1a3a24', 1.5);
      ctx.beginPath();
      ctx.moveTo(w / 2 - hw * 0.8, y - 4);
      ctx.lineTo(w / 2, y - 40);
      ctx.lineTo(w / 2 + hw * 0.8, y - 4);
      ctx.lineTo(w / 2 + hw * 0.4, y - 12);
      ctx.lineTo(w / 2, y - 8);
      ctx.lineTo(w / 2 - hw * 0.4, y - 12);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fill();
    }
  });
  T('icecr', 40, 50, (ctx, w, h) => {
    for (const [x, ht, a] of [[w / 2, 44, 0], [w / 2 - 9, 28, -0.4], [w / 2 + 9, 30, 0.35]] as const) {
      ctx.save();
      ctx.translate(x, h);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-5, -ht * 0.75);
      ctx.lineTo(0, -ht);
      ctx.lineTo(5, -ht * 0.75);
      ctx.lineTo(5, 0);
      ctx.closePath();
      fillStroke(ctx, 'rgba(200,240,255,.85)', '#5a8ab0', 1.5);
      ctx.restore();
    }
  });
  T('snowbush', 64, 32, (ctx, _w, h) => {
    for (let i = 0; i < 4; i++) {
      ell(ctx, 12 + i * 13, h - 10 - (i % 2) * 5, 12, 10);
      fillStroke(ctx, '#f6fbff', '#9ab8d0', 1.5);
    }
  });
  for (const [k, col] of [['flower_a', '#ff5a8a'], ['flower_b', '#ffd23a'], ['flower_c', '#9a6aff']] as const) {
    T(k, 22, 34, (ctx, w, h) => {
      ctx.strokeStyle = '#3a8a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2, h);
      ctx.quadraticCurveTo(w / 2 - 3, h / 2, w / 2, 10);
      ctx.stroke();
      ell(ctx, w / 2 - 5, h - 8, 4, 2, -0.5);
      ctx.fillStyle = '#4aa83a';
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ell(ctx, w / 2 + Math.cos(a) * 4.5, 10 + Math.sin(a) * 4.5, 3.6, 3.6);
        ctx.fillStyle = col;
        ctx.fill();
      }
      ell(ctx, w / 2, 10, 2.6, 2.6);
      ctx.fillStyle = '#fff6b0';
      ctx.fill();
    });
  }
  T('bush', 76, 44, (ctx, _w, h) => {
    for (let i = 0; i < 5; i++) {
      ell(ctx, 12 + i * 13, h - 14 - (i % 2) * 8, 14, 13);
      fillStroke(ctx, i % 2 ? '#4aa83a' : '#5cb848', '#2a6a24', 1.5);
    }
    for (let i = 0; i < 5; i++) {
      ell(ctx, 14 + i * 12, h - 20 - (i % 2) * 6, 2.5, 2.5);
      ctx.fillStyle = '#ff7aa0';
      ctx.fill();
    }
  });
  T('tree', 150, 190, (ctx, w, h) => {
    ctx.fillStyle = vgrad(ctx, 80, h, [[0, '#8a5a34'], [1, '#5a3a20']]);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h);
    ctx.lineTo(w / 2 - 7, 90);
    ctx.lineTo(w / 2 + 7, 90);
    ctx.lineTo(w / 2 + 14, h);
    ctx.closePath();
    ctx.fill();
    const r = mulberry32(4);
    for (let i = 0; i < 9; i++) {
      ell(ctx, w / 2 + (r() - 0.5) * 90, 70 + (r() - 0.5) * 70, 34 + r() * 10, 30 + r() * 8);
      fillStroke(ctx, i % 2 ? '#4aa83a' : '#3f9a32', '#2a6a24', 1.5);
    }
    for (let i = 0; i < 8; i++) {
      ell(ctx, w / 2 + (r() - 0.5) * 90, 60 + (r() - 0.5) * 70, 4, 4);
      ctx.fillStyle = '#ff5a5a';
      ctx.fill();
    }
  });
  tex(scene, 'd_stalactite', 34, 80, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(w, 0);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, '#5a4a3a'], [1, '#2a2018']]), '#1a120a', 1.5);
  });
  tex(scene, 'd_stalactite_ice', 34, 80, (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(w, 0);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 0, h, [[0, 'rgba(200,235,255,.95)'], [1, 'rgba(120,180,230,.9)']]), '#4a7aa0', 1.5);
  });
}

// ---------------------------------------------------------------------------
// Weltkarten

export function mapTexture(scene: Phaser.Scene, era: Theme) {
  return tex(scene, `map_${era}`, W, H, (ctx) => {
    const r = mulberry32(era.length * 1234);
    switch (era) {
      case 'ozean': {
        ctx.fillStyle = rgrad(ctx, 640, 360, 50, 900, [[0, '#2a8ac4'], [1, '#0b3156']]);
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = rgrad(ctx, 660, 190, 10, 260, [[0, 'rgba(0,10,30,.75)'], [1, 'rgba(0,10,30,0)']]);
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 160; i++) {
          const x = r() * W, y = r() * H;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 10, y - 6, x + 22, y);
          ctx.strokeStyle = 'rgba(255,255,255,.07)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        for (const [x, y, rx, ry] of [[150, 560, 160, 70], [380, 470, 120, 50], [700, 600, 190, 70], [1150, 560, 150, 110], [250, 200, 90, 50], [1050, 130, 140, 60]]) {
          blob(ctx, r, x, y, rx + 14, ry + 12);
          ctx.fillStyle = 'rgba(120,200,230,.35)';
          ctx.fill();
          blob(ctx, r, x, y, rx, ry);
          fillStroke(ctx, vgrad(ctx, y - ry, y + ry, [[0, '#f0e0a8'], [1, '#c8b078']]), 'rgba(90,70,40,.4)', 2);
        }
        for (let i = 0; i < 70; i++) {
          const x = r() * W, y = 300 + r() * 400;
          ell(ctx, x, y, 5 + r() * 9, 4 + r() * 6);
          ctx.fillStyle = ['#ff6a8a', '#ffa04a', '#c06aff', '#ff4a6a'][i % 4];
          ctx.globalAlpha = 0.75;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        for (let i = 0; i < 12; i++) {
          const cx = r() * W, cy = r() * H;
          for (let k = 0; k < 14; k++) {
            ell(ctx, cx + (r() - 0.5) * 70, cy + (r() - 0.5) * 50, 4, 4);
            ctx.fillStyle = 'rgba(40,110,60,.7)';
            ctx.fill();
          }
        }
        ell(ctx, 960, 350, 80, 60);
        ctx.fillStyle = 'rgba(10,20,30,.55)';
        ctx.fill();
        break;
      }
      case 'sumpf': {
        ctx.fillStyle = '#6b8a45';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 70; i++) {
          blob(ctx, r, r() * W, r() * H, 30 + r() * 60, 20 + r() * 40);
          ctx.fillStyle = r() > 0.5 ? 'rgba(90,120,60,.5)' : 'rgba(120,100,60,.35)';
          ctx.fill();
        }
        for (const pts of [[[-40, 120], [300, 200], [520, 380], [780, 360], [1320, 560]], [[200, 760], [360, 560], [640, 600], [900, 700]]]) {
          for (const [lw, col] of [[46, '#3f6a6a'], [30, '#5a9a98'], [10, 'rgba(200,240,230,.4)']] as const) {
            smooth(ctx, pts, false);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
        for (let i = 0; i < 40; i++) {
          const x = r() * W, y = r() * H;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
            ctx.strokeStyle = 'rgba(40,80,30,.8)';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
        }
        for (let i = 0; i < 14; i++) {
          const x = r() * W, y = r() * H;
          ell(ctx, x, y, 26, 24);
          fillStroke(ctx, rgrad(ctx, x - 6, y - 6, 2, 28, [[0, '#5a9a3a'], [1, '#2f5a22']]), 'rgba(20,40,10,.6)', 2);
        }
        for (let i = 0; i < 10; i++) {
          ell(ctx, r() * W, r() * H, 120, 30);
          ctx.fillStyle = 'rgba(255,255,240,.08)';
          ctx.fill();
        }
        break;
      }
      case 'reptil': {
        ctx.fillStyle = '#c9a065';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 60; i++) {
          blob(ctx, r, r() * W, r() * H, 30 + r() * 70, 20 + r() * 50);
          ctx.fillStyle = r() > 0.5 ? 'rgba(130,150,60,.45)' : 'rgba(160,110,60,.35)';
          ctx.fill();
        }
        const vx = 1150, vy = 110;
        ell(ctx, vx, vy, 190, 150);
        ctx.fillStyle = rgrad(ctx, vx, vy, 20, 190, [[0, '#4a2a2a'], [0.5, '#7a4a3a'], [1, 'rgba(140,90,60,0)']]);
        ctx.fill();
        ell(ctx, vx, vy, 40, 30);
        ctx.fillStyle = rgrad(ctx, vx, vy, 5, 40, [[0, '#ffee88'], [1, '#ff5a1a']]);
        ctx.fill();
        for (const pts of [[[vx - 20, vy + 20], [1000, 220], [900, 260], [760, 240]], [[vx, vy + 30], [1120, 300], [1180, 420], [1240, 560]]]) {
          for (const [lw, col] of [[22, 'rgba(255,90,20,.35)'], [12, '#ff7a20'], [5, '#ffe060']] as const) {
            smooth(ctx, pts, false);
            ctx.strokeStyle = col;
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
        for (let i = 0; i < 30; i++) {
          const x = r() * (W - 300), y = r() * H;
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
            ctx.strokeStyle = 'rgba(60,100,40,.85)';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
        }
        for (let i = 0; i < 25; i++) {
          blob(ctx, r, r() * W, r() * H, 8 + r() * 10, 6 + r() * 8);
          fillStroke(ctx, '#9a8a7a', 'rgba(60,50,40,.6)', 1.5);
        }
        break;
      }
      case 'eis': {
        ctx.fillStyle = '#e9f3fb';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 50; i++) {
          blob(ctx, r, r() * W, r() * H, 40 + r() * 80, 20 + r() * 50);
          ctx.fillStyle = 'rgba(180,210,235,.35)';
          ctx.fill();
        }
        ell(ctx, 700, 360, 150, 80);
        fillStroke(ctx, vgrad(ctx, 280, 440, [[0, '#bfe6fa'], [1, '#8cc8ea']]), 'rgba(80,140,190,.6)', 3);
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(620 + i * 30, 320 + i * 8);
          ctx.lineTo(650 + i * 30, 310 + i * 8);
          ctx.strokeStyle = 'rgba(255,255,255,.8)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        for (let i = 0; i < 22; i++) {
          let x = r() * W, y = r() * H;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += 10 + r() * 20;
            y += (r() - 0.5) * 30;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = 'rgba(80,130,180,.55)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        for (let i = 0; i < 20; i++) {
          const x = r() * W, y = r() * H;
          blob(ctx, r, x, y, 18 + r() * 14, 12 + r() * 10);
          fillStroke(ctx, '#7a8696', 'rgba(40,50,60,.6)', 1.5);
          blob(ctx, r, x - 2, y - 5, 12, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        for (let i = 0; i < 16; i++) {
          const cx = r() * W, cy = r() * H;
          for (let k = 0; k < 5; k++) {
            const x = cx + (r() - 0.5) * 60, y = cy + (r() - 0.5) * 40;
            ctx.beginPath();
            ctx.moveTo(x - 8, y + 8);
            ctx.lineTo(x, y - 12);
            ctx.lineTo(x + 8, y + 8);
            ctx.closePath();
            fillStroke(ctx, '#2f5a3a', 'rgba(255,255,255,.7)', 1.5);
          }
        }
        break;
      }
      case 'eden': {
        ctx.fillStyle = '#7cc85a';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 60; i++) {
          blob(ctx, r, r() * W, r() * H, 40 + r() * 60, 30 + r() * 40);
          ctx.fillStyle = r() > 0.5 ? 'rgba(150,220,110,.45)' : 'rgba(90,170,70,.35)';
          ctx.fill();
        }
        for (const [lw, col] of [[40, '#3a9ac0'], [28, '#5cc0e8'], [8, 'rgba(255,255,255,.5)']] as const) {
          smooth(ctx, [[-30, 600], [250, 560], [420, 640], [700, 600], [1000, 660], [1320, 620]], false);
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.stroke();
        }
        ctx.fillStyle = rgrad(ctx, 1050, 300, 10, 300, [[0, 'rgba(255,250,200,.95)'], [0.4, 'rgba(255,235,150,.45)'], [1, 'rgba(255,230,140,0)']]);
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 500; i++) {
          ell(ctx, r() * W, r() * H, 2, 2);
          ctx.fillStyle = ['#ff6a8a', '#ffe14a', '#ffffff', '#b07aff', '#ff9a4a'][i % 5];
          ctx.fill();
        }
        for (let i = 0; i < 26; i++) {
          const x = r() * W, y = r() * 520;
          ell(ctx, x + 4, y + 6, 26, 20);
          ctx.fillStyle = 'rgba(0,40,0,.25)';
          ctx.fill();
          ell(ctx, x, y, 24, 20);
          fillStroke(ctx, rgrad(ctx, x - 6, y - 6, 2, 26, [[0, '#6ac85a'], [1, '#2f8a32']]), 'rgba(20,60,20,.6)', 1.5);
        }
        break;
      }
    }
    ctx.fillStyle = rgrad(ctx, W / 2, H / 2, 300, 820, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.5)']]);
    ctx.fillRect(0, 0, W, H);
  });
}

// ---------------------------------------------------------------------------
// Allgemeine Texturen: Partikel, Fleisch, Kristalle, Geschosse, Portal …

export function commonTextures(scene: Phaser.Scene) {
  tex(scene, 'p_dot', 16, 16, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 8, 8, 0, 8, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 16, 16);
  });
  tex(scene, 'p_bubble', 16, 16, (ctx) => {
    ell(ctx, 8, 8, 6, 6);
    fillStroke(ctx, 'rgba(255,255,255,.15)', 'rgba(255,255,255,.85)', 1.5);
    ell(ctx, 6, 6, 1.6, 1.6);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  tex(scene, 'p_spark', 20, 20, (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? 3 : 10;
      ctx.lineTo(10 + Math.cos(a) * rr, 10 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  tex(scene, 'p_snow', 10, 10, (ctx) => {
    ell(ctx, 5, 5, 3.5, 3.5);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  tex(scene, 'p_leaf', 12, 8, (ctx) => {
    ell(ctx, 6, 4, 5, 2.5, 0.3);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  tex(scene, 'meat', 38, 26, (ctx) => {
    ctx.save();
    ctx.translate(19, 13);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#f6efe0';
    ctx.fillRect(-16, -2.5, 14, 5);
    for (const dy of [-4, 4]) {
      ell(ctx, -16, dy, 3.6, 3.6);
      fillStroke(ctx, '#f6efe0', '#8a7a62', 1.2);
    }
    ell(ctx, 4, 0, 12, 9);
    fillStroke(ctx, rgrad(ctx, 1, -3, 1, 13, [[0, '#ff8a6a'], [0.6, '#c8402a'], [1, '#8a2414']]), '#5a1408', 1.6);
    ell(ctx, 1, -3, 4, 2.5);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fill();
    ctx.restore();
  });
  tex(scene, 'crystal', 26, 34, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(13, 1);
    ctx.lineTo(24, 10);
    ctx.lineTo(24, 24);
    ctx.lineTo(13, 33);
    ctx.lineTo(2, 24);
    ctx.lineTo(2, 10);
    ctx.closePath();
    const g = ctx.createLinearGradient(2, 0, 24, 34);
    g.addColorStop(0, '#d0fbff');
    g.addColorStop(0.5, '#4ad0ff');
    g.addColorStop(1, '#b04aff');
    fillStroke(ctx, g, '#2a2a7a', 1.8);
    ctx.beginPath();
    ctx.moveTo(13, 1);
    ctx.lineTo(13, 33);
    ctx.moveTo(2, 10);
    ctx.lineTo(24, 24);
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ell(ctx, 9, 9, 2.5, 4, -0.5);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fill();
  });
  tex(scene, 'portal', 140, 140, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 70, 70, 10, 70, [[0, 'rgba(255,255,255,.95)'], [0.35, 'rgba(160,240,255,.7)'], [0.7, 'rgba(120,120,255,.35)'], [1, 'rgba(120,80,255,0)']]);
    ctx.fillRect(0, 0, 140, 140);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 1.4; a += 0.1) {
        const rr = 18 + a * 14;
        const x = 70 + Math.cos(a + i * 1.256) * rr, y = 70 + Math.sin(a + i * 1.256) * rr;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.65)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });
  tex(scene, 'pr_slime', 20, 20, (ctx) => {
    ell(ctx, 10, 10, 8, 7);
    fillStroke(ctx, rgrad(ctx, 8, 7, 1, 9, [[0, '#f0b0ff'], [1, '#a03ac0']]), '#5a1a70', 1.5);
  });
  tex(scene, 'pr_acid', 18, 18, (ctx) => {
    ell(ctx, 9, 9, 7, 6);
    fillStroke(ctx, rgrad(ctx, 7, 7, 1, 8, [[0, '#f8ffb0'], [1, '#8ac020']]), '#3a5a10', 1.5);
  });
  tex(scene, 'pr_rock', 30, 28, (ctx) => {
    blob(ctx, mulberry32(2), 15, 14, 12, 11);
    fillStroke(ctx, vgrad(ctx, 2, 26, [[0, '#a08070'], [1, '#5a4034']]), '#2a1a12', 2);
  });
  tex(scene, 'pr_shard', 16, 30, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.lineTo(14, 12);
    ctx.lineTo(8, 29);
    ctx.lineTo(2, 12);
    ctx.closePath();
    const g = ctx.createLinearGradient(2, 0, 14, 0);
    g.addColorStop(0, '#f0d8ff');
    g.addColorStop(1, '#9a4aff');
    fillStroke(ctx, g, '#4a1a8a', 1.5);
  });
  tex(scene, 'pr_wave', 50, 44, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(4, 44);
    ctx.quadraticCurveTo(10, 2, 46, 44);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 0, 44, [[0, 'rgba(255,240,200,.95)'], [1, 'rgba(200,140,80,.6)']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,30,.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  tex(scene, 'darkness', 512, 512, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 256, 256, 40, 256, [[0, 'rgba(0,6,16,0)'], [0.45, 'rgba(0,6,16,.35)'], [1, 'rgba(0,6,16,.92)']]);
    ctx.fillRect(0, 0, 512, 512);
  });
  tex(scene, 'shadow', 80, 20, (ctx) => {
    ell(ctx, 40, 10, 36, 8);
    ctx.fillStyle = rgrad(ctx, 40, 10, 2, 36, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fill();
  });
  tex(scene, 'surface', 160, 30, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    for (let x = 0; x <= 160; x += 40) ctx.quadraticCurveTo(x + 20, 4, x + 40, 12);
    ctx.lineTo(160, 30);
    ctx.lineTo(0, 30);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 4, 30, [[0, 'rgba(220,250,255,.9)'], [0.4, 'rgba(160,220,250,.35)'], [1, 'rgba(160,220,250,0)']]);
    ctx.fill();
  });
  tex(scene, 'glow', 128, 128, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 64, 64, 0, 64, [[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 128, 128);
  });
  tex(scene, 'pedestal', 220, 60, (ctx) => {
    ell(ctx, 110, 34, 104, 22);
    fillStroke(ctx, vgrad(ctx, 12, 56, [[0, 'rgba(120,220,255,.35)'], [1, 'rgba(40,80,140,.15)']]), 'rgba(160,240,255,.7)', 2);
    ell(ctx, 110, 30, 80, 14);
    ctx.strokeStyle = 'rgba(160,240,255,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

/** Farbe für Partikel und Lichtstimmung je Zeitalter. */
export const THEME_TINT: Record<Theme, number> = {
  ozean: 0x9fe8ff,
  sumpf: 0xd8f0a0,
  reptil: 0xffb070,
  eis: 0xffffff,
  eden: 0xfff0a0,
};

export const groundColor = (t: Theme) => mix(GROUND[t].fill, 0x000000, 0.2);
