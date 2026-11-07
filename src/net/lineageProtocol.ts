import { isLineageEvolution, readLineageEvolution, type LineageEvolution } from '../sim/lineageEvolution';
import type { FishMark } from '../sim/fishEvolution';

/** Branches contain visual milestones, rather than every generation's training roll. */
export const MAX_EVOLUTION_TRACE = 24;
export const MAX_SPECIES_EGG_BYTES = 12000;
export const MAX_SPECIES_BRANCH_BYTES = 12000;

export function networkEvolution(value: unknown): LineageEvolution | undefined {
  return isLineageEvolution(value) ? readLineageEvolution(value) : undefined;
}

export function networkEvolutionTrace(value: unknown): LineageEvolution[] | undefined {
  if (typeof value === 'string') {
    if (value.length > MAX_SPECIES_BRANCH_BYTES) return undefined;
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  if (!Array.isArray(value) || !value.length || value.length > MAX_EVOLUTION_TRACE) return undefined;
  const trace = value.map(networkEvolution);
  return trace.every((state): state is LineageEvolution => !!state) ? trace : undefined;
}

export function networkFishTrace(value: unknown): FishMark[] | undefined {
  if (typeof value === 'string') {
    if (value.length > 1500) return undefined;
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  if (!Array.isArray(value) || !value.length || value.length > 8) return undefined;
  if (value.some(m => !m || !Number.isInteger(m.form) || m.form < 0 || m.form >= 48 || ![0, 1, 3].includes(m.primary))) return undefined;
  return value.map(m => ({ form: m.form, primary: m.primary }));
}

export interface NetworkSpeciesBranch {
  id: string;
  name: string;
  trace: FishMark[];
  evolutionTrace?: LineageEvolution[];
  extinct?: boolean;
}

export function networkSpeciesBranch(raw: unknown): NetworkSpeciesBranch | undefined {
  if (typeof raw !== 'string' || raw.length > MAX_SPECIES_BRANCH_BYTES) return undefined;
  try {
    const branch = JSON.parse(raw);
    if (!branch || typeof branch.id !== 'string' || !branch.id || branch.id.length > 200 || typeof branch.name !== 'string') return undefined;
    const evolutionTrace = branch.evolutionTrace === undefined ? undefined : networkEvolutionTrace(branch.evolutionTrace);
    if (branch.evolutionTrace !== undefined && !evolutionTrace) return undefined;
    const trace = networkFishTrace(branch.trace) ?? (evolutionTrace ? [{ form: 0, primary: 0 }] : undefined);
    if (!trace) return undefined;
    return { id: branch.id, name: branch.name.slice(0, 80), trace,
      ...(evolutionTrace ? { evolutionTrace } : {}), ...(branch.extinct === true ? { extinct: true } : {}) };
  } catch { return undefined; }
}

/** Training banks and generation counters may change within one visual milestone. */
const milestone = (state: LineageEvolution) => [state.habitatProgress, state.habitat ?? '', state.primary ?? '', state.tier].join(':');

export function continuesEvolution(before: readonly LineageEvolution[], next: readonly LineageEvolution[]): boolean {
  const same = (a: readonly LineageEvolution[], b: readonly LineageEvolution[]) => a.length <= b.length && a.every((state, i) => milestone(state) === milestone(b[i]));
  return same(before, next) || before.length === MAX_EVOLUTION_TRACE && next.length === MAX_EVOLUTION_TRACE && same(before.slice(1), next);
}

/** Stable archive key even when every new-core branch has the same legacy FishMark. */
export function evolutionArchiveKey(trace: readonly LineageEvolution[]): string {
  let hash = 2166136261;
  for (const char of trace.map(milestone).join('/')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
