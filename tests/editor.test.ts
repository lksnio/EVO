import { describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
import { placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';
import { WORLD } from '../src/data/life';
import { cloneMap, objectY, objectSolids, parseWorldMap, rebuildSolids, transformRock, type WorldMap } from '../src/editor/document';
import { deleteItems, duplicateObjects, moveItem } from '../src/editor/model';
import { MapHistory } from '../src/editor/history';
import { loadLevel } from '../src/level/loadLevel';

const fixture = (epoch = 'devon', index = 1): WorldMap => {
  const ep = EPOCHS.find(e => e.id === epoch)!, place = placesOf(ep)[index], layout = generateLevel(ep, WORLD.seed, place);
  layout.decor = []; layout.editorSolids = [];
  return { format: 'evo-world-map', version: 1, epoch, place: place.id, name: place.name, layout, objects: [{ id: 'one', asset: 'reef_unit_stone', x: 800, y: 4, width: 100, height: 90, grounded: true, flipX: false, angle: 0, alpha: 1, layer: 'world', solid: true }] };
};
describe('World editor / persistent runtime maps', () => {
  it('round-trips complete maps in every epoch without changing collision geometry or amphibious mode', () => {
    for (const ep of EPOCHS) for (let i = 0; i < placesOf(ep).length; i++) {
      const m = fixture(ep.id, i), parsed = parseWorldMap(JSON.parse(JSON.stringify(m)));
      expect(parsed.layout.solids, ep.id).toEqual(m.layout.solids);
      expect(parsed.layout.mode, ep.id).toBe(m.layout.mode);
      expect(parsed.layout.terrain).toEqual(m.layout.terrain);
      expect(parsed.layout.amphibious).toBe(m.layout.amphibious);
      expect(parsed.objects).toEqual(m.objects);
    }
  });
  it('every generated solid belongs to a rock; moving the rock moves exactly those slices', () => {
    const m = fixture(), initial = cloneMap(m.layout.solids);
    rebuildSolids(m.layout); expect(m.layout.solids).toEqual(initial);
    const index = m.layout.rocks.findIndex(r => (r.collision?.length ?? 0) > 0), r = m.layout.rocks[index], before = cloneMap(r.collision!);
    transformRock(m.layout, index, r.x + 73, r.y - 18, 1.2, .8);
    expect(r.collision).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) { expect(r.collision![i].w).toBeCloseTo(before[i].w * 1.2); expect(r.collision![i].h).toBeCloseTo(before[i].h * .8); }
    expect(m.layout.solids).not.toEqual(initial);
  });
  it('moves a cave and its real trigger / hollow together', () => {
    const m = fixture('devon', 0), i = m.layout.rocks.findIndex(r => r.paintedProp === 'cave'), r = m.layout.rocks[i], before = cloneMap(m.layout.cave!);
    transformRock(m.layout, i, r.x + 100, r.y + 20);
    expect(m.layout.cave!.x).toBeCloseTo(before.x + 100); expect(m.layout.cave!.y).toBeCloseTo(before.y + 20);
    expect(m.layout.cave!.hollow[0]).toEqual([before.hollow[0][0] + 100, before.hollow[0][1] + 20]);
  });
  it('preserves grounded footpoints and derives collision after a rotated asset is resized/moved', () => {
    const m = fixture(), o = m.objects[0], y = objectY(o, m.layout);
    moveItem(m, 'obj:one', o.x + 50, y + 30, 150, 180);
    expect(objectY(o, m.layout)).toBeCloseTo(y + 30);
    const before = objectSolids(m); o.angle = 30; const rotated = objectSolids(m);
    expect(rotated.length).toBeGreaterThan(0); expect(rotated).not.toEqual(before);
    expect(rotated.every(r => Number.isFinite(r.x) && r.w > 0 && r.h > 0)).toBe(true);
    o.layer = 'frame'; expect(objectSolids(m)).toEqual([]);
  });
  it('duplicates groups with new identities and deletes attached collision data', () => {
    const m = fixture(); m.objects[0].group = 'original'; m.objects.push({ ...m.objects[0], id: 'two', x: 840 });
    const keys = duplicateObjects(m, new Set(['obj:one', 'obj:two']));
    expect(keys).toHaveLength(2); expect(m.objects[2].group).toBe(m.objects[3].group); expect(m.objects[2].group).not.toBe('original');
    deleteItems(m, new Set(keys)); expect(m.objects).toHaveLength(2);
    const count = m.layout.solids.length, i = m.layout.rocks.findIndex(r => r.collision?.length);
    deleteItems(m, new Set(['rock:' + i])); expect(m.layout.solids.length).toBeLessThan(count);
  });
  it('undo/redo restores geometry and objects, not just the displayed image', () => {
    const m = fixture(), history = new MapHistory(); history.checkpoint(m); const before = cloneMap(m);
    m.layout.terrain.hp[20] -= 100; m.objects[0].angle = 35;
    const undo = history.undo(m)!; expect(undo).toEqual(before);
    expect(history.redo(undo)).toEqual(m);
  });
  it('rejects incompatible, unbounded and duplicate input before replacing an existing map', () => {
    for (const change of [(m: WorldMap) => { m.version = 99 as 1; }, (m: WorldMap) => { m.objects[0].width = Infinity; }, (m: WorldMap) => { m.objects.push(cloneMap(m.objects[0])); }, (m: WorldMap) => { m.objects[0].asset = 'https://evil.example/script'; }, (m: WorldMap) => { m.layout.terrain.hp = []; }]) {
      const m = fixture(); change(m); expect(() => parseWorldMap(m)).toThrow();
    }
  });
  it('leaves procedural fallback untouched when no project map was saved', () => {
    const ep = EPOCHS[0], place = placesOf(ep)[1]; expect(loadLevel(ep, WORLD.seed, place)).toEqual(generateLevel(ep, WORLD.seed, place));
  });
});
