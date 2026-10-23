import type { SpeciesDef } from '../data/species';
import type { PlaceDef } from '../data/world';

/** Bewohner und Zuwanderer teilen ihre Verteilung; ein einzelner größerer Fisch darf selten durch den Laichfluss ziehen. */
export function faunaAffinity(place: PlaceDef, animal: SpeciesDef, passing = false): number {
  if (place.waterway === undefined) return 1;
  const i = place.waterway;
  if (i === 0) {
    if (animal.crawl && animal.power <= 3) return 1;
    if (animal.art.t === 'fish' && animal.power <= 5) return animal.role === 'prey' ? 0.75 : 0.25;
    return passing && animal.art.t === 'fish' && animal.art.len <= 120 && animal.role === 'predator' && animal.power <= 18 ? 0.15 : 0;
  }
  // Das Flachwasser hat die ersten größeren Jäger; die Riesen und Spitzenräuber leben erst im Tiefental.
  if (i === 1) {
    if (animal.boss || animal.role === 'apex' || animal.power >= 22) return 0;
    if (animal.role === 'predator' && animal.power >= 6) return 8;
  }
  if (animal.art.t === 'fish' && (animal.role === 'prey' || animal.power <= 4)) return [1.8, 1.25, 0.35][i];
  if (animal.power >= 6 && animal.art.t !== 'fish') return [0.08, 0.35, 5.5][i];
  if (animal.power >= 8) return [0.12, 0.5, 3.4][i];
  return [0.65, 1, 1.25][i];
}

/** Keine neuen Bewohner direkt auf dem eigenen Laichhaufen; natürliche Bewegung bleibt frei. */
export function nearNursery(place: PlaceDef, at: { x: number; y: number }, roe: readonly { x: number; y: number; own: boolean }[]) {
  return place.waterway === 0 && roe.some((r) => r.own && Math.hypot(at.x - r.x, at.y - r.y) < 500);
}

/** Im Laichfluss nur alle drei bis fünf Minuten ein einzelner größerer Besucher. */
export function passerDelay(place: PlaceDef, random = Math.random) {
  if (place.waterway === 0) return 180000 + random() * 120000;
  return (26000 + random() * 28000) * (place.waterway === 2 ? 0.7 : 1);
}

/** 0 = erster Fisch, 1 = sehr kräftiges Tier. Wächst mit dauerhaften Fähigkeiten und Segen. */
export function habitatExtent(gain: number, blessings = 0): number {
  const strength = Math.max(0, gain) + Math.max(0, blessings) * 0.16;
  return 0.19 + 0.81 * (1 - Math.exp(-strength / 3));
}
