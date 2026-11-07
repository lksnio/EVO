import type Phaser from 'phaser';
import { LINEAGE_FORM_IDS, type LineageFormId } from './forms';

const urls = [
  new URL('../../assets/lineage/transition.webp', import.meta.url).href,
  new URL('../../assets/lineage/water.webp', import.meta.url).href,
  new URL('../../assets/lineage/water-bite-1.webp', import.meta.url).href,
  new URL('../../assets/lineage/water-bite-2.webp', import.meta.url).href,
  new URL('../../assets/lineage/water-skull-1.webp', import.meta.url).href,
  new URL('../../assets/lineage/water-skull-2.webp', import.meta.url).href,
  new URL('../../assets/lineage/shore.webp', import.meta.url).href,
  new URL('../../assets/lineage/shore-bite-1.webp', import.meta.url).href,
  new URL('../../assets/lineage/shore-bite-2.webp', import.meta.url).href,
  new URL('../../assets/lineage/shore-skull-1.webp', import.meta.url).href,
  new URL('../../assets/lineage/shore-skull-2.webp', import.meta.url).href,
];
export const lineageTexture = (id: LineageFormId) => 'lineage_' + id;
export const lineageBodyTexture = (id: LineageFormId) => lineageTexture(id) + '_body';
export const lineageJawTexture = (id: LineageFormId) => lineageTexture(id) + '_jaw';
export function preloadLineage(scene: Phaser.Scene) {
  LINEAGE_FORM_IDS.forEach((id, i) => {
    if (!lineageReady(scene, id)) scene.load.image(lineageTexture(id), urls[i]);
  });
}
export function lineageReady(scene: Phaser.Scene, id: LineageFormId) {
  return scene.textures.exists(lineageTexture(id)) || scene.textures.exists(lineageBodyTexture(id));
}
