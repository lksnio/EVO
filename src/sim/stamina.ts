/** Feste Kosten relativ zur Anfangsausdauer, unabhängig von der späteren Reserve. */
export const FISH_ATTACK_COST = { bite: 1 / 5, ram: 1 / 8 } as const;

/** Reserve points are independent of fins. Start reserve: 30 points = one full base bar. */
export function fishStaminaMax(stamina:number):number {
  return Number.isFinite(stamina)?Math.max(1,stamina/30):1;
}

/** Kein Angriff auf Kredit; Toleranz nur für Rundungsreste nach mehreren Angriffen. */
export function spendStamina(available: number, cost: number): number | null {
  if (!Number.isFinite(available) || available + 1e-9 < cost) return null;
  return Math.max(0, available - cost);
}
