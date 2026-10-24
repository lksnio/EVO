// ---------------------------------------------------------------------------
// Sicht unter Wasser. Ein Fisch sieht vor allem dorthin, wohin er schwimmt – aber auch ein Stück hinter sich. Man denke an
// einen Zeitstrahl von 0 bis 10: Steht der Fisch auf 5 und schaut Richtung 10, sieht er 4, 5, 6, 7; dreht er sich um und
// schaut Richtung 0, sieht er 3, 4, 5, 6. Nach vorn reicht der Blick doppelt so weit wie nach hinten. In der Fläche ist das
// ein runder Bereich, dessen Mitte ein Stück vor dem Fisch liegt (in Blickrichtung) – beim Umdrehen gleitet er auf die
// andere Seite. Dahinter verschwimmt es kurz, dann ist nur noch trübes Wasser, weiter draußen das Dunkle.
//
// Wie weit man sieht, hängt an drei Dingen:
//   – an deinem Tier: seine Sicht (sight, der Anteil des ganzen Bildes vor dir – zu Beginn 0,2, siehe UPGRADES in data/life.ts),
//   – am Wasser: In sauberem Wasser sieht man klarer und weiter als in trübem (water, nach der Art des Ortes) – und durch
//     klares Wasser sieht man auch den Hintergrund und die Fische in der Ferne,
//   – an der Tiefe: Nah an der Oberfläche sieht man weiter, in der Tiefe weniger weit – und dort hört es viel plötzlicher auf
//     (die Ränder werden steiler, das Dunkle kommt früher und wird dichter).
// ---------------------------------------------------------------------------

export const SIGHT = {
  /** nach vorn sieht jedes Tier wenigstens so viel klar (Anteil der vollen Weite) – die Sicht kommt darauf: 0,1 + 0,9 × Sicht */
  front0: 0.1,
  /** nach hinten reicht der Blick so viel (Anteil des Blicks nach vorn): auf dem Zeitstrahl 1 nach hinten, 2 nach vorn */
  backShare: 0.5,
  /** … aber in klarem, flachem Wasser wenigstens so weit (Bildpunkte der Welt); bei schlechter Sicht sinkt auch dieser Sockel */
  back: 95,
  /** über diesen Anteil der vollen Weite verschwimmt es am Rand (nah an der Oberfläche; in der Tiefe weniger) */
  fade: 0.16,
  /** Wasser- und Lichtverhältnisse nach Art des Ortes (1 = ganz klar und hell) */
  water: { start: 1, lush: 0.8, murky: 0.5, deep: 0.7, abyss: 0.5 } as Record<string, number>,
  /** Trübung verkürzt die Sicht überproportional, statt fast nur den Hintergrund abzudunkeln */
  waterPower: 1.6,
  /** ab so viel Tiefe (Bildpunkte unter der Oberfläche) ist es ganz „tief“ */
  deepAt: 2400,
  /** dicht unter der Oberfläche reicht der Blick so viel weiter (Faktor) … */
  surface: 1.8,
  /** … und ganz in der Tiefe nur noch so weit (Faktor) */
  depth: 0.32,
  /** in der Tiefe wird der Übergang so viel kürzer (Anteil): Die Sicht hört plötzlicher auf */
  steep: 0.6,
  /** so dicht ist das trübe Wasser jenseits der Sicht: in ganz klarem Wasser dicht unter der Oberfläche … */
  murkClear: 0.42,
  /** … und in trübem oder tiefem Wasser */
  murkThick: 0.92,
  /** hinter dem Rand wird es dunkel (es beginnt gleich am Rand und nimmt nach außen zu): so dunkel in klarem Wasser … */
  dark: 0.36,
  /** … und in trübem oder tiefem (bis fast schwarz) */
  darkDeep: 0.94,
  /** so viel mal so lang wie der Übergang ins Trübe ist der ins Dunkle: in klarem Wasser … */
  darkSpread: 4,
  /** … und in der Tiefe (dort kommt das Schwarze früher) */
  darkSpreadDeep: 2.4,
  /**
   * Die Seitenlinie: So nah (Bildpunkte bis zum Rand des Tiers) spürt ein Fisch jedes Tier, auch im Trüben und hinter sich …
   */
  feel: 120,
  /** … und so weit ein Tier, das ihn jagt oder angreift (auch im Mehrspieler, wo das Bild des Angreifers etwas nachläuft) */
  feelThreat: 420,
  /** so deutlich ist, was man nur spürt: ein dunkler Umriss (ab 0,2 ganz deckend, siehe LevelScene.sightStep) … */
  feelClarity: 0.35,
  /** … und ein Jäger oder Angreifer: deutlich erkennbar, nur leicht vom Trüben verschleiert */
  feelThreatClarity: 0.6,
};

/**
 * Was ein Tier gerade sieht: wie weit nach vorn und nach hinten klar, und über wie viel es danach verschwimmt (Bildpunkte).
 * Der klare Bereich ist rund: seine Mitte liegt (front − back) / 2 vor dem Fisch, sein Halbmesser ist (front + back) / 2.
 */
export interface Vision {
  front: number;
  back: number;
  fade: number;
}

/** Wie tief man ist (0 = an der Oberfläche … 1 = ganz tief), nach den Bildpunkten unter der Oberfläche. */
export function depthOf(below: number) {
  return Math.max(0, Math.min(1, below / SIGHT.deepAt));
}

/** Wie klar das Wasser hier ist (0 = trüb bzw. tief und dunkel … 1 = ganz klar, dicht unter der Oberfläche). */
export function clearness(water = 1, deep = 0) {
  return Math.max(0, Math.min(1, Math.pow(water, SIGHT.waterPower) * (1 - 0.85 * Math.pow(deep, 0.8))));
}

/**
 * Was man sieht: sight – die Sicht deines Tiers (0 … 1); full – so weit ist es bis zum Bildrand vor dir; water – die
 * Wasserqualität (1 = sauber); deep – wie tief (0 … 1, siehe depthOf).
 */
export function vision(sight: number, full: number, water = 1, deep = 0): Vision {
  const d = Math.pow(deep, 0.8);
  const q = clearness(water, deep);
  const far = (SIGHT.surface + (SIGHT.depth - SIGHT.surface) * d) * Math.pow(water, SIGHT.waterPower);
  // Auch die Nähe wird in dunklem Wasser enger; ein fester Sockel würde bei jungen Fischen die Tiefe wieder aufheben.
  const near = SIGHT.back * (0.5 + 0.5 * q);
  const front = Math.max(near * 1.4, full * (SIGHT.front0 + (1 - SIGHT.front0) * sight) * far);
  return {
    front,
    back: Math.max(near, front * SIGHT.backShare),
    fade: Math.max(24, SIGHT.fade * full * (1 - SIGHT.steep * d) * (0.5 + 0.5 * q)),
  };
}

/** Wo die Mitte des klaren Bereichs liegt (so weit vor dem Fisch) und wie groß er ist (Halbmesser). */
export function disc(v: Vision) {
  return { ahead: (v.front - v.back) / 2, r: (v.front + v.back) / 2 };
}

/**
 * Was jenseits der Sicht liegt: wie dicht das trübe Wasser ist (murk), wie dunkel es nach außen höchstens wird (dark) und das
 * Feld, in dem es noch nicht ganz dunkel ist – derselbe Bereich mit einem viel längeren Übergang (in der Tiefe kürzer).
 */
export function veil(v: Vision, water = 1, deep = 0) {
  const q = clearness(water, deep);
  const k = SIGHT.darkSpreadDeep + (SIGHT.darkSpread - SIGHT.darkSpreadDeep) * q;
  return {
    murk: SIGHT.murkThick + (SIGHT.murkClear - SIGHT.murkThick) * q,
    dark: SIGHT.darkDeep + (SIGHT.dark - SIGHT.darkDeep) * q,
    field: { ...v, fade: v.fade * k },
  };
}

/** Wie klar es in diesem Abstand von der Mitte des klaren Bereichs ist (0 … 1). */
export function clarityFrom(d: number, v: Vision) {
  const r = disc(v).r;
  if (d <= r) return 1;
  const t = Math.min(1, (d - r) / v.fade);
  // weich, aber deutlich: Der Übergang ist kurz und läuft an beiden Enden sanft aus (smoothstep)
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Wie klar man etwas sieht (0 = nur Wasser … 1 = ganz klar). fwd und side: wo es liegt, von dir aus – fwd in Blickrichtung,
 * side quer dazu (Bildpunkte der Welt).
 */
export function clarity(fwd: number, side: number, v: Vision): number {
  return clarityFrom(Math.hypot(fwd - disc(v).ahead, side), v);
}

/** So weit reicht der Blick höchstens, von der Mitte des klaren Bereichs aus (bis nur noch Wasser ist). */
export function farthest(v: Vision) {
  return disc(v).r + v.fade;
}

/**
 * Die Seitenlinie: Was nah ist oder dich jagt, spürt ein Fisch auch dort, wo er nichts sieht – es bleibt wenigstens als
 * Umriss erkennbar. Nichts greift unsichtbar an. d: Abstand bis zum Rand des Tiers; threat: Es jagt oder greift dich an.
 * Gibt die Klarheit zurück, mit der man es spürt (0 … SIGHT.feelClarity, bei Gefahr SIGHT.feelThreatClarity); im äußeren
 * Drittel der Reichweite blendet es ein.
 */
export function sensed(d: number, threat: boolean) {
  const reach = threat ? SIGHT.feelThreat : SIGHT.feel;
  if (d >= reach) return 0;
  const t = Math.max(0, (d - reach * (2 / 3)) / (reach / 3));
  return (threat ? SIGHT.feelThreatClarity : SIGHT.feelClarity) * (1 - t);
}
