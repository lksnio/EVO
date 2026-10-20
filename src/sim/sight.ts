// ---------------------------------------------------------------------------
// Sicht unter Wasser. Ein Fisch sieht vor allem dorthin, wohin er schwimmt: nach vorn weit, zu den Seiten weniger, nach hinten
// nur ein kleines Stück um sich herum (damit man einen Jäger knapp hinter sich noch bemerkt). Was weiter weg ist, verschwimmt:
// erst ist da nur Wasser, dann ein Umriss, dann – beim Näherkommen – wird das Tier deutlich.
//
// Die Sicht (sight) ist der Anteil des ganzen Bildes vor dir, den man klar sieht: 1 = bis zum Bildrand, zu Beginn 0,2 (siehe
// UPGRADES in data/life.ts). Dahinter verschwimmt es über ein Stück (fade), dann ist nur noch Wasser.
// ---------------------------------------------------------------------------

export const SIGHT = {
  /** über diesen Anteil der vollen Weite verschwimmt es nach vorn (vom Klaren bis zu reinem Wasser) */
  fade: 0.35,
  /** nach hinten (und ein wenig rundum) sieht man klar bis hierher (Bildpunkte der Welt) … */
  back: 95,
  /** … und es verschwimmt über so viele */
  backFade: 115,
  /** Form des Blickfelds: je größer, desto schmaler der Kegel nach vorn */
  cone: 1.8,
  /** so dicht ist das Wasser, wo man nichts mehr sieht (1 = gar nichts vom Grund, 0,9 = ein Hauch) */
  murk: 0.9,
};

/**
 * Wie klar man etwas sieht (0 = nur Wasser … 1 = ganz klar). fwd und side: wo es liegt, von dir aus – fwd in Blickrichtung,
 * side quer dazu (Bildpunkte der Welt). sight: Anteil des Bildes (0 … 1); full: so weit ist es bis zum Bildrand vor dir.
 */
export function clarity(fwd: number, side: number, sight: number, full: number): number {
  const d = Math.hypot(fwd, side);
  const r = reach(d > 0 ? fwd / d : 1, sight, full);
  if (d <= r.clear) return 1;
  const t = Math.min(1, (d - r.clear) / r.fade);
  // weich auslaufen (smoothstep)
  return 1 - t * t * (3 - 2 * t);
}

/** Bis wohin es in dieser Richtung klar ist und über wie viel es danach verschwimmt (cos: Kosinus zur Blickrichtung). */
export function reach(cos: number, sight: number, full: number) {
  const w = Math.pow((1 + cos) / 2, SIGHT.cone);
  const front = Math.max(SIGHT.back, sight * full);
  return {
    clear: SIGHT.back + (front - SIGHT.back) * w,
    fade: SIGHT.backFade + (SIGHT.fade * full - SIGHT.backFade) * w,
  };
}

/** So weit reicht der Blick höchstens (nach vorn, bis nur noch Wasser ist). */
export function farthest(sight: number, full: number) {
  const r = reach(1, sight, full);
  return r.clear + r.fade;
}
