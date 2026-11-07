import { clamp } from '../../util/math';
import { LINEAGE_ORIGIN, LINEAGE_WIDTH, lineageHasLegs, type LineageFormId, type LineageRegistration } from './forms';

const smooth = (a: number, b: number, value: number) => {
  const k = clamp((value - a) / (b - a), 0, 1); return k * k * (3 - 2 * k);
};
export interface LineagePose {
  phase: number; finPhase: number; speed: number; still: number; pitch: number; bob: number; lunge: number;
  opening: number; mode: 'swim' | 'idle' | 'crawl' | 'walk' | 'air';
}
export interface Binding { kind: 'body' | 'tail' | 'limb' | 'fin'; weight: number; pivot: readonly number[]; knee?: readonly number[]; phase?: number }
const BODY: Binding = { kind: 'body', weight: 0, pivot: [0, 0] };
const inPoly = (u: number, v: number, points: number[][]) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
// Fore/hind pairs are staggered in the original paintings. Only limb pixels below the body are bound;
// the belly, back, cheek and head always remain a single rigid volume.
const legs = [
  { pivot: [.69, .59], knee: [.69, .74], phase: 0, poly: [[.66,.56],[.74,.56],[.75,.69],[.775,.87],[.755,.91],[.68,.90],[.655,.80],[.65,.65]] },
  { pivot: [.44, .58], knee: [.40, .73], phase: Math.PI, poly: [[.405,.53],[.48,.54],[.49,.65],[.455,.76],[.48,.875],[.455,.91],[.385,.90],[.374,.79],[.385,.68]] },
  { pivot: [.74, .61], knee: [.77, .70], phase: Math.PI, poly: [[.745,.61],[.785,.62],[.79,.70],[.833,.76],[.826,.80],[.777,.80],[.758,.75]] },
  { pivot: [.40, .60], knee: [.35, .69], phase: 0, poly: [[.36,.61],[.405,.64],[.385,.70],[.377,.74],[.32,.76],[.293,.745],[.30,.71]] },
];
const shortLegs = [
  { pivot: [.71,.59], knee: [.70,.67], phase: 0, poly: [[.69,.575],[.75,.58],[.755,.65],[.72,.715],[.705,.746],[.67,.745],[.663,.72],[.677,.665]] },
  { pivot: [.44,.58], knee: [.43,.66], phase: Math.PI, poly: [[.405,.565],[.462,.565],[.475,.62],[.45,.68],[.44,.744],[.40,.745],[.389,.719],[.405,.67]] },
  { pivot: [.75,.62], knee: [.75,.65], phase: Math.PI, poly: [[.746,.62],[.775,.62],[.78,.67],[.767,.698],[.738,.69]] },
  { pivot: [.39,.60], knee: [.38,.64], phase: 0, poly: [[.36,.60],[.41,.61],[.397,.65],[.38,.68],[.356,.68],[.35,.65]] },
];
const breastFin = [[.664,.712],[.677,.650],[.703,.610],[.729,.599],[.746,.620],[.751,.641],[.732,.684],[.704,.718],[.681,.730]];
const farBreastFin = [[.655,.796],[.659,.761],[.676,.724],[.699,.724],[.708,.741],[.688,.780],[.665,.802]];
const pelvicFin = [[.322,.752],[.327,.714],[.347,.669],[.374,.673],[.391,.695],[.377,.719],[.350,.749],[.331,.759]];

export function lineageBinding(u: number, v: number, id: LineageFormId): Binding {
  const land = lineageHasLegs(id);
  if (land) {
    // The final jaw painting has a longer head and its four limbs sit a little farther back.
    const shift = id === 'shore-bite-2' ? -.045 : 0;
    for (const leg of id === 'transition' ? shortLegs : legs) if (inPoly(u - shift, v, leg.poly)) {
      return { kind: 'limb', weight: smooth(leg.pivot[1] - .015, leg.pivot[1] + .09, v),
        pivot: [leg.pivot[0] + shift, leg.pivot[1]], knee: [leg.knee[0] + shift, leg.knee[1]], phase: leg.phase };
    }
  } else {
    const fx = id === 'water-bite-2' ? -.045 : 0, fy = id === 'water-bite-2' ? .035 : 0;
    // Follow the painted fin contours. A rectangular region would also drag the belly into a visible notch.
    if (inPoly(u-fx,v-fy,breastFin)) return { kind: 'fin', weight: 1-smooth(.686,.750,u-fx), pivot: [.745+fx,.628+fy] };
    if (inPoly(u-fx,v-fy,farBreastFin)) return { kind: 'fin', weight: 1-smooth(.665,.708,u-fx), pivot: [.705+fx,.735+fy], phase: Math.PI };
    if (u > .29 && u < .40 && v < .40) return { kind: 'fin', weight: 1-smooth(.27,.41,v), pivot: [.39,.40] };
    if (inPoly(u,v,pelvicFin)) return { kind: 'fin', weight: 1-smooth(.34,.39,u), pivot: [.387,.69] };
  }
  // Appendages take precedence where the hind foot or a fin overlaps the tail's horizontal range.
  if (u < (land ? .38 : .36)) return { kind: 'tail', weight: 1 - smooth(land ? .20 : .19, land ? .39 : .37, u), pivot: [land ? .38 : .36, .51] };
  return BODY;
}

function rotate(x: number, y: number, pivot: readonly number[], angle: number, height: number) {
  const px = (pivot[0] - LINEAGE_ORIGIN[0]) * LINEAGE_WIDTH, py = (pivot[1] - LINEAGE_ORIGIN[1]) * height;
  const dx = x-px, dy=y-py, c=Math.cos(angle), s=Math.sin(angle);
  return { x:px+dx*c-dy*s, y:py+dx*s+dy*c };
}

/** All animation starts from original vertices. Trunk and skull never acquire a wave or change their dimensions. */
export function lineagePoint(u: number, v: number, r: LineageRegistration, p: LineagePose, binding: Binding = BODY, jaw = false) {
  const height = LINEAGE_WIDTH * r.height / r.width;
  let x=(u-LINEAGE_ORIGIN[0])*LINEAGE_WIDTH, y=(v-LINEAGE_ORIGIN[1])*height;
  const calm=1-.92*p.still;
  if (jaw) ({x,y}=rotate(x,y,r.hinge,p.opening,height));
  else if (binding.kind==='tail') {
    const amp=p.mode==='walk'||p.mode==='crawl'?.025+.045*p.speed:.04+.14*p.speed;
    ({x,y}=rotate(x,y,binding.pivot,Math.sin(p.phase)*amp*binding.weight*calm,height));
  } else if (binding.kind==='limb') {
    const stepping=p.mode==='walk'||p.mode==='crawl', swimming=p.mode==='swim';
    const amp=stepping?.12+.25*p.speed:swimming?.07+.13*p.speed:.015;
    const cycle=p.phase+(binding.phase??0), angle=Math.sin(cycle)*amp*binding.weight*calm;
    if (binding.knee && stepping) {
      const distal=smooth(binding.knee[1]-.015,binding.knee[1]+.065,v);
      ({x,y}=rotate(x,y,binding.knee,Math.max(0,Math.sin(cycle+.65))*.16*distal*calm,height));
    }
    ({x,y}=rotate(x,y,binding.pivot,p.mode==='air'?.17*binding.weight:angle,height));
  } else if (binding.kind==='fin') {
    ({x,y}=rotate(x,y,binding.pivot,Math.sin(p.finPhase+(binding.phase??0))*(.09+.10*p.speed)*binding.weight*calm,height));
  }
  const c=Math.cos(p.pitch),s=Math.sin(p.pitch);
  return {x:x*c-y*s+p.lunge,y:x*s+y*c+p.bob,rot:p.pitch};
}
