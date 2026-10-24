import type { RoeEgg } from '../state/GameState';

export type RoeValues = Record<'hp' | 'stam' | 'bite' | 'ram' | 'fins' | 'speed' | 'scales', number>;

/** Gleiche Eier stehen bei allen Spielern an derselben Stelle, unabhängig vom eigenen Tier. */
export function orderRoe(eggs: RoeEgg[], shown: (egg: RoeEgg) => RoeValues) {
  const base = shown({ traits: {}, sex: 1, seed: 0, place: '', x: 0, y: 0 });
  const score = (v: RoeValues) => (Object.keys(base) as (keyof RoeValues)[])
    .reduce((sum, k) => sum + v[k] / Math.max(1, base[k]), 0);
  return eggs.map((egg, i) => ({ egg, i, v: shown(egg) }))
    .sort((a, b) => score(b.v) - score(a.v) || ((a.egg.id ?? '') < (b.egg.id ?? '') ? -1 : (a.egg.id ?? '') > (b.egg.id ?? '') ? 1 : 0) || a.i - b.i);
}
