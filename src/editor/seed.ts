import type Phaser from 'phaser';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import { generateLevel } from '../level/LevelGen';
import { WORLD } from '../data/life';
import { cloneMap, objectY, type MapObject, type WorldMap } from './document';
import { groundCurve } from '../level/terrain';

export function createMap(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef): WorldMap {
  const L = cloneMap(generateLevel(ep, WORLD.seed, place));
  const objects: MapObject[] = [];
  let next = 0;
  const add = (asset: string, x: number, y: number, h: number) => {
    if (!scene.textures.exists(asset)) return;
    const src = scene.textures.get(asset).getSourceImage();
    objects.push({ id: 'part-' + ++next, asset, x, y: y - groundCurve(L.terrain.hp, x), width: h * src.width / src.height, height: h,
      grounded: true, angle: 0, flipX: next % 3 === 0, alpha: 1, layer: 'back', sway: /ribbon|fan|shoot|kelp|seaweed|grass|fern|reed|horsetail/.test(asset) ? 1 : 0 });
  };
  for (const d of L.decor) {
    if (d.hang) continue;
    const key = 'd2_' + d.k;
    if (ep.painted && !L.amphibious && ['kelp', 'coral', 'seaweed', 'sponge'].includes(d.k)) add('reef_unit_' + (next % 2 ? 'ribbon' : 'fan'), d.x, d.y + 4, 95 + next % 4 * 25);
    else if (scene.textures.exists(key)) add(key, d.x, d.y + 4, scene.textures.get(key).getSourceImage().height);
  }
  for (const c of L.cover) {
    const key = ep.painted && !L.amphibious ? 'reef_unit_ribbon' : 'd2_' + ((place.theme ?? ep.theme) === 'sumpf' ? 'reed' : 'bush');
    for (let i = 0; i < Math.max(2, Math.ceil(c.w / 100)); i++) add(key, c.x + (i + .5) * 100, c.y + c.h + 8, c.h + 15);
  }
  L.decor = []; L.editorSolids = [];
  return { format: 'evo-world-map', version: 1, epoch: ep.id, place: place.id, name: place.name, layout: L, objects };
}
export function groundObject(o: MapObject, map: WorldMap, grounded: boolean) {
  const y = objectY(o, map.layout);
  o.grounded = grounded;
  o.y = grounded ? y - groundCurve(map.layout.terrain.hp, o.x) : y;
}
