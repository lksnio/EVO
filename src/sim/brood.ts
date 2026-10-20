import { BROOD, CLIMB, KTRAIN, OXYGEN } from '../data/karbon';

// ---------------------------------------------------------------------------
// Die Brut im Karbon als reine Rechnung (ohne Phaser): das Gelege, die Jugend bis zur Metamorphose, die Gefahr danach,
// die Eier als Leben, die Vererbung aus dem Verhalten einer Generation – dazu Sauerstoff und Klettern. Die Zahlen stehen
// in data/karbon.ts.
// ---------------------------------------------------------------------------

/** Die Merkmale, die sich im Karbon durch das Verhalten entwickeln (0 … 1). */
export type Gene = 'jaw' | 'limb' | 'grip' | 'armor';
export const GENES: Gene[] = ['jaw', 'limb', 'grip', 'armor'];
export type Genes = Record<Gene, number>;
export const noGenes = (): Genes => ({ jaw: 0, limb: 0, grip: 0, armor: 0 });

/** Was eine Generation getan hat (alle ihre Tiere zusammen). */
export interface Train {
  /** erlegte kleine Beute */
  prey: number;
  /** Strecke an Land und im flachen Sumpf (Bildpunkte) */
  land: number;
  /** an steilen Hängen erklommene Höhe (Bildpunkte) */
  climb: number;
  /** überstandener Schaden (in vollen Lebenskräften) */
  hurt: number;
}
export const newTrain = (): Train => ({ prey: 0, land: 0, climb: 0, hurt: 0 });

/** Was ein Training (Train) an welchem Merkmal fördert. */
const TRAIN_OF: Record<Gene, keyof Train> = { jaw: 'prey', limb: 'land', grip: 'climb', armor: 'hurt' };

export type BroodPhase = 'young' | 'grown';

export interface Brood {
  /** Generation: 0 ist das Start-Gelege (lauter Grundwerte) */
  gen: number;
  /** so viele Eier liegen noch im Nest */
  eggs: number;
  /** so viele waren es beim Legen */
  laid: number;
  /** Jugend (bis zur Metamorphose) oder Gefahr (danach) */
  phase: BroodPhase;
  /** Nahrung des Jungtiers (zählt nur in der Jugend) */
  food: number;
  /** Sekunden bis zum neuen Gelege (nur in der Gefahr) */
  left: number;
  /** das Erbgut dieser Generation: so sind ihre Eier im Mittel */
  genes: Genes;
  /** was diese Generation getan hat */
  train: Train;
  /** wo das Nest liegt */
  nest: { place: string; x: number; y: number };
  /** so viele Eier haben Räuber gefressen bzw. sind geschlüpft (für die Bilanz) */
  lost: number;
  hatched: number;
  /** Saat für die Eier, die zur Wahl stehen (neu nach jedem Schlüpfen) */
  seed: number;
}

/** Ein Ei, das zur Wahl steht: sein Erbgut (das der Generation, leicht verschieden). */
export interface Egg {
  genes: Genes;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ein neues Gelege: Generation gen mit diesem Erbgut, im Nest. */
export function newBrood(gen: number, genes: Genes, nest: Brood['nest'], seed = 1): Brood {
  return { gen, eggs: BROOD.eggs, laid: BROOD.eggs, phase: 'young', food: 0, left: 0, genes: { ...genes }, train: newTrain(), nest: { ...nest }, lost: 0, hatched: 0, seed };
}

/** Wie groß das Jungtier ist (Anteil des ausgewachsenen Tiers): beim Schlüpfen klein, mit der Nahrung größer – nach der Metamorphose ganz. */
export function growOf(b: Pick<Brood, 'phase' | 'food'>) {
  if (b.phase === 'grown') return 1;
  return BROOD.growHatch + (BROOD.growMeta - BROOD.growHatch) * clamp01(b.food / BROOD.food);
}

/**
 * Fressen. In der Jugend ist es Nahrung (gibt true zurück, sobald genug für die Metamorphose da ist); danach heilt es –
 * zurück kommt dann, wie viel (Anteil der Lebenskraft).
 */
export function feed(b: Brood, units: number): { meta: boolean; heal: number } {
  if (units <= 0) return { meta: false, heal: 0 };
  if (b.phase === 'grown') return { meta: false, heal: units * BROOD.heal };
  b.food += units;
  return { meta: b.food >= BROOD.food, heal: 0 };
}

/** Die Metamorphose: Aus dem Jungtier wird ein Vierfüßer – ab jetzt läuft die Zeit bis zum neuen Gelege, und es wird gefährlich. */
export function metamorph(b: Brood) {
  if (b.phase === 'grown') return;
  b.phase = 'grown';
  b.left = BROOD.danger;
}

/**
 * Die Zeit vergeht (Sekunden, nur in der Gefahr): Gibt zurück, ob das neue Gelege da ist. away: Man ist fern vom Nest – dann
 * fressen die Räuber ungestört (alle BROOD.awayEvery Sekunden ein Ei); awayT ist der angesammelte Rest dafür.
 */
export function tick(b: Brood, dt: number, away = false, awayT = { t: 0 }): boolean {
  if (b.phase !== 'grown') return false;
  b.left = Math.max(0, b.left - dt);
  if (away && b.eggs > 0) {
    awayT.t += dt;
    while (awayT.t >= BROOD.awayEvery && b.eggs > 0) {
      awayT.t -= BROOD.awayEvery;
      eatEggs(b, 1);
    }
  }
  return b.left <= 0;
}

/** Räuber fressen Eier aus dem Nest: Gibt zurück, wie viele es wirklich waren. */
export function eatEggs(b: Brood, n: number) {
  const k = Math.max(0, Math.min(b.eggs, Math.round(n)));
  b.eggs -= k;
  b.lost += k;
  return k;
}

/** Eine kleine, feste Zufallsfolge (dieselbe Saat gibt dieselben Eier). */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Die Eier, die zur Wahl stehen (höchstens BROOD.choice, nie mehr als im Nest liegen): das Erbgut der Generation, jedes ein
 * wenig anders (± BROOD.spread). Die Start-Eier (Generation 0) sind alle gleich – lauter Grundwerte.
 */
export function offer(b: Brood, n = BROOD.choice): Egg[] {
  const k = Math.max(0, Math.min(n, b.eggs));
  const r = rng(b.seed * 7919 + b.hatched * 104729 + b.gen);
  const out: Egg[] = [];
  for (let i = 0; i < k; i++) {
    const g = { ...b.genes };
    if (b.gen > 0) for (const key of GENES) g[key] = clamp01(g[key] + (r() * 2 - 1) * BROOD.spread);
    out.push({ genes: g });
  }
  return out;
}

/** Ein Ei schlüpft: Es fehlt im Nest, und das neue Jungtier beginnt die Jugend (bzw. – in der Gefahr – gleich als Vierfüßer). */
export function hatch(b: Brood, egg: Egg): Genes {
  if (b.eggs > 0) b.eggs -= 1;
  b.hatched += 1;
  b.food = BROOD.carry;
  b.seed = (b.seed * 48271 + 11) % 2147483647 || 1;
  return { ...egg.genes };
}

/**
 * Die nächste Generation: Was diese Generation getan hat, verändert ihr Erbgut – jede Richtung höchstens um ihren Schritt,
 * und zwar umso mehr, je mehr trainiert wurde (ref: knapp zwei Drittel des Schritts).
 */
export function inheritGenes(genes: Genes, train: Train): Genes {
  const out = { ...genes };
  for (const g of GENES) {
    const amount = Math.max(0, train[TRAIN_OF[g]]);
    const gain = KTRAIN.step[g] * (1 - Math.exp(-amount / KTRAIN.ref[TRAIN_OF[g]]));
    out[g] = clamp01(genes[g] + gain);
  }
  return out;
}

/** Das neue Gelege, wenn eine Generation die Gefahr überstanden hat: wieder voll, mit dem vererbten Erbgut. */
export function nextBrood(b: Brood): Brood {
  return newBrood(b.gen + 1, inheritGenes(b.genes, b.train), b.nest, (b.seed * 16807) % 2147483647 || 1);
}

// ---------------------------------------------------------------- Klettern und Sauerstoff

/** Wie steil (Grad) ein Hang mit diesen Beinen und diesem Griff höchstens sein darf. */
export function maxSlope(limb: number, grip: number) {
  return CLIMB.base + CLIMB.limb * clamp01(limb) + CLIMB.grip * clamp01(grip);
}

/**
 * Was Klettern kostet (Ausdauer-Kreise je Sekunde) an einem Hang dieser Steilheit (Grad): nichts bis CLIMB.steep, am
 * steilsten noch möglichen Hang CLIMB.cost – ein Schuppenpanzer macht es teurer.
 */
export function climbCost(slope: number, max: number, armor: number) {
  if (slope <= CLIMB.steep) return 0;
  const k = Math.min(1, (slope - CLIMB.steep) / Math.max(1, max - CLIMB.steep));
  return CLIMB.cost * k * (1 + CLIMB.armor * clamp01(armor));
}

/** So viele Sekunden reicht der Sauerstoff an Land (ups: Segen der großen Muschel; young: noch ein Jungtier mit Kiemen). */
export function oxygenSeconds(ups: number, young: boolean) {
  return OXYGEN.seconds * (1 + OXYGEN.perUp * Math.max(0, ups)) * (young ? OXYGEN.young : 1);
}

/**
 * Sauerstoff (Anteil 0 … 1) nach dt Sekunden: an Land sinkt er, im Wasser füllt er sich. Zurück kommen der neue Stand und
 * der Schaden durch Austrocknung (Anteil der Lebenskraft), wenn er leer ist.
 */
export function breathe(o: number, dt: number, onLand: boolean, seconds: number): { o: number; dry: number } {
  if (!onLand) return { o: Math.min(1, o + OXYGEN.refill * dt), dry: 0 };
  const next = o - dt / Math.max(1, seconds);
  return next > 0 ? { o: next, dry: 0 } : { o: 0, dry: OXYGEN.dry * dt };
}
