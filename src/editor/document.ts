import { openWaterEdges } from '../level/waterBounds';
import { EPOCHS } from '../data/epochs';
import { SPECIES } from '../data/species';
import { placesOf } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { groundCurve, groundRects, rockOutline, STEP, type RockSpec } from '../level/terrain';
import type { Rect } from '../util/math';

export const MAP_VERSION = 1;
export const MAP_LAYERS = ['far', 'back', 'world', 'front', 'frame'] as const;
export type MapLayer = typeof MAP_LAYERS[number];
export interface MapObject {
  id: string; asset: string; x: number; y: number; width: number; height: number;
  angle: number; flipX: boolean; layer: MapLayer; alpha: number;
  /** A grounded object's y is its offset from the terrain, rather than an absolute world coordinate. */
  grounded: boolean;
  solid?: boolean;
  sway?: number;
  group?: string;
}
export interface WorldMap {
  format: 'evo-world-map'; version: 1; epoch: string; place: string; name: string;
  layout: LevelData;
  objects: MapObject[];
}
export const mapKey = (epoch: string, place: string) => epoch + '/' + place;
let sequence = 0;
export const newMapId = () => globalThis.crypto?.randomUUID?.() ?? `part-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`;
export const cloneMap = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function objectY(o: MapObject, L: LevelData) { return o.grounded ? groundCurve(L.terrain.hp, o.x) + o.y : o.y; }
export function rebuildGround(L: LevelData) {
  openWaterEdges(L);
  L.groundRects = groundRects(L.terrain.hp, L.height + 200);
  L.ground = Array.from({ length: Math.ceil(L.width / 40) }, (_, i) => groundCurve(L.terrain.hp, i * 40 + 20));
  L.startCol = Math.max(0, Math.min(L.ground.length - 1, Math.floor(L.start.x / 40)));
  if (L.amphibious) {
    L.land = [];
    let from: number | undefined;
    for (let i = 0; i <= L.ground.length; i++) {
      if (i < L.ground.length && L.ground[i] < L.surfaceY) { from ??= i * 40; }
      else if (from !== undefined) { L.land.push({ x0: from, x1: i * 40 }); from = undefined; }
    }
  }
}
export function rebuildSolids(L: LevelData) {
  // Every generated solid is owned by its rock; independent user-drawn solids keep their own editable rectangles.
  L.solids = L.rocks.flatMap(r => r.collision ?? []).concat(L.editorSolids ?? []);
}

const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Ungültiges Kartenobjekt.');
  return v as Record<string, unknown>;
};
function num(v: unknown, lo = -100000, hi = 100000) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw Error('Eine Kartenkoordinate ist ungültig.');
  return v;
}
function str(v: unknown, max = 120) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error('Eine Kartenbezeichnung ist ungültig.');
  return v;
}
function array<T>(v: unknown, parse: (v: unknown) => T, max = 5000): T[] {
  if (!Array.isArray(v) || v.length > max) throw Error('Eine Kartenliste fehlt oder ist zu groß.');
  return v.map(parse);
}
const point = (v: unknown) => { const p = record(v); return { x: num(p.x), y: num(p.y) }; };
const rect = (v: unknown): Rect => { const p = record(v); return { ...point(p), w: num(p.w, 0.1, 40000), h: num(p.h, 0.1, 40000) }; };
const poly = (v: unknown) => array(v, p => {
  if (!Array.isArray(p) || p.length !== 2) throw Error('Ungültiger Felsumriss.');
  return [num(p[0]), num(p[1])] as [number, number];
}, 2048);
function rock(v: unknown): RockSpec {
  const p = record(v);
  const r: RockSpec = { ...point(p), rx: num(p.rx, 0.1, 10000), ry: num(p.ry, 0.1, 10000), seed: num(p.seed, 0, 2 ** 32), tone: num(p.tone, 0, 2) };
  if (p.poly !== undefined) r.poly = poly(p.poly);
  if (p.form !== undefined) {
    if (!['boulder', 'slab', 'arch'].includes(String(p.form))) throw Error('Unbekannte Felsform.');
    r.form = p.form as RockSpec['form'];
  }
  if (p.paintedProp !== undefined) {
    if (!['cave', 'deep-cave', 'shelter-support'].includes(String(p.paintedProp))) throw Error('Unbekanntes Felsbauteil.');
    r.paintedProp = p.paintedProp as RockSpec['paintedProp'];
  }
  if (p.collision !== undefined) r.collision = array(p.collision, rect, 10000);
  return r;
}

/** Parse files, browser drafts and project data through the same bounded, finite, versioned schema. No executable fields/URLs. */
export function parseWorldMap(input: unknown): WorldMap {
  const p = record(input);
  if (p.format !== 'evo-world-map' || p.version !== MAP_VERSION) throw Error('Dieses Kartenformat wird nicht unterstützt (erwartet Version 1).');
  const epoch = EPOCHS.find(e => e.id === p.epoch), place = epoch && placesOf(epoch).find(d => d.id === p.place);
  if (!epoch || !place) throw Error('Zeitalter und Ort passen nicht zusammen.');
  const l = record(p.layout), width = num(l.width, 640, 40000), height = num(l.height, 480, 20000);
  const t = record(l.terrain), hp = array(t.hp, v => num(v, -5000, height + 4000), 2002);
  if (hp.length < Math.ceil(width / STEP)) throw Error('Die Bodenlinie ist unvollständig.');
  const terrainZones = array(t.zones, v => {
    const z = record(v);
    if (!['sand', 'rock', 'mud'].includes(String(z.kind))) throw Error('Unbekanntes Bodenmaterial.');
    return { x0: num(z.x0), x1: num(z.x1), kind: z.kind as 'sand' | 'rock' | 'mud' };
  }, 100);
  if (!terrainZones.length) throw Error('Das Bodenmaterial fehlt.');
  const L: LevelData = {
    width, height, mode: l.amphibious === true ? 'water' : epoch.habitat, theme: epoch.theme, variant: l.variant === 'cave' ? 'cave' : l.variant === 'dark' ? 'dark' : 'normal',
    surfaceY: num(l.surfaceY, 0, height), terrain: { hp, zones: terrainZones },
    groundRects: [], ground: [], rocks: array(l.rocks, rock, 1000), fore: array(l.fore, rock, 1000),
    solids: array(l.solids, rect, 20000), editorSolids: array(l.editorSolids ?? [], rect, 1000),
    platforms: array(l.platforms, rect), hazards: array(l.hazards, rect), cover: array(l.cover, rect), crevices: array(l.crevices, rect),
    start: point(l.start), startCol: Math.floor(num(l.startCol, 0, width / 40)),
    zones: [{ x0: 0, x1: width, def: cloneMap(place.def) }],
    decor: [], mats: array(l.mats, v => { const m = record(v); return { x0: num(m.x0), x1: num(m.x1), tone: num(m.tone, 0, 10), seed: num(m.seed, 0, 2 ** 32) }; }),
    lit: array(l.lit, v => { const a = record(v); return { x0: num(a.x0), x1: num(a.x1) }; }),
    plants: array(l.plants, v => { const a = record(v); return { ...point(a), v: num(a.v, 0, 4) }; }),
    spawns: array(l.spawns, v => { const a = record(v), id = str(a.id); if (!SPECIES[id]) throw Error('Unbekannte Tierart: ' + id); return { ...point(a), id, ...(a.herd !== undefined ? { herd: num(a.herd) } : {}), ...(a.guard !== undefined ? { guard: num(a.guard) } : {}) }; }),
    roe: array(l.roe, v => { const a = record(v); return { ...point(a), species: str(a.species), tone: num(a.tone, 0, 20), own: a.own === true }; }),
    currents: array(l.currents, v => { const a = record(v); return { ...rect(a), dir: a.dir === -1 ? -1 : 1 }; }),
  };
  for (const k of ['shrine', 'nest'] as const) if (l[k] !== undefined) L[k] = point(l[k]);
  for (const k of ['summit'] as const) if (l[k] !== undefined) L[k] = rect(l[k]);
  if (l.cave !== undefined) { const c = record(l.cave); L.cave = { ...rect(c), hollow: poly(c.hollow) }; }
  if (l.deepCave !== undefined) throw Error('Diese Karte nutzt die alte Schlund-Höhle. Bitte die aktuelle Vorlage mit offener Schlucht verwenden.');
  if (l.chasm !== undefined) {
    const c = record(l.chasm);
    L.chasm = { x0: num(c.x0, 0, width), x1: num(c.x1, 0, width), rimY: num(c.rimY), floorY: num(c.floorY), exitY: num(c.exitY) };
    if (L.chasm.x1 <= L.chasm.x0 || L.chasm.floorY <= L.chasm.rimY || L.chasm.exitY >= L.chasm.floorY || L.chasm.exitY <= L.chasm.rimY) throw Error('Der Tiefenzugang hat ungültige Grenzen.');
  }
  if (l.riverEnd !== undefined) L.riverEnd = num(l.riverEnd, 0, width);
  if (l.amphibious === true) L.amphibious = true;
  if (l.land !== undefined) L.land = array(l.land, v => { const a = record(v); return { x0: num(a.x0), x1: num(a.x1) }; });
  const ids = new Set<string>();
  const objects = array(p.objects, v => {
    const o = record(v), id = str(o.id);
    if (ids.has(id)) throw Error('Doppelte Bauteil-ID.'); ids.add(id);
    const asset = str(o.asset);
    if (!/^(reef|d2)_[a-z0-9_]+$/.test(asset)) throw Error('Unbekannter Bauteilschlüssel.');
    if (!MAP_LAYERS.includes(o.layer as MapLayer)) throw Error('Unbekannte Bildebene.');
    return { id, asset, ...point(o), width: num(o.width, 2, 5000), height: num(o.height, 2, 5000), angle: num(o.angle, -360, 360),
      flipX: o.flipX === true, layer: o.layer as MapLayer, alpha: num(o.alpha, 0, 1), grounded: o.grounded === true,
      ...(o.solid === true ? { solid: true } : {}),
      ...(o.sway !== undefined ? { sway: num(o.sway, 0, 5) } : {}),
      ...(o.group !== undefined ? { group: str(o.group) } : {}) };
  }, 3000);
  rebuildGround(L);
  return { format: 'evo-world-map', version: 1, epoch: epoch.id, place: place.id, name: str(p.name), layout: L, objects };
}

/** Small convex collision slices share the sprite's footpoint, scale and rotation. Background/frame art never blocks play. */
export function objectSolids(map: Pick<WorldMap, 'layout' | 'objects'>): Rect[] {
  const out: Rect[] = [];
  for (const o of map.objects) {
    if (!o.solid || o.layer === 'far' || o.layer === 'frame') continue;
    const a = o.angle * Math.PI / 180, y = objectY(o, map.layout);
    const pts = [[-.42, -.04], [-.42, -.85], [.42, -.85], [.42, -.04]].map(([x, yy]) => {
      const dx = x * o.width, dy = yy * o.height;
      return [o.x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a)];
    });
    const min = Math.min(...pts.map(p => p[0])), max = Math.max(...pts.map(p => p[0]));
    const step = Math.max(10, (max - min) / 32);
    for (let x = min; x < max; x += step) {
      const mid = Math.min(max - .001, x + step / 2), ys: number[] = [];
      for (let i = 0; i < 4; i++) {
        const p = pts[i], q = pts[(i + 1) % 4];
        if ((p[0] > mid) !== (q[0] > mid)) ys.push(p[1] + (mid - p[0]) / (q[0] - p[0]) * (q[1] - p[1]));
      }
      if (ys.length > 1) out.push({ x, y: Math.min(...ys), w: Math.min(step, max - x), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) });
    }
  }
  return out;
}

/** Move a native rock and its exact owned collision slices together, including associated cave triggers. */
export function transformRock(L: LevelData, index: number, x: number, y: number, sx = 1, sy = 1) {
  const r = L.rocks[index], ox = r.x, oy = r.y;
  const move = (p: { x: number; y: number }) => { p.x = x + (p.x - ox) * sx; p.y = y + (p.y - oy) * sy; };
  const box = (b: Rect) => { move(b); b.w *= sx; b.h *= sy; };
  for (const b of r.collision ?? []) box(b);
  if (r.poly) r.poly = r.poly.map(([px, py]) => [px * sx, py * sy]);
  r.x = x; r.y = y; r.rx *= sx; r.ry *= sy;
  const c = r.paintedProp === 'cave' ? L.cave : undefined;
  if (c) { box(c); c.hollow = c.hollow.map(([px, py]) => [x + (px - ox) * sx, y + (py - oy) * sy]); }
  rebuildSolids(L);
}
export function rockBounds(r: RockSpec) {
  const p = rockOutline(r);
  const x0 = Math.min(...p.map(p => p[0])), x1 = Math.max(...p.map(p => p[0]));
  const y0 = Math.min(...p.map(p => p[1])), y1 = Math.max(...p.map(p => p[1]));
  return { x: r.x + x0, y: r.y + y0, w: x1 - x0, h: y1 - y0 };
}
