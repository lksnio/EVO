import { cloneMap, newMapId, objectY, rebuildSolids, rockBounds, transformRock, type WorldMap, type MapObject } from './document';
import { groundCurve } from '../level/terrain';
import { SPECIES } from '../data/species';
import type { Rect } from '../util/math';
export interface EditorItem { key: string; name: string; x: number; y: number; width: number; height: number; bounds: Rect; object?: MapObject }
const pointNames: Record<string, string> = { start: 'Player start', shrine: 'Great shell', nest: 'Nest' };
const kinds = { solid: 'editorSolids', cover: 'cover', crevice: 'crevices', plant: 'plants', animal: 'spawns', roe: 'roe', hazard: 'hazards', current: 'currents' } as const;
export function items(map: WorldMap): EditorItem[] {
  const out: EditorItem[] = [], L = map.layout;
  for (const o of map.objects) { const y = objectY(o, L); out.push({ key: 'obj:' + o.id, name: o.asset.replace(/^(reef_unit_|reef_|d2_)/, ''), x: o.x, y, width: o.width, height: o.height, bounds: { x: o.x - o.width / 2, y: y - o.height, w: o.width, h: o.height }, object: o }); }
  for (const kind of ['rock', 'fore'] as const) (kind === 'rock' ? L.rocks : L.fore).forEach((r, i) => {
    const b = rockBounds(r); out.push({ key: kind + ':' + i, name: r.paintedProp === 'cave' ? 'Spawning cave' : kind === 'fore' ? 'Foreground rock' : 'Rock', x: r.x, y: r.y, width: r.rx * 2, height: r.ry * 2, bounds: b });
  });
  for (const [kind, field] of Object.entries(kinds)) (L[field as keyof typeof L] as unknown[] ?? []).forEach((value, i) => {
    const v = value as { x: number; y: number; w?: number; h?: number; id?: string; species?: string };
    const w = v.w ?? 24, h = v.h ?? 24;
    out.push({ key: kind + ':' + i, name: ({ solid: 'Collision', cover: 'Cover', crevice: 'Rock crevice', plant: 'Food plant', animal: 'Animal · ' + (SPECIES[v.id ?? '']?.name ?? v.id), roe: 'Eggs · ' + (SPECIES[v.species ?? '']?.name ?? v.species), hazard: 'Hazard', current: 'Current' } as Record<string, string>)[kind], x: v.w ? v.x + w / 2 : v.x, y: v.h ? v.y + h : v.y, width: w, height: h, bounds: { x: v.w ? v.x : v.x - 12, y: v.h ? v.y : v.y - 12, w, h } });
  });
  for (const [key, name] of Object.entries(pointNames)) {
    const p = L[key as 'start' | 'shrine' | 'nest']; if (p) out.push({ key, name, ...p, width: 30, height: 30, bounds: { x: p.x - 15, y: p.y - 15, w: 30, h: 30 } });
  }
  if (L.chasm) { const c = L.chasm; out.push({ key: 'chasm', name: 'Deep-water entrance · chasm', x: (c.x0 + c.x1) / 2, y: c.floorY, width: c.x1 - c.x0, height: c.floorY - c.rimY, bounds: { x: c.x0, y: c.rimY, w: c.x1 - c.x0, h: c.floorY - c.rimY } }); }
  return out;
}
export function moveItem(map: WorldMap, key: string, x: number, y: number, width?: number, height?: number) {
  const [kind, id] = key.split(':'), L = map.layout;
  if (kind === 'obj') {
    const o = map.objects.find(o => o.id === id)!;
    o.x = x; o.y = o.grounded ? y - groundCurve(L.terrain.hp, x) : y;
    if (width !== undefined) o.width = width; if (height !== undefined) o.height = height;
  } else if (kind === 'rock') {
    const r = L.rocks[Number(id)]; transformRock(L, Number(id), x, y, width ? width / (r.rx * 2) : 1, height ? height / (r.ry * 2) : 1);
  } else if (kind === 'fore') {
    const r = L.fore[Number(id)], sx = width ? width / (r.rx * 2) : 1, sy = height ? height / (r.ry * 2) : 1;
    r.x = x; r.y = y; r.rx *= sx; r.ry *= sy; if (r.poly) r.poly = r.poly.map(([px, py]) => [px * sx, py * sy]);
  } else if (kind in kinds) {
    const v = (L[kinds[kind as keyof typeof kinds]] as unknown as { x: number; y: number; w?: number; h?: number }[])[Number(id)];
    if (v.w !== undefined) { v.w = width ?? v.w; v.h = height ?? v.h; v.x = x - v.w / 2; v.y = y - v.h!; }
    else { v.x = x; v.y = y; }
    if (kind === 'solid') rebuildSolids(L);
  } else if (kind === 'chasm' && L.chasm) {
    const c = L.chasm, w = width ?? c.x1 - c.x0, h = height ?? c.floorY - c.rimY, t = (c.exitY - c.rimY) / (c.floorY - c.rimY);
    c.x0 = x - w / 2; c.x1 = x + w / 2; c.rimY = y - h; c.floorY = y; c.exitY = c.rimY + h * t;
  } else {
    const p = L[kind as 'start' | 'shrine' | 'nest']; if (p) { p.x = x; p.y = y; }
  }
}
export function deleteItems(map: WorldMap, keys: Set<string>) {
  map.objects = map.objects.filter(o => !keys.has('obj:' + o.id));
  for (const kind of ['rock', 'fore', ...Object.keys(kinds)]) {
    const field = kind === 'rock' ? 'rocks' : kind === 'fore' ? 'fore' : kinds[kind as keyof typeof kinds];
    const arr = map.layout[field] as unknown[];
    const removed = arr.filter((_, i) => keys.has(kind + ':' + i));
    if (kind === 'rock') for (const r of removed as typeof map.layout.rocks) {
      if (r.paintedProp === 'cave') delete map.layout.cave;
    }
    (map.layout[field] as unknown[]) = arr.filter((_, i) => !keys.has(kind + ':' + i));
  }
  for (const key of ['shrine', 'nest'] as const) if (keys.has(key)) delete map.layout[key];
  if (keys.has('chasm')) delete map.layout.chasm;
  rebuildSolids(map.layout);
}
export function duplicateObjects(map: WorldMap, keys: Set<string>): string[] {
  const result: string[] = [], groups = new Map<string, string>();
  for (const o of [...map.objects]) if (keys.has('obj:' + o.id)) {
    const copy = cloneMap(o); copy.id = newMapId(); copy.x += 30;
    if (copy.group) { if (!groups.has(copy.group)) groups.set(copy.group, newMapId()); copy.group = groups.get(copy.group); }
    map.objects.push(copy); result.push('obj:' + copy.id);
  }
  for (const key of keys) {
    const [kind, id] = key.split(':');
    if (kind === 'rock' || kind === 'fore') {
      const array = kind === 'rock' ? map.layout.rocks : map.layout.fore, r = array[Number(id)];
      if (r.paintedProp === 'cave' || r.paintedProp === 'deep-cave') continue;
      const copy = cloneMap(r); copy.x += 30; for (const b of copy.collision ?? []) b.x += 30;
      array.push(copy); result.push(kind + ':' + (array.length - 1));
    } else if (kind in kinds) {
      const array = map.layout[kinds[kind as keyof typeof kinds]] as unknown as { x: number }[];
      const copy = cloneMap(array[Number(id)]); copy.x += 30; array.push(copy); result.push(kind + ':' + (array.length - 1));
    }
  }
  rebuildSolids(map.layout);
  return result;
}
