import { describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
import { placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';
import { openWaterEdges, skyAbove } from '../src/level/waterBounds';
import { parseWorldMap, rebuildGround } from '../src/editor/document';

const ep = EPOCHS.find(e => e.id === 'devon')!;
const [river, reef, deep] = placesOf(ep);

describe('water borders shared by play and the world editor', () => {
  it('reveals sky in the river, a narrow cap in the reef and none at depth', () => {
    expect(skyAbove(ep, river, generateLevel(ep, 'border', river))).toBe(270);
    expect(skyAbove(ep, reef, generateLevel(ep, 'border', reef))).toBe(46);
    expect(skyAbove(ep, deep, generateLevel(ep, 'border', deep))).toBeUndefined();
    const carbon = EPOCHS.find(e => e.id === 'karbon')!, swamp = placesOf(carbon)[0];
    expect(skyAbove(carbon, swamp, generateLevel(carbon, 'border', swamp))).toBeUndefined();
  });

  it('keeps the descending channel open across export/import and terrain editing', () => {
    const layout = generateLevel(ep, 'border', reef);
    const map = parseWorldMap({ format: 'evo-world-map', version: 1, epoch: ep.id, place: reef.id, name: 'Offene Schlucht', layout, objects: [] });
    expect(map.layout.chasm).toEqual(layout.chasm);
    expect(map.layout.terrain).toEqual(layout.terrain);
    expect(map.layout.groundRects).toEqual(layout.groundRects);
    expect(parseWorldMap(map)).toEqual(map);
    // An older exported map or a ground brush cannot leave a floor across the travel border.
    map.layout.terrain.hp.fill(1500);
    rebuildGround(map.layout);
    const L = map.layout, ch = L.chasm!, mid = (ch.x0 + ch.x1) / 2;
    expect(ch.exitY).toBeGreaterThan(L.height);
    expect(ch.floorY - ch.exitY).toBeGreaterThan(1000);
    expect(L.groundRects.some(r => r.x <= mid && r.x + r.w >= mid)).toBe(false);
    expect(L.groundRects.every(r => r.h > 0)).toBe(true);
    const before = JSON.stringify(L);
    openWaterEdges(L);
    expect(JSON.stringify(L)).toBe(before);
    expect(parseWorldMap({ ...map, layout: L }).layout).toEqual(L);
  });

  it('preserves physical cave access and one shared protected spawn pile for every seed', () => {
    for (const seed of ['old-save', 'border', 'new-life']) {
      const L = generateLevel(ep, seed, river), c = L.cave!, roe = L.roe.find(r => r.own)!;
      expect(L.roe.filter(r => r.own)).toHaveLength(1);
      expect(roe.x).toBeGreaterThan(c.x + 60);
      expect(roe.x).toBeLessThan(c.x + c.w - 60);
      // A mate can approach horizontally from the right without crossing the cave roof.
      for (let x = roe.x; x < c.x + c.w + 200; x += 15) {
        expect(L.solids.some(r => x >= r.x && x < r.x + r.w && roe.y - 40 >= r.y && roe.y - 40 < r.y + r.h)).toBe(false);
      }
    }
  });
});
