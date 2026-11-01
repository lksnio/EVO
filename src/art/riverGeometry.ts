import type { Rect } from '../util/math';

/** All source coordinates below refer to the untouched asset package. */
export const CAVE_FRAME = { w: 1681, h: 935, ground: 875, x0: 35, x1: 1614 };
export const NEST_FRAME = { w: 1774, h: 887, ground: 790, x: 900.5, x0: 46, x1: 1755 };

/** Shared canvas registration, including transparent margins; independent alpha cropping would misalign the layers. */
export function cavePlacement(c: Rect) {
  // The old shelter includes a solid rear buttress to the left of the interaction rectangle.
  const width = Math.max(c.w + 120, c.h * 2 * (CAVE_FRAME.x1 - CAVE_FRAME.x0) / (CAVE_FRAME.ground - 64));
  const scale = width / (CAVE_FRAME.x1 - CAVE_FRAME.x0);
  return { x: c.x + c.w - width - CAVE_FRAME.x0 * scale, y: c.y + c.h - CAVE_FRAME.ground * scale + 2,
    w: CAVE_FRAME.w * scale, h: CAVE_FRAME.h * scale };
}

/** Stable prefix: losing an egg never moves the remaining eggs. Logical counts are not inferred from artwork. */
export function eggLayout(max: number) {
  return Array.from({ length: Math.max(0, Math.floor(max)) }, (_, i) => {
    const row = Math.floor(i / 5), col = i % 5;
    return { x: [0, -12, 12, -6, 6][col] + (row % 2 ? 2 : 0),
      y: -3 - row * 7 - [2, 0, 0, 8, 7][col],
      width: [13, 11, 11.5, 12.5, 12][col], angle: [-0.08, -0.14, 0.1, 0.06, -0.04][col] };
  });
}
