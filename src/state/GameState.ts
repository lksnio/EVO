import { fishStaminaMax } from '../sim/stamina';
import { endLineage, newLineage, observeLineage, readLineage, recordBirth, type LineageArchive, type LineageForm, type LineageSite } from '../sim/lineage';
import { COLLECTION_SHELLS, SHELL_WISDOM, type ShellId, type FossilId } from '../data/collection';
import { newCollection, readCollection, removeLegacyShells, findShell, dropFossil, findFossil, type CollectionState, type FossilDrop } from '../sim/collection';
import { CLASSES, type ClassId } from '../data/classes';
import { EPOCHS, firstPlayable, isPlayable, type EpochDef } from '../data/epochs';
import { linkKey, placeOf, placesOf, startPlace, type PlaceKind } from '../data/world';
import { SWARM } from '../data/swarm';
import type { Morph } from '../art/creatureArt';
import { clamp, mulberry32 } from '../util/math';
import { Emitter } from '../util/emitter';
import { evolutionBonus, evolutionBudget, evolutionStep, type Defeats, type Gains } from '../sim/evolution';
import { INHERIT, LIFE, MOVEMENT, SPAWN, STAMINA, VISION } from '../data/life';
import { ADULT, broodBase, lifeK, phases, worldNow, worldYears, youngOf, type LifeK } from '../sim/life';
import { FISH_LAND, KTRAIN } from '../data/karbon';
import { fishBirthGains, finStage, finSpeed as fishFinSpeed, FISH_BASE_STAMINA, appendFishMark, type FishPlan, type FishMark, type FishEffort } from '../sim/fishEvolution';
import { STARTER_FORMS } from '../sim/starterFish';
import { advanceStarterFish, resolveStarterForm, starterFormIndex, type StarterScores } from '../sim/starterFish';
import {
  feed as broodFeed, growOf, hatch as broodHatch, maxSlope, metamorph, newBrood, nextBrood, noGenes, offer, oxygenSeconds,
  type Brood, type Egg, type Gene,
} from '../sim/brood';

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
//   sand    – Tarnfarbe vom Verstecken am Boden und in Felsspalten
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
  /** Form bei der Geburt; Primärschaden 1 Gebiss oder 3 Kopfplatte (2 war früher Flossen). Nur numerische, vererbbare Daten. */
  fishForm?: number;
  fishPrimary?: number;
  /** Additive vererbte Punkte. Ältere Spielstände ohne diese Felder behalten ihre bisherigen Werte. */
  vitality?: number;
  /** Additive reserve points; start value is 30. Independent of fins. */
  staminaGain?: number;
  biteGain?: number;
  ramGain?: number;
  finGain?: number;
  scaleGain?: number;
  /** Verborgene relative Körperzuwächse: Länge aus Strecke, Masse aus mittlerer Tiefe. */
  lengthGain?: number;
  massGain?: number;
  /** Sicht in der Tiefe (Punkte): wächst nur durch Zeit in der Tiefe – kein Segen, kein Kompromiss */
  sightGain?: number;
  /** Ausdauer aus weiten Strecken (Punkte): lässt den Rückenkamm wachsen, kostet etwas Tempo */
  endGain?: number;
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
  /** Griff (Karbon): Zehen und Krallen, die an steilen Hängen halten (0 … 1) – aus dem Klettern */
  grip: number;
  /** Zusammenhalt (Schwarmfisch): Artgenossen helfen öfter, deine Gruppe wird größer und stärker (und will mitfressen) */
  pack: number;
  /** Flossengröße, Schwanzbreite, Rückenflosse/Kamm (-1 … +1) – ändern sich vor allem durch die Evolutionsplatten */
  fin: number;
  tail: number;
  crest: number;
  /** Farbton (-1 … +1) */
  tint: number;
  /** versteckte Farbabweichung von Körper, Flossen und Kopfpanzer (-1 … +1): wandert von Ei zu Ei (driftColors) */
  cb?: number;
  cf?: number;
  cp?: number;
  /** Kopfform: -1 kurz und stumpf … +1 lang und spitz */
  snout: number;
  /** Färbung aus älteren Spielständen: 0 natürlich, 1 grün (Gras), 2 schwarz (Dunkelheit) */
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

/**
 * Was Fressen bringt. Hunger gibt es nicht: Alles Gefressene ist Nahrung für die Brut (daraus werden die Nachkommen, siehe
 * data/life.ts, SPAWN). Nahrung kommt in ganzen Einheiten: Ein erlegtes Tier zerfällt in Fleischbrocken – große (chunk, 5)
 * und kleine (1) –, und jeder Brocken wird mit einem Bissen ganz gefressen; eine Pflanze ebenso (sat), ein Ei aus fremdem
 * Laich auch. kcal: der Nährwert je Einheit (er bestimmt, wohin sich die Kost der Nachkommen verschiebt).
 */
export const FOOD = {
  meat: { kcal: 1.2 },
  /** eine Pflanze (ganz, mit einem Bissen): wenig, aber ohne Gefahr – sie wächst nach */
  plant: { sat: 1, kcal: 1 },
  toxic: { sat: 1, kcal: 1.5 },
  /** ein Ei aus dem Laich anderer Arten: leicht zu fressen – aber die Eltern passen auf */
  roe: { sat: 1, kcal: 1.2 },
  /** Fleisch je erlegtem Tier: meatPerHp × (Lebenskraft der Art × Größe des Tiers) hoch meatExp, ganzzahlig (siehe meatOf) */
  meatPerHp: 0.1,
  meatExp: 1,
  /** so viel steckt in einem großen Fleischbrocken (die kleinen: 1) */
  chunk: 5,
};

/**
 * So viel Fleisch (Nahrung) gibt ein erlegtes Tier – nach seiner Lebenskraft, in der Größe und Stärke schon stecken, in ganzen
 * Einheiten und wenigstens 1: ein kleiner Beutefisch 1, ein Conodont um 3, Orthoceras um 5, Megalograptus um 16, der
 * Riesenkopffüßer um 43. Wer mehr will, muss Stärkeres erlegen – mit mehr Risiko. Eine Art kann einen festen Wert haben
 * (SpeciesDef.food, in der Entwickler-Einstellung).
 */
export const meatOf = (hp: number) => Math.max(1, Math.round(FOOD.meatPerHp * Math.pow(Math.max(1, hp), FOOD.meatExp)));

/** Die Brocken eines erlegten Tiers: so viele große (je FOOD.chunk) und kleine (je 1), wie zusammen seine Nahrung ergeben. */
export function meatChunks(total: number): number[] {
  const n = Math.max(1, Math.round(total));
  const big = Math.floor(n / FOOD.chunk);
  return [...Array<number>(big).fill(FOOD.chunk), ...Array<number>(n - big * FOOD.chunk).fill(1)];
}

/** Bezugsgröße für die Ernährung: so viel frisst ein Tier, das gut über die Runden kommt – in so vielen Sekunden Leben. */
export const fedRef = (seconds: number, size: number) => 0.05 * seconds * (0.85 + 0.3 * size);

export interface Stats {
  maxHp: number;
  bite: number;
  ram: number;
  /** Betäubung durch einen Schädelstoß: Stufe 0/1 keine, Stufe 2 1 s, Stufe 3 2 s. */
  ramStun: number;
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
  /** Rückstoß bei Treffern (1 = normal): Ein Schuppenpanzer hält dagegen */
  knock: number;
  /** an Land (Karbon): Tempo beim Laufen und wie steil ein Hang höchstens sein darf (Grad) */
  landSpeed: number;
  slope: number;
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

/** Wo man im aktuellen Zeitalter steht – über mehrere Orte hinweg. */
export interface EpochProg {
  /** aktueller Ort */
  place: string;
  /** schon besuchte Orte */
  seen: string[];
  /** entdeckte Orte – ein neuer Ort wird bekannt, sobald man über den Rand zu ihm hinüberschwimmt */
  known: string[];
  /** bekannte Wege zwischen zwei Orten (linkKey) – sie entstehen, wenn man von einem Ort in den anderen schwimmt */
  links: string[];
  /** über den Rand hereingeschwommen: über welche Seite man den anderen Ort verlassen hat und wie tief man war */
  edge?: { side: 'left' | 'right' | 'top' | 'chasm'; frac: number };
  /** zum Hauptmenü gegangen: Hier geht es weiter, wenn man wiederkommt (einmalig) */
  resume?: { x: number; y: number };
  /** Hier beginnt das Leben (ein neues Jungtier schlüpft aus seinem Gelege) – gilt nur einmal */
  at?: { x: number; y: number };
  /** in diesem Leben aufgenommene Energie (Nährwert nach der Verdauung) */
  eaten: { meat: number; plant: number };
  /** Zustand beim Verlassen eines Ortes */
  hp?: number;
  kin?: number;
  /** was getan wurde (ältere Spielstände kennen nicht alles) */
  train: Partial<PlayStyle>;
}

export const newProg = (epoch: number): EpochProg => ({
  place: startPlace(EPOCHS[epoch]).id,
  seen: [startPlace(EPOCHS[epoch]).id],
  known: [startPlace(EPOCHS[epoch]).id],
  links: [],
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
  /** so viele Nachkommen stecken darin (aus der Nahrung, die beim Laichen gesammelt war; ältere Spielstände: einer) */
  young?: number;
  /** seine Eier liegen schon auf dem Stapel der nächsten Generation (Run.next) */
  eggs?: boolean;
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
  /** gesammelte Nahrung, die noch nicht zu Nachwuchs geworden ist – beim Laichen wird daraus Nachwuchs (siehe SPAWN) */
  fed: number;
  /**
   * Was sich im Leben angesammelt hat (Tarnung beim Verstecken, Bodenkontakt beim Laufen am Grund, Färbung im Licht …):
   * Das eigene Tier bleibt, wie es geschlüpft ist – erst die Nachkommen tragen es weiter (siehe inherit).
   */
  drift?: Partial<Record<DriftKey, number>>;
  /** aus älteren Spielständen vorgemerkte Färbung für die Nachkommen */
  coat?: number;
  /** wie grimmig das Tier dreinschaut (fest für dieses Leben; aus der Angriffslust beim Schlüpfen) */
  fierce?: number;
}

/** Was sich im Leben ansammelt und an die Nachkommen geht. */
export type DriftKey = TraitKey | 'light' | 'fin' | 'crest';

export const newLife = (gen: number, age = 0): Life => ({ age, gen, spawns: 0, lastSpawn: -1e9, clutches: [], nextClutch: 1, fed: 0 });

/**
 * Ein Ei aus dem Laich deiner Linie: So wird das Tier, das daraus schlüpft. Seine Merkmale stehen schon beim Laichen fest –
 * die Werte des Elterntiers zur Laichzeit (inherit) mit einer kleinen Streuung (INHERIT.vary). Es schlüpft dort, wo es
 * gelaicht wurde. Gespeichert werden nur die Merkmale, die nicht 0 sind.
 */
export interface RoeEgg {
  generation?: number;
  finMutation?: boolean;
  trace?: FishMark[];
  /** Kennung (im Koop: dieselbe bei allen Spielern) */
  id?: string;
  traits: Partial<Traits>;
  sex: Sex;
  seed: number;
  place: string;
  x: number;
  y: number;
}

/** Wo die Eier liegen: bei den Geschwistern (deine Generation) oder im Laich für die nächste Generation. */
export type RoeGroup = 'pool' | 'next';

/** Die nächste Generation: so ist sie beschaffen – angepasst an die Spielweise der Eltern (zur Laichzeit). */
export interface Heir {
  fishPlan?: { start: Traits; plan: FishPlan };
  /** Grundwerte und Zuwächse vor dem individuellen Wurf jedes Eis. */
  evolution?: { traits: Traits; gains: Gains; fixed?: Gains };
  traits: Traits;
  sex: Sex;
  seed: number;
  /** wie gut die Spielweise zu jeder Evolutionsplatte passte (0 … 1) */
  fit: Record<PlateId, number>;
  /** die Richtung, in die sich die Nachkommen am deutlichsten entwickelt haben (wenn eine herausragt) */
  line?: PlateId;
}

export interface Run {
  waiting?:boolean;
  waitCause?:string;
  fishTrace?: FishMark[];
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
  /** Artgenossen zu Beginn des Zeitalters (ältere Spielstände) */
  kin: number;
  /** Was die Gruppe über dich gelernt hat: Treue der Artgenossen zu Beginn (0..1) */
  social: number;
  /** Der Kopf ist hart genug: Rammen ist freigeschaltet */
  canRam: boolean;
  /** erst zwischen den Zeitaltern freigeschaltet – die Meldung kommt im nächsten Zeitalter */
  ramNew?: boolean;
  /** insgesamt gefressen (in Sättigungs-Einheiten) */
  eaten?: { meat: number; plant: number };
  /** Stand im aktuellen Leben (Ort, Gefressenes, Spielweise …) */
  prog: EpochProg;
  /** das Leben des eigenen Tiers */
  life: Life;
  /**
   * Die Geschwister: Eier deiner Generation, die noch im Laich warten – deine übrigen Leben in dieser Generation (der Urfisch
   * hat keine). Stirbt dein Tier, kann eines davon schlüpfen.
   */
  pool?: RoeEgg[];
  /**
   * Der Laich deiner Generation: Was du und deine Geschwister gelaicht habt, liegt hier zusammen. Daraus schlüpft die nächste
   * Generation – wer sie wählt, kommt nie mehr zur jetzigen zurück (die übrigen Geschwister sind dann fort).
   */
  next?: RoeEgg[];
  /** ältere Spielstände: die Geschwister als Anzahl (beim Laden zu Eiern) */
  siblings?: { n: number; traits: Traits; place: string; x: number; y: number };
  /**
   * Koop: die Generation der gemeinsamen Art (des Laichs, den alle teilen – siehe net/Species.ts). Die Geschwister (pool)
   * gehören zu ihr, der Laich (next) zur nächsten. Ist sie weiter als dein Tier, war ein Artgenosse schneller: Nach deinem
   * Tod geht es nur noch dorthin.
   */
  coopGen?: number;
  /**
   * Was deine Linie gefressen hat – je Ort (Kennung des Ortes → Art → wie viele Tiere). Jedes Tier zählt einmal, auch wenn es
   * aus mehreren Fleischbrocken bestand. Gilt über alle Generationen der Linie; eine neue Linie beginnt leer.
   */
  prey?: Record<string, Record<string, number>>;
  /** wie viel Grünzeug und wie viel Fleisch deine Linie je Ort gefressen hat (Nahrung, nach ihrem Nährwert) */
  diet?: Record<string, { plant: number; meat: number }>;
  history: Ancestor[];
  /** bereits vorhandene Gruppe deiner Art – sie überdauert Orte und Generationen */
  swarm?: Swarm;
  /** Karbon: das Gelege – Jugend, Gefahr, die Eier als Leben, was die Generation getan hat (siehe sim/brood.ts) */
  brood?: Brood;
  /** Karbon: den steilen Gipfel erreicht – das Zeitalter ist gemeistert */
  summit?: boolean;
}

/** Ein Artgenosse deiner Gruppe: eine feste Nummer (sie bestimmt sein Aussehen) und seine Lebenskraft (Anteil, 0 … 1). */
export interface Member {
  id: number;
  hp: number;
}

/**
 * Deine Gruppe: wer von deiner Art mit dir lebt, und ihre Überlebensbilanz.
 * Wer gerufen ist, kommt beim Ortswechsel mit.
 */
export interface Swarm {
  /** die Lebenden */
  members: Member[];
  /** nächste freie Nummer */
  next: number;
  /** gerade bei dir (gerufen) */
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
  /** keiner: die Wurzel eines Zeitalters – sein Urahn, mit dem dort jede Linie beginnt */
  parent: string | null;
  /** das Zeitalter, zu dessen Stammbaum der Knoten gehört (jedes Zeitalter hat seinen eigenen) */
  epoch: number;
  /** Generation: ab der diese Art lebt (bei einem Astende: in der die Linie endete); die Wurzel hat 0 */
  gen?: number;
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
  /** Gegessene Beute und Nahrung über alle Orte und Linien eines Zeitalters. */
  epochFood?: Record<string, { prey: Record<string, number>; plant: number; meat: number }>;
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
  /** Tiere, die man schon gesehen hat (Chronik des Lebens) */
  seen: string[];
  /** das gewählte Zeitalter (dort lebt die laufende Linie bzw. beginnt die nächste) */
  epoch?: number;
  /** die Linien der anderen Zeitalter: Sie ruhen, solange man anderswo lebt (Nummer des Zeitalters → Lauf) */
  parked?: Record<string, Run>;
  /** Laufübergreifende, eindeutige Funde. Alte Muschelwährungen zählen nicht. */
  collection: CollectionState;
  /** Personal played history; independent of shared eggs and trait-signature nodes. */
  lineage: LineageArchive;
  playerId?:string;
  fishBranches?: { id: string; name: string; trace: FishMark[]; extinct?: boolean }[];
}

const KEY = 'evo-save-v3';
/** Spielstand-Platz (?slot=…): Zwei Fenster im selben Browser spielen so zwei verschiedene Fische. */
let slotKey = KEY;
const ZERO: Traits = { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0, spike: 0, green: 0, sand: 0, len: 0, girth: 0, swift: 0, nerve: 0, tox: 0, fang: 0, light: 0, limb: 0, grip: 0, pack: 0, fin: 0, tail: 0, crest: 0, tint: 0, snout: 0, coat: 0, armor: 0, st: 0, bs: 0, vf: 0, sw: 0, fUp: 0, fDown: 0, fSide: 0, fTail: 0 };
export const ZERO_TRAITS: Readonly<Traits> = ZERO;

/** Was im Zeitalter Stück für Stück wächst, setzt sich über die Jahrmillionen fort (verstärkt). */
const AMP: TraitKey[] = ['stealth', 'green', 'sand', 'nerve', 'tox', 'limb'];
/** Was ein Partner an die Nachkommen weitergibt: das Aussehen, nicht Größe, Kost, Robustheit oder die Evolutionsplatten. */
const BLEND_KEYS: (keyof Traits)[] = ['stealth', 'green', 'sand', 'light', 'fin', 'tail', 'crest', 'tint', 'snout', 'fUp', 'fDown', 'fSide', 'fTail'];
/** Merkmale zwischen 0 und 1 (die übrigen reichen von -1 bis 1; Kopfplatte und Wuchs haben eigene Grenzen) */
const UNIT_KEYS = new Set<keyof Traits>(['jaw', 'skull', 'stealth', 'fang', 'limb', 'grip', 'pack', 'armor', 'fUp', 'fDown', 'fSide', 'fTail']);
const range = (k: keyof Traits): [number, number] => (k === 'spike' ? [-1, 0] : k === 'growth' ? [GROWTH_MIN, 1] : UNIT_KEYS.has(k) ? [0, 1] : [-1, 1]);

/** Merkmale zum Speichern (Eier im Laich): nur die, die nicht 0 sind, auf vier Stellen gerundet. */
export function packTraits(t: Traits): Partial<Traits> {
  const o: Partial<Traits> = {};
  for (const [k, v] of Object.entries(t) as [keyof Traits, number][]) if (Math.abs(v) > 1e-5) o[k] = Math.round(v * 1e4) / 1e4;
  return o;
}


/** Name einer erspielten Fähigkeit (wie sie auf den Karten und im Werte-Bildschirm steht). */
export function skillName(k: SkillKey, t: Partial<Traits>) {
  switch (k) {
    case 'jaw': return 'Jaws';
    case 'skull': return (t.spike ?? 0) < -0.25 ? 'Armoured head' : 'Thick skull';
    case 'stealth': return 'Camouflage';
    case 'growth': return 'Growth';
    case 'green': return 'Green camouflage';
    case 'sand': return 'Sand camouflage';
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
//                dafür langsamer und schneller müde
//   Verfolgung – schneller und ausdauernder: lang, schlank, große Schwanzflosse, spitze Schnauze;
//                dafür weniger Lebenskraft, ein schwacher Stoß und ein schwerfälligeres Wenden
//   Schwarm    – (erst, wenn deine Gruppe auf deinen Ruf kommt) Zusammenhalt: Die Gruppe wird größer, stärker und wächst
//                schneller; silbrig, schlank, ein dunkles Längsband. Dafür allein verletzlicher – und die Beute wird geteilt
// ---------------------------------------------------------------------------

export type PlateId = 'st' | 'bs' | 'vf' | 'sw';
export const PLATE_IDS: PlateId[] = ['st', 'bs', 'vf', 'sw'];
export const PLATE_NAME: Record<PlateId, string> = { st: 'Ramming fish', bs: 'Biting fish', vf: 'Pursuit fish', sw: 'Schooling fish' };

/** So viele Punkte sammelt eine Platte höchstens. */
const PLATE_MAX = 4;

/** Wie ausgeprägt eine Platte nach n Punkten ist (0 … 1): Die ersten Punkte zeigen viel, jeder weitere etwas weniger. */
export const plateLevel = (n: number) => 1 - Math.exp(-0.7 * clamp(n, 0, PLATE_MAX));

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
const adultSize = (t: Traits) => clamp(0.7 + 0.62 * t.growth, 0.58, 1.5);
const finPoints = (t: Traits) => clamp(10 + (t.finGain ?? 0), 10, 100);
const staminaPoints = (t: Traits) => FISH_BASE_STAMINA + Math.max(0, t.staminaGain ?? 0);
const scalePoints = (t: Traits) => Math.max(1, (10 * (1 + 2 * (t.armor ?? 0)) + (t.scaleGain ?? 0)) * Math.max(0.1, 1 - (t.lengthGain ?? 0) / 2));

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
    nodes: { root: rootNode(0) },
    run: null,
    lastEnd: null,
    deepest: -1,
    seen: [],
    collection: newCollection(),
    lineage: newLineage(),
  };
}

/** Karbon: die Richtung, in die sich eine Linie am deutlichsten entwickelt hat (Gebiss, Beine, Griff, Schuppen) – oder keine. */
export function karbonLine(t: Partial<Traits>): 'jaw' | 'limb' | 'grip' | 'armor' | undefined {
  let best: 'jaw' | 'limb' | 'grip' | 'armor' | undefined;
  let v = 0.12;
  for (const k of ['jaw', 'limb', 'grip', 'armor'] as const) {
    if ((t[k] ?? 0) > v) {
      v = t[k] ?? 0;
      best = k;
    }
  }
  return best;
}

/** Grobe Einordnung einer Linie – gleiche Signatur im selben Zeitalter = derselbe Ast. */
export function sigOf(cls: ClassId, tIn: Partial<Traits>) {
  const t = full(tIn);
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  // Pederpes: nach der stärksten Richtung und wie weit sie ist (in Vierteln)
  if (cls === 'amphibian') {
    const k = karbonLine(t);
    return `${cls}:${k ? `${k}${Math.floor((t[k] ?? 0) * 4)}` : 'basal'}:${diet}:${t.coat}`;
  }
  return `${cls}:${plateSig(t)}:${diet}:${t.coat}`;
}

/** Die Wurzel des Stammbaums eines Zeitalters (das erste – heute das Devon – hat die alte Wurzel „root“). */
export const rootId = (epoch: number) => (epoch === 0 ? 'root' : `root:${EPOCHS[epoch]?.id ?? epoch}`);

/** Der Urahn eines Zeitalters: Mit ihm beginnt dort jede Linie. */
export function rootNode(epoch: number): TreeNode {
  const cls = EPOCHS[epoch]?.cls ?? 'fish';
  return { id: rootId(epoch), parent: null, epoch, gen: 0, cls, traits: { ...ZERO }, hue: 0, seed: 1, sig: sigOf(cls, ZERO), children: [], runs: 0, last: 0 };
}

const KARBON_NAME = { jaw: 'Odonterpeton mordax', limb: 'Dromerpeton cursor', grip: 'Onycherpeton scansor', armor: 'Lepiderpeton loricatus' };
const GENUS_ROOT: Record<ClassId, string> = { fish: 'ichthys', amphibian: 'batrachus', reptile: 'saurus', mammal: 'therium' };
const GENUS_PRE: Record<string, string> = { basal: 'Prot', st: 'Placo', bs: 'Odont', vf: 'Drom', sw: 'Agel' };
const EPITHET: Record<string, string> = { herb: 'phytophagus', omni: 'vulgaris', carn: 'carnivorus' };

/** Ein wissenschaftlich klingender Name für eine Linie (nur im Stammbaum zu sehen). */
export function speciesName(n: Pick<TreeNode, 'cls' | 'traits' | 'epoch'> & { parent?: string | null }) {
  if (n.parent === null || n.epoch < 0) return 'The ancestor';
  const t = full(n.traits);
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  // Pederpes und seine Nachfahren: nach der Richtung, in die sie sich am deutlichsten entwickelt haben
  if (n.cls === 'amphibian') {
    const k = karbonLine(t);
    return k ? KARBON_NAME[k] : 'Pederpes finneyae';
  }
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
export interface PlayStyle extends FishEffort {
  defeats?: Defeats;
  distance?: number;
  /** Sekunden in der Tiefe (deepK über SIGHT.trainFrom) – daraus wächst die Sicht der Nachkommen */
  deepTime?: number;
  /** Sekunden im Strömungsschub (Tempo der Nachkommen), dazu Sekunden Sprint bzw. Stoß im Schub */
  flowTime?: number;
  depthTime?: number;
  waterTime?: number;
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
  /** Sekunden nahe am Tod (wenig Lebenskraft) – je länger, desto mehr Schuppen für die Nachkommen */
  danger?: number;
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

export const newStyle = (): PlayStyle => ({ ram: 0, hunt: 0, chase: 0, swim: 0, pack: 0, hurt: 0, up: 0, down: 0, fwd: 0, turns: 0, hab: {}, best: {}, defeats: {}, distance: 0, depthTime: 0, waterTime: 0 });

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
  /** Das gerade beendete Leben – damit Anzeigen bis zum Szenenwechsel weiterlaufen können. */
  private ghost: Run | null = null;
  /** Gewicht und Werte des ersten Fischs (Bezug für die Laich-Schwelle und den Grundwert der Nachkommen) */
  private g0?: number;
  private s0?: Stats;
  /** Karbon: der erste Pederpes (ausgewachsen, ohne Merkmale) – an ihm messen sich Gebiss und die Eier */
  private a0?: Stats;

  load(slot?: string | null) {
    const s = (slot ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16);
    slotKey = s ? `${KEY}-${s}` : KEY;
    try {
      const raw = localStorage.getItem(slotKey);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const removedLegacy = removeLegacyShells(d);
        const f = fresh();
        this.data = { ...f, ...d, nodes: { ...f.nodes, ...d.nodes } } as SaveData;
        this.data.collection = readCollection(d.collection);
        this.data.lineage = readLineage(d.lineage);
        this.data.fishBranches=Array.isArray(d.fishBranches)?d.fishBranches:[];
        this.data.seen = Array.isArray(d.seen) ? d.seen.filter((id) => typeof id === 'string') : [];
        for (const n of Object.values(this.data.nodes)) n.traits = migrate(n.traits);
        // Früher hing alles an einem Urahn vor dem ersten Zeitalter – heute hat jedes Zeitalter seinen eigenen; das erste
        // (Nummer 0, früher das Ordovizium, heute das Devon) übernimmt den alten. Astenden kennen ihre Generation (ältere Spielstände: so viele, wie die Linie lebte)
        const root = this.data.nodes.root;
        if (root && (root.epoch < 0 || root.gen === undefined)) Object.assign(root, { epoch: 0, gen: 0, sig: sigOf(root.cls, ZERO) });
        for (const n of Object.values(this.data.nodes)) if (n.parent !== null) n.gen ??= n.dead?.gens ?? 1;
        // Nur noch die Fischzeit: alles, was dahinter lag, wird verworfen
        this.prune();
        let fishFormsChanged=false;
        for (const r of [this.data.run, ...Object.values(this.data.parked ?? {})]) {
          if (!r) continue;
          r.prog ??= newProg(r.epoch);
          r.prog.train ??= newStyle();
          r.prog.eaten ??= { meat: 0, plant: 0 };
          // ältere Spielstände kennen kein Alter: Wer schon unterwegs war, ist ausgewachsen
          r.life ??= newLife(r.history.length + 1, phases(r.history.length + 1).mature);
          r.life.clutches ??= [];
          // ältere Spielstände: Geschwister als Anzahl, befruchtete Gelege ohne Eier – sie werden zu Eiern im Laich (so, wie
          // das Tier jetzt ist: ohne Streuung)
          if (r.siblings) {
            const sb = r.siblings;
            r.pool = Array.from({ length: sb.n }, () => ({ traits: packTraits(full({ ...sb.traits })), sex: newSex(), seed: Math.floor(Math.random() * 100000), place: sb.place, x: sb.x, y: sb.y }));
            r.siblings = undefined;
          }
          for (const c of r.life.clutches) {
            if (!c.fert || c.eggs || r.brood) continue;
            c.eggs = true;
            for (let i = 0; i < Math.max(1, c.young ?? 1); i++) (r.next ??= []).push({ traits: packTraits(full({ ...r.traits })), sex: newSex(), seed: Math.floor(Math.random() * 100000), place: c.place, x: c.x, y: c.y });
          }
          // ältere Spielstände zählen die Nahrung nicht: so viel, wie ein Tier bis zu diesem Alter etwa frisst
          r.life.fed ??= Math.round(r.life.age * 0.4);
          // Leben sind kürzer geworden: Wer nach heutiger Rechnung schon am Ende wäre, ist wieder alt (und kann noch laichen)
          // – sonst bleibt das Alter, wie es war
          if (r.life.age > phases(r.life.gen).span - 20) r.life.age = phases(r.life.gen).old;
          // Abgelöste Aufgaben und Sonderereignisse dürfen beim Laden nicht zurückkehren.
          const legacy = r as Run & { quests?: unknown; hunt?: unknown; walls?: unknown; coatSet?: unknown };
          delete legacy.quests;
          delete legacy.hunt;
          delete legacy.walls;
          delete legacy.coatSet;
          delete (r.prog as EpochProg & { boss?: unknown }).boss;
          // Bereits vorhandene Gruppen bleiben erhalten und brauchen keinen Questabschluss mehr.
          if (r.swarm) r.swarm.callable = true;
          r.prog.known ??= [...r.prog.seen];
          if (EPOCHS[r.epoch].id === 'devon') {
            const mapPlace = (id: string) => placeOf(EPOCHS[r.epoch], id).id;
            r.prog.place = mapPlace(r.prog.place);
            r.prog.known = [...new Set(r.prog.known.map(mapPlace))];
            r.prog.seen = [...new Set(r.prog.seen.map(mapPlace))];
            r.prog.links = [...new Set((r.prog.links ?? []).map((link) => {
              const [a, b] = link.split('|').map(mapPlace);
              return a !== b ? linkKey(a, b) : '';
            }).filter(Boolean))];
            for (const egg of [...r.pool ?? [], ...r.next ?? []]) egg.place = mapPlace(egg.place);
            for (const clutch of r.life.clutches) clutch.place = mapPlace(clutch.place);
          }
          // Orte aus einer älteren Karte, die es nicht mehr gibt
          r.prog.known = r.prog.known.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          r.prog.seen = r.prog.seen.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          if (!placesOf(EPOCHS[r.epoch]).some((p) => p.id === r.prog.place)) r.prog = newProg(r.epoch);
          // ältere Spielstände kennen nur Orte, keine Wege: Wer zwei benachbarte Orte kennt, kennt auch den Weg dazwischen
          r.prog.links ??= placesOf(EPOCHS[r.epoch]).flatMap((p) =>
            r.prog.known.includes(p.id) ? p.links.filter((q) => q > p.id && r.prog.known.includes(q)).map((q) => linkKey(p.id, q)) : []);
          r.traits = migrate(r.traits);
          for (const a of r.history) a.traits = migrate(a.traits);
          // früher gab es auch Stachelköpfe – heute wird ein viel benutzter Kopf zum Panzer
          r.traits.spike = -Math.abs(r.traits.spike);
          fishFormsChanged=this.repairFishRun(r)||fishFormsChanged;
          const current=Math.max(r.life.gen,r.coopGen??0);
          r.pool=(r.pool??[]).filter(e=>(e.generation??current)===current);
          r.next=(r.next??[]).filter(e=>(e.generation??current+1)===current+1);
          r.social ??= 0.55;
          r.canRam = true;
          // vorerst schlüpft man immer als Männchen – auch ein Weibchen aus einem älteren Spielstand wird zu einem
          if (SPAWN.alwaysMale) r.sex = 1;
        }
        this.data.epoch = isPlayable(this.data.epoch ?? -1) ? this.data.epoch : this.data.run && isPlayable(this.data.run.epoch) ? this.data.run.epoch : firstPlayable();
        const lineageBefore = this.data.lineage.runs.length;
        // A legacy run can only be observed from now on; no generation-based dates are invented.
        for (const r of [this.data.run, ...Object.values(this.data.parked ?? {})]) {
          if (r && !this.data.lineage.runs.some(j => j.id === r.id)) this.recordLineageBirth(r, r.brood?.nest ?? { place: startPlace(EPOCHS[r.epoch]).id, x: 0, y: 0 }, true);
        }
        this.migrateLineageEnds();
        // Die alte Währung und alle gekauften/goldenen Segen sofort auch auf Platte entfernen.
        if (fishFormsChanged || removedLegacy || !d.lineage || this.data.lineage.runs.length !== lineageBefore) this.save();
      }
    } catch {
      this.data = fresh();
    }
  }

  /** Knoten und Läufe aus den Zeitaltern, die es nicht mehr gibt, entfernen. */
  private prune() {
    const d = this.data;
    const bad = new Set<string>();
    for (const n of Object.values(d.nodes)) if (n.epoch >= EPOCHS.length || n.cls !== EPOCHS[n.epoch].cls) bad.add(n.id);
    // Jeder Stammbaum gehört zu einem Zeitalter: Äste, die früher von einem Zeitalter ins nächste führten, fallen weg – samt
    // allem, was daran hing
    for (let grew = true; grew; ) {
      grew = false;
      for (const n of Object.values(d.nodes)) {
        if (bad.has(n.id) || n.parent === null) continue;
        const p = d.nodes[n.parent];
        if (!p || bad.has(p.id) || p.epoch !== n.epoch) {
          bad.add(n.id);
          grew = true;
        }
      }
    }
    if (bad.size) {
      for (const id of bad) delete d.nodes[id];
      for (const n of Object.values(d.nodes)) n.children = n.children.filter((c) => !bad.has(c));
      if (d.lastEnd && !d.nodes[d.lastEnd]) d.lastEnd = null;
    }
    d.deepest = Math.min(d.deepest, EPOCHS.length - 1);
    const ok = (r: Run) => !!EPOCHS[r.epoch] && r.cls === EPOCHS[r.epoch].cls && !!d.nodes[r.node];
    if (d.run && !ok(d.run)) d.run = null;
    // Eine Linie in einem Zeitalter, in dem man gerade nicht leben kann (das Devon ruht im Gestein, seit das Perm der Prototyp
    // ist), ruht dort, statt verloren zu gehen – sie lebt weiter, sobald das Zeitalter wieder spielbar ist.
    if (d.run && !isPlayable(d.run.epoch)) {
      d.parked ??= {};
      d.parked[d.run.epoch] ??= d.run;
      d.run = null;
    }
    for (const [k, r] of Object.entries(d.parked ?? {})) if (!ok(r) || Number(k) !== r.epoch || r.epoch === d.run?.epoch) delete d.parked![k];
  }

  save() {
    removeLegacyShells(this.data);
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

  /** Das gewählte Zeitalter: Dort lebt die laufende Linie – oder beginnt die nächste. */
  get chosenEpoch(): number {
    return this.data.run?.epoch ?? this.data.epoch ?? firstPlayable();
  }

  /** Die Linie eines Zeitalters: die laufende oder die, die dort ruht, während man anderswo lebt. */
  runIn(epoch: number): Run | null {
    const r = this.data.run;
    if (r && r.epoch === epoch) return r;
    return this.data.parked?.[epoch] ?? null;
  }

  /**
   * In ein anderes Zeitalter wechseln (nur spielbare): Die Linie des alten ruht dort, bis man zurückkehrt; die des neuen –
   * falls es dort schon eine gibt – lebt weiter.
   */
  enterEpoch(epoch: number) {
    const d = this.data;
    if (!isPlayable(epoch)) return;
    d.epoch = epoch;
    if (d.run?.epoch !== epoch) {
      d.parked ??= {};
      if (d.run) d.parked[d.run.epoch] = d.run;
      d.run = d.parked[epoch] ?? null;
      delete d.parked[epoch];
      this.ghost = null;
    }
    this.save();
  }

  /** Der Urahn eines Zeitalters (die Wurzel seines Stammbaums) – wird beim ersten Mal angelegt. */
  rootOf(epoch: number): TreeNode {
    const id = rootId(epoch);
    return (this.data.nodes[id] ??= rootNode(epoch));
  }

  /** Eine neue Linie beginnt – als frisch geschlüpftes Tier am Urahn des Zeitalters. */
  newRun(epoch = this.chosenEpoch): Run {
    const d = this.data;
    if (!isPlayable(epoch)) epoch = firstPlayable();
    d.runs += 1;
    const root = this.rootOf(epoch);
    const ep = EPOCHS[epoch];
    const run: Run = {
      id: d.runs,
      cls: ep.cls === 'amphibian' ? 'amphibian' : 'fish',
      traits: { ...ZERO },
      aggression: 0,
      infamy: 0,
      hue: Math.floor(Math.random() * 4),
      seed: Math.floor(Math.random() * 100000),
      sex: newSex(),
      epoch,
      node: root.id,
      kin: 0,
      social: 0.55,
      // der Stoß geht von Anfang an (stark wird er erst mit einem harten Kopf)
      canRam: true,
      prog: newProg(epoch),
      life: newLife(1),
      history: [],
    };
    // Karbon: ein Gelege mit lauter Grundwerten im Brutsumpf (wo genau, weiß erst der Ort – siehe LevelScene)
    if (ep.brood) run.brood = newBrood(0, noGenes(), { place: startPlace(ep).id, x: 0, y: 0 }, 1 + Math.floor(Math.random() * 1e6));
    d.run = run;
    d.epoch = epoch;
    this.ghost = null;
    root.runs += 1;
    root.last = run.id;
    this.recordLineageBirth(run, run.brood?.nest ?? { place: startPlace(ep).id, x: 0, y: 0 });
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
    const adult = adultSize(t);
    const size = adult * k.grow;
    const carn = Math.max(0, t.diet), herb = Math.max(0, -t.diet);
    // die Kopfplatte des Stoßfischs: ein gepanzerter, harter Schädel
    const plates = Math.max(0, -(t.spike ?? 0)) * t.skull;
    // Körperrobustheit: robuste Schuppen bzw. ein Schuppenpanzer – unabhängig von der Kopfplatte
    const armor = t.armor ?? 0;
    const girth = t.girth ?? 0;
    // Pederpes (Karbon) lebt an Land und im Wasser: Beine und Griff bremsen beim Schwimmen, Beine machen an Land schneller,
    // ein Schuppenpanzer an Land langsamer (die Zahlen in data/karbon.ts)
    const amph = cls === 'amphibian';
    const land = CLASSES[cls].habitat === 'land' && !amph;
    const limb = t.limb ?? 0;
    const grip = t.grip ?? 0;
    const swimMul = amph ? 1 - KTRAIN.swimLimb * limb - KTRAIN.swimGrip * grip : 1;
    // Jungtiere beißen und stoßen schwächer – aber nicht ganz so schwach, wie ihre Größe vermuten ließe
    const force = adult * Math.pow(k.grow, 0.6);
    const bite = Math.max(0.1, b.bite * force * (1 + 3.6 * Math.pow(t.jaw, 1.1)) * (1 + 0.6 * (t.fang ?? 0))
      + b.bite * 0.07 * (t.biteGain ?? 0) * Math.pow(k.grow, 0.6));
    const ram = Math.max(0.1, b.ram * force * (1 + 4 * t.skull) * (1 + 0.5 * plates) * (1 + 0.15 * girth)
      + b.ram * 0.07 * (t.ramGain ?? 0) * Math.pow(k.grow, 0.6));
    // Dieselbe Skala wie der Schädelwert in der Übersicht, ohne Rundung und mit dem Urahn der Körperklasse als Bezug.
    const skullScore = 10 * ram / (b.ram * adultSize(ZERO));
    const length = t.lengthGain ?? 0, mass = t.massGain ?? 0;
    const bodySpeed = (1 + MOVEMENT.lengthSpeed * length) * Math.max(0.1, 1 - mass / 2);
    const fins = Math.max(0.1, 1 + (t.finGain ?? 0) / 10);
    // Beim Startfisch erweitern Flossen die Ausdauerreserve statt das Schwimmtempo.
    const finSpeed = cls === 'fish' ? 1 : Math.max(0.1, 1 + MOVEMENT.finPerPoint * (t.finGain ?? 0));
    const maturity = clamp((k.grow - LIFE.hatch) / Math.max(0.001, LIFE.adult - LIFE.hatch), 0, 1);
    const speedGrowth = MOVEMENT.hatchSpeed + (1 - MOVEMENT.hatchSpeed) * maturity;
    // Die kleinere Körpergröße darf Jungtiere nicht über das ausgewachsene Generationstempo hinaus beschleunigen.
    const sizeDrag = 1.12 - 0.14 * adult;
    const scaleBase = 10 * (1 + 2 * armor);
    const baseHp = b.hp * Math.pow(adult, 1.3) * (1 + 0.25 * t.skull + 0.2 * plates) * (1 + 0.16 * girth + 0.05 * (t.len ?? 0)) * (1 + 0.15 * armor);
    // Dauerhaft vererbte Lebenskraft lässt den Körper etwas mitwachsen; aktuelle Verletzungen und Alter zählen hier nicht.
    const vitalitySize = Math.pow(Math.max(1, (baseHp + (t.vitality ?? 0)) / Math.max(1, baseHp)), INHERIT.vitalitySize);
    const body = (1 + 0.14 * (t.swift ?? 0) + 0.05 * (t.len ?? 0) - 0.07 * girth);
    // Verfolgungsfische halten lange durch – das zeigt ihr Körperbau allein nicht
    const chase = plateLevel(t.vf ?? 0);
    // Schwarmfische sind allein verletzlicher: Ihre Stärke ist die Gruppe
    const school = plateLevel(t.sw ?? 0);
    const stats: Stats = {
      // Jungtiere sind verletzlich, aber nicht ganz so sehr, wie ihre Größe vermuten ließe; im Alter lässt die Kraft nach
      maxHp: Math.max(3, Math.round((baseHp + (t.vitality ?? 0)) * Math.pow(k.grow, 0.8) * (1 - 0.12 * school) * (1 - LIFE.oldHp * k.old))),
      bite,
      ram,
      ramStun: 1000 + 1000 * clamp((skullScore - 10) / 90, 0, 1),
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2) * (1 - 0.6 * plates),
      // Kompromisse: Wer ein starkes Gebiss, einen harten Kopf oder einen Schuppenpanzer hat, schwimmt dafür langsamer
      speed: b.speed * (1 + 0.38 * t.stealth) * sizeDrag * body * (land ? 1 + 0.14 * limb : 1) * swimMul
        * (1 - 0.1 * Math.pow(t.jaw, 0.9) - 0.05 * t.skull - 0.02 * (t.fang ?? 0) - 0.05 * armor) * (1 - LIFE.oldSpeed * k.old) * bodySpeed * speedGrowth * (cls === 'fish' ? 1 : Math.max(0.5, 1 - MOVEMENT.endSpeed * (t.endGain ?? 0))),
      jump: b.jump * (1 + 0.12 * t.stealth) * (1 + 0.1 * limb),
      // Vererbte Lebenskraft beeinflusst den Körper; keine käuflichen Boni.
      size: size * vitalitySize,
      defense: clamp((1 - 0.28 * t.skull - 0.12 * plates - 0.08 * (size - 1) - 0.24 * armor) * scaleBase / scalePoints(t) / (1 + mass), 0.05, 2),
      groundSpeed: 0.7 + 0.6 * limb,
      power: bite * 0.6 + ram * 0.4,
      // große Fische fallen früher auf – kleine Beute ist dann längst auf und davon
      detect: (1 - 0.55 * t.stealth) * (0.8 + 0.25 * size),
      // Kost: Wer Fleisch frisst, holt mehr aus Fleisch (und weniger aus Pflanzen) – und umgekehrt
      digestMeat: Math.max(0.35, 1 + 0.6 * carn - 0.6 * herb),
      digestPlant: Math.max(0.35, 1 + 0.6 * herb - 0.6 * carn),
      // Startfisch: Reserve nur aus Flossen, bei Jungtier und ausgewachsen gleich.
      // Andere Körperklassen behalten ihre bisherigen Ausdauer-Kompromisse.
      endurance: cls === 'fish' ? fishStaminaMax(staminaPoints(t)) : clamp(1 + 0.3 * chase - 0.12 * t.jaw - 0.08 * t.skull - 0.05 * armor - 0.18 * Math.max(0, adult - 1) - 0.12 * (t.swift ?? 0) + 0.12 * Math.max(0, -girth)
        + MOVEMENT.finEndurance * (t.finGain ?? 0) + MOVEMENT.endPerPoint * (t.endGain ?? 0), 0.5, 1.9) * (1 - LIFE.oldEndurance * k.old),
      recover: clamp(1 + 0.2 * chase - 0.1 * t.jaw - 0.04 * armor - 0.12 * Math.max(0, adult - 1), 0.55, 1.6) * (1 - LIFE.oldRecover * k.old),
      // Flossen, die aus der Bewegung gewachsen sind: schneller nach oben, nach unten, nach vorn – und wendiger
      climb: (1 + 0.45 * (t.fUp ?? 0)) * finSpeed,
      dive: (1 + 0.45 * (t.fDown ?? 0)) * finSpeed,
      cruise: (1 + 0.3 * (t.fTail ?? 0)) * finSpeed,
      // kleine, kurze Fische wenden schnell, große und lange schwerfällig
      agility: clamp(fins + 1.1 * (t.fSide ?? 0) - 0.14 * (t.len ?? 0) - 0.22 * (size - 0.8), 0.6, 2.4),
      upkeep: 1 + 0.3 * armor + 0.15 * Math.max(0, girth),
      // Schuppenpanzer: Treffer werfen einen weniger weit zurück
      knock: clamp(1 - 0.55 * armor - 0.15 * plates, 0.35, 1),
      // an Land: langsamer als im Wasser (ein Jungtier mit Kiemen kriecht nur), mit kräftigen Beinen schneller
      landSpeed: b.speed * 0.62 * sizeDrag * (1 + KTRAIN.landLimb * limb) * (1 - KTRAIN.landArmor * armor) * speedGrowth,
      slope: maxSlope(limb, grip),
    };
    if(cls === 'fish') {
      const baseSize=adultSize(ZERO), baseHp=Math.round(b.hp*Math.pow(baseSize,1.3));
      const hp=baseHp+Math.max(0,t.vitality??0), grow=Math.pow(k.grow,.6);
      const form=resolveStarterForm([10+Math.max(0,t.biteGain??0),finPoints(t),10+Math.max(0,t.ramGain??0)],t.fishForm,t.fishPrimary);
      const [,,skullTier]=STARTER_FORMS[form];
      stats.maxHp=Math.max(3,Math.round(hp*Math.pow(k.grow,.8)*(1-LIFE.oldHp*k.old)));
      stats.size=baseSize*Math.cbrt(hp/baseHp)*k.grow;
      stats.bite=b.bite*baseSize*(10+Math.max(0,t.biteGain??0))/10*grow;
      stats.ram=b.ram*baseSize*(10+Math.max(0,t.ramGain??0))/10*grow;
      stats.ramStun=skullTier>=3?2000:skullTier>=2?1000:0;
      stats.ramSelf=b.ram*.55/(1+skullTier);
      stats.speed=b.speed*(1.12-.14*baseSize)*fishFinSpeed(finPoints(t));
      stats.cruise=stats.climb=stats.dive=1;
      stats.agility=1; stats.recover=1;
      stats.endurance=fishStaminaMax(staminaPoints(t));
      stats.defense=1/(1+Math.max(0,t.scaleGain??0)*.025+skullTier*.08);
      stats.digestMeat=stats.digestPlant=1;
      stats.power=stats.bite*.6+stats.ram*.4;
      stats.upkeep=1;
      // an Land (Ufersumpf): robben statt laufen – langsam, mit einem kleinen Satz aus dem Wasser
      stats.landSpeed=stats.speed*FISH_LAND.speed;
      stats.jump=FISH_LAND.jump;
    }
    return stats;
  }

  /** Das Aussehen zu einer Form und ihren Merkmalen. */
  morph(o: { cls?: ClassId; traits?: Traits; belly?: number; fierce?: number; hue?: number; seed?: number; sex?: number; life?: LifeK } = {}): Morph {
    const run = this.data.run;
    const cls = o.cls ?? run?.cls ?? 'fish';
    // das eigene Tier bleibt sein Leben lang, wie es geschlüpft ist – es wächst nur heran und altert
    const t = o.traits ?? run?.traits ?? ZERO;
    const grown = this.stats(cls, t, ADULT);
    const biteScore = Math.round(10 * grown.bite / (CLASSES[cls].base.bite * adultSize(ZERO)));
    const fishForm = cls === 'fish' ? resolveStarterForm(this.starterScores(t), t.fishForm, t.fishPrimary) : undefined;
    return {
      cls,
      fishForm,
      finColor: cls === 'fish' ? clamp((t.staminaGain??0)/70,0,1) : 0,
      scaleShade: cls === 'fish' ? clamp((t.scaleGain??0)/60,0,1) : 0,
      size: this.stats(cls, t, o.life ?? (o.traits ? ADULT : this.lifeK)).size,
      jaw: clamp(t.jaw + (t.biteGain ?? 0) / 35, 0, 1),
      skull: clamp(t.skull + (t.ramGain ?? 0) / 40, 0, 1),
      stealth: t.stealth,
      diet: t.diet,
      scars: t.scars,
      spike: t.spike ?? 0,
      green: t.green ?? 0,
      sand: t.sand ?? 0,
      len: clamp((t.len ?? 0) + (t.lengthGain ?? 0), -1, 1),
      girth: clamp((t.girth ?? 0) + (t.massGain ?? 0), -1, 1),
      swift: t.swift ?? 0,
      fang: t.fang ?? 0,
      toothTier: Math.max(0, Math.floor((biteScore - 10) / 10)),
      light: t.light ?? 0,
      limb: t.limb ?? 0,
      grip: t.grip ?? 0,
      // Karbon: Das Jungtier ist eine Larve mit Kiemenbüscheln – bis zur Metamorphose
      gills: !o.traits && run?.brood?.phase === 'young' ? 1 : 0,
      fin: clamp((t.fin ?? 0) + (t.finGain ?? 0) / 20, -1, 1),
      tail: t.tail ?? 0,
      // der Rückenkamm wächst mit der Ausdauer aus weiten Strecken
      crest: clamp((t.crest ?? 0) + (t.endGain ?? 0) / 20, -1, 1),
      tint: t.tint ?? 0,
      cb: t.cb ?? 0,
      cf: t.cf ?? 0,
      cp: t.cp ?? 0,
      snout: t.snout ?? 0,
      coat: t.coat ?? 0,
      armor: clamp((t.armor ?? 0) + (t.scaleGain ?? 0) / 20, 0, 1),
      st: t.st ?? 0,
      bs: t.bs ?? 0,
      vf: t.vf ?? 0,
      sw: t.sw ?? 0,
      fUp: t.fUp ?? 0,
      fDown: t.fDown ?? 0,
      fSide: t.fSide ?? 0,
      fTail: t.fTail ?? 0,
      eye: t.sightGain ?? 0,
      belly: o.belly ?? 1,
      fierce: o.fierce ?? (run ? (run.life.fierce ?? this.fear()) : 0),
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
    const t = run.traits;
    const sex: Sex = (i + run.id) % 2 ? 1 : 2;
    const traits: Traits = {
      ...t,
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
      grip: j(t.grip ?? 0, 0.06),
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
    return { cm: cm * (1 + (t.lengthGain ?? 0)), g: g * (1 + (t.massGain ?? 0)) };
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

  /** Die Werte des ersten Fischs neu bestimmen (nach einer Änderung in der Entwickler-Einstellung). */
  forgetBaseline() {
    this.g0 = undefined;
    this.s0 = undefined;
    this.a0 = undefined;
  }

  /** Gewicht des ausgewachsenen eigenen Tiers im Verhältnis zum ersten Fisch (dem Urfisch an der Wurzel). */
  weight(): number {
    this.g0 ??= this.measure('fish', ZERO, ADULT).g;
    return this.measure(this.r.cls, this.r.traits, ADULT).g / this.g0;
  }

  /**
   * Wie viel besser das ausgewachsene eigene Tier ist als der erste Fisch: die Verbesserungen bei Biss, Stoß, Schwimmtempo,
   * Lebenskraft, Ausdauer und Zähigkeit zusammengezählt (0,25 = etwa das Gebiss 25 % stärker). Verschlechterungen – der
   * Preis eines Kompromisses – ziehen nichts ab.
   */
  gain(): number {
    const a = this.stats(this.r.cls, this.r.traits, ADULT);
    const b = (this.s0 ??= this.stats('fish', ZERO, ADULT));
    const up = (x: number, y: number) => Math.max(0, x / Math.max(1e-6, y) - 1);
    return up(a.bite, b.bite) + up(a.ram, b.ram) + up(a.speed * a.cruise, b.speed * b.cruise) + up(a.maxHp, b.maxHp)
      + up(a.endurance, b.endurance) + up(b.defense, a.defense);
  }

  /** So viel Nahrung braucht ein Nachkomme des eigenen Tiers (der Grundwert – je weiter entwickelt, desto mehr). */
  get broodBase(): number {
    return broodBase(this.gain());
  }

  /** Gefressen: Es nährt die Brut (Hunger gibt es nicht). */
  feed(units: number) {
    if (units > 0) this.r.life.fed += units;
  }

  /** So viele Nachkommen hat das eigene Tier schon – zusammen in allen befruchteten Gelegen. */
  get young(): number {
    let n = 0;
    for (const c of this.r.life.clutches) if (c.fert) n += c.young ?? 1;
    return n;
  }

  /**
   * Laichen: Die gesammelte Nahrung wird zu Nachwuchs – so viele, wie sie hergibt (höchstens bis SPAWN.maxYoung); der Rest
   * bleibt für das nächste Mal. Gibt die Zahl zurück.
   */
  takeYoung(): number {
    const L = this.r.life, base = this.broodBase;
    const n = Math.min(youngOf(L.fed, base), Math.max(0, SPAWN.maxYoung - this.young));
    L.fed = Math.max(0, L.fed - n * base);
    return n;
  }

  /** Das Leben des eigenen Tiers. */
  get life(): Life {
    return this.r.life;
  }

  /** Wie weit das eigene Tier gewachsen und gealtert ist. */
  get lifeK(): LifeK {
    // im Karbon wächst man mit der Nahrung bis zur Metamorphose (und altert nicht – das Gelege bestimmt das Leben)
    const b = this.r.brood;
    if (b) return { grow: growOf(b), old: 0 };
    return lifeK(this.r.life.age, this.r.life.gen);
  }

  /** Zeit vergeht für das eigene Tier (Sekunden aktiven Lebens – wer nicht spielt, altert nicht). */
  ageBy(dt: number) {
    this.r.life.age += dt;
    const r = this.r, ep = EPOCHS[r.epoch];
    observeLineage(this.data.lineage.runs.find(j => j.id === r.id), worldYears(ep.from, ep.to), dt);
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

  /** Gelaicht: Vor dem nächsten Mal vergeht eine Weile (SPAWN.cooldown). */
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

  /** Wartende Eier der aktuellen gemeinsamen Generation. */
  get playerId(){return this.data.playerId??=eggId();}
  waitForEgg(cause:string) {
    const run=this.r;run.waiting=true;run.waitCause=cause;
    const branch=this.data.fishBranches?.find(b=>b.id===`local-${run.id}`);if(branch)branch.extinct=true;
    this.save();
  }

  get pool(): RoeEgg[] {
    return this.data.run?.pool ?? [];
  }

  /**
   * Die aktuelle gemeinsame Generation (pool), im Koop gegebenenfalls weiter als
   * dein eigenes Tier. Der Laich (roe) gehört zur nächsten.
   */
  get poolGen(): number {
    const run = this.data.run;
    return run ? Math.max(run.life.gen,run.coopGen??0) : 1;
  }

  /** Der Laich für die nächste Generation – von dir und deinen Geschwistern zusammen (siehe Run.next). */
  get roe(): RoeEgg[] {
    return this.data.run?.next ?? [];
  }

  /**
   * Laich befruchtet: So viele Eier, wie im Gelege stecken, kommen auf den Stapel der nächsten Generation – jedes so, wie
   * es das Elterntier zur Laichzeit weitergibt (h, siehe inherit), mit einer kleinen Streuung. Was Geschwister laichen,
   * kommt dazu. Gibt die neuen Eier zurück.
   */
  layEggs(c: Clutch, h: Heir): RoeEgg[] {
    const run = this.r;
    if (c.eggs) return [];
    c.eggs = true;
    const out: RoeEgg[] = [];
    for (let i = 0; i < Math.max(1, c.young ?? 1); i++) {
      const fish=h.fishPlan?this.fishOffspring(h.fishPlan.start,h.fishPlan.plan):undefined;
      const traits=fish?.traits??driftColors(h.evolution ? this.applyEvolution(h.evolution.traits,h.evolution.gains,Math.random,h.evolution.fixed):h.traits);
      const e:RoeEgg={id:eggId(),traits:packTraits(traits),sex:newSex(),seed:Math.floor(Math.random()*100000),place:c.place,x:c.x,y:c.y,
        generation:run.life.gen+1,...(fish?{finMutation:fish.mutation,trace:appendFishMark(run.fishTrace,traits.fishForm??0,traits.fishPrimary??0)}:{})};
      out.push(e);
    }
    // die Eier gehören zur Generation nach deiner: Im Koop kann das schon die der Geschwister sein (ein Artgenosse war
    // schneller) – oder eine vergangene, in die kein Weg mehr zurückführt
    const g = run.life.gen + 1;
    if(g===this.poolGen)(run.pool??=[]).push(...out);
    else if(g===this.poolGen+1)(run.next??=[]).push(...out);
    this.save();
    // im Koop: an die gemeinsame Art (net/Species.ts)
    bus.emit('roeLaid', g, out);
    return out;
  }

  /**
   * Koop: der gemeinsame Laich, wie ihn der Server meldet – er ersetzt den eigenen (die Geschwister der Generation gen und
   * der Laich der nächsten).
   */
  syncShared(gen: number, pool: RoeEgg[], next: RoeEgg[]) {
    const run = this.data.run;
    if (!run || run.brood) return;
    run.coopGen = gen;
    const eggs=[...pool,...next];
    if(run.cls==='fish')for(const egg of eggs)this.repairFishEgg(egg);
    run.pool=pool.filter(e=>(e.generation??gen)===gen);
    run.next=next.filter(e=>(e.generation??gen+1)===gen+1);
    this.save();
  }

  private repairFishAppearance(t:Partial<Traits>,trace?:FishMark[]) {
    const scores=this.starterScores(full({...t}));
    const form=resolveStarterForm(scores,t.fishForm,t.fishPrimary),[g,,k]=STARTER_FORMS[form];
    const primary=t.fishPrimary===1||t.fishPrimary===3?t.fishPrimary:g||k?(g>k||g===k&&scores[0]>=scores[2]?1:3):0;
    const changed=(t.fishForm??0)!==form||(t.fishPrimary??0)!==primary;
    if(changed){t.fishForm=form;t.fishPrimary=primary;}
    return {changed,trace:appendFishMark(trace,form,primary)};
  }
  private repairFishEgg(egg:RoeEgg) {
    const repaired=this.repairFishAppearance(egg.traits,egg.trace);egg.trace=repaired.trace;return repaired.changed;
  }
  private repairFishRun(run:Run) {
    if(run.cls!=='fish')return false;
    const repaired=this.repairFishAppearance(run.traits,run.fishTrace);run.fishTrace=repaired.trace;
    let changed=repaired.changed;
    for(const egg of [...(run.pool??[]),...(run.next??[])])changed=this.repairFishEgg(egg)||changed;
    const branch=this.data.fishBranches?.find(b=>b.id===`local-${run.id}`);if(branch)branch.trace=run.fishTrace;
    return changed;
  }

  private starterScores(t: Traits): StarterScores {
    return [10+Math.max(0,t.biteGain??0),finPoints(t),10+Math.max(0,t.ramGain??0)];
  }

  private fishOffspring(start: Traits, plan: FishPlan, random = Math.random, preview = false) {
    const {gains:g,mutation}=fishBirthGains(plan,random,preview);
    const t=full({...start});
    if(mutation){
      const before=this.starterScores(start),fins=Math.min(100,before[1]+5);
      const stages=[...STARTER_FORMS[resolveStarterForm(before,start.fishForm,start.fishPrimary)]];
      stages[1]=Math.max(stages[1],finStage(fins));
      t.finGain=fins-10;t.fishForm=starterFormIndex(stages);
      return {traits:t,mutation:fins>before[1]};
    }
    t.vitality=Math.max(0,(start.vitality??0)+g.hp);
    t.staminaGain=Math.max(0,(start.staminaGain??0)+g.stamina);
    t.scaleGain=Math.max(0,(start.scaleGain??0)+g.scales);
    const before=this.starterScores(start);
    const birth=advanceStarterFish(before,[before[0]+g.bite,before[1]+g.fins,before[2]+g.skull],start.fishForm,start.fishPrimary);
    t.biteGain=birth.scores[0]-10; t.finGain=birth.scores[1]-10; t.ramGain=birth.scores[2]-10;
    t.fishForm=birth.form; t.fishPrimary=birth.primary;
    return {traits:t,mutation:mutation && birth.scores[1]>before[1]};
  }

  private applyEvolution(start: Traits, gains: Gains, random = Math.random, fixed?: Gains): Traits {
    const d = evolutionStep(gains, random, fixed);
    const t = full({ ...start });
    t.vitality = (t.vitality ?? 0) + d.hp;
    t.biteGain = (t.biteGain ?? 0) + d.bite;
    t.ramGain = (t.ramGain ?? 0) + d.skull;
    t.finGain = (t.finGain ?? 0) + d.fins;
    t.scaleGain = (t.scaleGain ?? 0) + d.scales;

    return t;
  }

  /** So sieht das Tier aus einem Ei aus, wenn es ausgewachsen ist. */
  roeMorph(e: RoeEgg): Morph {
    return this.morph({ traits: full({ ...e.traits }), seed: e.seed, sex: e.sex });
  }

  /** Gemeinsame Erbgutwerte, ausgewachsen, ohne persönliche Zufallsboni. */
  roeShown(e?: { traits: Partial<Traits> }) {
    const t = full(e ? e.traits : this.r.traits);
    const st = this.stats(this.r.cls, t, ADULT);
    const s0 = (this.s0 ??= this.stats('fish', ZERO, ADULT));
    const points=this.r.cls==='fish'?(n:number)=>Math.floor(n+1e-9):Math.round;
    return {
      hp: st.maxHp,
      stam: Math.round(10 * STAMINA.sprint * st.endurance),
      bite: points((10 * st.bite) / s0.bite),
      ram: points((10 * st.ram) / s0.ram),
      // Tempo: Grundtempo mal Flossenschub (cruise) – so schwimmt das Tier tatsächlich
      speed: Math.round((10 * st.speed * st.cruise) / (s0.speed * s0.cruise)),
      scales: Math.round(this.r.cls==='fish'?10+Math.max(0,t.scaleGain??0):scalePoints(t)),
      fins: Math.round(finPoints(t)),
    };
  }

  /**
   * Vorschau mit mittlerem Zugewinn, dazu der Plan für den individuellen Wurf jedes Eis.
   * Pflanzen-/Fleischanteile und besiegte Gegner steuern die Punkte. Kosmetische Merkmale gehen zum Teil weiter;
   * Länge aus Strecke und Gewicht aus mittlerer Tiefe bleiben ohne eigene Änderungsanzeige.
   */
  inherit(eaten: { meat: number; plant: number }, style: PlayStyle, partner?: Clutch['partner']): Heir {
    const run = this.r;
    if(run.cls==='fish') {
      const start=full({...run.traits});
      const plan:FishPlan={eaten:{...eaten},effort:{biteDamage:style.biteDamage,ramDamage:style.ramDamage,minHealth:style.minHealth}};
      return {traits:this.fishOffspring(start,plan,()=>.5,true).traits,fishPlan:{start,plan},sex:newSex(),seed:Math.floor(Math.random()*100000),fit:{st:0,bs:0,vf:0,sw:0}};
    }
    const start = full(run.traits);
    const end = this.drifted();
    const k = INHERIT.carry;
    // nie zu viel auf einmal: jede Veränderung je Generation hat ihre Grenze (INHERIT.step)
    const S = INHERIT.step;
    const lim = (v: number, m: number) => clamp(v, -m, m);
    const lived = Math.max(60, run.life.age);
    const t = full({ ...start });
    // Narben bleiben beim Elterntier; vorgemerkte Färbungen älterer Spielstände gehen an die Nachkommen
    t.scars = 0;
    t.coat = end.coat;
    for (const key of AMP) t[key] = clamp(start[key] + Math.min(S.carry, Math.max(0, end[key] - start[key]) * k), 0, 1);
    // Färbung und Flossen, die sich im Leben verschoben haben (Licht, Verstecke), setzen sich fort
    for (const g of ['light', 'fin', 'crest'] as const) t[g] = clamp(start[g] + lim((end[g] - start[g]) * k * 0.8, S.carry), -1, 1);
    // Länge und Masse ändern sich nur bei den Nachkommen, unabhängig von der Pflanzen-/Fleischwertung.
    t.lengthGain = (start.lengthGain ?? 0) + INHERIT.lengthStep * clamp((style.distance ?? 0) / Math.max(1, INHERIT.swimDistance), 0, 1);
    const depth = (style.waterTime ?? 0) > 0 ? (style.depthTime ?? 0) / style.waterTime! : 0;
    t.massGain = (start.massGain ?? 0) + INHERIT.massStep * clamp(depth, 0, 1);
    // Sicht wächst nur durch Zeit in der Tiefe; Ausdauer durch weite Strecken (ohne Tempo-Gewinn dabei)
    t.sightGain = (start.sightGain ?? 0) + INHERIT.sightStep * clamp((style.deepTime ?? 0) / Math.max(1, INHERIT.deepRef), 0, 1);
    t.endGain = (start.endGain ?? 0) + INHERIT.endStep * clamp((style.distance ?? 0) / Math.max(1, INHERIT.endDistance), 0, 1);
    // Ernährung aus der aufgenommenen Energie – Schritt für Schritt und nie ganz bis zum Äußersten
    const total = eaten.meat + eaten.plant;
    if (total > 0) {
      const target = clamp((2 * eaten.meat) / total - 1, -DIET_MAX, DIET_MAX);
      const sure = Math.min(1, total / (0.4 * fedRef(lived, this.stats(run.cls, run.traits).size)));
      t.diet = clamp(start.diet + lim(target - start.diet, S.diet) * sure, -DIET_MAX, DIET_MAX);
    }
    const gains = evolutionBudget(eaten, style.defeats ?? {});
    const fixed = evolutionBonus(style);
    const fit = plateFit(style);
    // der Partner: ein wenig von seinem Aussehen (nicht von Größe, Kost, Robustheit oder den Platten)
    if (partner) {
      const p = full({ ...partner.traits });
      for (const key of BLEND_KEYS) {
        const [lo, hi] = range(key);
        t[key] = clamp((t[key] ?? 0) + ((p[key] ?? 0) - (t[key] ?? 0)) * INHERIT.partner, lo, hi);
      }
    }
    return {
      traits: this.applyEvolution(t, gains, () => 0.5, fixed),
      evolution: { traits: t, gains, fixed },
      sex: newSex(),
      seed: Math.floor(Math.random() * 100000),
      fit,
    };
  }

  /**
   * Ein Ei schlüpft – du spielst als dieses Tier weiter, dort, wo es gelaicht wurde.
   *   – Ein Geschwister (pool): dieselbe Generation.
   *   – Ein Ei aus dem Laich deiner Generation (next): Die nächste Generation beginnt – und es gibt kein Zurück. Die übrigen
   *     Geschwister sind fort, der übrige Laich sind die neuen Geschwister, und neuer Laich kommt erst wieder dazu.
   * Was die Linie weiß (Orte, Muscheln, Gruppe), bleibt; Alter, Nahrung und Spielweise beginnen neu.
   * Gibt false zurück, wenn es das Ei nicht gibt.
   */
  hatch(group: RoeGroup, i: number): boolean {
    const run = this.r;
    const list = group === 'pool' ? run.pool : run.next;
    const egg = list?.[i];
    if (!list || !egg) return false;
    const gen = egg.generation ?? (group === 'pool' ? this.poolGen : this.poolGen + 1);
    if(gen!==this.poolGen&&gen!==this.poolGen+1)return false;
    list.splice(i, 1);
    if (group === 'next') { run.pool=list; run.next=[]; }
    this.hatchRoe(egg, gen);
    return true;
  }

  /**
   * Das Tier aus diesem Ei schlüpft – als Generation gen. Ist sie weiter als dein Tier, beginnt für dich eine neue
   * Generation (im Stammbaum ein neuer Abschnitt, wenn sich die Art verändert hat). Den Stapel selbst ordnen hatch bzw.
   * im Koop der Server.
   */
  hatchRoe(egg: RoeEgg, gen: number) {
    const run = this.r;
    if(gen!==this.poolGen&&gen!==this.poolGen+1)return;
    run.waiting=false;run.waitCause=undefined;
    if(run.cls==='fish')this.repairFishEgg(egg);
    const jump = gen > run.life.gen;
    if (jump) {
      run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: run.epoch });
      if (run.history.length > 24) run.history.splice(1, 1);
    }
    if(run.fishTrace && egg.trace && !JSON.stringify(egg.trace).startsWith(JSON.stringify(run.fishTrace).slice(0,-1))) {
      const prior=this.data.fishBranches?.find(b=>b.id===`local-${run.id}`);
      if(prior)(this.data.fishBranches??=[]).push({...prior,id:`past-${run.id}-${prior.trace.map(m=>m.form).join('-')}`,extinct:true});
    }
    run.traits = full({ ...egg.traits });
    run.fishTrace=egg.trace?.length?egg.trace:appendFishMark(run.fishTrace,resolveStarterForm(this.starterScores(run.traits),run.traits.fishForm),run.traits.fishPrimary??0);
    run.sex = SPAWN.alwaysMale ? 1 : egg.sex;
    run.seed = egg.seed;
    if (jump) {
      const at = this.data.nodes[run.node] ?? this.rootOf(run.epoch);
      if (sigOf(run.cls, run.traits) !== at.sig) run.node = this.node(at, run.epoch, run.cls, run.traits, run.id, true, gen).id;
    }
    const remaining=[...(run.pool??[]),...(run.next??[])].filter(e=>egg.id?e.id!==egg.id:e!==egg);
    run.pool=remaining.filter(e=>(e.generation??gen)===gen);run.next=remaining.filter(e=>(e.generation??gen+1)===gen+1);
    run.coopGen=gen;
    this.hatchAt(run, gen, egg);
  }

  /**
   * Wie sich die vererbten Fähigkeiten gegenüber der vorigen Generation verändert haben (ausgewachsen): Gebiss,
   * Schädel, Schuppen – im Karbon Gebiss, Beine, Griff, Schuppen. Ohne vorige Generation (der Urahn): nichts.
   */
  inheritedDelta(): Partial<Record<'bite' | 'skull' | 'fins' | 'scales' | 'legs' | 'grip', number>> | null {
    const run = this.data.run;
    const prev = run?.history[run.history.length - 1];
    if (!run || !prev || prev.epoch !== run.epoch) return null;
    const amph = run.cls === 'amphibian';
    const base = amph ? this.stats('amphibian', ZERO, ADULT) : this.stats('fish', ZERO, ADULT);
    const val = (tr: Partial<Traits>) => {
      const t = full({ ...tr });
      const st = this.stats(run.cls, t, ADULT);
      const ten = (v: number) => Math.round(10 * (1 + 2 * v));
      return { bite: Math.round((10 * st.bite) / base.bite), skull: Math.round((10 * st.ram) / base.ram), fins: Math.round(finPoints(t)), scales: Math.round(this.r.cls==='fish'?10+Math.max(0,t.scaleGain??0):scalePoints(t)), legs: ten(t.limb ?? 0), grip: ten(t.grip ?? 0) };
    };
    const a = val(run.traits), b = val(prev.traits);
    return { bite: a.bite - b.bite, skull: a.skull - b.skull, fins: a.fins - b.fins, scales: a.scales - b.scales, legs: a.legs - b.legs, grip: a.grip - b.grip };
  }

  /** Ein neues Tier schlüpft aus dem Gelege c: Alter, Nahrung und Spielweise beginnen neu – was die Linie weiß, bleibt. */
  private hatchAt(run: Run, gen: number, c: { place: string; x: number; y: number }) {
    run.aggression *= 0.5;
    run.infamy *= 0.8;
    run.kin = 0;
    this.newGeneration(run);
    run.life = newLife(gen);
    const p = run.prog;
    p.place = placeOf(EPOCHS[run.epoch], c.place).id;
    p.edge = undefined;
    p.at = { x: c.x, y: c.y };
    p.hp = undefined;
    p.eaten = { meat: 0, plant: 0 };
    p.train = newStyle();
    if (!p.seen.includes(p.place)) p.seen.push(p.place);
    if (!p.known.includes(p.place)) p.known.push(p.place);
    if (this.checkRamUnlock()) run.ramNew = true;
    run.life.fierce = this.fear();
    this.recordLineageBirth(run, c);
    this.save();
  }

  // ---------------------------------------------------------------- Karbon: das Gelege

  /** Das Gelege (nur in Zeitaltern mit Brutzyklus, siehe sim/brood.ts). */
  get brood(): Brood | undefined {
    return this.data.run?.brood;
  }

  /** Die Eier, die gerade zur Wahl stehen (nach dem Tod bzw. beim neuen Gelege). */
  eggOffer(): Egg[] {
    const b = this.brood;
    return b ? offer(b) : [];
  }

  /**
   * Ein Ei schlüpft: Du spielst als dieses Tier weiter – am Nest im Brutsumpf. In der Jugend beginnt es als Larve, in der
   * Gefahr holt es schnell auf (es ist gleich ein Vierfüßer). Was die Linie weiß (Orte, Muscheln), bleibt.
   */
  hatchEgg(egg: Egg) {
    const run = this.r;
    const b = run.brood;
    if (!b) return;
    const g = broodHatch(b, egg);
    run.traits = full({ jaw: g.jaw, limb: g.limb, grip: g.grip, armor: g.armor, coat: run.traits.coat });
    run.sex = newSex();
    run.seed = Math.floor(Math.random() * 100000);
    run.kin = 0;
    run.life = newLife(b.gen);
    run.life.fierce = this.fear();
    const p = run.prog;
    p.place = b.nest.place;
    p.edge = undefined;
    p.at = { x: b.nest.x, y: b.nest.y };
    p.hp = undefined;
    p.resume = undefined;
    p.eaten = { meat: 0, plant: 0 };
    p.train = newStyle();
    if (!p.seen.includes(b.nest.place)) p.seen.push(b.nest.place);
    if (!p.known.includes(b.nest.place)) p.known.push(b.nest.place);
    this.recordLineageBirth(run, b.nest);
    this.save();
  }

  /** Gefressen (Karbon): in der Jugend Nahrung (meta: genug für die Metamorphose), danach Heilung (Anteil der Lebenskraft). */
  broodFeed(units: number) {
    const b = this.brood;
    return b ? broodFeed(b, units) : { meta: false, heal: 0 };
  }

  /** Die Metamorphose: Ab jetzt ist das Tier ein Vierfüßer – und die Zeit bis zum neuen Gelege läuft. */
  metamorphose() {
    const b = this.brood;
    if (!b || b.phase === 'grown') return;
    metamorph(b);
    this.save();
  }

  /**
   * Die Gefahr ist überstanden: Das neue Gelege ist da – die nächste Generation, mit dem Erbgut, das das Verhalten dieser
   * hervorgebracht hat (wieder voll mit Eiern). Im Stammbaum beginnt ein neuer Abschnitt, wenn sich die Art verändert hat.
   */
  newClutch(): Brood | undefined {
    const run = this.r;
    const b = run.brood;
    if (!b) return undefined;
    run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: run.epoch });
    if (run.history.length > 24) run.history.splice(1, 1);
    const next = nextBrood(b);
    run.brood = next;
    const t = full({ ...run.traits, ...next.genes });
    const at = this.data.nodes[run.node] ?? this.rootOf(run.epoch);
    if (sigOf(run.cls, t) !== at.sig) run.node = this.node(at, run.epoch, run.cls, t, run.id, true, next.gen).id;
    this.save();
    return next;
  }

  /** Den steilen Gipfel erreicht: Das Zeitalter ist gemeistert (einmal je Linie). Gibt true zurück, wenn es neu war. */
  reachSummit() {
    const run = this.r;
    if (run.summit) return false;
    run.summit = true;
    this.data.deepest = Math.max(this.data.deepest, run.epoch);
    this.save();
    return true;
  }

  // ---------------------------------------------------------------- die eigene Gruppe (Schwarm)

  get swarm(): Swarm | undefined {
    return this.data.run?.swarm;
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
   * Ein verborgenes Merkmal wächst ein kleines Stück – je weiter entwickelt, desto langsamer. Das eigene Tier bleibt dabei,
   * wie es ist: Es sammelt sich im Leben an (Life.drift) und zeigt sich erst bei den Nachkommen (inherit).
   */
  grow(k: TraitKey, amount: number) {
    const d = (this.r.life.drift ??= {});
    const v = this.r.traits[k] + (d[k] ?? 0);
    d[k] = (d[k] ?? 0) + amount * Math.pow(Math.max(0, 1 - v), 1.3);
  }

  /** Färbung: + heller (oben im Licht), - dunkler (unten in der Tiefe) – für die Nachkommen */
  shiftLight(amount: number) {
    this.shift('light', amount);
  }

  /** Flossen verschieben sich (wer sich zwischen Pflanzen versteckt: größere Flossen, flachere Rückenflosse) – für die Nachkommen */
  shiftBody(k: 'fin' | 'crest', amount: number) {
    this.shift(k, amount);
  }

  private shift(k: 'light' | 'fin' | 'crest', amount: number) {
    const d = (this.r.life.drift ??= {});
    const base = this.r.traits[k] ?? 0;
    d[k] = clamp(base + (d[k] ?? 0) + amount, -1, 1) - base;
  }

  /** Die Merkmale mit allem, was sich im Leben angesammelt hat – so gehen sie an die Nachkommen. */
  drifted(): Traits {
    const run = this.r;
    const t = full({ ...run.traits });
    for (const [k, v] of Object.entries(run.life.drift ?? {}) as [DriftKey, number][]) {
      const [lo, hi] = range(k);
      t[k] = clamp(t[k] + v, lo, hi);
    }
    if (run.life.coat !== undefined) t.coat = run.life.coat;
    return t;
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

  /** Ein Ort beginnt: Wie grimmig das Tier dreinschaut, steht für dieses Leben fest (ältere Spielstände: jetzt). */
  beginLife() {
    const L = this.r.life;
    L.fierce ??= this.fear();
    this.save();
  }

  // ---------------------------------------------------------------- Orte und Muscheln

  get prog(): EpochProg {
    return this.r.prog;
  }

  /** Den Ort verlassen: Zustand merken (Lebenskraft, Artgenossen, Gefressenes …). */
  leavePlace(s: Partial<EpochProg>) {
    Object.assign(this.r.prog, s);
    this.save();
  }

  /** Direkt in einen Nachbarabschnitt, ohne zusätzliche Reisezeit. */
  enterPlace(id: string, edge?: { side: 'left' | 'right' | 'top' | 'chasm'; frac: number }) {
    const run = this.r;
    const p = run.prog;
    p.place = placeOf(EPOCHS[run.epoch], id).id;
    p.edge = edge;
    if (!p.seen.includes(p.place)) p.seen.push(p.place);
    if (!p.known.includes(p.place)) p.known.push(p.place);
    this.save();
  }

  /** Von einem Ort in den anderen geschwommen: Der Weg zwischen beiden ist bekannt (und der neue Ort auch). */
  discoverLink(a: string, b: string) {
    const p = this.r.prog;
    p.links ??= [];
    const k = linkKey(a, b);
    if (!p.links.includes(k)) p.links.push(k);
    if (!p.known.includes(b)) p.known.push(b);
    if (!p.known.includes(a)) p.known.push(a);
    this.save();
  }

  private epochFood() {
    const run = this.data.run;
    if (!run) return undefined;
    const all = (this.data.epochFood ??= {});
    const key = String(run.epoch);
    if (!all[key]) {
      const at = { prey: {} as Record<string, number>, plant: 0, meat: 0 };
      for (const m of Object.values(run.prey ?? {})) for (const [id, n] of Object.entries(m)) at.prey[id] = (at.prey[id] ?? 0) + n;
      for (const d of Object.values(run.diet ?? {})) { at.plant += d.plant; at.meat += d.meat; }
      all[key] = at;
    }
    return all[key];
  }

  /** Von einem Tier dieser Art gefressen (zum ersten Mal von diesem Tier): Es zählt für den Ort, an dem man gerade ist. */
  noteEaten(species: string) {
    const r = this.data.run;
    if (!r) return;
    const epoch = this.epochFood()!;
    epoch.prey[species] = (epoch.prey[species] ?? 0) + 1;
    const at = ((r.prey ??= {})[r.prog.place] ??= {});
    at[species] = (at[species] ?? 0) + 1;
    this.save();
  }

  /** Gefressen (Pflanze bzw. Fleisch, Eier zählen als Fleisch): Es zählt für den Ort, an dem man gerade ist. */
  noteFood(kind: 'plant' | 'meat', units: number) {
    const r = this.data.run;
    if (!r || !(units > 0)) return;
    this.epochFood()![kind] += units;
    const at = ((r.diet ??= {})[r.prog.place] ??= { plant: 0, meat: 0 });
    at[kind] += units;
  }

  /**
   * Wie viel Grünzeug und Fleisch in dieser Epoche gegessen wurde (optional gefiltert nach altem Ort) – als Anteil (0 … 1; ohne alles: null).
   * place = null: an allen Orten zusammen.
   */
  dietAt(place: string | null = null): { plant: number; meat: number } | null {
    const ep = this.data.run?.epoch;
    const epoch = ep === undefined ? undefined : this.data.epochFood?.[String(ep)];
    if (place === null && epoch) {
      const sum = epoch.plant + epoch.meat;
      return sum > 0 ? { plant: epoch.plant / sum, meat: epoch.meat / sum } : null;
    }
    const all = this.data.run?.diet ?? {};
    let plant = 0, meat = 0;
    for (const [id, at] of Object.entries(all)) {
      if (place !== null && id !== place) continue;
      plant += at.plant;
      meat += at.meat;
    }
    const total = plant + meat;
    return total > 0 ? { plant: plant / total, meat: meat / total } : null;
  }

  /**
   * Die Tiere, die du in dieser Epoche am häufigsten gefressen hast (höchstens n): Art, wie viele, und ihr Anteil an allen
   * dort gefressenen Tieren (0 … 1). Dazu, wie viele es dort insgesamt waren. place = null: an allen Orten zusammen.
   */
  topPrey(place: string | null = null, n = 3): { top: { id: string; count: number; share: number }[]; total: number } {
    const ep = this.data.run?.epoch;
    const epoch = ep === undefined ? undefined : this.data.epochFood?.[String(ep)];
    const at: Record<string, number> = place === null && epoch ? { ...epoch.prey } : {};
    for (const [id, m] of Object.entries(place === null && epoch ? {} : this.data.run?.prey ?? {})) {
      if (place !== null && id !== place) continue;
      for (const [sp, k] of Object.entries(m)) at[sp] = (at[sp] ?? 0) + k;
    }
    const total = Object.values(at).reduce((a, b) => a + b, 0);
    const top = Object.entries(at)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([id, count]) => ({ id, count, share: total ? count / total : 0 }));
    return { top, total };
  }

  /** Eindeutige Funde bleiben über alle Linien erhalten. */
  get collection(): CollectionState { return this.data.collection; }
  get shells() { return this.collection.shells.length; }
  get fossils() { return this.collection.fossils.length; }
  hasShell(id: ShellId) { return this.collection.shells.includes(id); }
  hasFossil(id: FossilId) { return this.collection.fossils.includes(id); }
  collectShell(id: ShellId) {
    if (!findShell(this.collection, id)) return false;
    this.save();
    bus.emit('collection');
    return true;
  }
  recordFossilDrop(drop: FossilDrop) {
    if (!dropFossil(this.collection, drop)) return false;
    this.save();
    return true;
  }
  collectFossil(id: FossilId) {
    if (!findFossil(this.collection, id)) return false;
    this.save();
    bus.emit('collection');
    return true;
  }
  get collectionFresh() {
    const c = this.collection;
    return c.shells.some(id => !c.seen.includes(`shell:${id}`)) || c.fossils.some(id => !c.seen.includes(`fossil:${id}`));
  }
  seeCollection() {
    const c = this.collection;
    c.seen = [...c.shells.map(id => `shell:${id}` as const), ...c.fossils.map(id => `fossil:${id}` as const)];
    this.save();
  }
  get unheardWisdom() { return this.shells > this.collection.heard; }
  hearWisdom() {
    const c = this.collection;
    const index = this.shells ? Math.min(c.heard, this.shells - 1) : -1;
    if (index >= 0) c.heard = Math.max(c.heard, index + 1);
    this.save();
    return { index, text: index < 0 ? '... beneath stone and current ... seven silent traces await ...' : SHELL_WISDOM[index], total: COLLECTION_SHELLS.length };
  }

  /** So viele Sekunden reicht der Sauerstoff deines Tiers an Land (Karbon; ein Jungtier mit Kiemen trocknet schneller aus). */
  get oxygenSeconds() {
    // ein Fisch atmet mit Kiemen: An Land reicht die Luft nur kurz
    if (this.data.run?.cls === 'fish') return FISH_LAND.seconds;
    return oxygenSeconds(this.data.run?.brood?.phase === 'young');
  }

  /** Startfisch: Flossen vergrößern die Reserve, Aktionen behalten ihre absoluten Kosten. */
  get staminaMax() {
    return this.r.cls === 'fish' ? fishStaminaMax(staminaPoints(this.r.traits)) : 1;
  }

  /** Wie weit dein Tier in der Tiefe sieht (Anteil des ganzen Bildes vor ihm): zu Beginn ein Fünftel, mehr durch Zeit in der Tiefe. */
  get sight() {
    return sightOf(this.r.traits.sightGain ?? 0);
  }

  /**
   * Die Werte des eigenen Tiers. Beim Startfisch zeigen die Waffen das Erbgut ab 10 Punkten; das Wachstum verändert
   * den tatsächlichen Schaden, nicht diese Punkteskala.
   */
  shown() {
    const points=this.r.cls==='fish'?(n:number)=>Math.floor(n+1e-9):Math.round;
    const st = this.stats(this.r.cls, undefined, this.lifeK);
    const weapons = this.r.cls === 'fish' ? this.stats('fish', this.r.traits, ADULT) : st;
    // im Karbon misst sich das Gebiss am ersten Pederpes, sonst am ersten Fisch
    const s0 = this.r.brood ? (this.a0 ??= this.stats('amphibian', ZERO, ADULT)) : (this.s0 ??= this.stats('fish', ZERO, ADULT));
    const t = this.r.traits;
    const sw = this.swarm;
    const n = sw ? Math.min(sw.members.length, this.swarmCap()) : 0;
    return {
      hpMax: st.maxHp,
      /** wie weit du siehst: Anteil des ganzen Bildes vor dir (in Prozent) */
      sight: Math.round(100 * sightOf(t.sightGain ?? 0)),
      /** so lange reicht die Kraft für einen Spurt (in Zehntelsekunden: ein Kreis, normaler Körperbau → 30) */
      stam: Math.round(10 * STAMINA.sprint * st.endurance),
      bite: points((10 * weapons.bite) / s0.bite),
      skull: points((10 * weapons.ram) / s0.ram),
      /** deine Gruppe: so viele, wie auf deinen Ruf kommen, mal ihre Angriffskraft (du selbst wärst 10) */
      swarm: Math.round(10 * n * this.swarmStrength()),
      /** Schuppen: robustere Schuppen bis zum Schuppenpanzer (aus überstandenen Angriffen) */
      scales: Math.round(this.r.cls==='fish'?10+Math.max(0,t.scaleGain??0):scalePoints(t)),
      fins: Math.round(finPoints(t)),
      /** Karbon: so viele Sekunden reicht der Sauerstoff an Land (ausgewachsen); Beine und Griff (der erste Pederpes: je 10) */
      oxy: Math.round(oxygenSeconds(false)),
      legs: Math.round(10 * (1 + 2 * (t.limb ?? 0))),
      grip: Math.round(10 * (1 + 2 * (t.grip ?? 0))),
    };
  }

  /** Karbon: was ein Ei verspricht – die Werte des ausgewachsenen Tiers, so wie die Übersicht sie zeigt. */
  eggShown(e: Egg): Record<Gene, number> {
    const g = e.genes;
    const st = this.stats('amphibian', full({ jaw: g.jaw, limb: g.limb, grip: g.grip, armor: g.armor }), ADULT);
    const a0 = (this.a0 ??= this.stats('amphibian', ZERO, ADULT));
    const ten = (v: number) => Math.round(10 * (1 + 2 * v));
    return { jaw: Math.round((10 * st.bite) / a0.bite), limb: ten(g.limb), grip: ten(g.grip), armor: ten(g.armor) };
  }

  // ---------------------------------------------------------------- Persönlicher Stammbaum nach Weltzeit

  private lineageForm(r: Pick<Run, 'cls' | 'traits' | 'hue' | 'seed' | 'sex'>): LineageForm {
    return { cls: r.cls, traits: packTraits(r.traits), hue: r.hue, seed: r.seed, sex: r.sex };
  }

  private recordLineageBirth(r: Run, at: { place: string; x: number; y: number }, legacy = false) {
    const ep = EPOCHS[r.epoch], place = placeOf(ep, at.place);
    if(r.cls==='fish') {
      r.fishTrace??=appendFishMark(undefined,resolveStarterForm(this.starterScores(r.traits),r.traits.fishForm),r.traits.fishPrimary??0);
      const branches=this.data.fishBranches??=[];
      const id=`local-${r.id}`;
      const branch={id,name:'Your lineage',trace:r.fishTrace.map(m=>({...m}))};
      const index=branches.findIndex(b=>b.id===id);
      if(index<0)branches.push(branch);else branches[index]=branch;
      bus.emit('fishLineage');
    }
    const site: LineageSite = { key: `${ep.id}:${legacy ? 'unknown' : place.id}`, place: place.id,
      name: legacy ? 'Spawning site not recorded' : place.name, x: at.x, y: at.y };
    recordBirth(this.data.lineage, r.id, r.epoch, worldYears(ep.from, ep.to), r.brood ? r.brood.gen + 1 : r.life.gen, site, this.lineageForm(r), legacy);
  }

  /** Old terminal nodes contain a death date, but no trustworthy birth dates. Preserve only that observed endpoint. */
  private migrateLineageEnds() {
    for (const n of Object.values(this.data.nodes)) {
      if (!n.dead || this.data.lineage.runs.some(j => j.id === n.dead!.run)) continue;
      const ep = EPOCHS[n.epoch];
      if (!ep || ep.hidden) continue;
      const years = ep.from - n.dead.frac * (ep.from - ep.to), place = startPlace(ep);
      const r = recordBirth(this.data.lineage, n.dead.run, n.epoch, years, Math.max(1, (n.dead.gens ?? n.gen ?? 1) + (ep.brood ? 1 : 0)),
        { key: `${ep.id}:unknown`, place: place.id, name: 'Spawning site not recorded', x: 0, y: 0 },
        this.lineageForm({ ...n, sex: 1 }), true);
      endLineage(r, years, n.dead.cause);
    }
  }

  markLineage(key?: string) {
    const a = this.data.lineage;
    if (key && !a.runs.some(r => r.segments.some(s => `${r.id}/${s.id}` === key))) return;
    a.marked = key;
    this.save();
  }

  // ---------------------------------------------------------------- Bisherige Merkmalsknoten (für Namen und alte Spielstände)

  private node(parent: TreeNode, epoch: number, cls: ClassId, traits: Traits, runId: number, merge: boolean, gen: number): TreeNode {
    const sig = sigOf(cls, traits);
    if (merge) {
      for (const cid of parent.children) {
        const c = this.data.nodes[cid];
        if (c && !c.dead && c.epoch === epoch && c.sig === sig) {
          c.runs += 1;
          c.last = runId;
          c.gen = Math.min(c.gen ?? gen, gen);
          return c;
        }
      }
    }
    const run = this.r;
    const n: TreeNode = {
      id: 'n' + this.data.nextId++,
      parent: parent.id,
      epoch,
      gen,
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
    const parent = this.data.nodes[run.node] ?? this.rootOf(run.epoch);
    const leaf = this.node(parent, run.epoch, run.cls, run.traits, run.id, false, run.life.gen);
    leaf.dead = { frac: clamp(frac, 0, 1), cause, run: run.id, gens: run.brood ? run.brood.gen : run.life.gen };
    this.data.lastEnd = leaf.id;
    const ep = EPOCHS[run.epoch];
    const branch=this.data.fishBranches?.find(b=>b.id===`local-${run.id}`); if(branch)branch.extinct=true;
    endLineage(this.data.lineage.runs.find(j => j.id === run.id), ep.from - clamp(frac, 0, 1) * (ep.from - ep.to), cause);
    this.data.deepest = Math.max(this.data.deepest, run.epoch);
    this.ghost = run;
    this.data.run = null;
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

  /** Ein Tier ist dir begegnet: Es bekommt seine Seite in der Chronik des Lebens. Gibt true zurück, wenn es neu war. */
  markSeen(id: string) {
    if (this.data.seen.includes(id)) return false;
    this.data.seen.push(id);
    this.save();
    return true;
  }

  hasSeen(id: string) {
    return this.data.seen.includes(id);
  }

  /** Gibt es schon einen Stammbaum (mindestens ein beendeter oder laufender Versuch) – überhaupt bzw. in einem Zeitalter? */
  hasTree(epoch?: number) {
    if (epoch === undefined) return this.data.runs > 0;
    return (this.data.nodes[rootId(epoch)]?.runs ?? 0) > 0;
  }
}

export const game = new GameState();

/**
 * Jedes Ei weicht in Körper-, Flossen- und Panzerfarbe ein wenig von seinem Elterntier ab (versteckt, nirgends angezeigt): ein
 * Zufallsschritt je Farbe (ungefähr normalverteilt, Streuung INHERIT.colorStep, nie mehr als das Dreifache), begrenzt auf −1 … +1 – das
 * sind nur ein paar Grad Farbton und etwas heller oder dunkler (creatureArt.COLOR). Es gibt keinen Zug zur Mitte: Die Farbe wandert
 * über die Generationen, bis man sich fragt, wann der Fisch sie eigentlich bekommen hat.
 */
export function driftColors(t: Traits, random: () => number = Math.random): Traits {
  const out = { ...t };
  for (const k of ['cb', 'cf', 'cp'] as const) {
    // Summe dreier Zufallszahlen: glockenförmig, von −1,5 … 1,5 mit Streuung 0,5
    const g = (random() + random() + random() - 1.5) * 2;
    out[k] = clamp((t[k] ?? 0) + clamp(g, -3, 3) * INHERIT.colorStep, -1, 1);
  }
  return out;
}

/** Die Sicht (Anteil des ganzen Bildes vor dir) nach so vielen erworbenen Sichtpunkten: 20 %, 25 %, 30 % … bis 100 %. */
export function sightOf(n: number) {
  return Math.min(VISION.max, VISION.base + Math.max(0, n) * VISION.perPoint);
}

/** Eine Kennung für ein Ei (im Koop bei allen gleich). */
function eggId() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}
