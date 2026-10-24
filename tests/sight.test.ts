import { describe, expect, it } from 'vitest';
import { clarity, clearness, depthOf, disc, farthest, sensed, SIGHT, veil, vision } from '../src/sim/sight';
import { placesOf } from '../src/data/world';
import { EPOCHS } from '../src/data/epochs';
import { generateLevel } from '../src/level/LevelGen';

// Sicht unter Wasser – wie auf einem Zeitstrahl: Steht der Fisch auf 5 und schaut Richtung 10, sieht er 4 bis 7; schaut er
// Richtung 0, sieht er 3 bis 6. Wie weit, hängt an der Sicht des Tiers, an der Wasserqualität und an der Tiefe.

const FULL = 900;
const v20 = vision(0.2, FULL);

describe('Sicht', () => {
  it('nach vorn doppelt so weit wie nach hinten – der klare Bereich liegt vor dem Fisch', () => {
    expect(v20.back).toBeCloseTo(v20.front * SIGHT.backShare);
    const { ahead, r } = disc(v20);
    // vorn reicht er bis front, hinten bis back
    expect(ahead + r).toBeCloseTo(v20.front);
    expect(r - ahead).toBeCloseTo(v20.back);
    expect(clarity(v20.front - 1, 0, v20)).toBe(1);
    expect(clarity(-v20.back + 1, 0, v20)).toBe(1);
    expect(clarity(v20.front + v20.fade + 1, 0, v20)).toBe(0);
    expect(clarity(-v20.back - v20.fade - 1, 0, v20)).toBe(0);
  });

  it('wie auf dem Zeitstrahl: Was vor dem Fisch klar ist, ist es hinter ihm erst halb so weit – und oben wie unten gleich', () => {
    const unit = v20.back;
    // auf 5 nach 10 schauend: 4 bis 7 klar (eine Einheit zurück, zwei nach vorn), 3 und 8 nicht mehr
    expect(clarity(-unit + 1, 0, v20)).toBe(1);
    expect(clarity(2 * unit - 1, 0, v20)).toBe(1);
    expect(clarity(-2 * unit, 0, v20)).toBe(0);
    expect(clarity(3 * unit, 0, v20)).toBe(0);
    expect(clarity(50, 120, v20)).toBeCloseTo(clarity(50, -120, v20));
  });

  it('der Rand ist kurz und deutlich – dahinter nur Wasser', () => {
    expect(v20.fade).toBeLessThan(0.2 * FULL);
    expect(farthest(v20)).toBeCloseTo(disc(v20).r + v20.fade);
    const mid = clarity(v20.front + v20.fade / 2, 0, v20);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it('mehr Sicht reicht weiter: bei 100 % ist es bis zum Bildrand vor dir klar', () => {
    // Auch im klaren Wasser bleibt ein entfernteres Tier erst mit besseren Augen erkennbar.
    expect(clarity(FULL * 0.75, 0, v20)).toBeLessThan(clarity(FULL * 0.75, 0, vision(0.6, FULL)));
    expect(clarity(FULL - 1, 0, vision(1, FULL))).toBe(1);
  });

  it('in sauberem Wasser sieht man weiter – und durch das Wasser hindurch mehr vom Hintergrund', () => {
    expect(vision(0.2, FULL, SIGHT.water.start).front).toBeGreaterThan(vision(0.2, FULL, SIGHT.water.lush).front);
    expect(vision(0.2, FULL, SIGHT.water.lush).front).toBeGreaterThan(vision(0.2, FULL, SIGHT.water.murky).front);
    expect(veil(v20, SIGHT.water.start, 0).murk).toBeLessThan(veil(v20, SIGHT.water.murky, 0).murk);
    expect(clearness(1, 0)).toBe(1);
    expect(clearness(SIGHT.water.lush, 0)).toBeLessThan(1);
  });

  it('nah an der Oberfläche sieht man weiter, in der Tiefe weniger – dort hört es plötzlicher auf und wird früher dunkel', () => {
    const top = vision(0.2, FULL, 1, 0), low = vision(0.2, FULL, 1, 1);
    expect(top.front).toBeGreaterThan(low.front);
    expect(top.fade).toBeGreaterThan(low.fade);
    const vt = veil(top, 1, 0), vl = veil(low, 1, 1);
    expect(vl.dark).toBeGreaterThan(vt.dark);
    expect(vl.murk).toBeGreaterThan(vt.murk);
    expect(vl.field.fade / low.fade).toBeLessThan(vt.field.fade / top.fade);
    expect(depthOf(0)).toBe(0);
    expect(depthOf(SIGHT.deepAt * 2)).toBe(1);
  });

  it('klares Wasser erlaubt schon dem ersten Fisch einen weiten Blick; Trübung begrenzt auch gesegnete Augen', () => {
    for (const sight of [0.2, 0.6, 1]) {
      const clear = vision(sight, FULL, SIGHT.water.start);
      const lush = vision(sight, FULL, SIGHT.water.lush);
      const murky = vision(sight, FULL, SIGHT.water.murky);
      expect(clear.front).toBeGreaterThan(lush.front);
      expect(murky.front).toBeLessThan(clear.front * 0.5);
      expect(murky.fade).toBeLessThan(clear.fade);
      // Ein Tier an derselben Stelle ist im Hellen sichtbar, im Trüben verschwunden.
      expect(clarity(clear.front, 0, clear)).toBe(1);
      expect(clarity(clear.front, 0, murky)).toBe(0);
    }
    expect(vision(0.2, FULL, SIGHT.water.start).front).toBeGreaterThan(FULL * 0.5);
  });

  it('im erzeugten Devon sieht der erste Fisch am Laich weiter als im Flachwasser und tief unten im Tal', () => {
    const ep = EPOCHS.find((e) => e.id === 'devon')!;
    const [river, shelf, valley] = placesOf(ep);
    const L = generateLevel(ep, 'sight', river);
    const roe = L.roe.find((r) => r.own)!;
    const below = roe.y - L.surfaceY;
    const spawn = vision(0.2, FULL, SIGHT.water[river.kind], depthOf(below));
    const open = vision(0.2, FULL, SIGHT.water[shelf.kind], depthOf(below));
    const low = vision(0.2, FULL, SIGHT.water[valley.kind], depthOf(SIGHT.deepAt));
    expect(spawn.front).toBeGreaterThan(FULL * 0.35);
    expect(open.front).toBeLessThan(spawn.front * 0.75);
    expect(low.front).toBeLessThan(open.front * 0.5);
    expect(low.back).toBeLessThan(open.back);
    expect(low.fade).toBeLessThan(open.fade);
  });

  it('die Mindestsicht verhindert weder das weitere Schrumpfen im Dunkeln noch Sichtsegen', () => {
    for (const water of Object.values(SIGHT.water)) {
      const depths = [0, 0.25, 0.5, 0.75, 1].map((deep) => vision(0.2, FULL, water, deep));
      for (let i = 1; i < depths.length; i++) {
        expect(depths[i].front).toBeLessThan(depths[i - 1].front);
        expect(depths[i].back).toBeLessThan(depths[i - 1].back);
        expect(depths[i].fade).toBeLessThan(depths[i - 1].fade);
      }
      expect(vision(1, FULL, water, 1).front).toBeGreaterThan(depths[4].front);
    }
  });

  it('Seitenlinie: Nahes und Angreifer bleiben auch im Trüben ein Umriss – nichts greift unsichtbar an', () => {
    // ganz nah: immer zu spüren, auch hinter dem Fisch in tiefem, trübem Wasser
    expect(sensed(0, false)).toBe(SIGHT.feelClarity);
    expect(sensed(SIGHT.feel * 0.5, false)).toBe(SIGHT.feelClarity);
    expect(sensed(SIGHT.feel, false)).toBe(0);
    // wer dich jagt, ist viel weiter zu spüren – mit einem weichen Übergang am Rand
    expect(sensed(SIGHT.feel * 2, true)).toBe(SIGHT.feelThreatClarity);
    expect(SIGHT.feelThreatClarity).toBeGreaterThan(SIGHT.feelClarity);
    const edge = sensed(SIGHT.feelThreat * 0.85, true);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(SIGHT.feelThreatClarity);
    expect(sensed(SIGHT.feelThreat, true)).toBe(0);
    // gespürt heißt: deckend sichtbar (ab 0,2), aber nur als dunkler Umriss (unter dem klaren Sehen)
    expect(SIGHT.feelClarity).toBeGreaterThanOrEqual(0.2);
    expect(SIGHT.feelThreatClarity).toBeLessThan(0.7);
    // ein Angreifer mit nachlaufendem Bild (Netz) liegt noch weit innerhalb der Reichweite
    const deepMurk = vision(0.2, FULL, 0.5, 1);
    expect(SIGHT.feelThreat).toBeGreaterThan(disc(deepMurk).r + 200);
  });
});
