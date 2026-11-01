import type Phaser from 'phaser';
import { newCanvas, type Ctx } from '../../util/canvas';

/** A cached silhouette rim, painted before the transparent-pixel alpha floor. No extra render pass. */
export function fishContour(ctx: Ctx, radius: number) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const [original, ox] = newCanvas(w, h);
  ox.drawImage(ctx.canvas, 0, 0);
  const [mask, mx] = newCanvas(w, h);
  mx.drawImage(original, 0, 0);
  mx.globalCompositeOperation = 'source-in';
  mx.fillStyle = '#060d13'; mx.fillRect(0, 0, w, h);
  ctx.save(); ctx.resetTransform(); ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.drawImage(mask, Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.drawImage(original, 0, 0); ctx.restore();
}

export const LIFT_STEPS = 8;
export const liftKey = (key: string, step: number) => step ? key + '_L' + step : key;

/** All eight grades are baked together, once per appearance. Dark ink stays dark even on the bright player. */
export function prepareFishLift(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(liftKey(key, LIFT_STEPS))) return;
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const [base, bx] = newCanvas(src.width, src.height, true);
  bx.drawImage(src, 0, 0);
  const original = bx.getImageData(0, 0, src.width, src.height);
  for (let step = 1; step <= LIFT_STEPS; step++) {
    const [cv, ctx] = newCanvas(src.width, src.height);
    const img = new ImageData(new Uint8ClampedArray(original.data), src.width, src.height);
    const d = img.data, lift = step / LIFT_STEPS * 0.5;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 1) continue;
      const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const k = Math.max(0, Math.min(1, (lum - 24) / 58));
      const f = lift * k * k * (3 - 2 * k);
      for (let c = 0; c < 3; c++) d[i + c] += (255 - d[i + c]) * f;
    }
    ctx.putImageData(img, 0, 0);
    scene.textures.addCanvas(liftKey(key, step), cv);
  }
  base.width = base.height = 1;
}
