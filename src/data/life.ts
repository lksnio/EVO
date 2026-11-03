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
 * zwar bis kurz vor dem Tod. Generation 1: 1,5 Minuten bis zur Laichzeit, danach noch 9,5 Minuten; Generation 2: 2 + 13;
 * Generation 4: 2,5 + 16,5; Generation 8: 3 + 20. Die Laichreife kommt doppelt so früh, die Lebensdauer bleibt gleich
 * (siehe sim/life.ts, phases).
 */
export const LIFE = {
  /** Größe beim Schlüpfen (Anteil der ausgewachsenen Größe) */
  hatch: 0.4,
  /** so viel der ausgewachsenen Größe gilt als ausgewachsen (dann kann man laichen) */
  adult: 0.92,
  /** Generation 1: nach so vielen Sekunden ist man ausgewachsen (Laichzeit) – das Wachstum nähert sich danach der vollen Größe */
  mature: 1.5 * 60,
  /** … und mit jeder Verdopplung der Generationen so viel später */
  maturePerDoubling: 30,
  /** Generation 1: so lange lebt man nach dem Ausgewachsensein noch – die ganze Zeit kann man laichen */
  rest: 9.5 * 60,
  restPerDoubling: 3.5 * 60,
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

/** Tempoentwicklung: kleine Schritte über Generationen; das volle Tempo erst beim Ausgewachsensein. */
export const MOVEMENT = {
  /** Anteil des ausgewachsenen Tempos beim Schlüpfen (bei LIFE.hatch) */
  hatchSpeed: 0.6,
  /** Tempofaktor je vererbtem Flossenpunkt: +10 Punkte → +20 % Schwimmtempo */
  finPerPoint: 0.02,
  /** Anteil des Längenzuwachses, der Tempo gibt: +10 % Länge → +3 % Tempo */
  lengthSpeed: 0.3,
  /** Kompromiss: Tempo kostet etwas Ausdauer (je Flossenpunkt, negativ: +10 Punkte → −4 % Ausdauer) … */
  finEndurance: -0.004,
  /** … Ausdauer aus weiten Strecken (je Punkt: +3 Punkte → +9 %) kostet etwas Tempo (je Punkt: +3 Punkte → −1,2 %) */
  endPerPoint: 0.03,
  endSpeed: 0.004,
};

/**
 * Strömungen (lokale Wasserströme im Ort): Wer darin schwimmt, bekommt Schub (flow 0 … 1), der in ein paar Sekunden anwächst und nach dem
 * Verlassen nur langsam abklingt. Er macht schneller (speed), wirkt auf den Spurt noch stärker (sprint, Anteil von speed zusätzlich bei
 * vollem Spurt) und auf den Kopfstoß (ram). Die Sekunden im Schub (und dabei Spurt oder Stoß, zählen mehr) trainieren das Tempo der Nachkommen.
 */
export const FLOW = {
  speed: 0.3,
  sprint: 0.6,
  ram: 0.35,
  /** Sekunden bis zum vollen Schub in der Strömung */
  rise: 1.4,
  /** Zeitkonstante des Abklingens außerhalb (Sekunden) */
  fade: 6,
  /** Spurt bzw. Stoß im Schub zählen so viel mehr für das Training */
  boostedCredit: 1.6,
};

/**
 * Jäger im Kampf werden schneller (sim/pace.ts): Das Verfolgungstempo wächst in rise Sekunden um bis zu chase (Anteil), der Angriff (Ausholen und
 * Zuschnappen) um bis zu attack; nach dem Kampf klingt es in fade Sekunden ab. Gilt für Räuber und Herrscher, nicht für Beute.
 */
export const HUNT = { rise: 3.5, fade: 6, chase: 0.4, attack: 0.3 };

/** Der Kopfstoß: mehr Schaden – und ein Stoß zählt für den Schädel so viel wie mehrere Bisse (3–4). */
export const RAM = { damage: 0.95, credit: 3.5 };

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
   * (Biss, Stoß, Tempo, Lebenskraft, Ausdauer, Zähigkeit). Das Gebiss 50 % stärker (15 statt 10): 20 × (1 + 0,4 × 0,5) = 24;
   * doppelt so stark (20): 28. Eine Generation bringt bis zu etwa 50–70 % in einer Richtung.
   */
  perGain: 0.4,
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
 * Vererbung beim Befruchten: höchstens 15 Punkte vor Varianz. Pflanzenanteil → Leben; Fleischanteil → Kampffähigkeiten,
 * nach Zahl und relativer Stärke besiegter Gegner. Jedes Ei würfelt seinen Zuwachs mit ±50 %, nicht seine gesamten Werte.
 * Gebiss/Schädel und Flossen/Schuppen sind Gegenpaare: Abzug = halbe untere Schranke des positiven Zuwachses.
 * Länge und Gewicht entwickeln sich getrennt aus Schwimmstrecke und zeitlich gemittelter Wassertiefe.
 */
export const INHERIT = {
  /** Budget vor Varianz: Pflanzen → Leben, Fleisch → Gebiss, Schädel, Flossen und Schuppen. */
  points: 15,
  /** Acht ebenbürtige besiegte Gegner schöpfen das Fleischbudget aus; schwächere zählen anteilig. */
  defeats: 8,
  /** Verborgener Längenzuwachs pro Generation bei dieser Schwimmstrecke (Bildpunkte). */
  swimDistance: 60000,
  /** Farbe: Streuung der versteckten Farbabweichung je Ei (Körper, Flossen, Kopfpanzer; Bereich −1 … +1) */
  colorStep: 0.1,
  /** Sicht: Punkte je Generation bei so vielen Sekunden in der Tiefe (deepRef; wer weniger unten war, bekommt anteilig). Nur so wächst die Sicht. */
  sightStep: 2,
  deepRef: 90,
  /** Ausdauer aus Strecke: Punkte je Generation bei dieser Schwimmstrecke (Bildpunkte, wie swimDistance) */
  endStep: 3,
  endDistance: 90000,

  lengthStep: 0.1,
  /** Gewichtszuwachs: dieser Anteil × mittlere relative Wassertiefe. */
  massStep: 0.1,
  /** Sichtbares Körperwachstum durch vererbte Lebenskraft: doppelte Lebensbasis → rund 15 % größer */
  vitalitySize: 0.2,
  carry: 0.6,
  partner: 0.15,
  /**
   * Wie im Fitnessstudio: Eine Richtung wächst nur so weit, wie die Gegner es hergeben, die man damit bezwungen hat. Ihre
   * Stärke (im Verhältnis zum eigenen ausgewachsenen Tier, die drei stärksten zählen) setzt die Obergrenze der Ausprägung:
   * ceilBase ohne nennenswerte Gegner, dazu ceilPer je „so stark wie du“. Kleine Beute (etwa halb so stark) trägt bis knapp
   * über die Hälfte, ebenbürtige Gegner bis drei Viertel, doppelt so starke bis ganz hinauf. Wer stärker wird, für den wird
   * dieselbe Beute schwächer – dann braucht es größere Gegner.
   */
  ceilBase: 0.3,
  ceilPer: 0.45,
  step: { diet: 0.15, carry: 0.04 },
  /**
   * Gewichtung der Zuwächse: Schuppen, Flossen (und damit das Tempo) und der Schädel zählen etwas mehr, Gebiss und Lebenskraft
   * etwas weniger.
   */
  weight: { hp: 0.85, bite: 0.85, skull: 1.15, fins: 1.25, scales: 1.3 },
  /**
   * Schuppen und Tempo kommen auch ohne erlegte Gegner: Wer Treffer überstanden hat, bekommt bis zu +scalesHurt (ab hurtRef
   * überstandenen Treffern voll) – wer dem Tod nahe war (unter dangerHp der Lebenskraft), gleich +dangerMin und je nach Dauer
   * (bis dangerRef Sekunden) bis zu +dangerMax obendrauf. Das Tempo ähnlich, nur kleiner: bis zu +finsSwim für viel schnelles
   * Schwimmen (swimRef) und +finsChase für eingeholte Flüchtende (chaseRef).
   */
  bonus: {
    scalesHurt: 3,
    hurtRef: 8,
    dangerHp: 0.25,
    dangerMin: 1,
    dangerMax: 2,
    dangerRef: 15,
    finsSwim: 1.5,
    swimRef: 20,
    finsChase: 1,
    chaseRef: 3,
    /** Tempo aus Strömungen: bis zu so viele Flossenpunkte je Generation bei flowRef Sekunden im Schub */
    finsFlow: 3,
    flowRef: 40,
  },
  /** Am Ende bekommt jedes Feld noch +1 oder −1 (nach Gewichtung, Varianz und Bonus). */
  final: 1,
  /** Varianz ausschließlich des neu erspielten Zugewinns (± Anteil), individuell je Ei. */
  vary: 0.5,
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
  /** so viel Fleisch nimmt ein anderes Tier mit einem Biss */
  animalBite: 5,
};

/** Sicht entwickelt sich durch Zeit in der Tiefe, unabhängig von Sammelgegenständen. */
export const VISION = { base: 0.2, perPoint: 0.05, max: 1 };

/** Ein Ausdauerkreis; seine Dauer hängt von Körper und vererbten Merkmalen ab. */
export const STAMINA = { sprint: 3 };
