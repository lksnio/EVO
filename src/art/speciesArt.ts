import Phaser from 'phaser';
import type { Art, Role, SpeciesDef } from '../data/species';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, newCanvas, rgrad, smooth, trimCanvases } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { eye, ivory, pattern, skin, tooth } from './paint';

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

type P2 = [number, number];

/**
 * Eine Flosse: durchscheinende Haut zwischen Flossenstrahlen. root0/root1 sitzen am Körper,
 * edge ist der freie Rand (von root0 nach root1).
 */
function finMembrane(ctx: Ctx, root0: P2, edge: P2[], root1: P2, col: number, lw: number, spine = false) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(root0[0], root0[1]);
    const pts = [...edge, root1];
    let prev = root0;
    for (let i = 0; i < pts.length - 1; i++) {
      const mid: P2 = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mid[0], mid[1]);
      prev = mid;
    }
    void prev;
    ctx.lineTo(root1[0], root1[1]);
    ctx.closePath();
  };
  const rx = (root0[0] + root1[0]) / 2, ry = (root0[1] + root1[1]) / 2;
  const far = edge[Math.floor(edge.length / 2)];
  path();
  const g = ctx.createLinearGradient(rx, ry, far[0], far[1]);
  g.addColorStop(0, css(col, 0.95));
  g.addColorStop(0.7, css(shade(col, 0.18), 0.6));
  g.addColorStop(1, css(shade(col, 0.3), 0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = css(shade(col, -0.5), 0.42);
  ctx.lineWidth = Math.max(0.5, lw * 0.6);
  const n = Math.max(4, edge.length * 3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = edge[Math.min(edge.length - 1, Math.floor(t * (edge.length - 1)))];
    const b = edge[Math.min(edge.length - 1, Math.ceil(t * (edge.length - 1)))];
    const k = t * (edge.length - 1) - Math.floor(t * (edge.length - 1));
    const ex = a[0] + (b[0] - a[0]) * k, ey = a[1] + (b[1] - a[1]) * k;
    const bx = root0[0] + (root1[0] - root0[0]) * t, by = root0[1] + (root1[1] - root0[1]) * t;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + ex) / 2 + (ey - by) * 0.06, (by + ey) / 2, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
  path();
  ctx.strokeStyle = css(shade(col, -0.55), 0.45);
  ctx.lineWidth = lw * 0.6;
  ctx.stroke();
  if (spine) {
    // kräftiger Stachel an der Vorderkante
    ctx.beginPath();
    ctx.moveTo(root0[0], root0[1]);
    ctx.quadraticCurveTo((root0[0] + edge[0][0]) / 2, (root0[1] + edge[0][1]) / 2 - lw, edge[0][0], edge[0][1]);
    ctx.strokeStyle = css(shade(col, 0.3), 0.7);
    ctx.lineWidth = lw * 0.9;
    ctx.stroke();
  }
}

/** Ein Fisch – stromlinienförmig, mit durchscheinenden Flossen, Kiemendeckel, Seitenlinie und feinen Schuppen. */
function drawFish(ctx: Ctx, p: Extract<Art, { t: 'fish' }>, f: number, E: Eyes) {
  const { len, h, c } = p;
  const hw = len / 2, hh = h / 2;
  const lw = Math.max(0.8, len / 90);
  const sw = (f ? 1 : -1) * 0.15;
  const r = mulberry32(len * 3 + h * 7);
  const D = dark(c);
  const fc = p.fin;
  // Panzerfisch (Dunkleosteus): wuchtiger Panzerkopf, Knochenklingen statt Zähnen, Haischwanz
  const placo = !!(p.armor && p.teeth && !p.arms && !p.eyesFront);
  const bone = placo ? mix(c, 0x7a7e74, 0.55) : mix(c, 0xb4aa92, 0.55);
  const ny = p.shark ? -hh * 0.06 : placo ? hh * 0.18 : p.armor ? hh * 0.08 : hh * 0.04;
  // Fleischflosser: kräftiger Flossenstiel mit einem Fächer aus Flossenstrahlen am Ende
  const lobe = (x: number, y: number, ang: number, L: number, wd: number, fan: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, -wd);
      ctx.quadraticCurveTo(L * 0.6, -wd * 1.05, L, -wd * 0.55);
      ctx.lineTo(L, wd * 0.55);
      ctx.quadraticCurveTo(L * 0.6, wd * 1.05, 0, wd);
      ctx.closePath();
    };
    skin(ctx, path, { base: mix(c, fc, 0.5), y0: -wd, y1: wd, noise: 'mottle', noiseAlpha: 0.3, noiseScale: 0.3, edge: D, edgeW: lw * 0.8, rim: 0.3 });
    finMembrane(ctx, [L * 0.92, -wd * 0.55], [[L * 1.18, -fan * 0.9], [L * 1.5, -fan * 0.35], [L * 1.55, fan * 0.1], [L * 1.3, fan * 0.8]], [L * 0.92, wd * 0.55], fc, lw);
    ctx.restore();
  };

  // ---- Schwanzflosse (hinter dem Körper), schlägt hin und her
  ctx.save();
  ctx.translate(-hw * 0.95, 0);
  ctx.rotate(sw);
  const T = len * (p.eel ? 0.13 : 0.24);
  if (p.eel) {
    // spitz auslaufender Schwanz, kaum abgesetzt
    finMembrane(ctx, [0, -hh * 0.3], [[-T * 0.6, -hh * 0.5], [-T * 1.25, -hh * 0.05], [-T * 0.6, hh * 0.5]], [0, hh * 0.3], fc, lw);
  } else if (p.lobed) {
    // spitz auslaufender Schwanz mit drei Lappen
    finMembrane(ctx, [0, -hh * 0.3], [[-T * 0.5, -hh * 0.62], [-T * 1.05, -hh * 0.22], [-T * 1.3, 0], [-T * 1.05, hh * 0.22], [-T * 0.5, hh * 0.62]], [0, hh * 0.3], fc, lw);
  } else if (p.shark || placo || (p.jawless && !p.armor)) {
    // ungleiche Schwanzflosse: der obere Lappen ist länger
    finMembrane(ctx, [0, -hh * 0.2], [[-T * 0.45, -hh * 0.6], [-T * 1.05, -hh * 1.35], [-T * 0.75, -hh * 0.35], [-T * 0.45, hh * 0.3], [-T * 0.5, hh * 0.75]], [0, hh * 0.2], fc, lw);
  } else {
    finMembrane(ctx, [0, -hh * 0.22], [[-T * 0.5, -hh * 0.75], [-T, -hh * (p.armor ? 1.25 : 1.05)], [-T * 0.62, -hh * 0.1], [-T * 0.62, hh * 0.1], [-T, hh * (p.armor ? 0.95 : 1.05)], [-T * 0.5, hh * 0.75]], [0, hh * 0.22], fc, lw);
  }
  ctx.restore();

  // ---- Rücken- und Afterflossen (hinter dem Körper)
  if (p.eel) {
    // langer Flossensaum über den ganzen Rücken
    finMembrane(ctx, [hw * 0.2, -hh * 0.95], [[hw * 0.0, -hh * 1.5], [-hw * 0.3, -hh * 1.55], [-hw * 0.6, -hh * 1.4], [-hw * 0.85, -hh * 0.95]], [-hw * 0.88, -hh * 0.5], fc, lw);
  } else if (p.shark && p.anvil) {
    // Amboss: eine flache, bezahnte Platte auf einem kurzen Stiel
    ctx.beginPath();
    ctx.moveTo(hw * 0.16, -hh * 0.9);
    ctx.lineTo(hw * 0.14, -hh * 1.45);
    ctx.lineTo(hw * 0.3, -hh * 1.7);
    ctx.lineTo(-hw * 0.3, -hh * 1.78);
    ctx.lineTo(-hw * 0.2, -hh * 1.4);
    ctx.lineTo(-hw * 0.14, -hh * 0.9);
    ctx.closePath();
    ctx.fillStyle = css(shade(c, -0.15));
    ctx.fill();
    ctx.strokeStyle = css(D, 0.8);
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.fillStyle = css(shade(bone, 0.1), 0.9);
    for (let i = 0; i < 6; i++) {
      const x = hw * 0.28 - i * hw * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, -hh * 1.74);
      ctx.lineTo(x - hw * 0.03, -hh * 1.96);
      ctx.lineTo(x - hw * 0.06, -hh * 1.76);
      ctx.closePath();
      ctx.fill();
    }
    finMembrane(ctx, [-hw * 0.45, -hh * 0.62], [[-hw * 0.55, -hh * 1.05], [-hw * 0.62, -hh * 1.25], [-hw * 0.64, -hh * 0.8]], [-hw * 0.62, -hh * 0.52], fc, lw);
  } else if (p.shark) {
    finMembrane(ctx, [hw * 0.2, -hh * 0.92], [[hw * 0.02, -hh * 1.55], [-hw * 0.12, -hh * 1.85], [-hw * 0.14, -hh * 1.2]], [-hw * 0.12, -hh * 0.9], fc, lw, false);
    finMembrane(ctx, [-hw * 0.45, -hh * 0.62], [[-hw * 0.55, -hh * 1.05], [-hw * 0.62, -hh * 1.25], [-hw * 0.64, -hh * 0.8]], [-hw * 0.62, -hh * 0.52], fc, lw);
  } else if (!p.eyesFront && !p.shield && !p.spines) {
    const dh = p.armor ? 1.5 : 1.7;
    finMembrane(ctx, [hw * 0.18, -hh * 0.94], [[hw * 0.05, -hh * 1.4], [-hw * 0.12, -hh * dh], [-hw * 0.32, -hh * 1.3], [-hw * 0.42, -hh * 0.95]], [-hw * 0.42, -hh * 0.7], fc, lw);
  } else if (p.shield) {
    finMembrane(ctx, [-hw * 0.35, -hh * 0.75], [[-hw * 0.45, -hh * 1.2], [-hw * 0.58, -hh * 1.15]], [-hw * 0.6, -hh * 0.55], fc, lw);
  }
  if (p.lobed) finMembrane(ctx, [-hw * 0.5, -hh * 0.55], [[-hw * 0.58, -hh * 1.15], [-hw * 0.72, -hh * 1.3], [-hw * 0.76, -hh * 0.7]], [-hw * 0.76, -hh * 0.4], fc, lw);
  if (!p.eyesFront) finMembrane(ctx, [-hw * 0.42, hh * 0.72], [[-hw * 0.52, hh * 1.2], [-hw * 0.66, hh * 1.2], [-hw * 0.7, hh * 0.85]], [-hw * 0.7, hh * 0.5], fc, lw);
  // Bauchflosse
  if (p.lobed) lobe(-hw * 0.04, hh * 0.78, f ? 2.0 : 2.25, hw * 0.22, hh * 0.17, hh * 0.75);
  else finMembrane(ctx, [-hw * 0.02, hh * 0.92], [[-hw * 0.12, hh * 1.3], [-hw * 0.24, hh * 1.25]], [-hw * 0.22, hh * 0.85], fc, lw);
  // Stachelhai: kräftige Stacheln vor den Flossen
  if (p.spiny) {
    const sp = (x: number, y: number, tx: number, ty: number, wd: number) => {
      ctx.beginPath();
      ctx.moveTo(x - wd, y);
      ctx.lineTo(tx, ty);
      ctx.lineTo(x + wd, y + wd * 0.3);
      ctx.closePath();
      ctx.fillStyle = css(shade(bone, 0.12));
      ctx.fill();
      ctx.strokeStyle = css(shade(c, -0.5), 0.6);
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
    };
    sp(hw * 0.2, -hh * 0.95, -hw * 0.02, -hh * 2.0, hh * 0.13);
    sp(hw * 0.26, hh * 0.7, hw * 0.08, hh * 1.85, hh * 0.11);
    sp(-hw * 0.1, hh * 0.85, -hw * 0.32, hh * 1.75, hh * 0.1);
    sp(-hw * 0.5, hh * 0.72, -hw * 0.64, hh * 1.6, hh * 0.09);
  }

  // ---- Körper
  const top0 = p.armor ? -hh * 0.55 : p.shark ? -hh * 0.5 : -hh * 0.72;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hw, ny);
    if (placo) ctx.bezierCurveTo(hw * 1.05, -hh * 0.85, hw * 0.62, -hh * 1.18, hw * 0.12, -hh * 1.04);
    else ctx.bezierCurveTo(hw * (p.armor ? 1.03 : 0.98), top0, hw * 0.55, -hh * 1.02, hw * 0.12, -hh);
    ctx.bezierCurveTo(-hw * 0.28, -hh * 0.98, -hw * 0.62, -hh * 0.45, -hw * 0.86, -hh * 0.22);
    ctx.lineTo(-hw * 0.97, -hh * 0.18);
    ctx.lineTo(-hw * 0.97, hh * 0.18);
    ctx.lineTo(-hw * 0.86, hh * 0.24);
    ctx.bezierCurveTo(-hw * 0.6, hh * 0.46, -hw * 0.2, hh * 1.04, hw * 0.15, hh);
    ctx.bezierCurveTo(hw * 0.62, hh * 0.95, hw * 0.96, hh * 0.58, hw, ny);
    ctx.closePath();
  };
  skin(ctx, path, {
    base: c, top: shade(c, -0.42), belly: p.belly, bellyBand: [hh * 0.72, hh * 0.55, hw * 0.95, hw * 0.08], y0: -hh, y1: hh,
    noise: 'mottle', noiseAlpha: 0.28, noiseScale: len > 150 ? 0.55 : 0.3, seed: len, wet: true, edge: D, edgeW: lw, rim: 0.32,
    inner: (cx) => {
      // feine Schuppen (mit einem Hauch Glanz)
      if (!p.shark) {
        const step = Math.max(2.4, len / 18);
        for (let row = 0, y = -hh; y < hh; y += step * 0.7, row++) {
          for (let x = -hw; x < hw * 0.5; x += step) {
            cx.beginPath();
            cx.arc(x + (row % 2) * step * 0.5, y, step * 0.55, 0.25 * Math.PI, 0.75 * Math.PI);
            cx.strokeStyle = 'rgba(0,0,0,0.09)';
            cx.lineWidth = 0.6;
            cx.stroke();
            cx.beginPath();
            cx.arc(x + (row % 2) * step * 0.5, y - 0.6, step * 0.5, 0.3 * Math.PI, 0.7 * Math.PI);
            cx.strokeStyle = 'rgba(255,255,240,0.05)';
            cx.stroke();
          }
        }
      }
      if (p.stripes) {
        for (let i = 0; i < 5; i++) {
          const x = hw * 0.35 - i * hw * 0.3;
          const g = cx.createLinearGradient(x - len * 0.04, 0, x + len * 0.04, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.5, css(D, 0.22));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = g;
          cx.fillRect(x - len * 0.04, -hh, len * 0.08, hh * 1.1);
        }
      }
      if (p.spots) {
        for (let i = 0; i < 16; i++) {
          ell(cx, -hw * 0.8 + r() * hw * 1.5, -hh * 0.85 + r() * hh * 1.1, 0.8 + r() * len / 45, 0.7 + r() * len / 55);
          cx.fillStyle = css(D, 0.28);
          cx.fill();
        }
      }
      // Seitenlinie
      cx.beginPath();
      cx.moveTo(hw * 0.42, -hh * 0.18);
      cx.quadraticCurveTo(0, -hh * 0.3, -hw * 0.9, -hh * 0.02);
      cx.strokeStyle = 'rgba(235,230,210,0.22)';
      cx.lineWidth = Math.max(0.6, lw * 0.6);
      cx.stroke();
      // Panzerplatten (Kopf und Brust)
      if (p.armor) {
        const back = p.arms ? -hw * 0.15 : p.eyesFront ? -hw * 0.05 : placo ? hw * 0.06 : hw * 0.12;
        const plate = () => {
          cx.beginPath();
          cx.moveTo(hw + 6, -hh * 1.3);
          cx.lineTo(back + hw * 0.08, -hh * 1.3);
          cx.quadraticCurveTo(back - hw * 0.06, 0, back + hw * 0.08, hh * 1.3);
          cx.lineTo(hw + 6, hh * 1.3);
          cx.closePath();
        };
        plate();
        const pg = cx.createLinearGradient(0, -hh, 0, hh);
        pg.addColorStop(0, css(shade(bone, -0.15)));
        pg.addColorStop(0.5, css(bone));
        pg.addColorStop(1, css(shade(bone, -0.3)));
        cx.fillStyle = pg;
        cx.fill();
        cx.save();
        plate();
        cx.clip();
        cx.globalCompositeOperation = 'multiply';
        cx.globalAlpha = 0.55;
        cx.fillStyle = pattern(cx, 'stone', len > 150 ? 0.5 : 0.28, len, h);
        cx.fillRect(-hw * 2, -hh * 2, len * 2, h * 2);
        cx.restore();
        // Nähte zwischen den Platten und kleine Höcker
        cx.strokeStyle = css(shade(bone, -0.55), 0.55);
        cx.lineWidth = Math.max(0.6, lw * 0.8);
        const seams: [number, number, number, number][] = [[hw * 0.55, -hh, hw * 0.5, hh * 0.25], [back + hw * 0.25, -hh * 0.2, hw * 0.92, -hh * 0.25], [hw * 0.78, -hh * 0.95, hw * 0.8, -hh * 0.3]];
        for (const [x0, y0, x1, y1] of seams) {
          cx.beginPath();
          cx.moveTo(x0, y0);
          cx.quadraticCurveTo((x0 + x1) / 2 + 2, (y0 + y1) / 2, x1, y1);
          cx.stroke();
        }
        for (let i = 0; i < 26; i++) {
          ell(cx, back + hw * 0.15 + r() * (hw * 0.85 - back), -hh + r() * hh * 1.7, lw * 0.6, lw * 0.6);
          cx.fillStyle = css(shade(bone, 0.25), 0.55);
          cx.fill();
        }
        if (placo) {
          // große Platten mit hellen Kanten: Kopfplatte, Wangenplatte, Brustring
          const plateEdge = (pts: P2[]) => {
            cx.beginPath();
            pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
            cx.strokeStyle = 'rgba(0,0,0,0.42)';
            cx.lineWidth = lw * 1.4;
            cx.stroke();
            cx.save();
            cx.translate(0, -lw * 0.9);
            cx.beginPath();
            pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
            cx.strokeStyle = 'rgba(235,235,220,0.28)';
            cx.lineWidth = lw * 0.7;
            cx.stroke();
            cx.restore();
          };
          plateEdge([[hw * 0.36, -hh * 1.1], [hw * 0.42, -hh * 0.5], [hw * 0.98, -hh * 0.32]]);
          plateEdge([[hw * 0.42, -hh * 0.5], [hw * 0.34, hh * 0.35], [hw * 0.52, hh * 0.9]]);
          plateEdge([[hw * 0.24, -hh * 1.05], [hw * 0.2, hh * 1.0]]);
          // schwere Braue über dem Auge
          cx.beginPath();
          cx.moveTo(hw * 0.58, -hh * 0.5);
          cx.quadraticCurveTo(hw * 0.68, -hh * 0.72, hw * 0.8, -hh * 0.52);
          cx.strokeStyle = 'rgba(0,0,0,0.5)';
          cx.lineWidth = lw * 2.2;
          cx.stroke();
        }
        // dunkle Fuge am Hals
        cx.beginPath();
        cx.moveTo(back + hw * 0.08, -hh * 1.2);
        cx.quadraticCurveTo(back - hw * 0.06, 0, back + hw * 0.08, hh * 1.2);
        cx.strokeStyle = 'rgba(0,0,0,0.35)';
        cx.lineWidth = lw * 2;
        cx.stroke();
      } else if (!p.shark && !p.jawless) {
        // Kiemendeckel
        cx.beginPath();
        cx.moveTo(hw * 0.5, -hh * 0.75);
        cx.quadraticCurveTo(hw * 0.36, 0, hw * 0.46, hh * 0.72);
        cx.strokeStyle = 'rgba(0,0,0,0.3)';
        cx.lineWidth = lw * 1.6;
        cx.stroke();
        cx.strokeStyle = 'rgba(255,245,220,0.16)';
        cx.lineWidth = lw * 0.6;
        cx.stroke();
      } else if (p.shark) {
        for (let i = 0; i < 5; i++) {
          const x = hw * 0.5 - i * hw * 0.05;
          cx.beginPath();
          cx.moveTo(x, -hh * 0.3);
          cx.quadraticCurveTo(x - hw * 0.025, 0, x, hh * 0.3);
          cx.strokeStyle = 'rgba(0,0,0,0.3)';
          cx.lineWidth = lw * 0.9;
          cx.stroke();
        }
      } else {
        // Kiemenöffnungen der Kieferlosen
        for (let i = 0; i < 6; i++) {
          ell(cx, hw * 0.42 - i * hw * 0.06, hh * 0.05, lw * 0.6, lw * 0.9);
          cx.fillStyle = 'rgba(0,0,0,0.35)';
          cx.fill();
        }
      }
    },
  });

  // ---- Kopfschild wie ein Hufeisen (Cephalaspis)
  if (p.shield) {
    const sh = () => {
      ctx.beginPath();
      ctx.moveTo(hw * 0.12, -hh * 0.95);
      ctx.bezierCurveTo(hw * 0.7, -hh * 1.15, hw * 1.12, -hh * 0.6, hw * 1.05, hh * 0.15);
      ctx.bezierCurveTo(hw * 0.95, hh * 0.65, hw * 0.4, hh * 0.7, hw * 0.1, hh * 0.62);
      ctx.lineTo(-hw * 0.2, hh * 1.05);
      ctx.lineTo(-hw * 0.02, hh * 0.3);
      ctx.quadraticCurveTo(-hw * 0.05, -hh * 0.4, hw * 0.12, -hh * 0.95);
      ctx.closePath();
    };
    skin(ctx, sh, { base: bone, top: shade(bone, -0.2), y0: -hh, y1: hh, noise: 'stone', noiseAlpha: 0.5, noiseScale: 0.3, seed: len + 3, edge: D, edgeW: lw, rim: 0.4 });
  }
  // ---- Schnauzenfortsatz aus Knochen (Rolfosteus): lang, spitz, mit einer Naht in der Mitte
  if (p.snout) {
    const tipX = hw * (1 + p.snout), tipY = ny - hh * 0.1;
    const rost = () => {
      ctx.beginPath();
      ctx.moveTo(hw * 0.58, -hh * 0.66);
      ctx.quadraticCurveTo(hw * 0.95, -hh * 0.5, tipX, tipY);
      ctx.quadraticCurveTo(hw * 1.0, ny + hh * 0.02, hw * 0.9, ny + hh * 0.06);
      ctx.lineTo(hw * 0.7, -hh * 0.1);
      ctx.closePath();
    };
    skin(ctx, rost, { base: bone, top: shade(bone, -0.2), y0: -hh * 0.7, y1: ny, noise: 'stone', noiseAlpha: 0.5, noiseScale: 0.3, seed: len + 9, edge: D, edgeW: lw, rim: 0.4 });
    ctx.beginPath();
    ctx.moveTo(hw * 0.66, -hh * 0.42);
    ctx.quadraticCurveTo(hw * 1.0, -hh * 0.25, tipX - 2, tipY);
    ctx.strokeStyle = css(shade(bone, -0.55), 0.6);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }
  // ---- Stachelreihe auf dem Rücken (Birkenia)
  if (p.spines) {
    for (let i = 0; i < 7; i++) {
      const x = hw * 0.3 - i * hw * 0.16;
      const y = -hh * (0.98 - Math.abs(i - 2) * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + 1.5, y + 1);
      ctx.lineTo(x - 1.8, y - hh * 0.55);
      ctx.lineTo(x - 2.2, y + 1);
      ctx.closePath();
      ctx.fillStyle = css(shade(c, -0.3));
      ctx.fill();
    }
  }

  // ---- Maul
  const my = ny + hh * 0.12;
  if (placo) {
    // Knochenklingen: oben ein spitzer Haken, unten eine aufragende Kieferplatte – dazwischen der dunkle Schlund
    ctx.beginPath();
    ctx.moveTo(hw * 1.0, my - hh * 0.06);
    ctx.quadraticCurveTo(hw * 0.8, my + hh * 0.2, hw * 0.55, my + hh * 0.05);
    ctx.lineTo(hw * 0.55, my + hh * 0.35);
    ctx.quadraticCurveTo(hw * 0.85, my + hh * 0.45, hw * 1.03, my + hh * 0.08);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16,6,6,0.92)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw * 1.01, my - hh * 0.08);
    ctx.lineTo(hw * 0.96, my + hh * 0.2);
    ctx.lineTo(hw * 0.84, my + hh * 0.02);
    ctx.lineTo(hw * 0.74, my + hh * 0.12);
    ctx.lineTo(hw * 0.66, my - hh * 0.0);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, my - hh * 0.08, my + hh * 0.2, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,10,0.7)';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hw * 0.58, my + hh * 0.42);
    ctx.quadraticCurveTo(hw * 0.86, my + hh * 0.5, hw * 1.05, my + hh * 0.02);
    ctx.lineTo(hw * 0.98, my + hh * 0.26);
    ctx.lineTo(hw * 0.86, my + hh * 0.2);
    ctx.lineTo(hw * 0.76, my + hh * 0.3);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, my, my + hh * 0.5, 1);
    ctx.fill();
    ctx.stroke();
  } else if (p.armor && !p.arms && !p.eyesFront) {
    // Knochenklingen statt Zähnen – wie eine Schere
    ctx.beginPath();
    ctx.moveTo(hw + 1, my - hh * 0.06);
    ctx.lineTo(hw * 0.62, my);
    ctx.lineTo(hw * 0.98, my + hh * 0.3);
    ctx.closePath();
    ctx.fillStyle = ivory(ctx, my, my + hh * 0.3, 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw + 1, my - hh * 0.05);
    ctx.lineTo(hw * 0.58, my + hh * 0.02);
    ctx.strokeStyle = 'rgba(14,8,6,0.85)';
    ctx.lineWidth = lw * 1.6;
    ctx.stroke();
  } else if (p.jawless || p.arms) {
    ell(ctx, hw - 1, my, Math.max(1, hh * 0.1), Math.max(0.8, hh * 0.08));
    ctx.fillStyle = 'rgba(20,10,8,0.8)';
    ctx.fill();
  } else if (p.shark) {
    ctx.beginPath();
    ctx.moveTo(hw * 0.86, hh * 0.32);
    ctx.quadraticCurveTo(hw * 0.74, hh * 0.5, hw * 0.6, hh * 0.38);
    ctx.strokeStyle = 'rgba(20,10,8,0.75)';
    ctx.lineWidth = lw;
    ctx.stroke();
    if (p.teeth) for (let i = 0; i < 4; i++) tooth(ctx, hw * 0.64 + i * hw * 0.05, hh * 0.4 + i * 0.6, hh * 0.06, hh * 0.12, 1);
  } else {
    ctx.beginPath();
    ctx.moveTo(hw, my);
    ctx.quadraticCurveTo(hw * 0.86, my + hh * 0.08, hw * 0.7, my + hh * 0.04);
    ctx.strokeStyle = 'rgba(20,10,8,0.7)';
    ctx.lineWidth = lw;
    ctx.stroke();
    if (p.teeth) for (let i = 0; i < 4; i++) tooth(ctx, hw * 0.74 + i * hw * 0.06, my + hh * 0.02, hh * 0.08, hh * 0.17, 1);
  }

  // ---- Ruderarme (Bothriolepis)
  if (p.arms) {
    const a = f ? 0.25 : -0.1;
    ctx.save();
    ctx.translate(hw * 0.32, hh * 0.55);
    ctx.rotate(a);
    const seg = (x0: number, y0: number, x1: number, y1: number, wd: number) => {
      const pth = () => {
        ctx.beginPath();
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
        const nx = (-dy / l) * wd, ny2 = (dx / l) * wd;
        ctx.moveTo(x0 + nx, y0 + ny2);
        ctx.lineTo(x1 + nx * 0.7, y1 + ny2 * 0.7);
        ctx.quadraticCurveTo(x1 + dx / l * wd, y1 + dy / l * wd, x1 - nx * 0.7, y1 - ny2 * 0.7);
        ctx.lineTo(x0 - nx, y0 - ny2);
        ctx.closePath();
      };
      skin(ctx, pth, { base: bone, y0: Math.min(y0, y1) - wd, y1: Math.max(y0, y1) + wd, noise: 'stone', noiseAlpha: 0.4, noiseScale: 0.3, edge: D, edgeW: lw * 0.8, rim: 0.3 });
    };
    seg(0, 0, -hw * 0.28, hh * 0.55, hh * 0.12);
    seg(-hw * 0.28, hh * 0.55, -hw * 0.6, hh * 0.45, hh * 0.1);
    ctx.restore();
  } else if (p.lobed) {
    lobe(hw * 0.34, hh * 0.55, f ? 1.7 : 2.05, hw * 0.26, hh * 0.19, hh * 0.8);
  } else {
    // ---- Brustflosse (vor dem Körper), bewegt sich mit
    ctx.save();
    ctx.translate(hw * 0.36, hh * 0.38);
    ctx.rotate(f ? 0.35 : 0.05);
    finMembrane(ctx, [0, -hh * 0.06], [[-hw * 0.14, hh * 0.45], [-hw * 0.34, hh * 0.62], [-hw * 0.4, hh * 0.38]], [-hw * 0.06, hh * 0.08], fc, lw, p.shark);
    ctx.restore();
  }

  // ---- Auge
  const ex = p.eyesFront ? hw * 0.86 : p.shield ? hw * 0.62 : p.shark ? hw * 0.74 : hw * 0.68;
  const ey = p.eyesFront ? -hh * 0.02 : p.shield ? -hh * 0.62 : -hh * 0.2;
  const er = Math.max(1.6, hh * (p.armor && !p.eyesFront ? 0.12 : p.shark ? 0.13 : 0.19));
  eye(ctx, ex, ey, er, E.iris, { glow: E.glow, lid: p.armor && !p.eyesFront ? 0.4 : p.shark ? 0.25 : 0 });
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

// ---------------------------------------------------------------------------- Kreidezeit

/** Eine fleischige Flosse (Paddel): von der Wurzel (0,0) nach vorn entlang x, breit nahe der Wurzel, schmal und rund (oder spitz) am Ende. */
function paddle(ctx: Ctx, x: number, y: number, L: number, wd: number, ang: number, col: number, lw: number, pointed = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -wd * 0.45);
    ctx.bezierCurveTo(L * 0.28, -wd * 1.05, L * 0.72, -wd * 0.62, L, pointed ? -wd * 0.02 : -wd * 0.1);
    if (!pointed) ctx.quadraticCurveTo(L * 1.04, wd * 0.12, L * 0.9, wd * 0.18);
    ctx.bezierCurveTo(L * 0.62, wd * (pointed ? 0.2 : 0.3), L * 0.24, wd * 0.62, 0, wd * 0.45);
    ctx.closePath();
  };
  skin(ctx, path, { base: col, top: shade(col, 0.12), belly: shade(col, -0.25), y0: -wd, y1: wd, noise: 'mottle', noiseAlpha: 0.28, noiseScale: 0.3, edge: shade(col, -0.62), edgeW: lw, rim: 0.4 });
  ctx.save();
  path();
  ctx.clip();
  // die Fingerknochen schimmern durch
  ctx.strokeStyle = css(shade(col, -0.5), 0.26);
  ctx.lineWidth = Math.max(0.6, lw * 0.8);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(L * 0.14, i * wd * 0.18);
    ctx.quadraticCurveTo(L * 0.5, i * wd * 0.22 - wd * 0.08, L * 0.86, i * wd * 0.06 - wd * 0.04);
    ctx.stroke();
  }
  // die Vorderkante fängt das Licht
  ctx.strokeStyle = css(shade(col, 0.55), 0.35);
  ctx.lineWidth = Math.max(0.8, lw * 1.4);
  ctx.beginPath();
  ctx.moveTo(L * 0.08, -wd * 0.62);
  ctx.bezierCurveTo(L * 0.3, -wd * 0.98, L * 0.7, -wd * 0.56, L * 0.96, -wd * 0.08);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Ein Fangarm (oder Hals …): eine Kurve durch Punkte, die sich von w0 bis w1 verjüngt – als gefüllte Form. */
function taper(ctx: Ctx, pts: P2[], w0: number, w1: number) {
  const left: P2[] = [], right: P2[] = [];
  pts.forEach(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, pts.length - 1))) / 2;
    left.push([x - (ty / tl) * w, y + (tx / tl) * w]);
    right.push([x + (ty / tl) * w, y - (tx / tl) * w]);
  });
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

/** Punkte entlang einer kubischen Bézierkurve. */
function bezPts(p0: P2, p1: P2, p2: P2, p3: P2, n: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/**
 * Eine Meeresechse (Mosasaurier): ein langer, schlanker Echsenkörper mit vier Paddelflossen und einem langen Schwanz, der in
 * eine Flosse ausläuft (beim Mosasaurus hoch und sichelförmig wie bei einem Hai). Der Kopf ist lang und flach, das Maul voller
 * kegelförmiger Zähne.
 */
function drawMosa(ctx: Ctx, p: Extract<Art, { t: 'mosa' }>, f: number, E: Eyes) {
  const hw = p.len / 2, h = p.h, c = p.c, D = dark(c);
  const lw = Math.max(1, p.len / 130);
  const tip = hw * (1 + 0.28 * (p.snout ?? 0));
  const fa = f ? 0.22 : -0.18;
  const sw = f ? 0.07 : -0.06;

  // ---- Schwanzflosse (hinter dem Körper), schlägt leicht
  ctx.save();
  ctx.translate(-hw * 0.84, h * 0.02);
  ctx.rotate(sw);
  const tailFin = p.fluke
    ? () => {
        // unten der lange, von den Wirbeln gestützte Lappen, oben ein kürzerer aus Haut
        ctx.beginPath();
        ctx.moveTo(hw * 0.04, -h * 0.06);
        ctx.quadraticCurveTo(-hw * 0.06, -h * 0.3, -hw * 0.16, -h * 0.5);
        ctx.quadraticCurveTo(-hw * 0.15, -h * 0.18, -hw * 0.12, -h * 0.02);
        ctx.quadraticCurveTo(-hw * 0.16, h * 0.32, -hw * 0.22, h * 0.68);
        ctx.quadraticCurveTo(-hw * 0.04, h * 0.42, hw * 0.05, h * 0.1);
        ctx.closePath();
      }
    : () => {
        // eine kleinere Flosse: unten ein Lappen (der Schwanz knickt dort leicht nach unten), oben ein niedriger Saum
        ctx.beginPath();
        ctx.moveTo(hw * 0.06, -h * 0.05);
        ctx.quadraticCurveTo(-hw * 0.05, -h * 0.17, -hw * 0.13, -h * 0.22);
        ctx.quadraticCurveTo(-hw * 0.12, -h * 0.05, -hw * 0.1, 0);
        ctx.quadraticCurveTo(-hw * 0.14, h * 0.24, -hw * 0.19, h * 0.48);
        ctx.quadraticCurveTo(-hw * 0.03, h * 0.32, hw * 0.06, h * 0.08);
        ctx.closePath();
      };
  skin(ctx, tailFin, { base: p.fin, top: shade(p.fin, -0.2), y0: -h * 0.5, y1: h * 0.6, noise: 'mottle', noiseAlpha: 0.3, noiseScale: 0.3, edge: shade(p.fin, -0.6), edgeW: lw, rim: 0.3 });
  ctx.restore();

  // ---- Flossen der fernen Seite
  paddle(ctx, hw * 0.36, h * 0.22, h * 1.0, h * 0.26, Math.PI - 0.8 + fa, shade(p.fin, -0.2), lw);
  paddle(ctx, -hw * 0.22, h * 0.22, h * 0.8, h * 0.22, Math.PI - 0.85 - fa, shade(p.fin, -0.2), lw);

  // ---- der Körper: vom Schwanz über den Rumpf bis zur Schnauze
  const outline: P2[] = [
    [-hw * 0.99, -h * 0.01], [-hw * 0.72, -h * 0.1], [-hw * 0.38, -h * 0.28], [-hw * 0.04, -h * 0.45], [hw * 0.28, -h * 0.47],
    [hw * 0.5, -h * 0.37], [hw * 0.62, -h * 0.29], [hw * 0.78, -h * 0.28], [tip * 0.93, -h * 0.14], [tip, -h * 0.02],
    [tip * 0.985, h * 0.05], [tip * 0.88, h * 0.12], [hw * 0.66, h * 0.2], [hw * 0.46, h * 0.36], [hw * 0.16, h * 0.49],
    [-hw * 0.14, h * 0.45], [-hw * 0.42, h * 0.3], [-hw * 0.7, h * 0.14], [-hw * 0.99, h * 0.03],
  ];
  const body = () => smooth(ctx, outline, true);
  skin(ctx, body, {
    base: c, top: shade(c, -0.35), belly: p.belly, bellyBand: [h * 0.34, h * 0.24, hw * 0.78, hw * 0.08], y0: -h * 0.5, y1: h * 0.5,
    noise: 'mottle', noiseAlpha: 0.32, noiseScale: 0.26, edge: D, edgeW: lw, rim: 0.3, wet: true,
    inner: p.stripes
      ? (cx) => {
          // dunkle Querbänder auf dem Rücken
          cx.fillStyle = css(D, 0.2);
          for (let i = 0; i < 10; i++) {
            const x = -hw * 0.82 + i * hw * 0.16;
            cx.beginPath();
            cx.ellipse(x, -h * 0.32, hw * 0.032, h * 0.22, 0.3, 0, Math.PI * 2);
            cx.fill();
          }
        }
      : undefined,
  });

  // ---- der Kopf: Maulspalte, Zähne, Auge, Nasenloch
  const mouthY = (x: number) => h * 0.04 + ((tip - x) / Math.max(1, tip - hw * 0.66)) * h * 0.05;
  const n = Math.max(6, Math.round((tip - hw * 0.68) / (h * 0.09)));
  for (let i = 0; i < n; i++) {
    const x = tip * 0.955 - (i * (tip * 0.955 - hw * 0.7)) / Math.max(1, n - 1);
    const tl = h * (0.07 - 0.02 * (i / n));
    tooth(ctx, x, mouthY(x) - h * 0.01, h * 0.035, tl, 1, false, 0.1);
    if (i % 2 === 0) tooth(ctx, x - h * 0.03, mouthY(x) + h * 0.02, h * 0.03, tl * 0.8, -1, false, -0.1);
  }
  ctx.beginPath();
  ctx.moveTo(tip * 0.99, h * 0.03);
  ctx.quadraticCurveTo(hw * 0.84, mouthY(hw * 0.84) + h * 0.01, hw * 0.66, h * 0.06);
  ctx.strokeStyle = css(shade(c, -0.8), 0.85);
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  ell(ctx, tip * 0.92, -h * 0.08, h * 0.025, h * 0.015, -0.2);
  ctx.fillStyle = css(shade(c, -0.8), 0.8);
  ctx.fill();
  // Brauenwulst über dem Auge
  ctx.beginPath();
  ctx.moveTo(hw * 0.68, -h * 0.2);
  ctx.quadraticCurveTo(hw * 0.74, -h * 0.29, hw * 0.81, -h * 0.21);
  ctx.strokeStyle = css(shade(c, -0.6), 0.6);
  ctx.lineWidth = lw * 1.4;
  ctx.stroke();
  eye(ctx, hw * 0.745, -h * 0.17, h * 0.06, E.iris, { glow: E.glow, lid: 0.35 });

  // ---- Flossen der nahen Seite
  paddle(ctx, hw * 0.4, h * 0.3, h * 1.08, h * 0.28, Math.PI - 0.72 - fa, shade(p.fin, 0.12), lw);
  paddle(ctx, -hw * 0.18, h * 0.3, h * 0.86, h * 0.24, Math.PI - 0.8 + fa, shade(p.fin, 0.12), lw);
}

/**
 * Ein Plesiosaurier: ein gedrungener Rumpf mit kurzem Schwanz, vier langen, spitzen Flossen, mit denen er durchs Wasser
 * „fliegt“, und ein endlos langer Hals mit einem kleinen Kopf voller Nadelzähne.
 */
function drawPlesio(ctx: Ctx, p: Extract<Art, { t: 'plesio' }>, f: number, E: Eyes) {
  const L = p.len, h = p.h, c = p.c, D = dark(c);
  const lw = Math.max(1, L / 150);
  const neckL = L * p.neck, bodyL = L - neckL;
  const xt = -L / 2, xs = xt + bodyL, xm = xt + bodyL * 0.6;
  const fa = f ? 0.24 : -0.2;

  // ---- Flossen der fernen Seite
  paddle(ctx, xm + bodyL * 0.16, h * 0.2, h * 1.45, h * 0.34, Math.PI - 0.62 + fa, shade(c, -0.2), lw, true);
  paddle(ctx, xm - bodyL * 0.3, h * 0.2, h * 1.2, h * 0.3, Math.PI - 0.66 - fa, shade(c, -0.2), lw, true);

  // ---- der Hals: ein Rohr, das sich zum Kopf hin verjüngt und sanft nach oben schwingt
  const headL = h * 0.66, hs = h * 0.3;
  const P0: P2 = [xs - h * 0.25, -h * 0.08], P3: P2 = [L / 2 - headL * 0.9, -h * 0.72];
  const P1: P2 = [P0[0] + neckL * 0.4, P0[1] - h * 0.04], P2v: P2 = [P0[0] + neckL * 0.62, P3[1] + h * 0.1];
  const spine = bezPts(P0, P1, P2v, P3, 28);
  const neck = () => taper(ctx, spine, h * 0.44, h * 0.17);
  skin(ctx, neck, { base: c, top: shade(c, -0.3), belly: p.belly, y0: P3[1] - h * 0.1, y1: h * 0.15, noise: 'mottle', noiseAlpha: 0.3, noiseScale: 0.26, edge: D, edgeW: lw, rim: 0.3, wet: true });

  // ---- der Kopf (am Ende des Halses): flacher Schädel, spitze Schnauze, Nadelzähne
  const [ex, ey] = spine[spine.length - 1], [qx, qy] = spine[spine.length - 3];
  const ang = Math.atan2(ey - qy, ex - qx) * 0.5 + 0.06;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  const top = () => {
    ctx.moveTo(-headL * 0.12, -hs * 0.36);
    ctx.bezierCurveTo(headL * 0.2, -hs * 0.62, headL * 0.62, -hs * 0.5, headL, -hs * 0.04);
  };
  const bottom = () => ctx.bezierCurveTo(headL * 0.62, hs * 0.38, headL * 0.2, hs * 0.5, -headL * 0.12, hs * 0.36);
  const head = () => {
    ctx.beginPath();
    top();
    bottom();
    ctx.quadraticCurveTo(-headL * 0.2, 0, -headL * 0.12, -hs * 0.36);
    ctx.closePath();
  };
  // die Kante nur oben, vorn und unten – hinten geht der Kopf in den Hals über
  const outline = () => {
    ctx.beginPath();
    top();
    bottom();
  };
  for (let i = 0; i < 7; i++) {
    const x = headL * (0.9 - i * 0.085);
    tooth(ctx, x, -hs * 0.02 + i * hs * 0.012, hs * 0.07, hs * 0.26, 1, false, 0.2);
    tooth(ctx, x - hs * 0.06, hs * 0.08 + i * hs * 0.012, hs * 0.06, hs * 0.22, -1, false, -0.2);
  }
  skin(ctx, head, { base: shade(c, 0.05), top: shade(c, -0.3), belly: p.belly, y0: -hs * 0.6, y1: hs * 0.5, noise: 'mottle', noiseAlpha: 0.3, noiseScale: 0.24, edge: D, edgeW: lw, rim: 0.3, wet: true, outline });
  ctx.beginPath();
  ctx.moveTo(headL * 0.97, -hs * 0.01);
  ctx.quadraticCurveTo(headL * 0.6, hs * 0.12, headL * 0.18, hs * 0.1);
  ctx.strokeStyle = css(shade(c, -0.8), 0.85);
  ctx.lineWidth = lw;
  ctx.stroke();
  ell(ctx, headL * 0.82, -hs * 0.16, hs * 0.06, hs * 0.035, -0.2);
  ctx.fillStyle = css(shade(c, -0.8), 0.7);
  ctx.fill();
  eye(ctx, headL * 0.36, -hs * 0.17, hs * 0.17, E.iris, { glow: E.glow, lid: 0.2 });
  ctx.restore();

  // ---- Rumpf mit kurzem Schwanz
  const outlineB: P2[] = [
    [xt, -h * 0.01], [xt + bodyL * 0.22, -h * 0.17], [xm - bodyL * 0.1, -h * 0.47], [xm + bodyL * 0.14, -h * 0.47], [xs - bodyL * 0.04, -h * 0.3],
    [xs + h * 0.12, -h * 0.17], [xs + h * 0.1, h * 0.06], [xs - bodyL * 0.08, h * 0.32], [xm, h * 0.5], [xm - bodyL * 0.24, h * 0.42],
    [xt + bodyL * 0.24, h * 0.18], [xt, h * 0.02],
  ];
  const body = () => smooth(ctx, outlineB, true);
  skin(ctx, body, {
    base: c, top: shade(c, -0.35), belly: p.belly, bellyBand: [h * 0.34, h * 0.24, bodyL * 0.36, xm], y0: -h * 0.5, y1: h * 0.5,
    noise: 'mottle', noiseAlpha: 0.32, noiseScale: 0.26, edge: D, edgeW: lw, rim: 0.3, wet: true,
  });
  // eine kleine, rautenförmige Schwanzflosse
  skin(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(xt + bodyL * 0.1, -h * 0.04);
    ctx.quadraticCurveTo(xt + bodyL * 0.02, -h * 0.2, xt - bodyL * 0.04, -h * 0.01);
    ctx.quadraticCurveTo(xt + bodyL * 0.02, h * 0.16, xt + bodyL * 0.1, h * 0.04);
    ctx.closePath();
  }, { base: shade(c, -0.08), y0: -h * 0.2, y1: h * 0.2, noise: 'mottle', noiseAlpha: 0.3, noiseScale: 0.3, edge: D, edgeW: lw, rim: 0.25 });

  // ---- Flossen der nahen Seite
  paddle(ctx, xm + bodyL * 0.2, h * 0.3, h * 1.55, h * 0.36, Math.PI - 0.56 - fa, shade(c, 0.1), lw, true);
  paddle(ctx, xm - bodyL * 0.26, h * 0.3, h * 1.28, h * 0.32, Math.PI - 0.6 + fa, shade(c, 0.1), lw, true);
}

/** Eine Meeresschildkröte (Archelon): ein hoher, lederartiger Panzer mit Längskielen, riesige Vorderflossen, ein Hakenschnabel. */
function drawTurtle(ctx: Ctx, p: Extract<Art, { t: 'turtle' }>, f: number, E: Eyes) {
  const L = p.len, c = p.c, sc = p.shell;
  const lw = Math.max(1, L / 110);
  const S = L * 0.6, sh = S * 0.36;
  const sx0 = -L * 0.38, sx1 = sx0 + S;
  const fa = f ? 0.3 : -0.26;

  // ---- Flossen der fernen Seite
  paddle(ctx, sx1 - S * 0.26, sh * 0.02, L * 0.4, L * 0.085, Math.PI - 0.5 + fa, shade(c, -0.3), lw, true);
  paddle(ctx, sx0 + S * 0.16, sh * 0.12, L * 0.15, L * 0.06, Math.PI - 0.35 - fa * 0.5, shade(c, -0.3), lw);

  // ---- Hals und Kopf: großer Schädel mit einem Hakenschnabel
  const hx = sx1 + S * 0.03, hy = -sh * 0.02;
  const neck = () => {
    ctx.beginPath();
    ctx.moveTo(sx1 - S * 0.12, -sh * 0.28);
    ctx.quadraticCurveTo(hx + S * 0.06, -sh * 0.3, hx + S * 0.1, -sh * 0.12);
    ctx.lineTo(hx + S * 0.1, sh * 0.16);
    ctx.quadraticCurveTo(hx, sh * 0.3, sx1 - S * 0.12, sh * 0.26);
    ctx.closePath();
  };
  skin(ctx, neck, { base: c, top: shade(c, -0.3), y0: -sh * 0.3, y1: sh * 0.3, noise: 'mottle', noiseAlpha: 0.4, noiseScale: 0.3, edge: dark(c), edgeW: lw, rim: 0.25 });
  const HL = S * 0.32, HH = S * 0.18;
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(hx + S * 0.04, -HH * 0.45 + hy);
    ctx.bezierCurveTo(hx + HL * 0.4, -HH * 0.78 + hy, hx + HL * 0.92, -HH * 0.62 + hy, hx + HL * 1.02, -HH * 0.08 + hy);
    // der Haken des Schnabels
    ctx.quadraticCurveTo(hx + HL * 1.06, HH * 0.32 + hy, hx + HL * 0.94, HH * 0.4 + hy);
    ctx.quadraticCurveTo(hx + HL * 0.9, HH * 0.18 + hy, hx + HL * 0.82, HH * 0.24 + hy);
    ctx.quadraticCurveTo(hx + HL * 0.5, HH * 0.62 + hy, hx + S * 0.04, HH * 0.46 + hy);
    ctx.closePath();
  };
  skin(ctx, head, { base: shade(c, 0.06), top: shade(c, -0.28), y0: hy - HH * 0.7, y1: hy + HH * 0.6, noise: 'mottle', noiseAlpha: 0.38, noiseScale: 0.28, edge: dark(c), edgeW: lw, rim: 0.3, wet: true });
  // Schnabel: hornig, heller
  ctx.save();
  head();
  ctx.clip();
  ctx.fillStyle = css(mix(c, 0xc8b88a, 0.4), 0.55);
  ctx.beginPath();
  ctx.ellipse(hx + HL * 0.98, hy + HH * 0.05, HL * 0.16, HH * 0.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(hx + HL * 0.88, hy + HH * 0.22);
  ctx.quadraticCurveTo(hx + HL * 0.6, hy + HH * 0.3, hx + HL * 0.32, hy + HH * 0.18);
  ctx.strokeStyle = css(shade(c, -0.75), 0.8);
  ctx.lineWidth = lw;
  ctx.stroke();
  eye(ctx, hx + HL * 0.5, hy - HH * 0.18, HH * 0.13, E.iris, { glow: E.glow, lid: 0.25 });

  // ---- der Panzer: gewölbter Rücken mit Längskielen, flacher Bauch
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(sx0, sh * 0.14);
    ctx.bezierCurveTo(sx0 + S * 0.04, -sh * 0.9, sx0 + S * 0.72, -sh * 1.08, sx1, -sh * 0.12);
    ctx.quadraticCurveTo(sx1 + S * 0.03, sh * 0.14, sx1 - S * 0.06, sh * 0.3);
    ctx.quadraticCurveTo(sx0 + S * 0.5, sh * 0.5, sx0 + S * 0.05, sh * 0.34);
    ctx.closePath();
  };
  skin(ctx, shell, {
    base: sc, top: shade(sc, -0.25), belly: mix(sc, 0xb8a888, 0.45), bellyBand: [sh * 0.34, sh * 0.16, S * 0.46, sx0 + S * 0.52], y0: -sh, y1: sh * 0.45,
    noise: 'stone', noiseAlpha: 0.35, noiseScale: 0.3, edge: dark(sc), edgeW: lw * 1.2, rim: 0.36, wet: true,
    inner: (cx) => {
      // Längskiele über die Wölbung und ein gewellter Rand
      cx.lineWidth = lw * 1.6;
      for (let k = 0; k < 4; k++) {
        const t = 0.2 + k * 0.2;
        cx.strokeStyle = css(shade(sc, 0.32), 0.42);
        cx.beginPath();
        cx.moveTo(sx0 + S * 0.08, sh * (0.12 - t * 0.12));
        cx.bezierCurveTo(sx0 + S * 0.15, -sh * (0.95 * t + 0.05), sx0 + S * 0.7, -sh * (1.02 * t + 0.08), sx1 - S * 0.06, -sh * (0.18 * t));
        cx.stroke();
        cx.strokeStyle = css(shade(sc, -0.5), 0.3);
        cx.beginPath();
        cx.moveTo(sx0 + S * 0.08, sh * (0.14 - t * 0.12) + lw * 1.4);
        cx.bezierCurveTo(sx0 + S * 0.15, -sh * (0.95 * t + 0.05) + lw * 1.4, sx0 + S * 0.7, -sh * (1.02 * t + 0.08) + lw * 1.4, sx1 - S * 0.06, -sh * (0.18 * t) + lw * 1.4);
        cx.stroke();
      }
      cx.strokeStyle = css(shade(sc, -0.45), 0.5);
      cx.lineWidth = lw;
      cx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = sx0 + S * (0.06 + t * 0.9), y = sh * (0.3 + 0.08 * Math.sin(t * Math.PI)) - Math.abs(Math.sin(i * 1.7)) * sh * 0.04;
        if (i) cx.lineTo(x, y);
        else cx.moveTo(x, y);
      }
      cx.stroke();
    },
  });

  // ---- Flossen der nahen Seite: die vordere lang wie ein Flügel
  paddle(ctx, sx0 + S * 0.18, sh * 0.22, L * 0.16, L * 0.065, Math.PI - 0.4 + fa * 0.5, c, lw);
  paddle(ctx, sx1 - S * 0.22, sh * 0.16, L * 0.44, L * 0.09, Math.PI - 0.46 - fa, c, lw, true);
}

/**
 * Ein Ammonit: eine aufgerollte Schale aus Windungen, jede mit feinen, geschwungenen Rippen – die jüngste (äußerste) ist die
 * größte und endet in der Mündung, aus der Kopf und Fangarme schauen.
 */
function drawAmmo(ctx: Ctx, p: Extract<Art, { t: 'ammo' }>, f: number, E: Eyes) {
  const r = p.r, c = p.c, D = dark(c);
  const lw = Math.max(0.5, r / 26);
  // die Spirale: bei th1 (oben rechts) liegt die Mündung, mit jeder Umdrehung zurück wird die Windung um W kleiner
  const W = 1.85, b = Math.log(W) / (Math.PI * 2);
  const th1 = -0.75;
  const rad = (th: number) => r * Math.exp(b * (th - th1));
  const at = (th: number, k = 1): P2 => [Math.cos(th) * rad(th) * k, Math.sin(th) * rad(th) * k];
  const TURN = Math.PI * 2;
  // Mündung: zwischen dem äußeren Rand und der Windung darunter
  const [ox, oy] = at(th1), [ix, iy] = at(th1 - TURN);
  const mx = (ox + ix) / 2, my = (oy + iy) / 2;
  const ma = th1 + Math.PI / 2; // dorthin öffnet sie sich (rechts unten)

  // ---- Fangarme: aus der Mündung nach vorn, sie wiegen sich
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ma - 0.45);
  for (let i = 0; i < 9; i++) {
    const k = i / 8;
    const sway = (f ? 1 : -1) * (0.6 + (i % 3) * 0.35) * r * 0.07;
    const spread = (k - 0.5) * r * 0.5;
    const pts = bezPts([r * 0.12, spread * 0.4], [r * 0.6, spread * 0.6 + sway], [r * 0.95, spread * 1.1 - sway], [r * (1.25 + 0.15 * (i % 2)), spread * 1.5 + sway], 14);
    taper(ctx, pts, r * 0.13, r * 0.025);
    const tc = shade(p.tent, -0.2 + k * 0.25);
    ctx.fillStyle = css(tc, 0.96);
    ctx.fill();
    ctx.strokeStyle = css(dark(p.tent), 0.4);
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
  }
  // der Kopf mit großem Auge (dahinter die Mündung)
  const headP = () => ell(ctx, r * 0.1, 0, r * 0.26, r * 0.24);
  skin(ctx, headP, { base: mix(p.tent, c, 0.35), y0: -r * 0.26, y1: r * 0.26, noise: 'mottle', noiseAlpha: 0.45, noiseScale: 0.3, wet: true, edge: dark(p.tent), edgeW: lw });
  ctx.restore();

  // ---- die Schale
  const shell = () => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const [x, y] = at(th1 - TURN + (i / 120) * TURN);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  skin(ctx, shell, {
    base: c, top: shade(c, -0.12), belly: shade(c, -0.1), y0: -r, y1: r, noise: 'stone', noiseAlpha: 0.2, noiseScale: 0.32, edge: D, edgeW: lw * 1.3, rim: 0.45, wet: true,
    inner: (cx) => {
      // jede Windung: zum Nabel hin etwas dunkler, außen heller; darauf die Rippen
      for (let w = 0; w < 4; w++) {
        const a0 = th1 - (w + 1) * TURN, steps = 70;
        // die Windung als Band
        cx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const [x, y] = at(a0 + (i / steps) * TURN);
          if (i) cx.lineTo(x, y);
          else cx.moveTo(x, y);
        }
        for (let i = steps; i >= 0; i--) {
          const [x, y] = at(a0 - TURN + (i / steps) * TURN);
          cx.lineTo(x, y);
        }
        cx.closePath();
        cx.fillStyle = css(w % 2 ? shade(c, -0.06) : shade(c, 0.04), 0.5);
        cx.fill();
        // Rippen: von der inneren zur äußeren Naht, leicht nach vorn geschwungen
        const n = Math.round(30 * Math.pow(0.82, w));
        for (let i = 0; i < n; i++) {
          const th = a0 + ((i + 0.5) / n) * TURN;
          const [x0, y0] = at(th - TURN), [x1, y1] = at(th);
          const nx = (x1 - x0) * 0.5, ny = (y1 - y0) * 0.5;
          const bx = x0 + nx - ny * 0.22, by = y0 + ny + nx * 0.22;
          const k = Math.sqrt(rad(th) / r);
          cx.strokeStyle = css(shade(c, -0.42), 0.5);
          cx.lineWidth = Math.max(0.4, lw * 1.25 * k);
          cx.beginPath();
          cx.moveTo(x0, y0);
          cx.quadraticCurveTo(bx, by, x1, y1);
          cx.stroke();
          cx.strokeStyle = css(shade(c, 0.45), 0.3);
          cx.lineWidth = Math.max(0.3, lw * 0.8 * k);
          cx.beginPath();
          cx.moveTo(x0 + lw * 0.8, y0 - lw * 0.5);
          cx.quadraticCurveTo(bx + lw * 0.8, by - lw * 0.5, x1 + lw * 0.8, y1 - lw * 0.5);
          cx.stroke();
        }
      }
      // die Naht zwischen den Windungen
      cx.strokeStyle = css(D, 0.7);
      cx.lineWidth = lw * 1.2;
      cx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const [x, y] = at(th1 - TURN - (i / 300) * TURN * 3.6);
        if (i) cx.lineTo(x, y);
        else cx.moveTo(x, y);
      }
      cx.stroke();
      // Perlmuttschimmer oben links
      cx.globalCompositeOperation = 'lighter';
      cx.fillStyle = rgrad(cx, -r * 0.3, -r * 0.4, 0, r * 0.6, [[0, 'rgba(255,240,215,0.2)'], [1, 'rgba(255,240,215,0)']]);
      cx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      cx.globalCompositeOperation = 'source-over';
    },
  });
  // die Mündung: dunkler Rand, davor das Auge
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(ox, oy);
  ctx.strokeStyle = css(D, 0.85);
  ctx.lineWidth = lw * 2;
  ctx.stroke();
  const ex = mx + Math.cos(ma - 0.45) * r * 0.12, ey = my + Math.sin(ma - 0.45) * r * 0.12;
  eye(ctx, ex, ey, r * 0.11, E.iris, { glow: E.glow });
}

function drawArt(ctx: Ctx, art: Art, f: number, E: Eyes) {
  switch (art.t) {
    case 'fish': return drawFish(ctx, art, f, E);
    case 'jelly': return drawJelly(ctx, art, f);
    case 'trilo': return drawTrilo(ctx, art, f);
    case 'cone': return drawCone(ctx, art, f, E);
    case 'bug': return drawBug(ctx, art, f, E);
    case 'mosa': return drawMosa(ctx, art, f, E);
    case 'plesio': return drawPlesio(ctx, art, f, E);
    case 'turtle': return drawTurtle(ctx, art, f, E);
    case 'ammo': return drawAmmo(ctx, art, f, E);
  }
}

export const speciesKey = (id: string, f: number) => `sp_${id}_${f}`;

/** Erzeugt beide Bewegungsphasen einer Art und die Animation dazu. */
export function makeSpeciesTextures(scene: Phaser.Scene, def: SpeciesDef) {
  if (scene.textures.exists(speciesKey(def.id, 0))) return;
  // große Tiere (Herrscher, Meeresechsen, Riesenhaie …) brauchen mehr Platz
  const big = !!def.boss || ((def.art as { len?: number }).len ?? 0) > 160;
  const W = big ? 900 : 380, H = big ? 760 : 320;
  const E = eyesFor(def.role);
  const cs = [0, 1].map((f) => {
    const [c, ctx] = newCanvas(W, H, true);
    ctx.translate(W / 2, H / 2);
    drawArt(ctx, def.art, f, E);
    return c;
  });
  const t = trimCanvases(cs);
  t.canvases.forEach((c, f) => scene.textures.addCanvas(speciesKey(def.id, f), c));
  scene.anims.create({
    key: `anim_${def.id}`,
    frames: [{ key: speciesKey(def.id, 0) }, { key: speciesKey(def.id, 1) }],
    frameRate: def.boss ? 5 : 6,
    repeat: -1,
  });
}

/** Ein Tier groß und scharf gemalt – für die Seiten der Chronik des Lebens. Gibt den Schlüssel der Textur zurück. */
export function makeSpeciesPortrait(scene: Phaser.Scene, def: SpeciesDef, target = 430) {
  const key = `aqp_${def.id}`;
  if (scene.textures.exists(key)) return key;
  const art = def.art as { len?: number; r?: number };
  const ext = art.len ?? (art.r ?? 16) * 3;
  const k = Math.min(14, target / ext);
  const W = Math.min(2400, Math.ceil(ext * k * 1.9)), H = Math.min(1800, Math.ceil(ext * k * 1.3));
  const [c, ctx] = newCanvas(W, H, true);
  ctx.translate(W / 2, H / 2);
  ctx.scale(k, k);
  drawArt(ctx, def.art, 0, eyesFor(def.role));
  const t = trimCanvases([c], 6);
  scene.textures.addCanvas(key, t.canvases[0]);
  return key;
}

/**
 * Ein kleines Sinnbild eines Tiers (für die Beute in der Übersicht): das Original, verkleinert und vereinfacht – drei flache
 * Farbtöne aus seiner Grundfarbe (Schatten, Körper, Licht) statt aller Muster, dazu eine dunkle Kontur und ein feiner,
 * warmer Rand. w, h: höchstens so groß (Bildpunkte, doppelt so fein gezeichnet). Gibt den Schlüssel der Textur zurück.
 */
export function preyIcon(scene: Phaser.Scene, def: SpeciesDef, w = 92, h = 36) {
  const key = `prey_${def.id}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const R = 2, pad = 3;
  const src = scene.textures.get(makeSpeciesPortrait(scene, def, 220)).getSourceImage() as HTMLCanvasElement;
  const k = Math.min((w - 2 * pad) / src.width, (h - 2 * pad) / src.height);
  const iw = Math.max(1, Math.round(src.width * k * R)), ih = Math.max(1, Math.round(src.height * k * R));
  const W = iw + 2 * pad * R, H = ih + 2 * pad * R;
  // das Tier klein gemalt
  const [body, bx] = newCanvas(W, H, true);
  bx.imageSmoothingQuality = 'high';
  bx.drawImage(src, pad * R, pad * R, iw, ih);
  // drei Farbtöne: nach der Helligkeit jedes Bildpunkts, gemessen an der des ganzen Tiers (so hat jedes Tier alle drei)
  const img = bx.getImageData(0, 0, W, H);
  const d = img.data;
  const lum: number[] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) lum.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
  lum.sort((a, b) => a - b);
  const q = (f: number) => lum[Math.min(lum.length - 1, Math.floor(lum.length * f))] ?? 0;
  const t1 = q(0.3), t2 = q(0.78);
  const base = (def.art as { c?: number }).c ?? 0x6a6a5a;
  const tones = [shade(base, -0.5), shade(base, 0.08), mix(shade(base, 0.45), 0xf0e6d0, 0.25)];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const c = tones[l < t1 ? 0 : l < t2 ? 1 : 2];
    d[i] = (c >> 16) & 255;
    d[i + 1] = (c >> 8) & 255;
    d[i + 2] = c & 255;
    d[i + 3] = d[i + 3] > 110 ? 255 : 0;
  }
  bx.putImageData(img, 0, 0);
  // die Umrisse: dieselbe Gestalt, einfarbig
  const tint = (col: string) => {
    const [c, cx] = newCanvas(W, H);
    cx.drawImage(body, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = col;
    cx.fillRect(0, 0, W, H);
    return c;
  };
  const rim = tint('rgba(200,145,60,0.55)'), line = tint('#0d0b09');
  const [out, ctx] = newCanvas(W, H);
  const ring = (c: HTMLCanvasElement, r: number) => {
    for (let a = 0; a < 16; a++) ctx.drawImage(c, Math.cos((a / 16) * Math.PI * 2) * r, Math.sin((a / 16) * Math.PI * 2) * r);
  };
  ring(rim, 2 * R);
  ring(line, 1.1 * R);
  ctx.drawImage(body, 0, 0);
  // ein Hauch Licht von oben
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,248,230,0.16)');
  g.addColorStop(0.5, 'rgba(255,248,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  scene.textures.addCanvas(key, out);
  return key;
}
