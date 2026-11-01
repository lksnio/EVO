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

const KEYS = ['hp', ...COMBAT_SKILLS] as const;

/** Was Schuppen und Tempo (Flossen) unabhängig von erlegten Gegnern aus der Spielweise bringen – feste Zuwächse ohne Streuung. */
export interface Effort {
  /** überstandene Treffer (gewichtet nach Schwere) */
  hurt?: number;
  /** Sekunden nahe am Tod (unter INHERIT.bonus.dangerHp der Lebenskraft) */
  danger?: number;
  /** Strecke mit Tempo und eingeholte Flüchtende */
  swim?: number;
  chase?: number;
  /** Sekunden im Strömungsschub (gewichtet: Spurt und Stoß darin zählen mehr) */
  flowTime?: number;
}

export function evolutionBonus(e: Effort): Gains {
  const B = INHERIT.bonus;
  const out: Gains = { hp: 0, bite: 0, skull: 0, fins: 0, scales: 0 };
  const hurt = Math.max(0, e.hurt ?? 0), danger = Math.max(0, e.danger ?? 0);
  const near = danger > 0 ? 1 : 0;
  // +2 bis +3 für überstandene Kämpfe; war man dem Tod nahe, mindestens volle Stufe und noch mehr je nach Dauer (bis +5)
  out.scales = B.scalesHurt * Math.max(clamp(hurt / B.hurtRef, 0, 1), near) + near * (B.dangerMin + (B.dangerMax - B.dangerMin) * clamp(danger / B.dangerRef, 0, 1));
  out.fins = B.finsSwim * clamp((e.swim ?? 0) / B.swimRef, 0, 1) + B.finsChase * clamp((e.chase ?? 0) / B.chaseRef, 0, 1) + B.finsFlow * clamp((e.flowTime ?? 0) / B.flowRef, 0, 1);
  return out;
}

/**
 * Gewichtung, dann Streuung (nur des erspielten Zugewinns), dann fester Bonus – und als letzter Schritt bekommt jedes Feld
 * +1 oder −1. Der Gegenwert verliert immer die Hälfte der unteren Schranke, unabhängig vom Wurf. random: 0,5 gibt die
 * neutrale Vorschau (keine Streuung, keine ±1).
 */
export function evolutionStep(base: Gains, random = Math.random, fixed?: Partial<Gains>): Gains {
  const W = INHERIT.weight;
  const w = { ...base };
  for (const key of KEYS) w[key] = base[key] * W[key];
  const out = { ...w };
  for (const key of KEYS) out[key] = w[key] > 0 ? w[key] * (1 + INHERIT.vary * (2 * random() - 1)) : 0;
  const cost = (key: CombatSkill) => w[key] * (1 - INHERIT.vary) / 2;
  out.bite -= cost('skull');
  out.skull -= cost('bite');
  out.fins -= cost('scales');
  out.scales -= cost('fins');
  for (const key of KEYS) out[key] += fixed?.[key] ?? 0;
  for (const key of KEYS) out[key] += INHERIT.final * Math.sign(random() - 0.5);
  return out;
}
