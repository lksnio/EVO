// Die Welt und das Leben darin – alle Zahlen an einer Stelle. Es gibt keine Zeitalter-Abschnitte mehr: Die Weltzeit läuft
// für alle gleich weiter. Ein Fisch schlüpft, wächst heran, laicht – und wer laicht, lebt in seinen Nachkommen weiter.

/** Die Welt: dauerhaft und für alle Spieler gleich. */
export const WORLD = {
  /** Saat der Welt: Jeder Ort sieht für alle Spieler und in jedem Leben gleich aus. */
  seed: 'evo-welt-1',
  /** Beginn der Weltzeit (UTC). Ab hier laufen die Jahre – für alle gleich (später zählt die Uhr des Servers). */
  start: Date.UTC(2026, 9, 19),
  /** So viele Jahre vergehen je echter Sekunde: Die 12 Millionen Jahre des Ordoviziums dauern etwa 30 Tage. */
  yearsPerSecond: 12e6 / (30 * 86400),
};

/**
 * Ein Leben, gemessen in Sekunden aktiven Lebens (nur solange man spielt – wer offline ist, altert nicht):
 *   schlüpfen → heranwachsen → ausgewachsen (Laichzeit) → alt → Tod durch Altersschwäche.
 * Die ersten Leben sind kurz, jedes weitere etwas länger – logarithmisch mit der Generation: Wer viel spielt, verändert sich
 * immer seltener und hat Zeit, sich mit seinem Tier anzufreunden. Generation 1: 7 Minuten bis zur Laichzeit, danach noch
 * 4 Minuten; Generation 2: 10 + 5; Generation 4: 13 + 6; Generation 8: 16 + 7 (siehe sim/life.ts, phases).
 */
export const LIFE = {
  /** Größe beim Schlüpfen (Anteil der ausgewachsenen Größe) */
  hatch: 0.4,
  /** so viel der ausgewachsenen Größe gilt als ausgewachsen (dann kann man laichen) */
  adult: 0.92,
  /** Generation 1: nach so vielen Sekunden ist man ausgewachsen (Laichzeit) – das Wachstum nähert sich danach der vollen Größe */
  mature: 7 * 60,
  /** … und mit jeder Verdopplung der Generationen so viel später */
  maturePerDoubling: 3 * 60,
  /** Generation 1: so lange lebt man nach dem Ausgewachsensein noch – zum Laichen und danach */
  rest: 4 * 60,
  restPerDoubling: 60,
  /** ab diesem Anteil der Restzeit ist man alt: langsamer, schneller müde, weniger Lebenskraft */
  oldFrac: 0.6,
  /** so stark lässt das Alter am Ende nach (Anteil): Tempo, Ausdauer, Erholung, Lebenskraft */
  oldSpeed: 0.2,
  oldEndurance: 0.35,
  oldRecover: 0.3,
  oldHp: 0.25,
};

/**
 * Laichen: Gelaicht wird im Laichfluss (dem Startort, flussaufwärts der Mündung), dicht am Grund. Weibchen legen ein Gelege,
 * Männchen befruchten eines. Fehlt ein Partner, kommt einer deiner Art dazu (KI) – später auch andere Spieler.
 *
 * Nachkommen aus Nahrung: Was ein Tier in seinem Leben frisst (die Zahlen, die beim Fressen aufsteigen), nährt seine Brut.
 * Je perYoung davon wird ein Nachkomme – beim ersten Fisch 100: 250 gefressen → 2 Nachkommen, 490 → 4, 500 → 5. Wer
 * weiter entwickelt ist, braucht mehr (siehe sim/life.ts, broodBase): Nachkommen mit einem um 25 % stärkeren Biss etwa
 * 200, dazu 10 % schneller etwa 250. Die Nachkommen sind deine Leben: Stirbt dein
 * Tier, schlüpft das nächste aus dem Gelege – nach dem Laichen die nächste Generation, vorher ein Geschwister.
 */
export const SPAWN = {
  /**
   * Vorerst schlüpft jedes eigene Tier als Männchen: Laich deiner Art zum Befruchten liegt im Startgebiet immer bereit.
   * (Weibchen legen ab und warten auf ein Männchen – das gibt es weiterhin, nur schlüpft man gerade nicht als eines.)
   */
  alwaysMale: true,
  /** so satt muss man mindestens sein (Anteil des Magens): beim ersten Fisch kaum etwas, schwere Tiere mehr (bis minFoodMax) */
  minFood: 0.1,
  minFoodMax: 0.25,
  /** so stark wächst die Schwelle mit dem Gewicht (Gewicht im Verhältnis zum ersten Fisch, hoch minFoodExp) */
  minFoodExp: 0.4,
  /** so viel Nahrung je Nachkomme (beim ersten Fisch) … */
  perYoung: 100,
  /** … und je 1 % Verbesserung gegenüber dem ersten Fisch (Biss, Stoß, Tempo, Lebenskraft, Ausdauer, Zähigkeit) so viel % mehr */
  perGain: 4,
  /** höchstens so viele Nachkommen in einem Leben */
  maxYoung: 12,
  /** das kostet ein Gelege (Anteil des Magens): Weibchen bzw. Männchen */
  costFemale: 0.4,
  costMale: 0.2,
  /** frühestens wieder nach so vielen Sekunden aktiven Lebens */
  cooldown: 90,
  /** so nah (Bildpunkte) muss man über dem Grund sein */
  ground: 80,
  /** so nah (Bildpunkte) muss ein Männchen an einem Gelege sein (großzügig – die Strömung im Fluss treibt einen ab) */
  reach: 150,
  /** ein Männchen deiner Art kommt so viele Sekunden nach dem Ablegen (von … bis) */
  maleDelay: [3, 6] as [number, number],
  /** ein Weibchen deiner Art legt Laich, wenn ein Männchen bereit im Laichfluss ist – so viele Sekunden danach (von … bis) */
  femaleDelay: [5, 10] as [number, number],
  /** und danach frühestens wieder so viele Sekunden später */
  femaleEvery: 60,
  /** unbefruchtete Gelege verderben nach so vielen Sekunden Weltzeit */
  decay: 240,
  /** Eier je Gelege (so viel Nahrung steckt darin, wenn es jemand frisst) */
  eggs: 5,
};

/**
 * Vererbung beim Generationswechsel – keine Wahl mehr, die Nachkommen sind angepasst an die Spielweise:
 *   – Jede Evolutionsplatte wächst je nachdem, wie gut die Spielweise zu ihr passte (gain × Passung).
 *   – Was im Leben Stück für Stück gewachsen ist (Tarnung, Bodenkontakt …), setzt sich zum Teil fort (carry).
 *   – Größe aus dem Lebensraum, Robustheit aus überstandenen Angriffen, Kost aus der aufgenommenen Energie (wie bisher).
 *   – Der Partner gibt etwas von seinem Aussehen mit (partner).
 * Keine Generation verändert sich zu stark – aber so, dass man es merkt: Jede Richtung wächst höchstens um plateStep ihrer
 * vollen Ausprägung, alle zusammen um höchstens plateTotal; Größe, Robustheit, Kost und Fortgesetztes um höchstens step.
 */
export const INHERIT = {
  gain: 1.1,
  carry: 0.6,
  partner: 0.15,
  plateStep: 0.16,
  plateTotal: 0.22,
  /**
   * Wie im Fitnessstudio: Eine Richtung wächst nur so weit, wie die Gegner es hergeben, die man damit bezwungen hat. Ihre
   * Stärke (im Verhältnis zum eigenen ausgewachsenen Tier, die drei stärksten zählen) setzt die Obergrenze der Ausprägung:
   * ceilBase ohne nennenswerte Gegner, dazu ceilPer je „so stark wie du“. Kleine Beute (etwa halb so stark) trägt bis knapp
   * über die Hälfte, ebenbürtige Gegner bis drei Viertel, doppelt so starke bis ganz hinauf. Wer stärker wird, für den wird
   * dieselbe Beute schwächer – dann braucht es größere Gegner.
   */
  ceilBase: 0.3,
  ceilPer: 0.45,
  step: { growth: 0.1, armor: 0.1, diet: 0.25, carry: 0.07, fins: 0.08 },
};
