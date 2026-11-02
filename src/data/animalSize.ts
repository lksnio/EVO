import type { SpeciesDef } from './species';
import { SPECIES_FACTS } from './speciesFacts';

/** One centimetre in the world. Independent of camera zoom, drawing resolution, age and combat stats. */
export const WORLD_PX_PER_CM = 1;
export type SizeBasis = 'total' | 'body' | 'shell-length' | 'shell-diameter' | 'bell-diameter';
export function sizeBasis(def: SpeciesDef): SizeBasis {
  switch (def.art.t) {
    case 'jelly': return 'bell-diameter';
    case 'ammo': return 'shell-diameter';
    case 'cone': return 'shell-length';
    case 'bug': case 'trilo': return 'body';
    default: return 'total';
  }
}
export function adultLengthCm(def: Pick<SpeciesDef, 'id'>) {
  const fact = SPECIES_FACTS[def.id];
  if (!fact || !(fact.cm > 0)) throw Error(`Keine biologische Größenreferenz für ${def.id}`);
  return fact.cm;
}
export const worldLength = (def: Pick<SpeciesDef, 'id'>, individual = 1) => adultLengthCm(def) * WORLD_PX_PER_CM * individual;

// Same logarithmic outer whorl as drawAmmo. Diameter is the longest chord, not twice the spiral's off-centre radius.
const AMMO_DIAMETER = (() => {
  const points = Array.from({ length: 160 }, (_, i) => {
    const a = -.75 - i / 159 * Math.PI * 2, r = Math.exp(Math.log(1.85) / (Math.PI * 2) * (a + .75));
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  let span = 0;
  for (const a of points) for (const b of points) span = Math.max(span, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return span;
})();

/** Reference span in the existing drawing. Texture padding, tentacles, legs and pincers aren't body length. */
export function spriteReferenceSpan(def: SpeciesDef, textureWidth: number) {
  const a = def.art;
  switch (a.t) {
    case 'jelly': return 2 * a.r;
    case 'ammo': return a.r * AMMO_DIAMETER;
    case 'cone': return a.len * .775 + 1.5; // shell tip to aperture, excluding mantle and arms
    case 'bug': case 'trilo': return a.len;
    default: return Math.max(1, textureWidth - 4); // trimmed closed-mouth drawing, including caudal fin
  }
}
export function animalScale(def: SpeciesDef, referenceSpan: number) {
  if (!(referenceSpan > 0) || !Number.isFinite(referenceSpan)) throw Error(`Ungültiger Zeichenmaßstab für ${def.id}`);
  return worldLength(def) / referenceSpan;
}
