import Phaser from 'phaser';
import { ell, tex } from '../util/canvas';

// Die Muschel: als Fund im Level, im Titelbild und in der Übersicht (Taste C).

/**
 * Eine Spiralmuschel, ganz schlicht: cremeweiß, von oben nach unten immer größere Windungen, unten
 * die rosa Mündung, ein heller Fleck. Dazu ein flacher Schatten – kein Leuchten.
 */
export function shellTexture(scene: Phaser.Scene) {
  tex(scene, 'shell', 44, 48, (ctx) => {
    const OUT = '#8a5d58', CREAM = '#f5e8d3', CREAM2 = '#e8d2b8', PINK = '#eaa9a1', DEEP = '#b9726d';
    // flacher Schatten auf dem Boden
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ell(ctx, 23, 44, 15, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(22, 25);
    ctx.rotate(0.16);
    // Windungen von der Spitze (oben) zur großen Windung (unten)
    const whorls: [number, number, number, number][] = [
      [-4, -19, 3.6, 3.1],
      [-3.4, -13.6, 6, 4.8],
      [-2, -6.2, 9, 6.6],
      [0.5, 3.2, 12.6, 9.4],
    ];
    for (const [x, y, rx, ry] of whorls) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.06, 0, Math.PI * 2);
      ctx.fillStyle = CREAM;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // Schattenseite der Windung (unten rechts)
      ctx.beginPath();
      ctx.ellipse(x + rx * 0.1, y + ry * 0.16, rx * 0.86, ry * 0.8, -0.06, 0.15, Math.PI * 0.85);
      ctx.strokeStyle = CREAM2;
      ctx.lineWidth = Math.max(1.5, ry * 0.34);
      ctx.stroke();
    }
    // Rippen quer über die große Windung
    ctx.strokeStyle = 'rgba(138,93,88,0.5)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const x = -8 + i * 4.6;
      ctx.beginPath();
      ctx.moveTo(x, -4.6);
      ctx.quadraticCurveTo(x + 2.6, 3, x + 0.6, 11.4);
      ctx.stroke();
    }
    // Mündung unten rechts
    ctx.beginPath();
    ctx.ellipse(7.4, 9.6, 5.6, 4.4, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(8.2, 10.2, 3, 2.3, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = DEEP;
    ctx.fill();
    // heller Fleck
    ctx.beginPath();
    ctx.ellipse(-6.6, -1.4, 1.3, 2.8, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,252,245,0.85)';
    ctx.fill();
    ctx.restore();
  }, 3);
}
