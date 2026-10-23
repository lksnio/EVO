// ---------------------------------------------------------------------------
// Das Unterkarbon (vor etwa 348 Millionen Jahren): eine Wasser- und Sumpfwelt mit flachen Ufern und Inseln. Man lebt als
// Pederpes – ein früher Vierfüßer, der aus dem Wasser kriecht. Alle Zahlen dieses Zeitalters an einer Stelle; die Rechnung
// dazu steht in sim/brood.ts.
//
// Der Ablauf einer Generation:
//   1. Ein Gelege mit BROOD.eggs Eiern liegt im Brutsumpf. Man schlüpft als kleines Jungtier (Larve mit Kiemen).
//   2. Jugend: fressen (Pflanzen, kleine Fische, Gliederfüßer). Was man frisst, ist Nahrung – mit BROOD.food Nahrung kommt
//      die Metamorphose. Bis dahin greifen keine großen Räuber an (nur wer angegriffen wird, wehrt sich).
//   3. Gefahr: Ab der Metamorphose läuft die Zeit bis zum neuen Gelege (BROOD.danger Sekunden). Räuber kommen und fressen
//      die Eier im Nest. Fressen heilt jetzt (statt Nahrung zu sein).
//   4. Stirbt man, wählt man ein Ei aus dem Gelege – es schlüpft, und man spielt weiter. Ohne Eier ist die Art ausgestorben.
//   5. Wer die Zeit übersteht, legt ein neues Gelege (wieder BROOD.eggs Eier) – die nächste Generation, mit den Merkmalen,
//      die das Verhalten dieser Generation hervorgebracht hat.
// ---------------------------------------------------------------------------

export const BROOD = {
  /** Eier je Gelege */
  eggs: 100,
  /** so viel Nahrung braucht ein Jungtier bis zur Metamorphose */
  food: 24,
  /** so lange (Sekunden) muss man nach der Metamorphose überleben, dann ist das neue Gelege da */
  danger: 300,
  /** so viele Eier stehen nach dem Tod zur Wahl */
  choice: 3,
  /** so weit weichen die Eier einer Generation voneinander ab (± je Merkmal; die Start-Eier gar nicht) */
  spread: 0.05,
  /** Größe beim Schlüpfen und kurz vor der Metamorphose (Anteil des ausgewachsenen Tiers) */
  growHatch: 0.55,
  growMeta: 0.8,
  /** fern vom Nest (in einem anderen Ort) geht in der Gefahr alle so viele Sekunden ein Ei verloren */
  awayEvery: 4,
  /** ein Räuber am Nest beißt alle so viele Sekunden ins Gelege … */
  raidEvery: 1.5,
  /** … und frisst dabei so viele Eier (kleine Räuber … große) */
  raidEggs: [2, 5] as [number, number],
  /** so viele Eier frisst ein Räuber höchstens, dann zieht er satt ab */
  raidFull: 12,
  /** so nah (Bildpunkte) muss ein Räuber am Nest sein, um zu fressen */
  raidReach: 90,
  /** nach der Metamorphose heilt jede Einheit Nahrung so viel (Anteil der Lebenskraft) */
  heal: 0.035,
  /** Jungtiere wachsen auch nach dem Tod eines Geschwisters nicht schneller: Wer neu schlüpft, beginnt mit dieser Nahrung */
  carry: 0,
};

/**
 * Sauerstoff: An Land sinkt der Vorrat stetig, im Wasser füllt er sich wieder. Ist er leer, trocknet das Tier aus und nimmt
 * Schaden. Er ersetzt im Karbon die Sicht als drittes Merkmal an der großen Muschel.
 */
export const OXYGEN = {
  /** so viele Sekunden reicht der volle Vorrat an Land (ausgewachsen, ohne Segen) */
  seconds: 26,
  /** jeder Segen der großen Muschel: so viel mehr (Anteil) */
  perUp: 0.15,
  /** Jungtiere (Larven mit Kiemen) trocknen schneller aus: ihr Vorrat reicht nur so viel (Anteil) */
  young: 0.55,
  /** im Wasser füllt er sich so schnell (Anteil je Sekunde) */
  refill: 0.4,
  /** leer: so viel Schaden je Sekunde (Anteil der Lebenskraft) */
  dry: 0.06,
  /** darunter warnt die Anzeige */
  warn: 0.3,
};

/**
 * Klettern: Wie steil ein Hang sein darf, hängt an Beinen und Griff (Grad): base + limb × Beine + grip × Griff. Wer steiler
 * hinauf will, rutscht ab. Klettern kostet Ausdauer – ein Schuppenpanzer ist schwer und kostet mehr.
 */
export const CLIMB = {
  base: 28,
  limb: 26,
  grip: 22,
  /** ab dieser Steigung (Grad) zählt es als Klettern (Ausdauer, Training des Griffs) */
  steep: 16,
  /** so viel Ausdauer (Kreise je Sekunde) kostet Klettern am steilsten noch möglichen Hang */
  cost: 0.24,
  /** ein voller Schuppenpanzer macht das Klettern so viel teurer (Anteil) */
  armor: 0.9,
};

/**
 * Evolution durch Verhalten: Was eine Generation tut, verändert die nächste. Jede Richtung wächst um höchstens step je
 * Generation – wie viel davon, hängt daran, wie viel trainiert wurde (ref: so viel bringt knapp zwei Drittel des Schritts).
 *   – Gebiss (jaw): erlegte kleine Beute (Gliederfüßer, kleine Fische)
 *   – Beine (limb): Strecke an Land und im flachen Sumpf (Bildpunkte)
 *   – Griff (grip): an steilen Hängen erklommene Höhe (Bildpunkte)
 *   – Schuppen (armor): überstandener Schaden (in vollen Lebenskräften)
 */
export const KTRAIN = {
  step: { jaw: 0.1, limb: 0.11, grip: 0.11, armor: 0.1 },
  ref: { prey: 8, land: 6500, climb: 1400, hurt: 1.4 },
  /** Beine und Griff bremsen im Wasser (Anteil des Schwimmtempos bei voller Ausprägung) … */
  swimLimb: 0.3,
  swimGrip: 0.15,
  /** … und machen an Land schneller (Beine) */
  landLimb: 0.5,
  /** ein Schuppenpanzer macht an Land langsamer */
  landArmor: 0.15,
};
