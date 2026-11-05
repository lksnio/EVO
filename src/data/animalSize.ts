import type { SpeciesDef } from './species';
import { SPECIES_FACTS } from './speciesFacts';

/** Display tuning, independent of the biological facts printed in the chronicle. */
export const SIZE_REFERENCE_CM = 100;
export const REFERENCE_WORLD_LENGTH = 240;
export const SIZE_COMPRESSION = .85;
/** About 17 native screen pixels at the ordinary .72 play zoom, before individual growth. */
export const MIN_ADULT_WORLD_LENGTH = 24;

/** Representative play choices: larger small specimens and conservative large specimens.
 * These are art-direction choices, not newly measured fossil uncertainty intervals.
 * Species without a reliable alternative retain their existing chronicle reference.
 */
export const PLAY_LENGTH_CM: Readonly<Record<string, number>> = {
  moythomasia: 10, birkenia: 10, cheiracanthus: 30, osteolepis: 25, elonichthys: 20,
  cladoselache: 100, dunkleosteus: 340, hyneria: 250, rhizodus: 600, cameroceras: 400,
  tiktaalik: 125, pterygotus: 160, megalograptus: 100,
  ctenodus: 100, megalichthys: 100, crassigyrinus: 150, strepsodus: 200,
  protosphyraena: 200, squalicorax: 200, xiphactinus: 400, archelon: 350,
  cretoxyrhina: 500, platecarpus: 430, elasmosaurus: 1000, tylosaurus: 1000, mosasaurus: 1100,
};
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
  if (!fact || !(fact.cm > 0)) throw Error(`No biological size reference for ${def.id}`);
  return fact.cm;
}
export function playLengthCm(def: Pick<SpeciesDef, 'id'>) {
  const reference = adultLengthCm(def);
  return PLAY_LENGTH_CM[def.id] ?? reference;
}
/** Larger overall, with a gentle power curve and a floor that keeps the smallest adults readable. */
export function worldLength(def: Pick<SpeciesDef, 'id'>, individual = 1) {
  const cm = playLengthCm(def);
  const adult = Math.max(MIN_ADULT_WORLD_LENGTH, REFERENCE_WORLD_LENGTH * (cm / SIZE_REFERENCE_CM) ** SIZE_COMPRESSION);
  return adult * individual;
}

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
  if (!(referenceSpan > 0) || !Number.isFinite(referenceSpan)) throw Error(`Invalid drawing scale for ${def.id}`);
  return worldLength(def) / referenceSpan;
}
