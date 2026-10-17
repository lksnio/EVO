import { game, hungerRate, kcalOf, maxSatiety, skillName, type Traits } from '../state/GameState';
import type { ClassId } from './classes';

// ---------------------------------------------------------------------------
// Die Steintafel. Anfangs ist sie ganz von Moos bedeckt. Jede gefundene Muschel legt eine weitere
// Zeile frei – immer in dieser Reihenfolge. Was "gelernt" ist, zeigt sich in bis zu drei Fischen:
// einer für ein bisschen, zwei für mehr, drei für stark.
// ---------------------------------------------------------------------------

export type StatVal =
  | { t: 'text'; v: string }
  | { t: 'fish'; n: number }
  /** Balken (f = Füllstand 0..1, falls bekannt) mit Beschriftung */
  | { t: 'bar'; f?: number; v: string; low?: boolean };

/** Woraus die Werte berechnet werden: ein Tier (live oder als Nachwuchs). */
export interface StatCtx {
  cls: ClassId;
  traits: Traits;
  /** aktuelle Lebenskraft und Sättigung (nur beim eigenen, lebenden Tier) */
  hp?: number;
  sat?: number;
}

export interface StatDef {
  id: string;
  label: (c: StatCtx) => string;
  value: (c: StatCtx) => StatVal;
}

/** Ein bisschen = 1, mehr = 2, stark = 3 Fische. */
export function fishRating(v: number, at: [number, number, number] = [0.04, 0.22, 0.5]) {
  return v >= at[2] ? 3 : v >= at[1] ? 2 : v >= at[0] ? 1 : 0;
}

const skill = (id: string, label: (c: StatCtx) => string, get: (t: Traits) => number, at?: [number, number, number]): StatDef => ({
  id,
  label,
  value: (c) => ({ t: 'fish', n: fishRating(get(c.traits), at) }),
});

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Reihenfolge = Reihenfolge, in der die Muscheln die Tafel freilegen. */
export const STATS: StatDef[] = [
  {
    id: 'need',
    label: () => 'Nahrungsbedarf',
    value: (c) => {
      const size = game.stats(c.cls, c.traits).size;
      const perMin = kcalOf(hungerRate(size, 0.55) * 60, c.cls, size);
      const f = c.sat === undefined ? undefined : c.sat / maxSatiety(size);
      return { t: 'bar', f, v: `${nf(perMin)} kcal/Min`, low: f !== undefined && f < 0.25 };
    },
  },
  {
    id: 'weight',
    label: () => 'Gewicht',
    value: (c) => {
      const g = game.measure(c.cls, c.traits).g;
      return { t: 'text', v: g >= 1000 ? `${nf(g / 1000, 1)} kg` : `${nf(g)} g` };
    },
  },
  {
    id: 'temp',
    label: () => 'Körpertemperatur',
    // Fische sind so warm wie ihr Wasser: helle leben oben im warmen, dunkle unten im kalten
    value: (c) => ({ t: 'text', v: `${Math.round(15 + 7 * (c.traits.light ?? 0))} °C` }),
  },
  {
    id: 'coat',
    label: () => 'Färbung',
    // die Farbe kommt aus den Höhlen: durchschwimmen färbt um
    value: (c) => ({ t: 'text', v: c.traits.coat === 1 ? 'Grün' : c.traits.coat === 2 ? 'Schwarz' : 'Natürlich' }),
  },
  skill('jaw', () => 'Gebiss', (t) => t.jaw),
  {
    id: 'length',
    label: () => 'Länge',
    value: (c) => {
      const cm = game.measure(c.cls, c.traits).cm;
      return { t: 'text', v: cm >= 100 ? `${nf(cm / 100, 2)} m` : `${nf(cm)} cm` };
    },
  },
  {
    id: 'hp',
    label: () => 'Lebenskraft',
    value: (c) => {
      const max = game.stats(c.cls, c.traits).maxHp;
      return { t: 'text', v: c.hp === undefined ? `${max}` : `${Math.max(0, Math.round(c.hp))} / ${max}` };
    },
  },
  skill('skull', (c) => skillName('skull', c.traits), (t) => t.skull),
  {
    id: 'diet',
    label: () => 'Kost',
    value: (c) => ({ t: 'text', v: c.traits.diet < -0.3 ? 'Pflanzen' : c.traits.diet > 0.3 ? 'Fleisch' : 'Alles' }),
  },
  skill('stealth', () => 'Tarnung', (t) => t.stealth),
  skill('growth', () => 'Wuchs', (t) => t.growth),
  skill('swift', () => 'Flinkheit', (t) => Math.max(0, t.swift ?? 0), [0.1, 0.4, 0.7]),
  {
    id: 'stamina',
    label: () => 'Ausdauer',
    // schwere Waffen ermüden: wer kräftig zubeißt, hält nicht lange durch
    value: (c) => ({ t: 'fish', n: fishRating(game.stats(c.cls, c.traits).endurance - 0.7, [0.12, 0.45, 0.85]) }),
  },
  skill('limb', () => 'Bodenkontakt', (t) => t.limb ?? 0),
  skill('pack', () => 'Zusammenhalt', (t) => t.pack ?? 0),
  skill('nerve', () => 'Nerven', (t) => t.nerve ?? 0),
];

export const STAT_COUNT = STATS.length;
