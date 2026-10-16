import type { ClassId } from './classes';

// ---------------------------------------------------------------------------
// Die Zeitalter. Jedes ist ein fester Zeitraum der Erdgeschichte: Eine Uhr läuft
// von "from" bis "to" (Jahre vor heute). Wer bis zum Ende überlebt, dessen Linie
// lebt im nächsten Zeitalter weiter. Es gibt kein Ziel und keinen Endgegner –
// nur Überleben, egal wie.
// ---------------------------------------------------------------------------

export type Theme = 'ozean' | 'sumpf' | 'reptil' | 'eis' | 'eden';

export type EventKind = 'predator' | 'bloom' | 'storm' | 'quake' | 'meteor' | 'boss';

export interface EventDef {
  /** Zeitpunkt im Zeitalter: 0 = Beginn, 1 = Ende */
  at: number;
  kind: EventKind;
  /** Räuber, die durchziehen */
  species?: string;
  count?: number;
  /** Dauer (Wetter, Beben, Meteoriten) in Sekunden */
  dur?: number;
  /** kurze Erzählzeile */
  line?: string;
  /** zieht nur schnell vorbei (verstecken!) */
  fast?: boolean;
}

export interface EpochDef {
  id: string;
  /** erdgeschichtlicher Name */
  name: string;
  /** Lebensraum */
  place: string;
  desc: string;
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
  /** Höhlen zum Verstecken (nur im Wasser) */
  caves?: number;
  /** Tiere: Art und Anzahl der Gruppen */
  fauna: [string, number][];
  events: EventDef[];
}

/**
 * Ein Gebiet im Lebensraum. Jedes Zeitalter hat links und rechts vom Startgebiet noch ein eigenes:
 * links flacher, trüber, reich an Pflanzen und ruhiger – rechts tiefer, dunkler und voller Jäger.
 * Wo man seine Zeit verbringt, entscheidet man selbst.
 */
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

/** Linkes und rechtes Gebiet je Lebensraum. */
export const SIDE_ZONES: Record<Theme, [ZoneDef, ZoneDef]> = {
  ozean: [zone('Trübe Bucht', 0x2e3a1c, 0.34, 1.9, 0.55, 1.6, 1.4, 1.3, 0.45, 1), zone('Tiefe Kante', 0x061424, 0.4, 0.6, 0.65, 0.5, 0.6, 0.9, 1.8, 2)],
  sumpf: [zone('Moorwasser', 0x22301a, 0.28, 1.8, 0.7, 1.5, 1.4, 1.2, 0.5, 1), zone('Altwald', 0x0c140c, 0.36, 0.8, 0.6, 0.7, 1.1, 0.9, 1.7, 2)],
  reptil: [zone('Farnebene', 0x3a3a18, 0.16, 1.4, 1.1, 1.6, 1.3, 1.3, 0.5, 1), zone('Glutfelder', 0x3a0c04, 0.3, 0.9, 0.8, 0.5, 0.6, 0.8, 1.8, 2)],
  eis: [zone('Windstille Senke', 0x2a3440, 0.14, 1.5, 1, 1.5, 1.3, 1.3, 0.55, 1), zone('Gletscherrand', 0x0c1a2c, 0.32, 0.8, 0.7, 0.5, 0.7, 0.8, 1.8, 2)],
  eden: [zone('Blumenwiese', 0x3a3418, 0.12, 1.2, 1.15, 1.6, 1.2, 1.4, 0.45, 1), zone('Dunkler Forst', 0x0a1208, 0.36, 1, 0.6, 0.8, 1.3, 0.9, 1.8, 2)],
};

/** Das Startgebiet: so, wie das Zeitalter beschrieben ist. */
export const centerZone = (ep: EpochDef): ZoneDef => zone(ep.place, 0, 0, 1, 1, 1, 1, 1, 1, 0);

const M = 1e6;

export const EPOCHS: EpochDef[] = [
  {
    id: 'ordovizium', name: 'Ordovizium', place: 'Seichte Lagune', theme: 'ozean', cls: 'fish', habitat: 'water',
    desc: 'Lauwarmes, trübes Wasser. Das Leben beginnt sich zu regen.',
    from: 470 * M, to: 458 * M, seconds: 100, music: 'ozean', hazardDmg: 3, len: 80, plants: 0.95, cover: 0.5, caves: 2,
    fauna: [['kieferlos', 3], ['sacabambaspis', 2], ['trilobit', 3], ['qualle', 1], ['orthoceras', 1], ['megalograptus', 0.6]],
    events: [
      { at: 0.08, kind: 'predator', species: 'cameroceras', fast: true, line: 'Ein Schatten! Versteck dich – schnell!' },
      { at: 0.42, kind: 'predator', species: 'cameroceras', line: 'Ein gewaltiger Schatten gleitet durch das Wasser …' },
      { at: 0.72, kind: 'bloom', line: 'Das Wasser wird grün. Überall sprießt Futter.' },
    ],
  },
  {
    id: 'silur', name: 'Silur', place: 'Kelpwald', theme: 'ozean', cls: 'fish', habitat: 'water', kelp: true,
    desc: 'Ein Wald aus Riesentang. Was sich darin verbirgt, sieht man kaum.',
    from: 438 * M, to: 427 * M, seconds: 110, music: 'ozean', hazardDmg: 3, len: 85, plants: 0.8, cover: 0.95, caves: 1,
    fauna: [['kieferlos', 2], ['birkenia', 2], ['cephalaspis', 1], ['trilobit', 2], ['qualle', 2], ['orthoceras', 2], ['megalograptus', 0.5], ['pterygotus', 0.4]],
    events: [
      { at: 0.07, kind: 'predator', species: 'pterygotus', fast: true, line: 'Pterygotus – ein Seeskorpion, groß wie ein Mensch. Versteck dich!' },
      { at: 0.35, kind: 'predator', species: 'seeskorpion', count: 3, line: 'Seeskorpione jagen im Rudel durch den Tang.' },
      { at: 0.68, kind: 'storm', dur: 18, line: 'Ein Sturm wühlt den Grund auf. Das Wasser wird trüb.' },
    ],
  },
  {
    id: 'devon', name: 'Devon', place: 'Panzerfischriff', theme: 'ozean', cls: 'fish', habitat: 'water', reef: true,
    desc: 'Das Zeitalter der Fische. Ein Riff voller Leben – und voller Jäger.',
    from: 382 * M, to: 372 * M, seconds: 120, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.75, cover: 0.55, caves: 2,
    fauna: [['kieferlos', 2], ['bothriolepis', 2], ['cephalaspis', 1], ['trilobit', 2], ['orthoceras', 2], ['seeskorpion', 1], ['cladoselache', 1], ['hyneria', 0.5]],
    events: [
      { at: 0.06, kind: 'predator', species: 'dunkleosteus', fast: true, line: 'Dunkleosteus! Erstarre im Tang – oder flieh!' },
      { at: 0.3, kind: 'predator', species: 'dunkleosteus', line: 'Der Panzerfisch zieht durch das Riff.' },
      { at: 0.8, kind: 'boss', species: 'dunkleosteus', line: 'Dunkleosteus beherrscht dieses Meer. Besiege ihn – sonst bleibt deine Linie in seinem Schatten.' },
    ],
  },
  {
    id: 'karbon', name: 'Karbon', place: 'Kohlesumpf', theme: 'sumpf', cls: 'amphibian', habitat: 'land',
    desc: 'Riesige Farne und schwarzes Wasser. Die Luft ist schwer und feucht.',
    from: 318 * M, to: 304 * M, seconds: 120, music: 'sumpf', hazardDmg: 7, len: 90, plants: 0.85, cover: 0.6,
    fauna: [['kleinlurch', 3], ['tausendfuessler', 2], ['libelle', 2], ['skorpion', 1]],
    events: [
      { at: 0.4, kind: 'predator', species: 'meganeura', line: 'Ein tiefes Summen erfüllt die Luft.' },
      { at: 0.66, kind: 'bloom', line: 'Nach dem Regen sprießt es überall.' },
    ],
  },
  {
    id: 'perm', name: 'Perm', place: 'Trockene Senke', theme: 'sumpf', cls: 'amphibian', habitat: 'land',
    desc: 'Die Sümpfe trocknen aus. Wasser und Futter werden knapp.',
    from: 280 * M, to: 262 * M, seconds: 120, music: 'sumpf', hazardDmg: 8, len: 95, plants: 0.45, cover: 0.45,
    fauna: [['kleinlurch', 2], ['tausendfuessler', 2], ['skorpion', 2], ['eryops', 1]],
    events: [
      { at: 0.28, kind: 'storm', dur: 20, line: 'Heiße Winde treiben Staub über das Land.' },
      { at: 0.55, kind: 'predator', species: 'eryops', count: 2, line: 'Zwei Eryops durchstreifen die Senke.' },
      { at: 0.7, kind: 'quake', dur: 8, line: 'Die Erde bebt.' },
      { at: 0.8, kind: 'boss', species: 'dimetrodon', line: 'Ein Segel erhebt sich über der Senke: Dimetrodon. Besiege ihn, um weiterzukommen.' },
    ],
  },
  {
    id: 'trias', name: 'Trias', place: 'Farnsteppe', theme: 'reptil', cls: 'reptile', habitat: 'land',
    desc: 'Nach dem großen Sterben erobern die Echsen das Land.',
    from: 228 * M, to: 214 * M, seconds: 120, music: 'reptil', hazardDmg: 10, len: 95, plants: 0.8, cover: 0.55,
    fauna: [['kleinechse', 3], ['ornithopode', 2], ['raptor', 1]],
    events: [
      { at: 0.35, kind: 'predator', species: 'flugsaurier', count: 3, line: 'Schatten kreisen über der Steppe.' },
      { at: 0.7, kind: 'bloom', line: 'Die Farne treiben frisch aus.' },
    ],
  },
  {
    id: 'jura', name: 'Jura', place: 'Urwald', theme: 'reptil', cls: 'reptile', habitat: 'land',
    desc: 'Dichtes Grün, dumpfe Schritte in der Ferne.',
    from: 158 * M, to: 147 * M, seconds: 125, music: 'reptil', hazardDmg: 10, len: 95, plants: 0.75, cover: 0.9,
    fauna: [['ornithopode', 2], ['kleinechse', 2], ['ankylosaurus', 1], ['raptor', 1]],
    events: [
      { at: 0.4, kind: 'predator', species: 'raptor', count: 3, line: 'Ein Rudel bricht durch das Unterholz.' },
      { at: 0.74, kind: 'storm', dur: 16, line: 'Warmer Regen prasselt herab.' },
    ],
  },
  {
    id: 'kreide', name: 'Kreide', place: 'Vulkanhänge', theme: 'reptil', cls: 'reptile', habitat: 'land',
    desc: 'Die Erde ist heiß. Asche fällt wie Schnee.',
    from: 69 * M, to: 66 * M, seconds: 130, music: 'reptil', hazardDmg: 12, len: 100, plants: 0.5, cover: 0.55,
    fauna: [['ornithopode', 2], ['kleinechse', 2], ['ankylosaurus', 1], ['flugsaurier', 1]],
    events: [
      { at: 0.28, kind: 'quake', dur: 5, line: 'Der Boden zittert in regelmäßigen Abständen.' },
      { at: 0.34, kind: 'predator', species: 'trex' },
      { at: 0.78, kind: 'boss', species: 'trex', line: 'Der Tyrannosaurus ist zurück – er herrscht über dieses Land. Besiege ihn.' },
      { at: 0.9, kind: 'meteor', dur: 22, line: 'Ein zweites Licht steht am Himmel …' },
    ],
  },
  {
    id: 'palaeogen', name: 'Paläogen', place: 'Dämmerwald', theme: 'eden', cls: 'mammal', habitat: 'land',
    desc: 'Die großen Echsen sind fort. Im Dämmerlicht wagen sich neue Tiere hervor.',
    from: 52 * M, to: 42 * M, seconds: 125, music: 'eden', hazardDmg: 14, len: 95, plants: 0.85, cover: 0.7,
    fauna: [['urpferd', 3], ['riesenfaultier', 1], ['hyaenodon', 1]],
    events: [
      { at: 0.45, kind: 'predator', species: 'andrewsarchus', line: 'Etwas Uraltes wandert durch den Wald.' },
    ],
  },
  {
    id: 'neogen', name: 'Neogen', place: 'Grasland', theme: 'eden', cls: 'mammal', habitat: 'land',
    desc: 'Weites, hohes Gras. Wer rennen kann, ist im Vorteil.',
    from: 12 * M, to: 5 * M, seconds: 125, music: 'eden', hazardDmg: 14, len: 100, plants: 0.75, cover: 0.5,
    fauna: [['urpferd', 3], ['terrorvogel', 1], ['hyaenodon', 1], ['riesenfaultier', 1]],
    events: [
      { at: 0.35, kind: 'predator', species: 'terrorvogel', count: 2, line: 'Terrorvögel jagen durch das hohe Gras.' },
      { at: 0.7, kind: 'bloom', line: 'Die Regenzeit bringt frisches Grün.' },
    ],
  },
  {
    id: 'quartaer', name: 'Quartär', place: 'Gefrorene Tundra', theme: 'eis', cls: 'mammal', habitat: 'land',
    desc: 'Die Eiszeit. Wer nicht frisst, erfriert.',
    from: 400e3, to: 12e3, seconds: 140, music: 'eis', hazardDmg: 16, len: 100, plants: 0.5, cover: 0.55,
    fauna: [['schneehase', 3], ['riesenhirsch', 2], ['mammut', 1], ['eiswolf', 1], ['hoehlenbaer', 1]],
    events: [
      { at: 0.22, kind: 'storm', dur: 22, line: 'Ein Schneesturm zieht auf.' },
      { at: 0.48, kind: 'predator', species: 'saebelzahn', line: 'Fußspuren im Schnee. Große Fußspuren.' },
      { at: 0.62, kind: 'predator', species: 'eiswolf', count: 3, line: 'In der Ferne heulen Wölfe.' },
      { at: 0.8, kind: 'boss', species: 'saebelzahn', line: 'Die Säbelzahnkatze ist zurück. Nur wer sie besiegt, findet den Weg nach Eden.' },
    ],
  },
];

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
