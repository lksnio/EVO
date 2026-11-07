import { epochSpecies, type EpochDef, type Theme } from './epochs';
import { PALEO } from './paleo';

// ---------------------------------------------------------------------------
// Die Wasserabschnitte schließen direkt aneinander an. Das Devon besteht aus Laichfluss, Flachwasser und Tiefental;
// die übrigen Zeitalter behalten zunächst ihre vorhandenen Gebiete. Das Perm (der Prototyp) hat fünf Orte auf einer
// Weltkarte: Laichfluss, Lagune, durch deren Schlucht die Tiefe, dazu Ufersumpf und Hochland (siehe buildPerm).
// ---------------------------------------------------------------------------

/** Wie sich ein Ort anfühlt (Faktoren auf die Werte des Zeitalters). */
export interface ZoneDef {
  name: string;
  /** Farbe und Stärke des Schleiers über dem Bild (Trübung, Dunst, Dunkelheit) */
  veil: number;
  veilA: number;
  /** Nebel (Faktor) und Licht von oben (Faktor) */
  fog: number;
  light: number;
  /** Häufigkeit von Pflanzen, Dickicht, Beutetieren und Jägern (Faktor) */
  plants: number;
  cover: number;
  prey: number;
  hunters: number;
  /** Bodenvariante */
  ground: number;
}

const zone = (name: string, veil: number, veilA: number, fog: number, light: number, plants: number, cover: number, prey: number, hunters: number, ground: number): ZoneDef =>
  ({ name, veil, veilA, fog, light, plants, cover, prey, hunters, ground });

/** Art des Ortes – bestimmt auch, wie er auf der Karte aussieht. */
export type PlaceKind = 'start' | 'lush' | 'murky' | 'deep' | 'abyss';

/**
 * Form des Geländes: Mulde, flache Wiese, Hügelketten, Trichter (V) und Schacht mit Rändern. Im Karbon ragt das Land aus dem
 * Wasser: der Brutsumpf (nest), lange Ufer (shore), Inseln mit Hängen (isles), viele flache Inselchen im Moor (marsh), ein
 * tiefer See zwischen zwei Ufern (lake) und die steile Insel, deren Gipfel das Ziel ist (peak).
 */
export type PlaceShape = 'bowl' | 'meadow' | 'ridges' | 'vee' | 'well' | 'river' | 'nest' | 'shore' | 'isles' | 'marsh' | 'lake' | 'peak'
  /** Perm: Tümpel mit flachen Schlammbänken dazwischen (ein Fisch robbt hinüber) bzw. trockenes Hochland mit Wasserlöchern */
  | 'ufer' | 'highland';


export interface PlaceDef {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Lage auf der Karte (0..1) – aus der Urzeit-Karte des Zeitalters (paleo.json) */
  x: number;
  y: number;
  /** Wege zu anderen Orten */
  links: string[];
  def: ZoneDef;
  /** zusätzliche Tiefe in Kacheln (die Grundtiefe ist 31 Kacheln) */
  deep: number;
  /** Breite im Verhältnis zur Breite des Zeitalters */
  wide: number;
  /** hier lebt einer der ganz Großen */
  apex?: boolean;
  /** Form des Geländes (sonst nach Art des Ortes) */
  shape?: PlaceShape;
  /** wie viele Stellen an der Oberfläche Licht hereinlassen */
  sun: number;
  /**
   * sicher: Außer der eigenen Art lebt hier kein Tier (keine Bewohner, keine Durchzügler, keine Gelege fremder Arten) –
   * das Startgebiet, klein und still; Pflanzen wachsen trotzdem
   */
  safe?: boolean;
  /**
   * Land über dem Wasser (Karbon): so viele Kacheln Himmel liegen über der Wasserlinie – das Land ragt hinein. Dann ist deep
   * die Tiefe des Wassers unter der Wasserlinie (in Kacheln).
   */
  sky?: number;
  /** Abschnitt des zusammenhängenden Devon-Meeres, von links nach rechts. */
  waterway?: 0 | 1 | 2;
  /** der Ort, in den man durch die Schlucht im Boden hinabschwimmt – und von dort nur nach oben zurückkommt (ascent) */
  descent?: string;
  ascent?: string;
  /** Ränder, über die man nicht hinausschwimmen kann (kein Nachbar, eine Wand) */
  closed?: { left?: boolean; right?: boolean };
  /** Bodenhöhe an den beiden Übergängen (Kacheln); dieselbe Höhe an benachbarten Rändern. */
  seabed?: [number, number];
  /** links im Laichfluss liegt die geschützte Laichhöhle (siehe LevelData.cave) */
  spawningCave?: boolean;
  /**
   * Die Tiere dieses Ortes (Art, Gewicht wie in EpochDef.fauna). Ist die Liste da, lebt hier nur, was darin steht – so hat
   * jeder Ort seine eigenen vier, fünf Arten (Perm).
   */
  fauna?: [string, number][];
  /** der Boss dieses Ortes (sonst der Spitzenräuber des Zeitalters, EpochDef.apex) – nur an Orten mit apex */
  boss?: string;
  /** Landschaft dieses Ortes (sonst die des Zeitalters): Sumpf, rotes Hochland … */
  theme?: Theme;
  /** Lage auf der Weltkarte (0..1) */
  map?: [number, number];
  /** nur mit Beinen zu betreten (ein Fisch kommt hier nicht hin) */
  needsLegs?: boolean;
  /** liegt unter einem anderen Ort und ist nur durch dessen Schlucht zu erreichen (auf der Weltkarte nicht wählbar) */
  below?: string;
  /** ein Satz für die Weltkarte */
  blurb?: string;
  /** Schwierigkeit auf der Weltkarte: 1 leicht … 3 schwer */
  tier?: number;
  /** The first nursery has a water route on the left and a shallow shore route on the right. */
  nurseryFork?: boolean;
  /** Permanent breeding habitat offered here; both are offered by nurseryFork. */
  breedingSite?: 'water' | 'shore';
}

/** Gelände nach Art des Ortes, wenn nichts anderes angegeben ist. */
export const SHAPE_OF: Record<PlaceKind, PlaceShape> = { start: 'river', lush: 'meadow', murky: 'ridges', deep: 'vee', abyss: 'well' };

/** Rolle eines Ortes in einem Zeitalter: Alle Zeitalter haben dieselbe Gestalt, aber andere Namen und Farben. */
type Role = 'start' | 'lush1' | 'lush2' | 'murky1' | 'murky2' | 'deep1' | 'deep2' | 'deep3' | 'abyss1' | 'abyss2';

interface RoleDef {
  kind: PlaceKind;
  shape: PlaceShape;
  /** Nachbarn: Man erreicht sie über den linken bzw. rechten Rand (welcher, entscheidet die Tiefe, siehe edgeNeighbor) */
  links: Role[];
  deep: number;
  wide: number;
  sun: number;
  safe?: boolean;
  /** Feinabstimmung der Gebiets-Faktoren: Pflanzen, Dickicht, Beute, Jäger */
  mul?: [number, number, number, number];
  apex?: boolean;
  /** Land über dem Wasser: Kacheln Himmel über der Wasserlinie (siehe PlaceDef.sky) */
  sky?: number;
}

/**
 * Zehn Orte je Zeitalter, miteinander verbunden wie ein Netz. Von einem Ort in den nächsten kommt man über den Rand – wer
 * hinüberschwimmt, sieht den Ort und den Weg danach auf der Karte. Niedrige Felsspalten dienen als natürliche Verstecke.
 */
const ROLES: Record<Role, RoleDef> = {
  // das Startgebiet: klein, nur der Laichfluss und seine Mündung – und sicher (siehe PlaceDef.safe)
  start: { kind: 'start', shape: 'river', links: ['lush1', 'lush2', 'murky1', 'deep1'], deep: 14, wide: 1.25, sun: 4, safe: true },
  lush1: { kind: 'lush', shape: 'meadow', links: ['start', 'lush2', 'murky2'], deep: 2, wide: 3.1, sun: 6, mul: [1, 1, 1, 1] },
  lush2: { kind: 'lush', shape: 'bowl', links: ['start', 'lush1', 'deep2'], deep: 10, wide: 3, sun: 6, mul: [1.1, 1.15, 0.9, 0.8] },
  murky1: { kind: 'murky', shape: 'ridges', links: ['start', 'murky2'], deep: 12, wide: 2.8, sun: 3 },
  murky2: { kind: 'murky', shape: 'meadow', links: ['lush1', 'murky1'], deep: 6, wide: 3.2, sun: 3, mul: [0.8, 0.9, 1, 0.7] },
  deep1: { kind: 'deep', shape: 'vee', links: ['start', 'deep2', 'deep3'], deep: 60, wide: 2.8, sun: 3 },
  deep2: { kind: 'deep', shape: 'ridges', links: ['lush2', 'deep1', 'deep3'], deep: 42, wide: 3, sun: 3, mul: [0.8, 0.9, 0.9, 1.1] },
  deep3: { kind: 'deep', shape: 'well', links: ['deep1', 'deep2', 'abyss1', 'abyss2'], deep: 70, wide: 2.6, sun: 2 },
  abyss1: { kind: 'abyss', shape: 'vee', links: ['deep3', 'abyss2'], deep: 80, wide: 2.6, sun: 2, apex: true },
  abyss2: { kind: 'abyss', shape: 'well', links: ['deep3', 'abyss1'], deep: 90, wide: 2.4, sun: 1, apex: true, mul: [0.8, 0.8, 0.7, 1.15] },
};

/** Zone nach Art des Ortes. veils = Farbe des Schleiers für bewachsene und trübe Orte. */
function zoneFor(kind: PlaceKind, name: string, veils: { lush: number; murky: number }, mul?: RoleDef['mul'], light = 1): ZoneDef {
  const [pl, cv, pr, hn] = mul ?? [1, 1, 1, 1];
  switch (kind) {
    // sauberes, helles Wasser: mehr Licht von oben
    case 'start': return zone(name, 0, 0, 0.7, 1.35 * light, 1, 1, 1, 1, 0);
    case 'lush': return zone(name, veils.lush, 0.18, 1.1, 1.15 * light, 2.3 * pl, 1.8 * cv, 1.5 * pr, 0.4 * hn, 1);
    case 'murky': return zone(name, veils.murky, 0.36, 1.9, 0.55 * light, 1.2 * pl, 1.5 * cv, 1.2 * pr, 0.5 * hn, 1);
    case 'deep': return zone(name, 0x061424, 0.26, 0.6, 0.65 * light, 0.5 * pl, 0.6 * cv, 0.9 * pr, 1.8 * hn, 2);
    case 'abyss': return zone(name, 0x020a14, 0.3, 0.5, 0.45 * light, 0.3 * pl, 0.4 * cv, 0.6 * pr, 2.4 * hn, 2);
  }
}

/** Orte, Namen und Farben je Zeitalter. */
const EPOCH_PLACES: Record<string, { names: Record<Role, [string, string]>; veils: { lush: number; murky: number }; light: number; hunters: number; roles?: Partial<Record<Role, Partial<RoleDef>>> }> = {
  ordovizium: {
    names: {
      start: ['lagune', 'The Spawning River'], lush1: ['tang', 'Kelp Meadow'], lush2: ['schwamm', 'Sponge Garden'], murky1: ['bucht', 'Murky Bay'], murky2: ['sandfeld', 'Sand Flats'],
      deep1: ['kante', 'Deep Ledge'], deep2: ['klippe', 'Cliff Slope'], deep3: ['spalt', 'The Fissure'], abyss1: ['abgrund', 'The Abyss'], abyss2: ['tiefsee', 'Black Depths'],
    },
    veils: { lush: 0x1a4a2c, murky: 0x2e3a1c }, light: 1, hunters: 1,
  },
  silur: {
    names: {
      start: ['kelp', 'Kelp Estuary'], lush1: ['dickicht', 'Kelp Thicket'], lush2: ['teppich', 'Algal Carpet'], murky1: ['schlick', 'Silt Plain'], murky2: ['nebel', 'Fog Bank'],
      deep1: ['graben', 'Dark Trench'], deep2: ['hang', 'Rugged Slope'], deep3: ['schlund', 'The Maw'], abyss1: ['tiefe', 'The Depths'], abyss2: ['nacht', 'Eternal Night'],
    },
    veils: { lush: 0x1a4a2a, murky: 0x2a2e1c }, light: 0.95, hunters: 1.05,
  },
  devon: {
    names: {
      start: ['riff', 'The Spawning River'], lush1: ['garten', 'Coral Garden'], lush2: ['wald', 'Sponge Forest'], murky1: ['delta', 'Murky Delta'], murky2: ['bank', 'Mud Bank'],
      deep1: ['wand', 'Sheer Wall'], deep2: ['terrasse', 'Terraced Slope'], deep3: ['kluft', 'The Chasm'], abyss1: ['maul', 'Maw of the Deep'], abyss2: ['grund', 'The Final Seabed'],
    },
    veils: { lush: 0x1a4a3a, murky: 0x302e18 }, light: 0.95, hunters: 1,
  },
  // das Karbon: Sümpfe, Ufer und Inseln – das Land ragt aus dem Wasser, und ganz am Ende wartet der steile Fels
  karbon: {
    names: {
      start: ['brut', 'The Nursery Swamp'], lush1: ['farn', 'Fern Shore'], lush2: ['inseln', 'Horsetail Islands'], murky1: ['moor', 'Peat Bog'], murky2: ['schlamm', 'Mud Banks'],
      deep1: ['lagune', 'Brackish Lagoon'], deep2: ['see', 'Rhizodus Lake'], deep3: ['rinne', 'The Deep Channel'], abyss1: ['fels', 'The Steep Cliff'], abyss2: ['kueste', 'Cliff Coast'],
    },
    veils: { lush: 0x2a3a18, murky: 0x34301a }, light: 0.9, hunters: 1,
    roles: {
      start: { shape: 'nest', deep: 6, wide: 1.4, safe: false, sky: 9 },
      lush1: { shape: 'shore', deep: 6, wide: 2.6, sky: 9 },
      lush2: { shape: 'isles', deep: 8, wide: 2.6, sky: 13 },
      murky1: { shape: 'marsh', deep: 5, wide: 2.6, sky: 9 },
      murky2: { shape: 'shore', deep: 7, wide: 2.8, sky: 9 },
      deep1: { shape: 'lake', deep: 14, wide: 2.6, sky: 9 },
      deep2: { shape: 'lake', deep: 22, wide: 2.8, sky: 9, apex: true },
      deep3: { shape: 'lake', deep: 26, wide: 2.4, sky: 9 },
      abyss1: { kind: 'lush', shape: 'peak', deep: 8, wide: 2.2, sky: 27, apex: false, mul: [1, 1, 1, 0.3] },
      abyss2: { kind: 'murky', shape: 'isles', deep: 10, wide: 2.4, sky: 17, apex: false },
    },
  },
};

function buildPlaces(epId: string): PlaceDef[] {
  const spec = EPOCH_PLACES[epId];
  const roles = Object.keys(ROLES) as Role[];
  const idOf = (r: Role) => spec.names[r][0];
  const places: PlaceDef[] = roles.map((r) => {
    // ein Zeitalter kann seinen Orten eine eigene Gestalt geben (das Karbon: Ufer, Inseln, der steile Fels)
    const d = { ...ROLES[r], ...spec.roles?.[r] };
    const [id, name] = spec.names[r];
    const def = zoneFor(d.kind, name, spec.veils, d.mul, spec.light);
    def.hunters *= spec.hunters;
    const [x, y] = PALEO[epId].nodes[r];
    return {
      id, name, kind: d.kind, x, y, links: d.links.map(idOf), def,
      deep: d.deep, wide: d.wide, apex: d.apex, shape: d.shape, sun: d.sun, safe: d.safe, sky: d.sky,
    };
  });
  if (epId !== 'devon') return places;
  // Ein Meer, drei direkt verbundene Abschnitte. Die alten IDs bleiben für Spielstände erhalten.
  const river = places[0], shelf = places[1], valley = places[5];
  // Das Tiefental erreicht man nur durch die Schlucht in der Mitte des Korallengartens (der Boden ist dort „auf“) – und verlässt es nur nach oben:
  // Rechts im Korallengarten geht es nicht weiter, das Tal selbst hat rechts und links Wände.
  Object.assign(river, { links: [shelf.id], wide: 1.8, deep: 3, safe: false, waterway: 0, seabed: [17, 28], spawningCave: true });
  Object.assign(shelf, { links: [river.id, valley.id], wide: 2.4, deep: 24, waterway: 1, seabed: [28, 28], descent: valley.id, closed: { right: true } });
  Object.assign(valley, { name: 'The Deep Valley', links: [shelf.id], wide: 3.6, deep: 80, waterway: 2, seabed: undefined, ascent: shelf.id, closed: { left: true, right: true }, apex: true });
  valley.def.name = valley.name;
  return [river, shelf, valley];
}

/**
 * Das frühe Perm: fünf Orte auf der Weltkarte, je mit eigenen Tieren und steigender Schwierigkeit. Die drei Wasserorte sind
 * die gemalten Orte des Devons (gleiche Kennungen – Gelände, Höhle, Schlucht und Stimmungen bleiben), nur mit offenen
 * Rändern zur Weltkarte und mit den Tieren des Perms.
 *
 *                  ┌── Lagune ─────── (Schlucht) Tiefe          (Boss Orthacanthus)
 *   Laichfluss ────┤      │
 *                  └── Ufersumpf ──── Hochland                  (Boss Dimetrodon, nur mit Beinen)
 */
function buildPerm(): PlaceDef[] {
  const [river, shelf, valley] = buildPlaces('devon');
  const swamp = { lush: 0x2a3a18, murky: 0x34301a };
  Object.assign(river, {
    links: ['garten', 'ufer'], closed: undefined, map: [0.40, 0.73], x: 0.40, y: 0.73,
    blurb: 'Two sheltered nurseries: open water to the left, the shallow shore to the right.', tier: 1,
    nurseryFork: true, shape: 'shore', theme: 'sumpf', sky: 7, deep: 8, wide: 1.15, spawningCave: false, waterway: undefined, seabed: undefined,
    fauna: [['paramblypterus', 8], ['acanthodes', 5], ['apateon', 3], ['gnathorhiza', 1.5], ['archegosaurus', 0.8]],
  });
  Object.assign(shelf, {
    name: 'The Coral Lagoon', links: ['riff', 'ufer', 'wand'], closed: undefined, map: [0.28, 0.4], x: 0.28, y: 0.4, blurb: 'A warm, shallow bay behind the reef. Sheltered eggs continue a life in water.', tier: 2, breedingSite: 'water',
    fauna: [['aeduella', 9], ['platysomus', 4], ['diplocaulus', 1.5], ['xenacanthus', 7], ['ectosteorhachis', 5]],
  });
  shelf.def.name = shelf.name;
  Object.assign(valley, {
    name: 'The Deep', map: [0.3, 0.13], x: 0.3, y: 0.13, below: 'garten', boss: 'orthacanthus', blurb: 'Dark water below the lagoon – reached only through the chasm.', tier: 3, breedingSite: 'water',
    fauna: [['aeduella', 14], ['platysomus', 6], ['ectosteorhachis', 0.12], ['sclerocephalus', 0.25], ['xenacanthus', 0.15]],
  });
  valley.def.name = valley.name;
  const shore: PlaceDef = {
    id: 'ufer', name: 'The Shore Swamp', kind: 'lush', shape: 'ufer', theme: 'sumpf', x: 0.62, y: 0.62, map: [0.62, 0.62],
    blurb: 'Water and mud banks along the river. Shallow-water eggs carry the shore lineage onward.', tier: 2, breedingSite: 'shore',
    links: ['riff', 'garten', 'hochland'], def: zoneFor('lush', 'The Shore Swamp', swamp, [1, 1, 1, 0.9], 0.9),
    deep: 7, wide: 2.6, sun: 4, sky: 9,
    fauna: [['paramblypterus', 6], ['gnathorhiza', 1.5], ['eryops', 1.5], ['ophiacodon', 1.2],
      ['captorhinus', 3], ['cacops', 1.2], ['seymouria', 2], ['tausendfuss', 2.5]],
  };
  const upland: PlaceDef = {
    id: 'hochland', name: 'The Red Uplands', kind: 'lush', shape: 'highland', theme: 'reptil', x: 0.86, y: 0.36, map: [0.86, 0.36],
    blurb: 'Dry red earth and seed ferns – the land of the sailbacks.', tier: 3,
    links: ['ufer'], def: zoneFor('lush', 'The Red Uplands', { lush: 0x4a3018, murky: 0x4a3a20 }, [0.6, 0.5, 1, 1], 1.05),
    deep: 4, wide: 2.6, sun: 5, sky: 14, apex: true, boss: 'dimetrodon', needsLegs: true,
    fauna: [['eudibamus', 3], ['edaphosaurus', 0.6], ['diadectes', 0.6], ['varanops', 2.5], ['tausendfuss', 2.5], ['urinsekt', 2.5]],
  };
  return [river, shelf, valley, shore, upland];
}

/** Orte je Zeitalter. Der erste ist immer der Start. */
export const PLACES: Record<string, PlaceDef[]> = {
  ...Object.fromEntries(Object.keys(EPOCH_PLACES).map((id) => [id, buildPlaces(id)])),
  perm: buildPerm(),
};

export const placesOf = (ep: EpochDef | string): PlaceDef[] => PLACES[typeof ep === 'string' ? ep : ep.id] ?? [];

export function placeOf(ep: EpochDef | string, id: string): PlaceDef {
  const list = placesOf(ep);
  // Die früheren Nebenarme münden jetzt entweder ins Flachwasser oder ins Tiefental.
  if ((typeof ep === 'string' ? ep : ep.id) === 'devon') {
    if (['wald', 'delta', 'bank'].includes(id)) return list[1];
    if (['terrasse', 'kluft', 'maul', 'grund'].includes(id)) return list[2];
  }
  return list.find((p) => p.id === id) ?? list[0];
}

/** Alle Tiere eines Zeitalters: die des Zeitalters selbst und die, die nur an einzelnen Orten leben (samt deren Bossen). */
export function speciesOf(ep: EpochDef): string[] {
  const local = placesOf(ep).flatMap((p) => [...(p.fauna ?? []).map(([id]) => id), ...(p.boss ? [p.boss] : [])]);
  return [...new Set([...epochSpecies(ep), ...local])];
}

/** Die Orte eines Zeitalters, an denen eine Art lebt (nur wo die Orte eigene Tierlisten haben). */
export const homesOf = (ep: EpochDef, id: string) => placesOf(ep).filter((p) => p.fauna?.some(([f]) => f === id) || p.boss === id);

/** Der Startort eines Zeitalters. */
export const startPlace = (ep: EpochDef | string) => placesOf(ep)[0];

/** Die Nachbarn eines Ortes auf der Weltkarte (ohne Orte, die nur durch eine Schlucht zu erreichen sind). */
export function mapNeighbors(ep: EpochDef | string, from: PlaceDef): PlaceDef[] {
  return from.links.map((id) => placeOf(ep, id)).filter((p) => p.id !== from.id && p.below !== from.id && from.below !== p.id);
}

/**
 * Kann man an diesem Rand hinaus? Auf der Weltkarte: wo der Ort nicht geschlossen ist und es Nachbarn gibt; sonst, wenn es
 * dort einen Nachbarort gibt (edgeNeighbor).
 */
export function edgeOpen(ep: EpochDef, from: PlaceDef, side: 'left' | 'right') {
  if (ep.overworld) return !from.closed?.[side] && !from.below && mapNeighbors(ep, from).length > 0;
  return !!edgeNeighbor(ep, from, side, 0.5);
}

/** Schlüssel eines Weges zwischen zwei Orten (unabhängig von der Richtung). */
export const linkKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Wer links oder rechts über den Rand hinausschwimmt (es gibt dort keine Wand), kommt in einen Nachbarort: Links liegen die
 * Nachbarn westlich, rechts die östlich gelegenen. Gibt es mehrere, entscheidet die Höhe (oben im Wasser → der nördlichere,
 * unten → der südlichere). Liegt auf dieser Seite keiner, nimmt man den, der am ehesten in diese Richtung liegt.
 * Am Startort gibt es links keinen Ausgang; rechts geht es immer zum ersten Nachbarn.
 * frac: 0 an der Oberfläche … 1 am Grund.
 */
export function edgeNeighbor(ep: EpochDef | string, from: PlaceDef, side: 'left' | 'right', frac: number): PlaceDef | undefined {
  if (from.closed?.[side]) return undefined;
  if (from.waterway !== undefined) return placesOf(ep)[from.waterway + (side === 'left' ? -1 : 1)];
  const nb = from.links.map((id) => placeOf(ep, id));
  if (!nb.length) return undefined;
  // Der Startfluss entspringt links (dort geht es nicht hinaus); rechts führt er ins Meer und zum ersten bewachsenen Ort
  if (from.kind === 'start' && !from.nurseryFork) return side === 'left' ? undefined : nb[0];
  const dir = side === 'left' ? -1 : 1;
  let cand = nb.filter((q) => (q.x - from.x) * dir > 0);
  if (!cand.length) cand = [nb.slice().sort((a, b) => (b.x - from.x) * dir - (a.x - from.x) * dir)[0]];
  cand.sort((a, b) => a.y - b.y);
  return cand[Math.min(cand.length - 1, Math.floor(Math.max(0, Math.min(0.999, frac)) * cand.length))];
}
