import { describe, expect, it, vi } from 'vitest';
import { fishAnatomy } from '../src/art/fish/anatomy';
import { solveSpine, wave, type SpineIn } from '../src/art/fish/spine';
import type { Morph } from '../src/art/creatureArt';
import { quantize } from '../src/art/creatureArt';

vi.mock('phaser', () => ({ default: {} }));

const base: Morph = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7 };
const A = (v: Partial<Morph> = {}) => fishAnatomy(quantize({ ...base, ...v }));

/** Minimale, mittlere und maximale Werte jedes sichtbaren Merkmals – einzeln und die schlimmsten Kombinationen. */
const EXTREMES: [string, Partial<Morph>][] = [
  ['neutral', {}],
  ['Kiefer min', { jaw: 0 }], ['Kiefer mittel', { jaw: 0.5 }], ['Kiefer max', { jaw: 1, toothTier: 9, fang: 1 }],
  ['Schädel max', { skull: 1, spike: -1 }],
  ['Tarnung max', { stealth: 1, diet: -1 }], ['Tarnung min', { stealth: -1 }],
  ['lang', { len: 1, girth: -1 }], ['kurz massig', { len: -1, girth: 1 }],
  ['Panzer', { armor: 1 }], ['flink', { swift: 1, fin: 1, tail: 1, fTail: 1, fUp: 1, fDown: 1, fSide: 1, stamUp: 10 }],
  ['träge', { swift: -1, fin: -1, tail: -1, crest: -1 }],
  ['großer Kopf, kleiner Körper', { jaw: 1, skull: 1, spike: -1, size: 0.6, girth: -1, len: -1, toothTier: 9 }],
  ['Stützflossen', { limb: 1, fSide: 1 }],
  ['klein/groß', { size: 0.4 }], ['sehr groß', { size: 2 }],
];

describe('Fisch-Anatomie', () => {
  it.each(EXTREMES)('%s: alle Maße sind endlich und die Teile passen zusammen', (_n, v) => {
    const a = A(v);
    const nums = [a.bw, a.bh, a.bb, a.hx, a.hy, a.pedH, a.pedX, a.tail.lobe, a.tail.spread, a.jawLen, a.jawH, a.eye.x, a.eye.y, a.eye.r, a.anchorX, a.neckX,
      ...a.loop.flat(), ...Object.values(a.bounds)];
    for (const n of nums) expect(Number.isFinite(n)).toBe(true);
    // eine Silhouette: Schnauze vorn, Maulwinkel dahinter, das Auge im Kopf, oberhalb der Maulspalte
    expect(a.tip[0]).toBeGreaterThan(a.hinge[0]);
    expect(a.eye.x).toBeGreaterThan(a.hx);
    expect(a.eye.x).toBeLessThan(a.tip[0]);
    expect(a.eye.y).toBeLessThan(a.hinge[1]);
    expect(a.jawLen).toBeGreaterThan(0);
    expect(a.jawH).toBeGreaterThan(2);
    // das Netz umfasst alles: Silhouette, Schwanzflosse, Auge, Maul
    const { x0, x1, y0, y1 } = a.bounds;
    for (const [x, y] of a.loop) {
      expect(x).toBeGreaterThanOrEqual(x0);
      expect(x).toBeLessThanOrEqual(x1);
      expect(y).toBeGreaterThanOrEqual(y0);
      expect(y).toBeLessThanOrEqual(y1);
    }
    expect(x0).toBeLessThan(a.pedX - a.tail.lobe + 1);
    expect(a.hinge[1] + a.jawH).toBeLessThanOrEqual(y1);
    // Drehpunkt hinter dem Hals, Flossenansätze im Körper
    expect(a.anchorX).toBeLessThan(a.neckX);
    expect(a.neckX).toBeLessThan(a.hx + 1);
    for (const f of [a.dorsal, a.anal, a.pelvic, a.pectoral]) {
      expect(f.len).toBeGreaterThan(0);
      expect(f.at[0]).toBeGreaterThan(x0);
      expect(f.at[0]).toBeLessThan(x1);
    }
  });

  it('ein stärkeres Gebiss macht das Maul größer, nicht die Zähne zahlreicher', () => {
    const small = A({ jaw: 0 }), big = A({ jaw: 1, toothTier: 5 });
    expect(big.jawLen).toBeGreaterThan(small.jawLen * 1.3);
    expect(big.jawH).toBeGreaterThan(small.jawH);
    expect(big.tip[0] - big.hinge[0]).toBeGreaterThan(small.tip[0] - small.hinge[0]);
  });

  it('Schädel, Panzerung und Körperbau ändern die Gestalt, die Grundanordnung bleibt', () => {
    const slim = A({ girth: -1, len: 1 }), fat = A({ girth: 1, len: -1 });
    expect(fat.bh).toBeGreaterThan(slim.bh);
    expect(slim.bw).toBeGreaterThan(fat.bw);
    const sk = A({ skull: 1 }), pl = A();
    expect(sk.hg.dome).toBeGreaterThan(pl.hg.dome);
  });

  it('Anatomie hängt nur von den (gestuften) Evolutionswerten ab – gleiche Werte, gleiche Maße', () => {
    expect(A({ jaw: 0.51 })).toEqual(A({ jaw: 0.5 }));
    expect(A({ jaw: 0.5 })).not.toEqual(A({ jaw: 0.6 }));
  });
});

const spineIn = (a = A(), over: Partial<SpineIn> = {}): { i: SpineIn; n: number } => {
  const n = 23;
  const colX = Array.from({ length: n }, (_, k) => a.bounds.x0 + ((a.bounds.x1 - a.bounds.x0) * k) / (n - 1));
  return {
    n,
    i: { colX, xa: a.anchorX, Ls: a.anchorX - a.bounds.x0, amp: a.bw * 0.15, kw: (Math.PI * 2) / ((a.anchorX - a.bounds.x0) * 1.4), ph: 1, pw: 2, bw: a.bw, coil: 0, pitch: 0, neckEnd: a.neckX + a.bw * 0.1, lungeDx: 0, bob: 0, ...over },
  };
};
const solve = (i: SpineIn, n: number) => {
  const sx = new Float32Array(n), sy = new Float32Array(n), sb = new Float32Array(n);
  solveSpine(i, sx, sy, sb);
  return { sx, sy, sb };
};

describe('Wirbelsäule (Verformung)', () => {
  it('jede Pose entsteht aus der Ruheform: gleiche Eingabe, gleiches Ergebnis, auch nach vielen anderen Posen', () => {
    const { i, n } = spineIn();
    const first = solve(i, n);
    for (let k = 0; k < 200; k++) solve({ ...i, ph: k * 0.37, coil: (k % 5) / 5, pitch: Math.sin(k) * 0.3 }, n);
    const again = solve(i, n);
    expect(Array.from(again.sy)).toEqual(Array.from(first.sy));
    expect(Array.from(again.sx)).toEqual(Array.from(first.sx));
  });

  it('die Länge bleibt erhalten (kein Gummi): Abstand benachbarter Gelenke = Ruheabstand', () => {
    const { i, n } = spineIn();
    for (const ph of [0, 1.3, 2.6, 4]) {
      const { sx, sy } = solve({ ...i, ph, amp: i.bw * 0.22 }, n);
      for (let k = 1; k < n; k++) {
        const rest = i.colX[k] - i.colX[k - 1];
        expect(Math.hypot(sx[k] - sx[k - 1], sy[k] - sy[k - 1])).toBeCloseTo(rest, 3);
      }
    }
  });

  it('der Kopf bleibt ruhig, der Ausschlag wächst zum Schwanz hin', () => {
    const { i, n } = spineIn(A(), { amp: A().bw * 0.2 });
    let headMax = 0, midMax = 0, tailMax = 0;
    for (let t = 0; t < 40; t++) {
      const { sy } = solve({ ...i, ph: t * 0.4 }, n);
      headMax = Math.max(headMax, Math.abs(sy[n - 1]));
      midMax = Math.max(midMax, Math.abs(sy[Math.floor(n * 0.35)]));
      tailMax = Math.max(tailMax, Math.abs(sy[0]));
    }
    expect(headMax).toBeLessThan(0.01);
    expect(midMax).toBeGreaterThan(headMax);
    expect(tailMax).toBeGreaterThan(midMax * 1.5);
    // Wellenhöhe ist an der Schwanzspitze höchstens der eingestellte Ausschlag (leicht verkürzt durch die Bogenlänge)
    expect(tailMax).toBeLessThanOrEqual(i.amp * 1.45);
    expect(wave(i, 0)).toBeCloseTo(0, 6);
  });

  it('Kopfneigung und Vorstoß bewegen nur Kopf und Hals, der Schwanz bleibt davon unberührt', () => {
    const { i, n } = spineIn(A(), { amp: 0 });
    const rest = solve(i, n);
    const bite = solve({ ...i, pitch: -0.15, lungeDx: 4 }, n);
    for (let k = 0; k < n; k++) {
      if (i.colX[k] <= i.xa) {
        expect(bite.sx[k]).toBeCloseTo(rest.sx[k], 6);
        expect(bite.sy[k]).toBeCloseTo(rest.sy[k], 6);
      }
    }
    expect(bite.sx[n - 1]).toBeGreaterThan(rest.sx[n - 1] + 3);
    expect(bite.sb[n - 1]).toBeCloseTo(-0.15, 6);
  });
});
