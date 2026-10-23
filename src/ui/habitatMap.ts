import Phaser from 'phaser';
import { UI } from '../config';
import { game } from '../state/GameState';
import { WORLD } from '../data/life';
import { oceanChart } from '../level/oceanChart';
import { habitatExtent } from '../sim/habitat';
import { text } from './ui';

/** Wasserquerschnitt: Rot ist der mit der eigenen Stärke wachsende Lebensraum, der helle Punkt ist das Tier. */
export function habitatMap(scene: Phaser.Scene, x: number, y: number, w: number, h: number, position: { x: number; y: number }) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  c.add(g);
  const chart = oceanChart(game.epoch, WORLD.seed);
  if (!chart.sections.length) return c;
  const top = 30, bottom = h - 12, plotH = bottom - top;
  const sx = w / chart.width, sy = plotH / chart.depth;
  const reach = chart.width * habitatExtent(game.gain(), game.upTrail.length);
  g.fillGradientStyle(0x12303a, 0x12303a, 0x030b12, 0x030b12, 1);
  g.fillRect(0, 0, w, h);
  const current = chart.sections.find((s) => s.id === game.prog.place) ?? chart.sections[0];
  chart.sections.forEach((s, i) => {
    const left = s.x * sx, right = (s.x + s.width) * sx;
    c.add(text(scene, (left + right) / 2, 14, ['Laichfluss', 'Flachwasser', 'Tiefental'][i], 12, s === current ? UI.bone : '#80969b').setOrigin(0.5));
    // Schmale Spalten clippen das rote Gebiet exakt ans Wasser, ohne Maske oder zusätzlichen Render-Pass.
    const step = s.width / s.ground.length;
    s.ground.forEach((floor, col) => {
      const wx = s.x + col * step, px = wx * sx;
      const fy = Math.max(top, Math.min(bottom, top + (floor - s.surface) * sy));
      const pw = Math.min((col + 1) * step + s.x, chart.width) * sx - px + 0.25;
      g.fillStyle(0x211f1a, 1);
      g.fillRect(px, fy, pw, h - fy);
      const rw = Math.min(step, reach - wx) * sx;
      if (rw > 0) {
        g.fillStyle(0xa33639, 0.52);
        g.fillRect(px, top, rw, fy - top);
      }
    });
    g.lineStyle(1, 0x8e8b6c, 0.7);
    g.beginPath();
    s.ground.forEach((floor, col) => {
      const px = (s.x + (col + 0.5) * step) * sx;
      const py = Math.max(top, Math.min(bottom, top + (floor - s.surface) * sy));
      if (!col) g.moveTo(px, py); else g.lineTo(px, py);
    });
    g.strokePath();
    if (i) {
      g.lineStyle(1, 0x9abac0, 0.13);
      g.lineBetween(left, top, left, bottom);
    }
    if (s.roe) {
      g.fillStyle(0xc8913c, 1);
      g.fillCircle((s.x + s.roe.x) * sx, top + (s.roe.y - s.surface) * sy, 2.5);
    }
  });
  g.lineStyle(1, 0x8db5c1, 0.6);
  g.lineBetween(0, top, w, top);
  const px = Phaser.Math.Clamp((current.x + position.x) * sx, 4, w - 4);
  const py = Phaser.Math.Clamp(top + (position.y - current.surface) * sy, top + 4, bottom - 4);
  g.lineStyle(1, 0xeee8d3, 0.4);
  g.strokeCircle(px, py, 6);
  g.fillStyle(0xfff7de, 1);
  g.fillCircle(px, py, 2.5);
  g.lineStyle(1, 0xc8913c, 0.25);
  g.strokeRoundedRect(0, 0, w, h, 5);
  return c;
}
