import Phaser from 'phaser';
import type { Art, Role, SpeciesDef } from '../data/species';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, newCanvas, rgrad, trimCanvases } from '../util/canvas';
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

function drawArt(ctx: Ctx, art: Art, f: number, E: Eyes) {
  switch (art.t) {
    case 'fish': return drawFish(ctx, art, f, E);
    case 'jelly': return drawJelly(ctx, art, f);
    case 'trilo': return drawTrilo(ctx, art, f);
    case 'cone': return drawCone(ctx, art, f, E);
    case 'bug': return drawBug(ctx, art, f, E);
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
