import { clamp } from '../../util/math';

const smooth = (a: number, b: number, v: number) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

export interface StarterMotionGeometry {
  width: number;
  height: number;
  hinge: readonly number[];
}
export interface StarterMotionPose {
  phase: number;
  speed: number;
  still: number;
  pitch: number;
  bob: number;
  lunge: number;
  opening: number;
  finPhase?: number;
  kick?: number;
}

/** Rigid trunk and head, a bending tail peduncle, and small fin strokes. Every pose starts from the painting. */
export function starterPoint(u: number, v: number, g: StarterMotionGeometry, p: StarterMotionPose, jaw = false, finWeight = 0) {
  let x = (u - .55) * g.width, y = (v - .54) * g.height;
  if (jaw) {
    const hx = (g.hinge[0] - .55) * g.width, hy = (g.hinge[1] - .54) * g.height;
    const dx = x - hx, dy = y - hy, c = Math.cos(p.opening), s = Math.sin(p.opening);
    x = hx + dx * c - dy * s; y = hy + dx * s + dy * c;
  }
  const calm = 1 - .85 * p.still;
  if (!jaw && u < .44) {
    // The caudal fin rotates as one shape; only its narrow attachment bends towards the stable trunk.
    const angle = Math.sin(p.phase) * (.038 + clamp(p.speed, 0, 1.5) * .17) * (1 + (p.kick ?? 0) * .35) * (1 - smooth(.24, .44, u)) * calm;
    const pivot = (.44 - .55) * g.width, dx = x - pivot, c = Math.cos(angle), s = Math.sin(angle);
    x = pivot + dx * c - y * s; y = dx * s + y * c;
  }
  if (!jaw && finWeight > 0) {
    const dorsal = (1 - smooth(.25, .38, v)) * smooth(.25, .38, u) * (1 - smooth(.72, .8, u));
    const ventral = smooth(.64, .78, v) * smooth(.25, .36, u) * (1 - smooth(.6, .72, u));
    const pectoral = smooth(.57, .73, v) * (1 - smooth(.59, .69, u)) * smooth(.46, .55, u);
    const phase = p.finPhase ?? p.phase * .8, speed = clamp(p.speed, 0, 1);
    const median = Math.max(dorsal, ventral) * finWeight * calm;
    // Fin rays trail with the flow; the pectoral fin makes a slower paddle stroke from its root.
    x += (Math.sin(phase - u * 1.5) * .9 - speed * .65) * median;
    y += Math.cos(phase - u * 1.5) * .4 * median;
    const flap = (.12 + Math.sin(phase * 1.15) * .34 * (1 - .55 * speed) - (.15 + .55 * speed) * .35) * calm;
    const px = (.65 - .55) * g.width, py = (.6 - .54) * g.height, dx = x - px, dy = y - py;
    const weight = pectoral * finWeight;
    x += (dx * (Math.cos(flap) - 1) - dy * Math.sin(flap)) * weight;
    y += (dx * Math.sin(flap) + dy * (Math.cos(flap) - 1)) * weight;
  }
  // Posture and bite recoil move the whole body; the cheek and belly never ripple or stretch.
  const c = Math.cos(p.pitch), s = Math.sin(p.pitch);
  return { x: x * c - y * s + p.lunge, y: x * s + y * c + p.bob, rot: p.pitch };
}
