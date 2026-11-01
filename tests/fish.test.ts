import { describe, expect, it, vi } from 'vitest';
import { fishAnatomy } from '../src/art/fish/anatomy';
import { MIN_INNER, solveSpine, wave, type SpineIn } from '../src/art/fish/spine';
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

describe('Netz klappt nicht um', () => {
  it.each(EXTREMES)('%s: auch bei stärkstem Ausschlag und Ausholen bleibt die Innenkante jeder Zelle erhalten', (_n, v) => {
    const a = A(v);
    const n = 17;
    const colX = Array.from({ length: n }, (_, k) => a.bounds.x0 + ((a.bounds.x1 - a.bounds.x0) * k) / (n - 1));
    const reach = colX.map((x) => (x < a.pedX ? Math.max(a.tail.spread * 1.1, 6) : Math.max(Math.abs(a.bounds.y0), Math.abs(a.bounds.y1)) * 0.85));
    for (let t = 0; t < 80; t++) {
      const { i } = spineIn(a, { colX, amp: a.bw * 0.3, ph: t * 0.37, coil: t % 2, pitch: 0.2 * Math.sin(t), reach, pw: 1.8 });
      const sx = new Float32Array(n), sy = new Float32Array(n), sb = new Float32Array(n);
      solveSpine(i, sx, sy, sb);
      for (let k = 1; k < n; k++) {
        const dx = colX[k] - colX[k - 1];
        // Innenkante einer Zelle in der größten Entfernung von der Wirbelsäule
        const inner = dx - Math.max(reach[k], reach[k - 1]) * Math.abs(sb[k] - sb[k - 1]);
        expect(inner).toBeGreaterThanOrEqual(MIN_INNER * dx - 1e-4);
      }
    }
  });
});

describe('Gemalte Fischtexturen (Registrierung)', () => {
  it('jedes Bild existiert, passt zur Registrierung und die Verkleinerung ist bei allen Teilen gleichmäßig', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const { REG } = await import('../src/art/fish/painted');
    const reg = JSON.parse(readFileSync('art/EVO_fish_painted_v1/EVO_fish_painted_v1/registration.json', 'utf8')).assets;
    for (const [k, r] of Object.entries(REG)) {
      expect(existsSync(`src/assets/fish/painted/${k}.webp`), k).toBe(true);
      // die Pixelmaße des Originals und die gemalte Begrenzung stehen so im mitgelieferten Registrierungsbogen
      expect(r.orig, k).toEqual(reg[k].nativeSize);
      expect(r.src, k).toEqual(reg[k].paintedBounds128);
      expect(r.src[0]).toBeGreaterThanOrEqual(0);
      expect(r.src[2]).toBeLessThanOrEqual(r.orig[0]);
      expect(r.src[3]).toBeLessThanOrEqual(r.orig[1]);
      expect(r.dst[2]).toBeGreaterThan(r.dst[0]);
      expect(r.dst[3]).toBeGreaterThan(r.dst[1]);
    }
  });
});

describe('Körperzeichnung je Form', () => {
  it('die Gewichte der gemalten Körper: neutral in der Mitte, kurz/massig und lang/schlank an den Enden, dazwischen weich – immer Summe 1', async () => {
    const { bodyWeights, jawLongWeight } = await import('../src/art/fish/painted');
    const w = (v: Partial<Morph>) => bodyWeights(A(v));
    expect(w({}).neutral).toBe(1);
    expect(w({ len: 0.2, girth: -0.2 }).neutral).toBeGreaterThan(0.9);
    expect(w({ len: -1, girth: 1 }).kurz).toBe(1);
    expect(w({ len: 1, girth: -1, swift: 1 }).lang).toBe(1);
    let last = 1;
    for (let k = 0; k <= 10; k++) {
      const x = w({ len: -k / 10, girth: k / 10 });
      expect(x.neutral + x.kurz + x.lang).toBeCloseTo(1, 6);
      expect(x.neutral).toBeLessThanOrEqual(last + 1e-9);
      last = x.neutral;
    }
    expect(jawLongWeight(A({ jaw: 0 }))).toBe(0);
    expect(jawLongWeight(A({ jaw: 1, toothTier: 9 }))).toBe(1);
  });
});

describe('Rumpfform (Überarbeitung v3)', () => {
  /** Obere und untere Kante der Silhouette bei x (Schnitt der Linie mit dem Polygon). */
  const edgeAt = (loop: [number, number][], x: number): [number, number] => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < loop.length; i++) {
      const [x1, y1] = loop[i], [x2, y2] = loop[(i + 1) % loop.length];
      if ((x1 - x) * (x2 - x) > 0 || x1 === x2) continue;
      const y = y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    return [lo, hi];
  };

  it.each([['normal', {}], ['kurz/massig', { len: -1, girth: 1 }], ['kurz, mittel', { len: -0.5, girth: 0.5 }], ['Gebiss + kurz', { len: -1, girth: 1, jaw: 1, diet: 1, toothTier: 9 }], ['Panzer + kurz', { len: -0.6, girth: 0.6, armor: 1 }]] as [string, Partial<Morph>][])(
    '%s: vom Schwanzstiel bis zur Rückenhöhe wird der Körper stetig höher, kein Buckel, keine Raute', (_n, v) => {
      const a = A(v);
      const x0 = a.pedX + 1.5, x1 = a.bw * 0.08;
      let prevT = Infinity, prevB = -Infinity;
      for (let x = x0; x <= x1; x += 0.5) {
        const [t, b] = edgeAt(a.loop, x);
        expect(t).toBeLessThanOrEqual(prevT + 0.35);
        expect(b).toBeGreaterThanOrEqual(prevB - 0.35);
        prevT = t;
        prevB = b;
      }
    });

  it('massige Form: rund und zusammenhängend – Höhe und Länge stehen im Verhältnis, der Bauch hängt nicht tiefer als der Rücken ragt', () => {
    const a = A({ len: -1, girth: 1 });
    const [t, b] = edgeAt(a.loop, 0);
    expect(b - t).toBeGreaterThan(a.bw * 0.55);
    expect(Math.abs(b)).toBeLessThanOrEqual(Math.abs(t) * 1.25);
  });

  it('der Unterkiefer behält Masse: Tiefe bei starkem Gebiss nicht unter der des normalen Fisches, und er reicht bis zur Kehle', () => {
    const n = A({}), g = A({ jaw: 1, diet: 1, toothTier: 9 }), k = A({ len: -1, girth: 1, jaw: 1, diet: 1, toothTier: 9 });
    expect(g.jawH).toBeGreaterThanOrEqual(n.jawH);
    expect(k.jawH).toBeGreaterThanOrEqual(g.jawH * 0.9);
    // die Kehle (letzter Punkt der Linie) liegt unter der Maulspalte; der Kiefer reicht zu mindestens 78 % bis dorthin, höchstens 117 % (der Rest deckt die Wange)
    for (const a of [n, g, k]) {
      const d = a.loop[a.loop.length - 1][1] - a.hinge[1];
      expect(a.jawH).toBeGreaterThanOrEqual(0.78 * d - 0.01);
      expect(a.jawH).toBeLessThanOrEqual(1.17 * d + 0.01);
    }
  });
});

describe('Spieleraufhellung (LIFT)', () => {
  it('begrenzt, ruhig nachgeführt und nur von der Sicht abhängig', async () => {
    const { LIFT } = await import('../src/sim/sight');
    expect(LIFT.base).toBeGreaterThan(0);
    expect(LIFT.range).toBeGreaterThanOrEqual(0);
    // setLift begrenzt auf 0 … 0,5; der Höchstwert bleibt darunter, damit Augen und Flossen nicht ausbrennen
    expect(LIFT.base + LIFT.range).toBeLessThanOrEqual(0.4);
    expect(LIFT.rate).toBeGreaterThan(0);
    expect(LIFT.rate).toBeLessThanOrEqual(4);
  });
});

describe('Gemalter Kopfpanzer (Registrierung)', () => {
  const MAXP = { skull: 1, spike: -1 } as Partial<Morph>;
  it('die Augenmitte des Bildes liegt auf A.eye, die Abbildung ist streng wachsend (keine Faltung) – auch bei Mischformen', async () => {
    const { armorMapper, ARMOR } = await import('../src/art/fish/painted');
    for (const v of [MAXP, { ...MAXP, len: -1, girth: 1 }, { ...MAXP, len: 1, girth: -1 }, { ...MAXP, jaw: 1, diet: 1, toothTier: 9 }, { skull: 0.3, spike: -0.3 }]) {
      const a = A(v), map = armorMapper(a);
      expect(map(ARMOR.eye[0])).toBeCloseTo(a.eye.x, 6);
      let prev = -Infinity;
      for (let px = 0; px <= ARMOR.w; px += 20) {
        const x = map(px);
        expect(x).toBeGreaterThan(prev);
        prev = x;
      }
    }
  });
  it('die Referenzform liefert die Maße des Pakets (Augenmitte, Hinterkante), die Hinterkante bleibt am Kopf, nicht an der Schnauze', async () => {
    const { armorMapper } = await import('../src/art/fish/painted');
    const ref = A(MAXP), long = A({ ...MAXP, jaw: 1, diet: 1, toothTier: 9 });
    const rearRef = armorMapper(ref)(0) - ref.hx, rearLong = armorMapper(long)(0) - long.hx;
    expect(rearRef).toBeGreaterThan(-20);
    expect(rearRef).toBeLessThan(-14);
    expect(Math.abs(rearLong - rearRef)).toBeLessThan(3);
  });
  it('die Deckung wächst mit A.plate von 0 (ohne Panzer) bis 1 und bleibt dazwischen stetig', async () => {
    const { armorCover } = await import('../src/art/fish/painted');
    expect(armorCover(A({}))).toBe(0);
    expect(armorCover(A(MAXP))).toBe(1);
    let prev = 0;
    for (let k = 0; k <= 10; k++) {
      const c = armorCover(A({ skull: k / 10, spike: -k / 10 }));
      expect(c).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = c;
    }
  });
});
