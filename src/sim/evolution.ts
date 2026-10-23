import { INHERIT } from '../data/life';
import { clamp } from '../util/math';

export const COMBAT_SKILLS = ['bite', 'skull', 'fins', 'scales'] as const;
export type CombatSkill = typeof COMBAT_SKILLS[number];
export type Gains = Record<'hp' | CombatSkill, number>;
/** Anzahl und aufsummierte relative Stärke der besiegten Gegner, anteilig nach eingesetzter Fähigkeit. */
export type Defeats = Partial<Record<CombatSkill, { count: number; strength: number }>>;

/** Ein Gegner zählt insgesamt einmal, auch wenn mehrere Fähigkeiten am Sieg beteiligt waren. */
export function recordDefeat(defeats: Defeats, used: Partial<Record<CombatSkill, number>>, strength: number) {
  const total = COMBAT_SKILLS.reduce((n, k) => n + Math.max(0, used[k] ?? 0), 0);
  if (!(total > 0) || !(strength > 0)) return;
  for (const key of COMBAT_SKILLS) {
    const share = Math.max(0, used[key] ?? 0) / total;
    if (!share) continue;
    const at = (defeats[key] ??= { count: 0, strength: 0 });
    at.count += share;
    at.strength += share * strength;
  }
}

/** Nahrungsanteile bestimmen das Budget; Anzahl × mittlere Gegnerstärke bestimmt, wie viel davon erspielt wurde. */
export function evolutionBudget(eaten: { plant: number; meat: number }, defeats: Defeats): Gains {
  const plant = Math.max(0, eaten.plant), meat = Math.max(0, eaten.meat), total = plant + meat;
  const out: Gains = { hp: 0, bite: 0, skull: 0, fins: 0, scales: 0 };
  if (!total) return out;
  out.hp = INHERIT.points * plant / total;
  const strength = COMBAT_SKILLS.reduce((n, key) => n + Math.max(0, defeats[key]?.strength ?? 0), 0);
  if (!strength) return out;
  const earned = clamp(strength / Math.max(1, INHERIT.defeats), 0, 1);
  for (const key of COMBAT_SKILLS) out[key] = INHERIT.points * meat / total * earned * Math.max(0, defeats[key]?.strength ?? 0) / strength;
  return out;
}

/** Nur der Zugewinn streut. Der Gegenwert verliert immer die Hälfte der unteren Schranke, unabhängig vom Wurf. */
export function evolutionStep(base: Gains, random = Math.random): Gains {
  const out = { ...base };
  for (const key of ['hp', ...COMBAT_SKILLS] as const) out[key] = base[key] > 0 ? base[key] * (1 + INHERIT.vary * (2 * random() - 1)) : 0;
  const cost = (key: CombatSkill) => base[key] * (1 - INHERIT.vary) / 2;
  out.bite -= cost('skull');
  out.skull -= cost('bite');
  out.fins -= cost('scales');
  out.scales -= cost('fins');
  return out;
}
