# Devon fish rules

This replaces food/kill budgets, swimming-derived endurance, body-derived speed, random cosmetic drift and final ±1 rolls for the start fish. Other body classes retain their existing rules.

## Offspring

Points change when each egg is created, once. Egg choices, save/load and network synchronization never reroll them. Minimums are the ancestor values: adult health 28, reserve 30, and bite/fins/skull/scales 10.

| Meat share | Health | Reserve |
| --- | --- | --- |
| ≥90% | +3 or +4 | −1 or −2 |
| ≥75%, <90% | +1 or +2 | 0 |
| >25%, <75% | −1 or +1 | −1 or +1 |
| >10%, ≤25% | 0 | +1 or +2 |
| ≤10% | −1 or −2 | +3 or +4 |

Every listed alternative is an independent 50/50 roll. Without any food there is no nutrition roll. Preview shows the ordinary expected change; actual eggs contain the final integer nutrition outcomes.

Actual damage trains bite and skull independently, without a kill or food requirement. Credit is actual health removed, capped at the target's remaining health, multiplied by `sqrt(max(1, target max health / ancestor adult health))`. Each 25 weighted damage gives one point, up to +4 per weapon per generation. The 100-damage reference is the tuning point in `fishEvolution.ts`.

The first damage direction to evolve becomes primary. When an offspring reaches or crosses 20/50/100 through positive weapon training, it immediately jumps to 25/60/125 and uses the corresponding drawing. Existing fish and eggs at exactly 20/50/100 are also shown at the reached visual stage; loading repairs stale form IDs without changing skill points. Weapon displays floor fractional points so 19.8 is never shown as 20. The secondary damage direction can only evolve once and then remains at 25. If both first evolve together, higher earned damage wins; ties choose bite.

The minimum health fraction observed before laying determines scales: <10% → +3; otherwise <25% → +2; otherwise <50% → +1; 50–<75% → 0; ≥75% → −1. Outcomes +2/+3 also cost one fin point, subject to the ancestor floor.

Each egg has a separate 10% chance to replace ALL ordinary changes with fins +5. Fins cap at 100. Only an actual fin-mutation gain is highlighted in the egg's fins row. There are no golden eggs or unrelated bonus rolls.

## Effects

* Adult size scales with the cube root of adult health relative to the ancestor. Weapons do not become stronger merely because health increased.
* Reserve is `reserve points / 30` base bars. Bite and ram each cost 1/8 of a base bar. Any sufficiently funded action is available immediately, even after exhaustion; the fish never waits for a full refill. Fins do not affect reserve.
* Fin points alone change normal swim speed: 10 → ×1; 20 → ×1.5; 50 → ×2; 100 → ×3, linearly between anchors. Flows, sprint and attacks temporarily modify movement. Legacy length, mass, body shape, age and camouflage do not change the fish's normal speed.
* Reserve colors the fins towards turquoise. Scales darken the skin towards black, preserve the eye, and improve damage resistance. These colors do not create extra form states.
* Fin visual stages are 20/50/100, independent of the damage group. A one-point loss can reduce speed but does not reverse a visual milestone.

## Combat

Stage 0 always allows quick attacks. Holding unlocks at stage 1, reaching full charge after 1.35 seconds and firing automatically at 2.5 seconds. A quick tap remains a quick attack. The fixed cost is paid exactly once, when starting, and release still works if that payment emptied the reserve.

A full charged bite doubles damage. A quick bite eats at most one meat chunk; a charged bite can eat up to 3/5/7 chunks at weapon stages 1/2/3. Bite stages 2/3 slow a surviving opponent by 25%/50% for two seconds; repeated hits refresh the effect without adding percentages.

A held ram allows 68% of ordinary swim speed while aiming from rest and preserves sprint momentum with a gradual decay during preparation, then releases a faster, stronger lunge. Quick rams remain available. Ram stun is discrete: stages 0/1 none, stage 2 one second, stage 3 two seconds, independent of age. Slow effects, charge poses and mouth opening are sent to other clients; stage-3 charged movement fits the server's movement budget.

## Evolution and co-op

There are 48 forms: twelve allowed bite/skull combinations × four independent fin stages. Existing form IDs 0–24 remain stable. The remaining forms combine existing paintings at runtime; they are not new master paintings.

Eggs carry their own generation and a compact ancestry trace. The shell opens an in-game evolution view showing only observed prefixes. Small numerical changes never add a node. A complete path has at most seven form transitions (three primary, one secondary, three fins), plus its root.

The shared room exposes exactly the current generation and the next brood. Advancing clears all older eggs for everyone; late messages, reconnects and local hatch calls cannot revive them. Living players may finish an older life, but may only re-enter through the current shared generation or its next brood. A chosen egg is removed immediately, including the local copy before a network patch arrives.

When a player dies without a usable egg, the player watches a living peer instead of ending the shared species. The watcher follows across areas, remains invisible and cannot attack, eat, train or become the animal authority. New brood automatically opens the egg choice; choosing a valid egg returns the watcher to play on that egg's ancestry. A dead branch remains archived. Waiting survives a reload, so the parent's body cannot be revived. Shared extinction requires no eggs and no living connected player.
