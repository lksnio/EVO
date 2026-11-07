import type { Layout, Morph } from '../creatureArt';
import registration from './registration.json';

export const LINEAGE_FORM_IDS = ['transition', 'water', 'water-bite-1', 'water-bite-2', 'water-skull-1', 'water-skull-2',
  'shore', 'shore-bite-1', 'shore-bite-2', 'shore-skull-1', 'shore-skull-2'] as const;
export type LineageFormId = typeof LINEAGE_FORM_IDS[number];
export type Point = readonly [number, number];
export interface LineageRegistration {
  id: LineageFormId;
  source: string;
  sourceSize: number[];
  sourceSha256: string;
  width: number;
  height: number;
  bounds: number[];
  eye: number[];
  skin: number;
  hinge: number[];
  upperLip: number[][];
  lowerLip: number[][];
  paintAngle: number;
  teeth: { upper: boolean; polygon: number[][] }[];
}
export const LINEAGE_REGISTRATION = registration as LineageRegistration[];
export const validLineageForm = (value: unknown): value is LineageFormId => typeof value === 'string' && LINEAGE_FORM_IDS.includes(value as LineageFormId);
export const lineageRegistration = (id: LineageFormId) => LINEAGE_REGISTRATION.find(r => r.id === id)!;
export const lineageHasLegs = (id: LineageFormId) => id === 'transition' || id.startsWith('shore');
export const LINEAGE_WIDTH = 128;
export const LINEAGE_ORIGIN: Point = [.55, .54];

/** A common registration puts the paintings and collision rectangles in the same world units. */
export function lineageLayout(m: Morph): Layout {
  const id = validLineageForm(m.lineageForm) ? m.lineageForm : 'transition';
  const r = lineageRegistration(id), width = LINEAGE_WIDTH, height = width * r.height / r.width, s = m.size;
  const x = (u: number) => (u - LINEAGE_ORIGIN[0]) * width;
  const y = (v: number) => (v - LINEAGE_ORIGIN[1]) * height;
  const land = lineageHasLegs(id), transition = id === 'transition';
  const neck: [number, number] = [x(.76) * s, 0];
  const hx = x(r.hinge[0]), hy = y(r.hinge[1]);
  const foot = land ? transition ? .74 : .89 : .78;
  return {
    s, land, bw: 68 * s, bh: 24 * s, neck, tail: [x(.36) * s, 0],
    legF: [x(.70) * s, y(.59) * s], legB: [x(.44) * s, y(.59) * s], legLen: (transition ? 6 : 12) * s,
    topY: y(r.bounds[1]) * s, footY: y(foot) * s, halfW: 34 * s,
    hg: { L: x(r.bounds[2]) - x(.76), H: 24, mouthY: hy, hingeX: hx - x(.76), jawH: 8,
      dome: 0, snoutH: 12, ex: x(r.eye[0]) - x(.76), ey: y(r.eye[1]), er: r.eye[2] * width },
    bite: { x: (hx - 2) * s, y: (hy - 8) * s, w: (x(r.bounds[2]) - hx + 13) * s, h: 19 * s },
  };
}
