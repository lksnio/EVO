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
  /** in den letzten so vielen Sekunden wird das Tier spürbar langsamer – bis auf fadeTo seines Tempos, dann schläft es ein */
  fadeSeconds: 40,
  fadeTo: 0.45,
};

/**
 * Laichen: Gelaicht wird im Laichfluss (dem Startort, flussaufwärts der Mündung), dicht am Grund. Weibchen legen ein Gelege,
 * Männchen befruchten eines. Fehlt ein Partner, kommt einer deiner Art dazu (KI) – später auch andere Spieler.
 *
 * Nachkommen aus Nahrung: Hunger gibt es nicht – was ein Tier frisst (die Zahlen, die beim Fressen aufsteigen), sammelt sich
 * für die Brut. Beim Laichen wird daraus Nachwuchs: je perYoung ein Nachkomme (beim ersten Fisch 100), der Rest bleibt
 * für das nächste Mal. Wer mehrmals laicht, hat mehr Nachkommen – sie zählen zusammen (250 gefressen, gelaicht: 2; später
 * noch einmal 100 gefressen und gelaicht: 3). Weiter entwickelte Tiere brauchen etwas mehr (siehe sim/life.ts, broodBase).
 * Die Nachkommen sind deine Leben: Stirbt dein Tier, schlüpft das nächste aus dem Gelege – nach dem Laichen die nächste
 * Generation, vorher ein Geschwister.
 */
export const SPAWN = {
  /**
   * Vorerst schlüpft jedes eigene Tier als Männchen: Laich deiner Art zum Befruchten liegt im Startgebiet immer bereit.
   * (Weibchen legen ab und warten auf ein Männchen – das gibt es weiterhin, nur schlüpft man gerade nicht als eines.)
   */
  alwaysMale: true,
  /** so viel Nahrung je Nachkomme (beim ersten Fisch) … */
  perYoung: 100,
  /**
   * … und so viel mehr, je weiter das Tier entwickelt ist: perGain × die Verbesserungen gegenüber dem ersten Fisch, zusammengezählt
   * (Biss, Stoß, Tempo, Lebenskraft, Ausdauer, Zähigkeit). Nur das Gebiss 25 % stärker: 100 × (1 + 2 × 0,25) = 150; dazu 10 %
   * schneller: 170. Eine Generation bringt meist 10–25 % zusammen – die zweite braucht also etwa 120–150.
   */
  perGain: 2,
  /** höchstens so viele Nachkommen in einem Leben */
  maxYoung: 12,
  /** nach dem Laichen frühestens wieder nach so vielen Sekunden aktiven Lebens */
  cooldown: 30,
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
 * Vererbung beim Generationswechsel – keine Wahl, die Nachkommen sind angepasst an die Spielweise. Das eigene Tier verändert
 * sich im Leben nicht (es wächst nur heran und altert): Was es tut, zeigt sich erst an seinen Nachkommen.
 *   – Jede Evolutionsplatte wächst je nachdem, wie gut die Spielweise zu ihr passte (gain × Passung).
 *   – Was sich im Leben angesammelt hat (Tarnung beim Verstecken, Bodenkontakt am Grund …), geht zum Teil weiter (carry).
 *   – Größe aus dem Lebensraum, Robustheit aus überstandenen Angriffen, Kost aus der aufgenommenen Energie.
 *   – Der Partner gibt etwas von seinem Aussehen mit (partner).
 * Keine Generation verändert sich zu stark – man merkt es erst über mehrere: Jede Richtung wächst höchstens um plateStep
 * ihrer vollen Ausprägung (beim Gebiss etwa 15 % Beißkraft), alle zusammen um höchstens plateTotal; Größe, Robustheit, Kost
 * und Fortgesetztes um höchstens step.
 */
export const INHERIT = {
  /** eine Richtung wächst um plateStep × gain × Passung (höchstens plateStep): Wer fast nur stößt, bekommt den vollen Schritt */
  gain: 1.1,
  carry: 0.6,
  partner: 0.15,
  plateStep: 0.045,
  plateTotal: 0.065,
  /**
   * Wie im Fitnessstudio: Eine Richtung wächst nur so weit, wie die Gegner es hergeben, die man damit bezwungen hat. Ihre
   * Stärke (im Verhältnis zum eigenen ausgewachsenen Tier, die drei stärksten zählen) setzt die Obergrenze der Ausprägung:
   * ceilBase ohne nennenswerte Gegner, dazu ceilPer je „so stark wie du“. Kleine Beute (etwa halb so stark) trägt bis knapp
   * über die Hälfte, ebenbürtige Gegner bis drei Viertel, doppelt so starke bis ganz hinauf. Wer stärker wird, für den wird
   * dieselbe Beute schwächer – dann braucht es größere Gegner.
   */
  ceilBase: 0.3,
  ceilPer: 0.45,
  step: { growth: 0.03, armor: 0.035, diet: 0.15, carry: 0.04, fins: 0.04 },
};

/** Was sonst noch das Gleichgewicht bestimmt (alles in der Entwickler-Einstellung, siehe data/tuning.ts). */
export const MISC = {
  /** Beim Ausruhen heilt der Körper nur bis zu diesem Anteil der Lebenskraft */
  restHealCap: 0.75,
  /** ein Bissen Heilkraut gibt so viel Lebenskraft zurück (Anteil am Maximum) */
  healBite: 0.17,
  /** eine abgefressene Pflanze wächst nach so vielen Sekunden um einen Bissen nach … */
  plantRegrow: 22,
  /** … zur Blütezeit nach so vielen */
  plantRegrowBloom: 2.5,
  /** so viel Fleisch nimmt ein anderes Tier mit einem Biss */
  animalBite: 5,
  /** so viele Sekunden Leben kostet ein Weg über die Karte */
  travel: 7,
};
