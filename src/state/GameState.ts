import { CLASSES, type ClassId } from '../data/classes';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { placeOf, placesOf, startPlace, TRAVEL_SECONDS, type PlaceKind } from '../data/world';
import { SWARM } from '../data/quests';
import type { Morph } from '../art/creatureArt';
import { clamp, mulberry32 } from '../util/math';
import { Emitter } from '../util/emitter';
import { INHERIT, LIFE, SPAWN } from '../data/life';
import { ADULT, broodBase, lifeK, phases, spawnMinFood, worldNow, youngOf, type LifeK } from '../sim/life';

// ---------------------------------------------------------------------------
// Spielstand.
//
// Ein "Lauf" ist ein Spiel: eine Linie, die vom Urfisch an durch die Zeitalter
// zieht. Stirbt das Tier, ist der Lauf vorbei – die Linie stirbt aus.
//
// Das verborgene Anpassungssystem (der Spieler sieht keine Werte). Körper und Kampfwerte ändern sich erst beim
// Generationswechsel nach einem Zeitalter – nicht mitten darin:
//   st, bs, vf – Evolutionsplatten (Stoßen, Beißen, Verfolgung): Nach jedem Zeitalter wählt man eine; die Spielweise
//             bestimmt, wie stark sie ausgeprägt wird. Sie formen Schädel und Kopfplatte (skull, spike), Gebiss
//             (jaw, fang) bzw. Körperbau und Flossen (len, girth, swift, tail …)
//   growth  – Körpergröße: aus dem Lebensraum, in dem man sich im Zeitalter vor allem (aktiv) aufhielt
//   armor   – Körperrobustheit (Schuppen, Schuppenpanzer): aus überstandenen Angriffen
//   diet    – Ernährung: -1 Pflanzenfresser … +1 Fleischfresser, aus dem Anteil der aufgenommenen Energie
//   limb    – Bodenkontakt: wer sich oft am Grund abstützt und dort entlangläuft, bekommt kräftige,
//             stützende Flossen (später kräftigere Beine)
//   pack    – Rudel: wer oft mit Artgenossen zusammen kämpft, wird zum Rudeltier – sie helfen öfter,
//             wollen dann aber auch mitfressen
//   stealth – wächst durch Pflanzenfressen, Ausweichen und Verstecken
//   scars   – Narben überlebter Kämpfe
//   green   – Tarnfarbe vom Verstecken zwischen Pflanzen
//   sand    – Tarnfarbe vom Verstecken am Boden und in Höhlen
// Ganz verborgen (nirgends angezeigt, nur am Verhalten zu merken):
//   nerve   – Nervenstärke: wer oft nah an Räubern bleibt, ohne aufzufallen, wird später bemerkt
//   tox     – Giftfestigkeit: giftige Pflanzen schaden weniger
//   light   – Färbung: -1 dunkel (lebt tief unten bzw. im Schatten) … +1 hell (lebt oben im Licht)
// Dazu kommt der Ruf: Wer oft angreift, vor dem haben andere Tiere Angst.
//
// Außerhalb des Spiels wächst der Stammbaum: Jeder Lauf ist ein Pfad von der
// Wurzel nach unten (= in der Zeit nach vorne). Linien, die sich gleichen,
// teilen sich einen Ast; wo sie sich unterscheiden, verzweigt er sich.
// ---------------------------------------------------------------------------

export interface Traits {
  jaw: number;
  skull: number;
  stealth: number;
  /** Wuchs: GROWTH_MIN (klein) … 1 (groß) */
  growth: number;
  diet: number;
  scars: number;
  /** Kopfplatte: 0 … -1 gepanzerter Schädel */
  spike: number;
  green: number;
  sand: number;
  /** Körperlänge: -1 gedrungen … +1 lang gestreckt */
  len: number;
  /** Fülle: -1 schlank … +1 massig */
  girth: number;
  /** Flinkheit: -1 träge … +1 flink */
  swift: number;
  nerve: number;
  tox: number;
  fang: number;
  /** Färbung: -1 dunkel … +1 hell */
  light: number;
  /** Bodenkontakt: stützende Flossen bzw. kräftige Beine */
  limb: number;
  /** Zusammenhalt (Schwarmfisch): Artgenossen helfen öfter, deine Gruppe wird größer und stärker (und will mitfressen) */
  pack: number;
  /** Flossengröße, Schwanzbreite, Rückenflosse/Kamm (-1 … +1) – ändern sich vor allem durch die Evolutionsplatten */
  fin: number;
  tail: number;
  crest: number;
  /** Farbton (-1 … +1) */
  tint: number;
  /** Kopfform: -1 kurz und stumpf … +1 lang und spitz */
  snout: number;
  /** Färbung durch eine Höhle: 0 natürlich, 1 grün (Gras), 2 schwarz (Dunkelheit) */
  coat: number;
  /** Körperrobustheit (0 … 1): robustere Schuppen bis zum Schuppenpanzer – aus überstandenen Angriffen */
  armor: number;
  /**
   * Evolutionsplatten: Punkte als Stoß-, Beiß-, Verfolgungs- bzw. Schwarmfisch (0 … PLATE_MAX) – sie bauen über die Zeitalter
   * aufeinander auf. Den Schwarmfisch gibt es erst, wenn deine Gruppe gelernt hat, auf deinen Ruf zu kommen.
   */
  st: number;
  bs: number;
  vf: number;
  sw: number;
  /**
   * Flossen, die aus der Bewegung wachsen – und zwar erst bei der Verwandlung nach einem Zeitalter (0 … 1):
   * wer am meisten nach oben schwamm → größere Rückenflosse und schneller nach oben; nach unten → größere Bauchflossen
   * und schneller nach unten; viel und schnell nach vorn → kräftigere Schwanzflosse; oft die Richtung gewechselt →
   * größere Seitenflossen und wendiger.
   */
  fUp: number;
  fDown: number;
  fSide: number;
  fTail: number;
}

/** Merkmale, die schon im Zeitalter Stück für Stück wachsen (alles Übrige ändert sich erst beim Generationswechsel). */
export type TraitKey = 'stealth' | 'green' | 'sand' | 'nerve' | 'tox' | 'limb';

/** Kleinster Wuchs: Wer in flachen, bewachsenen Gewässern lebt, kann noch kleiner werden als der Urfisch. */
const GROWTH_MIN = -0.2;
/** So weit verschiebt sich die Kost höchstens: Ein reiner Fleischfresser holt aus Pflanzen noch etwa die Hälfte heraus. */
const DIET_MAX = 0.85;

/** Was ein Happen bringt: Sättigung (füllt den Magen) und Nährwert (die aufgenommene Energie – sie bestimmt die Ernährung). */
export const FOOD = {
  meat: { sat: 3, kcal: 3.5 },
  /** Pflanzen: wenig, aber ohne Gefahr – sie wachsen nach */
  plant: { sat: 2, kcal: 2 },
  toxic: { sat: 1.5, kcal: 3 },
  /** Fischlaich: nahrhaft und leicht zu fressen – aber die Eltern passen auf */
  roe: { sat: 2.4, kcal: 2.6 },
};

/**
 * So viel Fleisch (Sättigung) gibt ein erlegtes Tier – nach seiner Lebenskraft, in der Größe und Stärke schon stecken: ein
 * kleiner Beutefisch etwa 15 (ein Sechstel eines Magens), ein Räuber wie Orthoceras um 85, die Riesen mehrere Mägen voll.
 * Wer mehr will, muss Stärkeres erlegen – mit mehr Risiko.
 */
export const meatOf = (hp: number) => 3 * Math.pow(Math.max(1, hp), 0.9);

/** So viel schafft man mit einem Biss (Anteil des Magens) – ein kräftiges Gebiss mehr. Große Beute frisst man in Etappen. */
export const mouthful = (maxSat: number, jaw: number) => maxSat * (0.22 + 0.18 * jaw);

/** Wie viel in den Magen passt – größere Tiere fassen mehr (verbrauchen aber auch mehr). */
export const maxSatiety = (size: number) => Math.round(100 * (0.7 + 0.45 * size));

/**
 * Hunger je Sekunde: auch in Ruhe spürbar, beim Schwimmen bzw. Laufen deutlich mehr; Große brauchen mehr – und wer massig
 * oder gepanzert ist, ebenso (upkeep, siehe Stats).
 */
export const hungerRate = (size: number, speed01: number, upkeep = 1) => (0.9 + 1.0 * Math.min(1.5, speed01)) * Math.pow(size, 1.3) * upkeep;

/** Bezugsgröße für die Ernährung: so viel frisst ein Tier, das gut über die Runden kommt – in so vielen Sekunden Leben. */
export const fedRef = (seconds: number, size: number) => 0.35 * seconds * (0.85 + 0.3 * size);

export interface Stats {
  maxHp: number;
  bite: number;
  ram: number;
  /** Selbstschaden beim Rammen (dünner Schädel tut weh) */
  ramSelf: number;
  speed: number;
  jump: number;
  size: number;
  /** Schadensfaktor für erlittene Treffer */
  defense: number;
  power: number;
  /** Wie leicht andere dich bemerken (1 = normal) */
  detect: number;
  digestMeat: number;
  digestPlant: number;
  /** Tempo beim Laufen am Grund (Anteil am Schwimmtempo) */
  groundSpeed: number;
  /** Wie lange die Kraft für Spurt, Rammen und Beißen reicht (1 = normal) */
  endurance: number;
  /** Wie schnell man sich beim Treiben und Ausruhen erholt (1 = normal) */
  recover: number;
  /** Tempo nach oben, nach unten und nach vorn (Faktoren, 1 = normal) – sie wachsen mit den Flossen */
  climb: number;
  dive: number;
  cruise: number;
  /** Wendigkeit (1 = normal): wie schnell man die Richtung wechselt */
  agility: number;
  /** Nahrungsbedarf über die Größe hinaus (1 = normal): ein massiger Körper und ein Schuppenpanzer wollen versorgt sein */
  upkeep: number;
}

/** 1 = männlich, 2 = weiblich */
export type Sex = 1 | 2;

/** Das Geschlecht eines frisch geschlüpften eigenen Tiers: vorerst immer männlich (SPAWN.alwaysMale), sonst zufällig. */
const newSex = (): Sex => (SPAWN.alwaysMale || Math.random() < 0.5 ? 1 : 2);

/** Ein Vorfahre: so sah das Tier aus, als es ein Zeitalter überlebt hatte. */
export interface Ancestor {
  cls: ClassId;
  traits: Traits;
  epoch: number;
}

/** Wo man im aktuellen Zeitalter steht – über mehrere Orte hinweg (die Zeit läuft auch auf der Karte weiter). */
export interface EpochProg {
  /** aktueller Ort */
  place: string;
  /** schon besuchte Orte */
  seen: string[];
  /** freigeschaltete Orte (nur diese zeigt die Karte) – ein neuer Ort wird frei, sobald man durch seinen Durchgang schwimmt */
  known: string[];
  /** von welchem Ort man gekommen ist (dort liegt der Ankunftsplatz) */
  from?: string;
  /** über den Rand hereingeschwommen: über welche Seite man den anderen Ort verlassen hat und wie tief man war */
  edge?: { side: 'left' | 'right'; frac: number };
  /** Hier beginnt das Leben (ein neues Jungtier schlüpft aus seinem Gelege) – gilt nur einmal */
  at?: { x: number; y: number };
  /** Endgegner: 0 noch nicht da, 1 lebt, 2 besiegt */
  boss: 0 | 1 | 2;
  /** in diesem Leben aufgenommene Energie (Nährwert nach der Verdauung) */
  eaten: { meat: number; plant: number };
  /** Zustand beim Verlassen eines Ortes */
  hp?: number;
  sat?: number;
  kin?: number;
  /** was getan wurde (ältere Spielstände kennen nicht alles) */
  train: Partial<PlayStyle>;
}

export const newProg = (epoch: number): EpochProg => ({
  place: startPlace(EPOCHS[epoch]).id,
  seen: [startPlace(EPOCHS[epoch]).id],
  known: [startPlace(EPOCHS[epoch]).id],
  boss: 0,
  eaten: { meat: 0, plant: 0 },
  train: newStyle(),
});

/**
 * Ein Gelege im Laichfluss, an dem dieses Tier beteiligt ist: selbst gelegt (Mutter) oder befruchtet (Vater). Aus einem
 * befruchteten Gelege schlüpft die nächste Generation – unbefruchtete verderben nach einer Weile.
 */
export interface Clutch {
  id: number;
  place: string;
  x: number;
  y: number;
  /** Weltzeit (ms), als es gelegt wurde */
  at: number;
  /** befruchtet */
  fert: boolean;
  /** ein Männchen ist schon unterwegs: Das Gelege wird sicher befruchtet und verdirbt nicht mehr */
  called?: boolean;
  /** dein Anteil daran */
  role: 'mother' | 'father';
  /** der Partner (er gibt etwas von seinem Aussehen mit) */
  partner?: { traits: Traits; seed: number; sex: Sex };
}

/** Das Leben des eigenen Tiers: wie alt es ist (Sekunden aktiven Lebens), die wievielte Generation, seine Gelege. */
export interface Life {
  age: number;
  gen: number;
  spawns: number;
  /** Alter beim letzten Laichen */
  lastSpawn: number;
  clutches: Clutch[];
  nextClutch: number;
  /** in diesem Leben gefressen (Sättigung, wie sie beim Fressen aufsteigt) – daraus werden die Nachkommen (siehe SPAWN) */
  fed: number;
}

export const newLife = (gen: number, age = 0): Life => ({ age, gen, spawns: 0, lastSpawn: -1e9, clutches: [], nextClutch: 1, fed: 0 });

/**
 * Die Geschwister, die noch im Gelege warten, aus dem das eigene Tier geschlüpft ist: Stirbt es, bevor es selbst gelaicht
 * hat, schlüpft das nächste – dieselbe Generation, so beschaffen, wie es geschlüpft ist.
 */
export interface Siblings {
  n: number;
  traits: Traits;
  place: string;
  x: number;
  y: number;
}

/** Die nächste Generation: so ist sie beschaffen – angepasst an die Spielweise der Eltern, ohne Wahl. */
export interface Heir {
  traits: Traits;
  sex: Sex;
  seed: number;
  /** wie gut die Spielweise zu jeder Evolutionsplatte passte (0 … 1) */
  fit: Record<PlateId, number>;
  /** die Richtung, in die sich die Nachkommen am deutlichsten entwickelt haben (wenn eine herausragt) */
  line?: PlateId;
  /** Richtungen, die mehr gewollt hätten, aber an ihre Obergrenze stießen: Dafür braucht es stärkere Gegner */
  capped: PlateId[];
}

export interface Run {
  id: number;
  cls: ClassId;
  traits: Traits;
  aggression: number;
  infamy: number;
  hue: number;
  seed: number;
  sex: Sex;
  /** Zeitalter, das gerade (bzw. als Nächstes) gelebt wird */
  epoch: number;
  /** Knoten im Stammbaum: zuletzt überlebtes Zeitalter (oder die Wurzel) */
  node: string;
  /** Artgenossen zu Beginn des Zeitalters (sie sind selten und geben Aufträge – sonst ist man allein) */
  kin: number;
  /** Stand der Aufträge, die Artgenossen geben: Kennung → Schritt (siehe data/quests.ts) */
  quests?: Record<string, number>;
  /** Was die Gruppe über dich gelernt hat: Treue der Artgenossen zu Beginn (0..1) */
  social: number;
  /** Der Kopf ist hart genug: Rammen ist freigeschaltet */
  canRam: boolean;
  /** erst zwischen den Zeitaltern freigeschaltet – die Meldung kommt im nächsten Zeitalter */
  ramNew?: boolean;
  /** insgesamt gefressen (in Sättigungs-Einheiten) */
  eaten?: { meat: number; plant: number };
  /** wie oft das aktuelle Zeitalter schon gespielt wurde (der Endgegner ist noch nicht besiegt) */
  round?: number;
  /** Die Farbe aus einer Höhle gibt es nur einmal pro Lauf: danach bleibt sie, wie sie ist */
  coatSet?: boolean;
  /** aufgebrochenes Geröll vor Höhlen (Zeitalter:Ort:Nummer) – bleibt offen, solange dieses Leben dauert */
  walls?: string[];
  /** Stand im aktuellen Leben (Ort, Magen, Gefressenes, Spielweise …) */
  prog: EpochProg;
  /** das Leben des eigenen Tiers */
  life: Life;
  /** die Geschwister, die noch im Gelege warten (deine übrigen Leben) */
  siblings?: Siblings;
  /** gefundene Muscheln (jede legt eine Zeile der Steintafel frei) */
  shells: string[];
  /** so viele Zeilen der Tafel hat man schon freigelegt gesehen */
  seenRows: number;
  history: Ancestor[];
  /** die Gruppe deiner Art (entsteht beim Treffen in „Die gemeinsame Jagd“) – sie überdauert Orte und Zeitalter */
  swarm?: Swarm;
  /** Stand der gemeinsamen Jagd (Auftrag „jagd“) */
  hunt?: { kills: number; took: boolean; size: number };
}

/** Ein Artgenosse deiner Gruppe: eine feste Nummer (sie bestimmt sein Aussehen) und seine Lebenskraft (Anteil, 0 … 1). */
export interface Member {
  id: number;
  hp: number;
}

/**
 * Deine Gruppe: wer von deiner Art mit dir lebt, und ihre Überlebensbilanz. Rufen kann man sie erst, wenn sie es gelernt hat
 * (nach der gemeinsamen Jagd); wer gerufen ist, kommt beim Ortswechsel mit.
 */
export interface Swarm {
  /** die Lebenden */
  members: Member[];
  /** nächste freie Nummer */
  next: number;
  /** gerade bei dir (gerufen bzw. bei der Jagd) */
  out: number[];
  /** kommt auf deinen Ruf (Taste S) */
  callable: boolean;
  /** gemeinsam erlegte und geteilte Beute seit dem letzten Zuwachs */
  fed: number;
  /** Bilanz: so viele kamen dazu, starben bzw. haben die Gruppe verlassen */
  grown: number;
  lost: number;
  left: number;
}

export type SkillKey = 'jaw' | 'skull' | 'stealth' | 'growth' | 'green' | 'sand';

export interface TreeNode {
  id: string;
  parent: string | null;
  /** -1 = Urahn, sonst das überlebte (bzw. beim Aussterben: das laufende) Zeitalter */
  epoch: number;
  cls: ClassId;
  traits: Traits;
  hue: number;
  seed: number;
  sig: string;
  children: string[];
  /** Wie viele Linien hier durchkamen */
  runs: number;
  /** Ende einer Linie: hier ausgestorben (frac = wie weit ins Zeitalter, gens = nach so vielen Generationen) */
  dead?: { frac: number; cause: string; run: number; gens?: number };
  /** Wie viele Linien von hier bis heute überlebten */
  present?: number;
  /** zuletzt von diesem Lauf berührt */
  last: number;
}

export interface SaveData {
  v: 3;
  muted: boolean;
  seenIntro: boolean;
  runs: number;
  nextId: number;
  nodes: Record<string, TreeNode>;
  run: Run | null;
  /** Ende des zuletzt beendeten Laufs (wird im Stammbaum hervorgehoben) */
  lastEnd: string | null;
  /** tiefstes je erreichte Zeitalter – was darunter liegt, bleibt ein Fragezeichen */
  deepest: number;
  /** Tiere, die man schon gesehen hat (Aquapendium) */
  seen: string[];
}

const KEY = 'evo-save-v3';
/** Spielstand-Platz (?slot=…): Zwei Fenster im selben Browser spielen so zwei verschiedene Fische. */
let slotKey = KEY;
const ZERO: Traits = { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0, spike: 0, green: 0, sand: 0, len: 0, girth: 0, swift: 0, nerve: 0, tox: 0, fang: 0, light: 0, limb: 0, pack: 0, fin: 0, tail: 0, crest: 0, tint: 0, snout: 0, coat: 0, armor: 0, st: 0, bs: 0, vf: 0, sw: 0, fUp: 0, fDown: 0, fSide: 0, fTail: 0 };
export const ZERO_TRAITS: Readonly<Traits> = ZERO;

/** Was im Zeitalter Stück für Stück wächst, setzt sich über die Jahrmillionen fort (verstärkt). */
const AMP: TraitKey[] = ['stealth', 'green', 'sand', 'nerve', 'tox', 'limb'];
/** Merkmale, die man dem Tier ansieht und die sich nur bei der Verwandlung nach einem Zeitalter ändern. */
const LOOK_KEYS: (keyof Traits)[] = ['jaw', 'skull', 'stealth', 'diet', 'spike', 'green', 'sand', 'len', 'girth', 'swift', 'fang', 'light', 'limb', 'pack', 'fin', 'tail', 'crest', 'tint', 'snout', 'armor', 'st', 'bs', 'vf', 'sw', 'fUp', 'fDown', 'fSide', 'fTail'];
/** Was ein Partner an die Nachkommen weitergibt: das Aussehen, nicht Größe, Kost, Robustheit oder die Evolutionsplatten. */
const BLEND_KEYS: (keyof Traits)[] = ['stealth', 'green', 'sand', 'len', 'girth', 'swift', 'light', 'fin', 'tail', 'crest', 'tint', 'snout', 'fUp', 'fDown', 'fSide', 'fTail'];
/** Merkmale zwischen 0 und 1 (die übrigen reichen von -1 bis 1; Kopfplatte und Wuchs haben eigene Grenzen) */
const UNIT_KEYS = new Set<keyof Traits>(['jaw', 'skull', 'stealth', 'fang', 'limb', 'pack', 'armor', 'fUp', 'fDown', 'fSide', 'fTail']);
const range = (k: keyof Traits): [number, number] => (k === 'spike' ? [-1, 0] : k === 'growth' ? [GROWTH_MIN, 1] : UNIT_KEYS.has(k) ? [0, 1] : [-1, 1]);


/** Name einer erspielten Fähigkeit (wie sie auf den Karten und im Werte-Bildschirm steht). */
export function skillName(k: SkillKey, t: Partial<Traits>) {
  switch (k) {
    case 'jaw': return 'Gebiss';
    case 'skull': return (t.spike ?? 0) < -0.25 ? 'Panzerkopf' : 'Dickschädel';
    case 'stealth': return 'Tarnung';
    case 'growth': return 'Wuchs';
    case 'green': return 'Grüntarnung';
    case 'sand': return 'Sandtarnung';
  }
}

// ---------------------------------------------------------------------------
// Die Evolutionsplatten. Am Ende jedes Zeitalters (und jeder Generation) wählt man eine – sie bestimmt, wohin sich
// die nächste Generation entwickelt. Wie stark, entscheidet die Spielweise: Erfolge in dieser Richtung prägen sie
// deutlicher aus, Erfolge gegen deutlich stärkere Gegner viel mehr als gegen kleine Beute. Die Punkte bauen über die
// Zeitalter aufeinander auf; jede Platte hat ihren Preis, keine ist überall die beste.
//   Stoßen     – wendiger (große Seitenflossen, kurzer Körper), eine ausgeprägte Kopfplatte, kräftiger Stoß;
//                dafür etwas langsamer und schneller müde, das Gebiss bleibt, wie es ist
//   Beißen     – mehr Kraft, ein tiefer Kiefer mit vielen langen Zähnen und Reißzähnen, ein schwerer Kopf;
//                dafür langsamer, schneller müde und hungriger
//   Verfolgung – schneller und ausdauernder: lang, schlank, große Schwanzflosse, spitze Schnauze;
//                dafür weniger Lebenskraft, ein schwacher Stoß und ein schwerfälligeres Wenden
//   Schwarm    – (erst, wenn deine Gruppe auf deinen Ruf kommt) Zusammenhalt: Die Gruppe wird größer, stärker und wächst
//                schneller; silbrig, schlank, ein dunkles Längsband. Dafür allein verletzlicher – und die Beute wird geteilt
// ---------------------------------------------------------------------------

export type PlateId = 'st' | 'bs' | 'vf' | 'sw';
export const PLATE_IDS: PlateId[] = ['st', 'bs', 'vf', 'sw'];
export const PLATE_NAME: Record<PlateId, string> = { st: 'Stoßfisch', bs: 'Beißfisch', vf: 'Verfolgungsfisch', sw: 'Schwarmfisch' };

/** So viele Punkte sammelt eine Platte höchstens. */
const PLATE_MAX = 4;

/** Wie ausgeprägt eine Platte nach n Punkten ist (0 … 1): Die ersten Punkte zeigen viel, jeder weitere etwas weniger. */
export const plateLevel = (n: number) => 1 - Math.exp(-0.7 * clamp(n, 0, PLATE_MAX));

/** Die volle Ausprägung einer Platte (Verschiebung der Merkmale gegenüber dem Urfisch). */
const PLATE_D: Record<PlateId, Partial<Record<keyof Traits, number>>> = {
  st: { skull: 0.5, spike: -1, fSide: 0.5, len: -0.3, snout: -0.55, crest: 0.35, girth: 0.2, light: -0.15 },
  bs: { jaw: 0.62, fang: 0.6, girth: 0.3, snout: -0.2, len: -0.1 },
  vf: { len: 0.7, girth: -0.55, swift: 0.75, tail: 0.85, fTail: 0.5, fin: 0.45, crest: 0.2, snout: 0.6, light: 0.12 },
  sw: { pack: 1, girth: -0.3, len: 0.15, fin: 0.25, snout: 0.15, light: 0.3 },
};

/** Die vorherrschende Platte (oder undefined beim Urfisch) – bei Gleichstand in der Reihenfolge Stoßen, Beißen, Verfolgung, Schwarm. */
export function dominantPlate(t: Partial<Traits>): PlateId | undefined {
  const f = full(t);
  let best: PlateId | undefined;
  let top = 0;
  for (const id of PLATE_IDS) if (f[id] > top) {
    top = f[id];
    best = id;
  }
  return best;
}

/** Die Mischung als Kürzel in ganzen Punkten, z. B. "st2bs1". */
export const plateSig = (t: Partial<Traits>) => {
  const f = full(t);
  return PLATE_IDS.filter((id) => Math.round(f[id]) > 0).sort((a, b) => f[b] - f[a]).map((id) => id + Math.round(f[id])).join('') || 'basal';
};

/**
 * Wie gut die Spielweise eines Zeitalters zu jeder Platte passt (0 … 1). Die Zählwerte sind schon nach der Stärke der Gegner
 * gewichtet (siehe LevelScene.challenge); die Bezugswerte entsprechen einem Zeitalter, in dem man das oft und erfolgreich tut.
 */
export function plateFit(s: Pick<PlayStyle, 'ram' | 'hunt' | 'chase' | 'swim' | 'pack'>): Record<PlateId, number> {
  const fit = (v: number, ref: number) => 1 - Math.exp(-Math.max(0, v) / ref);
  return { st: fit(s.ram, 22), bs: fit(s.hunt, 30), vf: fit(s.chase + 0.35 * s.swim, 40), sw: fit(s.pack, 8) };
}

/** Lebensraum → Körpergröße: Zu diesem Wuchs zieht es eine Linie, die vor allem hier lebt (flach und bewachsen → klein, tief → groß). */
const HABITAT_GROWTH: Record<PlaceKind, number> = { start: 0.05, lush: -0.15, murky: 0.25, deep: 0.55, abyss: 0.9 };

/** Wohin der Lebensraum eines Zeitalters den Wuchs zieht – und wie sicher (wer kaum aktiv war, ändert sich kaum). */
function habitatPull(hab: PlayStyle['hab'], seconds: number) {
  let sum = 0, pull = 0;
  for (const [kind, v] of Object.entries(hab) as [PlaceKind, number][]) {
    sum += v;
    pull += v * HABITAT_GROWTH[kind];
  }
  return sum > 0 ? { target: pull / sum, sure: Math.min(1, sum / (0.3 * seconds)) } : undefined;
}

/**
 * Was die Bewegung eines Zeitalters aus dem Körper macht (je Zeitalter höchstens etwa 0,45 Flossen-Zuwachs): Wer am meisten
 * nach oben schwamm, bekommt eine größere Rückenflosse; wer am meisten nach unten schwamm, größere Bauchflossen; viel und
 * schnell nach vorn heißt eine kräftigere Schwanzflosse; oft die Richtung zu wechseln, größere Seitenflossen.
 */
export function moveGrowth(s: Pick<PlayStyle, 'up' | 'down' | 'fwd' | 'turns'>) {
  const vert = s.up + s.down;
  const domUp = vert > 1 ? s.up / vert : 0.5;
  const gain = (v: number, ref: number, dom: number) => Math.min(0.45, 0.3 * clamp(v / ref, 0, 1.4) * (0.5 + 0.8 * dom));
  return {
    up: gain(s.up, 60, domUp),
    down: gain(s.down, 60, 1 - domUp),
    tail: gain(s.fwd, 240, 0.5),
    side: gain(s.turns, 80, 0.5),
  };
}

/** Kalorien je Sättigungs-Einheit (größere Tiere brauchen und liefern mehr). */
const KCAL: Record<ClassId, number> = { fish: 4, amphibian: 12, reptile: 30, mammal: 60 };
export const kcalOf = (units: number, cls: ClassId, size: number) => Math.round(units * KCAL[cls] * size * size);


/** Grundlänge (cm) und Dichte je Körperform – für Länge und Gewicht im Werte-Bildschirm. */
const BODY: Record<ClassId, { cm: number; g: number }> = {
  fish: { cm: 24, g: 0.011 },
  amphibian: { cm: 55, g: 0.012 },
  reptile: { cm: 140, g: 0.011 },
  mammal: { cm: 110, g: 0.03 },
};

/** Ältere Spielstände kennen manche Merkmale noch nicht. */
const full = (t: Partial<Traits>): Traits => ({ ...ZERO, ...t });

/**
 * Merkmale aus einem älteren Spielstand: Aus der Panzer- und der Jäger-Linie werden Stoß- und Verfolgungsfisch; was es nicht
 * mehr gibt (Fleischflosser-Linie, getrennte Verdauung), fällt weg – sein Körperbau bleibt.
 */
function migrate(t: Partial<Traits>): Traits {
  const old = t as Partial<Traits> & Record<string, number | undefined>;
  const out = full(t) as Traits & Record<string, number | undefined>;
  if (old.st === undefined && old.pz !== undefined) out.st = old.pz;
  if (old.vf === undefined && old.jg !== undefined) out.vf = old.jg;
  for (const k of ['pz', 'jg', 'ff', 'digM', 'digP']) delete out[k];
  return out;
}

function fresh(): SaveData {
  return {
    v: 3,
    muted: false,
    seenIntro: false,
    runs: 0,
    nextId: 1,
    nodes: {
      root: { id: 'root', parent: null, epoch: -1, cls: 'fish', traits: { ...ZERO }, hue: 0, seed: 1, sig: 'root', children: [], runs: 0, last: 0 },
    },
    run: null,
    lastEnd: null,
    deepest: -1,
    seen: [],
  };
}

/** Grobe Einordnung einer Linie – gleiche Signatur im selben Zeitalter = derselbe Ast. */
export function sigOf(cls: ClassId, tIn: Partial<Traits>) {
  const t = full(tIn);
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  return `${cls}:${plateSig(t)}:${diet}:${t.coat}`;
}

const GENUS_ROOT: Record<ClassId, string> = { fish: 'ichthys', amphibian: 'batrachus', reptile: 'saurus', mammal: 'therium' };
const GENUS_PRE: Record<string, string> = { basal: 'Prot', st: 'Placo', bs: 'Odont', vf: 'Drom', sw: 'Agel' };
const EPITHET: Record<string, string> = { herb: 'phytophagus', omni: 'vulgaris', carn: 'carnivorus' };

/** Ein wissenschaftlich klingender Name für eine Linie (nur im Stammbaum zu sehen). */
export function speciesName(n: Pick<TreeNode, 'cls' | 'traits' | 'epoch'>) {
  if (n.epoch < 0) return 'Der Urahn';
  const t = full(n.traits);
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  const root = GENUS_ROOT[n.cls];
  const genus = GENUS_PRE[dominantPlate(t) ?? 'basal'] + (/^[aeiou]/.test(root) ? '' : 'o') + root;
  const color = t.coat === 1 ? 'viridis' : t.coat === 2 ? 'niger' : '';
  return `${genus} ${color || EPITHET[diet]}`;
}

/** Ereignisse zwischen den Szenen (HUD, Level …). */
export const bus = new Emitter();

/**
 * Was im Zeitalter getan wurde. Daraus ergeben sich beim Generationswechsel die Ausprägung der gewählten Platte und die
 * Anpassungen, die unabhängig von der Platte geschehen (Größe, Robustheit, Flossen aus der Bewegung).
 */
export interface PlayStyle {
  /** Treffer mit einem Stoß bzw. einem Biss – gewichtet nach der Stärke des Gegners; wer ihn damit erlegt, zählt dreifach */
  ram: number;
  hunt: number;
  /** eingeholte Flüchtende: Treffer an Beute, die schon davonrennt – je länger und je schneller sie floh, desto mehr */
  chase: number;
  /** zurückgelegte Strecke mit Tempo (gegen Strömungen doppelt) */
  swim: number;
  /** gemeinsam gejagt: Beute, die mit deiner Gruppe erlegt (nach Stärke gewichtet) und mit ihr geteilt wurde */
  pack: number;
  /** überstandene Treffer, gewichtet nach ihrer Schwere */
  hurt: number;
  /** Sekunden, in denen nach oben bzw. unten geschwommen wurde, schnell nach vorn, und wie oft die Richtung wechselte */
  up: number;
  down: number;
  fwd: number;
  turns: number;
  /** aktive Zeit je Art des Ortes (wer nur treibt, zählt kaum) – sie bestimmt die Körpergröße */
  hab: Partial<Record<PlaceKind, number>>;
  /**
   * Die stärksten Gegner, die mit Stoß, Biss, Verfolgung bzw. im Schwarm bezwungen wurden (je die drei stärksten; Stärke im
   * Verhältnis zum eigenen ausgewachsenen Tier – bei der Verfolgung: ihr Fluchttempo im Verhältnis zu deinem). Sie setzen die
   * Obergrenze, bis zu der sich jede Richtung ausprägen kann (plateCeil).
   */
  best?: Partial<Record<TrainKey, number[]>>;
}

export type TrainKey = 'ram' | 'hunt' | 'chase' | 'pack';

export const newStyle = (): PlayStyle => ({ ram: 0, hunt: 0, chase: 0, swim: 0, pack: 0, hurt: 0, up: 0, down: 0, fwd: 0, turns: 0, hab: {}, best: {} });

/** Ein Gegner wurde bezwungen (r: seine Stärke im Verhältnis zu dir) – merken, wenn er zu den drei stärksten gehört. */
export function noteBest(style: PlayStyle, k: TrainKey, r: number) {
  if (!(r > 0)) return;
  const b = (style.best ??= {});
  b[k] = [...(b[k] ?? []), r].sort((x, y) => y - x).slice(0, 3);
}

/** Wie weit sich jede Richtung höchstens ausprägen kann (0 … 1) – nach den stärksten Gegnern, die damit bezwungen wurden. */
export function plateCeil(style: Pick<PlayStyle, 'best'>): Record<PlateId, number> {
  const peak = (k: TrainKey) => {
    const b = style.best?.[k] ?? [];
    return (b[0] ?? 0) / 3 + (b[1] ?? 0) / 3 + (b[2] ?? 0) / 3;
  };
  const c = (k: TrainKey) => Math.min(1, INHERIT.ceilBase + INHERIT.ceilPer * peak(k));
  return { st: c('ram'), bs: c('hunt'), vf: c('chase'), sw: c('pack') };
}

class GameState {
  data: SaveData = fresh();
  private snap: { traits: Traits; aggression: number; infamy: number } | null = null;
  /** Das gerade beendete Leben – damit Anzeigen bis zum Szenenwechsel weiterlaufen können. */
  private ghost: Run | null = null;
  /** Gewicht des ersten Fischs (Bezug für den Grundwert der Nachkommen) */
  private g0?: number;

  load(slot?: string | null) {
    const s = (slot ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16);
    slotKey = s ? `${KEY}-${s}` : KEY;
    try {
      const raw = localStorage.getItem(slotKey);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const f = fresh();
        this.data = { ...f, ...d, nodes: { ...f.nodes, ...d.nodes } } as SaveData;
        this.data.seen = Array.isArray(d.seen) ? d.seen.filter((id) => typeof id === 'string') : [];
        for (const n of Object.values(this.data.nodes)) n.traits = migrate(n.traits);
        // Nur noch die Fischzeit: alles, was dahinter lag, wird verworfen
        this.prune();
        const r = this.data.run;
        if (r) {
          r.prog ??= newProg(r.epoch);
          r.prog.train ??= newStyle();
          r.prog.eaten ??= { meat: 0, plant: 0 };
          // ältere Spielstände kennen kein Alter: Wer schon unterwegs war, ist ausgewachsen
          r.life ??= newLife(r.history.length + 1, phases(r.history.length + 1).mature);
          r.life.clutches ??= [];
          // ältere Spielstände zählen die Nahrung nicht: so viel, wie ein Tier bis zu diesem Alter etwa frisst
          r.life.fed ??= Math.round(r.life.age * 0.4);
          // Leben sind kürzer geworden: Wer schon über die Laichzeit hinaus war, steht wieder an ihrem Anfang
          if (r.life.age > phases(r.life.gen).mature + 30) r.life.age = phases(r.life.gen).mature;
          // Endgegner gehören nicht mehr zum Ablauf: Einer, der dir noch folgte, ist fort
          if (r.prog.boss === 1) r.prog.boss = 0;
          r.prog.known ??= [...r.prog.seen];
          // Orte aus einer älteren Karte, die es nicht mehr gibt
          r.prog.known = r.prog.known.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          r.prog.seen = r.prog.seen.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          if (!placesOf(EPOCHS[r.epoch]).some((p) => p.id === r.prog.place)) r.prog = newProg(r.epoch);
          r.shells ??= [];
          r.seenRows ??= r.shells.length;
          r.traits = migrate(r.traits);
          for (const a of r.history) a.traits = migrate(a.traits);
          // früher gab es auch Stachelköpfe – heute wird ein viel benutzter Kopf zum Panzer
          r.traits.spike = -Math.abs(r.traits.spike);
          r.social ??= 0.55;
          r.canRam = true;
          // vorerst schlüpft man immer als Männchen – auch ein Weibchen aus einem älteren Spielstand wird zu einem
          if (SPAWN.alwaysMale) r.sex = 1;
        }
      }
    } catch {
      this.data = fresh();
    }
  }

  /** Knoten und Läufe aus den Zeitaltern, die es nicht mehr gibt, entfernen. */
  private prune() {
    const d = this.data;
    const bad = new Set<string>();
    for (const n of Object.values(d.nodes)) if (n.epoch >= EPOCHS.length || n.cls !== 'fish') bad.add(n.id);
    if (bad.size) {
      for (const id of bad) delete d.nodes[id];
      for (const n of Object.values(d.nodes)) n.children = n.children.filter((c) => !bad.has(c));
      if (d.lastEnd && !d.nodes[d.lastEnd]) d.lastEnd = null;
    }
    d.deepest = Math.min(d.deepest, EPOCHS.length - 1);
    if (d.run && (d.run.epoch >= EPOCHS.length || d.run.cls !== 'fish' || !d.nodes[d.run.node])) d.run = null;
  }

  save() {
    try {
      localStorage.setItem(slotKey, JSON.stringify(this.data));
    } catch {
      /* Speichern nicht möglich (z. B. privates Fenster) – Spiel läuft trotzdem. */
    }
  }

  /** Alles löschen, auch den Stammbaum. */
  resetAll() {
    const muted = this.data.muted;
    this.data = fresh();
    this.data.muted = muted;
    this.save();
  }

  // ---------------------------------------------------------------- Lauf

  get run() {
    return this.data.run;
  }

  hasRun() {
    return !!this.data.run;
  }

  /**
   * Der laufende Lauf. Nach dem Aussterben bleibt das letzte Leben noch kurz greifbar
   * (die Welt läuft bis zur Überblendung weiter); ganz ohne Lauf wird einer begonnen.
   */
  private get r(): Run {
    return this.data.run ?? this.ghost ?? this.newRun();
  }

  get cls() {
    return this.r.cls;
  }

  get traits() {
    return this.r.traits;
  }

  get epoch(): EpochDef {
    return EPOCHS[Math.min(EPOCHS.length - 1, this.r.epoch)];
  }

  get epochIndex() {
    return this.r.epoch;
  }

  /** Eine neue Linie beginnt – als frisch geschlüpfter Urfisch an der Wurzel des Stammbaums. */
  newRun(): Run {
    const d = this.data;
    d.runs += 1;
    const run: Run = {
      id: d.runs,
      cls: 'fish',
      traits: { ...ZERO },
      aggression: 0,
      infamy: 0,
      hue: Math.floor(Math.random() * 4),
      seed: Math.floor(Math.random() * 100000),
      sex: newSex(),
      epoch: 0,
      node: 'root',
      kin: 0,
      quests: {},
      social: 0.55,
      // der Stoß geht von Anfang an (stark wird er erst mit einem harten Kopf)
      canRam: true,
      prog: newProg(0),
      life: newLife(1),
      shells: [],
      seenRows: 0,
      history: [],
    };
    d.run = run;
    this.ghost = null;
    const root = d.nodes.root;
    root.runs += 1;
    root.last = run.id;
    this.snap = null;
    this.save();
    return run;
  }

  // ---------------------------------------------------------------- Werte

  /**
   * Die Werte eines Tiers. Ohne ausdrücklich übergebene Merkmale sind es die des eigenen Tiers – so groß, wie es gerade
   * gewachsen ist, und so alt, wie es ist; übergebene Merkmale gelten für ein ausgewachsenes Tier (life: ADULT), sofern
   * nichts anderes angegeben ist.
   */
  stats(cls: ClassId = this.r.cls, traits?: Traits, life?: LifeK): Stats {
    const t = traits ?? this.r.traits;
    const k = life ?? (traits ? ADULT : this.lifeK);
    const b = CLASSES[cls].base;
    // Die ausgewachsene Größe kommt aus dem Wuchs (dem Lebensraum der Vorfahren); ein Jungtier ist davon erst ein Teil
    const adult = clamp(0.7 + 0.62 * t.growth, 0.58, 1.5);
    const size = adult * k.grow;
    const carn = Math.max(0, t.diet), herb = Math.max(0, -t.diet);
    // die Kopfplatte des Stoßfischs: ein gepanzerter, harter Schädel
    const plates = Math.max(0, -(t.spike ?? 0)) * t.skull;
    // Körperrobustheit: robuste Schuppen bzw. ein Schuppenpanzer – unabhängig von der Kopfplatte
    const armor = t.armor ?? 0;
    const girth = t.girth ?? 0;
    const land = CLASSES[cls].habitat === 'land';
    const limb = t.limb ?? 0;
    const bite = b.bite * size * (1 + 3.6 * Math.pow(t.jaw, 1.1)) * (1 + 0.25 * carn) * (1 + 0.6 * (t.fang ?? 0));
    const ram = b.ram * size * (1 + 2.6 * t.skull) * (1 + 0.5 * plates) * (1 + 0.15 * girth);
    const body = (1 + 0.14 * (t.swift ?? 0) + 0.05 * (t.len ?? 0) - 0.07 * girth);
    // Verfolgungsfische halten lange durch – das zeigt ihr Körperbau allein nicht
    const chase = plateLevel(t.vf ?? 0);
    // Schwarmfische sind allein verletzlicher: Ihre Stärke ist die Gruppe
    const school = plateLevel(t.sw ?? 0);
    return {
      // Jungtiere sind verletzlich, aber nicht ganz so sehr, wie ihre Größe vermuten ließe; im Alter lässt die Kraft nach
      maxHp: Math.max(3, Math.round(b.hp * Math.pow(adult, 1.3) * Math.pow(k.grow, 0.8) * (1 + 0.25 * t.skull + 0.2 * plates) * (1 + 0.16 * girth + 0.05 * (t.len ?? 0)) * (1 + 0.15 * armor) * (1 - 0.12 * school) * (1 - LIFE.oldHp * k.old))),
      bite,
      ram,
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2) * (1 - 0.6 * plates),
      // Kompromisse: Wer ein starkes Gebiss, einen harten Kopf oder einen Schuppenpanzer hat, schwimmt dafür langsamer
      speed: b.speed * (1 + 0.38 * t.stealth) * (1.12 - 0.14 * size) * body * (land ? 1 + 0.14 * limb : 1)
        * (1 - 0.2 * Math.pow(t.jaw, 0.9) - 0.09 * t.skull - 0.04 * (t.fang ?? 0) - 0.1 * armor) * (1 - LIFE.oldSpeed * k.old),
      jump: b.jump * (1 + 0.12 * t.stealth) * (1 + 0.1 * limb),
      size,
      defense: clamp(1 - 0.28 * t.skull - 0.12 * plates - 0.08 * (size - 1) - 0.24 * armor, 0.35, 1.1),
      groundSpeed: 0.7 + 0.6 * limb,
      power: bite * 0.6 + ram * 0.4,
      // große Fische fallen früher auf – kleine Beute ist dann längst auf und davon
      detect: (1 - 0.55 * t.stealth) * (0.8 + 0.25 * size),
      // Kost: Wer Fleisch frisst, holt mehr aus Fleisch (und weniger aus Pflanzen) – und umgekehrt
      digestMeat: Math.max(0.35, 1 + 0.6 * carn - 0.6 * herb),
      digestPlant: Math.max(0.35, 1 + 0.6 * herb - 0.6 * carn),
      // Schwere Waffen und Panzer ermüden: starke Kiefer, ein harter Kopf und Schuppenpanzer kosten Kraft, schlanke Verfolger halten länger durch
      endurance: clamp(1 + 0.3 * chase - 0.32 * t.jaw - 0.22 * t.skull - 0.12 * armor - 0.18 * Math.max(0, size - 1) - 0.12 * (t.swift ?? 0) + 0.12 * Math.max(0, -girth), 0.5, 1.9) * (1 - LIFE.oldEndurance * k.old),
      recover: clamp(1 + 0.2 * chase - 0.2 * t.jaw - 0.08 * armor - 0.12 * Math.max(0, size - 1), 0.55, 1.6) * (1 - LIFE.oldRecover * k.old),
      // Flossen, die aus der Bewegung gewachsen sind: schneller nach oben, nach unten, nach vorn – und wendiger
      climb: 1 + 0.45 * (t.fUp ?? 0),
      dive: 1 + 0.45 * (t.fDown ?? 0),
      cruise: 1 + 0.3 * (t.fTail ?? 0),
      // kleine, kurze Fische wenden schnell, große und lange schwerfällig
      agility: clamp(1 + 1.1 * (t.fSide ?? 0) - 0.14 * (t.len ?? 0) - 0.22 * (size - 0.8), 0.6, 2.4),
      upkeep: 1 + 0.3 * armor + 0.15 * Math.max(0, girth),
    };
  }

  /**
   * Das Aussehen ändert sich nur bei der Verwandlung nach einem Zeitalter – nicht Stück für Stück mittendrin: Körperbau, Flossen,
   * Gebiss und Färbung bleiben, wie sie zu Beginn des Zeitalters waren (Tarnung, Bodenkontakt und Ähnliches wachsen im Verborgenen
   * weiter). Nur Narben und die Farbe aus einer Höhle zeigen sich sofort.
   */
  looks(t: Traits): Traits {
    const s = this.snap?.traits;
    if (!s) return t;
    const out = { ...t };
    for (const k of LOOK_KEYS) out[k] = s[k];
    return out;
  }

  /** Das Aussehen zu einer Form und ihren Merkmalen. */
  morph(o: { cls?: ClassId; traits?: Traits; belly?: number; fierce?: number; hue?: number; seed?: number; sex?: number; life?: LifeK } = {}): Morph {
    const run = this.data.run;
    const cls = o.cls ?? run?.cls ?? 'fish';
    const live = o.traits ?? run?.traits ?? ZERO;
    // das eigene Tier zeigt sich in der Gestalt vom Anfang des Zeitalters; ausdrücklich übergebene Merkmale gelten, wie sie sind
    const t = o.traits ? o.traits : this.looks(live);
    return {
      cls,
      size: this.stats(cls, live, o.life ?? (o.traits ? ADULT : this.lifeK)).size,
      jaw: t.jaw,
      skull: t.skull,
      stealth: t.stealth,
      diet: t.diet,
      scars: live.scars,
      spike: t.spike ?? 0,
      green: t.green ?? 0,
      sand: t.sand ?? 0,
      len: t.len ?? 0,
      girth: t.girth ?? 0,
      swift: t.swift ?? 0,
      fang: t.fang ?? 0,
      light: t.light ?? 0,
      limb: t.limb ?? 0,
      fin: t.fin ?? 0,
      tail: t.tail ?? 0,
      crest: t.crest ?? 0,
      tint: t.tint ?? 0,
      snout: t.snout ?? 0,
      coat: live.coat ?? 0,
      armor: t.armor ?? 0,
      st: t.st ?? 0,
      bs: t.bs ?? 0,
      vf: t.vf ?? 0,
      sw: t.sw ?? 0,
      fUp: t.fUp ?? 0,
      fDown: t.fDown ?? 0,
      fSide: t.fSide ?? 0,
      fTail: t.fTail ?? 0,
      belly: o.belly ?? 1,
      fierce: o.fierce ?? (run ? this.fear() : 0),
      hue: o.hue ?? run?.hue ?? 0,
      seed: o.seed ?? run?.seed ?? 1,
      sex: o.sex ?? run?.sex ?? 0,
    };
  }

  /**
   * Ein Artgenosse: dieselbe Art, aber jeder ein wenig anders – Männchen oder Weibchen, mal länger,
   * mal massiger, mal flinker.
   */
  kinTraits(i: number): { traits: Traits; sex: Sex; seed: number } {
    const run = this.r;
    const rnd = mulberry32(run.seed * 31 + run.epoch * 977 + i * 101);
    const j = (v: number, a: number) => clamp(v + (rnd() - 0.5) * 2 * a, 0, 1);
    const g = (v: number, a: number) => clamp(v + (rnd() - 0.5) * 2 * a, -1, 1);
    const t = this.looks(run.traits);
    const sex: Sex = (i + run.id) % 2 ? 1 : 2;
    const traits: Traits = {
      jaw: j(t.jaw, 0.1),
      skull: j(t.skull, 0.1),
      stealth: j(t.stealth, 0.1),
      growth: clamp(t.growth + (sex === 1 ? 0.06 : -0.06) + (rnd() - 0.5) * 0.16, GROWTH_MIN, 1),
      diet: t.diet,
      scars: rnd() < 0.3 ? 1 : 0,
      spike: t.spike,
      green: j(t.green, 0.08),
      sand: j(t.sand, 0.08),
      len: g(t.len, 0.3),
      girth: g(t.girth, 0.3),
      swift: g(t.swift, 0.3),
      nerve: t.nerve,
      tox: t.tox,
      fang: j(t.fang, 0.06),
      light: g(t.light ?? 0, 0.15),
      limb: j(t.limb ?? 0, 0.06),
      pack: t.pack ?? 0,
      fin: g(t.fin ?? 0, 0.25),
      tail: g(t.tail ?? 0, 0.25),
      crest: g(t.crest ?? 0, 0.25),
      tint: g(t.tint ?? 0, 0.15),
      snout: g(t.snout ?? 0, 0.2),
      coat: t.coat ?? 0,
      armor: j(t.armor ?? 0, 0.05),
      st: t.st ?? 0,
      bs: t.bs ?? 0,
      vf: t.vf ?? 0,
      sw: t.sw ?? 0,
      fUp: j(t.fUp ?? 0, 0.05),
      fDown: j(t.fDown ?? 0, 0.05),
      fSide: j(t.fSide ?? 0, 0.05),
      fTail: j(t.fTail ?? 0, 0.05),
    };
    return { traits, sex, seed: run.seed + 1000 + i * 17 };
  }

  kinMorph(i: number, belly = 1): Morph {
    const k = this.kinTraits(i);
    return this.morph({ traits: k.traits, belly, fierce: 0, seed: k.seed, sex: k.sex });
  }

  /** Länge (cm) und Gewicht (g) eines Tiers (ausgewachsen, sofern nichts anderes angegeben ist). */
  measure(cls: ClassId = this.r.cls, t: Traits = this.r.traits, life: LifeK = ADULT) {
    const b = BODY[cls];
    const size = this.stats(cls, t, life).size;
    const cm = b.cm * size * (1 + 0.15 * (t.len ?? 0));
    const g = b.g * Math.pow(cm, 3) * (1 + 0.35 * (t.girth ?? 0) - 0.08 * (t.len ?? 0)) * (0.9 + 0.2 * t.growth);
    return { cm, g };
  }

  /** Wie oft eine Art (nach ihrem Namen im Stammbaum) schon ausgestorben ist. */
  extinctCount(name: string) {
    let n = 0;
    for (const node of Object.values(this.data.nodes)) if (node.dead && speciesName(node) === name) n++;
    return n;
  }

  /** Der Name der eigenen Linie, wie er im Stammbaum stehen würde. */
  get currentName() {
    const r = this.r;
    return speciesName({ cls: r.cls, traits: r.traits, epoch: Math.max(0, r.epoch) });
  }

  // ---------------------------------------------------------------- Leben und Laichen

  /** Gewicht des ausgewachsenen eigenen Tiers im Verhältnis zum ersten Fisch (dem Urfisch an der Wurzel). */
  weight(): number {
    this.g0 ??= this.measure('fish', ZERO, ADULT).g;
    return this.measure(this.r.cls, this.r.traits, ADULT).g / this.g0;
  }

  /** So viel Nahrung braucht ein Nachkomme des eigenen Tiers (der Grundwert – schwere Tiere brauchen mehr). */
  get broodBase(): number {
    return broodBase(this.weight());
  }

  /** So voll muss der Magen des eigenen Tiers zum Laichen mindestens sein (Anteil). */
  get spawnMinFood(): number {
    return spawnMinFood(this.weight());
  }

  /** Gefressen (Sättigung): Es nährt die Brut. */
  feed(units: number) {
    if (units > 0) this.r.life.fed += units;
  }

  /** So viele Nachkommen hat das eigene Tier, wenn es jetzt stirbt (mit einem befruchteten Gelege wenigstens einen). */
  get young(): number {
    const n = youngOf(this.r.life.fed, this.broodBase);
    return this.heir() ? Math.max(1, n) : n;
  }

  /** Das Leben des eigenen Tiers. */
  get life(): Life {
    return this.r.life;
  }

  /** Wie weit das eigene Tier gewachsen und gealtert ist. */
  get lifeK(): LifeK {
    return lifeK(this.r.life.age, this.r.life.gen);
  }

  /** Zeit vergeht für das eigene Tier (Sekunden aktiven Lebens – wer nicht spielt, altert nicht). */
  ageBy(dt: number) {
    this.r.life.age += dt;
  }

  /** Ein Gelege, an dem dieses Tier beteiligt ist: selbst gelegt oder (fremd gelegt und) befruchtet. */
  addClutch(c: Omit<Clutch, 'id'>): Clutch {
    const L = this.r.life;
    const cl: Clutch = { ...c, id: L.nextClutch++ };
    L.clutches.push(cl);
    this.save();
    return cl;
  }

  /** Ein Männchen ist zum Gelege unterwegs (gespeichert: auch nach einer Pause oder einem Neustart verdirbt es nicht). */
  maleCalled(id: number) {
    const c = this.r.life.clutches.find((x) => x.id === id);
    if (!c || c.called) return;
    c.called = true;
    this.save();
  }

  /** Das eigene Gelege wird befruchtet (von einem Männchen deiner Art). */
  fertilize(id: number, partner: Clutch['partner']) {
    const c = this.r.life.clutches.find((x) => x.id === id);
    if (!c) return;
    c.fert = true;
    c.partner = partner;
    this.save();
  }

  /** Gelaicht: Das kostet Kraft (Magen, siehe SPAWN) – und vor dem nächsten Mal vergeht eine Weile. */
  markSpawn() {
    const L = this.r.life;
    L.spawns += 1;
    L.lastSpawn = L.age;
    this.save();
  }

  /** Ein Gelege ist fort (gefressen, verdorben). */
  dropClutch(id: number) {
    const L = this.r.life;
    L.clutches = L.clutches.filter((c) => c.id !== id);
    this.save();
  }

  /** Unbefruchtete Gelege verderben nach einer Weile (Weltzeit). */
  decayClutches(now = worldNow()) {
    const L = this.r.life;
    const keep = L.clutches.filter((c) => c.fert || c.called || now - c.at < SPAWN.decay * 1000);
    if (keep.length === L.clutches.length) return false;
    L.clutches = keep;
    this.save();
    return true;
  }

  /** Das Gelege, aus dem die nächste Generation schlüpft: das jüngste befruchtete. */
  heir(): Clutch | undefined {
    const cs = this.data.run?.life.clutches ?? [];
    for (let i = cs.length - 1; i >= 0; i--) if (cs[i].fert) return cs[i];
    return undefined;
  }

  /**
   * Die nächste Generation – angepasst an die Spielweise, ohne Wahl. Alles baut auf dem Stand vom Ende dieses Lebens auf:
   *   – Was im Leben Stück für Stück gewachsen ist (Tarnung, Bodenkontakt …), setzt sich zum Teil fort (INHERIT.carry).
   *   – Die Bewegung formt die Flossen (moveGrowth).
   *   – Körpergröße: Der Lebensraum, in dem man am aktivsten war, zieht den Wuchs nach oben (Tiefe) bzw. unten (flach,
   *     bewachsen); größer heißt auch massiger.
   *   – Körperrobustheit: Überstandene Angriffe machen die Schuppen robuster – gefährliche zählen mehr.
   *   – Ernährung: Der Anteil von Fleisch und Pflanzen an der aufgenommenen Energie verschiebt die Kost, Schritt für Schritt.
   *   – Jede Evolutionsplatte wächst, je nachdem wie gut die Spielweise zu ihr passte (INHERIT.gain × Passung) – wer viel
   *     stößt, bekommt Nachkommen mit härterem Kopf, wer viel beißt, ein stärkeres Gebiss, wer jagt, einen schnelleren Körper.
   *   – Der Partner gibt etwas von seinem Aussehen mit (INHERIT.partner); Geschlecht und Zeichnung sind neu gewürfelt.
   */
  inherit(eaten: { meat: number; plant: number }, style: PlayStyle, partner?: Clutch['partner']): Heir {
    const run = this.r;
    const start = full(this.snap?.traits ?? run.traits);
    const end = full(run.traits);
    const k = INHERIT.carry;
    // nie zu viel auf einmal: jede Veränderung je Generation hat ihre Grenze (INHERIT.step)
    const S = INHERIT.step;
    const lim = (v: number, m: number) => clamp(v, -m, m);
    const lived = Math.max(60, run.life.age);
    const t = full({ ...end });
    for (const key of AMP) t[key] = clamp(end[key] + Math.min(S.carry, Math.max(0, end[key] - start[key]) * k), 0, 1);
    // Färbung und Flossen, die sich im Leben verschoben haben (Licht, Verstecke), setzen sich fort
    for (const g of ['light', 'fin', 'crest'] as const) t[g] = clamp(end[g] + lim((end[g] - start[g]) * k * 0.8, S.carry), -1, 1);
    const mv = moveGrowth(style);
    t.fUp = clamp(end.fUp + Math.min(S.fins, mv.up), 0, 1);
    t.fDown = clamp(end.fDown + Math.min(S.fins, mv.down), 0, 1);
    t.fSide = clamp(end.fSide + Math.min(S.fins, mv.side), 0, 1);
    t.fTail = clamp(end.fTail + Math.min(S.fins, mv.tail), 0, 1);
    // Körpergröße aus dem Lebensraum: ein Stück des Weges je Generation
    const hab = habitatPull(style.hab, lived);
    if (hab) {
      const dg = lim((hab.target - end.growth) * 0.45 * hab.sure, S.growth);
      t.growth = clamp(end.growth + dg, GROWTH_MIN, 1);
      t.girth = clamp(end.girth + 0.4 * dg, -1, 1);
    }
    // Körperrobustheit aus überstandenen Angriffen (je robuster schon, desto weniger kommt dazu)
    t.armor = clamp(end.armor + Math.min(S.armor, 0.3 * (1 - Math.exp(-style.hurt / 12)) * (1 - end.armor)), 0, 1);
    // Ernährung aus der aufgenommenen Energie – Schritt für Schritt und nie ganz bis zum Äußersten
    const total = eaten.meat + eaten.plant;
    if (total > 0) {
      const target = clamp((2 * eaten.meat) / total - 1, -DIET_MAX, DIET_MAX);
      const sure = Math.min(1, total / (0.4 * fedRef(lived, this.stats(run.cls, run.traits).size)));
      t.diet = clamp(end.diet + lim(target - end.diet, S.diet) * sure, -DIET_MAX, DIET_MAX);
    }
    // die Evolutionsplatten: jede so weit, wie die Spielweise zu ihr passte (den Schwarmfisch nur mit einer Gruppe)
    const fit = plateFit(style);
    const plates = this.swarm?.callable && this.swarm.members.length ? PLATE_IDS : PLATE_IDS.filter((id) => id !== 'sw');
    let line: PlateId | undefined;
    let best = 0;
    // wie weit jede Richtung wachsen würde – höchstens plateStep je Richtung, alle zusammen höchstens plateTotal, und nie
    // über das hinaus, was die bezwungenen Gegner hergeben (plateCeil)
    const ceil = plateCeil(style);
    const capped: PlateId[] = [];
    const want = plates.map((id) => {
      const n0 = t[id];
      const free = Math.min(INHERIT.plateStep, plateLevel(Math.min(PLATE_MAX, n0 + INHERIT.gain * fit[id])) - plateLevel(n0));
      const w = Math.min(free, Math.max(0, ceil[id] - plateLevel(n0)));
      if (fit[id] > 0.25 && free - w > 0.03) capped.push(id);
      return w;
    });
    const sum = want.reduce((a, b) => a + b, 0);
    const scale = sum > INHERIT.plateTotal ? INHERIT.plateTotal / sum : 1;
    for (const [i, id] of plates.entries()) {
      const n0 = t[id];
      const f = Math.max(0, want[i] * scale);
      // die Punkte, die zu dieser Ausprägung gehören
      const n1 = Math.min(PLATE_MAX, -Math.log(Math.max(1e-6, 1 - Math.min(0.999, plateLevel(n0) + f))) / 0.7);
      for (const [key, d] of Object.entries(PLATE_D[id]) as [keyof Traits, number][]) {
        const [lo, hi] = range(key);
        t[key] = clamp(t[key] + d * f, lo, hi);
      }
      t[id] = n1;
      if (f > best) {
        best = f;
        line = id;
      }
    }
    // der Partner: ein wenig von seinem Aussehen (nicht von Größe, Kost, Robustheit oder den Platten)
    if (partner) {
      const p = full({ ...partner.traits });
      for (const key of BLEND_KEYS) {
        const [lo, hi] = range(key);
        t[key] = clamp(t[key] + (p[key] - t[key]) * INHERIT.partner, lo, hi);
      }
    }
    return {
      traits: t,
      sex: newSex(),
      seed: Math.floor(Math.random() * 100000),
      fit,
      line: best > 0.04 ? line : undefined,
      capped,
    };
  }

  /**
   * Die nächste Generation übernimmt: Das eigene Tier ist (nach dem Laichen) gestorben – du spielst als Jungtier aus seinem
   * Gelege weiter. Was die Linie weiß (Orte, Muscheln, Aufträge, Gruppe), bleibt; Alter, Magen und Spielweise beginnen neu.
   */
  succeed(c: Clutch, h: Heir) {
    const run = this.r;
    // eins schlüpft jetzt, die übrigen warten im Gelege (die Geschwister des alten Geleges sind ihre eigenen Wege gegangen)
    const n = this.young;
    run.siblings = n > 1 ? { n: n - 1, traits: full({ ...h.traits }), place: c.place, x: c.x, y: c.y } : undefined;
    run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: run.epoch });
    if (run.history.length > 24) run.history.splice(1, 1);
    run.traits = full({ ...h.traits });
    run.sex = h.sex;
    run.seed = h.seed;
    this.hatchAt(run, run.life.gen + 1, c);
  }

  /**
   * Das eigene Tier ist gestorben, bevor es gelaicht hat – aber im Gelege, aus dem es kam, warten noch Geschwister: Das
   * nächste schlüpft (dieselbe Generation, so beschaffen, wie das Tier geschlüpft war; Geschlecht und Zeichnung neu).
   * Gibt false zurück, wenn keines mehr wartet.
   */
  sibling(): boolean {
    const run = this.r;
    const s = run.siblings;
    if (!s || s.n < 1) return false;
    s.n -= 1;
    if (s.n < 1) run.siblings = undefined;
    run.traits = full({ ...s.traits });
    run.sex = newSex();
    run.seed = Math.floor(Math.random() * 100000);
    this.hatchAt(run, run.life.gen, s);
    return true;
  }

  /** Ein neues Tier schlüpft aus dem Gelege c: Alter, Magen und Spielweise beginnen neu – was die Linie weiß, bleibt. */
  private hatchAt(run: Run, gen: number, c: { place: string; x: number; y: number }) {
    run.aggression *= 0.5;
    run.infamy *= 0.8;
    run.kin = 0;
    this.newGeneration(run);
    run.life = newLife(gen);
    const p = run.prog;
    p.place = c.place;
    p.from = undefined;
    p.edge = undefined;
    p.at = { x: c.x, y: c.y };
    p.hp = undefined;
    p.sat = undefined;
    p.eaten = { meat: 0, plant: 0 };
    p.train = newStyle();
    // ein Endgegner, der dem Elterntier folgte, folgt nicht der neuen Generation
    if (p.boss === 1) p.boss = 0;
    if (!p.seen.includes(c.place)) p.seen.push(c.place);
    if (!p.known.includes(c.place)) p.known.push(c.place);
    if (this.checkRamUnlock()) run.ramNew = true;
    this.snap = null;
    this.save();
  }

  // ---------------------------------------------------------------- die eigene Gruppe (Schwarm)

  get swarm(): Swarm | undefined {
    return this.data.run?.swarm;
  }

  /** Die Gruppe deiner Art entsteht (beim ersten Treffen): so viele Artgenossen, alle bei voller Kraft. */
  foundSwarm(n: number): Swarm {
    const r = this.r;
    r.swarm ??= {
      members: Array.from({ length: n }, (_, i) => ({ id: i + 1, hp: 1 })),
      next: n + 1, out: [], callable: false, fed: 0, grown: 0, lost: 0, left: 0,
    };
    this.save();
    return r.swarm;
  }

  /** So viele kommen höchstens auf deinen Ruf – je mehr Zusammenhalt (Schwarmfisch), desto mehr. */
  swarmCap() {
    return SWARM.cap + Math.round(SWARM.capPlus * (this.traits.pack ?? 0));
  }

  /** Angriffskraft eines Artgenossen im Verhältnis zu deiner (immer darunter). */
  swarmStrength() {
    return SWARM.dmg + SWARM.dmgPlus * (this.traits.pack ?? 0);
  }

  /** Ein Artgenosse ist gestorben (died) bzw. hat die Gruppe verlassen: Er fehlt fortan – die Bilanz merkt es sich. */
  swarmLose(id: number, died: boolean) {
    const s = this.swarm;
    if (!s || !s.members.some((m) => m.id === id)) return;
    s.members = s.members.filter((m) => m.id !== id);
    s.out = s.out.filter((o) => o !== id);
    if (died) s.lost++;
    else s.left++;
    this.save();
  }

  /**
   * Die Gruppe hat von gemeinsam erlegter Beute mitgefressen: Nach einigen solchen Mahlzeiten schließt sich ein weiterer
   * Artgenosse an (mit Zusammenhalt schneller). Gibt den Neuen zurück.
   */
  swarmShared(): Member | undefined {
    const s = this.swarm;
    if (!s?.callable) return undefined;
    s.fed++;
    const every = Math.max(2, Math.round(SWARM.growEvery * (1 - 0.5 * (this.traits.pack ?? 0))));
    if (s.fed < every || s.members.length >= this.swarmCap()) return undefined;
    s.fed = 0;
    const m: Member = { id: s.next++, hp: 1 };
    s.members.push(m);
    s.grown++;
    this.save();
    return m;
  }

  /** Gefressenes für den ganzen Lauf mitzählen (Werte-Bildschirm). */
  addEaten(kind: 'meat' | 'plant', units: number) {
    const r = this.r;
    r.eaten ??= { meat: 0, plant: 0 };
    r.eaten[kind] += units;
  }

  /** Wie gefährlich andere Tiere dich einschätzen. */
  fear() {
    const r = this.data.run;
    return r ? clamp(r.aggression * 0.7 + r.infamy * 0.6, 0, 1) : 0;
  }

  threat() {
    return this.stats().power * (0.65 + 0.9 * this.fear());
  }

  // ---------------------------------------------------------------- Anpassung

  /**
   * Ein verborgenes Merkmal wächst ein kleines Stück – je weiter entwickelt, desto langsamer. Körper und Kampfwerte
   * (Platten, Größe, Robustheit, Kost) wachsen nicht so, sondern erst beim Generationswechsel (evolve).
   */
  grow(k: TraitKey, amount: number) {
    const t = this.r.traits;
    t[k] = Math.min(1, t[k] + amount * Math.pow(1 - t[k], 1.3));
  }

  /** Färbung: + heller (oben im Licht), - dunkler (unten in der Tiefe) */
  shiftLight(amount: number) {
    const t = this.r.traits;
    t.light = clamp((t.light ?? 0) + amount, -1, 1);
  }

  /** Flossen verschieben sich (wer sich zwischen Pflanzen versteckt: größere Flossen, flachere Rückenflosse) */
  shiftBody(k: 'fin' | 'crest', amount: number) {
    const t = this.r.traits;
    t[k] = clamp((t[k] ?? 0) + amount, -1, 1);
  }

  get canRam() {
    return this.r.canRam;
  }

  /** Ab einem gewissen Schädel kann man gezielt rammen. Gibt true zurück, wenn es gerade freigeschaltet wurde. */
  checkRamUnlock() {
    const r = this.r;
    if (r.canRam || r.traits.skull < 0.2) return false;
    r.canRam = true;
    return true;
  }

  addScar() {
    this.r.traits.scars = Math.min(6, this.r.traits.scars + 1);
  }

  addAggression(a: number) {
    const r = this.r;
    r.aggression = clamp(r.aggression + a, 0, 1);
    r.infamy = clamp(r.infamy + a * 0.22, 0, 1);
  }

  /** Friedliche Zeit lässt die Angriffslust abklingen. */
  calm(dt: number) {
    const r = this.r;
    r.aggression = Math.max(0, r.aggression - 0.006 * dt);
  }

  /** Zu Beginn eines Lebens: Stand merken (für "einst/heute" und das Aussehen) und speichern. */
  beginLife() {
    const r = this.r;
    // nur zu Beginn des Lebens – beim Wechsel zwischen Orten bleibt der Stand von damals
    if (!this.snap) this.snap = { traits: { ...r.traits }, aggression: r.aggression, infamy: r.infamy };
    this.save();
  }

  // ---------------------------------------------------------------- Orte und Muscheln

  get prog(): EpochProg {
    return this.r.prog;
  }

  /** Wie weit ein Auftrag gediehen ist (0 = noch nicht begonnen). */
  questStep(id: string): number {
    return this.run?.quests?.[id] ?? 0;
  }

  setQuestStep(id: string, step: number) {
    const run = this.r;
    run.quests = { ...(run.quests ?? {}), [id]: step };
    this.save();
  }

  /** Den Ort verlassen: Zustand merken (Lebenskraft, Magen, Artgenossen, Gefressenes …). */
  leavePlace(s: Partial<EpochProg>) {
    Object.assign(this.r.prog, s);
    this.save();
  }

  /** Durch einen Durchgang in einen Nachbarort: Er wird freigeschaltet, der Weg kostet etwas Zeit und Kraft. */
  enterPlace(id: string, from?: string, edge?: { side: 'left' | 'right'; frac: number }) {
    const run = this.r;
    const p = run.prog;
    if (id !== p.place) {
      run.life.age += TRAVEL_SECONDS;
      const st = this.stats();
      if (p.sat !== undefined) p.sat = Math.max(0.01, p.sat - hungerRate(st.size, 0.8, st.upkeep) * TRAVEL_SECONDS * 0.6);
    }
    p.place = placeOf(EPOCHS[run.epoch], id).id;
    p.from = from;
    p.edge = from ? edge : undefined;
    if (!p.seen.includes(p.place)) p.seen.push(p.place);
    if (!p.known.includes(p.place)) p.known.push(p.place);
    this.save();
  }

  /** Ist dieser Ort schon freigeschaltet? */
  isKnown(id: string) {
    return this.r.prog.known.includes(id);
  }

  get shells(): string[] {
    return this.r.shells;
  }

  hasShell(id: string) {
    return this.r.shells.includes(id);
  }

  /** Eine Muschel gefunden: Sie legt die nächste Zeile der Steintafel frei. */
  collectShell(id: string) {
    const run = this.r;
    if (!run.shells.includes(id)) run.shells.push(id);
    this.save();
    return run.shells.length;
  }

  /** Wie viele Zeilen der Tafel schon freigelegt gesehen wurden. */
  get seenRows() {
    return this.r.seenRows;
  }

  set seenRows(n: number) {
    this.r.seenRows = n;
    this.save();
  }

  startTraits(): Traits {
    return this.snap ? { ...this.snap.traits } : { ...this.r.traits };
  }

  // ---------------------------------------------------------------- Stammbaum

  private node(parent: TreeNode, epoch: number, cls: ClassId, traits: Traits, runId: number, merge: boolean): TreeNode {
    const sig = sigOf(cls, traits);
    if (merge) {
      for (const cid of parent.children) {
        const c = this.data.nodes[cid];
        if (c && !c.dead && c.epoch === epoch && c.sig === sig) {
          c.runs += 1;
          c.last = runId;
          return c;
        }
      }
    }
    const run = this.r;
    const n: TreeNode = {
      id: 'n' + this.data.nextId++,
      parent: parent.id,
      epoch,
      cls,
      traits: full(traits),
      hue: run.hue,
      seed: run.seed,
      sig,
      children: [],
      runs: 1,
      last: runId,
    };
    this.data.nodes[n.id] = n;
    parent.children.push(n.id);
    return n;
  }

  /** Auch deine Gruppe ist eine neue Generation: wieder bei voller Kraft – und gerufen wird sie im neuen Zeitalter neu. */
  private newGeneration(run: Run) {
    if (!run.swarm) return;
    for (const m of run.swarm.members) m.hp = 1;
    run.swarm.out = [];
  }

  /** Das Tier ist gestorben: Die Linie endet hier. Gibt den Knoten des Astendes zurück. */
  extinct(frac: number, cause: string): string {
    const run = this.r;
    const parent = this.data.nodes[run.node] ?? this.data.nodes.root;
    const leaf = this.node(parent, run.epoch, run.cls, run.traits, run.id, false);
    leaf.dead = { frac: clamp(frac, 0, 1), cause, run: run.id, gens: run.life.gen };
    this.data.lastEnd = leaf.id;
    this.data.deepest = Math.max(this.data.deepest, run.epoch);
    this.ghost = run;
    this.data.run = null;
    this.snap = null;
    this.save();
    return leaf.id;
  }

  /** Pfad von der Wurzel bis zu einem Knoten. */
  pathTo(id: string | null): string[] {
    const out: string[] = [];
    let n = id ? this.data.nodes[id] : undefined;
    while (n) {
      out.unshift(n.id);
      n = n.parent ? this.data.nodes[n.parent] : undefined;
    }
    return out;
  }

  /** Ein Tier ist dir begegnet: Es bekommt seine Seite im Aquapendium. Gibt true zurück, wenn es neu war. */
  markSeen(id: string) {
    if (this.data.seen.includes(id)) return false;
    this.data.seen.push(id);
    this.save();
    return true;
  }

  hasSeen(id: string) {
    return this.data.seen.includes(id);
  }

  /** Gibt es schon einen Stammbaum (mindestens ein beendeter oder laufender Versuch)? */
  hasTree() {
    return this.data.runs > 0;
  }
}

export const game = new GameState();
