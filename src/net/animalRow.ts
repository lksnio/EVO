import type { Animal } from '../objects/Animal';
import type { AnimalRow } from './protocol';

/** Nur Zustand des Tiers übertragen, niemals Sichtbarkeit oder Nebelfärbung eines Spielers. */
export function animalRow(a: Animal): AnimalRow {
  return {
    id: a.netId, sp: a.def.id,
    x: Math.round(a.x * 10) / 10, y: Math.round(a.y * 10) / 10,
    d: a.flipX ? -1 : 1, an: Math.round(a.angle),
    hp: Math.round(Math.max(0, a.hp) * 10) / 10, mh: Math.round(a.maxHp * 10) / 10,
    sz: Math.round(a.sz * 1000) / 1000,
    tn: a.glowing && a.isTinted ? a.tintTopLeft : 0,
    al: Math.round(a.presence * 100), at: a.attacking,
  };
}
