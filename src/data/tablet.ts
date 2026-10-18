import { CLASSES, type ClassId } from './classes';
import { game, hungerRate, kcalOf, maxSatiety, skillName, type Traits } from '../state/GameState';

// ---------------------------------------------------------------------------
// Die Steintafel. Anfangs ist sie ganz von Moos bedeckt. Jede gefundene Muschel legt eine weitere
// Zeile frei – immer in dieser Reihenfolge. Was "gelernt" ist, zeigt sich in bis zu drei Fischen:
// einer für ein bisschen, zwei für mehr, drei für stark. Dieselben Zeilen stehen auf den Evolutionsplatten
// zwischen den Zeitaltern – dort mit einem Pfeil, wohin sich der Wert verändern würde.
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
  /** Vergleichswert für die Evolutionsplatten (mehr bzw. weniger als jetzt) */
  num?: (c: StatCtx) => number;
  /** 1: mehr ist besser, -1: weniger ist besser, sonst weder noch */
  better?: 1 | -1;
}

/** Ein bisschen = 1, mehr = 2, stark = 3 Fische. */
export function fishRating(v: number, at: [number, number, number] = [0.04, 0.22, 0.5]) {
  return v >= at[2] ? 3 : v >= at[1] ? 2 : v >= at[0] ? 1 : 0;
}

const skill = (id: string, label: (c: StatCtx) => string, get: (t: Traits) => number, at?: [number, number, number], num?: StatDef['num']): StatDef => ({
  id,
  label,
  value: (c) => ({ t: 'fish', n: fishRating(get(c.traits), at) }),
  num: num ?? ((c) => get(c.traits)),
  better: 1,
});

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const stats = (c: StatCtx) => game.stats(c.cls, c.traits);
const needPerMin = (c: StatCtx) => {
  const st = stats(c);
  return kcalOf(hungerRate(st.size, 0.55, st.upkeep) * 60, c.cls, st.size);
};
/** Tempo (mit der Kraft der Schwanzflosse) im Verhältnis zum Grundtempo der Körperform */
const pace = (c: StatCtx) => {
  const st = stats(c);
  return (st.speed * st.cruise) / CLASSES[c.cls].base.speed;
};

/** Reihenfolge = Reihenfolge, in der die Muscheln die Tafel freilegen. */
export const STATS: StatDef[] = [
  {
    id: 'need',
    label: () => 'Nahrungsbedarf',
    value: (c) => {
      const perMin = needPerMin(c);
      const f = c.sat === undefined ? undefined : c.sat / maxSatiety(stats(c).size);
      return { t: 'bar', f, v: `${nf(perMin)} kcal/Min`, low: f !== undefined && f < 0.25 };
    },
    num: needPerMin,
    better: -1,
  },
  {
    id: 'weight',
    label: () => 'Gewicht',
    value: (c) => {
      const g = game.measure(c.cls, c.traits).g;
      return { t: 'text', v: g >= 1000 ? `${nf(g / 1000, 1)} kg` : `${nf(g)} g` };
    },
    num: (c) => game.measure(c.cls, c.traits).g,
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
  // Gebiss: die Fische zeigen den Kiefer, der Pfeil die Beißkraft
  skill('jaw', () => 'Gebiss', (t) => t.jaw, undefined, (c) => stats(c).bite),
  {
    id: 'length',
    label: () => 'Länge',
    value: (c) => {
      const cm = game.measure(c.cls, c.traits).cm;
      return { t: 'text', v: cm >= 100 ? `${nf(cm / 100, 2)} m` : `${nf(cm)} cm` };
    },
    num: (c) => game.measure(c.cls, c.traits).cm,
  },
  {
    id: 'hp',
    label: () => 'Lebenskraft',
    value: (c) => {
      const max = stats(c).maxHp;
      return { t: 'text', v: c.hp === undefined ? `${max}` : `${Math.max(0, Math.round(c.hp))} / ${max}` };
    },
    num: (c) => stats(c).maxHp,
    better: 1,
  },
  // Schädel bzw. Kopfplatte: die Fische zeigen den Kopf, der Pfeil die Stoßkraft
  skill('skull', (c) => skillName('skull', c.traits), (t) => t.skull, undefined, (c) => stats(c).ram),
  // Robustheit: Schuppen bzw. Schuppenpanzer aus überstandenen Angriffen
  skill('armor', (c) => ((c.traits.armor ?? 0) >= 0.3 ? 'Schuppenpanzer' : 'Schuppen'), (t) => t.armor ?? 0, [0.06, 0.25, 0.5]),
  {
    id: 'diet',
    label: () => 'Kost',
    // dazu, wie viel die andere Kost noch nährt: Wer fast nur Fleisch frisst, holt aus Pflanzen wenig heraus (und umgekehrt)
    value: (c) => {
      const st = stats(c);
      const kind = c.traits.diet < -0.3 ? 'Pflanzen' : c.traits.diet > 0.3 ? 'Fleisch' : 'Alles';
      const [other, dig] = st.digestPlant < st.digestMeat ? ['Pflanzen', st.digestPlant] : ['Fleisch', st.digestMeat];
      return { t: 'text', v: dig < 0.95 ? `${kind} · ${other} ${Math.round(dig * 100)} %` : kind };
    },
    num: (c) => stats(c).digestPlant,
  },
  skill('stealth', () => 'Tarnung', (t) => t.stealth),
  {
    id: 'growth',
    label: () => 'Wuchs',
    value: (c) => ({ t: 'fish', n: fishRating(c.traits.growth) }),
    num: (c) => stats(c).size,
  },
  {
    id: 'swift',
    label: () => 'Tempo',
    value: (c) => ({ t: 'fish', n: fishRating(pace(c) - 0.95, [0.04, 0.18, 0.34]) }),
    num: pace,
    better: 1,
  },
  {
    id: 'agility',
    label: () => 'Wendigkeit',
    value: (c) => ({ t: 'fish', n: fishRating(stats(c).agility - 1, [0.08, 0.3, 0.55]) }),
    num: (c) => stats(c).agility,
    better: 1,
  },
  {
    id: 'stamina',
    label: () => 'Ausdauer',
    // schwere Waffen ermüden: wer kräftig zubeißt, hält nicht lange durch
    value: (c) => ({ t: 'fish', n: fishRating(stats(c).endurance - 0.7, [0.12, 0.45, 0.85]) }),
    num: (c) => stats(c).endurance,
    better: 1,
  },
  skill('limb', () => 'Bodenkontakt', (t) => t.limb ?? 0),
  skill('pack', () => 'Zusammenhalt', (t) => t.pack ?? 0),
  skill('nerve', () => 'Nerven', (t) => t.nerve ?? 0),
];

export const STAT_COUNT = STATS.length;
