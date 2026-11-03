/** A mouth attack that can overcome the animal's full health swallows it whole.
 * Comparing full health rather than remaining health preserves the carcass of a wounded large opponent. */
export function wholeBite(effectiveDamage:number,maxHealth:number) {
  return Number.isFinite(effectiveDamage)&&Number.isFinite(maxHealth)&&maxHealth>0&&effectiveDamage>=maxHealth;
}
