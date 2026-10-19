import Phaser from 'phaser';
import { W, H } from '../config';
import { type Ctx, rgrad, tex } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';
import type { PlaceKind } from '../data/world';

// Die Weltkarte: Maße, Lage der Punkte und das Gebiet um jeden Ort.
// Die Urzeit-Erde selbst (Land und Meer) zeichnet paleoArt.ts.

/** Kartenfläche (ohne Rahmen). */
export const MAP_BOX = { x: 70, y: 96, w: W - 140, h: H - 218 };

/**
 * Wie weit die Karte herausgezoomt ist: Die Orte der Fischzeit (Koordinaten 0..1) liegen nur in der Mitte der Kartenfläche,
 * ringsum liegt noch viel Welt – später sind hier auch Wege an Land nötig. Das Tier und die Punkte sind entsprechend klein.
 */
export const MAP_ZOOM = 0.46;

/** Lage eines Punktes der Urzeit-Karte (0..1 = das Gebiet der Orte) in Bildschirmkoordinaten. */
export const mapPos = (x: number, y: number) => ({
  x: MAP_BOX.x + MAP_BOX.w / 2 + (x - 0.5) * (MAP_BOX.w - 60) * MAP_ZOOM,
  y: MAP_BOX.y + MAP_BOX.h / 2 + (y - 0.5) * (MAP_BOX.h - 48) * MAP_ZOOM,
});

function blobs(ctx: Ctx, rnd: Rng, n: number, rMin: number, rMax: number, col: (a: number) => string, aMax: number, box = { x: 0, y: 0, w: W, h: H }) {
  for (let i = 0; i < n; i++) {
    const x = box.x + rnd() * box.w, y = box.y + rnd() * box.h, r = rMin + rnd() * (rMax - rMin);
    ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, col(aMax * (0.4 + rnd() * 0.6))], [1, col(0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
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
      blobs(ctx, rnd, 5, 30, 70, (a) => `rgba(190,235,215,${a})`, 0.16, { x: 70, y: 70, w: S - 140, h: S - 140 });
    } else if (kind === 'lush') {
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, 'rgba(60,160,90,0.45)'], [1, 'rgba(40,120,70,0)']]);
      ctx.fillRect(0, 0, S, S);
      // Tang: lange, wiegende Halme
      for (let i = 0; i < 26; i++) {
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
      blobs(ctx, rnd, 9, 36, 80, (a) => `rgba(120,110,60,${a})`, 0.3, { x: 60, y: 60, w: S - 120, h: S - 120 });
    } else {
      // Tiefe: Höhenlinien, die zur Mitte hin dunkler werden
      const deep = kind === 'abyss';
      ctx.fillStyle = rgrad(ctx, c, c, 0, S * 0.5, [[0, deep ? 'rgba(0,2,6,0.95)' : 'rgba(2,10,22,0.8)'], [0.6, deep ? 'rgba(0,6,14,0.6)' : 'rgba(4,20,40,0.45)'], [1, 'rgba(4,20,40,0)']]);
      ctx.fillRect(0, 0, S, S);
      const rings = deep ? 4 : 3;
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
        for (let i = 0; i < 4; i++) {
          const a = rnd() * 6.28, d = rnd() * 60;
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
