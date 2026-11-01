import { HUNT } from '../data/life';

// ---------------------------------------------------------------------------
// Kampf-Beschleunigung der Jäger (Räuber und Herrscher): Sie schwimmen normal, solange sie nur umherziehen. Verfolgen sie aber ein Ziel
// oder sind sie im Kampf, steigern sie ihr Tempo mit der Zeit (surge 0 … 1, in HUNT.rise Sekunden voll) und halten es, solange der Kampf
// dauert; danach klingt es langsam ab (HUNT.fade). Das Verfolgungstempo wächst um bis zu HUNT.chase, Ausholen und Zuschnappen (der Biss
// selbst) um bis zu HUNT.attack – ein Jäger, der schon lange hinter dir her ist, beißt also schneller zu als einer, der gerade erst losschwimmt.
// ---------------------------------------------------------------------------

/** Ein Schritt der Beschleunigung: steigt im Kampf, klingt sonst ab. */
export function surgeStep(surge: number, fighting: boolean, dt: number) {
  return fighting ? Math.min(1, surge + dt / HUNT.rise) : Math.max(0, surge - dt / HUNT.fade);
}

/** Faktor auf das Verfolgungstempo (1 = normal). */
export const chasePace = (surge: number) => 1 + HUNT.chase * Math.max(0, Math.min(1, surge));

/** Faktor auf Ausholen und Zuschnappen (1 = normal). */
export const attackPace = (surge: number) => 1 + HUNT.attack * Math.max(0, Math.min(1, surge));
