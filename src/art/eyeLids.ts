import type Phaser from 'phaser';
import { clamp } from '../util/math';

/** Hautfarbene Lider: beim Angriff senkt sich die Braue zur Schnauze, beim Schlafen schließen beide Lider gerade. */
export function drawEyeLids(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number,
  skin: number, edge: number, closed: number, attack: number) {
  g.clear();
  const sleep = clamp(closed, 0, 1), glare = clamp(attack, 0, 1);
  if (Math.max(sleep, glare) <= 0.01) return;
  const up = r * Math.max(-1 + 1.25 * sleep, -1 + 1.12 * glare);
  const low = r * Math.min(1 - 0.75 * sleep, 1 - 0.14 * glare);
  // Die Neigung verschwindet beim Einschlafen, damit Ober- und Unterlid lückenlos schließen.
  const tilt = 0.48 * glare * (1 - sleep);
  const point = (a: number, b: number, angle: number) => ({
    x: x + a * Math.cos(angle) - b * Math.sin(angle),
    y: y + a * Math.sin(angle) + b * Math.cos(angle),
  });
  const cap = (height: number, above: boolean, angle: number) => {
    const v = Math.asin(clamp(height / r, -1, 1));
    const a0 = above ? v : Math.PI - v, a1 = above ? -Math.PI - v : v;
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = a0 + (a1 - a0) * i / 16;
      const p = point(Math.cos(a) * r, Math.sin(a) * r, angle);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.closePath();
    g.fillPath();
  };
  g.fillStyle(skin, 1);
  cap(up, true, tilt);
  cap(low, false, 0);
  const w = Math.sqrt(Math.max(0, r * r - up * up));
  const a = point(-w, up, tilt), b = point(w, up, tilt);
  g.lineStyle(Math.max(0.6, r * 0.16), edge, 0.9);
  g.lineBetween(a.x, a.y, b.x, b.y);
}
