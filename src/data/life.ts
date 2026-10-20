// Die Welt und das Leben darin – alle Zahlen an einer Stelle. Es gibt keine Zeitalter-Abschnitte mehr: Die Weltzeit läuft
// für alle gleich weiter. Ein Fisch schlüpft, wächst heran, laicht – und wer laicht, lebt in seinen Nachkommen weiter.

/** Die Welt: dauerhaft und für alle Spieler gleich. */
export const WORLD = {
  /** Saat der Welt: Jeder Ort sieht für alle Spieler und in jedem Leben gleich aus. */
  seed: 'evo-welt-1',
  /** Beginn der Weltzeit (UTC). Ab hier laufen die Jahre – für alle gleich (später zählt die Uhr des Servers). */
  start: Date.UTC(2026, 9, 19),
  /** So viele Jahre vergehen je echter Sekunde: Die 12 Millionen Jahre des Devons (383 bis 371 Millionen Jahre vor heute) dauern etwa 30 Tage. */
  yearsPerSecond: 12e6 / (30 * 86400),
};

/**
 * Ein Leben, gemessen in Sekunden aktiven Lebens (nur solange man spielt – wer offline ist, altert nicht):
 *   schlüpfen → heranwachsen → ausgewachsen (Laichzeit) → alt → Tod durch Altersschwäche.
 * Die ersten Leben sind kurz, jedes weitere etwas länger – logarithmisch mit der Generation: Wer viel spielt, verändert sich
 * immer seltener und hat Zeit, sich mit seinem Tier anzufreunden. Ausgewachsen ist man früh – ab dann kann man laichen, und
 * zwar bis kurz vor dem Tod. Generation 1: 3 Minuten bis zur Laichzeit, danach noch 8 Minuten; Generation 2: 4 + 11;
 * Generation 4: 5 + 14; Generation 8: 6 + 17 (siehe sim/life.ts, phases).
 */
export const LIFE = {
  /** Größe beim Schlüpfen (Anteil der ausgewachsenen Größe) */
  hatch: 0.4,
  /** so viel der ausgewachsenen Größe gilt als ausgewachsen (dann kann man laichen) */
  adult: 0.92,
  /** Generation 1: nach so vielen Sekunden ist man ausgewachsen (Laichzeit) – das Wachstum nähert sich danach der vollen Größe */
  mature: 3 * 60,
  /** … und mit jeder Verdopplung der Generationen so viel später */
  maturePerDoubling: 60,
  /** Generation 1: so lange lebt man nach dem Ausgewachsensein noch – die ganze Zeit kann man laichen */
  rest: 8 * 60,
  restPerDoubling: 3 * 60,
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
 * Nachkommen aus Nahrung: Hunger gibt es nicht – was ein Tier frisst (die Zahlen, die beim Fressen aufsteigen: ein kleiner
 * Fleischbrocken oder eine Pflanze 1, ein großer Brocken 5), sammelt sich für die Brut. Beim Laichen wird daraus Nachwuchs:
 * je perYoung ein Nachkomme (beim ersten Fisch 20), der Rest bleibt für das nächste Mal. Wer mehrmals laicht, hat mehr
 * Nachkommen – sie zählen zusammen (50 gefressen, gelaicht: 2; später noch einmal 10 gefressen und gelaicht: 3). Weiter
 * entwickelte Tiere brauchen etwas mehr (siehe sim/life.ts, broodBase).
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
  perYoung: 20,
  /**
   * … und so viel mehr, je weiter das Tier entwickelt ist: perGain × die Verbesserungen gegenüber dem ersten Fisch, zusammengezählt
   * (Biss, Stoß, Tempo, Lebenskraft, Ausdauer, Zähigkeit). Nur das Gebiss 25 % stärker: 20 × (1 + 2 × 0,25) = 30; dazu 10 %
   * schneller: 34. Eine Generation bringt meist 10–25 % zusammen – die zweite braucht also etwa 24–30.
   */
  perGain: 2,
  /** höchstens so viele Nachkommen in einem Leben */
  maxYoung: 24,
  /** nach dem Laichen frühestens wieder nach so vielen Sekunden aktiven Lebens – fressen gehen, wiederkommen, wieder laichen */
  cooldown: 8,
  /** so nah (Bildpunkte) muss man über dem Grund sein */
  ground: 80,
  /** so nah (Bildpunkte) muss ein Männchen an einem Gelege sein (großzügig – die Strömung im Fluss treibt einen ab) */
  reach: 150,
  /** ein Männchen deiner Art kommt so viele Sekunden nach dem Ablegen (von … bis) */
  maleDelay: [3, 6] as [number, number],
  /** ein Weibchen deiner Art legt Laich, wenn ein Männchen bereit im Laichfluss ist – so viele Sekunden danach (von … bis) */
  femaleDelay: [2, 5] as [number, number],
  /** und danach frühestens wieder so viele Sekunden später */
  femaleEvery: 15,
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
  /** Wer sich wenig bewegt, heilt bis zu diesem Anteil der Lebenskraft … */
  restHealCap: 1,
  /** … je Sekunde so viel (Anteil der vollen Lebenskraft): treibend bzw. langsam schwimmend */
  regenRest: 0.012,
  regenSlow: 0.005,
  /** ein Heilkraut (ganz gefressen) gibt so viel Lebenskraft zurück (Anteil am Maximum) */
  healBite: 0.4,
  /** eine abgefressene Pflanze wächst nach so vielen Sekunden um einen Bissen nach … */
  plantRegrow: 22,
  /** … zur Blütezeit nach so vielen */
  plantRegrowBloom: 2.5,
  /** so viel Fleisch nimmt ein anderes Tier mit einem Biss */
  animalBite: 5,
  /** so viele Sekunden Leben kostet ein Weg über die Karte */
  travel: 7,
};

/**
 * Muscheln: Man findet sie bei erlegten Tieren. Wie oft, hängt davon ab, wie stark das Tier im Vergleich zu dir war: ein
 * ebenbürtiges in jedem zehnten Fall (10 %), ein doppelt so starkes doppelt so oft, schwache Beute halb so oft. Sie gehören
 * dir und nicht deiner Linie: Sie bleiben über alle Läufe hinweg (siehe UPGRADES).
 */
export const SHELLS = {
  /** Wahrscheinlichkeit je erlegtem Tier, das so stark ist wie du */
  chance: 0.1,
  /** das Verhältnis seiner Stärke zu deiner zählt – begrenzt auf diesen Bereich */
  relMin: 0.5,
  relMax: 2,
};

/**
 * Die Segen der großen Muschel im Laichfluss: Dort verteilt man seine Muscheln auf Lebenskraft, Ausdauer und Sicht. Der erste
 * Segen kostet eine Muschel, jeder weitere doppelt so viele wie der vorige – gleich, wofür: 1, 2, 4, 8 … bis 512 für den
 * zehnten (vorerst gibt es höchstens zehn Segen je Linie, zusammen 1023 Muscheln). Die Segen gelten für die ganze Linie (über
 * alle Generationen); beginnt eine neue Linie, sind alle Muscheln wieder frei und werden neu verteilt.
 */
export const UPGRADES = {
  /** so viele Segen gibt es höchstens je Linie (gleich, wofür) */
  max: 10,
  /** der erste Segen kostet so viele Muscheln … */
  first: 1,
  /** … jeder weitere so viel mal so viele wie der vorige */
  factor: 2,
  /** Lebenskraft: so viel mehr je Segen (Anteil) – und der Körper wird ein wenig größer */
  hp: 0.025,
  /** so viel größer wird der Körper je Segen in Lebenskraft (Anteil) */
  hpSize: 0.012,
  /** Sicht (Anteil des ganzen Bildes vor dir): zu Beginn … */
  sight: 0.2,
  /** … und so viel mehr je Segen … */
  sightPer: 0.05,
  /** … höchstens so viel (das ganze Bild) */
  sightMax: 1,
};

/**
 * Ausdauer – wie in Breath of the Wild ein Kreis neben dem Tier. Ein Kreis hat jedes Tier; jeder Segen der großen Muschel
 * gibt ein Stück dazu (außen ein weiterer Ring). Wie schnell sie schwindet, hängt am Körper (schwere Tiere ermüden schneller).
 */
export const STAMINA = {
  /** so viel bringt ein Segen (Anteil eines Kreises): ein Viertel – nach acht Segen in Ausdauer sind es drei Kreise */
  perBlessing: 0.25,
  /** höchstens so viele Kreise */
  max: 3,
  /** ein voller Spurt mit einem Kreis dauert so viele Sekunden (bei normalem Körperbau) */
  sprint: 3,
};
