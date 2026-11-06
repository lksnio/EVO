import type Phaser from 'phaser';
import { W, H } from '../config';
import { ell, fillStroke, rgrad, smooth, tex, vgrad, type Ctx } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';
import { pattern } from './paint';

// ---------------------------------------------------------------------------
// Die Weltkarte des frühen Perms (OverworldScene): eine alte, dunkle Karte der Gegend am Rand von Pangaea.
// Oben links das offene Meer mit der Tiefe, an der Küste die Lagune hinter ihrem Riff und die Mündung des Laichflusses,
// den Fluss hinauf der Ufersumpf, rechts das trockene, rote Hochland. Die Lage der Orte kommt aus PlaceDef.map
// (0..1 im Kartenfeld); Küste, Fluss und Landschaften sind darauf abgestimmt.
// ---------------------------------------------------------------------------

/** Das Kartenfeld auf dem Bildschirm (oben Titel, unten die Auskunft über den gewählten Ort) */
export const MAP_RECT = { x: 70, y: 92, w: 1140, h: 470 };

/** Kartenkoordinate (0..1) → Bildschirm */
export const mapPos = (m: readonly [number, number]): [number, number] => [MAP_RECT.x + m[0] * MAP_RECT.w, MAP_RECT.y + m[1] * MAP_RECT.h];

const P = (x: number, y: number) => mapPos([x, y]);

/** Die Küste von oben bis an den linken Rand: rechts bzw. unterhalb liegt Land */
const COAST: [number, number][] = [
  [0.74, -0.2], [0.7, 0.04], [0.64, 0.16], [0.58, 0.27], [0.53, 0.4], [0.47, 0.5], [0.4, 0.54], [0.32, 0.53],
  [0.26, 0.6], [0.2, 0.7], [0.15, 0.71], [0.1, 0.72], [0.04, 0.78], [-0.1, 0.84],
];
/** Der Fluss: aus dem Hochland durch den Sumpf zur Mündung am Laichfluss */
const RIVER: [number, number][] = [[1.04, 0.78], [0.92, 0.66], [0.82, 0.7], [0.72, 0.66], [0.62, 0.66], [0.5, 0.74], [0.38, 0.76], [0.26, 0.72], [0.16, 0.7], [0.11, 0.69]];

function blob(ctx: Ctx, r: Rng, x: number, y: number, rx: number, ry: number, n = 9) {
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + r() * 0.4;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  smooth(ctx, pts, true);
}

/** das Land als Fläche (die Küste, dann außen herum über die rechte untere Ecke) */
function landPath(ctx: Ctx) {
  const pts = COAST.map(([x, y]) => P(x, y));
  const [bx, by] = P(-0.2, 1.4), [cx, cy] = P(1.3, 1.4), [dx, dy] = P(1.3, -0.3);
  smooth(ctx, [...pts, [bx, by], [cx, cy], [dx, dy]], true);
}

/** Wellenstriche im Meer – dichter und heller an der Küste */
function waves(ctx: Ctx, r: Rng) {
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H;
    const w = 8 + r() * 16;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 3.5, x + w, y);
    ctx.strokeStyle = `rgba(170,214,214,${0.04 + r() * 0.05})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

/** ein Grasbüschel des Sumpfes */
function reed(ctx: Ctx, r: Rng, x: number, y: number, s: number) {
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * 1.6 * s, y);
    ctx.quadraticCurveTo(x + k * 2.4 * s, y - 6 * s, x + k * 3.6 * s + (r() - 0.5) * 2, y - (9 + r() * 4) * s);
    ctx.strokeStyle = 'rgba(150,170,96,.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** ein Höhenzug als Reihe von Schraffur-Kegeln (wie auf alten Karten) */
function hills(ctx: Ctx, r: Rng, x0: number, y0: number, n: number, step: number, size: number) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step + (r() - 0.5) * step * 0.4, y = y0 + (r() - 0.5) * 10;
    const s = size * (0.7 + r() * 0.5);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.95, x, y - s);
    ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.9, x + s, y);
    ctx.fillStyle = 'rgba(120,52,26,.55)';
    ctx.fill();
    // Schattenseite: Schraffur
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (k / 5) * s * 0.9, y - s * (1 - k / 5) * 0.95);
      ctx.lineTo(x + (k / 5) * s * 0.55, y);
      ctx.strokeStyle = 'rgba(40,14,6,.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.95, x, y - s);
    ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.9, x + s, y);
    ctx.strokeStyle = 'rgba(232,160,110,.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** ein Samenfarn als kleines Kartenzeichen */
function fern(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 12 * s);
  ctx.strokeStyle = 'rgba(40,24,12,.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 12 * s);
    ctx.quadraticCurveTo(x + d * 6 * s, y - 15 * s, x + d * 9 * s, y - 9 * s);
    ctx.strokeStyle = 'rgba(96,104,44,.7)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

/** Die gemalte Karte (einmal je Zeitalter gebacken). */
export function overworldTexture(scene: Phaser.Scene, epId: string) {
  return tex(scene, `overworld_${epId}`, W, H, (ctx) => {
    const r = mulberry32(2950);
    // Meer: oben links am tiefsten
    ctx.fillStyle = rgrad(ctx, W * 0.42, H * 0.62, 60, 980, [[0, '#1b4248'], [0.45, '#0f2a32'], [1, '#050f14']]);
    ctx.fillRect(0, 0, W, H);
    waves(ctx, r);

    // Die Tiefe: ein dunkles Becken mit Tiefenlinien
    const [tx, ty] = P(0.3, 0.13);
    ctx.fillStyle = rgrad(ctx, tx, ty, 6, 170, [[0, 'rgba(0,4,10,.95)'], [0.55, 'rgba(2,12,22,.6)'], [1, 'rgba(2,12,22,0)']]);
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 5; k++) {
      ell(ctx, tx + k * 3, ty + k * 2, 150 - k * 26, 70 - k * 12, -0.12);
      ctx.strokeStyle = `rgba(110,170,190,${0.07 + k * 0.025})`;
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Flachwasser entlang der Küste (heller Saum)
    ctx.save();
    landPath(ctx);
    ctx.shadowColor = 'rgba(90,170,170,.55)';
    ctx.shadowBlur = 46;
    ctx.fillStyle = '#2a4a46';
    ctx.fill();
    ctx.restore();

    // Land
    ctx.save();
    landPath(ctx);
    ctx.fillStyle = vgrad(ctx, H * 0.1, H, [[0, '#3c3020'], [0.5, '#3a2e1c'], [1, '#2a2014']]);
    ctx.fill();
    ctx.clip();
    // Flecken in Ocker und Erde
    for (let i = 0; i < 70; i++) {
      blob(ctx, r, r() * W, r() * H, 30 + r() * 60, 18 + r() * 40);
      ctx.fillStyle = r() < 0.5 ? 'rgba(70,56,30,.28)' : 'rgba(24,18,10,.25)';
      ctx.fill();
    }
    // Hochland: rote Erde, nach rechts oben hin
    const [hx, hy] = P(0.86, 0.36);
    ctx.fillStyle = rgrad(ctx, hx, hy, 20, 380, [[0, 'rgba(150,62,30,.8)'], [0.5, 'rgba(120,52,26,.5)'], [1, 'rgba(120,52,26,0)']]);
    ctx.fillRect(0, 0, W, H);
    // Sumpf: grünlich, mit Tümpeln und Gras
    const [sx, sy] = P(0.62, 0.62);
    ctx.fillStyle = rgrad(ctx, sx, sy, 10, 240, [[0, 'rgba(66,86,40,.85)'], [0.6, 'rgba(56,70,34,.45)'], [1, 'rgba(56,70,34,0)']]);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 30 + r() * 150;
      const x = sx + Math.cos(a) * d * 1.3, y = sy + Math.sin(a) * d * 0.55;
      ell(ctx, x, y, 6 + r() * 12, 3 + r() * 5);
      fillStroke(ctx, 'rgba(36,70,70,.75)', 'rgba(10,20,14,.6)', 1);
    }
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = 20 + r() * 170;
      reed(ctx, r, sx + Math.cos(a) * d * 1.3, sy + Math.sin(a) * d * 0.6, 0.8 + r() * 0.5);
    }
    // Höhenzüge und Samenfarne im Hochland
    hills(ctx, r, hx - 150, hy - 50, 6, 52, 26);
    hills(ctx, r, hx - 90, hy + 70, 5, 50, 22);
    hills(ctx, r, hx - 220, hy + 20, 3, 46, 18);
    for (let i = 0; i < 14; i++) fern(ctx, hx - 160 + r() * 300, hy - 10 + r() * 150, 0.8 + r() * 0.4);
    // Der Fluss
    const river = RIVER.map(([x, y]) => P(x, y));
    for (const [lw, col] of [[16, 'rgba(14,26,24,.85)'], [10, '#2e5a5a'], [3, 'rgba(170,220,210,.25)']] as const) {
      smooth(ctx, river, false);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // Küstenlinie: doppelt, wie gestochen
    ctx.save();
    smooth(ctx, COAST.map(([x, y]) => P(x, y)), false);
    ctx.strokeStyle = 'rgba(8,8,6,.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    smooth(ctx, COAST.map(([x, y]) => P(x + 0.004, y - 0.008)), false);
    ctx.strokeStyle = 'rgba(220,200,150,.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Die Lagune: helles, warmes Wasser hinter einem Riffbogen
    const [lx, ly] = P(0.38, 0.4);
    ctx.fillStyle = rgrad(ctx, lx, ly, 8, 120, [[0, 'rgba(90,190,180,.55)'], [0.6, 'rgba(60,150,150,.3)'], [1, 'rgba(60,150,150,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.ellipse(lx - 6, ly + 4, 118, 64, -0.18, Math.PI * 0.95, Math.PI * 2.08);
    ctx.strokeStyle = 'rgba(232,170,140,.5)';
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * (0.98 + r() * 1.06);
      ell(ctx, lx - 6 + Math.cos(a) * 118, ly + 4 + Math.sin(a) * 64, 2.5 + r() * 2.5, 2 + r() * 2);
      ctx.fillStyle = 'rgba(240,160,130,.55)';
      ctx.fill();
    }

    // Kompassrose unten rechts im Kartenfeld
    const [cx, cy] = [W - 92, H - 196];
    ctx.save();
    ctx.translate(cx, cy);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fillStyle = k === 3 ? 'rgba(200,145,60,.75)' : 'rgba(200,180,140,.35)';
      ctx.fill();
    }
    ell(ctx, 0, 0, 18, 18);
    ctx.strokeStyle = 'rgba(200,145,60,.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // altes Papier: Fleckigkeit, Korn, dunkler Rand
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = pattern(ctx, 'mottle', 2);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = pattern(ctx, 'grain', 1);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = rgrad(ctx, W / 2, H / 2, 300, 860, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.72)']]);
    ctx.fillRect(0, 0, W, H);
  });
}
