import type { ClassId } from './classes';

// ---------------------------------------------------------------------------
// Die Zeitalter. Jedes ist ein fester Zeitraum der Erdgeschichte: Eine Uhr läuft
// von "from" bis "to" (Jahre vor heute). Wer bis zum Ende überlebt, dessen Linie
// lebt im nächsten Zeitalter weiter. Es gibt kein Ziel und keinen Endgegner –
// nur Überleben, egal wie.
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
  /** Tiere: Art und Anzahl der Gruppen */
  fauna: [string, number][];
  events: EventDef[];
}

const M = 1e6;

export const EPOCHS: EpochDef[] = [
  {
    id: 'ordovizium', name: 'Ordovizium', place: 'Seichte Lagune', theme: 'ozean', cls: 'fish', habitat: 'water',
    desc: 'Lauwarmes, trübes Wasser. Das Leben beginnt sich zu regen.',
    from: 470 * M, to: 458 * M, seconds: 200, music: 'ozean', hazardDmg: 3, len: 80, plants: 0.95, cover: 0.5,
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
    from: 438 * M, to: 427 * M, seconds: 220, music: 'ozean', hazardDmg: 3, len: 85, plants: 0.8, cover: 0.95,
    fauna: [['kieferlos', 2], ['birkenia', 2], ['cephalaspis', 1.5], ['cheiracanthus', 0.6], ['trilobit', 2], ['qualle', 2], ['orthoceras', 2], ['megalograptus', 0.5], ['pterygotus', 0.4]],
    events: [
      { at: 0.07, kind: 'predator', species: 'pterygotus', fast: true, line: 'Pterygotus – ein Seeskorpion, groß wie ein Mensch. Versteck dich!' },
      { at: 0.22, kind: 'leviathan' },
      { at: 0.35, kind: 'predator', species: 'seeskorpion', count: 3, line: 'Seeskorpione jagen im Rudel durch den Tang.' },
      { at: 0.68, kind: 'storm', dur: 18, line: 'Ein Sturm wühlt den Grund auf. Das Wasser wird trüb.' },
    ],
  },
  {
    id: 'devon', name: 'Devon', place: 'Panzerfischriff', theme: 'ozean', cls: 'fish', habitat: 'water', reef: true,
    desc: 'Das Zeitalter der Fische. Ein Riff voller Leben – und voller Jäger.',
    from: 382 * M, to: 372 * M, seconds: 240, music: 'ozean', hazardDmg: 4, len: 90, plants: 0.75, cover: 0.55,
    fauna: [['kieferlos', 1.5], ['cheiracanthus', 1], ['bothriolepis', 1], ['cephalaspis', 1], ['trilobit', 2], ['orthoceras', 1.5], ['seeskorpion', 1], ['cladoselache', 1.2], ['rolfosteus', 0.9], ['eusthenopteron', 0.8], ['hyneria', 0.4]],
    events: [
      { at: 0.06, kind: 'predator', species: 'dunkleosteus', fast: true, line: 'Dunkleosteus! Erstarre im Tang – oder flieh!' },
      { at: 0.3, kind: 'predator', species: 'dunkleosteus', line: 'Der Panzerfisch zieht durch das Riff.' },
      { at: 0.8, kind: 'boss', species: 'dunkleosteus', line: 'Dunkleosteus beherrscht dieses Meer. Besiege ihn – sonst bleibt deine Linie in seinem Schatten.' },
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
