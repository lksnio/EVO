import { describe, expect, it } from 'vitest';
import { BROOD, CLIMB, KTRAIN, OXYGEN } from '../src/data/karbon';
import {
  breathe, climbCost, eatEggs, feed, growOf, hatch, inheritGenes, maxSlope, metamorph, newBrood, newTrain, nextBrood, noGenes, offer,
  oxygenSeconds, tick,
} from '../src/sim/brood';

// Die Brut im Karbon: ein Gelege mit 100 Eiern, die Jugend bis zur Metamorphose, die Gefahr danach, die Eier als Leben und
// die Vererbung aus dem Verhalten einer Generation.

const nest = { place: 'brut', x: 400, y: 600 };

describe('Gelege und Jugend', () => {
  it('ein neues Gelege hat 100 Eier, und man beginnt als kleines Jungtier', () => {
    const b = newBrood(0, noGenes(), nest);
    expect(b.eggs).toBe(BROOD.eggs);
    expect(b.eggs).toBe(100);
    expect(b.phase).toBe('young');
    expect(growOf(b)).toBeCloseTo(BROOD.growHatch);
  });

  it('Fressen ist in der Jugend Nahrung – mit genug davon kommt die Metamorphose, danach heilt es', () => {
    const b = newBrood(0, noGenes(), nest);
    expect(feed(b, BROOD.food - 1)).toEqual({ meta: false, heal: 0 });
    expect(growOf(b)).toBeGreaterThan(BROOD.growHatch);
    expect(growOf(b)).toBeLessThan(BROOD.growMeta);
    expect(feed(b, 1).meta).toBe(true);
    metamorph(b);
    expect(b.phase).toBe('grown');
    expect(growOf(b)).toBe(1);
    expect(b.left).toBe(BROOD.danger);
    const r = feed(b, 4);
    expect(r.meta).toBe(false);
    expect(r.heal).toBeCloseTo(4 * BROOD.heal);
  });

  it('die Zeit läuft erst nach der Metamorphose – wer sie übersteht, bekommt ein neues Gelege', () => {
    const b = newBrood(0, noGenes(), nest);
    expect(tick(b, 1000)).toBe(false);
    metamorph(b);
    expect(tick(b, BROOD.danger - 1)).toBe(false);
    expect(tick(b, 2)).toBe(true);
  });

  it('fern vom Nest fressen die Räuber ungestört Eier – am Nest nicht', () => {
    const b = newBrood(0, noGenes(), nest);
    metamorph(b);
    tick(b, 40, false);
    expect(b.eggs).toBe(100);
    const acc = { t: 0 };
    tick(b, BROOD.awayEvery * 10, true, acc);
    expect(b.eggs).toBe(90);
    expect(b.lost).toBe(10);
    expect(eatEggs(b, 200)).toBe(90);
    expect(b.eggs).toBe(0);
  });
});

describe('Eier als Leben', () => {
  it('die Start-Eier sind alle gleich (Grundwerte), später unterscheiden sie sich ein wenig', () => {
    const b0 = newBrood(0, noGenes(), nest);
    const e0 = offer(b0);
    expect(e0).toHaveLength(BROOD.choice);
    for (const e of e0) expect(e.genes).toEqual(noGenes());
    const b1 = newBrood(1, { jaw: 0.2, limb: 0.3, grip: 0.1, armor: 0.05 }, nest, 42);
    const e1 = offer(b1);
    const differ = e1.some((e) => e.genes.limb !== 0.3 || e.genes.jaw !== 0.2);
    expect(differ).toBe(true);
    for (const e of e1) {
      expect(Math.abs(e.genes.limb - 0.3)).toBeLessThanOrEqual(BROOD.spread + 1e-9);
      expect(e.genes.armor).toBeGreaterThanOrEqual(0);
    }
    // dieselbe Lage gibt dieselben Eier (die Wahl ändert sich nicht durch bloßes Hinsehen)
    expect(offer(b1)).toEqual(e1);
  });

  it('ein Ei schlüpft: eines weniger im Nest, eine neue Auswahl, das Jungtier beginnt von vorn', () => {
    const b = newBrood(2, { jaw: 0.3, limb: 0.3, grip: 0.3, armor: 0.3 }, nest, 7);
    feed(b, 10);
    const before = offer(b);
    const g = hatch(b, before[1]);
    expect(g).toEqual(before[1].genes);
    expect(b.eggs).toBe(99);
    expect(b.food).toBe(0);
    expect(offer(b)).not.toEqual(before);
  });

  it('keine Eier mehr: es steht keines zur Wahl', () => {
    const b = newBrood(0, noGenes(), nest);
    eatEggs(b, 99);
    expect(offer(b)).toHaveLength(1);
    eatEggs(b, 1);
    expect(offer(b)).toHaveLength(0);
  });
});

describe('Evolution durch Verhalten', () => {
  it('ohne Training bleibt das Erbgut, mit Training wächst jede Richtung höchstens um ihren Schritt', () => {
    const g = { jaw: 0.1, limb: 0.2, grip: 0.3, armor: 0.4 };
    expect(inheritGenes(g, newTrain())).toEqual(g);
    const lots = inheritGenes(g, { prey: 1e6, land: 1e9, climb: 1e9, hurt: 1e6 });
    expect(lots.jaw).toBeCloseTo(0.1 + KTRAIN.step.jaw);
    expect(lots.limb).toBeCloseTo(0.2 + KTRAIN.step.limb);
    expect(lots.grip).toBeCloseTo(0.3 + KTRAIN.step.grip);
    expect(lots.armor).toBeCloseTo(0.4 + KTRAIN.step.armor);
    // wer nur läuft, bekommt nur kräftigere Beine
    const walker = inheritGenes(g, { ...newTrain(), land: KTRAIN.ref.land });
    expect(walker.limb).toBeCloseTo(0.2 + KTRAIN.step.limb * (1 - Math.exp(-1)));
    expect(walker.jaw).toBe(0.1);
    expect(walker.armor).toBe(0.4);
  });

  it('das neue Gelege trägt das vererbte Erbgut – wieder 100 Eier, die Zeit beginnt von vorn', () => {
    const b = newBrood(0, noGenes(), nest, 3);
    metamorph(b);
    b.train.land = 1e9;
    eatEggs(b, 70);
    const n = nextBrood(b);
    expect(n.gen).toBe(1);
    expect(n.eggs).toBe(100);
    expect(n.phase).toBe('young');
    expect(n.genes.limb).toBeCloseTo(KTRAIN.step.limb);
    expect(n.train).toEqual(newTrain());
    expect(n.nest).toEqual(nest);
  });
});

describe('Klettern und Sauerstoff', () => {
  it('Beine und Griff lassen steilere Hänge zu', () => {
    expect(maxSlope(0, 0)).toBe(CLIMB.base);
    expect(maxSlope(1, 1)).toBe(CLIMB.base + CLIMB.limb + CLIMB.grip);
    expect(maxSlope(0.5, 0)).toBeGreaterThan(maxSlope(0, 0));
    expect(maxSlope(0, 0.5)).toBeGreaterThan(maxSlope(0, 0));
  });

  it('Klettern kostet Ausdauer – ein Schuppenpanzer mehr', () => {
    expect(climbCost(10, 40, 0)).toBe(0);
    const light = climbCost(40, 40, 0), heavy = climbCost(40, 40, 1);
    expect(light).toBeCloseTo(CLIMB.cost);
    expect(heavy).toBeCloseTo(CLIMB.cost * (1 + CLIMB.armor));
    expect(climbCost(28, 40, 0)).toBeLessThan(light);
  });

  it('an Land sinkt der Sauerstoff, leer trocknet man aus; im Wasser füllt er sich', () => {
    const s = oxygenSeconds(0, false);
    expect(s).toBe(OXYGEN.seconds);
    expect(oxygenSeconds(2, false)).toBeCloseTo(OXYGEN.seconds * (1 + 2 * OXYGEN.perUp));
    expect(oxygenSeconds(0, true)).toBeLessThan(s);
    let o = 1;
    o = breathe(o, s / 2, true, s).o;
    expect(o).toBeCloseTo(0.5);
    const dry = breathe(0.01, 1, true, s);
    expect(dry.o).toBe(0);
    expect(dry.dry).toBeCloseTo(OXYGEN.dry);
    expect(breathe(0.2, 1, false, s)).toEqual({ o: 0.2 + OXYGEN.refill, dry: 0 });
  });
});
