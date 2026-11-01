import type Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { makeSpeciesTextures, speciesKey } from './speciesArt';
import { newCanvas } from '../util/canvas';

/** Background-only two-phase silhouettes: anatomy remains recognisable, eyes/scales/ink disappear into water. */
export function backdropFish(scene: Phaser.Scene, def: SpeciesDef, phase: number) {
  const key = `sea_sil_${def.id}_${phase}`;
  if (scene.textures.exists(key)) return key;
  makeSpeciesTextures(scene, def);
  const src = scene.textures.get(speciesKey(def.id, phase)).getSourceImage() as HTMLCanvasElement;
  const [cv, ctx] = newCanvas(src.width, src.height);
  ctx.filter = 'blur(0.65px)';
  ctx.drawImage(src, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  const g = ctx.createLinearGradient(0, 0, 0, src.height);
  g.addColorStop(0, '#c4d5d5'); g.addColorStop(0.42, '#a0bbbe'); g.addColorStop(1, '#819eaa');
  ctx.fillStyle = g; ctx.fillRect(0, 0, src.width, src.height);
  scene.textures.addCanvas(key, cv);
  return key;
}
