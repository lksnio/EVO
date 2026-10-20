// ---------------------------------------------------------------------------
// Der Biss der Jäger. Erst färbt sich das Tier rot und spannt sich (ausholen, das Maul geht halb auf) – jetzt kann man noch
// ausweichen. Dann schwimmt es kurz viel schneller auf dich zu, das Maul weit aufgerissen (vorschnellen), und schnappt zu,
// sobald etwas zwischen seinen Kiefern ist. Gelenkt wird nur am Anfang des Vorstoßes: Wer danach zur Seite schwimmt, entkommt
// mit etwas Glück – geschadet wird nur, was im Maul landet, bloßes Berühren tut nichts.
//
// Damit man die Jäger nicht nach dem Takt ausspielen kann, ist jeder Biss ein wenig anders: mal holen sie kürzer aus und
// schnappen schneller zu, mal warten sie länger bis zum nächsten Biss. Nicht viel – sie bleiben lesbar.
// ---------------------------------------------------------------------------

export const BITE = {
  /** so weit vor seinem Maul muss das Ziel sein, damit er zum Biss ansetzt (Bildpunkte) – das schwimmt er beim Vorschnellen */
  reach: 75,
  /** so lange holt ein Jäger aus (Sekunden) … */
  wind: 0.3,
  /** … ein großer (Spitzenräuber, Endgegner) */
  windBig: 0.5,
  /** so lange schwimmt er schneller auf das Ziel zu (Sekunden; große etwas länger) */
  dash: 0.32,
  /** beim weiten Vorstoß eines großen Räubers (aus größerer Entfernung) so viel länger */
  long: 1.8,
  /** so schnell dabei: × sein Angriffstempo, wenigstens speedMin (Bildpunkte je Sekunde) */
  speed: 2.4,
  speedMin: 260,
  /** so lange erholt er sich nach dem Zuschnappen (Sekunden; nach einem Fehlbiss etwas länger) */
  rec: 0.36,
  /** so lange bis zum nächsten Biss (Millisekunden): Jäger, große */
  rest: 850,
  restBig: 1100,
  /** jede Phase dauert ± so viel länger oder kürzer (Anteil) */
  spread: 0.18,
  /** so oft holt er ganz kurz aus und schnappt besonders schnell zu … */
  quickChance: 0.2,
  /** … dann nur so lange (Anteil) */
  quick: 0.7,
  /** die Pause bis zum nächsten Biss: × (restLo … restHi) */
  restLo: 0.7,
  restHi: 1.4,
  /** manchmal wartet er noch etwas länger (so oft, so viele Millisekunden mehr) */
  pauseChance: 0.15,
  pauseMin: 400,
  pauseMax: 900,
  /** gelenkt wird nur auf diesem ersten Stück des Vorstoßes (Anteil) – danach ist der Biss entschieden */
  aim: 0.4,
  /** so schnell dreht er sich dabei höchstens nach dem Ziel (Bogenmaß je Sekunde) */
  turn: 3,
};

/** Ein Biss: wie lange er ausholt, vorschnellt und sich erholt (Sekunden), und wie schnell (Bildpunkte je Sekunde). */
export interface BitePlan {
  wind: number;
  dash: number;
  speed: number;
  rec: number;
}

/**
 * Wie ein Biss abläuft – jedes Mal ein wenig anders. atkSpeed: Angriffstempo der Art; big: großer Räuber; long: weiter
 * Vorstoß aus größerer Entfernung; rnd: Zufall (0 … 1).
 */
export function bitePlan(atkSpeed: number, big: boolean, long = false, rnd: () => number = Math.random): BitePlan {
  const vary = () => 1 + (rnd() * 2 - 1) * BITE.spread;
  const quick = rnd() < BITE.quickChance ? BITE.quick : 1;
  return {
    wind: (big ? BITE.windBig : BITE.wind) * (long ? 1.15 : 1) * quick * vary(),
    dash: BITE.dash * (big ? 1.15 : 1) * (long ? BITE.long : 1) * (quick < 1 ? 0.9 : 1) * vary(),
    speed: Math.max(atkSpeed * BITE.speed, BITE.speedMin) * (big ? 1.1 : 1) * (1 + (rnd() * 2 - 1) * BITE.spread * 0.6),
    rec: BITE.rec * vary(),
  };
}

/** Wie lange er bis zum nächsten Biss wartet (Millisekunden) – mal kürzer, mal länger. */
export function biteRest(big: boolean, rnd: () => number = Math.random) {
  let ms = (big ? BITE.restBig : BITE.rest) * (BITE.restLo + (BITE.restHi - BITE.restLo) * rnd());
  if (rnd() < BITE.pauseChance) ms += BITE.pauseMin + (BITE.pauseMax - BITE.pauseMin) * rnd();
  return ms;
}
