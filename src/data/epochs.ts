import type { ClassId } from './classes';

// ---------------------------------------------------------------------------
// Die Zeitalter (Epochen). Jedes ist eine eigene Welt – ein fester Zeitraum der Erdgeschichte, in dem eine Uhr von "from"
// bis "to" läuft (Jahre vor heute). Man lebt immer in einem Zeitalter: Jede Linie beginnt dort mit dessen Urahn und
// entwickelt sich über Generationen – im Mehrspieler treffen sich alle, die dasselbe Zeitalter gewählt haben.
// Sieben stehen zur Wahl: Devon, Karbon, Perm, Trias, Jura, Kreidezeit, Paläogen. Spielbar ist für den Prototyp nur das
// frühe Perm: fünf Orte – Laichfluss, Lagune, Tiefe, Ufersumpf und Hochland –, verbunden über eine Weltkarte. Devon und
// Karbon ruhen wieder „im Gestein“ (ihre Welten, Tiere und Regeln bleiben im Code für später), die übrigen ebenso.
// Ordovizium und Silur sind verborgen (ihre Tiere, Orte und Karten bleiben für später).
// Die Reihenfolge ist Teil des Spielstands (Nummern): Nummer 0 war früher das Ordovizium – ältere Spielstände leben deshalb
// im Devon weiter. Neue Zeitalter kommen ans Ende.
// ---------------------------------------------------------------------------

export type Theme = 'ozean' | 'sumpf' | 'reptil' | 'eis' | 'eden';

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
  /**
   * Brutzyklus statt Laichen (Karbon): Man beginnt mit einem Gelege voller Eier, wächst bis zur Metamorphose heran, verteidigt
   * danach das Nest, bis das neue Gelege kommt – die Eier sind die Leben (siehe data/karbon.ts, sim/brood.ts).
   */
  brood?: boolean;
  /** das dritte Merkmal an der großen Muschel: Sicht (unter Wasser) oder Sauerstoff (an Land) */
  meta?: 'sight' | 'oxy';
  /**
   * Gemalter Stil (wie das Devon): Die Wasserorte bekommen die gemalten Hintergründe, Riffe, den gemalten Laichfluss, Licht,
   * Seegang, Wetter, Himmel über der Oberfläche und die Laichfluss-Musik. Orte mit Land (Ufer, Hochland) bleiben im
   * gezeichneten Sumpfstil.
   */
  painted?: boolean;
  /** Reisen über die Weltkarte: Wer eine Karte links oder rechts verlässt, wählt auf der Weltkarte einen Nachbarort. */
  overworld?: boolean;
  /** Tiere: Art und Anzahl der Gruppen */
  fauna: [string, number][];
  /** Größter ansässiger Jäger, ausschließlich in dafür geeigneten tiefen Gebieten. */
  apex?: string;
  /** größere Tiere, die hin und wieder durchs Bild ziehen (Art, Gewicht): meist friedlich – sie jagen kleine Fische und ziehen weiter */
  passers: [string, number][];
}

const M = 1e6;

/** Ein Zeitalter, das noch ruht: Bild und Text stehen schon, seine Welt und seine Tiere folgen (die Zahlen sind Platzhalter). */
function later(id: string, name: string, tagline: string, period: [number, number], blurb: string, place: string, theme: Theme, cls: ClassId, habitat: 'water' | 'land', fem = false): EpochDef {
  return {
    id, name, tagline, period, blurb, place, theme, cls, habitat, fem,
    from: period[0] * M, to: period[1] * M, seconds: 600, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.8, cover: 0.5,
    fauna: [], passers: [],
  };
}

export const EPOCHS: EpochDef[] = [
  // ---------------------------------------------------------------- I. Devon – hier beginnt alles
  {
    id: 'devon', apex: 'dunkleosteus', name: 'Devonian', painted: true, tagline: 'The Age of Fishes', period: [419, 359],
    blurb: 'Reefs of coral and sponges line the coasts. Armoured fishes, early sharks and lobe-finned fishes vie for dominance — above them all reigns Dunkleosteus.',
    place: 'Placoderm Reef', theme: 'ozean', cls: 'fish', habitat: 'water', reef: true,
    from: 383 * M, to: 371 * M, seconds: 540, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.85, cover: 0.55,
    // viel kleine Beute, wenige Jäger (die meisten in der Tiefe) – das erste Zeitalter soll man überleben können
    fauna: [
      ['moythomasia', 9], ['acanthodes', 5], ['thelodus', 4], ['kieferlos', 4], ['cheiracanthus', 3.5], ['drepanaspis', 3], ['dipterus', 2.5],
      ['cephalaspis', 2], ['pteraspis', 2], ['trilobit', 3], ['dalmanites', 1.5],
      ['bothriolepis', 1.6], ['pterichthyodes', 1.4], ['climatius', 0.8], ['qualle', 1],
      ['conodont', 0.8], ['osteolepis', 0.4], ['cheirolepis', 0.4], ['orthoceras', 0.4], ['coccosteus', 0.35], ['seeskorpion', 0.2], ['pterygotus', 0.12], ['megalograptus', 0.15],
      ['cladoselache', 0.25], ['rolfosteus', 0.25], ['eusthenopteron', 0.2], ['stethacanthus', 0.15], ['holoptychius', 0.12], ['tiktaalik', 0.12], ['hyneria', 0.08],
    ],
    passers: [['cladoselache', 3], ['coccosteus', 2], ['stethacanthus', 1.5], ['rolfosteus', 1.5], ['eusthenopteron', 1.5], ['holoptychius', 1], ['pterygotus', 0.6], ['hyneria', 0.5]],
  },
  // ---------------------------------------------------------------- II.–VII. ruhen noch: Bild und Text stehen, Welt und Tiere folgen
  // ---------------------------------------------------------------- II. Karbon – an Land
  // das Unterkarbon (vor etwa 348 Millionen Jahren): Man lebt als Pederpes, einer der ersten Vierfüßer. Statt zu laichen gibt es
  // ein Gelege voller Eier – die Leben der Art (siehe data/karbon.ts). Räuber kommen nicht als Ereignis, sondern ans Nest.
  {
    id: 'karbon', apex: 'rhizodus', name: 'Carboniferous', brood: true, meta: 'oxy', tagline: 'The Coal Forests', period: [359, 299],
    blurb: 'Steaming swamps lie between islands and shores. Giant lobe-finned fishes lurk in the water; millipedes and scorpions crawl through the first forests — and the first tetrapods venture onto land.',
    place: 'Coal Swamp', theme: 'sumpf', cls: 'amphibian', habitat: 'land',
    from: 349 * M, to: 341 * M, seconds: 600, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.9, cover: 0.5,
    fauna: [
      ['elonichthys', 8], ['acanthodes', 4], ['tealliocaris', 3], ['bellinurus', 2.5], ['ctenodus', 1],
      ['tausendfuss', 4.5], ['urinsekt', 4.5], ['trigonotarbid', 3], ['hibbertopterus', 0.5],
      ['pulmonoscorpius', 0.5], ['megalichthys', 0.35], ['crassigyrinus', 0.3], ['strepsodus', 0.2], ['stethacanthus', 0.15],
    ],
    passers: [['megalichthys', 3], ['crassigyrinus', 2], ['strepsodus', 1.5], ['stethacanthus', 1]],
  },
  // ---------------------------------------------------------------- III. Perm – der Prototyp
  // das frühe Perm (vor etwa 290 Millionen Jahren): Man beginnt als Fisch im Laichfluss. Fünf Orte liegen auf der Weltkarte –
  // drei im Wasser (Laichfluss, Lagune und durch deren Schlucht die Tiefe), dazu der Ufersumpf und das trockene Hochland.
  // Jeder Ort hat seine eigenen Tiere (siehe data/world.ts), zwei Bosse: Orthacanthus in der Tiefe, Dimetrodon im Hochland.
  {
    id: 'perm', apex: 'orthacanthus', name: 'Permian', playable: true, painted: true, overworld: true, reef: true,
    tagline: 'The Realm of Sailbacks', period: [299, 252],
    blurb: 'All continents have joined into Pangaea. Freshwater sharks hunt in rivers and lakes, giant amphibians lurk at the shore, and sail-backed animals such as Dimetrodon rule the dry uplands.',
    place: 'Pangaea', theme: 'ozean', cls: 'fish', habitat: 'water',
    from: 295 * M, to: 283 * M, seconds: 540, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.85, cover: 0.55,
    // Richtwerte für alle Orte – welche Arten wo leben, legt jeder Ort selbst fest (PlaceDef.fauna)
    fauna: [
      ['paramblypterus', 8], ['aeduella', 8], ['acanthodes', 5], ['apateon', 3], ['platysomus', 4], ['gnathorhiza', 1.5],
      ['diplocaulus', 1.5], ['archegosaurus', 0.5], ['xenacanthus', 0.8], ['ectosteorhachis', 0.6], ['sclerocephalus', 0.6],
      ['eryops', 0.5], ['ophiacodon', 0.4],
      ['captorhinus', 3], ['cacops', 1.2], ['seymouria', 1], ['tausendfuss', 2.5], ['urinsekt', 2.5],
      ['eudibamus', 3], ['edaphosaurus', 0.6], ['diadectes', 0.6], ['varanops', 0.8],
    ],
    passers: [['xenacanthus', 2], ['ectosteorhachis', 1.5], ['archegosaurus', 1]],
  },
  later('trias', 'Triassic', 'The First Dinosaurs', [252, 201],
    'Life recovers after the great extinction. The first dinosaurs appear in hot Pangaea, ichthyosaurs hunt at sea, and the first mammals scurry through the night.',
    'Pangaea', 'reptil', 'reptile', 'land', true),
  later('jura', 'Jurassic', 'The Age of Giants', [201, 145],
    'Pangaea breaks apart. Giant long-necked dinosaurs roam fern forests, pterosaurs soar over lagoons, and plesiosaurs hunt at sea.',
    'Lagoons and Fern Forests', 'reptil', 'reptile', 'land'),
  // die späte Kreidezeit: das Westliche Binnenmeer, das Nordamerika teilte (die Zahlen sind vorläufig)
  {
    id: 'kreide', apex: 'mosasaurus', name: 'Cretaceous', fem: true, tagline: 'The Reign of Marine Reptiles', period: [145, 66],
    blurb: 'A warm inland sea divides North America. Mosasaurs and plesiosaurs hunt, giant sharks cruise the waters, and ammonites drift in the light.',
    place: 'Western Interior Seaway', theme: 'ozean', cls: 'fish', habitat: 'water',
    from: 82 * M, to: 72 * M, seconds: 600, music: 'ozean', hazardDmg: 4, len: 95, plants: 0.6, cover: 0.45,
    fauna: [
      ['apsopelix', 9], ['gillicus', 2.5], ['ammonit', 3], ['baculites', 2], ['enchodus', 1.2], ['protosphyraena', 0.6], ['squalicorax', 0.6],
      ['qualle', 1], ['archelon', 0.4], ['xiphactinus', 0.4],
    ],
    passers: [['platecarpus', 3], ['elasmosaurus', 2], ['cretoxyrhina', 2], ['xiphactinus', 2], ['tylosaurus', 1]],
  },
  later('palaeogen', 'Paleogene', 'The Age of Mammals', [66, 23],
    'The dinosaurs are gone. Mammals spread across land and sea — the first whales venture into the water, and forests cover the Earth as far as the poles.',
    'Primeval Forests and Coasts', 'eden', 'mammal', 'land'),
  // ---------------------------------------------------------------- verborgen (für später)
  {
    id: 'ordovizium', apex: 'cameroceras', name: 'Ordovician', hidden: true, tagline: 'The First Fishes', period: [485, 443],
    blurb: 'Shallow, warm seas cover the Earth. Giant cephalopods hunt in open water and trilobites plough through the mud — among them swim the first fishes, still without jaws.',
    place: 'Shallow Lagoon', theme: 'ozean', cls: 'fish', habitat: 'water',
    from: 470 * M, to: 458 * M, seconds: 450, music: 'ozean', hazardDmg: 3, len: 80, plants: 0.95, cover: 0.5,
    fauna: [
      ['kieferlos', 8], ['sacabambaspis', 4.5], ['arandaspis', 4.5], ['astraspis', 4.9], ['eriptychius', 2.4], ['trilobit', 3.6], ['isotelus', 1.8],
      ['conodont', 1], ['qualle', 1], ['orthoceras', 0.7], ['megalograptus', 0.2],
    ],
    passers: [['orthoceras', 3], ['megalograptus', 2], ['cameroceras', 0.8]],
  },
  {
    id: 'silur', apex: 'pterygotus', name: 'Silurian', hidden: true, tagline: 'The First Jaws', period: [443, 419],
    blurb: 'Kelp forests sway in the current. The first jawed fishes hunt, while giant sea scorpions lurk on the bottom.',
    place: 'Kelp Forest', theme: 'ozean', cls: 'fish', habitat: 'water', kelp: true,
    from: 438 * M, to: 427 * M, seconds: 500, music: 'ozean', hazardDmg: 3, len: 85, plants: 0.8, cover: 0.95,
    fauna: [
      ['kieferlos', 4], ['birkenia', 10.4], ['cephalaspis', 2.6], ['pteraspis', 4.5], ['thelodus', 8.2], ['jamoytius', 2.5], ['lasanius', 5.9], ['climatius', 1.6],
      ['trilobit', 2], ['dalmanites', 2.4], ['conodont', 0.9], ['entelognathus', 0.7], ['qualle', 1.5], ['orthoceras', 1.1], ['megalograptus', 0.2], ['pterygotus', 0.2],
    ],
    passers: [['entelognathus', 3], ['seeskorpion', 2], ['orthoceras', 1.5], ['megalograptus', 1.5], ['pterygotus', 0.8]],
  },
];

/** Die Zeitalter, die man sieht (Auswahl, Chronik des Lebens, Stammbaum) – in der Reihenfolge der Erdgeschichte, mit ihrer Nummer. */
export const ERAS: { i: number; ep: EpochDef }[] = EPOCHS.map((ep, i) => ({ i, ep })).filter((e) => !e.ep.hidden);

/** Kann man in diesem Zeitalter (Nummer) leben? */
export const isPlayable = (i: number) => !!EPOCHS[i]?.playable;

/** Das erste Zeitalter, in dem man leben kann (Ersatz für ältere Spielstände und den allerersten Start). */
export const firstPlayable = () => Math.max(0, EPOCHS.findIndex((e) => e.playable));

/** „im Devon“, „in der Trias“, „in der Kreidezeit“ */
export const inEra = (ep: EpochDef) => `in the ${ep.name}`;
/** „des Devons“, „der Trias“, „der Kreidezeit“ */
export const ofEra = (ep: EpochDef) => `of the ${ep.name}`;

export const epochIndex = (id: string) => EPOCHS.findIndex((e) => e.id === id);

// ---------------------------------------------------------------- Zeitangaben

const number = (n: number) => Math.round(n).toLocaleString('en-GB');

/**
 * "vor 452.320.000 Jahren": Die Uhr zählt in Zehnerpotenzen – so fein, wie die Zeit
 * gerade vergeht (step = Jahre, die ungefähr pro Anzeige-Takt verstreichen).
 */
export function yearsAgo(years: number, step: number) {
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, step)))));
  const v = Math.round(years / p) * p;
  return v <= 0 ? 'today' : `${number(v)} years ago`;
}

/** Kurz: "470 Mio. J.", "400.000 J." */
export function shortYears(years: number) {
  if (years >= 1e6) {
    const m = years / 1e6;
    return `${m >= 10 ? number(m) : m.toLocaleString('en-GB', { maximumFractionDigits: 1 })} million yr`;
  }
  return `${number(years)} yr`;
}

/** Dauer in Worten: "11 Millionen Jahre", "388.000 Jahre" */
export function spanWords(years: number) {
  if (years >= 1e6) {
    const m = years / 1e6;
    const s = m >= 10 ? number(m) : m.toLocaleString('en-GB', { maximumFractionDigits: 1 });
    return `${s} million years`;
  }
  return `${number(years)} years`;
}

/** Alle Arten der regulären Tierwelt, ohne doppelte Einträge. */
export function epochSpecies(ep: EpochDef): string[] {
  return [...new Set([...ep.fauna.map(([id]) => id), ...ep.passers.map(([id]) => id), ...(ep.apex ? [ep.apex] : [])])];
}
