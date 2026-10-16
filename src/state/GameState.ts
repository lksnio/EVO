import Phaser from 'phaser';
import { CLASSES, CLASS_ORDER, classIndex, type ClassId, type Stats } from '../data/classes';
import { PARTS, PART_ORDER, type PartId } from '../data/parts';
import { ERAS, eraById, eraIndex, neighbors, type EraDef, type EraId } from '../data/eras';
import type { Appearance } from '../art/creatureArt';
import { DEBUG } from '../config';

const KEY = 'evo-save-v1';

export interface SaveData {
  v: 1;
  evo: number;
  totalEvo: number;
  cls: ClassId;
  parts: Record<PartId, number>;
  owned: Record<PartId, number[]>;
  completed: string[];
  bosses: string[];
  mapPos: Record<string, string>;
  muted: boolean;
  seenIntro: boolean;
  finished: boolean;
  deaths: number;
}

function fresh(): SaveData {
  const parts = Object.fromEntries(PART_ORDER.map((p) => [p, 0])) as Record<PartId, number>;
  const owned = Object.fromEntries(PART_ORDER.map((p) => [p, [0]])) as Record<PartId, number[]>;
  return {
    v: 1, evo: 0, totalEvo: 0, cls: 'fish', parts, owned,
    completed: [], bosses: [], mapPos: {}, muted: false, seenIntro: false, finished: false, deaths: 0,
  };
}

/** Ereignisse zwischen den Szenen (HUD, Level, Karte …). */
export const bus = new Phaser.Events.EventEmitter();

export type BuyResult = 'ok' | 'owned' | 'poor' | 'locked';

class GameState {
  data: SaveData = fresh();

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const f = fresh();
        this.data = { ...f, ...d, parts: { ...f.parts, ...d.parts }, owned: { ...f.owned, ...d.owned } } as SaveData;
      }
    } catch {
      this.data = fresh();
    }
    if (DEBUG && this.data.evo < 5000) this.data.evo = 5000;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* Speichern nicht möglich (z. B. privates Fenster) – Spiel läuft trotzdem. */
    }
  }

  hasProgress() {
    return this.data.totalEvo > 0 || this.data.completed.length > 0;
  }

  reset() {
    const muted = this.data.muted;
    this.data = fresh();
    this.data.muted = muted;
    if (DEBUG) this.data.evo = 5000;
    this.save();
  }

  get evo() {
    return this.data.evo;
  }

  addEvo(n: number) {
    this.data.evo += n;
    this.data.totalEvo += n;
    bus.emit('evo', this.data.evo);
  }

  // ---------- Werte & Aussehen ----------

  stats(cls: ClassId = this.data.cls, parts: Record<PartId, number> = this.data.parts): Stats {
    const s = { ...CLASSES[cls].base };
    let mul = 1;
    for (const id of PART_ORDER) {
      if (id === 'farbe') continue;
      if (id === 'beine' && cls === 'fish') continue;
      const o = PARTS[id].options[parts[id]];
      if (!o) continue;
      if (o.mods) for (const k of Object.keys(o.mods) as (keyof Stats)[]) s[k] += o.mods[k] ?? 0;
      if (o.speedMul) mul *= o.speedMul;
    }
    s.speed = Math.round(s.speed * mul);
    return s;
  }

  appearance(cls: ClassId = this.data.cls, parts: Record<PartId, number> = this.data.parts): Appearance {
    return {
      cls,
      kiefer: parts.kiefer,
      horn: parts.horn,
      koerper: parts.koerper,
      haut: parts.haut,
      schwanz: parts.schwanz,
      beine: cls === 'fish' ? 0 : parts.beine,
      farbe: parts.farbe,
    };
  }

  // ---------- Evolution ----------

  optionAllowed(cat: PartId, idx: number, cls: ClassId = this.data.cls) {
    const c = PARTS[cat];
    if (c.landOnly && cls === 'fish') return false;
    return classIndex(cls) >= classIndex(c.options[idx].minClass);
  }

  isOwned(cat: PartId, idx: number) {
    return this.data.owned[cat].includes(idx);
  }

  /** Kosten für eine Option (0, wenn schon einmal gekauft). */
  costOf(cat: PartId, idx: number) {
    return this.isOwned(cat, idx) ? 0 : PARTS[cat].options[idx].cost;
  }

  buyPart(cat: PartId, idx: number): BuyResult {
    if (this.data.parts[cat] === idx) return 'owned';
    if (!this.optionAllowed(cat, idx)) return 'locked';
    const cost = this.costOf(cat, idx);
    if (cost > this.data.evo) return 'poor';
    this.data.evo -= cost;
    if (!this.isOwned(cat, idx)) this.data.owned[cat].push(idx);
    this.data.parts[cat] = idx;
    this.save();
    bus.emit('evo', this.data.evo);
    bus.emit('evolved');
    return 'ok';
  }

  nextClass(): ClassId | null {
    const i = classIndex(this.data.cls);
    return i < CLASS_ORDER.length - 1 ? CLASS_ORDER[i + 1] : null;
  }

  classUnlocked(cls: ClassId) {
    const req = CLASSES[cls].requiresEra;
    return !req || this.data.bosses.includes(req) || DEBUG;
  }

  buyClass(cls: ClassId): BuyResult {
    if (cls !== this.nextClass()) return 'locked';
    if (!this.classUnlocked(cls)) return 'locked';
    const cost = CLASSES[cls].cost;
    if (cost > this.data.evo) return 'poor';
    this.data.evo -= cost;
    this.data.cls = cls;
    this.save();
    bus.emit('evo', this.data.evo);
    bus.emit('evolved');
    return 'ok';
  }

  // ---------- Fortschritt ----------

  eraUnlocked(era: EraDef) {
    const i = eraIndex(era.id);
    return i === 0 || this.data.bosses.includes(ERAS[i - 1].id) || DEBUG;
  }

  /** Warum eine Ära gerade nicht spielbar ist (oder null, wenn sie es ist). */
  eraBlockReason(era: EraDef): string | null {
    if (!this.eraUnlocked(era)) return 'Noch verschlossen';
    const ci = classIndex(this.data.cls);
    if (ci < classIndex(era.minClass)) return `Entwickle dich zuerst zum ${CLASSES[era.minClass].name}`;
    if (era.maxClass && ci > classIndex(era.maxClass)) return 'Du kannst nicht mehr unter Wasser atmen';
    return null;
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

  /** Markiert einen Ort als geschafft. Gibt true zurück, wenn es das erste Mal war. */
  completeNode(eraId: EraId, nodeId: string) {
    const first = !this.isCompleted(nodeId);
    if (first) this.data.completed.push(nodeId);
    const era = eraById(eraId);
    const node = era.nodes.find((n) => n.id === nodeId);
    if (node?.boss && !this.data.bosses.includes(eraId)) this.data.bosses.push(eraId);
    this.save();
    return first;
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
    for (const e of ERAS) if (!this.eraBlockReason(e)) best = e;
    return best;
  }
}

export const game = new GameState();
