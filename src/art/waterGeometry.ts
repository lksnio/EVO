import { groundAt, rockPoly, rockTop, type Poly } from '../level/terrain';
import type { LevelData } from '../level/LevelGen';

/** Illumination follows world depth and the existing sunlit intervals; cave interiors stay in shadow. */
export function waterLightAt(L: LevelData, x: number, y: number) {
  const c = L.cave;
  if (c && x > c.x - 120 && x < c.x + c.w && y > c.y - 60) return 0;
  if (!L.lit.length) return 0;
  const edge = Math.max(...L.lit.map(l => Math.max(0, Math.min(1, (x - l.x0) / 80, (l.x1 - x) / 80))));
  const depth = Math.max(0, y - L.surfaceY);
  return edge * Math.max(0, 1 - depth / 1500) ** 1.5;
}

/** Thin surface strips, never a full-frame ornament or a light mask over the terrain cross section. */
export function waterSurfaces(L: LevelData): { points: Poly; light: number }[] {
  const out: { points: Poly; light: number }[] = [];
  const add = (top: Poly) => {
    if (top.length < 2) return;
    const x = top[Math.floor(top.length / 2)][0], y = top[Math.floor(top.length / 2)][1];
    const light = waterLightAt(L, x, y);
    if (light < 0.02) return;
    out.push({ points: [...top, ...top.map(([x, y]): [number, number] => [x, y + 16]).reverse()], light });
  };
  for (let x0 = 0; x0 < L.width; x0 += 160) {
    const pts: Poly = [];
    for (let x = x0; x <= Math.min(L.width, x0 + 160); x += 16) {
      const y = groundAt(L.terrain.hp, x);
      if (y < L.height - 10) pts.push([x, y]);
    }
    add(pts);
  }
  for (const r of L.rocks) {
    if (r.paintedProp === 'cave' || r.rx < 28) continue;
    const poly = r.poly ?? rockPoly(r.seed, r.rx, r.ry), pts: Poly = [];
    for (let x = -r.rx * 0.8; x <= r.rx * 0.8; x += 12) {
      const y = rockTop(poly, x);
      if (y !== null) pts.push([r.x + x, r.y + y]);
    }
    add(pts);
  }
  return out;
}
