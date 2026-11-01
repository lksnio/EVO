import type Phaser from 'phaser';
import type { LevelData } from '../level/LevelGen';
import { DEPTH } from '../config';
import { tex } from '../util/canvas';
/** Shared by the main game and editor: the same soft depth shading over the open descent. */
export function chasmArt(scene: Phaser.Scene, ch: NonNullable<LevelData['chasm']>) {
  const w = Math.round(ch.x1 - ch.x0 + 520), h = Math.round(ch.floorY - ch.rimY + 560);
  const key = `chasm_shade_${w}x${h}`;
  tex(scene, key, Math.ceil(w / 2), Math.ceil(h / 2), (ctx, cw, ch2) => {
    const g = ctx.createLinearGradient(0, 0, 0, ch2);
    g.addColorStop(0, 'rgba(2,10,22,0)'); g.addColorStop(.28, 'rgba(2,10,22,0.18)');
    g.addColorStop(.62, 'rgba(2,8,20,0.55)'); g.addColorStop(1, 'rgba(1,5,14,0.86)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch2);
    ctx.globalCompositeOperation = 'destination-in';
    const hg = ctx.createLinearGradient(0, 0, cw, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(.2, 'rgba(0,0,0,1)');
    hg.addColorStop(.8, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, cw, ch2);
  });
  return scene.add.image(ch.x0 - 260, ch.rimY - 380, key).setOrigin(0).setDisplaySize(w, h).setDepth(DEPTH.decoFront + .3);
}
