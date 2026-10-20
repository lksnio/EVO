// ---------------------------------------------------------------------------
// Sicht unter Wasser. Ein Fisch sieht vor allem dorthin, wohin er schwimmt: nach vorn weit, zu den Seiten weniger, nach hinten
// nur ein kleines Stück um sich herum (damit man einen Jäger knapp hinter sich noch bemerkt). Was weiter weg ist, verschwimmt
// – erst in trübes Wasser, weiter draußen ins Dunkle: Ein Tier ist erst gar nicht da, dann ein Umriss, beim Näherkommen deutlich.
//
// Wie weit man sieht, hängt an drei Dingen:
//   – an deinem Tier: seine Sicht (sight, der Anteil des ganzen Bildes vor dir – zu Beginn 0,2, siehe UPGRADES in data/life.ts),
//   – am Wasser: In sauberem Wasser sieht man klarer und weiter als in trübem (water, nach der Art des Ortes),
//   – an der Tiefe: Nah an der Oberfläche sieht man weiter, in der Tiefe weniger weit – und dort hört es viel plötzlicher auf
//     (die Ränder werden steiler, das Dunkle kommt früher).
// ---------------------------------------------------------------------------

export const SIGHT = {
  /** nach vorn sieht jedes Tier wenigstens so viel klar (Anteil der vollen Weite) – die Sicht kommt darauf: 0,1 + 0,9 × Sicht */
  front0: 0.1,
  /** über diesen Anteil der vollen Weite verschwimmt es nach vorn (nah an der Oberfläche; in der Tiefe weniger) */
  fade: 0.16,
  /** nach hinten (und ein wenig rundum) sieht man klar bis hierher (Bildpunkte der Welt) … */
  back: 95,
  /** … und es verschwimmt über so viele */
  backFade: 70,
  /** Form des Blickfelds: je größer, desto schmaler der Kegel nach vorn */
  cone: 1.8,
  /** so dicht ist das trübe Wasser, wo man nichts mehr sieht (1 = gar nichts vom Grund, 0,9 = ein Hauch) */
  murk: 0.9,
  /** Wasserqualität nach Art des Ortes (1 = sauber): Wie weit man dort sieht (Faktor) */
  water: { start: 1, lush: 0.9, murky: 0.62, deep: 0.92, abyss: 0.88 } as Record<string, number>,
  /** ab so viel Tiefe (Bildpunkte unter der Oberfläche) ist es ganz „tief“ */
  deepAt: 3200,
  /** dicht unter der Oberfläche reicht der Blick so viel weiter (Faktor) … */
  surface: 1.15,
  /** … und ganz in der Tiefe nur noch so weit (Faktor) */
  depth: 0.68,
  /** in der Tiefe wird der Übergang so viel kürzer (Anteil): Die Sicht hört plötzlicher auf */
  steep: 0.6,
  /**
   * Hinter dem Rand der Sicht wird es dunkel – es beginnt gleich am Rand und nimmt nach außen zu: so dunkel wird es nah an
   * der Oberfläche höchstens …
   */
  dark: 0.55,
  /** … und in der Tiefe (bis fast schwarz) */
  darkDeep: 0.94,
  /** so viel mal so lang wie der Übergang ins Trübe ist der ins Dunkle: nah an der Oberfläche … */
  darkSpread: 4.5,
  /** … und in der Tiefe (dort kommt das Schwarze früher) */
  darkSpreadDeep: 2.4,
};

/** Was ein Tier gerade sieht: wie weit nach vorn und nach hinten klar, und über wie viel es danach verschwimmt (Bildpunkte). */
export interface Vision {
  front: number;
  back: number;
  fade: number;
  backFade: number;
}

/** Wie tief man ist (0 = an der Oberfläche … 1 = ganz tief), nach den Bildpunkten unter der Oberfläche. */
export function depthOf(below: number) {
  return Math.max(0, Math.min(1, below / SIGHT.deepAt));
}

/**
 * Was man sieht: sight – die Sicht deines Tiers (0 … 1); full – so weit ist es bis zum Bildrand vor dir; water – die
 * Wasserqualität (1 = sauber); deep – wie tief (0 … 1, siehe depthOf).
 */
export function vision(sight: number, full: number, water = 1, deep = 0): Vision {
  const d = Math.pow(deep, 0.8);
  const far = (SIGHT.surface + (SIGHT.depth - SIGHT.surface) * d) * water;
  const soft = 1 - SIGHT.steep * d;
  return {
    front: Math.max(SIGHT.back + 20, full * (SIGHT.front0 + (1 - SIGHT.front0) * sight) * far),
    back: SIGHT.back,
    fade: Math.max(40, SIGHT.fade * full * soft * (0.75 + 0.25 * water)),
    backFade: SIGHT.backFade * soft,
  };
}

/**
 * Das Dunkle hinter dem Rand der Sicht: wie dunkel es höchstens wird (alpha) und das Feld, in dem es noch nicht ganz dunkel
 * ist – dasselbe Blickfeld, nur mit einem viel längeren Übergang (in der Tiefe kürzer: Dort kommt das Schwarze früher).
 */
export function darkness(v: Vision, deep: number): { alpha: number; field: Vision } {
  const k = SIGHT.darkSpread + (SIGHT.darkSpreadDeep - SIGHT.darkSpread) * deep;
  return {
    alpha: SIGHT.dark + (SIGHT.darkDeep - SIGHT.dark) * deep,
    field: { ...v, fade: v.fade * k, backFade: v.backFade * k },
  };
}

/** Bis wohin es in dieser Richtung klar ist und über wie viel es danach verschwimmt (cos: Kosinus zur Blickrichtung). */
export function reach(cos: number, v: Vision) {
  const w = Math.pow((1 + cos) / 2, SIGHT.cone);
  return { clear: v.back + (v.front - v.back) * w, fade: v.backFade + (v.fade - v.backFade) * w };
}

/**
 * Wie klar man etwas sieht (0 = nur Wasser … 1 = ganz klar). fwd und side: wo es liegt, von dir aus – fwd in Blickrichtung,
 * side quer dazu (Bildpunkte der Welt).
 */
export function clarity(fwd: number, side: number, v: Vision): number {
  const d = Math.hypot(fwd, side);
  const r = reach(d > 0 ? fwd / d : 1, v);
  if (d <= r.clear) return 1;
  const t = Math.min(1, (d - r.clear) / r.fade);
  // weich, aber deutlich: Der Übergang ist kurz und läuft an beiden Enden sanft aus (smoothstep)
  return 1 - t * t * (3 - 2 * t);
}

/** So weit reicht der Blick höchstens (nach vorn, bis nur noch Wasser ist). */
export function farthest(v: Vision) {
  const r = reach(1, v);
  return r.clear + r.fade;
}
