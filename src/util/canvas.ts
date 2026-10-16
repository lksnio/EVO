import Phaser from 'phaser';

// Alle Grafiken im Spiel werden zur Laufzeit mit Canvas 2D gezeichnet
// und als Phaser-Texturen registriert – es gibt keine Bilddateien.

export type Ctx = CanvasRenderingContext2D;

export function newCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

export function addTex(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Erzeugt eine Textur (nur beim ersten Aufruf) und gibt den Schlüssel zurück. */
export function tex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
  res = 1,
): string {
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = newCanvas(w * res, h * res);
  ctx.scale(res, res);
  draw(ctx, w, h);
  scene.textures.addCanvas(key, c);
  return key;
}

export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Weiche Kurve durch Punkte (Catmull-Rom). */
export function smooth(ctx: Ctx, pts: number[][], closed = true) {
  const n = pts.length;
  ctx.beginPath();
  if (n < 2) return;
  const p = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}

export function fillStroke(ctx: Ctx, fill?: string | CanvasGradient, stroke?: string, lw = 2) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][], x = 0) {
  const g = ctx.createLinearGradient(x, y0, x, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rgrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Zeichnet etwas horizontal nahtlos kachelbar (für Hintergründe). */
export function wrapX(w: number, x: number, r: number, fn: (x: number) => void) {
  fn(x);
  if (x - r < 0) fn(x + w);
  if (x + r > w) fn(x - w);
}

/** Schneidet mehrere gleich große Canvas auf die gemeinsame sichtbare Fläche zu. */
export function trimCanvases(cs: HTMLCanvasElement[], pad = 2) {
  const w = cs[0].width, h = cs[0].height;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (const c of cs) {
    const d = c.getContext('2d')!.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < x0) return { canvases: cs, x: 0, y: 0, w, h };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const out = cs.map((c) => {
    const [o, octx] = newCanvas(tw, th);
    octx.drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
    return o;
  });
  return { canvases: out, x: x0, y: y0, w: tw, h: th };
}
