/** Feste Kosten relativ zur Anfangsausdauer, unabhängig von der späteren Reserve. */
export const FISH_ATTACK_COST = { bite: 1 / 5, ram: 1 / 8 } as const;

// Flossenwert nach dem Generationssprung → Reserve. Damit reichen volle Leisten ohne
// Regeneration für 5/8, 7/12, 10/16 und 16/26 Bisse/Stöße. Dazwischen linear wachsen.
const RESERVES = [[10, 1], [25, 1.5], [60, 2], [125, 10 / 3]] as const;

export function fishStaminaMax(fins: number): number {
  if (!Number.isFinite(fins) || fins <= RESERVES[0][0]) return RESERVES[0][1];
  for (let i = 1; i < RESERVES.length; i++) {
    const [lo, a] = RESERVES[i - 1], [hi, b] = RESERVES[i];
    if (fins <= hi || i === RESERVES.length - 1) return a + (b - a) * (fins - lo) / (hi - lo);
  }
  return RESERVES[0][1];
}

/** Kein Angriff auf Kredit; Toleranz nur für Rundungsreste nach mehreren Angriffen. */
export function spendStamina(available: number, cost: number): number | null {
  if (!Number.isFinite(available) || available + 1e-9 < cost) return null;
  return Math.max(0, available - cost);
}
