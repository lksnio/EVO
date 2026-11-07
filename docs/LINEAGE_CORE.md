# Shoreline lineage core

This is the current player evolution system in the playable Perm prototype. It replaces the former
48-form, three-trait starter system there. Claude's five places, fauna, bosses and world map are retained.
The dormant Devon/Carboniferous prototypes keep their old rules for compatibility.

## Habitat comes from the chosen offspring

The player begins as the short-legged shoreline ancestor in the shallow middle of the starting map.
The open-water nursery is to the left; the shore nursery is to the right. Both are underwater and
reachable by the initial animal. Each has its own permanent roe heap and nearby food.

Each chosen offspring moves its inherited habitat progress one step towards its nursery: water is
negative, shore positive. At −3 the aquatic body is established; at +3 the shoreline walker is
established. Before that, choosing the other nursery moves back along the same scale. After the body
is established it stays in that habitat path. The established base body is playable for at least one
generation before a visible weapon upgrade.

Laying three clutches with the same parent does **not** skip three generations. Eggs are candidates
calculated from that parent's state. Only choosing and hatching an egg adopts its state. A sibling
from the current generation likewise does not generate another development step.

## Combat chooses the weapon

Bite and ram damage are recorded from the beginning, using the existing weighting for the target's
size. Each 25 weighted damage grants one inherited training point, up to four per weapon per life.
Eating is not required. When the body has already been established, a weapon with at least four
training points and 20% more training than the other becomes the primary weapon at tier 1.
A balanced history leaves the choice open.

Tier 2 requires ten accumulated points in the primary weapon and at least four additional practice
points after tier 1. No generation skips the base body or tier 1. Once specialised, the opposite
weapon's inherited training decays by one plus half the primary training gained each generation.
Its basic attack remains usable. The final four forms are aquatic bite, aquatic skull,
shoreline bite and shoreline skull. There is no independent fins mutation in this core.

The numerical defaults live in [lineageEvolution.ts](../src/sim/lineageEvolution.ts). Relative to
baseline force, tier 1/2 bite multiplies damage by 1.8/3; skull multiplies ram by 1.9/3.2 and incoming
damage by 0.8/0.6. Final skull adds a two-second stun. Existing stamina costs and nutrition/injury-based
vitality, stamina and scales remain in use. Visible base bite and ram still begin at 10.

Movement follows the body and specialization: aquatic animals improve swimming and lose ground
mobility; shoreline animals improve walking and lose swimming speed. Shoreline walkers breathe air;
the transitional animal retains a long breath reserve. The uplands require the established shore body.

## Eleven painted forms

The runtime uses the approved PNG masters below. Legacy filenames retain their original numbering;
the runtime keys express the user's revised two-tier hierarchy.

| Runtime key | Master under `art/` |
| --- | --- |
| `transition` | `EVO_shore_base_v2/masters/shore_base_shortlegs.png` |
| `water` | `EVO_startfish_base_v2/masters/startfish_g0_f0_k0.png` |
| `water-bite-1` | `EVO_startfish_bite_tier2_v3/masters/startfish_g2_f0_k0.png` |
| `water-bite-2` | `EVO_startfish_bite_tier2_v4/masters/startfish_g2_f0_k0.png` |
| `water-skull-1` | `EVO_startfish_skull_tier1_v2/masters/startfish_g0_f0_k1.png` |
| `water-skull-2` | `EVO_startfish_skull_tier2_v2/masters/startfish_g0_f0_k2.png` |
| `shore` | `EVO_shore_base_v1/masters/shore_base.png` |
| `shore-bite-1` | `EVO_shore_bite1_legs2_v1/masters/shore_bite1_legs2.png` |
| `shore-bite-2` | `EVO_shore_bite_tier3_v1/masters/shore_bite_tier3.png` |
| `shore-skull-1` | `EVO_shore_skull_tier1_v2/masters/shore_skull_tier1.png` |
| `shore-skull-2` | `EVO_shore_skull_tier2_v1/masters/shore_skull_tier2_legs1.png` |

`python3 tools/lineage_assets.py` produces transparent WebPs and calibrated registration from these
masters; it needs Pillow. Game startup preloads those eleven compressed images. The shared renderer
uses them for the player, remote players, egg cards, C overview, and tree previews. Its rigid trunk
has articulated tail, fins, four legs where present, and upper/lower jaws. Attack eyelids stay attached
to the head. Water lighting, inherited fin colour and scale darkening use a bounded texture cache.
Canvas fallback uses detached articulated pieces.

## Lineages, co-op and saves

Eggs carry their own evolution state and a bounded history of visible milestones, independently of
the shared population's generation number. Hatching another player's egg adopts that egg's actual
lineage. Both players' routes appear in the in-game shell tree alongside dim possible alternatives;
hovering previews the form. The egg card shows its actual nursery, inherited progress and body.

Only the shared current generation and its immediate offspring remain usable. There is no archived
egg resurrection. A player without usable eggs spectates and can return through a newly laid egg.
Joining a younger room aligns the local generation/age without rewriting the animal's ancestry.
Network input validates and bounds evolution state, form keys and history.

On first loading an old Perm save without this state, its live animal becomes the transitional body
and returns to the new nursery fork. Collections, inherited vitality/stamina/scales and room generation
are retained; incompatible old clutches are cleared. Old usable eggs normalize to the same new base.
New-format saves resume their exact body, specialization, ancestry and location normally.

## Validation

Run `npm test`, `npm run typecheck` and `npm run build`. The lineage suites cover all four endpoints,
actual inherit/lay/hatch/save flows, opposing nursery choices, co-op adoption, current/next generation
restrictions, malformed messages, nursery geometry and all eleven animation registrations.

The browser regression `tools/check_lineage_flow.cjs` uses Playwright Core and Chromium with a running
Vite server (`EVO_BASE_URL`) and writes screenshots/report to `EVO_ARTIFACTS`. It fast-forwards age and
food, then exercises the real nursery, egg confirmation, hatch transition, UI, rigs and co-op flow.
