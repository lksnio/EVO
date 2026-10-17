import { EPOCHS, type EpochDef } from './epochs';

// ---------------------------------------------------------------------------
// Die Weltkarte. Jedes Zeitalter hat mehrere Orte; wer am Rand eines Ortes hinausschwimmt,
// landet auf der Karte und sucht sich den nächsten aus. Die Orte unterscheiden sich:
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
  /** zusätzliche Tiefe in Kacheln (der Normalort ist 31 Kacheln tief; negativ = flacher) */
  deep: number;
  /** Breite im Verhältnis zur Breite des Zeitalters */
  wide: number;
  /** wie viele Muscheln hier liegen (die erste liegt im ersten Gewässer direkt vor dir) */
  shells: number;
  /** hier lebt einer der ganz Großen */
  apex?: boolean;
}

const START_BLURB = 'Hier beginnt alles.';
const LUSH = 'Dichtes Grün. Hier gibt es viel zu fressen.';
const MURKY = 'Trübes Wasser. Man sieht kaum die eigene Flosse.';
const DEEP = 'Das Wasser fällt steil ab. Tief unten wartet etwas.';
const ABYSS = 'Kein Licht erreicht diesen Grund.';

/** Orte je Zeitalter. Der erste ist immer der Start. */
export const PLACES: Record<string, PlaceDef[]> = {
  ordovizium: [
    { id: 'lagune', name: 'Seichte Lagune', kind: 'start', x: 0.46, y: 0.52, links: ['tang', 'bucht', 'kante'], blurb: START_BLURB, def: zone('Seichte Lagune', 0, 0, 1, 1, 1, 1, 1, 1, 0), deep: 0, wide: 2, shells: 1 },
    { id: 'tang', name: 'Tangwiese', kind: 'lush', x: 0.2, y: 0.3, links: ['lagune', 'bucht'], blurb: LUSH, def: zone('Tangwiese', 0x1a4a2c, 0.18, 1.1, 1.15, 2.3, 1.8, 1.5, 0.4, 1), deep: -5, wide: 1.7, shells: 1 },
    { id: 'bucht', name: 'Trübe Bucht', kind: 'murky', x: 0.22, y: 0.74, links: ['lagune', 'tang'], blurb: MURKY, def: zone('Trübe Bucht', 0x2e3a1c, 0.36, 1.9, 0.55, 1.2, 1.5, 1.2, 0.5, 1), deep: 0, wide: 1.5, shells: 1 },
    { id: 'kante', name: 'Tiefe Kante', kind: 'deep', x: 0.72, y: 0.6, links: ['lagune', 'abgrund'], blurb: DEEP, def: zone('Tiefe Kante', 0x061424, 0.26, 0.6, 0.65, 0.5, 0.6, 0.9, 1.8, 2), deep: 22, wide: 1.6, shells: 2 },
    { id: 'abgrund', name: 'Der Abgrund', kind: 'abyss', x: 0.88, y: 0.27, links: ['kante'], blurb: ABYSS, def: zone('Der Abgrund', 0x020a14, 0.3, 0.5, 0.45, 0.3, 0.4, 0.6, 2.4, 2), deep: 34, wide: 1.5, shells: 2, apex: true },
  ],
  silur: [
    { id: 'kelp', name: 'Kelpwald', kind: 'start', x: 0.5, y: 0.5, links: ['dickicht', 'schlick', 'graben'], blurb: START_BLURB, def: zone('Kelpwald', 0, 0, 1, 1, 1, 1, 1, 1, 0), deep: 0, wide: 2, shells: 0 },
    { id: 'dickicht', name: 'Tangdickicht', kind: 'lush', x: 0.24, y: 0.28, links: ['kelp', 'schlick'], blurb: LUSH, def: zone('Tangdickicht', 0x1a4a2a, 0.2, 1.1, 1.1, 2.3, 1.9, 1.5, 0.4, 1), deep: -5, wide: 1.7, shells: 1 },
    { id: 'schlick', name: 'Schlickebene', kind: 'murky', x: 0.26, y: 0.76, links: ['kelp', 'dickicht'], blurb: MURKY, def: zone('Schlickebene', 0x2a2e1c, 0.38, 2, 0.5, 1.1, 1.4, 1.2, 0.5, 1), deep: 0, wide: 1.5, shells: 1 },
    { id: 'graben', name: 'Dunkler Graben', kind: 'deep', x: 0.74, y: 0.64, links: ['kelp', 'tiefe'], blurb: DEEP, def: zone('Dunkler Graben', 0x061424, 0.26, 0.6, 0.6, 0.5, 0.6, 0.9, 1.8, 2), deep: 22, wide: 1.6, shells: 2 },
    { id: 'tiefe', name: 'Die Tiefe', kind: 'abyss', x: 0.9, y: 0.3, links: ['graben'], blurb: ABYSS, def: zone('Die Tiefe', 0x020a14, 0.3, 0.5, 0.4, 0.3, 0.4, 0.6, 2.4, 2), deep: 34, wide: 1.5, shells: 2, apex: true },
  ],
  devon: [
    { id: 'riff', name: 'Panzerfischriff', kind: 'start', x: 0.48, y: 0.46, links: ['garten', 'delta', 'wand'], blurb: START_BLURB, def: zone('Panzerfischriff', 0, 0, 1, 1, 1, 1, 1, 1, 0), deep: 0, wide: 2, shells: 0 },
    { id: 'garten', name: 'Korallengarten', kind: 'lush', x: 0.22, y: 0.26, links: ['riff', 'delta'], blurb: LUSH, def: zone('Korallengarten', 0x1a4a3a, 0.16, 1.1, 1.2, 2.2, 1.7, 1.5, 0.5, 1), deep: -5, wide: 1.7, shells: 1 },
    { id: 'delta', name: 'Trübes Delta', kind: 'murky', x: 0.24, y: 0.72, links: ['riff', 'garten'], blurb: MURKY, def: zone('Trübes Delta', 0x302e18, 0.36, 1.9, 0.55, 1.2, 1.4, 1.2, 0.6, 1), deep: 0, wide: 1.5, shells: 1 },
    { id: 'wand', name: 'Steilwand', kind: 'deep', x: 0.72, y: 0.56, links: ['riff', 'maul'], blurb: DEEP, def: zone('Steilwand', 0x061424, 0.26, 0.6, 0.6, 0.5, 0.6, 0.9, 1.9, 2), deep: 22, wide: 1.6, shells: 2 },
    { id: 'maul', name: 'Das Maul der Tiefe', kind: 'abyss', x: 0.9, y: 0.24, links: ['wand'], blurb: ABYSS, def: zone('Das Maul der Tiefe', 0x020a14, 0.3, 0.5, 0.4, 0.3, 0.4, 0.6, 2.6, 2), deep: 34, wide: 1.5, shells: 2, apex: true },
  ],
};

export const placesOf = (ep: EpochDef | string): PlaceDef[] => PLACES[typeof ep === 'string' ? ep : ep.id] ?? [];

export function placeOf(ep: EpochDef | string, id: string): PlaceDef {
  const list = placesOf(ep);
  return list.find((p) => p.id === id) ?? list[0];
}

/** Der Startort eines Zeitalters. */
export const startPlace = (ep: EpochDef | string) => placesOf(ep)[0];

/** Alle Muscheln eines Zeitalters: Kennung "zeitalter:ort:nr". */
export const shellId = (ep: string, place: string, k: number) => `${ep}:${place}:${k}`;

/** Zeit, die ein Weg über die Karte kostet (Sekunden des Zeitalters). */
export const TRAVEL_SECONDS = 7;

/** Wie viele Muscheln es insgesamt zu finden gibt. */
export const SHELLS_TOTAL = EPOCHS.reduce((n, e) => n + placesOf(e).reduce((m, p) => m + p.shells, 0), 0);
