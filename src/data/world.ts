import type { EpochDef } from './epochs';
import { PALEO } from './paleo';

// ---------------------------------------------------------------------------
// Die Weltkarte. Jedes Zeitalter hat zehn Orte; wer links oder rechts über den Rand eines Ortes hinausschwimmt,
// kommt in den Nachbarort – der Weg dorthin erscheint auf der Karte, und auf ihm kann man später auch andere bekannte Orte
// ansteuern. Die Orte unterscheiden sich: manche sind dicht bewachsen und voller Nahrung, andere trüb – und manche reichen
// tief hinab, wo die schlimmen Tiere warten.
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
export type PlaceShape = 'bowl' | 'meadow' | 'ridges' | 'vee' | 'well' | 'river';

/** Höhlen eines Ortes: g = grüne Höhle (färbt grün), b = schwarze Höhle. Die erste liegt nahe beim Ankunftsplatz. */
export type CaveKind = 'g' | 'b';

/**
 * Das Geröll vor einer Höhle bricht bei einem Stoß, der mindestens need × der Grund-Stoßkraft der Körperform hat (der Urfisch
 * schafft allein höchstens etwa zwei Drittel davon). Jeder Artgenosse, der dich begleitet und dabei näher als near bei dir
 * ist, stößt mit und gibt perKin deiner Stoßkraft dazu – mit drei Begleitern und vollem Anlauf reicht es.
 */
export const CAVE_WALL = { need: 1.5, perKin: 0.25, near: 520 };

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
  /** die durchquerbaren Farbtunnel dieses Ortes (selten) */
  caves: CaveKind[];
  /** wie viele Stellen an der Oberfläche Licht hereinlassen */
  sun: number;
  /**
   * sicher: Außer der eigenen Art lebt hier kein Tier (keine Bewohner, keine Durchzügler, keine Gelege fremder Arten) –
   * das Startgebiet, klein und still; Pflanzen wachsen trotzdem
   */
  safe?: boolean;
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
  caves: CaveKind[];
  sun: number;
  safe?: boolean;
  /** Feinabstimmung der Gebiets-Faktoren: Pflanzen, Dickicht, Beute, Jäger */
  mul?: [number, number, number, number];
  apex?: boolean;
}

/**
 * Zehn Orte je Zeitalter, miteinander verbunden wie ein Netz. Von einem Ort in den nächsten kommt man über den Rand – wer
 * hinüberschwimmt, sieht den Ort und den Weg danach auf der Karte. Die Farbtunnel sind selten und liegen weit vom Start.
 */
const ROLES: Record<Role, RoleDef> = {
  // das Startgebiet: klein, nur der Laichfluss und seine Mündung – und sicher (siehe PlaceDef.safe)
  start: { kind: 'start', shape: 'river', links: ['lush1', 'lush2', 'murky1', 'deep1'], deep: 14, wide: 1.25, caves: [], sun: 4, safe: true },
  lush1: { kind: 'lush', shape: 'meadow', links: ['start', 'lush2', 'murky2'], deep: 2, wide: 3.1, caves: [], sun: 6, mul: [1, 1, 1, 1] },
  lush2: { kind: 'lush', shape: 'bowl', links: ['start', 'lush1', 'deep2'], deep: 10, wide: 3, caves: [], sun: 6, mul: [1.1, 1.15, 0.9, 0.8] },
  murky1: { kind: 'murky', shape: 'ridges', links: ['start', 'murky2'], deep: 12, wide: 2.8, caves: [], sun: 3 },
  murky2: { kind: 'murky', shape: 'meadow', links: ['lush1', 'murky1'], deep: 6, wide: 3.2, caves: ['g'], sun: 3, mul: [0.8, 0.9, 1, 0.7] },
  deep1: { kind: 'deep', shape: 'vee', links: ['start', 'deep2', 'deep3'], deep: 60, wide: 2.8, caves: [], sun: 3 },
  deep2: { kind: 'deep', shape: 'ridges', links: ['lush2', 'deep1', 'deep3'], deep: 42, wide: 3, caves: [], sun: 3, mul: [0.8, 0.9, 0.9, 1.1] },
  deep3: { kind: 'deep', shape: 'well', links: ['deep1', 'deep2', 'abyss1', 'abyss2'], deep: 70, wide: 2.6, caves: ['b'], sun: 2 },
  abyss1: { kind: 'abyss', shape: 'vee', links: ['deep3', 'abyss2'], deep: 80, wide: 2.6, caves: [], sun: 2, apex: true },
  abyss2: { kind: 'abyss', shape: 'well', links: ['deep3', 'abyss1'], deep: 90, wide: 2.4, caves: [], sun: 1, apex: true, mul: [0.8, 0.8, 0.7, 1.15] },
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
const EPOCH_PLACES: Record<string, { names: Record<Role, [string, string]>; veils: { lush: number; murky: number }; light: number; hunters: number }> = {
  ordovizium: {
    names: {
      start: ['lagune', 'Der Laichfluss'], lush1: ['tang', 'Tangwiese'], lush2: ['schwamm', 'Schwammgarten'], murky1: ['bucht', 'Trübe Bucht'], murky2: ['sandfeld', 'Sandfeld'],
      deep1: ['kante', 'Tiefe Kante'], deep2: ['klippe', 'Klippenhang'], deep3: ['spalt', 'Der Spalt'], abyss1: ['abgrund', 'Der Abgrund'], abyss2: ['tiefsee', 'Schwarze Tiefe'],
    },
    veils: { lush: 0x1a4a2c, murky: 0x2e3a1c }, light: 1, hunters: 1,
  },
  silur: {
    names: {
      start: ['kelp', 'Kelpmündung'], lush1: ['dickicht', 'Tangdickicht'], lush2: ['teppich', 'Algenteppich'], murky1: ['schlick', 'Schlickebene'], murky2: ['nebel', 'Nebelbank'],
      deep1: ['graben', 'Dunkler Graben'], deep2: ['hang', 'Schroffer Hang'], deep3: ['schlund', 'Der Schlund'], abyss1: ['tiefe', 'Die Tiefe'], abyss2: ['nacht', 'Ewige Nacht'],
    },
    veils: { lush: 0x1a4a2a, murky: 0x2a2e1c }, light: 0.95, hunters: 1.05,
  },
  devon: {
    names: {
      start: ['riff', 'Der Laichfluss'], lush1: ['garten', 'Korallengarten'], lush2: ['wald', 'Schwammwald'], murky1: ['delta', 'Trübes Delta'], murky2: ['bank', 'Schlammbank'],
      deep1: ['wand', 'Steilwand'], deep2: ['terrasse', 'Terrassenhang'], deep3: ['kluft', 'Die Kluft'], abyss1: ['maul', 'Das Maul der Tiefe'], abyss2: ['grund', 'Der Letzte Grund'],
    },
    veils: { lush: 0x1a4a3a, murky: 0x302e18 }, light: 0.95, hunters: 1,
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
    const [x, y] = PALEO[epId].nodes[r];
    return {
      id, name, kind: d.kind, x, y, links: d.links.map(idOf), def,
      deep: d.deep, wide: d.wide, apex: d.apex, shape: d.shape, caves: d.caves, sun: d.sun, safe: d.safe,
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
  const nb = from.links.map((id) => placeOf(ep, id));
  if (!nb.length) return undefined;
  // Der Startfluss entspringt links (dort geht es nicht hinaus); rechts führt er ins Meer und zum ersten bewachsenen Ort
  if (from.kind === 'start') return side === 'left' ? undefined : nb[0];
  const dir = side === 'left' ? -1 : 1;
  let cand = nb.filter((q) => (q.x - from.x) * dir > 0);
  if (!cand.length) cand = [nb.slice().sort((a, b) => (b.x - from.x) * dir - (a.x - from.x) * dir)[0]];
  cand.sort((a, b) => a.y - b.y);
  return cand[Math.min(cand.length - 1, Math.floor(Math.max(0, Math.min(0.999, frac)) * cand.length))];
}
