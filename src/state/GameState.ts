import Phaser from 'phaser';
import { CLASSES, classIndex, type ClassId } from '../data/classes';
import { ERAS, eraById, eraIndex, neighbors, type EraDef, type EraId } from '../data/eras';
import { DEBUG } from '../config';
import type { Morph } from '../art/creatureArt';
import { clamp } from '../util/math';

// ---------------------------------------------------------------------------
// Das verborgene Anpassungssystem.
//
// Der Spieler wählt nichts aus. Was er TUT, verändert sein Tier – Stück für Stück:
//   jaw     – wächst durch Beißen und Fleischfressen (stärkeres Gebiss)
//   skull   – wächst durch Rammen mit hohem Tempo (dickerer Schädel)
//   stealth – wächst durch Pflanzenfressen, Ausweichen und Verstecken
//             (kleiner, schneller, besser getarnt)
//   growth  – wächst mit allem, was gefressen wird (Körpergröße)
//   diet    – -1 Pflanzenfresser … +1 Fleischfresser (verdaut die eine Kost besser)
//   scars   – Narben überlebter Kämpfe
// Dazu kommt der Ruf: Wer oft angreift, vor dem haben andere Tiere Angst.
// Nichts davon wird angezeigt – man sieht es nur am Tier und am Verhalten der anderen.
// ---------------------------------------------------------------------------

export interface Traits {
  jaw: number;
  skull: number;
  stealth: number;
  growth: number;
  diet: number;
  scars: number;
}

export type TraitKey = 'jaw' | 'skull' | 'stealth' | 'growth';

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

/** Ein Vorfahre: so sah das Tier aus, als es einen Ort überlebt hatte. */
export interface Ancestor {
  cls: ClassId;
  traits: Traits;
  era: EraId;
}

export interface SaveData {
  v: 2;
  cls: ClassId;
  traits: Traits;
  /** kurzfristige Angriffslust */
  aggression: number;
  /** Ruf, der über Generationen bleibt */
  infamy: number;
  hue: number;
  seed: number;
  completed: string[];
  eras: string[];
  reached: string[];
  mapPos: Record<string, string>;
  muted: boolean;
  seenIntro: boolean;
  finished: boolean;
  deaths: number;
  generations: number;
  /** Die Ahnenreihe (nur das Aussehen, keine Werte). */
  history: Ancestor[];
}

const KEY = 'evo-save-v2';

function fresh(): SaveData {
  return {
    v: 2,
    cls: 'fish',
    traits: { jaw: 0, skull: 0, stealth: 0, growth: 0, diet: 0, scars: 0 },
    aggression: 0,
    infamy: 0,
    hue: Math.floor(Math.random() * 4),
    seed: Math.floor(Math.random() * 100000),
    completed: [],
    eras: [],
    reached: ['ozean'],
    mapPos: {},
    muted: false,
    seenIntro: false,
    finished: false,
    deaths: 0,
    generations: 1,
    history: [],
  };
}

/** Ereignisse zwischen den Szenen (HUD, Level, Karte …). */
export const bus = new Phaser.Events.EventEmitter();

interface Snapshot {
  traits: Traits;
  aggression: number;
  infamy: number;
}

export interface CompleteResult {
  first: boolean;
  /** Zeitalter abgeschlossen → Übergang zur nächsten Form */
  transition?: { from: ClassId; to: ClassId; era: EraId };
  finished?: boolean;
}

class GameState {
  data: SaveData = fresh();
  private snap: Snapshot | null = null;

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const f = fresh();
        this.data = { ...f, ...d, traits: { ...f.traits, ...d.traits } } as SaveData;
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

  hasProgress() {
    return this.data.completed.length > 0 || this.data.deaths > 0;
  }

  reset() {
    const muted = this.data.muted;
    this.data = fresh();
    this.data.muted = muted;
    this.save();
  }

  get cls() {
    return this.data.cls;
  }

  get traits() {
    return this.data.traits;
  }

  // ---------------------------------------------------------------- Werte

  stats(cls: ClassId = this.data.cls, t: Traits = this.data.traits): Stats {
    const b = CLASSES[cls].base;
    const size = clamp(0.85 + 0.5 * t.growth - 0.28 * t.stealth, 0.68, 1.45);
    const carn = Math.max(0, t.diet), herb = Math.max(0, -t.diet);
    const bite = b.bite * size * (1 + 2.2 * t.jaw) * (1 + 0.25 * carn);
    const ram = b.ram * size * (1 + 2.6 * t.skull);
    return {
      maxHp: Math.round(b.hp * Math.pow(size, 1.3) * (1 + 0.25 * t.skull)),
      bite,
      ram,
      ramSelf: b.ram * 0.55 * Math.pow(1 - t.skull, 2),
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
  morph(o: { cls?: ClassId; traits?: Traits; belly?: number; fierce?: number } = {}): Morph {
    const cls = o.cls ?? this.data.cls;
    const t = o.traits ?? this.data.traits;
    return {
      cls,
      size: this.stats(cls, t).size,
      jaw: t.jaw,
      skull: t.skull,
      stealth: t.stealth,
      diet: t.diet,
      scars: t.scars,
      belly: o.belly ?? 1,
      fierce: o.fierce ?? this.fear(),
      hue: this.data.hue,
      seed: this.data.seed,
    };
  }

  /** Wie gefährlich andere Tiere dich einschätzen. */
  fear() {
    return clamp(this.data.aggression * 0.7 + this.data.infamy * 0.6, 0, 1);
  }

  threat() {
    return this.stats().power * (0.65 + 0.9 * this.fear());
  }

  // ---------------------------------------------------------------- Anpassung

  /** Ein Merkmal wächst ein kleines Stück – je weiter entwickelt, desto langsamer. */
  grow(k: TraitKey, amount: number) {
    const t = this.data.traits;
    t[k] = Math.min(1, t[k] + amount * Math.pow(1 - t[k], 1.3));
  }

  shiftDiet(amount: number) {
    const t = this.data.traits;
    t.diet = clamp(t.diet + amount, -1, 1);
  }

  addScar() {
    this.data.traits.scars = Math.min(6, this.data.traits.scars + 1);
  }

  addAggression(a: number) {
    this.data.aggression = clamp(this.data.aggression + a, 0, 1);
    this.data.infamy = clamp(this.data.infamy + a * 0.22, 0, 1);
  }

  /** Friedliche Zeit lässt die Angriffslust abklingen. */
  calm(dt: number) {
    this.data.aggression = Math.max(0, this.data.aggression - 0.006 * dt);
  }

  /** Zustand zu Beginn eines Levels merken (Tod/Abbruch setzt darauf zurück). */
  beginJourney() {
    this.snap = {
      traits: { ...this.data.traits },
      aggression: this.data.aggression,
      infamy: this.data.infamy,
    };
  }

  startTraits(): Traits {
    return this.snap ? { ...this.snap.traits } : { ...this.data.traits };
  }

  revertJourney() {
    if (!this.snap) return;
    this.data.traits = { ...this.snap.traits };
    this.data.aggression = this.snap.aggression;
    this.data.infamy = this.snap.infamy;
  }

  // ---------------------------------------------------------------- Fortschritt

  eraReached(era: EraDef) {
    return this.data.reached.includes(era.id) || DEBUG;
  }

  /** Kann die aktuelle Form dieses Zeitalter bereisen? */
  eraPlayable(era: EraDef) {
    if (!this.eraReached(era)) return false;
    const c = CLASSES[this.data.cls];
    if (c.habitat !== era.habitat) return false;
    return classIndex(this.data.cls) >= classIndex(era.cls);
  }

  isCompleted(nodeId: string) {
    return this.data.completed.includes(nodeId);
  }

  nodeOpen(era: EraDef, nodeId: string) {
    const n = era.nodes.find((x) => x.id === nodeId);
    if (!n) return false;
    if (n.start || this.isCompleted(nodeId) || DEBUG) return true;
    return neighbors(era, nodeId).some((id) => this.isCompleted(id));
  }

  eraProgress(era: EraDef) {
    return era.nodes.filter((n) => this.isCompleted(n.id)).length;
  }

  completeNode(eraId: EraId, nodeId: string): CompleteResult {
    const first = !this.isCompleted(nodeId);
    if (first) this.data.completed.push(nodeId);
    const era = eraById(eraId);
    const node = era.nodes.find((n) => n.id === nodeId);
    const res: CompleteResult = { first };
    this.data.history.push({ cls: this.data.cls, traits: { ...this.data.traits }, era: eraId });
    if (this.data.history.length > 24) this.data.history.splice(1, 1);
    if (node?.boss && !this.data.eras.includes(eraId)) {
      this.data.eras.push(eraId);
      const next = ERAS[eraIndex(eraId) + 1];
      if (next) {
        if (!this.data.reached.includes(next.id)) this.data.reached.push(next.id);
        if (next.cls !== this.data.cls) {
          res.transition = { from: this.data.cls, to: next.cls, era: next.id };
          this.data.cls = next.cls;
        }
      } else {
        this.data.finished = true;
        res.finished = true;
      }
    }
    this.data.generations += 1;
    // Der Ruf verblasst über die Generationen etwas
    this.data.aggression *= 0.5;
    this.data.infamy *= 0.8;
    this.save();
    return res;
  }

  mapPos(era: EraDef) {
    const p = this.data.mapPos[era.id];
    return p && era.nodes.some((n) => n.id === p) ? p : era.nodes.find((n) => n.start)!.id;
  }

  setMapPos(eraId: EraId, nodeId: string) {
    this.data.mapPos[eraId] = nodeId;
    this.save();
  }

  /** Die Ära, die am besten zum aktuellen Stand passt. */
  suggestedEra(): EraDef {
    let best = ERAS[0];
    for (const e of ERAS) if (this.eraPlayable(e)) best = e;
    return best;
  }
}

export const game = new GameState();
