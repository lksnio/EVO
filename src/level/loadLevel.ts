import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import { generateLevel, type LevelData, type EdgeEntry } from './LevelGen';
import { cloneMap, mapKey, objectSolids, parseWorldMap, type WorldMap } from '../editor/document';
import published from '../data/maps/worlds.json';

const maps = published as Record<string, unknown>;
export function publishedMap(epoch: string, place: string): WorldMap | undefined {
  const input = maps[mapKey(epoch, place)];
  return input === undefined ? undefined : parseWorldMap(input);
}
/** Used by both client and server. Drafts never silently replace a multiplayer map. */
export function loadLevel(ep: EpochDef, salt: string | number, place: PlaceDef, edge?: EdgeEntry): LevelData {
  const map = publishedMap(ep.id, place.id);
  if (!map) return generateLevel(ep, salt, place, edge);
  const L = cloneMap(map.layout);
  L.authoredObjects = cloneMap(map.objects);
  L.solids.push(...objectSolids(map));
  if (edge?.side === 'top') L.start = { x: L.width / 2, y: L.surfaceY + 300 };
  else if (edge?.side === 'cave' && L.descent) L.start = { x: L.descent.x + L.descent.w * 0.35, y: L.descent.y + L.descent.h * 0.45 };
  else if (edge?.side === 'left' || edge?.side === 'right') {
    const x = edge.side === 'left' ? L.width - 380 : 380;
    const y = L.ground[Math.max(0, Math.min(L.ground.length - 1, Math.floor(x / 40)))];
    L.start = { x, y: Math.min(y - 80, Math.max(L.surfaceY + 120, L.surfaceY + edge.frac * (y - L.surfaceY))) };
  }
  return L;
}
