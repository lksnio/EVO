import Phaser from 'phaser';
import { CLASSES, type ClassId } from '../data/classes';
import { EPOCHS, type EpochDef } from '../data/epochs';
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
}

export type TraitKey = 'jaw' | 'skull' | 'stealth' | 'growth' | 'green' | 'sand' | 'digM' | 'digP' | 'nerve' | 'tox' | 'fang' | 'limb' | 'pack';

/** Was ein Happen bringt: Sättigung (füllt den Magen) und Nährwert (zählt für die Vielfalt des Nachwuchses). */
export const FOOD = {
  meat: { sat: 6, kcal: 7 },
  plant: { sat: 2, kcal: 2 },
  toxic: { sat: 1.5, kcal: 3 },
};

/** Wie viel in den Magen passt – größere Tiere fassen mehr (verbrauchen aber auch mehr). */
export const maxSatiety = (size: number) => Math.round(100 * (0.7 + 0.45 * size));

/** Hunger je Sekunde: auch in Ruhe spürbar, beim Schwimmen bzw. Laufen deutlich mehr; Große brauchen mehr. */
export const hungerRate = (size: number, speed01: number) => (0.9 + 1.0 * Math.min(1.5, speed01)) * Math.pow(size, 1.3);

/** Bezugsgröße für die Vielfalt des Nachwuchses: so viel frisst ein Tier, das gut über die Runden kommt. */
export const fedRef = (ep: EpochDef, size: number) => 0.7 * ep.seconds * (0.85 + 0.3 * size);

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
}

/** 1 = männlich, 2 = weiblich */
export type Sex = 1 | 2;

/** Ein Vorfahre: so sah das Tier aus, als es ein Zeitalter überlebt hatte. */
export interface Ancestor {
  cls: ClassId;
  traits: Traits;
  epoch: number;
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
  /** Artgenossen zu Beginn des Zeitalters */
  kin: number;
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
  history: Ancestor[];
}

/** Ein Tier, das ein Zeitalter überlebt hat und die Linie weiterführen könnte. */
export interface Offspring {
  traits: Traits;
  sex: Sex;
  seed: number;
  /** die Hauptvariante: die bisherige Linie (die anderen weichen davon ab) */
  main: boolean;
  /** Kartentitel: wofür dieses Tier steht */
  label: string;
  /** besonders ausgeprägt: eine erspielte Fähigkeit und/oder ein Körpermerkmal */
  focus: { skill?: SkillKey; body?: BodyKey };
}

export type SkillKey = 'jaw' | 'skull' | 'stealth' | 'growth' | 'green' | 'sand';
export type BodyKey = 'len' | 'girth' | 'swift' | 'snout';

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
}

const KEY = 'evo-save-v3';
const ZERO: Traits = { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0, spike: 0, green: 0, sand: 0, len: 0, girth: 0, swift: 0, digM: 0, digP: 0, nerve: 0, tox: 0, fang: 0, light: 0, limb: 0, pack: 0, fin: 0, tail: 0, crest: 0, tint: 0 };
export const ZERO_TRAITS: Readonly<Traits> = ZERO;

const SKILLS: SkillKey[] = ['jaw', 'skull', 'stealth', 'growth', 'green', 'sand'];
/** verborgene Anlagen – sie werden genauso weitervererbt, aber nirgends gezeigt */
const HIDDEN = ['digM', 'digP', 'nerve', 'tox', 'fang', 'limb', 'pack'] as const;

/** Richtungen, in die Nachkommen im Aussehen abweichen: Flossen, Schwanz, Rückenflosse (+ größer, - kleiner) */
const LOOKS: [number, number, number][] = [[1, -1, 1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1]];

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

const SKILL_LABEL: Record<SkillKey, string> = { jaw: 'Scharfzahn', skull: 'Dickschädel', stealth: 'Schleicher', growth: 'Brocken', green: 'Grünling', sand: 'Sandling' };
export const BODY_NAME: Record<BodyKey, string> = { len: 'länger gestreckt', girth: 'massiger', swift: 'flinker', snout: 'spitzere Schnauze' };

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
  };
}

/** Grobe Einordnung einer Linie – gleiche Signatur im selben Zeitalter = derselbe Ast. */
export function sigOf(cls: ClassId, tIn: Partial<Traits>) {
  const t = full(tIn);
  const top = Math.max(t.jaw, t.skull, t.stealth);
  let dom = top < 0.15 ? 'basal' : t.jaw === top ? 'jaw' : t.skull === top ? 'skull' : 'stealth';
  if (dom === 'skull') dom = t.spike > 0.25 ? 'spike' : t.spike < -0.25 ? 'plate' : 'skull';
  const diet = t.diet < -0.3 ? 'herb' : t.diet > 0.3 ? 'carn' : 'omni';
  return `${cls}:${dom}:${diet}`;
}

const GENUS_ROOT: Record<ClassId, string> = { fish: 'ichthys', amphibian: 'batrachus', reptile: 'saurus', mammal: 'therium' };
const GENUS_PRE: Record<string, string> = { basal: 'Prot', jaw: 'Odont', skull: 'Cerat', spike: 'Acanth', plate: 'Petr', stealth: 'Crypt' };
const EPITHET: Record<string, string> = { herb: 'phytophagus', omni: 'vulgaris', carn: 'carnivorus' };

/** Ein wissenschaftlich klingender Name für eine Linie (nur im Stammbaum zu sehen). */
export function speciesName(n: Pick<TreeNode, 'cls' | 'traits' | 'epoch'>) {
  if (n.epoch < 0) return 'Der Urahn';
  const [, dom, diet] = sigOf(n.cls, n.traits).split(':');
  const root = GENUS_ROOT[n.cls];
  const genus = GENUS_PRE[dom] + (/^[aeiou]/.test(root) ? '' : 'o') + root;
  const t = full(n.traits);
  const color = t.green > 0.3 && t.green >= t.sand ? 'viridis' : t.sand > 0.3 ? 'arenarius' : '';
  return `${genus} ${color || EPITHET[diet]}`;
}

/** Ereignisse zwischen den Szenen (HUD, Level …). */
export const bus = new Phaser.Events.EventEmitter();

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
        for (const n of Object.values(this.data.nodes)) n.traits = full(n.traits);
        const r = this.data.run;
        if (r) {
          r.traits = full(r.traits);
          // früher gab es auch Stachelköpfe – heute wird ein viel benutzter Kopf zum Panzer
          r.traits.spike = -Math.abs(r.traits.spike);
          r.social ??= 0.55;
          r.canRam ??= false;
        }
      }
    } catch {
      this.data = fresh();
    }
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
      kin: 4,
      social: 0.55,
      canRam: false,
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
    const bite = b.bite * size * (1 + 2.2 * t.jaw) * (1 + 0.25 * carn) * (1 + 0.5 * (t.fang ?? 0));
    const ram = b.ram * size * (1 + 2.6 * t.skull) * (1 + 0.5 * plates) * (1 + 0.15 * (t.girth ?? 0));
    const body = (1 + 0.14 * (t.swift ?? 0) + 0.05 * (t.len ?? 0) - 0.07 * (t.girth ?? 0));
    return {
      maxHp: Math.round(b.hp * Math.pow(size, 1.3) * (1 + 0.25 * t.skull + 0.2 * plates) * (1 + 0.16 * (t.girth ?? 0) + 0.05 * (t.len ?? 0))),
      bite,
      ram,
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2) * (1 - 0.6 * plates),
      speed: b.speed * (1 + 0.38 * t.stealth) * (1.12 - 0.14 * size) * body * (land ? 1 + 0.14 * limb : 1),
      jump: b.jump * (1 + 0.12 * t.stealth) * (1 + 0.1 * limb),
      size,
      defense: clamp(1 - 0.28 * t.skull - 0.12 * plates - 0.08 * (size - 1), 0.45, 1.1),
      groundSpeed: 0.7 + 0.6 * limb,
      power: bite * 0.6 + ram * 0.4,
      detect: 1 - 0.55 * t.stealth,
      digestMeat: Math.max(0.4, 1 + 0.4 * carn - 0.5 * herb + 0.5 * (t.digM ?? 0)),
      digestPlant: Math.max(0.4, 1 + 0.4 * herb - 0.5 * carn + 0.5 * (t.digP ?? 0)),
    };
  }

  /** Das Aussehen zu einer Form und ihren Merkmalen. */
  morph(o: { cls?: ClassId; traits?: Traits; belly?: number; fierce?: number; hue?: number; seed?: number; sex?: number } = {}): Morph {
    const run = this.data.run;
    const cls = o.cls ?? run?.cls ?? 'fish';
    const t = o.traits ?? run?.traits ?? ZERO;
    return {
      cls,
      size: this.stats(cls, t).size,
      jaw: t.jaw,
      skull: t.skull,
      stealth: t.stealth,
      diet: t.diet,
      scars: t.scars,
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
    const t = run.traits;
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
   * Fünf Nachkommen zur Wahl – egal wie viele Artgenossen überlebt haben (die Art ist größer als
   * die eigene Gruppe). Die erste ist die Hauptvariante: die bisherige Linie mit allem, was sie im
   * Zeitalter dazugelernt hat (über die Jahrmillionen verstärkt). Die anderen weichen davon ab –
   * umso weiter, je mehr gefressen wurde (fed = gefressen / nötig). Jede betont eine Fähigkeit und
   * ein Körpermerkmal; was gefressen wurde, schiebt die Kost in diese Richtung.
   */
  offspring(fed: number, eaten: { meat: number; plant: number }, n = 5): Offspring[] {
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
    for (const g of ['len', 'girth', 'swift', 'light', 'fin', 'tail', 'crest', 'tint'] as const) main[g] = clamp(end[g] + (end[g] - start[g]) * k * 0.8, -1, 1);
    // Vielfalt: wer gerade so satt wurde, bekommt ähnliche Nachkommen – wer viel gefressen hat, sehr verschiedene
    const spread = clamp(0.35 + 0.55 * fed, 0.6, 2);
    const earned = SKILLS.filter((key) => end[key] - start[key] > 0.012).sort((a, b) => end[b] - start[b] - (end[a] - start[a]));
    const pool: SkillKey[] = earned.length ? earned : ['jaw', 'skull', 'stealth'];
    const bodies: BodyKey[] = ['len', 'girth', 'swift', 'snout'];
    const bodyOff = Math.floor(rnd() * 4);
    const out: Offspring[] = [{ traits: main, sex: run.sex, seed: run.seed, main: true, label: 'Hauptlinie', focus: {} }];
    for (let i = 1; i < n; i++) {
      const t = full({ ...main });
      const focus: Offspring['focus'] = {};
      const f = pool[(i - 1) % pool.length];
      focus.skill = f;
      t[f] = clamp(t[f] + (0.07 + 0.05 * rnd()) * spread * (1 - 0.5 * t[f]), 0, 1);
      const other = pool.find((o) => o !== f);
      if (other && rnd() < 0.7) t[other] = clamp(t[other] - 0.04 * spread, 0, 1);
      const b = bodies[(i - 1 + bodyOff) % bodies.length];
      focus.body = b;
      if (b === 'snout') t.jaw = clamp(t.jaw + 0.05 * spread, 0, 1);
      else t[b] = clamp(t[b] + (0.28 + 0.14 * rnd()) * spread, -1, 1);
      for (const g of ['len', 'girth', 'swift'] as const) if (g !== b) t[g] = clamp(t[g] + (rnd() - 0.5) * 0.36 * spread, -1, 1);
      for (const h of HIDDEN) t[h] = clamp(t[h] + (rnd() - 0.4) * 0.08 * spread, 0, 1);
      t.light = clamp(t.light + (rnd() - 0.5) * 0.5 * spread, -1, 1);
      // Aussehen in verschiedene Richtungen: mal größere Flossen und ein schmalerer Schwanz, mal ein
      // breiter Schwanz und eine kleine Rückenflosse … – jeder Nachkomme anders, dazu ein etwas anderer Farbton
      const look = LOOKS[(i - 1 + bodyOff) % LOOKS.length];
      const amt = () => (0.28 + 0.2 * rnd()) * spread;
      t.fin = clamp(t.fin + look[0] * amt(), -1, 1);
      t.tail = clamp(t.tail + look[1] * amt(), -1, 1);
      t.crest = clamp(t.crest + look[2] * amt(), -1, 1);
      t.tint = clamp(t.tint + (rnd() - 0.5) * 0.7 * spread, -1, 1);
      t.diet = clamp(t.diet + (rnd() - 0.5) * 0.25 * spread + ate * 0.12, -1, 1);
      const sex: Sex = (run.sex + i) % 2 ? 1 : 2;
      // nicht alle gleich groß: Männchen etwas größer, dazu etwas Streuung
      if (f !== 'growth') t.growth = clamp(t.growth + (rnd() - 0.45) * 0.22 * spread + (sex === 1 ? 0.04 : -0.04), 0, 1);
      const label = f === 'skull' ? skillName('skull', t) : SKILL_LABEL[f];
      out.push({ traits: t, sex, seed: run.seed + 1000 + run.epoch * 53 + i * 17, main: false, label, focus });
    }
    return out;
  }

  /** Dieses Tier führt die Linie weiter. */
  chooseOffspring(o: Offspring) {
    const run = this.r;
    run.traits = full({ ...o.traits });
    run.sex = o.sex;
    run.seed = o.seed;
    if (this.checkRamUnlock()) run.ramNew = true;
    this.save();
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

  /** Ein Merkmal wächst ein kleines Stück – je weiter entwickelt, desto langsamer. */
  grow(k: TraitKey, amount: number) {
    const t = this.r.traits;
    t[k] = Math.min(1, t[k] + amount * Math.pow(1 - t[k], 1.3));
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
    this.snap = { traits: { ...r.traits }, aggression: r.aggression, infamy: r.infamy };
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
  surviveEpoch(kinAlive: number, social?: number, pick?: Offspring, repeat = false): SurviveResult {
    const run = this.r;
    const i = run.epoch;
    const ep = EPOCHS[i];
    if (social !== undefined) run.social = clamp(social, 0.15, 0.9);
    if (repeat) {
      // Der Endgegner lebt noch: Die Linie bleibt in diesem Zeitalter – eine weitere Generation
      run.round = (run.round ?? 0) + 1;
      run.history.push({ cls: run.cls, traits: { ...run.traits }, epoch: i });
      if (run.history.length > 24) run.history.splice(1, 1);
      run.kin = clamp(kinAlive + 1, 2, 6);
      run.aggression *= 0.5;
      run.infamy *= 0.8;
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
    run.kin = clamp(kinAlive + 1, 2, 6);
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

  /** Gibt es schon einen Stammbaum (mindestens ein beendeter oder laufender Versuch)? */
  hasTree() {
    return this.data.runs > 0;
  }
}

export const game = new GameState();
