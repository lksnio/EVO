import { CLASSES } from '../data/classes';
import { LINEAGE_FORMS } from '../sim/lineageEvolution';
import type { Morph } from '../art/creatureArt';
import { clamp } from '../util/math';

/** Accept only the numeric appearance fields and explicitly supported body-form IDs from a peer. */
export function networkMorph(value: unknown): Morph | undefined {
  if (typeof value === 'string') {
    if (value.length > 4000) return undefined;
    try { value = JSON.parse(value); } catch { return undefined; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.cls !== 'string' || !Object.hasOwn(CLASSES, raw.cls)) return undefined;
  const morph: Record<string, unknown> = { cls: raw.cls };
  for (const [key, number] of Object.entries(raw)) {
    if (key === 'lineageForm') continue;
    if (typeof number === 'number' && Number.isFinite(number)) morph[key] = clamp(number, -1e6, 1e6);
  }
  morph.size = clamp(Number(morph.size) || 1, 0.15, 2.5);
  if (raw.cls === 'fish' && typeof raw.lineageForm === 'string' && LINEAGE_FORMS.some(form => form === raw.lineageForm)) {
    morph.lineageForm = raw.lineageForm;
  }
  return morph as unknown as Morph;
}
