/** Rules for the Devon fish. All reserves are measured in the points shown in the egg. */
export const FISH_BASE_STAMINA = 30;
export interface FishEffort {
  biteDamage?: number;
  ramDamage?: number;
  minHealth?: number;
}
export interface FishGains { hp: number; stamina: number; bite: number; skull: number; fins: number; scales: number }
export interface FishPlan { eaten: { meat: number; plant: number }; effort: FishEffort }
const coin = (random: () => number) => random() < .5 ? 0 : 1;
export function fishBirthGains(plan: FishPlan, random = Math.random, preview = false): { gains: FishGains; mutation: boolean } {
  const g: FishGains = { hp: 0, stamina: 0, bite: 0, skull: 0, fins: 0, scales: 0 };
  // One roll per egg. A mutant inherits its parent's other points exactly.
  if (!preview && random() < .1) return { gains: { ...g, fins: 5 }, mutation: true };
  const total = Math.max(0, plan.eaten.meat) + Math.max(0, plan.eaten.plant);
  const meat = total ? Math.max(0, plan.eaten.meat) / total : .5;
  const pick = (a: number, b: number) => preview ? (a + b) / 2 : coin(random) ? b : a;
  if (!total) { /* No nutrition, no nutrition roll; damage and injury still count below. */ }
  else if (meat >= .9) { g.hp = pick(3,4); g.stamina = -pick(1,2); }
  else if (meat <= .1 + 1e-12) { g.stamina = pick(3,4); g.hp = -pick(1,2); }
  else if (meat >= .75) g.hp = pick(1,2);
  else if (meat <= .25) g.stamina = pick(1,2);
  else { g.hp = pick(-1,1); g.stamina = pick(-1,1); }
  // Actual damage, already weighted by opponent size. No food or kill requirement.
  // 100 weighted damage is a full +4 generation; partial training stays continuous.
  g.bite = Math.min(4, Math.max(0, plan.effort.biteDamage ?? 0) / 25);
  g.skull = Math.min(4, Math.max(0, plan.effort.ramDamage ?? 0) / 25);
  const low = Math.max(0, Math.min(1, plan.effort.minHealth ?? 1));
  g.scales = low < .1 ? 3 : low < .25 ? 2 : low < .5 ? 1 : low >= .75 ? -1 : 0;
  if (g.scales >= 2) g.fins = -1;
  return { gains: g, mutation: false };
}
export function weightedFishDamage(damage: number, targetHp: number, baseHp: number) {
  return Math.max(0, damage) * Math.sqrt(Math.max(1, targetHp / Math.max(1, baseHp)));
}
export function finSpeed(points: number) {
  const n = Math.max(10, Math.min(100, points));
  return n <= 20 ? 1 + (n-10)*.05 : n <= 50 ? 1.5 + (n-20)/60 : 2 + (n-50)/50;
}
export const finStage = (points: number) => points >= 100 ? 3 : points >= 50 ? 2 : points >= 20 ? 1 : 0;
export interface FishMark { form: number; primary: number }
export function appendFishMark(trace: readonly FishMark[] | undefined, form: number, primary = 0): FishMark[] {
  primary=primary===1||primary===3?primary:0;
  const out = (trace ?? [{ form: 0, primary: 0 }]).map(m => ({ form:m.form,primary:m.primary===1||m.primary===3?m.primary:0 }));
  if (out.at(-1)?.form !== form) out.push({ form, primary });
  else out[out.length-1].primary=primary;
  return out;
}
export const fishMarkKey = (trace: readonly FishMark[]) => trace.map(m => `${m.form}.${m.primary}`).join('/');
