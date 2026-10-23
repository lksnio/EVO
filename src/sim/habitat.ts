import type { SpeciesDef } from '../data/species';
import type { PlaceDef } from '../data/world';

/** Dieselbe Verteilung für Bewohner, Zuwanderer und durchziehende Tiere. */
export function faunaAffinity(place: PlaceDef, animal: SpeciesDef): number {
  if (place.waterway === undefined) return 1;
  const i = place.waterway;
  if (animal.art.t === 'fish' && (animal.role === 'prey' || animal.power <= 4)) return [1.8, 1.25, 0.35][i];
  if (animal.power >= 6 && animal.art.t !== 'fish') return [0.08, 0.35, 5.5][i];
  if (animal.power >= 8) return [0.12, 0.5, 3.4][i];
  return [0.65, 1, 1.25][i];
}

/** 0 = erster Fisch, 1 = sehr kräftiges Tier. Wächst mit dauerhaften Fähigkeiten und Segen. */
export function habitatExtent(gain: number, blessings = 0): number {
  const strength = Math.max(0, gain) + Math.max(0, blessings) * 0.16;
  return 0.19 + 0.81 * (1 - Math.exp(-strength / 3));
}
