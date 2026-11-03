import { COLLECTION_FOSSILS, COLLECTION_SHELLS, type CollectionId, type FossilId, type ShellId } from '../data/collection';

export interface FossilDrop {
  id: FossilId;
  epoch: string;
  place: string;
  x: number;
  y: number;
}

export interface CollectionState {
  v: 1;
  shells: ShellId[];
  fossils: FossilId[];
  pending: FossilDrop[];
  seen: CollectionId[];
  heard: number;
}

export const newCollection = (): CollectionState => ({ v: 1, shells: [], fossils: [], pending: [], seen: [], heard: 0 });
export const isShellId = (id: unknown): id is ShellId => COLLECTION_SHELLS.some(s => s.id === id);
export const isFossilId = (id: unknown): id is FossilId => COLLECTION_FOSSILS.some(f => f.id === id);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Old numeric shell currencies never become discoveries. Unknown/duplicate IDs are discarded. */
export function readCollection(value: unknown): CollectionState {
  const c = newCollection();
  if (!record(value) || value.v !== 1) return c;
  c.shells = [...new Set(Array.isArray(value.shells) ? value.shells.filter(isShellId) : [])];
  c.fossils = [...new Set(Array.isArray(value.fossils) ? value.fossils.filter(isFossilId) : [])];
  if (Array.isArray(value.pending)) for (const d of value.pending) {
    if (!record(d) || !isFossilId(d.id) || c.fossils.includes(d.id) || c.pending.some(p => p.id === d.id)) continue;
    if (typeof d.epoch !== 'string' || typeof d.place !== 'string' || d.epoch.length > 40 || d.place.length > 40) continue;
    if (typeof d.x !== 'number' || typeof d.y !== 'number' || !Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
    c.pending.push({ id: d.id, epoch: d.epoch, place: d.place, x: Math.max(0, Math.min(1e6, d.x)), y: Math.max(0, Math.min(1e6, d.y)) });
  }
  const owned = [...c.shells.map(id => `shell:${id}` as const), ...c.fossils.map(id => `fossil:${id}` as const)];
  c.seen = owned.filter(id => Array.isArray(value.seen) && value.seen.includes(id));
  c.heard = typeof value.heard === 'number' && Number.isFinite(value.heard) ? Math.max(0, Math.min(c.shells.length, Math.floor(value.heard))) : 0;
  return c;
}

export function findShell(c: CollectionState, id: ShellId): boolean {
  if (!isShellId(id) || c.shells.includes(id)) return false;
  c.shells.push(id);
  return true;
}

/** Register a first confirmed defeat before spawning the physical plate. Pending finds survive leaving/dying. */
export function dropFossil(c: CollectionState, d: FossilDrop): boolean {
  if (!isFossilId(d.id) || c.fossils.includes(d.id) || c.pending.some(p => p.id === d.id)) return false;
  c.pending.push({ ...d });
  return true;
}

export function findFossil(c: CollectionState, id: FossilId): boolean {
  if (!isFossilId(id) || c.fossils.includes(id) || !c.pending.some(p => p.id === id)) return false;
  c.fossils.push(id);
  c.pending = c.pending.filter(p => p.id !== id);
  return true;
}

/** Remove the obsolete currency and every purchased/golden blessing, without touching inherited traits. */
export function removeLegacyShells(data: unknown): boolean {
  if (!record(data)) return false;
  let changed = false;
  const remove = (r: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) if (key in r) { delete r[key]; changed = true; }
  };
  remove(data, ['shells', 'seenShells', 'keptUps']);
  const parked = record(data.parked) ? Object.values(data.parked) : [];
  for (const r of [data.run, ...parked]) {
    if (!record(r)) continue;
    remove(r, ['shells', 'blessings', 'seenRows', 'ups', 'upLog', 'upHint', 'gold']);
    for (const key of ['pool', 'next']) if (Array.isArray(r[key])) {
      for (const egg of r[key]) if (record(egg)) remove(egg, ['gold']);
    }
    if (record(r.life) && Array.isArray(r.life.clutches)) for (const clutch of r.life.clutches) {
      if (record(clutch)) remove(clutch, ['gold']);
    }
  }
  return changed;
}
