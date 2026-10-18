import Phaser from 'phaser';
import { CLASSES, type ClassId } from '../data/classes';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { placeOf, placesOf, startPlace, TRAVEL_SECONDS } from '../data/world';
import type { Morph } from '../art/creatureArt';
import { clamp, mulberry32 } from '../util/math';

// ---------------------------------------------------------------------------
// Spielstand.
//
// Ein "Lauf" ist ein Spiel: eine Linie, die vom Urfisch an durch die Zeitalter
// zieht. Stirbt das Tier, ist der Lauf vorbei – die Linie stirbt aus.
//
// Das verborgene Anpassungssystem (der Spieler sieht keine Werte):
//   jaw     – wächst durch Beißen und Fleischfressen (stärkeres Gebiss)
//   skull   – wächst durch Rammen mit hohem Tempo (dickerer Schädel)
//   limb    – Bodenkontakt: wer sich oft am Grund abstützt und dort entlangläuft, bekommt kräftige,
//             stützende Flossen (später kräftigere Beine)
//   pack    – Rudel: wer oft mit Artgenossen zusammen kämpft, wird zum Rudeltier – sie helfen öfter,
//             wollen dann aber auch mitfressen
//   stealth – wächst durch Pflanzenfressen, Ausweichen und Verstecken
//   growth  – wächst mit allem, was gefressen wird (Körpergröße)
//   diet    – -1 Pflanzenfresser … +1 Fleischfresser
//   scars   – Narben überlebter Kämpfe
//   spike   – Kopfpanzer: 0 … -1 gepanzerter Schädel (wer oft rammt und damit Tiere erlegt)
//   green   – Tarnfarbe vom Verstecken zwischen Pflanzen
//   sand    – Tarnfarbe vom Verstecken am Boden und in Höhlen
// Ganz verborgen (nirgends angezeigt, nur am Verhalten zu merken):
//   digM, digP – Verdauung: wer oft Fleisch bzw. Pflanzen frisst, holt mehr aus jedem Happen
//   nerve   – Nervenstärke: wer oft nah an Räubern bleibt, ohne aufzufallen, wird später bemerkt
//   tox     – Giftfestigkeit: giftige Pflanzen schaden weniger
//   fang    – Reißzähne: wachsen durch viel Fleisch, stehen vorn aus dem Maul
//   light   – Färbung: -1 dunkel (lebt tief unten bzw. im Schatten) … +1 hell (lebt oben im Licht)
//   len, girth, swift – Körperbau (wer viel und schnell schwimmt, wird länglicher) (länger/kürzer, dicker/schlanker, flinker): ändert sich nur von
//             Generation zu Generation – durch die Wahl, welches Tier die Linie weiterführt
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
  growth: number;
  diet: number;
  scars: number;
  spike: number;
  green: number;
  sand: number;
  /** Körperlänge: -1 gedrungen … +1 lang gestreckt */
  len: number;
  /** Fülle: -1 schlank … +1 massig */
  girth: number;
  /** Flinkheit: -1 träge … +1 flink */
  swift: number;
  digM: number;
  digP: number;
  nerve: number;
  tox: number;
  fang: number;
  /** Färbung: -1 dunkel … +1 hell */
  light: number;
  /** Bodenkontakt: stützende Flossen bzw. kräftige Beine */
  limb: number;
  /** Rudeltier: Artgenossen helfen öfter (und wollen mitfressen) */
  pack: number;
  /** Flossengröße, Schwanzbreite, Rückenflosse/Kamm (-1 … +1) – ändern sich vor allem durch die Wahl des Nachwuchses */
  fin: number;
  tail: number;
  crest: number;
  /** Farbton (-1 … +1) */
  tint: number;
  /** Kopfform: -1 kurz und stumpf … +1 lang und spitz */
  snout: number;
  /** Färbung durch eine Höhle: 0 natürlich, 1 grün (Gras), 2 schwarz (Dunkelheit) */
  coat: number;
  /** Entwicklungslinien: wie viele Zeitalter lang dein Spielstil zur Panzer-, Jäger- bzw. Fleischflosser-Linie passte (0 … 3) */
  pz: number;
  jg: number;
  ff: number;
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

/** Wie weit ein Merkmal in einem Zeitalter höchstens durch Spielen wächst (ohne die Wahl des Nachwuchses). */
const EPOCH_CAP: Partial<Record<string, number>> = { jaw: 0.22, skull: 0.2, growth: 0.24, fang: 0.22 };

export type TraitKey = 'jaw' | 'skull' | 'stealth' | 'growth' | 'green' | 'sand' | 'digM' | 'digP' | 'nerve' | 'tox' | 'fang' | 'limb' | 'pack';

/** Was ein Happen bringt: Sättigung (füllt den Magen) und Nährwert (zählt für die Vielfalt des Nachwuchses). */
export const FOOD = {
  meat: { sat: 3, kcal: 3.5 },
  plant: { sat: 1, kcal: 1 },
  toxic: { sat: 0.75, kcal: 1.5 },
  /** Fischlaich: nahrhaft und leicht zu fressen – aber die Eltern passen auf */
  roe: { sat: 2.4, kcal: 2.6 },
};

/** Wie viel in den Magen passt – größere Tiere fassen mehr (verbrauchen aber auch mehr). */
export const maxSatiety = (size: number) => Math.round(100 * (0.7 + 0.45 * size));

/** Hunger je Sekunde: auch in Ruhe spürbar, beim Schwimmen bzw. Laufen deutlich mehr; Große brauchen mehr. */
export const hungerRate = (size: number, speed01: number) => (0.9 + 1.0 * Math.min(1.5, speed01)) * Math.pow(size, 1.3);

/** Bezugsgröße für die Vielfalt des Nachwuchses: so viel frisst ein Tier, das gut über die Runden kommt. */
export const fedRef = (ep: EpochDef, size: number) => 0.35 * ep.seconds * (0.85 + 0.3 * size);

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
}

/** 1 = männlich, 2 = weiblich */
export type Sex = 1 | 2;

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
  /** gelebte Sekunden in diesem Zeitalter */
  elapsed: number;
  /** schon eingetretene Ereignisse (Nummern aus der Ereignisliste) */
  events: number[];
  /** Endgegner: 0 noch nicht da, 1 lebt, 2 besiegt */
  boss: 0 | 1 | 2;
  /** in diesem Zeitalter gefressen (Sättigungs-Einheiten) */
  eaten: { meat: number; plant: number };
  /** Zustand beim Verlassen eines Ortes */
  hp?: number;
  sat?: number;
  kin?: number;
  /** was getan wurde (Beutejagd, Bodenkontakt, Rammen, Schwimmen) */
  train: { hunt: number; ground: number; ram: number; swim: number; hide?: number; hurt?: number; up?: number; down?: number; fwd?: number; turns?: number };
}

export const newProg = (epoch: number): EpochProg => ({
  place: startPlace(EPOCHS[epoch]).id,
  seen: [startPlace(EPOCHS[epoch]).id],
  known: [startPlace(EPOCHS[epoch]).id],
  elapsed: 0,
  events: [],
  boss: 0,
  eaten: { meat: 0, plant: 0 },
  train: { hunt: 0, ground: 0, ram: 0, swim: 0 },
});

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
  /** Stand im aktuellen Zeitalter */
  prog: EpochProg;
  /** gefundene Muscheln (jede legt eine Zeile der Steintafel frei) */
  shells: string[];
  /** so viele Zeilen der Tafel hat man schon freigelegt gesehen */
  seenRows: number;
  history: Ancestor[];
}

/** Das Tier, das die Linie ins nächste Zeitalter führt (es entsteht aus dem Spielstil – man wählt es nicht). */
export interface Offspring {
  traits: Traits;
  sex: Sex;
  seed: number;
  /** zu welcher Linie dieses Zeitalter gezählt wurde */
  line?: LineId;
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
  /** Ende einer Linie: hier ausgestorben (frac = wie weit ins Zeitalter) */
  dead?: { frac: number; cause: string; run: number };
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
const ZERO: Traits = { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0, spike: 0, green: 0, sand: 0, len: 0, girth: 0, swift: 0, digM: 0, digP: 0, nerve: 0, tox: 0, fang: 0, light: 0, limb: 0, pack: 0, fin: 0, tail: 0, crest: 0, tint: 0, snout: 0, coat: 0, pz: 0, jg: 0, ff: 0, fUp: 0, fDown: 0, fSide: 0, fTail: 0 };
export const ZERO_TRAITS: Readonly<Traits> = ZERO;

const SKILLS: SkillKey[] = ['jaw', 'skull', 'stealth', 'growth', 'green', 'sand'];
/** verborgene Anlagen – sie werden genauso weitervererbt, aber nirgends gezeigt */
const HIDDEN = ['digM', 'digP', 'nerve', 'tox', 'fang', 'limb', 'pack'] as const;
/** Merkmale, die man dem Tier ansieht und die sich nur bei der Verwandlung nach einem Zeitalter ändern. */
const LOOK_KEYS: (keyof Traits)[] = ['jaw', 'skull', 'stealth', 'diet', 'spike', 'green', 'sand', 'len', 'girth', 'swift', 'fang', 'light', 'limb', 'fin', 'tail', 'crest', 'tint', 'snout', 'pz', 'jg', 'ff', 'fUp', 'fDown', 'fSide', 'fTail'];


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
// Die drei Entwicklungslinien. Jedes Zeitalter zählt einen Punkt für die Linie, die zum Spielstil dieses
// Zeitalters passte – man entscheidet das nicht. Drei Punkte ergeben zehn Grundformen: 3-0-0, 2-1-0, 1-1-1.
//   Panzer         – Rammen, Einstecken, Schädel und Kamm: wuchtig, gepanzert, stumpfer Kopf
//   Jäger          – schnelles Schwimmen und Jagen: lang, schlank, großer Schwanz, spitze Schnauze
//   Fleischflosser – am Grund bewegen, sich verstecken: Stielflossen, kräftig, olivfarben
// ---------------------------------------------------------------------------

export type LineId = 'pz' | 'jg' | 'ff';
export const LINE_IDS: LineId[] = ['pz', 'jg', 'ff'];
export const LINE_NAME: Record<LineId, string> = { pz: 'Panzer', jg: 'Jäger', ff: 'Fleischflosser' };

/** Wie ausgeprägt eine Linie nach n Punkten ist (1 Punkt = die Hälfte, 3 = voll). */
export const lineLevel = (n: number) => [0, 0.5, 0.8, 1][Math.max(0, Math.min(3, Math.round(n)))];

/** Die volle Ausprägung einer Linie (Verschiebung der Merkmale gegenüber dem Urfisch). */
const LINE_D: Record<LineId, Partial<Record<keyof Traits, number>>> = {
  pz: { skull: 0.16, crest: 0.8, girth: 0.6, fin: -0.7, snout: -0.55, len: -0.25, light: -0.25, jaw: 0.08, growth: 0.08 },
  jg: { len: 0.7, girth: -0.55, swift: 0.7, tail: 0.85, fin: 0.5, snout: 0.6, light: 0.12, crest: 0.2 },
  ff: { limb: 0.7, girth: 0.3, fin: 0.5, crest: 0.6, snout: 0.05, len: 0.3, tint: 0.5, light: -0.15, growth: 0.04 },
};

/** Dazugewonnene Anteile der drei Linien (0 … 1, jeder Punkt zählt gleich viel). */
export function lineMix(t: Partial<Traits>) {
  const f = full(t);
  return { pz: lineLevel(f.pz), jg: lineLevel(f.jg), ff: lineLevel(f.ff) };
}

/** Die vorherrschende Linie (oder undefined beim Urfisch) – bei Gleichstand die zuletzt gezählte Reihenfolge Panzer, Jäger, Fleischflosser. */
export function dominantLine(t: Partial<Traits>): LineId | undefined {
  const f = full(t);
  let best: LineId | undefined;
  let top = 0;
  for (const id of LINE_IDS) if (f[id] > top) {
    top = f[id];
    best = id;
  }
  return best;
}

/** Die Mischung als Kürzel, z. B. "pz2jg1". */
export const lineSig = (t: Partial<Traits>) => {
  const f = full(t);
  return LINE_IDS.filter((id) => f[id] > 0).sort((a, b) => f[b] - f[a]).map((id) => id + f[id]).join('') || 'basal';
};

/**
 * Was die Bewegung eines Zeitalters aus dem Körper macht (je Zeitalter höchstens etwa 0,45 Flossen-Zuwachs): Wer am meisten
 * nach oben schwamm, bekommt eine größere Rückenflosse; wer am meisten nach unten schwamm, größere Bauchflossen; viel und
 * schnell nach vorn heißt eine kräftigere Schwanzflosse; oft die Richtung zu wechseln, größere Seitenflossen.
 */
export function moveGrowth(s: Pick<LineStyle, 'up' | 'down' | 'fwd' | 'turns'>) {
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
  return `${cls}:${lineSig(t)}:${diet}:${t.coat}`;
}

const GENUS_ROOT: Record<ClassId, string> = { fish: 'ichthys', amphibian: 'batrachus', reptile: 'saurus', mammal: 'therium' };
const GENUS_PRE: Record<string, string> = { basal: 'Prot', pz: 'Placo', jg: 'Acantho', ff: 'Sarco' };
const EPITHET: Record<string, string> = { herb: 'phytophagus', omni: 'vulgaris', carn: 'carnivorus' };

/** Ein wissenschaftlich klingender Name für eine Linie (nur im Stammbaum zu sehen). */
export function speciesName(n: Pick<TreeNode, 'cls' | 'traits' | 'epoch'>) {
  if (n.epoch < 0) return 'Der Urahn';
  const t = full(n.traits);
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  const root = GENUS_ROOT[n.cls];
  const genus = GENUS_PRE[dominantLine(t) ?? 'basal'] + (/^[aeiou]/.test(root) ? '' : 'o') + root;
  const color = t.coat === 1 ? 'viridis' : t.coat === 2 ? 'niger' : '';
  return `${genus} ${color || EPITHET[diet]}`;
}

/** Ereignisse zwischen den Szenen (HUD, Level …). */
export const bus = new Phaser.Events.EventEmitter();

/** Was im Zeitalter getan wurde – daraus ergibt sich die Linie. */
export interface LineStyle {
  ram: number;
  hunt: number;
  swim: number;
  ground: number;
  hide: number;
  hurt: number;
  /** Sekunden, in denen nach oben bzw. unten geschwommen wurde, schnell nach vorn, und wie oft die Richtung wechselte */
  up: number;
  down: number;
  fwd: number;
  turns: number;
}

export interface SurviveResult {
  epoch: EpochDef;
  next?: EpochDef;
  /** Merkmale vor und nach den Jahrmillionen zwischen den Zeitaltern */
  drift?: { before: Traits; after: Traits };
  /** Die Nachkommen nehmen eine neue Form an */
  transition?: { from: ClassId; to: ClassId };
  /** bis in die Gegenwart überlebt */
  finished?: boolean;
  /** das Zeitalter wird wiederholt (Endgegner nicht besiegt) */
  repeat?: boolean;
  node: string;
}

class GameState {
  data: SaveData = fresh();
  private snap: { traits: Traits; aggression: number; infamy: number } | null = null;
  /** Das gerade beendete Leben – damit Anzeigen bis zum Szenenwechsel weiterlaufen können. */
  private ghost: Run | null = null;

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const f = fresh();
        this.data = { ...f, ...d, nodes: { ...f.nodes, ...d.nodes } } as SaveData;
        this.data.seen = Array.isArray(d.seen) ? d.seen.filter((id) => typeof id === 'string') : [];
        for (const n of Object.values(this.data.nodes)) n.traits = full(n.traits);
        // Nur noch die Fischzeit: alles, was dahinter lag, wird verworfen
        this.prune();
        const r = this.data.run;
        if (r) {
          r.prog ??= newProg(r.epoch);
          r.prog.train ??= { hunt: 0, ground: 0, ram: 0, swim: 0 };
          r.prog.eaten ??= { meat: 0, plant: 0 };
          r.prog.known ??= [...r.prog.seen];
          // Orte aus einer älteren Karte, die es nicht mehr gibt
          r.prog.known = r.prog.known.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          r.prog.seen = r.prog.seen.filter((id) => placesOf(EPOCHS[r.epoch]).some((p) => p.id === id));
          if (!placesOf(EPOCHS[r.epoch]).some((p) => p.id === r.prog.place)) r.prog = newProg(r.epoch);
          r.shells ??= [];
          r.seenRows ??= r.shells.length;
          r.traits = full(r.traits);
          // früher gab es auch Stachelköpfe – heute wird ein viel benutzter Kopf zum Panzer
          r.traits.spike = -Math.abs(r.traits.spike);
          r.social ??= 0.55;
          r.canRam = true;
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
      localStorage.setItem(KEY, JSON.stringify(this.data));
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

  /** Ein neues Leben beginnt – als kleiner Urfisch an der Wurzel des Stammbaums. */
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
      sex: Math.random() < 0.5 ? 1 : 2,
      epoch: 0,
      node: 'root',
      kin: 0,
      quests: {},
      social: 0.55,
      // der Stoß geht von Anfang an (stark wird er erst mit einem harten Kopf)
      canRam: true,
      prog: newProg(0),
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

  stats(cls: ClassId = this.r.cls, t: Traits = this.r.traits): Stats {
    const b = CLASSES[cls].base;
    // klein anfangen: Der Urfisch ist winzig, Platz zum Wachsen gibt es reichlich
    const size = clamp(0.7 + 0.62 * t.growth - 0.25 * t.stealth, 0.6, 1.5);
    const carn = Math.max(0, t.diet), herb = Math.max(0, -t.diet);
    const plates = Math.max(0, -(t.spike ?? 0)) * t.skull;
    const land = CLASSES[cls].habitat === 'land';
    const limb = t.limb ?? 0;
    const bite = b.bite * size * (1 + 3.6 * Math.pow(t.jaw, 1.1)) * (1 + 0.25 * carn) * (1 + 0.6 * (t.fang ?? 0));
    const ram = b.ram * size * (1 + 2.6 * t.skull) * (1 + 0.5 * plates) * (1 + 0.15 * (t.girth ?? 0));
    const body = (1 + 0.14 * (t.swift ?? 0) + 0.05 * (t.len ?? 0) - 0.07 * (t.girth ?? 0));
    // Die Linie hinter dem Aussehen: Panzer hält mehr aus, Jäger ist schneller, Fleischflosser zäh und gut am Grund
    const lv = lineMix(t);
    return {
      maxHp: Math.round(b.hp * Math.pow(size, 1.3) * (1 + 0.25 * t.skull + 0.2 * plates) * (1 + 0.16 * (t.girth ?? 0) + 0.05 * (t.len ?? 0)) * (1 + 0.16 * lv.pz + 0.1 * lv.ff - 0.06 * lv.jg)),
      bite,
      ram,
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2) * (1 - 0.6 * plates),
      // Kompromisse: Wer ein starkes Gebiss und einen harten Kopf hat, schwimmt dafür langsamer
      speed: b.speed * (1 + 0.38 * t.stealth) * (1.12 - 0.14 * size) * body * (land ? 1 + 0.14 * limb : 1) * (1 + 0.12 * lv.jg - 0.07 * lv.pz)
        * (1 - 0.2 * Math.pow(t.jaw, 0.9) - 0.09 * t.skull - 0.04 * (t.fang ?? 0)),
      jump: b.jump * (1 + 0.12 * t.stealth) * (1 + 0.1 * limb),
      size,
      defense: clamp(1 - 0.28 * t.skull - 0.12 * plates - 0.08 * (size - 1) - 0.1 * lv.pz, 0.4, 1.1),
      groundSpeed: 0.7 + 0.6 * limb + 0.3 * lv.ff,
      power: bite * 0.6 + ram * 0.4,
      detect: 1 - 0.55 * t.stealth,
      // Kost: Wer Fleisch frisst, holt mehr aus Fleisch (und weniger aus Pflanzen) – und umgekehrt
      digestMeat: Math.max(0.35, 1 + 0.6 * carn - 0.6 * herb + 0.5 * (t.digM ?? 0) + 0.1 * lv.ff),
      digestPlant: Math.max(0.35, 1 + 0.6 * herb - 0.6 * carn + 0.5 * (t.digP ?? 0)),
      // Schwere Waffen ermüden: starke Kiefer und Panzer kosten Kraft, schlanke Jäger halten länger durch
      endurance: clamp(1 + 0.36 * lv.jg + 0.18 * lv.ff - 0.3 * lv.pz - 0.32 * t.jaw - 0.22 * t.skull - 0.18 * Math.max(0, size - 1) - 0.12 * (t.swift ?? 0) + 0.12 * Math.max(0, -(t.girth ?? 0)), 0.5, 1.9),
      recover: clamp(1 + 0.22 * lv.jg + 0.2 * lv.ff - 0.24 * lv.pz - 0.2 * t.jaw - 0.12 * Math.max(0, size - 1), 0.55, 1.6),
      // Flossen, die aus der Bewegung gewachsen sind: schneller nach oben, nach unten, nach vorn – und wendiger
      climb: 1 + 0.45 * (t.fUp ?? 0),
      dive: 1 + 0.45 * (t.fDown ?? 0),
      cruise: 1 + 0.3 * (t.fTail ?? 0),
      agility: clamp(1 + 1.1 * (t.fSide ?? 0) - 0.14 * (t.len ?? 0) - 0.12 * Math.max(0, size - 1), 0.6, 2.4),
    };
  }

  /**
   * Das Aussehen ändert sich nur bei der Verwandlung nach einem Zeitalter – nicht Stück für Stück mittendrin: Körperbau, Flossen,
   * Gebiss und Färbung bleiben, wie sie zu Beginn des Zeitalters waren (die Werte selbst wachsen weiter). Nur Wuchs, Narben
   * und die Farbe aus einer Höhle zeigen sich sofort.
   */
  looks(t: Traits): Traits {
    const s = this.snap?.traits;
    if (!s) return t;
    const out = { ...t };
    for (const k of LOOK_KEYS) out[k] = s[k];
    return out;
  }

  /** Das Aussehen zu einer Form und ihren Merkmalen. */
  morph(o: { cls?: ClassId; traits?: Traits; belly?: number; fierce?: number; hue?: number; seed?: number; sex?: number } = {}): Morph {
    const run = this.data.run;
    const cls = o.cls ?? run?.cls ?? 'fish';
    const live = o.traits ?? run?.traits ?? ZERO;
    // das eigene Tier zeigt sich in der Gestalt vom Anfang des Zeitalters; ausdrücklich übergebene Merkmale gelten, wie sie sind
    const t = o.traits ? o.traits : this.looks(live);
    return {
      cls,
      size: this.stats(cls, live).size,
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
      pz: t.pz ?? 0,
      jg: t.jg ?? 0,
      ff: t.ff ?? 0,
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
   * mal massiger, mal flinker. Diese Unterschiede kann man später bei der Wahl des Nachwuchses nutzen.
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
      growth: j(t.growth + (sex === 1 ? 0.06 : -0.06), 0.08),
      diet: t.diet,
      scars: rnd() < 0.3 ? 1 : 0,
      spike: t.spike,
      green: j(t.green, 0.08),
      sand: j(t.sand, 0.08),
      len: g(t.len, 0.3),
      girth: g(t.girth, 0.3),
      swift: g(t.swift, 0.3),
      digM: t.digM,
      digP: t.digP,
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
      pz: t.pz ?? 0,
      jg: t.jg ?? 0,
      ff: t.ff ?? 0,
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

  /** Länge (cm) und Gewicht (g) eines Tiers. */
  measure(cls: ClassId = this.r.cls, t: Traits = this.r.traits) {
    const b = BODY[cls];
    const size = this.stats(cls, t).size;
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

  /**
   * Der Zeitraum, den eine Runde in einem Zeitalter abdeckt. Wird ein Zeitalter wiederholt (der
   * Endgegner ist noch nicht besiegt), läuft die Uhr weiter – immer kürzer bis zum nächsten Zeitalter.
   */
  epochSpan(i = this.r.epoch, round = this.data.run?.round ?? 0) {
    const ep = EPOCHS[i];
    const floor = EPOCHS[i + 1]?.from ?? 0;
    let from = ep.from, to = ep.to;
    for (let k = 0; k < round; k++) {
      const f = (ep.from - ep.to) / (ep.from - floor || 1);
      from = to;
      to = from - (from - floor) * Math.min(0.5, f);
    }
    return { from, to };
  }

  /** Wie stark sich das Bewährte über die Zeit bis zum nächsten Zeitalter fortsetzt. */
  driftFactor(i = this.r.epoch) {
    const ep = EPOCHS[i], next = EPOCHS[i + 1];
    if (!next) return 1;
    return 0.9 + 0.5 * Math.log10(1 + (ep.to - next.from) / 1e6);
  }

  /**
   * Das Zeitalter ist überstanden: Die Linie zieht weiter. Was sich bewährt hat, setzt sich über die Jahrmillionen
   * fort (verstärkt). Außerdem zählt das Zeitalter einen Punkt für die Linie, die zum Spielstil passte – Panzer
   * (Rammen, Einstecken), Jäger (schnell schwimmen, jagen) oder Fleischflosser (am Grund, versteckt) –, und
   * der Körper verschiebt sich entsprechend. Eine Wahl gibt es nicht: Es passiert einfach.
   */
  evolve(eaten: { meat: number; plant: number }, style: LineStyle, advance = true): Offspring {
    const run = this.r;
    const start = full(this.snap?.traits ?? run.traits);
    const end = full(run.traits);
    const k = this.driftFactor();
    const rnd = mulberry32(run.seed * 7 + run.epoch * 131 + 5);
    const amp = [...SKILLS, ...HIDDEN];
    const main = full({ ...end });
    for (const key of amp) main[key] = clamp(end[key] + Math.max(0, end[key] - start[key]) * k, 0, 1);
    const total = eaten.meat + eaten.plant;
    const ate = total > 0 ? (eaten.meat - eaten.plant) / total : 0;
    main.diet = clamp(end.diet + (end.diet - start.diet) * k * 0.6 + (ate - end.diet) * 0.15, -1, 1);
    main.spike = clamp(end.spike + (end.spike - start.spike) * k * 0.6, -1, 0);
    // Körperbau und Färbung, die sich im Zeitalter verschoben haben, setzen sich fort
    for (const g of ['len', 'girth', 'swift', 'light', 'fin', 'tail', 'crest', 'tint', 'snout'] as const) main[g] = clamp(end[g] + (end[g] - start[g]) * k * 0.8, -1, 1);
    // Die Bewegung dieses Zeitalters formt die Flossen – jetzt, bei der Verwandlung, und nur dann
    const mv = moveGrowth(style);
    main.fUp = clamp(end.fUp + mv.up, 0, 1);
    main.fDown = clamp(end.fDown + mv.down, 0, 1);
    main.fSide = clamp(end.fSide + mv.side, 0, 1);
    main.fTail = clamp(end.fTail + mv.tail, 0, 1);
    let line: LineId | undefined;
    if (advance) {
      line = this.pickLine(style, start, end, rnd);
      const n0 = main[line];
      const n1 = Math.min(3, n0 + 1);
      if (n1 > n0) {
        const f = lineLevel(n1) - lineLevel(n0);
        for (const [key, d] of Object.entries(LINE_D[line]) as [keyof Traits, number][]) {
          const lo = key === 'jaw' || key === 'skull' || key === 'growth' || key === 'limb' ? 0 : -1;
          main[key] = clamp(main[key] + d * f, lo, 1);
        }
        main[line] = n1;
      }
    }
    return { traits: main, sex: run.sex, seed: run.seed, line };
  }

  /** Zu welcher Linie zählt dieses Zeitalter? Die Werte sind auf einen "üblichen" Spielverlauf bezogen. */
  private pickLine(s: LineStyle, start: Traits, end: Traits, rnd: () => number): LineId {
    const dSkull = Math.max(0, end.skull - start.skull);
    const score: Record<LineId, number> = {
      pz: (s.ram * 1.4 + dSkull * 90 + s.hurt * 0.8) / 25,
      jg: (s.swim * 0.45 + s.hunt * 0.6) / 70,
      ff: (s.ground * 1.5 + s.hide * 0.5) / 35,
    };
    let best: LineId = 'jg';
    let top = -1;
    for (const id of LINE_IDS) {
      const v = score[id] * (0.94 + rnd() * 0.12);
      if (v > top) {
        top = v;
        best = id;
      }
    }
    return best;
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
   * Ein Merkmal wächst ein kleines Stück – je weiter entwickelt, desto langsamer. Die großen Merkmale
   * (Gebiss, Schädel, Wuchs, Reißzähne) wachsen in einem Zeitalter nur bis zu einem Deckel: Sie
   * steigern sich Stufe um Stufe über mehrere Zeitalter, statt auf einmal auszuschöpfen.
   */
  grow(k: TraitKey, amount: number) {
    const t = this.r.traits;
    let gain = amount * Math.pow(1 - t[k], 1.3);
    const cap = EPOCH_CAP[k];
    if (cap !== undefined) {
      const start = this.snap?.traits[k] ?? t[k];
      const used = clamp((t[k] - start) / cap, 0, 1);
      gain *= Math.pow(1 - used, 1.6);
    }
    t[k] = Math.min(1, t[k] + gain);
  }

  /** Ein Merkmal bildet sich ein Stück zurück (wer nur Pflanzen frisst, baut kein Raubtiergebiss auf). */
  fade(k: TraitKey, amount: number) {
    const t = this.r.traits;
    t[k] = Math.max(0, t[k] - amount);
  }

  shiftDiet(amount: number) {
    const t = this.r.traits;
    t.diet = clamp(t.diet + amount, -1, 1);
  }

  /** Färbung: + heller (oben im Licht), - dunkler (unten in der Tiefe) */
  shiftLight(amount: number) {
    const t = this.r.traits;
    t.light = clamp((t.light ?? 0) + amount, -1, 1);
  }

  /** Körperbau verschiebt sich (wer viel und schnell schwimmt, wird länglicher) */
  shiftBody(k: 'len' | 'girth' | 'swift' | 'fin' | 'tail' | 'crest', amount: number) {
    const t = this.r.traits;
    t[k] = clamp((t[k] ?? 0) + amount, -1, 1);
  }

  /** Kopfpanzer: wer oft rammt (und damit Tiere erlegt), dessen Schädel wird zum Panzer */
  armorHead(amount: number) {
    const t = this.r.traits;
    t.spike = clamp((t.spike ?? 0) - amount, -1, 0);
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

  /** Zu Beginn eines Zeitalters: Stand merken (für "einst/heute") und speichern. */
  beginEpoch() {
    const r = this.r;
    // nur zu Beginn des Zeitalters – beim Wechsel zwischen Orten bleibt der Stand von damals
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
      p.elapsed += TRAVEL_SECONDS;
      const size = this.stats().size;
      if (p.sat !== undefined) p.sat = Math.max(0.01, p.sat - hungerRate(size, 0.8) * TRAVEL_SECONDS * 0.6);
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

  /** Das Zeitalter ist vorbei und du lebst noch: Die Linie zieht weiter. */
  surviveEpoch(_kinAlive: number, social?: number, pick?: Offspring, repeat = false): SurviveResult {
    const run = this.r;
    const i = run.epoch;
    const ep = EPOCHS[i];
    if (social !== undefined) run.social = clamp(social, 0.15, 0.9);
    if (repeat) {
      // Der Endgegner lebt noch: Die Linie bleibt in diesem Zeitalter – eine weitere Generation
      run.round = (run.round ?? 0) + 1;
      run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: i });
      if (run.history.length > 24) run.history.splice(1, 1);
      run.kin = 0;
      run.aggression *= 0.5;
      run.infamy *= 0.8;
      run.prog = newProg(i);
      const res: SurviveResult = { epoch: ep, next: ep, node: run.node, drift: { before: { ...run.traits }, after: { ...run.traits } }, repeat: true };
      if (pick) {
        run.traits = full({ ...pick.traits });
        run.sex = pick.sex;
        run.seed = pick.seed;
        res.drift!.after = { ...run.traits };
        if (this.checkRamUnlock()) run.ramNew = true;
      }
      this.snap = null;
      this.save();
      return res;
    }
    run.round = 0;
    const parent = this.data.nodes[run.node] ?? this.data.nodes.root;
    const n = this.node(parent, i, run.cls, run.traits, run.id, true);
    run.node = n.id;
    run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: i });
    if (run.history.length > 24) run.history.splice(1, 1);
    this.data.deepest = Math.max(this.data.deepest, i);
    run.kin = 0;
    run.aggression *= 0.5;
    run.infamy *= 0.8;
    const next = EPOCHS[i + 1];
    const res: SurviveResult = { epoch: ep, next, node: n.id, drift: { before: { ...run.traits }, after: { ...run.traits } } };
    if (next && pick) {
      // Das gewählte (bzw. vorerst das eigene) Tier führt die Linie weiter – mit allem, was sich
      // über die Jahrmillionen fortgesetzt hat
      run.traits = full({ ...pick.traits });
      run.sex = pick.sex;
      run.seed = pick.seed;
      res.drift!.after = { ...run.traits };
      if (this.checkRamUnlock()) run.ramNew = true;
    }
    if (!next) {
      n.present = (n.present ?? 0) + 1;
      this.data.lastEnd = n.id;
      this.ghost = run;
      this.data.run = null;
      res.finished = true;
    } else {
      run.epoch = i + 1;
      run.prog = newProg(run.epoch);
      if (next.cls !== run.cls) {
        res.transition = { from: run.cls, to: next.cls };
        run.cls = next.cls;
      }
    }
    this.snap = null;
    this.save();
    return res;
  }

  /** Das Tier ist gestorben: Die Linie endet hier. Gibt den Knoten des Astendes zurück. */
  extinct(frac: number, cause: string): string {
    const run = this.r;
    const parent = this.data.nodes[run.node] ?? this.data.nodes.root;
    const leaf = this.node(parent, run.epoch, run.cls, run.traits, run.id, false);
    leaf.dead = { frac: clamp(frac, 0, 1), cause, run: run.id };
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
