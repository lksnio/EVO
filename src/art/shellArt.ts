import type Phaser from 'phaser';
import { rgrad, tex } from '../util/canvas';

/** Ein kurzes Funkeln für feste Sammelfunde und Fossilplatten. */
export function collectionGlintTexture(scene: Phaser.Scene) {
  tex(scene, 'shell_glint', 24, 24, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 12, 12, 0, 6, [[0, 'rgba(255,250,232,0.95)'], [1, 'rgba(255,240,200,0)']]);
    ctx.fillRect(0, 0, 24, 24);
    ctx.fillStyle = 'rgba(255,248,226,0.95)';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      ctx.beginPath();
      ctx.moveTo(12 - dx * 11.5, 12 - dy * 11.5);
      ctx.lineTo(12 + dy * 0.9, 12 - dx * 0.9);
      ctx.lineTo(12 + dx * 11.5, 12 + dy * 11.5);
      ctx.lineTo(12 - dy * 0.9, 12 + dx * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  }, 2);
}
