import Phaser from 'phaser';
import { W, H } from '../config';
import { type Ctx, rgrad, tex, vgrad } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';
import type { PlaceKind } from '../data/world';

// Die Weltkarte, von oben gesehen: dunkles Meer mit Untiefen, Inseln und einem steinernen Rahmen.
// Jeder Ort bekommt sein eigenes Stück Meer, das sich erst zeigt, wenn man ihn kennt.

/** Kartenfläche (ohne Rahmen). */
export const MAP_BOX = { x: 70, y: 96, w: W - 140, h: H - 218 };

/** Lage eines Ortes (0..1) in Bildschirmkoordinaten. */
export const mapPos = (x: number, y: number) => ({ x: MAP_BOX.x + 60 + x * (MAP_BOX.w - 120), y: MAP_BOX.y + 50 + y * (MAP_BOX.h - 100) });

function blobs(ctx: Ctx, rnd: Rng, n: number, rMin: number, rMax: number, col: (a: number) => string, aMax: number, box = { x: 0, y: 0, w: W, h: H }) {
  for (let i = 0; i < n; i++) {
    const x = box.x + rnd() * box.w, y = box.y + rnd() * box.h, r = rMin + rnd() * (rMax - rMin);
    ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, col(aMax * (0.4 + rnd() * 0.6))], [1, col(0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Eine Insel: heller Sand, dunkler Rand, Untiefe ringsum. */
function island(ctx: Ctx, x: number, y: number, r: number, rnd: Rng) {
  const pts: [number, number][] = [];
  const n = 18;
  const ph = rnd() * 6, ph2 = rnd() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.28 * Math.sin(a * 3 + ph) + 0.16 * Math.sin(a * 5 + ph2) + (rnd() - 0.5) * 0.1;
    pts.push([x + Math.cos(a) * r * k * 1.25, y + Math.sin(a) * r * k * 0.8]);
  }
  const path = (grow: number) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const gx = x + (px - x) * grow, gy = y + (py - y) * grow;
      if (i) ctx.lineTo(gx, gy);
      else ctx.moveTo(gx, gy);
    });
    ctx.closePath();
  };
  // Untiefe
  path(1.65);
  ctx.fillStyle = 'rgba(80,150,150,0.16)';
  ctx.fill();
  path(1.35);
  ctx.fillStyle = 'rgba(100,170,160,0.2)';
  ctx.fill();
  path(1.12);
  ctx.fillStyle = 'rgba(150,190,160,0.28)';
  ctx.fill();
  // Land
  path(1);
  ctx.fillStyle = vgrad(ctx, y - r, y + r, [[0, '#8a8260'], [1, '#4a4632']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,10,8,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Bewuchs und Steine
  for (let i = 0; i < 18; i++) {
    const a = rnd() * 6.28, d = rnd() * r * 0.85;
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(62,84,40,0.7)' : 'rgba(30,30,24,0.45)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d * 1.1, y + Math.sin(a) * d * 0.7, 2 + rnd() * 5, 0, 6.28);
    ctx.fill();
  }
}

/** Das Meer mit Inseln, Strömungslinien und dem Rahmen – ohne Orte. */
export function mapBase(scene: Phaser.Scene, key: string, seed: number, avoid: { x: number; y: number }[]) {
  return tex(scene, key, W, H, (ctx) => {
    const rnd = mulberry32(seed * 7919 + 3);
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#103a40'], [0.55, '#0b2830'], [1, '#061820']]);
    ctx.fillRect(0, 0, W, H);
    blobs(ctx, rnd, 60, 90, 260, (a) => `rgba(110,190,180,${a})`, 0.06);
    blobs(ctx, rnd, 40, 80, 240, (a) => `rgba(0,6,10,${a})`, 0.16);
    // Strömungslinien
    ctx.lineCap = 'round';
    for (let i = 0; i < 44; i++) {
      const x = MAP_BOX.x + rnd() * MAP_BOX.w, y = MAP_BOX.y + rnd() * MAP_BOX.h, len = 40 + rnd() * 90;
      ctx.strokeStyle = `rgba(150,220,210,${0.05 + rnd() * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.3, y - 10 - rnd() * 8, x + len * 0.7, y + 10 + rnd() * 8, x + len, y);
      ctx.stroke();
    }
    // Inseln – nicht auf den Orten
    let placed = 0;
    for (let k = 0; k < 80 && placed < 3; k++) {
      const x = MAP_BOX.x + 80 + rnd() * (MAP_BOX.w - 160), y = MAP_BOX.y + 60 + rnd() * (MAP_BOX.h - 120), r = 22 + rnd() * 26;
      if (avoid.some((p) => Math.hypot(p.x - x, p.y - y) < 175 + r)) continue;
      island(ctx, x, y, r, rnd);
      placed++;
    }
    // Rand: dunkel zum Rahmen hin
    ctx.fillStyle = rgrad(ctx, W / 2, H / 2, H * 0.3, H * 0.95, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']]);
    ctx.fillRect(0, 0, W, H);
    // Steinrahmen
    const b = MAP_BOX;
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3c3830';
    ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,248,225,0.2)';
    ctx.strokeRect(b.x - 15, b.y - 15, b.w + 30, b.h + 30);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    ctx.strokeStyle = 'rgba(200,145,60,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
    // Ecken
    for (const [cx, cy] of [[b.x - 8, b.y - 8], [b.x + b.w + 8, b.y - 8], [b.x - 8, b.y + b.h + 8], [b.x + b.w + 8, b.y + b.h + 8]]) {
      ctx.fillStyle = '#4a453b';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,145,60,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

/** Das Stück Meer um einen Ort: Tangwald, Trübung, steil abfallende Tiefe … */
export function placeField(scene: Phaser.Scene, kind: PlaceKind, seed: number) {
  const S = 360;
  return tex(scene, `mapfield_${kind}_${seed % 5}`, S, S, (ctx) => {
    const rnd = mulberry32(seed * 313 + kind.length * 17);
    const c = S / 2;
    ctx.save();
    // weicher Rand
    const mask = () => {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = rgrad(ctx, c, c, S * 0.18, S * 0.5, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(0, 0, S, S);
      ctx.globalCompositeOperation = 'source-over';
    };
    if (kind === 'start') {
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, 'rgba(130,210,196,0.4)'], [1, 'rgba(130,210,196,0)']]);
      ctx.fillRect(0, 0, S, S);
      blobs(ctx, rnd, 14, 20, 60, (a) => `rgba(190,235,215,${a})`, 0.2, { x: 60, y: 60, w: S - 120, h: S - 120 });
    } else if (kind === 'lush') {
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, 'rgba(60,160,90,0.45)'], [1, 'rgba(40,120,70,0)']]);
      ctx.fillRect(0, 0, S, S);
      // Tang: lange, wiegende Halme
      for (let i = 0; i < 70; i++) {
        const a = rnd() * 6.28, d = 20 + rnd() * 120;
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.8;
        const len = 16 + rnd() * 30, sw = (rnd() - 0.5) * 22;
        ctx.strokeStyle = `rgba(${40 + rnd() * 40},${120 + rnd() * 70},${60 + rnd() * 40},${0.45 + rnd() * 0.4})`;
        ctx.lineWidth = 1.8 + rnd() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + sw, y - len * 0.5, x + sw * 0.4, y - len);
        ctx.stroke();
      }
    } else if (kind === 'murky') {
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, 'rgba(112,110,50,0.55)'], [1, 'rgba(90,90,40,0)']]);
      ctx.fillRect(0, 0, S, S);
      blobs(ctx, rnd, 26, 24, 70, (a) => `rgba(120,110,60,${a})`, 0.28, { x: 40, y: 40, w: S - 80, h: S - 80 });
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(190,180,110,${0.1 + rnd() * 0.2})`;
        ctx.fillRect(c + (rnd() - 0.5) * 240, c + (rnd() - 0.5) * 200, 1.5, 1.5);
      }
    } else {
      // Tiefe: Höhenlinien, die zur Mitte hin dunkler werden
      const deep = kind === 'abyss';
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, deep ? 'rgba(0,2,6,0.95)' : 'rgba(2,10,22,0.8)'], [0.6, deep ? 'rgba(0,6,14,0.6)' : 'rgba(4,20,40,0.45)'], [1, 'rgba(4,20,40,0)']]);
      ctx.fillRect(0, 0, S, S);
      const rings = deep ? 6 : 4;
      for (let i = 1; i <= rings; i++) {
        const r = (S * 0.46 * i) / rings;
        ctx.strokeStyle = `rgba(120,170,190,${0.05 + 0.09 * (1 - i / (rings + 1))})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let a = 0; a <= 6.3; a += 0.12) {
          const k = 1 + 0.07 * Math.sin(a * 3 + i) + 0.04 * Math.sin(a * 7 + i * 2);
          const px = c + Math.cos(a) * r * k, py = c + Math.sin(a) * r * k * 0.84;
          if (a) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      if (deep) {
        // Leuchtpunkte aus der Tiefe
        for (let i = 0; i < 9; i++) {
          const a = rnd() * 6.28, d = rnd() * 70;
          ctx.fillStyle = rgrad(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, 0, 7, [[0, 'rgba(120,230,220,0.8)'], [1, 'rgba(120,230,220,0)']]);
          ctx.beginPath();
          ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 7, 0, 6.28);
          ctx.fill();
        }
      }
    }
    mask();
    ctx.restore();
  });
}

/** Zeichen für die Art eines Ortes (hell, wird eingefärbt). */
export function placeIcons(scene: Phaser.Scene) {
  const icon = (kind: PlaceKind, draw: (ctx: Ctx) => void) =>
    tex(scene, `mapicon_${kind}`, 40, 40, (ctx) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.fillStyle = '#efe6d2';
      ctx.strokeStyle = '#efe6d2';
      draw(ctx);
    }, 2);
  icon('start', (ctx) => {
    // Kompassstern
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? 6 : 15;
      ctx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  icon('lush', (ctx) => {
    // drei Halme
    ctx.lineWidth = 3.4;
    for (const [dx, h] of [[-8, 18], [0, 24], [8, 17]]) {
      ctx.beginPath();
      ctx.moveTo(20 + dx * 0.5, 33);
      ctx.quadraticCurveTo(20 + dx * 1.6, 33 - h * 0.5, 20 + dx * 1.2, 33 - h);
      ctx.stroke();
    }
  });
  icon('murky', (ctx) => {
    // Trübung: drei Wellenlinien
    ctx.lineWidth = 3.2;
    for (const y of [13, 21, 29]) {
      ctx.beginPath();
      ctx.moveTo(7, y);
      for (let x = 7; x <= 33; x += 2) ctx.lineTo(x, y + Math.sin(x * 0.5 + y) * 2.4);
      ctx.stroke();
    }
  });
  icon('deep', (ctx) => {
    // Abwärtspfeile
    ctx.lineWidth = 3.8;
    for (const y of [9, 20]) {
      ctx.beginPath();
      ctx.moveTo(9, y);
      ctx.lineTo(20, y + 11);
      ctx.lineTo(31, y);
      ctx.stroke();
    }
  });
  icon('abyss', (ctx) => {
    // ein Auge in der Dunkelheit
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(5, 20);
    ctx.quadraticCurveTo(20, 4, 35, 20);
    ctx.quadraticCurveTo(20, 36, 5, 20);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(20, 20, 6, 0, 6.28);
    ctx.fill();
  });
}

export function mapTextures(scene: Phaser.Scene) {
  placeIcons(scene);
}
