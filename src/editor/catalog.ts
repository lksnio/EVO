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
  ribbon: 'Bandtang · hoch', fan: 'Bandtang · Fächer', branch: 'Astschwamm', tubes: 'Röhrenschwämme', pebble: 'Runder Stein', stone: 'Stein · hoch', ledge: 'Felsplatte · klein', shoots: 'Junge Triebe',
  kelp: 'Tanggruppe mit Steinen', coral: 'Schwammgruppe mit Felsbank', frame: 'Nahe Felsbank mit Tang', stones: 'Kieselgruppe', roof: 'Felsdach', support_low: 'Steine · niedrig', support_tall: 'Steine · hoch',
  seaweed: 'Seegras', seagrass: 'Grasbüschel', rock: 'Stein', shell: 'Muschel', bones: 'Knochen', anemone: 'Seeanemone', sponge: 'Schwamm', seafan: 'Fächer', stump: 'Baumstumpf', mushroom: 'Pilze', reed: 'Schilf', fern: 'Farn', horsetail: 'Schachtelhalm', tallgrass: 'Hohes Gras', boulder: 'Felsbrocken', skull: 'Schädel', cycad: 'Palmfarn', bush: 'Busch', rock_snow: 'Schneefels', deadtree: 'Toter Baum', grass: 'Gras', flowers: 'Blüten',
};
export function assetCatalog(scene: Phaser.Scene, theme: Theme): MapAsset[] {
  const list: MapAsset[] = [];
  if (theme === 'ozean') {
    for (const id of units) list.push({ key: 'reef_unit_' + id, name: names[id], category: 'Einzelteile', height: ['ribbon', 'fan'].includes(id) ? 145 : id === 'shoots' ? 45 : id === 'pebble' ? 32 : 70 });
    for (const id of ['roof', 'support_low', 'support_tall', 'stones', 'kelp', 'coral', 'frame']) list.push({ key: 'reef_' + id, name: names[id], category: 'Gruppen & Felsen', height: id === 'frame' ? 340 : id === 'kelp' ? 210 : 90 });
  }
  for (const id of new Set([...DECOR[theme], ...(theme === 'ozean' ? LIFE_KEYS : [])])) {
    const key = 'd2_' + id;
    list.push({ key, name: names[id] ?? id.replaceAll('_', ' '), category: 'Bewuchs & Fundstücke', height: scene.textures.get(key).getSourceImage().height });
  }
  return list.filter(a => scene.textures.exists(a.key));
}
