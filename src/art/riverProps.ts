import Phaser from 'phaser';
import { CAVE_FRAME, NEST_FRAME, cavePlacement, eggLayout } from './riverGeometry';
import { newCanvas } from '../util/canvas';
import type { Rect } from '../util/math';

const FILES = {
  nest: new URL('../assets/river/nest.webp', import.meta.url).href,
  egg: new URL('../assets/river/egg.webp', import.meta.url).href,
  cave_back: new URL('../assets/river/cave_back.webp', import.meta.url).href,
  cave_front: new URL('../assets/river/cave_front.webp', import.meta.url).href,
};
export const riverKey = (id: keyof typeof FILES) => 'river_' + id;
export function preloadRiver(scene: Phaser.Scene) {
  for (const id of Object.keys(FILES) as (keyof typeof FILES)[]) if (!scene.textures.exists(riverKey(id))) scene.load.image(riverKey(id), FILES[id]);
}
export function paintedRiver(scene: Phaser.Scene) {
  return !new URLSearchParams(globalThis.location?.search ?? '').has('oldprops') && Object.keys(FILES).every(id => scene.textures.exists('river_' + id));
}

/** Bake only when the count changes; the existing image keeps its tint, visibility, footpoint and gameplay geometry. */
export function riverRoeTexture(scene: Phaser.Scene, units: number, max: number) {
  const count = Math.max(0, Math.min(max, Math.floor(units)));
  const key = `river_roe_${max}_${count}`;
  if (scene.textures.exists(key)) return key;
  const [canvas, ctx] = newCanvas(216, 156, true);
  ctx.scale(3, 3); ctx.translate(36, 52);
  const egg = scene.textures.get(riverKey('egg')).getSourceImage() as HTMLImageElement;
  const nest = scene.textures.get(riverKey('nest')).getSourceImage() as HTMLImageElement;
  const slots = eggLayout(max);
  // Upper rows first; lower/side eggs stay smaller. No random re-layout when another egg is eaten.
  slots.slice(0, count).sort((a, b) => a.y - b.y).forEach(p => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    // Registration uses the measured egg alpha bounds in the original source, not its transparent canvas.
    const k = p.width / 742;
    ctx.drawImage(egg, -771 * k, -831 * k, 1536 * k, 1024 * k);
    ctx.restore();
  });
  const k = 72 / (NEST_FRAME.x1 - NEST_FRAME.x0);
  ctx.drawImage(nest, -NEST_FRAME.x * k, -NEST_FRAME.ground * k, NEST_FRAME.w * k, NEST_FRAME.h * k);
  const [out, ox] = newCanvas(72, 52, true);
  ox.drawImage(canvas, 0, 0, 72, 52);
  scene.textures.addCanvas(key, out);
  return key;
}

/** Match the complete canvases, not separately trimmed source images. No physics bodies are attached here. */
export function riverCave(scene: Phaser.Scene, c: Rect) {
  const box = cavePlacement(c);
  const make = (id: 'cave_back' | 'cave_front') => scene.add.image(box.x, box.y, riverKey(id)).setName('river-' + id).setOrigin(0).setDisplaySize(box.w, box.h);
  return { back: make('cave_back'), front: make('cave_front'), box };
}

export { CAVE_FRAME };
