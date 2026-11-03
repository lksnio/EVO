import type { ClassId } from '../data/classes';
import type { Sex, Traits } from '../state/GameState';

/** Personal history, never part of the shared brood or the zone protocol. Years are years before present. */
export interface LineageForm {
  cls: ClassId;
  traits: Partial<Traits>;
  hue: number;
  seed: number;
  sex: Sex;
}
export interface LineageSite {
  /** Stable station key; initially one breeding station per place. Coordinates alone do not split a station. */
  key: string;
  place: string;
  name: string;
  x: number;
  y: number;
}
export interface LineageSegment {
  id: string;
  epoch: number;
  site: LineageSite;
  from: number;
  to: number;
  first: LineageForm;
  last: LineageForm;
  births: { gen: number; years: number }[];
  seconds: number;
}
export interface LineageRun {
  id: number;
  epoch: number;
  status: 'alive' | 'extinct';
  cause?: string;
  /** Old saves did not record births: only the observed part can be dated. */
  legacy?: boolean;
  segments: LineageSegment[];
}
export interface LineageArchive {
  v: 1;
  runs: LineageRun[];
  marked?: string;
}
export const newLineage = (): LineageArchive => ({ v: 1, runs: [] });
export const markKey = (r: LineageRun, s: LineageSegment) => `${r.id}/${s.id}`;

function copyForm(f: LineageForm): LineageForm {
  return { ...f, traits: { ...f.traits } };
}

/** Call only for the offspring this player actually chooses, including a chosen sibling. */
export function recordBirth(a: LineageArchive, id: number, epoch: number, years: number, gen: number, site: LineageSite, form: LineageForm, legacy = false): LineageRun {
  let r = a.runs.find(r => r.id === id);
  if (!r) {
    r = { id, epoch, status: 'alive', segments: [], ...(legacy ? { legacy: true } : {}) };
    a.runs.push(r);
  }
  r.epoch = epoch;
  const prev = r.segments.at(-1);
  // Server clock corrections must never make a personal branch grow upwards.
  const at = prev ? Math.min(prev.to, years) : years;
  if (prev) prev.to = at;
  if (prev && prev.epoch === epoch && prev.site.key === site.key) {
    prev.births.push({ gen, years: at });
    prev.last = copyForm(form);
  } else {
    r.segments.push({ id: `s${r.segments.length + 1}`, epoch, site: { ...site }, from: at, to: at,
      first: copyForm(form), last: copyForm(form), births: [{ gen, years: at }], seconds: 0 });
  }
  return r;
}

export function observeLineage(r: LineageRun | undefined, years: number, seconds = 0) {
  const s = r?.segments.at(-1);
  if (!r || r.status !== 'alive' || !s) return;
  s.to = Math.min(s.to, years);
  s.seconds += Math.max(0, seconds);
}

export function endLineage(r: LineageRun | undefined, years: number, cause: string) {
  if (!r) return;
  observeLineage(r, years);
  r.status = 'extinct';
  r.cause = cause;
}

/** Reject damaged journal data without throwing away a valid game or fabricating old timestamps. */
export function readLineage(value: unknown): LineageArchive {
  const a = value as Partial<LineageArchive> | null;
  if (a?.v !== 1 || !Array.isArray(a.runs)) return newLineage();
  const ids = new Set<number>();
  const runs = a.runs.filter(r => {
    if (!r || !Number.isInteger(r.id) || r.id < 1 || ids.has(r.id) || !Array.isArray(r.segments) || !r.segments.length) return false;
    let previous = Infinity;
    const valid = r.segments.every((s, i) => {
      if (!s || s.id !== `s${i + 1}` || !Number.isInteger(s.epoch) || s.epoch < 0 || !Number.isFinite(s.from) || !Number.isFinite(s.to)
        || s.from > previous || s.to > s.from || !s.site || typeof s.site.key !== 'string' || typeof s.site.name !== 'string'
        || typeof s.site.place !== 'string' || !Number.isFinite(s.site.x) || !Number.isFinite(s.site.y)
        || !Number.isFinite(s.seconds) || s.seconds < 0 || !Array.isArray(s.births) || !s.births.length) return false;
      previous = s.to;
      const form = (f: LineageForm) => !!f && ['fish', 'amphibian', 'reptile', 'mammal'].includes(f.cls)
        && !!f.traits && typeof f.traits === 'object' && Object.values(f.traits).every(Number.isFinite)
        && Number.isFinite(f.hue) && Number.isFinite(f.seed) && (f.sex === 1 || f.sex === 2);
      return form(s.first) && form(s.last) && s.births.every(b => !!b && Number.isInteger(b.gen) && b.gen > 0 && Number.isFinite(b.years) && b.years <= s.from && b.years >= s.to);
    });
    if (valid && (r.status === 'alive' || r.status === 'extinct')) { ids.add(r.id); return true; }
    return false;
  });
  const marked = typeof a.marked === 'string' && runs.some(r => r.segments.some(s => markKey(r, s) === a.marked)) ? a.marked : undefined;
  return { v: 1, runs, ...(marked ? { marked } : {}) };
}

export interface TimeWindow { from: number; to: number }
export const TIME_WORLD: TimeWindow = { from: 419e6, to: 23e6 };
/** Actual geological time, never generation count or path length. */
export const timeFraction = (years: number, w: TimeWindow) => (w.from - years) / (w.from - w.to);
export const timeAt = (fraction: number, w: TimeWindow) => w.from - fraction * (w.from - w.to);
export function timeWindow(from: number, to: number): TimeWindow {
  const span = Math.max(10, Math.min(TIME_WORLD.from - TIME_WORLD.to, from - to));
  const top = Math.max(TIME_WORLD.to + span, Math.min(TIME_WORLD.from, from));
  return { from: top, to: top - span };
}
export function zoomTime(w: TimeWindow, factor: number, anchor = .5) {
  const at = timeAt(anchor, w), span = (w.from - w.to) * factor;
  return timeWindow(at + anchor * span, at - (1 - anchor) * span);
}
export function focusTime(runs: LineageRun[]): TimeWindow {
  const segments = runs.flatMap(r => r.segments);
  if (!segments.length) return { ...TIME_WORLD };
  const from = Math.max(...segments.map(s => s.from)), to = Math.min(...segments.map(s => s.to));
  const pad = Math.max(1000, (from - to) * .15);
  return timeWindow(from + pad, to - pad);
}
