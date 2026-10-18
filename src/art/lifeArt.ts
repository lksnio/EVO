import Phaser from 'phaser';
import { css, mix, shade } from '../util/color';
import { type Ctx, ell, fillStroke, newCanvas, rgrad, tex, vgrad } from '../util/canvas';
import { mulberry32 } from '../util/math';

// Das Leben am Grund und im Wasser der Urmeere – wenig aufwendig gemalt, aber an der Form zu erkennen:
// Schwämme, Korallen, Moostierchen, Armfüßer, Seelilien, Cystoideen, Algen und Matten sitzen am Boden (Deko, Ursprung unten Mitte);
// Plankton und graptolithenartige Kolonien treiben frei durchs Wasser (Bildatlas, siehe objects/Drift.ts).

const TAU = Math.PI * 2;

/** Diese Formen wiegen sich in der Strömung (Faktor: wie stark). */
export const LIFE_SWAY: Record<string, number> = {
  crinoid_tall: 1.5, crinoid_short: 1.1, crinoid_cluster: 1.2, cystoid: 0.8, cystoid_pair: 0.8,
  algae_sheet: 1.4, algae_tuft: 1.3, algae_dasyclad: 0.9, grapto_bush: 0.7, bryo_fan: 0.45, sponge_glass: 0.3,
};

/** Alle Formen, die dieses Modul für den Meeresgrund malt. */
export const LIFE_KEYS = new Set([
  'sponge_vase', 'sponge_vase_r', 'sponge_tubes', 'sponge_glass', 'sponge_crust', 'sponge_crust_y', 'sponge_ball',
  'coral_tabulate', 'coral_tabulate_r', 'coral_horn', 'coral_chain', 'coral_branch', 'stromatoporoid',
  'bryo_fan', 'bryo_fan_g', 'bryo_twig', 'brachio_spirifer', 'brachio_orthid', 'brachio_cluster', 'brachio_pentamerus',
  'crinoid_tall', 'crinoid_short', 'crinoid_cluster', 'cystoid', 'cystoid_pair',
  'algae_sheet', 'algae_tuft', 'algae_tuft_r', 'algae_coralline', 'algae_dasyclad', 'stromatolite', 'grapto_bush',
]);

/** Eine runde Linie mit wechselnder Dicke: dunkler Rand, Füllung, optional ein schmaler Lichtstreif. */
function band(ctx: Ctx, pts: number[][], w0: number, w1: number, edge: string, fill: string, light?: string) {
  // dicht abtasten (etwa alle 0,7 Bildpunkte ein Kreis), damit die Linie ohne Lücken durchläuft
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const n = Math.max(2, Math.ceil(total / 0.7));
  const dense: number[][] = [];
  for (let k = 0, j = 1; k <= n; k++) {
    const d = (k / n) * total;
    while (j < pts.length - 1 && cum[j] < d) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const u = Math.max(0, Math.min(1, (d - cum[j - 1]) / seg));
    dense.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u]);
  }
  const pass = (grow: number, col: string, off: number) => {
    ctx.fillStyle = col;
    for (let i = 0; i < dense.length; i++) {
      const t = i / Math.max(1, dense.length - 1);
      const r = Math.max(0.4, (w0 + (w1 - w0) * t) / 2 + grow);
      ctx.beginPath();
      ctx.arc(dense[i][0] - off * 0.5, dense[i][1] - off * 0.5, r, 0, TAU);
      ctx.fill();
    }
  };
  pass(1, edge, 0);
  pass(0, fill, 0);
  if (light) pass(-Math.max(0.5, (w0 + w1) / 5), light, 0.8);
}

/** Punkte entlang einer quadratischen Kurve. */
function qpts(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n = 14) {
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return out;
}

/** Kleine dunkle Poren, in Reihen und versetzt, nur innerhalb des gerade gesetzten Clips. */
function pores(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, step: number, r: number, color: string, seed: number) {
  const q = mulberry32(seed);
  ctx.fillStyle = color;
  for (let y = y0, row = 0; y < y1; y += step * 0.86, row++) {
    for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) {
      ctx.beginPath();
      ctx.arc(x + (q() - 0.5) * 1.2, y + (q() - 0.5) * 1.2, r * (0.7 + q() * 0.6), 0, TAU);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Schwämme

function vaseSponge(ctx: Ctx, w: number, h: number, light: string, mid: string, dark: string, seed: number) {
  const cx = w / 2, topY = 18, rimR = w * 0.4;
  const half = (y: number) => {
    const u = Math.max(0, Math.min(1, (h - y) / (h - topY)));
    return 5 + (rimR - 5) * Math.pow(Math.sin(u * Math.PI * 0.5), 0.8);
  };
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 5, h);
    for (let y = h; y >= topY; y -= 3) ctx.lineTo(cx - half(y), y);
    ctx.ellipse(cx, topY, rimR, 6, 0, Math.PI, TAU);
    for (let y = topY; y <= h; y += 3) ctx.lineTo(cx + half(y), y);
    ctx.lineTo(cx + 5, h);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(cx - rimR, 0, cx + rimR, 0);
  g.addColorStop(0, light);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  pores(ctx, cx - rimR, topY + 6, cx + rimR, h, 4.2, 0.9, 'rgba(30,20,8,0.5)', seed);
  ctx.fillStyle = vgrad(ctx, topY, h, [[0, 'rgba(255,240,200,0.18)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.4)']]);
  ctx.fillRect(0, topY, w, h - topY);
  ctx.restore();
  body();
  ctx.strokeStyle = 'rgba(20,12,4,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // die Öffnung: innen dunkel, vorn ein heller Rand
  ell(ctx, cx, topY, rimR - 1.5, 5);
  ctx.fillStyle = vgrad(ctx, topY - 5, topY + 5, [[0, 'rgba(20,12,4,0.95)'], [1, 'rgba(70,48,20,0.9)']]);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, topY, rimR, 6, 0, 0, Math.PI);
  ctx.strokeStyle = css(mix(0xffe8b0, 0x9a7a3e, 0.3), 0.75);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function tubeSponge(ctx: Ctx, w: number, h: number, cols: [string, string][], seed: number) {
  const q = mulberry32(seed);
  const xs = [w * 0.2, w * 0.38, w * 0.55, w * 0.72, w * 0.86];
  const hs = [0.5, 0.82, 0.62, 1, 0.42];
  // Sockel
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 2, w * 0.46, 6, 0, 0, TAU);
  ctx.fillStyle = css(0x4a3a20, 0.9);
  ctx.fill();
  xs.map((x, i) => [x, i] as const).sort((a, b) => hs[a[1]] - hs[b[1]]).forEach(([x, i]) => {
    const th = (h - 6) * hs[i], bw = 5 + q() * 2, tw = bw + 2.5;
    const yTop = h - 3 - th;
    ctx.beginPath();
    ctx.moveTo(x - bw, h - 3);
    ctx.bezierCurveTo(x - bw - 1, h - th * 0.5, x - tw, yTop + 6, x - tw, yTop);
    ctx.ellipse(x, yTop, tw, 3.6, 0, Math.PI, TAU);
    ctx.bezierCurveTo(x + tw, yTop + 6, x + bw + 1, h - th * 0.5, x + bw, h - 3);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - tw, 0, x + tw, 0);
    g.addColorStop(0, cols[i % cols.length][0]);
    g.addColorStop(1, cols[i % cols.length][1]);
    fillStroke(ctx, g, 'rgba(24,14,6,0.8)', 1);
    ctx.save();
    ctx.clip();
    pores(ctx, x - tw, yTop + 3, x + tw, h, 3.6, 0.7, 'rgba(30,20,8,0.45)', seed + i * 7);
    ctx.restore();
    ell(ctx, x, yTop, tw - 1, 3);
    ctx.fillStyle = 'rgba(24,14,6,0.92)';
    ctx.fill();
  });
}

function glassSponge(ctx: Ctx, w: number, h: number) {
  const cx = w / 2, topY = 8;
  const half = (y: number) => 3.6 + 9.5 * Math.pow(Math.max(0, (h - 8 - y) / (h - 8 - topY)), 0.7);
  // Basalia: dünne Nadeln, mit denen der Schwamm im Schlamm steckt
  ctx.strokeStyle = 'rgba(210,228,232,0.55)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.18 + 0.64 * (i / 8));
    ctx.beginPath();
    ctx.moveTo(cx + (i - 4) * 0.8, h - 10);
    ctx.lineTo(cx + Math.cos(a) * 12 * (i % 2 ? 0.8 : 1) - 0, h - 10 + Math.sin(a) * 9);
    ctx.stroke();
  }
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 3.6, h - 8);
    for (let y = h - 8; y >= topY; y -= 3) ctx.lineTo(cx - half(y), y);
    ctx.ellipse(cx, topY, half(topY), 4, 0, Math.PI, TAU);
    for (let y = topY; y <= h - 8; y += 3) ctx.lineTo(cx + half(y), y);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
  g.addColorStop(0, 'rgba(196,222,230,0.82)');
  g.addColorStop(0.5, 'rgba(238,248,250,0.9)');
  g.addColorStop(1, 'rgba(140,174,190,0.82)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  // das Gitterwerk aus Kieselnadeln: sich kreuzende Schrägen
  ctx.strokeStyle = 'rgba(70,104,124,0.55)';
  ctx.lineWidth = 0.8;
  for (let k = -h; k < h; k += 5) {
    ctx.beginPath();
    ctx.moveTo(cx - 16, topY + k);
    ctx.lineTo(cx + 16, topY + k + 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 16, topY + k);
    ctx.lineTo(cx - 16, topY + k + 22);
    ctx.stroke();
  }
  ctx.restore();
  body();
  ctx.strokeStyle = 'rgba(60,92,110,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ell(ctx, cx, topY, half(topY) - 1, 3.2);
  ctx.fillStyle = 'rgba(40,70,90,0.85)';
  ctx.fill();
}

function crustSponge(ctx: Ctx, w: number, h: number, light: string, dark: string, seed: number) {
  const q = mulberry32(seed);
  const lobes: number[][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    lobes.push([4 + t * (w - 8), h - 2 - (Math.sin(t * Math.PI) * (h - 5) * (0.55 + q() * 0.45))]);
  }
  ctx.beginPath();
  ctx.moveTo(2, h);
  for (const [x, y] of lobes) ctx.lineTo(x, y);
  ctx.lineTo(w - 2, h);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, 0, h, [[0, light], [1, dark]]), 'rgba(30,14,6,0.7)', 1);
  for (let i = 0; i < 6; i++) {
    const x = 8 + q() * (w - 16);
    // die Öffnungen sitzen im Polster, nicht darüber
    const t = (x - 4) / (w - 8), j = Math.min(11, Math.floor(t * 12));
    const top = lobes[j][1] + (lobes[j + 1][1] - lobes[j][1]) * (t * 12 - j);
    const y = top + 3 + q() * Math.max(0, h - 3 - top - 3);
    ell(ctx, x, y, 2.4, 1.5);
    ctx.fillStyle = 'rgba(40,16,6,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - 0.6, 2.8, 1.8, 0, Math.PI, TAU);
    ctx.strokeStyle = css(mix(0xffffff, 0xd09060, 0.5), 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function ballSponge(ctx: Ctx, w: number, h: number, seed: number) {
  const q = mulberry32(seed);
  const cx = w / 2, cy = h - 17;
  ell(ctx, cx, cy + 6, w * 0.45, 14);
  ctx.fillStyle = rgrad(ctx, cx - 6, cy - 6, 2, w * 0.5, [[0, '#d6a8a0'], [0.6, '#a87470'], [1, '#4a2a2a']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,12,12,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = q() * TAU, r = 3 + q() * 12;
    const x = cx + Math.cos(a) * r * 1.2, y = cy + 2 + Math.sin(a) * r * 0.55;
    ell(ctx, x, y, 2, 1.4);
    ctx.fillStyle = 'rgba(36,14,14,0.85)';
    ctx.fill();
  }
  pores(ctx, cx - 14, cy - 4, cx + 14, cy + 14, 4.4, 0.6, 'rgba(40,16,16,0.35)', seed + 3);
}

// ---------------------------------------------------------------------------
// Korallen

function tabulateCoral(ctx: Ctx, w: number, h: number, light: number, dark: number) {
  const cx = w / 2, base = h - 3;
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(3, base);
    ctx.bezierCurveTo(3, base - 26, w * 0.26, 2, cx, 2);
    ctx.bezierCurveTo(w * 0.74, 2, w - 3, base - 26, w - 3, base);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = rgrad(ctx, cx - 8, 10, 2, w * 0.6, [[0, css(shade(light, 0.2))], [0.55, css(light)], [1, css(dark)]]);
  ctx.fill();
  ctx.save();
  dome();
  ctx.clip();
  // die Röhrchen von oben gesehen: ein Wabenmuster, zum Rand hin gestaucht
  ctx.strokeStyle = css(shade(dark, -0.4), 0.7);
  ctx.lineWidth = 0.9;
  const s = 6.4;
  for (let row = -1; row < 7; row++) {
    for (let col = -1; col < 12; col++) {
      const x = 3 + col * s * 1.73 + (row % 2 ? s * 0.87 : 0), y = 2 + row * s * 1.5;
      const k = 1 - Math.min(1, Math.abs(x - cx) / (w / 2)) * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = TAU * (i / 6) + Math.PI / 6;
        const px = x + Math.cos(a) * s * 0.98 * k, py = y + Math.sin(a) * s * 0.98 * 0.78;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.fillStyle = vgrad(ctx, 0, base, [[0, 'rgba(255,240,210,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  dome();
  ctx.strokeStyle = css(shade(dark, -0.6), 0.85);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function hornCoral(ctx: Ctx, w: number, h: number) {
  const horns = [
    { x0: w * 0.3, x1: w * 0.14, top: 14, len: h - 3, wTop: 15, hue: 0 },
    { x0: w * 0.62, x1: w * 0.8, top: 8, len: h - 3, wTop: 16, hue: 1 },
    { x0: w * 0.46, x1: w * 0.5, top: 24, len: h - 3, wTop: 12, hue: 0 },
  ];
  for (const hn of horns) {
    const pts = qpts(hn.x0, h - 2, (hn.x0 + hn.x1) / 2 + (hn.x1 > hn.x0 ? -6 : 6), (h + hn.top) / 2 + 6, hn.x1, hn.top, 18);
    const cols = hn.hue ? ['#a46a46', '#d8b890', '#e8d4b4'] : ['#8a5a3c', '#c8a078', '#dcc49c'];
    band(ctx, pts, 3, hn.wTop, '#2a160a', cols[0], cols[1]);
    // Wachstumsringe quer zum Horn
    for (let i = 3; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[i + 1];
      const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      const r = (3 + (hn.wTop - 3) * (i / (pts.length - 1))) / 2;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * r * 0.9, y - Math.sin(a) * r * 0.9);
      ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
      ctx.strokeStyle = 'rgba(40,20,10,0.5)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // der Kelch oben: innen dunkel, mit Septen (Strahlen)
    const [tx, ty] = pts[pts.length - 1];
    ell(ctx, tx, ty, hn.wTop / 2 + 0.5, hn.wTop * 0.26);
    ctx.fillStyle = cols[2];
    ctx.fill();
    ell(ctx, tx, ty + 0.4, hn.wTop / 2 - 1.6, hn.wTop * 0.2);
    ctx.fillStyle = 'rgba(40,20,10,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,212,180,0.6)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 0.4);
      ctx.lineTo(tx + Math.cos(a) * (hn.wTop / 2 - 1.8), ty + 0.4 + Math.sin(a) * hn.wTop * 0.2);
      ctx.stroke();
    }
  }
}

function chainCoral(ctx: Ctx, w: number, h: number) {
  const q = mulberry32(51);
  const chains = [
    { y: h * 0.82, amp: 3, ph: 0.4, x0: 4, x1: w - 4 },
    { y: h * 0.55, amp: 5, ph: 2, x0: 8, x1: w - 10 },
    { y: h * 0.3, amp: 4, ph: 4, x0: 14, x1: w - 16 },
  ];
  // flacher Sockel
  ctx.beginPath();
  ctx.ellipse(w / 2, h - 3, w * 0.47, 5, 0, 0, TAU);
  ctx.fillStyle = css(0x4a3028, 0.9);
  ctx.fill();
  chains.forEach((c, ci) => {
    const n = Math.round((c.x1 - c.x0) / 6.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = c.x0 + (c.x1 - c.x0) * t;
      const y = c.y + Math.sin(t * 6 + c.ph) * c.amp;
      const dy = Math.cos(t * 6 + c.ph) * c.amp * 6 / (c.x1 - c.x0);
      const rot = Math.atan(dy) + (q() - 0.5) * 0.3;
      ell(ctx, x, y, 3.6, 5.4 - ci * 0.4, rot);
      ctx.fillStyle = ci % 2 ? '#b8826a' : '#cc9478';
      ctx.fill();
      ctx.strokeStyle = 'rgba(52,26,18,0.85)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ell(ctx, x, y, 1.5, 2.6, rot);
      ctx.fillStyle = 'rgba(40,18,12,0.9)';
      ctx.fill();
    }
  });
}

function branchCoral(ctx: Ctx, w: number, h: number, seed: number) {
  const q = mulberry32(seed);
  const cols = ['#7a5e44', '#c8a67e', '#e6d0a8'];
  const branch = (x: number, y: number, a: number, len: number, wd: number, d: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const pts = qpts(x, y, (x + x2) / 2 + (q() - 0.5) * 5, (y + y2) / 2 + (q() - 0.5) * 3, x2, y2, 6);
    band(ctx, pts, wd, wd * 0.82, '#2c1c10', cols[1], cols[2]);
    // Kelchöffnungen als dunkle Pünktchen
    ctx.fillStyle = 'rgba(50,30,16,0.65)';
    for (let i = 1; i < pts.length; i += 1) {
      ctx.beginPath();
      ctx.arc(pts[i][0] + (q() - 0.5) * wd * 0.4, pts[i][1] + (q() - 0.5) * wd * 0.4, 0.7, 0, TAU);
      ctx.fill();
    }
    if (d > 0) {
      branch(x2, y2, a - 0.42 - q() * 0.2, len * 0.74, wd * 0.82, d - 1);
      branch(x2, y2, a + 0.42 + q() * 0.2, len * 0.74, wd * 0.82, d - 1);
    } else {
      ell(ctx, x2, y2, wd * 0.5, wd * 0.5);
      ctx.fillStyle = cols[2];
      ctx.fill();
    }
  };
  branch(w / 2, h - 2, -Math.PI / 2, 15, 7, 3);
}

function stromatoporoid(ctx: Ctx, w: number, h: number, light: number, dark: number, seed: number) {
  const q = mulberry32(seed);
  const cx = w / 2, base = h - 2;
  const dome = (k: number) => {
    const rx = (w / 2 - 2) * k, ry = (h - 4) * k;
    ctx.beginPath();
    ctx.moveTo(cx - rx, base);
    ctx.bezierCurveTo(cx - rx, base - ry * 1.05, cx - rx * 0.4, base - ry, cx, base - ry);
    ctx.bezierCurveTo(cx + rx * 0.4, base - ry, cx + rx, base - ry * 1.05, cx + rx, base);
    ctx.closePath();
  };
  // Schicht auf Schicht, von außen nach innen
  for (let i = 0; i < 7; i++) {
    const k = 1 - i * 0.12;
    dome(k);
    ctx.fillStyle = css(mix(dark, light, i / 6));
    ctx.fill();
    ctx.strokeStyle = css(shade(dark, -0.5), 0.55);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // Buckel (Mamelonen) obenauf
  for (let i = 0; i < 6; i++) {
    const x = cx + (q() - 0.5) * w * 0.55, y = base - (h - 6) * (0.78 + q() * 0.2) + 1;
    ell(ctx, x, y, 3 + q() * 2, 1.6);
    ctx.fillStyle = css(shade(light, 0.2), 0.6);
    ctx.fill();
  }
  dome(1);
  ctx.strokeStyle = css(shade(dark, -0.65), 0.9);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Moostierchen

function fanBryozoan(ctx: Ctx, w: number, h: number, line: string, back: string) {
  const span = 1.02;
  // der Fächer bleibt ganz im Bild: Die Strahlen gehen vom Stielende aus nach oben und seitlich
  const cx = w / 2, ay = h - 2, R = Math.min(h - 17, (w / 2 - 3) / Math.sin(span));
  // Stiel
  band(ctx, qpts(cx, h, cx + 1, h - 8, cx, ay - 8, 5), 2.6, 2, 'rgba(60,40,36,0.8)', back);
  const draw = (col: string, lw: number, dx: number, dy: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.save();
    ctx.translate(dx, dy);
    // die Strahlen
    for (let i = 0; i <= 11; i++) {
      const a = -Math.PI / 2 - span + (i / 11) * span * 2;
      ctx.beginPath();
      ctx.moveTo(cx, ay - 9);
      ctx.lineTo(cx + Math.cos(a) * R * 1.02, ay - 9 + Math.sin(a) * R * 1.02);
      ctx.stroke();
    }
    // die Querstege: Bögen, die das Netz mit seinen Fenstern schließen
    for (let r = R * 0.26; r < R * 1.03; r += R * 0.115) {
      ctx.beginPath();
      ctx.arc(cx, ay - 9, r, -Math.PI / 2 - span, -Math.PI / 2 + span);
      ctx.stroke();
    }
    ctx.restore();
  };
  draw(back, 2.6, 0.8, 0.8);
  draw(line, 1.3, 0, 0);
}

function twigBryozoan(ctx: Ctx, w: number, h: number, seed: number) {
  const q = mulberry32(seed);
  const col = ['#6a5a52', '#b4a698', '#ded2c0'];
  const branch = (x: number, y: number, a: number, len: number, wd: number, d: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const pts = qpts(x, y, (x + x2) / 2 + (q() - 0.5) * 4, (y + y2) / 2, x2, y2, 5);
    band(ctx, pts, wd, wd * 0.85, '#2a2220', col[1], col[2]);
    ctx.fillStyle = 'rgba(60,48,42,0.6)';
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.arc(px + (q() - 0.5) * wd * 0.5, py + (q() - 0.5) * wd * 0.5, 0.6, 0, TAU);
      ctx.fill();
    }
    if (d > 0) {
      branch(x2, y2, a - 0.5 - q() * 0.25, len * 0.78, wd * 0.82, d - 1);
      branch(x2, y2, a + 0.5 + q() * 0.25, len * 0.78, wd * 0.82, d - 1);
      if (d > 1 && q() < 0.7) branch(x2, y2, a + (q() - 0.5) * 0.3, len * 0.6, wd * 0.7, d - 2);
    }
  };
  branch(w / 2, h - 2, -Math.PI / 2, 10, 4.4, 4);
}

// ---------------------------------------------------------------------------
// Armfüßer

/** Eine gerippte Muschelklappe in ihren eigenen Koordinaten (Schloss oben bei y = 0, die Schale öffnet sich nach unten). */
function brachShell(ctx: Ctx, rx: number, ry: number, wing: number, ribs: number, c0: string, c1: string, c2: string) {
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-rx * wing, ry * 0.18);
    ctx.bezierCurveTo(-rx * 1.04, ry * 0.7, -rx * 0.8, ry * 1.02, 0, ry * 1.04);
    ctx.bezierCurveTo(rx * 0.8, ry * 1.02, rx * 1.04, ry * 0.7, rx * wing, ry * 0.18);
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = rgrad(ctx, -rx * 0.25, ry * 0.25, 1, rx * 1.2, [[0, c1], [0.7, c0], [1, c2]]);
  ctx.fill();
  ctx.save();
  outline();
  ctx.clip();
  // die Rippen strahlen vom Wirbel aus
  for (let i = 0; i <= ribs; i++) {
    const a = Math.PI / 2 + (i / ribs - 0.5) * 2.3;
    const ex = Math.cos(a) * rx * 1.15, ey = Math.sin(a) * ry * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, ry * 0.04);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = i % 2 ? 'rgba(30,18,8,0.36)' : 'rgba(255,244,220,0.22)';
    ctx.lineWidth = Math.max(0.8, rx * 0.07);
    ctx.stroke();
  }
  // Anwachsstreifen
  ctx.strokeStyle = 'rgba(30,18,8,0.22)';
  ctx.lineWidth = 0.7;
  for (let k = 0.35; k < 1.02; k += 0.17) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 1.1 * k, ry * 1.05 * k, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }
  ctx.restore();
  outline();
  ctx.strokeStyle = 'rgba(26,16,8,0.85)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

function spirifer(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.translate(w / 2, 3);
  brachShell(ctx, w * 0.44, h - 7, 1.0, 13, '#9a8a74', '#d2c4a8', '#4a3e30');
  ctx.restore();
  // das flache Schloss: ein heller Streifen
  ctx.beginPath();
  ctx.moveTo(2, 3);
  ctx.lineTo(w - 2, 3);
  ctx.strokeStyle = 'rgba(236,224,200,0.8)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function orthidOnStalk(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  // der Stiel (Pedunkel), mit dem der Armfüßer im Grund haftet
  ctx.strokeStyle = '#6a5642';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, h);
  ctx.quadraticCurveTo(cx - 3, h - 5, cx, h - 9);
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, h - 9);
  ctx.rotate(Math.PI);
  brachShell(ctx, w * 0.42, h - 12, 0.62, 9, '#a09078', '#e0d2b4', '#54463a');
  ctx.restore();
}

function brachCluster(ctx: Ctx, w: number, h: number) {
  const shells = [
    { x: w * 0.22, y: h - 6, rx: 11, ry: 15, rot: -0.45, wing: 0.9, c: ['#9a8a74', '#d2c4a8', '#4a3e30'] },
    { x: w * 0.5, y: h - 4, rx: 14, ry: 19, rot: 0.05, wing: 1.0, c: ['#8a7a68', '#cabc9c', '#463a2c'] },
    { x: w * 0.78, y: h - 6, rx: 10, ry: 14, rot: 0.5, wing: 0.7, c: ['#a89478', '#e6d8b8', '#54463a'] },
    { x: w * 0.36, y: h - 3, rx: 8, ry: 10, rot: 0.3, wing: 0.7, c: ['#74685a', '#b8aa90', '#3a3026'] },
    { x: w * 0.64, y: h - 3, rx: 7, ry: 9, rot: -0.4, wing: 0.6, c: ['#a09078', '#d8cab0', '#4a3e30'] },
  ];
  // flacher Schatten auf dem Sediment
  ell(ctx, w / 2, h - 1, w * 0.46, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  for (const s of shells) {
    ctx.save();
    // die Muscheln stehen auf der Schale, das Schloss unten, die Öffnung nach oben
    ctx.translate(s.x, s.y);
    ctx.rotate(Math.PI + s.rot);
    brachShell(ctx, s.rx, s.ry, s.wing, 9, s.c[0], s.c[1], s.c[2]);
    ctx.restore();
  }
}

function pentamerus(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const egg = () => {
    ctx.beginPath();
    ctx.moveTo(cx, 3);
    ctx.bezierCurveTo(cx - w * 0.5, h * 0.28, cx - w * 0.5, h - 3, cx, h - 2);
    ctx.bezierCurveTo(cx + w * 0.5, h - 3, cx + w * 0.5, h * 0.28, cx, 3);
    ctx.closePath();
  };
  egg();
  ctx.fillStyle = rgrad(ctx, cx - 6, h * 0.4, 2, w * 0.7, [[0, '#d8c4a0'], [0.6, '#9a8464'], [1, '#3e3020']]);
  ctx.fill();
  ctx.save();
  egg();
  ctx.clip();
  // wenige, grobe Falten
  ctx.strokeStyle = 'rgba(40,28,14,0.4)';
  ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 1.4, 6);
    ctx.quadraticCurveTo(cx + i * w * 0.34, h * 0.55, cx + i * w * 0.3, h);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,28,14,0.22)';
  ctx.lineWidth = 0.8;
  for (let k = 0.3; k < 1; k += 0.14) {
    ctx.beginPath();
    ctx.ellipse(cx, 3, w * 0.5 * k, (h - 4) * k, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
  egg();
  ctx.strokeStyle = 'rgba(26,18,8,0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Seelilien und Cystoideen

function crinoid(ctx: Ctx, ox: number, baseY: number, stemH: number, armLen: number, arms: number, seed: number, scale = 1) {
  const q = mulberry32(seed);
  ctx.save();
  ctx.translate(ox, baseY);
  ctx.scale(scale, scale);
  // Haftscheibe mit Wurzelfäden
  ell(ctx, 0, -1.5, 5, 2.2);
  ctx.fillStyle = '#7a6a60';
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,94,84,0.85)';
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 2, -1);
    ctx.quadraticCurveTo(i * 6, 1, i * 9, 0.5);
    ctx.stroke();
  }
  // der Stiel aus Gliedern, leicht geschwungen
  const sway = (q() - 0.5) * 12;
  const pts = qpts(0, -2, sway, -stemH * 0.5, sway * 0.4, -stemH, 22);
  band(ctx, pts, 3.4, 3.1, '#3a2c34', '#c4b4c0', '#e6dae2');
  ctx.strokeStyle = 'rgba(70,52,66,0.7)';
  ctx.lineWidth = 0.9;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 1.8, y - Math.sin(a) * 1.8);
    ctx.lineTo(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8);
    ctx.stroke();
  }
  const [tx, ty] = pts[pts.length - 1];
  // der Kelch
  ctx.beginPath();
  ctx.moveTo(tx - 3, ty);
  ctx.quadraticCurveTo(tx - 6, ty - 8, tx - 4, ty - 11);
  ctx.lineTo(tx + 4, ty - 11);
  ctx.quadraticCurveTo(tx + 6, ty - 8, tx + 3, ty);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, ty - 11, ty, [[0, '#d8a8c8'], [1, '#8a5a88']]), 'rgba(50,26,48,0.85)', 1);
  // die Arme: je Arm gabelt es sich mehrfach, außen feine Fiederchen
  const arm = (x: number, y: number, a: number, len: number, d: number, hue: number) => {
    const cx2 = x + Math.cos(a + 0.35 * Math.sign(Math.cos(a))) * len * 0.55;
    const cy2 = y + Math.sin(a + 0.35 * Math.sign(Math.cos(a))) * len * 0.55;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const ap = qpts(x, y, cx2, cy2, x2, y2, 6);
    band(ctx, ap, 2, 1.1, '#4a2848', css(mix(0xb468a8, 0xe8a8d8, hue)), undefined);
    if (d > 0) {
      arm(x2, y2, a - 0.42, len * 0.74, d - 1, hue);
      arm(x2, y2, a + 0.42, len * 0.74, d - 1, hue);
    } else {
      // Fiederchen am Ende
      ctx.strokeStyle = css(mix(0xc878b8, 0xf0c8e8, hue), 0.9);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const px = x + (x2 - x) * (0.3 + t * 0.7), py = y + (y2 - y) * (0.3 + t * 0.7);
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(a + s * 1.2) * 4.2, py + Math.sin(a + s * 1.2) * 4.2);
          ctx.stroke();
        }
      }
    }
  };
  for (let i = 0; i < arms; i++) {
    const u = arms === 1 ? 0.5 : i / (arms - 1);
    const a = -Math.PI / 2 + (u - 0.5) * 2.1;
    arm(tx + (u - 0.5) * 6, ty - 10, a, armLen, 2, u);
  }
  ctx.restore();
}

function cystoid(ctx: Ctx, ox: number, baseY: number, stem: number, rx: number, ry: number, seed: number) {
  const q = mulberry32(seed);
  const cy = baseY - stem - ry;
  // Stiel
  const pts = qpts(ox, baseY, ox + (q() - 0.5) * 5, baseY - stem * 0.6, ox, baseY - stem, 8);
  band(ctx, pts, 3, 3, '#3a3040', '#b8aac0', '#d8cce0');
  ctx.strokeStyle = 'rgba(70,58,80,0.7)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(pts[i][0] - 1.6, pts[i][1]);
    ctx.lineTo(pts[i][0] + 1.6, pts[i][1]);
    ctx.stroke();
  }
  // Brachiolen: dünne Arme, die aus dem Scheitel wachsen
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    const len = 12 + q() * 4;
    const x0 = ox + (i - 2) * 1.6, y0 = cy - ry + 3;
    const ap = qpts(x0, y0, x0 + Math.cos(a) * len * 0.5, y0 + Math.sin(a) * len * 0.5 - 2, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, 6);
    band(ctx, ap, 1.6, 0.9, '#40304a', '#b0a0c0');
  }
  // die Theka aus Platten
  const theca = () => {
    ctx.beginPath();
    ctx.ellipse(ox, cy, rx, ry, 0, 0, TAU);
  };
  theca();
  ctx.fillStyle = rgrad(ctx, ox - rx * 0.35, cy - ry * 0.35, 1, rx * 1.6, [[0, '#e0d4e8'], [0.55, '#a898b8'], [1, '#4a3c58']]);
  ctx.fill();
  ctx.save();
  theca();
  ctx.clip();
  ctx.strokeStyle = 'rgba(50,38,64,0.75)';
  ctx.lineWidth = 0.9;
  const rows = [-0.62, -0.1, 0.42];
  rows.forEach((yy, ri) => {
    ctx.beginPath();
    ctx.moveTo(ox - rx, cy + yy * ry);
    ctx.bezierCurveTo(ox - rx * 0.4, cy + yy * ry + 3, ox + rx * 0.4, cy + yy * ry + 3, ox + rx, cy + yy * ry);
    ctx.stroke();
    const n = ri % 2 ? 4 : 5;
    for (let i = 1; i < n; i++) {
      const x = ox - rx + (2 * rx * i) / n;
      ctx.beginPath();
      ctx.moveTo(x, cy + yy * ry + 1.5);
      ctx.lineTo(x + (ri % 2 ? 1 : -1) * 1.2, cy + (rows[ri + 1] ?? 1.1) * ry + 1.5);
      ctx.stroke();
    }
  });
  // Poren: kleine Strichpaare
  ctx.strokeStyle = 'rgba(40,28,56,0.7)';
  for (let i = 0; i < 12; i++) {
    const x = ox + (q() - 0.5) * rx * 1.5, y = cy + (q() - 0.5) * ry * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 0.8, y - 1);
    ctx.lineTo(x - 0.8, y + 1);
    ctx.moveTo(x + 0.8, y - 1);
    ctx.lineTo(x + 0.8, y + 1);
    ctx.stroke();
  }
  ctx.restore();
  theca();
  ctx.strokeStyle = 'rgba(34,24,48,0.9)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ell(ctx, ox, cy - ry + 3, 1.5, 1);
  ctx.fillStyle = '#2a1c38';
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Algen

function sheetAlga(ctx: Ctx, w: number, h: number) {
  const blades = [
    { x: w * 0.3, top: 12, wd: 9, ph: 0.4, c: ['#1e3a1e', '#5aa04a', '#a8d878'] },
    { x: w * 0.52, top: 4, wd: 11, ph: 2.1, c: ['#1a3418', '#4a9442', '#98cc6c'] },
    { x: w * 0.72, top: 16, wd: 8, ph: 4, c: ['#1e3a20', '#62a850', '#b2dc84'] },
  ];
  for (const b of blades) {
    const left: number[][] = [], right: number[][] = [];
    for (let y = h - 1; y >= b.top; y -= 2) {
      const t = (h - y) / (h - b.top);
      const cx = b.x + Math.sin(y * 0.11 + b.ph) * 4 * t;
      const half = (b.wd / 2) * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5 + 0.3) * (1 + Math.sin(y * 0.55 + b.ph) * 0.12);
      left.push([cx - half, y]);
      right.push([cx + half, y]);
    }
    ctx.beginPath();
    ctx.moveTo(b.x - 1.5, h);
    for (const [x, y] of left) ctx.lineTo(x, y);
    const [lx, ly] = left[left.length - 1];
    ctx.quadraticCurveTo((lx + right[right.length - 1][0]) / 2, ly - 6, right[right.length - 1][0], right[right.length - 1][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.lineTo(b.x + 1.5, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, h, 0, b.top);
    g.addColorStop(0, b.c[0]);
    g.addColorStop(0.5, b.c[1]);
    g.addColorStop(1, b.c[2]);
    ctx.globalAlpha = 0.92;
    fillStroke(ctx, g, 'rgba(14,36,14,0.6)', 0.9);
    ctx.globalAlpha = 1;
    // feine Mittelrippe
    ctx.beginPath();
    for (let i = 0; i < left.length; i++) {
      const x = (left[i][0] + right[i][0]) / 2, y = left[i][1];
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = 'rgba(214,244,170,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function tuftAlga(ctx: Ctx, w: number, h: number, a: string, b: string) {
  const q = mulberry32(19);
  for (let i = 0; i < 34; i++) {
    const x0 = w / 2 + (q() - 0.5) * 12;
    const ang = -Math.PI / 2 + (q() - 0.5) * 1.5;
    const len = (h - 4) * (0.5 + q() * 0.5);
    const x1 = x0 + Math.cos(ang) * len, y1 = h - 1 + Math.sin(ang) * len;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.bezierCurveTo(x0 + (q() - 0.5) * 14, h - len * 0.4, x1 + (q() - 0.5) * 12, y1 + len * 0.3, x1, y1);
    ctx.strokeStyle = i % 3 ? a : b;
    ctx.globalAlpha = 0.55 + q() * 0.4;
    ctx.lineWidth = 0.8 + q() * 0.9;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function corallineAlga(ctx: Ctx, w: number, h: number) {
  const q = mulberry32(7);
  ell(ctx, w / 2, h - 3, w * 0.46, 4);
  ctx.fillStyle = '#7a4a58';
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const x = 6 + (i / 5) * (w - 12), hh = (h - 6) * (0.5 + q() * 0.5);
    const lean = (q() - 0.5) * 8;
    const pts = qpts(x, h - 4, x + lean * 0.4, h - 4 - hh * 0.5, x + lean, h - 4 - hh, 6);
    band(ctx, pts, 6.5, 5, '#5a3040', '#d29aa8', '#ecc8d0');
    ctx.fillStyle = 'rgba(100,50,66,0.35)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + lean * (0.3 + k * 0.3) + (q() - 0.5) * 3, h - 4 - hh * (0.3 + k * 0.3), 0.9, 0, TAU);
      ctx.fill();
    }
  }
}

function dasycladAlga(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  ctx.strokeStyle = '#4a6a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, h);
  ctx.lineTo(cx, 6);
  ctx.stroke();
  // Quirle aus kurzen Ästchen, nach oben dichter und kleiner
  for (let i = 0; i < 10; i++) {
    const y = h - 7 - i * ((h - 14) / 10), r = 9 - i * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, y, r, r * 0.34, 0, 0, TAU);
    ctx.fillStyle = css(mix(0x4a8a42, 0xb8e0a0, i / 10), 0.85);
    ctx.fill();
    ctx.strokeStyle = 'rgba(24,52,22,0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(206,238,176,0.45)';
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * r * 0.3, y);
      ctx.lineTo(cx + k * r * 0.34, y - r * 0.28);
      ctx.stroke();
    }
  }
  ell(ctx, cx, 6, 4, 3);
  ctx.fillStyle = '#c4e8a8';
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Matten

function stromatolite(ctx: Ctx, w: number, h: number) {
  const base = h - 2;
  const dome = (cx: number, rx: number, ry: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - rx * k, base);
    ctx.bezierCurveTo(cx - rx * k, base - ry * k * 1.1, cx - rx * k * 0.35, base - ry * k, cx, base - ry * k);
    ctx.bezierCurveTo(cx + rx * k * 0.35, base - ry * k, cx + rx * k, base - ry * k * 1.1, cx + rx * k, base);
    ctx.closePath();
  };
  const heads = [[w * 0.3, 17, 25], [w * 0.62, 21, 33], [w * 0.84, 11, 17]];
  for (const [cx, rx, ry] of heads) {
    for (let i = 0; i < 8; i++) {
      const k = 1 - i * 0.11;
      dome(cx, rx, ry, k);
      ctx.fillStyle = css(mix(i % 2 ? 0x6a7a52 : 0x8a8a62, 0x3a4630, i / 10));
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,38,24,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // ein feiner heller Film obenauf
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.1, base - ry * 0.93, rx * 0.42, 1.6, 0, 0, TAU);
    ctx.fillStyle = 'rgba(214,224,168,0.45)';
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Graptolithen am Grund (verzweigt, festgewachsen)

function graptoBush(ctx: Ctx, w: number, h: number) {
  const q = mulberry32(88);
  const branch = (x: number, y: number, a: number, len: number, d: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = '#5a4020';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // sägeartiger Rand: kleine Zähnchen (die Theken)
    ctx.strokeStyle = '#c0964e';
    ctx.lineWidth = 1;
    const n = Math.max(2, Math.round(len / 3.2));
    for (let i = 1; i <= n; i++) {
      const px = x + (x2 - x) * (i / n), py = y + (y2 - y) * (i / n);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a + s * 1.15) * 3, py + Math.sin(a + s * 1.15) * 3);
        ctx.stroke();
      }
    }
    if (d > 0) {
      branch(x2, y2, a - 0.4 - q() * 0.2, len * 0.78, d - 1);
      branch(x2, y2, a + 0.4 + q() * 0.2, len * 0.78, d - 1);
    }
  };
  branch(w / 2, h - 1, -Math.PI / 2, 12, 3);
}

// ---------------------------------------------------------------------------
// Alle Formen am Grund

const PAD = 8;

export function lifeTextures(scene: Phaser.Scene) {
  // etwas Rand oben und an den Seiten, damit nichts abgeschnitten wird; unten schließt das Bild mit dem Boden ab
  const T = (k: string, w: number, h: number, fn: (ctx: Ctx, w: number, h: number) => void) =>
    tex(scene, 'd2_' + k, w + 2 * PAD, h + PAD, (c) => {
      c.translate(PAD, PAD);
      fn(c, w, h);
    });
  T('sponge_vase', 46, 62, (c, w, h) => vaseSponge(c, w, h, '#d4b068', '#a2803e', '#4a3516', 3));
  T('sponge_vase_r', 40, 52, (c, w, h) => vaseSponge(c, w, h, '#d89478', '#a8604a', '#4a2418', 9));
  T('sponge_tubes', 62, 70, (c, w, h) => tubeSponge(c, w, h, [['#d8a860', '#8a5e2a'], ['#c88a58', '#7a4a26'], ['#dcb870', '#946a30']], 4));
  T('sponge_glass', 38, 92, (c, w, h) => glassSponge(c, w, h));
  T('sponge_crust', 74, 20, (c, w, h) => crustSponge(c, w, h, '#e09450', '#8a4a1e', 5));
  T('sponge_crust_y', 66, 18, (c, w, h) => crustSponge(c, w, h, '#e6cc5c', '#8a7424', 6));
  T('sponge_ball', 42, 40, (c, w, h) => ballSponge(c, w, h, 7));

  T('coral_tabulate', 66, 38, (c, w, h) => tabulateCoral(c, w, h, 0xcaa874, 0x6e5230));
  T('coral_tabulate_r', 56, 32, (c, w, h) => tabulateCoral(c, w, h, 0xc89484, 0x6a3c34));
  T('coral_horn', 54, 48, (c, w, h) => hornCoral(c, w, h));
  T('coral_chain', 62, 36, (c, w, h) => chainCoral(c, w, h));
  T('coral_branch', 66, 66, (c, w, h) => branchCoral(c, w, h, 12));
  T('stromatoporoid', 74, 42, (c, w, h) => stromatoporoid(c, w, h, 0xc8b078, 0x6a5a38, 2));

  T('bryo_fan', 92, 68, (c, w, h) => fanBryozoan(c, w, h, 'rgba(244,214,208,0.95)', 'rgba(120,70,76,0.55)'));
  T('bryo_fan_g', 80, 60, (c, w, h) => fanBryozoan(c, w, h, 'rgba(222,236,196,0.95)', 'rgba(60,84,50,0.55)'));
  T('bryo_twig', 48, 48, (c, w, h) => twigBryozoan(c, w, h, 14));

  T('brachio_spirifer', 48, 30, (c, w, h) => spirifer(c, w, h));
  T('brachio_orthid', 32, 38, (c, w, h) => orthidOnStalk(c, w, h));
  T('brachio_cluster', 70, 34, (c, w, h) => brachCluster(c, w, h));
  T('brachio_pentamerus', 38, 34, (c, w, h) => pentamerus(c, w, h));

  T('crinoid_tall', 128, 152, (c, w, h) => crinoid(c, w / 2, h - 1, 78, 28, 7, 21));
  T('crinoid_short', 116, 100, (c, w, h) => crinoid(c, w / 2, h - 1, 34, 24, 8, 5));
  T('crinoid_cluster', 212, 138, (c, w, h) => {
    crinoid(c, w * 0.23, h - 1, 34, 20, 6, 31, 0.9);
    crinoid(c, w * 0.77, h - 1, 50, 22, 6, 32, 0.95);
    crinoid(c, w * 0.5, h - 1, 72, 24, 7, 33, 1);
  });

  T('cystoid', 34, 60, (c, w, h) => cystoid(c, w / 2, h - 1, 16, 10, 13, 2));
  T('cystoid_pair', 54, 66, (c, w, h) => {
    cystoid(c, w * 0.3, h - 1, 14, 8.5, 11, 4);
    cystoid(c, w * 0.7, h - 1, 24, 10, 13, 5);
  });

  T('algae_sheet', 46, 64, (c, w, h) => sheetAlga(c, w, h));
  T('algae_tuft', 52, 46, (c, w, h) => tuftAlga(c, w, h, '#7a8a3a', '#b8a050'));
  T('algae_tuft_r', 48, 40, (c, w, h) => tuftAlga(c, w, h, '#9a4a5a', '#d08a8a'));
  T('algae_coralline', 46, 28, (c, w, h) => corallineAlga(c, w, h));
  T('algae_dasyclad', 30, 66, (c, w, h) => dasycladAlga(c, w, h));

  T('stromatolite', 64, 44, (c, w, h) => stromatolite(c, w, h));
  T('grapto_bush', 52, 58, (c, w, h) => graptoBush(c, w, h));
}

// ---------------------------------------------------------------------------
// Frei im Wasser: Plankton und graptolithenartige Kolonien (je ein Bildatlas)

export const PLANKTON_FRAMES = ['acritarch', 'radiolarian', 'chitinozoan', 'chitinochain', 'ostracod', 'larva', 'medusa', 'cyano', 'snow1', 'snow2', 'speck'] as const;
export const GRAPTO_FRAMES = ['didymo', 'mono', 'dichto', 'tetra', 'dictyo', 'diplo'] as const;

const CELL = 44;

/** Das Plankton: winzige Lebewesen, hell und halb durchsichtig – mit Glanzlichtern, damit sie im Dunkel schimmern. */
export function planktonAtlas(scene: Phaser.Scene) {
  const key = 'plankton';
  if (scene.textures.exists(key)) return key;
  const cols = 6, rows = 2;
  const [cv, ctx] = newCanvas(cols * CELL, rows * CELL);
  const cell = (i: number, draw: (c: Ctx) => void) => {
    ctx.save();
    ctx.translate((i % cols) * CELL + CELL / 2, Math.floor(i / cols) * CELL + CELL / 2);
    draw(ctx);
    ctx.restore();
  };
  const glow = (c: Ctx, r: number, col: string) => {
    c.fillStyle = rgrad(c, 0, 0, 0, r, [[0, col], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(-r, -r, r * 2, r * 2);
  };
  cell(0, (c) => {
    // Acritarche: ein Bläschen mit Stacheln
    glow(c, 17, 'rgba(180,240,236,0.22)');
    c.strokeStyle = 'rgba(214,246,240,0.85)';
    c.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      c.lineTo(Math.cos(a) * (11 + (i % 2) * 3), Math.sin(a) * (11 + (i % 2) * 3));
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, 6, 0, TAU);
    c.fillStyle = rgrad(c, -2, -2, 0, 7, [[0, 'rgba(255,255,250,0.95)'], [1, 'rgba(120,200,200,0.5)']]);
    c.fill();
    c.strokeStyle = 'rgba(226,250,246,0.9)';
    c.stroke();
  });
  cell(1, (c) => {
    // Radiolarie: Gitterkugel mit langen Nadeln
    glow(c, 19, 'rgba(255,236,190,0.2)');
    c.strokeStyle = 'rgba(255,240,200,0.8)';
    c.lineWidth = 0.9;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      c.beginPath();
      c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, 7, 0, TAU);
    c.fillStyle = 'rgba(255,244,216,0.28)';
    c.fill();
    c.strokeStyle = 'rgba(255,240,200,0.95)';
    c.lineWidth = 1;
    c.stroke();
    c.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.ellipse(0, 0, 7, Math.abs(k) * 2.2 + 0.4, 0, 0, TAU);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, 2, 0, TAU);
    c.fillStyle = 'rgba(255,226,160,0.9)';
    c.fill();
  });
  cell(2, (c) => {
    // Chitinozoe: eine kleine Flasche mit Kragen
    glow(c, 17, 'rgba(210,190,150,0.16)');
    c.beginPath();
    c.moveTo(-3, -13);
    c.lineTo(-3, -6);
    c.bezierCurveTo(-9, -3, -9, 9, -4, 11);
    c.lineTo(4, 11);
    c.bezierCurveTo(9, 9, 9, -3, 3, -6);
    c.lineTo(3, -13);
    c.closePath();
    c.fillStyle = rgrad(c, -3, -1, 1, 11, [[0, 'rgba(236,214,170,0.95)'], [1, 'rgba(120,96,60,0.7)']]);
    c.fill();
    c.strokeStyle = 'rgba(90,70,40,0.85)';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.ellipse(0, -13, 4, 1.6, 0, 0, TAU);
    c.fillStyle = 'rgba(70,52,30,0.85)';
    c.fill();
  });
  cell(3, (c) => {
    // eine Kette aus Chitinozoen
    c.rotate(-0.5);
    for (let i = -1; i <= 1; i++) {
      c.save();
      c.translate(0, i * 11);
      c.scale(0.55, 0.55);
      c.beginPath();
      c.moveTo(-3, -10);
      c.bezierCurveTo(-9, -6, -9, 7, -4, 9);
      c.lineTo(4, 9);
      c.bezierCurveTo(9, 7, 9, -6, 3, -10);
      c.closePath();
      c.fillStyle = 'rgba(232,210,166,0.92)';
      c.fill();
      c.strokeStyle = 'rgba(90,70,40,0.85)';
      c.lineWidth = 1.5;
      c.stroke();
      c.restore();
    }
  });
  cell(4, (c) => {
    // Muschelkrebs: Panzer wie eine Bohne, vorn lugen Beinchen heraus
    glow(c, 19, 'rgba(170,230,226,0.18)');
    c.strokeStyle = 'rgba(190,240,236,0.8)';
    c.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-4 + i * 2.5, 5);
      c.quadraticCurveTo(-5 + i * 3, 9, -7 + i * 4.5, 11);
      c.stroke();
    }
    c.beginPath();
    c.ellipse(0, 0, 11, 7, 0.15, 0, TAU);
    c.fillStyle = rgrad(c, -3, -3, 1, 13, [[0, 'rgba(236,252,248,0.9)'], [0.7, 'rgba(150,210,208,0.55)'], [1, 'rgba(80,150,150,0.5)']]);
    c.fill();
    c.strokeStyle = 'rgba(210,248,244,0.9)';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    c.arc(5, -1, 1.2, 0, TAU);
    c.fillStyle = 'rgba(30,60,70,0.9)';
    c.fill();
  });
  cell(5, (c) => {
    // Larve: ein Tröpfchen mit Wimpernkranz
    glow(c, 18, 'rgba(255,210,170,0.18)');
    c.beginPath();
    c.moveTo(0, -11);
    c.bezierCurveTo(8, -4, 8, 6, 0, 10);
    c.bezierCurveTo(-8, 6, -8, -4, 0, -11);
    c.fillStyle = rgrad(c, -2, -3, 1, 11, [[0, 'rgba(255,238,220,0.9)'], [1, 'rgba(230,150,120,0.5)']]);
    c.fill();
    c.strokeStyle = 'rgba(255,226,200,0.9)';
    c.lineWidth = 0.9;
    c.stroke();
    c.strokeStyle = 'rgba(255,240,224,0.8)';
    c.lineWidth = 0.7;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a) * 8, -1 + Math.sin(a) * 2.4);
      c.lineTo(Math.cos(a) * 12, -1 + Math.sin(a) * 3.6);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, -4, 1.2, 0, TAU);
    c.fillStyle = 'rgba(80,30,30,0.9)';
    c.fill();
  });
  cell(6, (c) => {
    // winzige Meduse: Glocke mit Fangfäden
    glow(c, 20, 'rgba(160,210,255,0.2)');
    c.strokeStyle = 'rgba(190,226,255,0.75)';
    c.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * 3, 0);
      c.bezierCurveTo(i * 4.5, 6, i * 2, 10, i * 3.5, 16);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(-9, 1);
    c.bezierCurveTo(-9, -14, 9, -14, 9, 1);
    c.quadraticCurveTo(0, 4, -9, 1);
    c.fillStyle = rgrad(c, -2, -7, 1, 12, [[0, 'rgba(236,246,255,0.85)'], [1, 'rgba(120,170,230,0.45)']]);
    c.fill();
    c.strokeStyle = 'rgba(210,236,255,0.9)';
    c.lineWidth = 1;
    c.stroke();
  });
  cell(7, (c) => {
    // eine Kette aus Cyanobakterien: Perlen, einzelne dicker
    c.strokeStyle = 'rgba(150,210,170,0.5)';
    c.lineWidth = 1;
    const pts: number[][] = [];
    for (let i = 0; i < 9; i++) pts.push([-17 + i * 4.3, Math.sin(i * 0.9) * 5]);
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    pts.forEach(([x, y], i) => {
      c.beginPath();
      c.arc(x, y, i === 3 || i === 7 ? 3.2 : 2.3, 0, TAU);
      c.fillStyle = i === 3 || i === 7 ? 'rgba(236,246,160,0.95)' : 'rgba(150,224,176,0.85)';
      c.fill();
    });
  });
  cell(8, (c) => {
    c.beginPath();
    c.arc(0, 0, 2.2, 0, TAU);
    c.fillStyle = 'rgba(236,244,240,0.85)';
    c.fill();
  });
  cell(9, (c) => {
    c.beginPath();
    c.ellipse(0, 0, 3.4, 2, 0.5, 0, TAU);
    c.fillStyle = 'rgba(230,226,208,0.8)';
    c.fill();
  });
  cell(10, (c) => {
    glow(c, 14, 'rgba(200,255,240,0.4)');
    c.beginPath();
    c.arc(0, 0, 1.6, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.fill();
  });
  const t = scene.textures.addCanvas(key, cv)!;
  PLANKTON_FRAMES.forEach((n, i) => t.add(n, 0, (i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL));
  return key;
}

const GCELL = 112;

/** Treibende Kolonien graptolithenartiger Tiere: dünne, gesägte Äste in Bernsteinbraun. */
export function graptoAtlas(scene: Phaser.Scene) {
  const key = 'grapto';
  if (scene.textures.exists(key)) return key;
  const cols = 3, rows = 2;
  const [cv, ctx] = newCanvas(cols * GCELL, rows * GCELL);
  const cell = (i: number, draw: (c: Ctx) => void) => {
    ctx.save();
    ctx.translate((i % cols) * GCELL + GCELL / 2, Math.floor(i / cols) * GCELL + GCELL / 2);
    draw(ctx);
    ctx.restore();
  };
  /** Ein Ast: dünner Stiel mit sägeartigen Zähnchen (Theken) an einer oder an beiden Seiten. */
  const rod = (c: Ctx, pts: number[][], both: boolean, tooth = 3.4, step = 3) => {
    c.strokeStyle = 'rgba(96,68,32,0.95)';
    c.lineWidth = 1.6;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    c.strokeStyle = 'rgba(214,170,98,0.95)';
    c.lineWidth = 1.1;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
      for (let d = step - acc; d < len; d += step) {
        const px = x0 + Math.cos(a) * d, py = y0 + Math.sin(a) * d;
        for (const s of both ? [-1, 1] : [1]) {
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px + Math.cos(a + s * 1.1) * tooth, py + Math.sin(a + s * 1.1) * tooth);
          c.stroke();
        }
        acc = len - d;
      }
      acc = (acc + 0) % step;
    }
  };
  cell(0, (c) => {
    // Didymograptus: zwei Äste wie eine Stimmgabel
    for (const s of [-1, 1]) rod(c, qpts(0, 30, s * 12, 8, s * 38, -28, 16), false, 3.6, 3.2);
    c.beginPath();
    c.arc(0, 30, 2.4, 0, TAU);
    c.fillStyle = 'rgba(96,68,32,0.95)';
    c.fill();
  });
  cell(1, (c) => {
    // Monograptus: ein einzelner, geschwungener Stab
    rod(c, qpts(-34, 30, -4, 24, 8, -34, 22), false, 3.6, 3);
  });
  cell(2, (c) => {
    // Dichograptus: acht Äste, strahlig, mit Gabelungen
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const x1 = Math.cos(a) * 22, y1 = Math.sin(a) * 22;
      rod(c, qpts(0, 0, x1 * 0.5, y1 * 0.5, x1, y1, 6), false, 2.6, 3.4);
      for (const s of [-1, 1]) {
        const a2 = a + s * 0.45;
        rod(c, qpts(x1, y1, x1 + Math.cos(a2) * 10, y1 + Math.sin(a2) * 10, x1 + Math.cos(a2) * 22, y1 + Math.sin(a2) * 22, 6), false, 2.4, 3.6);
      }
    }
    c.beginPath();
    c.arc(0, 0, 3, 0, TAU);
    c.fillStyle = 'rgba(96,68,32,0.95)';
    c.fill();
  });
  cell(3, (c) => {
    // Tetragraptus: vier Äste im Kreuz
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.35;
      rod(c, qpts(0, 0, Math.cos(a) * 14 + Math.cos(a + 1.5) * 4, Math.sin(a) * 14 + Math.sin(a + 1.5) * 4, Math.cos(a) * 38, Math.sin(a) * 38, 12), false, 3.4, 3.4);
    }
    c.beginPath();
    c.arc(0, 0, 2.6, 0, TAU);
    c.fillStyle = 'rgba(96,68,32,0.95)';
    c.fill();
  });
  cell(4, (c) => {
    // Dictyonema: ein trichterförmiges Netz
    c.translate(0, 26);
    for (let i = 0; i <= 9; i++) {
      const a = -Math.PI / 2 - 0.85 + (i / 9) * 1.7;
      rod(c, [[0, 0], [Math.cos(a) * 54, Math.sin(a) * 54]], false, 2.2, 4);
    }
    c.strokeStyle = 'rgba(160,122,64,0.8)';
    c.lineWidth = 0.9;
    for (let r = 14; r < 56; r += 7) {
      c.beginPath();
      c.arc(0, 0, r, -Math.PI / 2 - 0.85, -Math.PI / 2 + 0.85);
      c.stroke();
    }
  });
  cell(5, (c) => {
    // Diplograptus: ein spindelförmiger Stab, beidseitig gesägt
    const pts: number[][] = [];
    for (let i = 0; i <= 14; i++) pts.push([-4 + i * 0.4 + Math.sin(i * 0.3) * 2, 36 - i * 5]);
    rod(c, pts, true, 3.2, 3.2);
  });
  const t = scene.textures.addCanvas(key, cv)!;
  GRAPTO_FRAMES.forEach((n, i) => t.add(n, 0, (i % cols) * GCELL, Math.floor(i / cols) * GCELL, GCELL, GCELL));
  return key;
}
