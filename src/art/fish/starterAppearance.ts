import { INK } from '../ink';
import { newCanvas } from '../../util/canvas';

/** Matte ink colour: retain the painted hue and fine lines, compress the silvery glare into the fauna's midtones. */
export function starterInkColor(rgb: number): number {
  const r = rgb >>> 16 & 255, g = rgb >>> 8 & 255, b = rgb & 255;
  const lum = .3 * r + .59 * g + .11 * b;
  if (lum < 34) return rgb;
  const matte = lum - Math.max(0, lum - 135) * .27;
  const channel = (v: number, water: number) => Math.max(0, Math.min(255, Math.round((matte + (v - lum) * .78) * .94 + water * .06)));
  return channel(r, 63) << 16 | channel(g, 106) << 8 | channel(b, 114);
}

/** One shared treatment per form, before articulation. Never outline jaw cuts or add effects every frame. */
export function starterInkPainting(source: HTMLImageElement | HTMLCanvasElement, worldWidth: number) {
  const [paint, p] = newCanvas(source.width, source.height, true);
  p.drawImage(source, 0, 0);
  const pixels = p.getImageData(0, 0, paint.width, paint.height), d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 8) { d[i + 3] = 0; continue; }
    const color = starterInkColor(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
    d[i] = color >>> 16; d[i + 1] = color >>> 8 & 255; d[i + 2] = color & 255;
  }
  p.putImageData(pixels, 0, 0);
  const [mask, m] = newCanvas(paint.width, paint.height);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = INK >>> 16; d[i + 1] = INK >>> 8 & 255; d[i + 2] = INK & 255;
    // WebP masters contain faint transparent fringes. Repeatedly outlining those would build a rectangular dark veil.
    d[i + 3] = Math.round(Math.max(0, Math.min(1, (d[i + 3] - 48) / 144)) * 255);
  }
  m.putImageData(pixels, 0, 0);
  const [canvas, c] = newCanvas(paint.width, paint.height);
  // The same dark blue-green contour as the other Devon animals, measured in game units at any source resolution.
  const radius = .62 * paint.width / worldWidth;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    c.drawImage(mask, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  c.drawImage(paint, 0, 0); mask.width = mask.height = paint.width = paint.height = 1;
  return canvas;
}
