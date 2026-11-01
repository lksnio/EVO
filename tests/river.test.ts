import { describe, expect, it } from 'vitest';
import { CAVE_FRAME, cavePlacement, eggLayout } from '../src/art/riverGeometry';
import { waterLightAt, waterSurfaces } from '../src/art/waterGeometry';
import { generateLevel } from '../src/level/LevelGen';
import { EPOCHS } from '../src/data/epochs';
import { placesOf } from '../src/data/world';

const ep = EPOCHS.find(e => e.id === 'devon')!;
const place = placesOf(ep).find(p => p.duelCave)!;
const L = generateLevel(ep, 'river-art-regression', place);

describe('painted river props', () => {
  it('fits both complete cave canvases to one scale, ground anchor and existing right entrance', () => {
    const before = JSON.stringify(L);
    const c = L.cave!, box = cavePlacement(c);
    expect(box.w / CAVE_FRAME.w).toBeCloseTo(box.h / CAVE_FRAME.h);
    const k = box.w / CAVE_FRAME.w;
    expect(box.y + CAVE_FRAME.ground * k).toBeCloseTo(c.y + c.h + 2);
    expect(box.x + CAVE_FRAME.x1 * k).toBeCloseTo(c.x + c.w);
    expect(JSON.stringify(L)).toBe(before);
  });

  it('marks only the existing cave rock for visual replacement while keeping its physical roof', () => {
    expect(L.rocks.filter(r => r.paintedProp === 'cave')).toHaveLength(1);
    const c = L.cave!;
    const solid = (x: number, y: number) => L.solids.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
    for (let x = c.x + 60; x < c.x + c.w - 20; x += 40) {
      expect(solid(x, c.y + c.h - 40)).toBe(false);
      expect(solid(x, c.y - 30)).toBe(true);
    }
  });

  it.each([0, 1, 4, 5, 9])('%s eggs have fixed positions, with the lower row resting behind the rim', n => {
    const slots = eggLayout(n);
    expect(slots).toHaveLength(n);
    expect(slots).toEqual(eggLayout(n));
    expect(eggLayout(n + 1).slice(0, n)).toEqual(slots);
    expect(new Set(slots.map(p => `${p.x}:${p.y}`)).size).toBe(n);
    for (const p of slots) { expect(p.width).toBeGreaterThan(0); expect(p.y).toBeLessThan(0); }
    if (n) expect(slots[0].y).toBeGreaterThanOrEqual(-5);
  });
});

describe('world-space underwater surface light', () => {
  it('excludes the cave interior and unlit or deep regions', () => {
    const c = L.cave!;
    expect(waterLightAt(L, c.x + c.w / 2, c.y + c.h - 25)).toBe(0);
    const lit = L.lit.find(l => l.x0 > c.x + c.w)!;
    const x = (lit.x0 + lit.x1) / 2;
    expect(waterLightAt(L, x, L.surfaceY + 80)).toBeGreaterThan(waterLightAt(L, x, L.surfaceY + 900));
    expect(waterLightAt(L, x, L.surfaceY + 1600)).toBe(0);
    expect(waterLightAt({ ...L, lit: [] }, x, L.surfaceY + 10)).toBe(0);
  });

  it('builds thin surface strips rather than a light overlay over water or deep terrain', () => {
    const before = JSON.stringify(L), surfaces = waterSurfaces(L);
    expect(surfaces.length).toBeGreaterThan(0);
    for (const s of surfaces) {
      expect(s.light).toBeGreaterThan(0);
      const n = s.points.length / 2;
      for (let i = 0; i < n; i++) {
        const top = s.points[i], bottom = s.points[s.points.length - 1 - i];
        expect(bottom[0]).toBe(top[0]);
        expect(bottom[1] - top[1]).toBeGreaterThan(0);
        expect(bottom[1] - top[1]).toBeLessThanOrEqual(20);
      }
    }
    expect(JSON.stringify(L)).toBe(before);
  });
});
