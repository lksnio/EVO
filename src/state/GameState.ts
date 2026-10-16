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
//   stealth – wächst durch Pflanzenfressen, Ausweichen und Verstecken
//   growth  – wächst mit allem, was gefressen wird (Körpergröße)
//   diet    – -1 Pflanzenfresser … +1 Fleischfresser
//   scars   – Narben überlebter Kämpfe
//   spike   – Richtung des Kopfpanzers: -1 harter Schädel (wer einsteckt) … +1 Stachelkopf (wer austeilt)
//   green   – Tarnfarbe vom Verstecken zwischen Pflanzen
//   sand    – Tarnfarbe vom Verstecken am Boden und in Höhlen
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
}

export type TraitKey = 'jaw' | 'skull' | 'stealth' | 'growth' | 'green' | 'sand';

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
  history: Ancestor[];
}

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
const ZERO: Traits = { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0, spike: 0, green: 0, sand: 0 };

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
    const size = clamp(0.85 + 0.5 * t.growth - 0.28 * t.stealth, 0.68, 1.45);
    const carn = Math.max(0, t.diet), herb = Math.max(0, -t.diet);
    const spikes = Math.max(0, t.spike ?? 0) * t.skull, plates = Math.max(0, -(t.spike ?? 0)) * t.skull;
    const bite = b.bite * size * (1 + 2.2 * t.jaw) * (1 + 0.25 * carn);
    const ram = b.ram * size * (1 + 2.6 * t.skull) * (1 + 0.8 * spikes);
    return {
      maxHp: Math.round(b.hp * Math.pow(size, 1.3) * (1 + 0.25 * t.skull + 0.2 * plates)),
      bite,
      ram,
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2) * (1 - 0.6 * plates),
      speed: b.speed * (1 + 0.38 * t.stealth) * (1.12 - 0.14 * size),
      jump: b.jump * (1 + 0.12 * t.stealth),
      size,
      defense: clamp(1 - 0.28 * t.skull - 0.08 * (size - 1), 0.5, 1.1),
      power: bite * 0.6 + ram * 0.4,
      detect: 1 - 0.55 * t.stealth,
      digestMeat: 1 + 0.4 * carn - 0.5 * herb,
      digestPlant: 1 + 0.4 * herb - 0.5 * carn,
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
      belly: o.belly ?? 1,
      fierce: o.fierce ?? (run ? this.fear() : 0),
      hue: o.hue ?? run?.hue ?? 0,
      seed: o.seed ?? run?.seed ?? 1,
      sex: o.sex ?? run?.sex ?? 0,
    };
  }

  /** Ein Artgenosse: fast wie du – nur kleine Abweichungen, Männchen oder Weibchen. */
  kinMorph(i: number, belly = 1): Morph {
    const run = this.r;
    const rnd = mulberry32(run.seed * 31 + run.epoch * 977 + i * 101);
    const j = (v: number, a: number) => clamp(v + (rnd() - 0.5) * 2 * a, 0, 1);
    const t = run.traits;
    const sex: Sex = (i + run.id) % 2 ? 1 : 2;
    const traits: Traits = {
      jaw: j(t.jaw, 0.07),
      skull: j(t.skull, 0.07),
      stealth: j(t.stealth, 0.07),
      growth: j(t.growth + (sex === 1 ? 0.06 : -0.06), 0.06),
      diet: t.diet,
      scars: rnd() < 0.3 ? 1 : 0,
      spike: t.spike,
      green: j(t.green, 0.05),
      sand: j(t.sand, 0.05),
    };
    return this.morph({ traits, belly, fierce: 0, seed: run.seed + 1000 + i * 17, sex });
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

  /** Kopfpanzer: + Richtung Stachelkopf, - Richtung harter Schädel */
  shiftSpike(amount: number) {
    const t = this.r.traits;
    t.spike = clamp((t.spike ?? 0) + amount, -1, 1);
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
  surviveEpoch(kinAlive: number, social?: number): SurviveResult {
    const run = this.r;
    const i = run.epoch;
    const ep = EPOCHS[i];
    if (social !== undefined) run.social = clamp(social, 0.15, 0.9);
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
    if (next) {
      // Über Jahrmillionen setzt sich fort, was sich in diesem Zeitalter bewährt hat
      const start = this.snap?.traits ?? run.traits;
      const k = 0.6 + 0.35 * Math.log10(1 + (ep.to - next.from) / 1e6);
      const t = run.traits;
      for (const key of ['jaw', 'skull', 'stealth', 'growth', 'green', 'sand'] as const) {
        const d = t[key] - (start[key] ?? 0);
        if (d > 0) t[key] = Math.min(1, t[key] + d * k);
      }
      t.diet = clamp(t.diet + (t.diet - start.diet) * k * 0.6, -1, 1);
      t.spike = clamp(t.spike + (t.spike - (start.spike ?? 0)) * k * 0.6, -1, 1);
      res.drift!.after = { ...t };
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
