import { EPOCHS, type EpochDef } from './epochs';

// ---------------------------------------------------------------------------
// Die Weltkarte. Jedes Zeitalter hat zehn Orte; wer durch einen Durchgang hinausschwimmt,
// schaltet den nächsten Ort frei und kommt dort an. Die Orte unterscheiden sich:
// manche sind dicht bewachsen und voller Nahrung, andere trüb – und manche reichen tief hinab,
// wo die schlimmen Tiere warten.
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

/** Form des Geländes: Mulde, flache Wiese, Hügelketten, Trichter (V) und Schacht mit Rändern. */
export type PlaceShape = 'bowl' | 'meadow' | 'ridges' | 'vee' | 'well';

/** Höhlen eines Ortes: g = grüne Höhle (färbt grün), b = schwarze Höhle. Die erste liegt nahe beim Ankunftsplatz. */
export type CaveKind = 'g' | 'b';

export interface PlaceDef {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Lage auf der Karte (0..1) */
  x: number;
  y: number;
  /** Wege zu anderen Orten */
  links: string[];
  /** ein Satz zum Ort (steht auf der Karte, sagt aber nicht alles) */
  blurb: string;
  def: ZoneDef;
  /** zusätzliche Tiefe in Kacheln (die Grundtiefe ist 31 Kacheln) */
  deep: number;
  /** Breite im Verhältnis zur Breite des Zeitalters */
  wide: number;
  /** wie viele Muscheln hier liegen (die erste liegt im ersten Gewässer direkt vor dir) */
  shells: number;
  /** hier lebt einer der ganz Großen */
  apex?: boolean;
  /** Form des Geländes (sonst nach Art des Ortes) */
  shape?: PlaceShape;
  /** die durchquerbaren Farbtunnel dieses Ortes (selten) */
  caves: CaveKind[];
  /** wie viele Stellen an der Oberfläche Licht hereinlassen */
  sun: number;
}

/** Gelände nach Art des Ortes, wenn nichts anderes angegeben ist. */
export const SHAPE_OF: Record<PlaceKind, PlaceShape> = { start: 'bowl', lush: 'meadow', murky: 'ridges', deep: 'vee', abyss: 'well' };

/** Rolle eines Ortes in einem Zeitalter: Alle Zeitalter haben dieselbe Gestalt, aber andere Namen und Farben. */
type Role = 'start' | 'lush1' | 'lush2' | 'murky1' | 'murky2' | 'deep1' | 'deep2' | 'deep3' | 'abyss1' | 'abyss2';

interface RoleDef {
  kind: PlaceKind;
  shape: PlaceShape;
  /** Lage auf der Karte (0..1) */
  x: number;
  y: number;
  /** Nachbarn: Zu jedem führt im Ort ein Durchgang (Tor) */
  links: Role[];
  blurb: string;
  deep: number;
  wide: number;
  shells: number;
  caves: CaveKind[];
  sun: number;
  /** Feinabstimmung der Gebiets-Faktoren: Pflanzen, Dickicht, Beute, Jäger */
  mul?: [number, number, number, number];
  apex?: boolean;
}

/**
 * Zehn Orte je Zeitalter, miteinander verbunden wie ein Netz. Von einem Ort in den nächsten kommt man nur durch
 * einen **Durchgang** im Gelände (eine Öffnung in der Wand, im Boden oder oben im Licht) – wer ihn findet, schaltet den
 * Ort frei und sieht ihn danach auf der Karte. Die Farbtunnel sind selten und liegen weit vom Start.
 */
const ROLES: Record<Role, RoleDef> = {
  start: { kind: 'start', shape: 'bowl', x: 0.44, y: 0.52, links: ['lush1', 'lush2', 'murky1', 'deep1'], blurb: 'Hier beginnt alles.', deep: 14, wide: 3.4, shells: 0, caves: [], sun: 5 },
  lush1: { kind: 'lush', shape: 'meadow', x: 0.2, y: 0.26, links: ['start', 'lush2', 'murky2'], blurb: 'Dichtes Grün. Hier gibt es viel zu fressen.', deep: 2, wide: 3.1, shells: 1, caves: [], sun: 6, mul: [1, 1, 1, 1] },
  lush2: { kind: 'lush', shape: 'bowl', x: 0.43, y: 0.17, links: ['start', 'lush1', 'deep2'], blurb: 'Weiche Wiesen im Licht, dazwischen stille Mulden.', deep: 10, wide: 3, shells: 1, caves: [], sun: 6, mul: [1.1, 1.15, 0.9, 0.8] },
  murky1: { kind: 'murky', shape: 'ridges', x: 0.24, y: 0.8, links: ['start', 'murky2'], blurb: 'Trübes Wasser. Man sieht kaum die eigene Flosse.', deep: 12, wide: 2.8, shells: 1, caves: [], sun: 3 },
  murky2: { kind: 'murky', shape: 'meadow', x: 0.1, y: 0.56, links: ['lush1', 'murky1'], blurb: 'Flach und trüb, der Grund voller Sand. Hier verliert sich vieles.', deep: 6, wide: 3.2, shells: 1, caves: ['g'], sun: 3, mul: [0.8, 0.9, 1, 0.7] },
  deep1: { kind: 'deep', shape: 'vee', x: 0.62, y: 0.7, links: ['start', 'deep2', 'deep3'], blurb: 'Das Wasser fällt steil ab. Tief unten wartet etwas.', deep: 60, wide: 2.8, shells: 2, caves: [], sun: 3 },
  deep2: { kind: 'deep', shape: 'ridges', x: 0.66, y: 0.34, links: ['lush2', 'deep1', 'deep3'], blurb: 'Zerklüftete Hänge, Schatten zwischen den Felsen.', deep: 42, wide: 3, shells: 1, caves: [], sun: 3, mul: [0.8, 0.9, 0.9, 1.1] },
  deep3: { kind: 'deep', shape: 'well', x: 0.8, y: 0.54, links: ['deep1', 'deep2', 'abyss1', 'abyss2'], blurb: 'Ein enger Schacht, der immer weiter hinabführt.', deep: 70, wide: 2.6, shells: 2, caves: ['b'], sun: 2 },
  abyss1: { kind: 'abyss', shape: 'vee', x: 0.92, y: 0.26, links: ['deep3', 'abyss2'], blurb: 'Kein Licht erreicht diesen Grund.', deep: 80, wide: 2.6, shells: 2, caves: [], sun: 2, apex: true },
  abyss2: { kind: 'abyss', shape: 'well', x: 0.9, y: 0.8, links: ['deep3', 'abyss1'], blurb: 'Stille. Und etwas, das atmet.', deep: 90, wide: 2.4, shells: 2, caves: [], sun: 1, apex: true, mul: [0.8, 0.8, 0.7, 1.15] },
};

/** Zone nach Art des Ortes. veils = Farbe des Schleiers für bewachsene und trübe Orte. */
function zoneFor(kind: PlaceKind, name: string, veils: { lush: number; murky: number }, mul?: RoleDef['mul'], light = 1): ZoneDef {
  const [pl, cv, pr, hn] = mul ?? [1, 1, 1, 1];
  switch (kind) {
    case 'start': return zone(name, 0, 0, 1, 1, 1, 1, 1, 1, 0);
    case 'lush': return zone(name, veils.lush, 0.18, 1.1, 1.15 * light, 2.3 * pl, 1.8 * cv, 1.5 * pr, 0.4 * hn, 1);
    case 'murky': return zone(name, veils.murky, 0.36, 1.9, 0.55 * light, 1.2 * pl, 1.5 * cv, 1.2 * pr, 0.5 * hn, 1);
    case 'deep': return zone(name, 0x061424, 0.26, 0.6, 0.65 * light, 0.5 * pl, 0.6 * cv, 0.9 * pr, 1.8 * hn, 2);
    case 'abyss': return zone(name, 0x020a14, 0.3, 0.5, 0.45 * light, 0.3 * pl, 0.4 * cv, 0.6 * pr, 2.4 * hn, 2);
  }
}

/** Orte, Namen und Farben je Zeitalter. */
const EPOCH_PLACES: Record<string, { names: Record<Role, [string, string]>; veils: { lush: number; murky: number }; light: number; hunters: number; startShells: number }> = {
  ordovizium: {
    names: {
      start: ['lagune', 'Seichte Lagune'], lush1: ['tang', 'Tangwiese'], lush2: ['schwamm', 'Schwammgarten'], murky1: ['bucht', 'Trübe Bucht'], murky2: ['sandfeld', 'Sandfeld'],
      deep1: ['kante', 'Tiefe Kante'], deep2: ['klippe', 'Klippenhang'], deep3: ['spalt', 'Der Spalt'], abyss1: ['abgrund', 'Der Abgrund'], abyss2: ['tiefsee', 'Schwarze Tiefe'],
    },
    veils: { lush: 0x1a4a2c, murky: 0x2e3a1c }, light: 1, hunters: 1, startShells: 1,
  },
  silur: {
    names: {
      start: ['kelp', 'Kelpwald'], lush1: ['dickicht', 'Tangdickicht'], lush2: ['teppich', 'Algenteppich'], murky1: ['schlick', 'Schlickebene'], murky2: ['nebel', 'Nebelbank'],
      deep1: ['graben', 'Dunkler Graben'], deep2: ['hang', 'Schroffer Hang'], deep3: ['schlund', 'Der Schlund'], abyss1: ['tiefe', 'Die Tiefe'], abyss2: ['nacht', 'Ewige Nacht'],
    },
    veils: { lush: 0x1a4a2a, murky: 0x2a2e1c }, light: 0.95, hunters: 1.05, startShells: 0,
  },
  devon: {
    names: {
      start: ['riff', 'Panzerfischriff'], lush1: ['garten', 'Korallengarten'], lush2: ['wald', 'Schwammwald'], murky1: ['delta', 'Trübes Delta'], murky2: ['bank', 'Schlammbank'],
      deep1: ['wand', 'Steilwand'], deep2: ['terrasse', 'Terrassenhang'], deep3: ['kluft', 'Die Kluft'], abyss1: ['maul', 'Das Maul der Tiefe'], abyss2: ['grund', 'Der Letzte Grund'],
    },
    veils: { lush: 0x1a4a3a, murky: 0x302e18 }, light: 0.95, hunters: 1.1, startShells: 0,
  },
};

function buildPlaces(epId: string): PlaceDef[] {
  const spec = EPOCH_PLACES[epId];
  const roles = Object.keys(ROLES) as Role[];
  const idOf = (r: Role) => spec.names[r][0];
  return roles.map((r) => {
    const d = ROLES[r];
    const [id, name] = spec.names[r];
    const def = zoneFor(d.kind, name, spec.veils, d.mul, spec.light);
    def.hunters *= spec.hunters;
    return {
      id, name, kind: d.kind, x: d.x, y: d.y, links: d.links.map(idOf), blurb: d.blurb, def,
      deep: d.deep, wide: d.wide, shells: r === 'start' ? spec.startShells : d.shells, apex: d.apex, shape: d.shape, caves: d.caves, sun: d.sun,
    };
  });
}

/** Orte je Zeitalter. Der erste ist immer der Start. */
export const PLACES: Record<string, PlaceDef[]> = Object.fromEntries(Object.keys(EPOCH_PLACES).map((id) => [id, buildPlaces(id)]));

export const placesOf = (ep: EpochDef | string): PlaceDef[] => PLACES[typeof ep === 'string' ? ep : ep.id] ?? [];

export function placeOf(ep: EpochDef | string, id: string): PlaceDef {
  const list = placesOf(ep);
  return list.find((p) => p.id === id) ?? list[0];
}

/** Der Startort eines Zeitalters. */
export const startPlace = (ep: EpochDef | string) => placesOf(ep)[0];

/** Wo im Ort der Durchgang zu einem Nachbarn liegt: Westen/Osten in der Wand, Süden im Boden, Norden oben im Licht. */
export type GateKind = 'left' | 'right' | 'floor' | 'surface';

export function gateKind(from: PlaceDef, to: PlaceDef): GateKind {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dy) > 0.9 * Math.abs(dx) + 0.12) return dy > 0 ? 'floor' : 'surface';
  return dx < 0 ? 'left' : 'right';
}

/** Alle Muscheln eines Zeitalters: Kennung "zeitalter:ort:nr". */
export const shellId = (ep: string, place: string, k: number) => `${ep}:${place}:${k}`;

/** Zeit, die ein Weg über die Karte kostet (Sekunden des Zeitalters). */
export const TRAVEL_SECONDS = 7;

/** Wie viele Muscheln es insgesamt zu finden gibt. */
export const SHELLS_TOTAL = EPOCHS.reduce((n, e) => n + placesOf(e).reduce((m, p) => m + p.shells, 0), 0);
