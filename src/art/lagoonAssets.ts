import type Phaser from 'phaser';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';

const FILES = {
  water: new URL('../assets/lagoon/lagoon.webp', import.meta.url).href,
  coast: new URL('../assets/lagoon/coast.webp', import.meta.url).href,
  cliff: new URL('../assets/lagoon/cliff.webp', import.meta.url).href,
  trees: new URL('../assets/lagoon/trees.webp', import.meta.url).href,
};
export const lagoonKey = (id: keyof typeof FILES) => 'lagoon_' + id;

export function preloadLagoon(scene: Phaser.Scene) {
  for (const [id, url] of Object.entries(FILES)) if (!scene.textures.exists('lagoon_' + id)) scene.load.image('lagoon_' + id, url);
}

export function lagoonReady(scene: Phaser.Scene) {
  return Object.keys(FILES).every(id => scene.textures.exists('lagoon_' + id));
}

export function lagoonEnabled(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef) {
  return !!ep.painted && place.kind === 'start' && lagoonReady(scene) && !new URLSearchParams(globalThis.location?.search ?? '').has('oldlagoon');
}
