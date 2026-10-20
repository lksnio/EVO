import type { ClassId } from './classes';

// ---------------------------------------------------------------------------
// Die Zeitalter (Epochen). Jedes ist eine eigene Welt – ein fester Zeitraum der Erdgeschichte, in dem eine Uhr von "from"
// bis "to" läuft (Jahre vor heute). Man lebt immer in einem Zeitalter: Jede Linie beginnt dort mit dessen Urahn und
// entwickelt sich über Generationen – im Mehrspieler treffen sich alle, die dasselbe Zeitalter gewählt haben.
// Sieben stehen zur Wahl: Devon, Karbon, Perm, Trias, Jura, Kreidezeit, Paläogen. Spielbar ist vorerst nur das Devon, die
// anderen ruhen noch („im Gestein“). Ordovizium und Silur sind verborgen (ihre Tiere, Orte und Karten bleiben für später).
// Die Reihenfolge ist Teil des Spielstands (Nummern): Nummer 0 war früher das Ordovizium – ältere Spielstände leben deshalb
// im Devon weiter. Neue Zeitalter kommen ans Ende.
// ---------------------------------------------------------------------------

export type Theme = 'ozean' | 'sumpf' | 'reptil' | 'eis' | 'eden';

/** leviathan: Kino-Moment – Zeitlupe, die Kamera rückt heran, ein riesiger Schatten zieht durch die Tiefe */
export type EventKind = 'predator' | 'bloom' | 'storm' | 'boss' | 'leviathan';

export interface EventDef {
  /** Zeitpunkt im Zeitalter: 0 = Beginn, 1 = Ende */
  at: number;
  kind: EventKind;
  /** Räuber, die durchziehen */
  species?: string;
  count?: number;
  /** Dauer (Sturm) in Sekunden */
  dur?: number;
  /** zieht nur schnell vorbei (verstecken!) */
  fast?: boolean;
}

export interface EpochDef {
  id: string;
  /** erdgeschichtlicher Name */
  name: string;
  /** spielbar: Nur hier kann man ein Leben beginnen – die anderen ruhen noch „im Gestein“ */
  playable?: boolean;
  /** (noch) nicht zu sehen – weder in der Auswahl noch in der Chronik des Lebens oder im Stammbaum (Daten für später) */
  hidden?: boolean;
  /** eine Zeile in der Auswahl der Zeitalter */
  tagline: string;
  /** zwei, drei Sätze zur Welt dieses Zeitalters */
  blurb: string;
  /** der ganze erdgeschichtliche Zeitraum (Millionen Jahre vor heute) – für die Auswahl und den Zeitstrom */
  period: [number, number];
  /** weiblich: „die Trias“, „die Kreidezeit“ (sonst „das Devon“, „der Jura“ …) */
  fem?: boolean;
  /** Lebensraum */
  place: string;
  theme: Theme;
  /** Körperform, die in diesem Zeitalter lebt */
  cls: ClassId;
  habitat: 'water' | 'land';
  /** Jahre vor heute zu Beginn bzw. am Ende */
  from: number;
  to: number;
  /** Spielzeit in Sekunden */
  seconds: number;
  music: string;
  hazardDmg: number;
  /** Breite in Kacheln */
  len: number;
  plants: number;
  cover: number;
  cave?: boolean;
  dark?: boolean;
  kelp?: boolean;
  reef?: boolean;
  /** Tiere: Art und Anzahl der Gruppen */
  fauna: [string, number][];
  /** größere Tiere, die hin und wieder durchs Bild ziehen (Art, Gewicht): meist friedlich – sie jagen kleine Fische und ziehen weiter */
  passers: [string, number][];
  events: EventDef[];
}

const M = 1e6;

/** Ein Zeitalter, das noch ruht: Bild und Text stehen schon, seine Welt und seine Tiere folgen (die Zahlen sind Platzhalter). */
function later(id: string, name: string, tagline: string, period: [number, number], blurb: string, place: string, theme: Theme, cls: ClassId, habitat: 'water' | 'land', fem = false): EpochDef {
  return {
    id, name, tagline, period, blurb, place, theme, cls, habitat, fem,
    from: period[0] * M, to: period[1] * M, seconds: 600, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.8, cover: 0.5,
    fauna: [], passers: [], events: [],
  };
}

export const EPOCHS: EpochDef[] = [
  // ---------------------------------------------------------------- I. Devon – hier beginnt alles
  {
    id: 'devon', name: 'Devon', playable: true, tagline: 'Das Zeitalter der Fische', period: [419, 359],
    blurb: 'Riffe aus Korallen und Schwämmen säumen die Küsten. Panzerfische, frühe Haie und Fleischflosser ringen um die Vorherrschaft – über allen thront Dunkleosteus.',
    place: 'Panzerfischriff', theme: 'ozean', cls: 'fish', habitat: 'water', reef: true,
    from: 383 * M, to: 371 * M, seconds: 540, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.85, cover: 0.55,
    // viel kleine Beute, wenige Jäger (die meisten in der Tiefe) – das erste Zeitalter soll man überleben können
    fauna: [
      ['moythomasia', 9], ['acanthodes', 5], ['thelodus', 4], ['kieferlos', 4], ['cheiracanthus', 3.5], ['drepanaspis', 3], ['dipterus', 2.5],
      ['cephalaspis', 2], ['pteraspis', 2], ['trilobit', 3], ['dalmanites', 1.5],
      ['bothriolepis', 1.6], ['pterichthyodes', 1.4], ['climatius', 0.8], ['qualle', 1],
      ['conodont', 0.8], ['osteolepis', 0.4], ['cheirolepis', 0.4], ['orthoceras', 0.4], ['coccosteus', 0.35], ['seeskorpion', 0.2],
      ['cladoselache', 0.25], ['rolfosteus', 0.25], ['eusthenopteron', 0.2], ['stethacanthus', 0.15], ['holoptychius', 0.12], ['tiktaalik', 0.12], ['hyneria', 0.08],
    ],
    passers: [['cladoselache', 3], ['coccosteus', 2], ['stethacanthus', 1.5], ['rolfosteus', 1.5], ['eusthenopteron', 1.5], ['holoptychius', 1], ['pterygotus', 0.6], ['hyneria', 0.5]],
    events: [
      { at: 0.06, kind: 'predator', species: 'dunkleosteus', fast: true },
      { at: 0.32, kind: 'predator', species: 'dunkleosteus' },
      { at: 0.72, kind: 'bloom' },
    ],
  },
  // ---------------------------------------------------------------- II.–VII. ruhen noch: Bild und Text stehen, Welt und Tiere folgen
  later('karbon', 'Karbon', 'Die Kohlewälder', [359, 299],
    'Dampfende Sumpfwälder aus Schuppenbäumen und Riesenschachtelhalmen. Libellen so groß wie Möwen schwirren durch den Nebel, und die ersten Amphibien kriechen ans Ufer.',
    'Kohlesumpf', 'sumpf', 'amphibian', 'land'),
  later('perm', 'Perm', 'Das Reich der Segelrücken', [299, 252],
    'Alle Kontinente sind zu Pangäa verschmolzen. Im trockenen Land herrschen Segelechsen wie Dimetrodon – die fernen Vorfahren der Säugetiere. Am Ende steht das größte Massensterben der Erdgeschichte.',
    'Pangäa', 'reptil', 'reptile', 'land'),
  later('trias', 'Trias', 'Die ersten Dinosaurier', [252, 201],
    'Nach dem großen Sterben erholt sich das Leben. In der heißen Pangäa erscheinen die ersten Dinosaurier, im Meer jagen Fischechsen, und die ersten Säugetiere huschen durch die Nacht.',
    'Pangäa', 'reptil', 'reptile', 'land', true),
  later('jura', 'Jura', 'Das Zeitalter der Giganten', [201, 145],
    'Pangäa bricht auseinander. Riesige Langhalssaurier ziehen durch Farnwälder, Flugsaurier segeln über Lagunen, und im Meer jagen Plesiosaurier.',
    'Lagunen und Farnwälder', 'reptil', 'reptile', 'land'),
  // die späte Kreidezeit: das Westliche Binnenmeer, das Nordamerika teilte (die Zahlen sind vorläufig)
  {
    id: 'kreide', name: 'Kreidezeit', fem: true, tagline: 'Die Herrschaft der Meeresechsen', period: [145, 66],
    blurb: 'Ein warmes Binnenmeer teilt Nordamerika. Mosasaurier und Plesiosaurier jagen, Riesenhaie ziehen ihre Bahnen, und Ammoniten treiben im Licht.',
    place: 'Westliches Binnenmeer', theme: 'ozean', cls: 'fish', habitat: 'water',
    from: 82 * M, to: 72 * M, seconds: 600, music: 'ozean', hazardDmg: 4, len: 95, plants: 0.6, cover: 0.45,
    fauna: [
      ['apsopelix', 9], ['gillicus', 2.5], ['ammonit', 3], ['baculites', 2], ['enchodus', 1.2], ['protosphyraena', 0.6], ['squalicorax', 0.6],
      ['qualle', 1], ['archelon', 0.4], ['xiphactinus', 0.4],
    ],
    passers: [['platecarpus', 3], ['elasmosaurus', 2], ['cretoxyrhina', 2], ['xiphactinus', 2], ['tylosaurus', 1]],
    events: [
      { at: 0.1, kind: 'predator', species: 'tylosaurus', fast: true },
      { at: 0.45, kind: 'predator', species: 'mosasaurus' },
      { at: 0.75, kind: 'bloom' },
    ],
  },
  later('palaeogen', 'Paläogen', 'Die Zeit der Säugetiere', [66, 23],
    'Die Dinosaurier sind verschwunden. Säugetiere erobern Land und Meer – die ersten Wale tasten sich ins Wasser, und Wälder bedecken die Erde bis an die Pole.',
    'Urwälder und Küsten', 'eden', 'mammal', 'land'),
  // ---------------------------------------------------------------- verborgen (für später)
  {
    id: 'ordovizium', name: 'Ordovizium', hidden: true, tagline: 'Die ersten Fische', period: [485, 443],
    blurb: 'Flache, warme Meere bedecken die Erde. Riesige Kopffüßer jagen im offenen Wasser, Trilobiten pflügen durch den Schlamm – und mittendrin schwimmen die ersten Fische, noch ohne Kiefer.',
    place: 'Seichte Lagune', theme: 'ozean', cls: 'fish', habitat: 'water',
    from: 470 * M, to: 458 * M, seconds: 450, music: 'ozean', hazardDmg: 3, len: 80, plants: 0.95, cover: 0.5,
    fauna: [
      ['kieferlos', 8], ['sacabambaspis', 4.5], ['arandaspis', 4.5], ['astraspis', 4.9], ['eriptychius', 2.4], ['trilobit', 3.6], ['isotelus', 1.8],
      ['conodont', 1], ['qualle', 1], ['orthoceras', 0.7], ['megalograptus', 0.2],
    ],
    passers: [['orthoceras', 3], ['megalograptus', 2], ['cameroceras', 0.8]],
    events: [
      { at: 0.08, kind: 'predator', species: 'cameroceras', fast: true },
      { at: 0.42, kind: 'predator', species: 'cameroceras' },
      { at: 0.72, kind: 'bloom' },
    ],
  },
  {
    id: 'silur', name: 'Silur', hidden: true, tagline: 'Die ersten Kiefer', period: [443, 419],
    blurb: 'Tangwälder wiegen sich in der Strömung. Die ersten Fische mit Kiefern jagen – und riesige Seeskorpione lauern am Grund.',
    place: 'Kelpwald', theme: 'ozean', cls: 'fish', habitat: 'water', kelp: true,
    from: 438 * M, to: 427 * M, seconds: 500, music: 'ozean', hazardDmg: 3, len: 85, plants: 0.8, cover: 0.95,
    fauna: [
      ['kieferlos', 4], ['birkenia', 10.4], ['cephalaspis', 2.6], ['pteraspis', 4.5], ['thelodus', 8.2], ['jamoytius', 2.5], ['lasanius', 5.9], ['climatius', 1.6],
      ['trilobit', 2], ['dalmanites', 2.4], ['conodont', 0.9], ['entelognathus', 0.7], ['qualle', 1.5], ['orthoceras', 1.1], ['megalograptus', 0.2], ['pterygotus', 0.2],
    ],
    passers: [['entelognathus', 3], ['seeskorpion', 2], ['orthoceras', 1.5], ['megalograptus', 1.5], ['pterygotus', 0.8]],
    events: [
      { at: 0.07, kind: 'predator', species: 'pterygotus', fast: true },
      { at: 0.22, kind: 'leviathan' },
      { at: 0.35, kind: 'predator', species: 'seeskorpion', count: 3 },
      { at: 0.68, kind: 'storm', dur: 18 },
    ],
  },
];

/** Die Zeitalter, die man sieht (Auswahl, Chronik des Lebens, Stammbaum) – in der Reihenfolge der Erdgeschichte, mit ihrer Nummer. */
export const ERAS: { i: number; ep: EpochDef }[] = EPOCHS.map((ep, i) => ({ i, ep })).filter((e) => !e.ep.hidden);

/** Kann man in diesem Zeitalter (Nummer) leben? */
export const isPlayable = (i: number) => !!EPOCHS[i]?.playable;

/** „im Devon“, „in der Trias“, „in der Kreidezeit“ */
export const inEra = (ep: EpochDef) => (ep.fem ? `in der ${ep.name}` : `im ${ep.name}`);
/** „des Devons“, „der Trias“, „der Kreidezeit“ */
export const ofEra = (ep: EpochDef) => (ep.fem ? `der ${ep.name}` : `des ${ep.name}s`);

export const epochIndex = (id: string) => EPOCHS.findIndex((e) => e.id === id);

// ---------------------------------------------------------------- Zeitangaben

const de = (n: number) => Math.round(n).toLocaleString('de-DE');

/**
 * "vor 452.320.000 Jahren": Die Uhr zählt in Zehnerpotenzen – so fein, wie die Zeit
 * gerade vergeht (step = Jahre, die ungefähr pro Anzeige-Takt verstreichen).
 */
export function yearsAgo(years: number, step: number) {
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, step)))));
  const v = Math.round(years / p) * p;
  return v <= 0 ? 'heute' : `vor ${de(v)} Jahren`;
}

/** Kurz: "470 Mio. J.", "400.000 J." */
export function shortYears(years: number) {
  if (years >= 1e6) {
    const m = years / 1e6;
    return `${m >= 10 ? de(m) : m.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. J.`;
  }
  return `${de(years)} J.`;
}

/** Dauer in Worten: "11 Millionen Jahre", "388.000 Jahre" */
export function spanWords(years: number) {
  if (years >= 1e6) {
    const m = years / 1e6;
    const s = m >= 10 ? de(m) : m.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    return `${s} ${m < 1.5 ? 'Million' : 'Millionen'} Jahre`;
  }
  return `${de(years)} Jahre`;
}
