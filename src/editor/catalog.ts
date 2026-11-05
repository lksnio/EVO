import type Phaser from 'phaser';
import { DECOR } from '../art/worldArt';
import { LIFE_KEYS } from '../art/lifeArt';
import type { Theme } from '../data/epochs';

export interface MapAsset { key: string; name: string; category: string; height: number }
const units = ['ribbon', 'fan', 'branch', 'tubes', 'pebble', 'stone', 'ledge', 'shoots'] as const;
const files = import.meta.glob('../assets/reef/units/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function preloadEditorUnits(scene: Phaser.Scene) {
  for (const id of units) scene.load.image('reef_unit_' + id, files['../assets/reef/units/' + id + '.webp']);
}
const names: Record<string, string> = {
  ribbon: 'Ribbon kelp · tall', fan: 'Ribbon kelp · fan', branch: 'Branching sponge', tubes: 'Tube sponges', pebble: 'Round stone', stone: 'Stone · tall', ledge: 'Rock slab · small', shoots: 'Young shoots',
  kelp: 'Kelp cluster with stones', coral: 'Sponge cluster with rock shelf', frame: 'Near rock shelf with kelp', stones: 'Pebble cluster', roof: 'Rock roof', support_low: 'Stones · low', support_tall: 'Stones · tall',
  seaweed: 'Seagrass', seagrass: 'Grass tuft', rock: 'Stone', shell: 'Shell', bones: 'Bones', anemone: 'Sea anemone', sponge: 'Sponge', seafan: 'Fan', stump: 'Tree stump', mushroom: 'Mushrooms', reed: 'Reeds', fern: 'Fern', horsetail: 'Horsetail', tallgrass: 'Tall grass', boulder: 'Boulder', skull: 'Skull', cycad: 'Cycad', bush: 'Bush', rock_snow: 'Snowy rock', deadtree: 'Dead tree', grass: 'Grass', flowers: 'Flowers',
};
export function assetCatalog(scene: Phaser.Scene, theme: Theme): MapAsset[] {
  const list: MapAsset[] = [];
  if (theme === 'ozean') {
    for (const id of units) list.push({ key: 'reef_unit_' + id, name: names[id], category: 'Individual parts', height: ['ribbon', 'fan'].includes(id) ? 145 : id === 'shoots' ? 45 : id === 'pebble' ? 32 : 70 });
    for (const id of ['roof', 'support_low', 'support_tall', 'stones', 'kelp', 'coral', 'frame']) list.push({ key: 'reef_' + id, name: names[id], category: 'Groups & rocks', height: id === 'frame' ? 340 : id === 'kelp' ? 210 : 90 });
  }
  for (const id of new Set([...DECOR[theme], ...(theme === 'ozean' ? LIFE_KEYS : [])])) {
    const key = 'd2_' + id;
    list.push({ key, name: names[id] ?? id.replaceAll('_', ' '), category: 'Plants & finds', height: scene.textures.get(key).getSourceImage().height });
  }
  return list.filter(a => scene.textures.exists(a.key));
}
