import type Phaser from 'phaser';
import { newCanvas } from '../util/canvas';

// ---------------------------------------------------------------------------
// Der Tusche-Filter: macht aus einem vorhandenen, gemalten Bild (Pflanze, Koralle, Laich, Muschel …) eine Zeichnung im Tuschestil
// des Devons (art/ink.ts): Die Farbe wird leicht verwischt und danach in wenige Helligkeitsstufen zerlegt – statt Verläufen und
// Rauschen bleiben ruhige Flächen mit harten Schattenkanten –, die Farben rücken ins kühle Blaugrün des Wassers, und um die
// Silhouette läuft eine dunkle Kontur. Die Bilder bleiben, wie sie sind; es entsteht je Bild ein zweites mit dem Namen ink_<Schlüssel>.
// ---------------------------------------------------------------------------

export interface InkOpts {
  /** so viele Helligkeitsstufen (Standard 4) */
  bands?: number;
  /** Breite der Kontur in Bildpunkten (Standard nach der Größe des Bildes) */
  outline?: number;
  /** steht auf dem Boden: unten keine Kontur und kein Rand (das Bild bleibt am Boden verankert) */
  floor?: boolean;
  /** Farbsättigung (Standard 1,08) */
  sat?: number;
  /** wie weit die Farben ins Blaugrün des Wassers rücken (Standard 0,1) */
  water?: number;
  /** Helligkeit (Standard 1) */
  gain?: number;
}

/** die Tusche (wie INK in art/ink.ts) */
const INKRGB = [6, 9, 12];
const WATER = [63, 106, 114];

/** Eine Tusche-Fassung eines vorhandenen Bildes (einmalig je Schlüssel). Gibt deren Schlüssel zurück – oder den alten, wenn es kein Bild gibt. */
export function inkTexture(scene: Phaser.Scene, key: string, o: InkOpts = {}): string {
  const out = 'ink_' + key;
  if (scene.textures.exists(out)) return out;
  if (!scene.textures.exists(key)) return key;
  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
  const w = src.width, h = src.height;
  const R = o.outline ?? (Math.max(w, h) < 64 ? 1 : Math.max(w, h) < 150 ? 2 : 3);
  const floor = o.floor ?? true;
  const W = w + 2 * R, H = h + R + (floor ? 0 : R);
  const [cv, ctx] = newCanvas(W, H, true);
  ctx.drawImage(src, R, R);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const N = o.bands ?? 4, sat = o.sat ?? 1.08, wt = o.water ?? 0.1, gain = o.gain ?? 1;

  // 1. die Farbe leicht verwischen (3×3, nach Deckkraft gewichtet) – so verschwindet das Rauschen
  const col = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, ws = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const i = (yy * W + xx) * 4;
          const wgt = d[i + 3] * (dx || dy ? 1 : 2);
          r += d[i] * wgt;
          g += d[i + 1] * wgt;
          b += d[i + 2] * wgt;
          ws += wgt;
        }
      }
      const j = (y * W + x) * 3;
      if (ws > 0) {
        col[j] = r / ws;
        col[j + 1] = g / ws;
        col[j + 2] = b / ws;
      }
    }
  }
  // 2. in Stufen zerlegen, ins Wasser rücken
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (d[i + 3] === 0) continue;
    let r = col[p * 3], g = col[p * 3 + 1], b = col[p * 3 + 2];
    const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const lq = (Math.floor(Math.min(0.999, l) * N) + 0.5) / N;
    const f = Math.max(0.55, Math.min(1.9, (lq / Math.max(0.03, l)) * gain));
    r *= f;
    g *= f;
    b *= f;
    const m = 0.3 * r + 0.59 * g + 0.11 * b;
    r = m + (r - m) * sat;
    g = m + (g - m) * sat;
    b = m + (b - m) * sat;
    r += (WATER[0] - r) * wt;
    g += (WATER[1] - g) * wt;
    b += (WATER[2] - b) * wt;
    d[i] = Math.max(0, Math.min(255, r));
    d[i + 1] = Math.max(0, Math.min(255, g));
    d[i + 2] = Math.max(0, Math.min(255, b));
    // fast durchsichtige Ränder (Anti-Aliasing) werden deckend oder fallen weg: Eine Zeichnung hat keine weichen Kanten
    d[i + 3] = d[i + 3] > 70 ? 255 : 0;
  }
  // 3. die Kontur: die Fläche R-mal um einen Bildpunkt verbreitern (abwechselnd Kreuz und Quadrat – ergibt eine runde Form)
  const mask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) mask[p] = d[p * 4 + 3] > 0 ? 1 : 0;
  let grow = mask.slice();
  for (let pass = 0; pass < R; pass++) {
    const next = grow.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grow[y * W + x]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((pass % 2 === 0) && dx && dy) continue;
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < W && yy >= 0 && yy < H && grow[yy * W + xx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) next[y * W + x] = 1;
      }
    }
    grow = next;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      if (!mask[p] && grow[p] && !(floor && y >= H - 1)) {
        d[i] = INKRGB[0];
        d[i + 1] = INKRGB[1];
        d[i + 2] = INKRGB[2];
        d[i + 3] = 255;
      } else if (mask[p]) {
        // der innerste Rand der Fläche wird etwas dunkler: so sitzt die Kontur fest
        let edge = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H && !mask[yy * W + xx]) edge = true;
        }
        if (edge) {
          d[i] = d[i] * 0.55 + INKRGB[0] * 0.45;
          d[i + 1] = d[i + 1] * 0.55 + INKRGB[1] * 0.45;
          d[i + 2] = d[i + 2] * 0.55 + INKRGB[2] * 0.45;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(out, cv);
  return out;
}
