import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from './LevelGen';
import { groundAt, groundCurve, groundRects, STEP } from './terrain';

/** How much sky the play camera can reveal above the waterline (world pixels). */
export function skyAbove(ep: EpochDef, place: PlaceDef, L: LevelData): number | undefined {
  if (!ep.painted || L.mode !== 'water' || L.amphibious) return undefined;
  return place.waterway === 0 ? 270 : place.waterway === 1 ? 46 : undefined;
}

/** Shared border policy for generated maps and imported/editor maps. Idempotent, with no new random geometry. */
export function openWaterEdges(L: LevelData) {
  const ch = L.chasm;
  if (!ch) return;
  const mid = (ch.x0 + ch.x1) / 2, half = (ch.x1 - ch.x0) / 2;
  const floor = L.height + 1400, core = Math.min(220, half * .4);
  const before = L.terrain.hp.slice();
  for (let i = 0; i < L.terrain.hp.length; i++) {
    const d = Math.abs((i + .5) * STEP - mid);
    if (d >= half) continue;
    const t = Math.max(0, Math.min(1, (half - d) / (half - core)));
    const depth = ch.rimY + (floor - ch.rimY) * t * t * (3 - 2 * t);
    L.terrain.hp[i] = Math.max(L.terrain.hp[i], depth);
  }
  // Keep old imported floor decorations rooted when extending an existing shallow pit.
  for (const p of [...L.plants, ...L.roe, ...L.decor]) {
    const old = groundAt(before, p.x);
    if (Math.abs(p.y - old) < 80) p.y += groundAt(L.terrain.hp, p.x) - old;
  }
  for (const p of L.fore) {
    const old = groundAt(before, p.x);
    p.y += groundAt(L.terrain.hp, p.x) - old;
  }
  for (const p of L.cover) {
    const x = p.x + p.w / 2, old = groundAt(before, x);
    if (Math.abs(p.y + p.h - old) < 100) p.y += groundAt(L.terrain.hp, x) - old;
  }
  ch.floorY = floor;
  // The player leaves the actual bottom border, with open water still below the camera.
  ch.exitY = L.height + 60;
  L.ground = Array.from({ length: Math.ceil(L.width / 40) }, (_, i) => groundCurve(L.terrain.hp, i * 40 + 20));
  L.groundRects = groundRects(L.terrain.hp, L.height + 200);
}
