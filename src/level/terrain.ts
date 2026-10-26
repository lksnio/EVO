import { clamp, mulberry32, type Rect, type Rng } from '../util/math';

// Das Gelände des Meeresbodens: eine glatte Höhenlinie (in Säulen von 20 Bildpunkten Breite), Zonen aus Sand, Fels und
// Schlamm und Felsbrocken. Die Hitboxen bleiben Rechtecke (Säulen bzw. schmale Scheiben eines Felsens) – aber so fein,
// dass der Boden nicht mehr stufig wirkt. Gezeichnet wird er weich (art/terrainArt.ts).

/** Breite einer Bodensäule in Bildpunkten. */
export const STEP = 20;
const TAU = Math.PI * 2;

export type Material = 'sand' | 'rock' | 'mud';

export interface TerrainZone {
  x0: number;
  x1: number;
  kind: Material;
}

export type Poly = [number, number][];

/** Ein Felsbrocken (Mittelpunkt) – kleine sind nur Kiesel, ab einer gewissen Größe hat er eine Hitbox. */
export interface RockSpec {
  x: number;
  y: number;
  rx: number;
  ry: number;
  seed: number;
  /** 0 hell (Sand), 1 normal, 2 dunkel – für die Färbung */
  tone: number;
  /** eigener Umriss (relativ zum Mittelpunkt) statt des rundlichen Brockens – für Platten und Bögen */
  poly?: Poly;
  form?: 'boulder' | 'slab' | 'arch';
}

export interface Terrain {
  hp: number[];
  zones: TerrainZone[];
}

/** Höhe des Bodens (Oberkante, Bildpunkte) bei x – zwischen den Säulen weich übergehend. */
export function groundAt(hp: number[], x: number) {
  const f = x / STEP - 0.5;
  const i = Math.floor(f);
  const t = f - i;
  const a = hp[Math.max(0, Math.min(hp.length - 1, i))];
  const b = hp[Math.max(0, Math.min(hp.length - 1, i + 1))];
  return a + (b - a) * t;
}

/** Wie uneben der Boden zwischen x0 und x1 ist (größte Höhendifferenz in Bildpunkten). */
export function flatness(hp: number[], x0: number, x1: number) {
  let lo = Infinity, hi = -Infinity;
  const a = Math.max(0, Math.floor(x0 / STEP)), b = Math.min(hp.length - 1, Math.floor(x1 / STEP));
  for (let i = a; i <= b; i++) {
    lo = Math.min(lo, hp[i]);
    hi = Math.max(hi, hp[i]);
  }
  return hi - lo;
}

/** Den Boden zwischen x0 und x1 auf die Höhe y einebnen; davor und dahinter geht er weich in das Gelände über. */
export function flatten(hp: number[], x0: number, x1: number, y: number, blend = 140) {
  const a = Math.max(0, Math.floor((x0 - blend) / STEP)), b = Math.min(hp.length - 1, Math.floor((x1 + blend) / STEP));
  for (let i = a; i <= b; i++) {
    const x = (i + 0.5) * STEP;
    const d = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    if (d <= 0) hp[i] = y;
    else {
      const u = 1 - Math.min(1, d / blend);
      const s = u * u * (3 - 2 * u);
      hp[i] = hp[i] + (y - hp[i]) * s;
    }
  }
}

/** Zonen aus Sand, Fels und Schlamm – je nach Ort mit anderem Gewicht. Im Fluss am Start liegt Sand und Kies. */
export function makeZones(r: Rng, widthPx: number, kind: string, riverEndPx: number): TerrainZone[] {
  const W: Record<Material, number> = kind === 'lush'
    ? { sand: 0.45, rock: 0.15, mud: 0.4 }
    : kind === 'murky'
      ? { sand: 0.25, rock: 0.2, mud: 0.55 }
      : kind === 'deep' || kind === 'abyss'
        ? { sand: 0.2, rock: 0.6, mud: 0.2 }
        : { sand: 0.55, rock: 0.25, mud: 0.2 };
  const zones: TerrainZone[] = [];
  let x = 0;
  let prev: Material | null = null;
  if (riverEndPx > 0) {
    zones.push({ x0: 0, x1: riverEndPx, kind: 'sand' });
    x = riverEndPx;
    prev = 'sand';
  }
  while (x < widthPx) {
    const mats = Object.keys(W) as Material[];
    let kindPick: Material = 'sand';
    for (let k = 0; k < 6; k++) {
      let q = r() * (W.sand + W.rock + W.mud);
      kindPick = mats.find((m) => (q -= W[m]) <= 0) ?? 'sand';
      if (kindPick !== prev) break;
    }
    const len = (12 + Math.floor(r() * 26)) * 40;
    const x1 = Math.min(widthPx, x + len);
    zones.push({ x0: x, x1, kind: kindPick });
    x = x1;
    prev = kindPick;
  }
  return zones;
}

export const zoneAt = (zones: TerrainZone[], x: number): Material => zones.find((z) => x >= z.x0 && x < z.x1)?.kind ?? 'sand';

/**
 * Die glatte Höhenlinie: Profil des Ortes (in Kacheln), dazu sanfte Wellen und je nach Material Dünen (Sand),
 * Buckel und Kanten (Fels) oder fast nichts (Schlamm). Zum Schluss geglättet und in der Steigung begrenzt.
 * base(c): Höhe in Kacheln bei der (gebrochenen) Spalte c.
 */
export function buildHeightfield(r: Rng, cols: number, rows: number, zones: TerrainZone[], base: (c: number) => number, undulate = 1, minRow = 9): number[] {
  const T = 40;
  const n = cols * 2;
  const hp = new Array<number>(n);
  const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
  // Anteil der Materialien in der Umgebung jeder Säule (damit die Rauheit weich übergeht)
  const kinds: Material[] = [];
  for (let i = 0; i < n; i++) kinds.push(zoneAt(zones, (i + 0.5) * STEP));
  const w = (i: number, m: Material) => {
    let c = 0, k = 0;
    for (let j = Math.max(0, i - 7); j <= Math.min(n - 1, i + 7); j++) {
      k++;
      if (kinds[j] === m) c++;
    }
    return c / k;
  };
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * STEP;
    let y = base((i + 0.5) / 2) * T;
    y += undulate * (0.85 * T * Math.sin((x * TAU) / 1500 + ph[0]) + 0.5 * T * Math.sin((x * TAU) / 620 + ph[1]));
    const sand = 6 * Math.sin((x * TAU) / 130 + ph[2]) + 2.5 * Math.sin((x * TAU) / 47 + ph[3]);
    const rock = 10 * Math.sin((x * TAU) / 150 + ph[2]) + 7 * Math.sin((x * TAU) / 57 + ph[3]) + 4 * Math.sin((x * TAU) / 23 + ph[0]);
    const mud = 3 * Math.sin((x * TAU) / 210 + ph[2]);
    y += w(i, 'sand') * sand + w(i, 'rock') * rock + w(i, 'mud') * mud;
    hp[i] = Math.max(minRow * T, Math.min((rows - 2) * T, y));
  }
  // weich machen und die Steigung begrenzen (nichts steiler als etwa 60°)
  for (let pass = 0; pass < 2; pass++) {
    const src = hp.slice();
    for (let i = 1; i < n - 1; i++) hp[i] = (src[i - 1] + 2 * src[i] + src[i + 1]) / 4;
  }
  const MAX = 34;
  for (let i = 1; i < n; i++) hp[i] = hp[i - 1] + Math.max(-MAX, Math.min(MAX, hp[i] - hp[i - 1]));
  for (let i = n - 2; i >= 0; i--) hp[i] = hp[i + 1] + Math.max(-MAX, Math.min(MAX, hp[i] - hp[i + 1]));
  return hp;
}

/** Die glatte Höhenlinie, wie sie gezeichnet wird (Catmull-Rom durch die Säulenhöhen). */
export function groundCurve(hp: number[], x: number) {
  const f = x / STEP - 0.5;
  const i = Math.floor(f), t = f - i;
  const g = (k: number) => hp[Math.max(0, Math.min(hp.length - 1, k))];
  const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/**
 * Aus der Höhenlinie die Hitboxen: Säulen von 10 Bildpunkten Breite, jede so hoch wie die gezeichnete Linie in ihrer Mitte
 * (so sinkt man an Hängen höchstens ein paar Punkte ein). Nebeneinander liegende Säulen gleicher (±3 Bildpunkte) Höhe werden zu
 * einem Rechteck zusammengefasst.
 */
export function groundRects(hp: number[], bottom: number): Rect[] {
  const W = STEP / 2;
  const n = hp.length * 2;
  const tops: number[] = [];
  for (let i = 0; i < n; i++) tops.push(groundCurve(hp, (i + 0.5) * W));
  const out: Rect[] = [];
  let i = 0;
  while (i < n) {
    let j = i + 1;
    let top = tops[i];
    while (j < n && Math.abs(tops[j] - tops[i]) <= 3) {
      top = Math.min(top, tops[j]);
      j++;
    }
    const y = Math.round(top);
    out.push({ x: i * W, y, w: (j - i) * W, h: bottom - y + 200 });
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Felsbrocken

/** Die Umrisse eines Felsens (relativ zum Mittelpunkt): rundlich, unregelmäßig, unten etwas flacher. */
export function rockPoly(seed: number, rx: number, ry: number): Poly {
  const r = mulberry32(seed);
  const n = 16;
  const a0 = r() * TAU, a1 = r() * TAU, a2 = r() * TAU;
  const pts: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + 0.13 * Math.sin(a * 2 + a0) + 0.09 * Math.sin(a * 3 + a1) + 0.06 * Math.sin(a * 5 + a2) + (r() - 0.5) * 0.08;
    const c = Math.cos(a), s = Math.sin(a);
    // etwas kantig statt Ellipse: die Potenz zieht die Ecken nach außen
    const px = Math.sign(c) * Math.pow(Math.abs(c), 0.82);
    const py = Math.sign(s) * Math.pow(Math.abs(s), 0.82);
    pts.push([px * rx * k, py * ry * k * (s > 0 ? 0.78 : 1)]);
  }
  return pts;
}

/** Die Oberkante des Felsens bei dx (relativ zum Mittelpunkt); null, wenn dort nichts ist. */
export function rockTop(poly: Poly, dx: number): number | null {
  let top: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    if ((x0 > dx) === (x1 > dx)) continue;
    const t = (dx - x0) / (x1 - x0);
    const y = y0 + (y1 - y0) * t;
    if (top === null || y < top) top = y;
  }
  return top;
}

/** Der Umriss eines Felsens (relativ zum Mittelpunkt). */
export const rockOutline = (rock: RockSpec): Poly => rock.poly ?? rockPoly(rock.seed, rock.rx, rock.ry);

/** Der tiefste Punkt des Umrisses (relativ zum Mittelpunkt). */
export const rockBottom = (poly: Poly) => poly.reduce((m, p) => Math.max(m, p[1]), -Infinity);

/** Die Hitbox eines Felsbrockens: schmale Scheiben von der Oberkante bis tief in den Boden (leicht großzügig: der höchste Punkt der Säule zählt). */
export function rockSlices(rock: RockSpec, groundY: (x: number) => number): Rect[] {
  const poly = rockOutline(rock);
  const out: Rect[] = [];
  const x0 = Math.ceil((rock.x - rock.rx) / STEP) * STEP;
  for (let x = x0; x < rock.x + rock.rx; x += STEP) {
    let top: number | null = null;
    for (const f of [0.1, 0.5, 0.9]) {
      const t = rockTop(poly, x + STEP * f - rock.x);
      if (t !== null && (top === null || t < top)) top = t;
    }
    if (top === null) continue;
    const y = Math.round(rock.y + top);
    const g = groundY(x + STEP / 2);
    if (y >= g + 6) continue;
    out.push({ x, y, w: STEP, h: Math.max(10, g + 40 - y) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Der Fels über einer Höhle und Platten über Felsspalten

const relative = (pts: Poly): { poly: Poly; x: number; y: number; rx: number; ry: number } => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { poly: pts.map(([x, y]) => [x - cx, y - cy]), x: cx, y: cy, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 };
};

/**
 * Das Felsmassiv über einer Höhle: Der Hohlraum liegt zwischen x0 und x1 über dem Boden (floor). Seine Decke ist unregelmäßig
 * (etwa high Bildpunkte hoch, in der Mitte höher), das hintere Ende ist rund und geschlossen – dahinter ein Pfeiler, der weich
 * in den Boden ausläuft (foot). Auf der offenen Seite (side: 1 rechts, -1 links) endet der Fels nach einer kurzen Mündung
 * (mouth) mit einer Lippe. Die Hitbox sind schmale Säulen über der Decke.
 */
export function caveRock(x0: number, x1: number, floor: number, high: number, foot: number, dome: number, mouth: number, side: 1 | -1, seed: number) {
  const r = mulberry32(seed);
  const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU, p4 = r() * TAU;
  const len = x1 - x0;
  // q: Abstand vom geschlossenen Ende ins Innere (negativ: der Pfeiler dahinter, über len: die Mündung)
  const X = (q: number) => (side > 0 ? x0 + q : x1 - q);
  const ceil0 = floor - high;
  const THIN = 58, LIP = 30;
  const R = Math.min(64, high * 0.55);
  /** die Decke des Hohlraums: in der Mitte höher, unregelmäßig, am geschlossenen Ende rund bis zum Boden */
  const roof = (q: number) => {
    const u = clamp(q / len, 0, 1), x = X(q);
    const h = high * (0.8 + 0.2 * Math.sin(Math.PI * u)) + 9 * Math.sin(x * 0.031 + p1) + 5 * Math.sin(x * 0.083 + p2);
    const y = floor - h;
    if (q >= R) return y;
    const k = (R - Math.max(0, q)) / R;
    return floor - (floor - y) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  /** die Oberkante des Felsens */
  const top = (q: number) => {
    const x = X(q);
    const n = 5 * Math.sin(x * 0.045 + p3) + 3 * Math.sin(x * 0.13 + p4);
    if (q < 0) {
      const s = Math.min(1, -q / foot);
      const e = s * s * (3 - 2 * s);
      return Math.min(floor - 3, ceil0 - THIN + (floor - ceil0 + THIN) * e + n * (1 - s));
    }
    if (q <= len) {
      const u = (q - len / 2) / (len / 2);
      return ceil0 - THIN - (dome - THIN) * (1 - u * u) + n;
    }
    // die Mündung: Der Fels senkt sich bis auf eine Lippe über der Öffnung
    const s = Math.min(1, (q - len) / mouth);
    const e = s * s * (3 - 2 * s);
    const from = ceil0 - THIN + n;
    return from + (roof(q) - LIP - from) * e;
  };
  const end = len + mouth;
  const pts: Poly = [[X(-foot), floor + 24]];
  for (let q = -foot; q < end; q += 10) pts.push([X(q), top(q)]);
  pts.push([X(end), top(end)], [X(end), roof(end)]);
  for (let q = end - 10; q > 0; q -= 10) pts.push([X(q), roof(q)]);
  pts.push([X(0), floor], [X(0), floor + 24]);
  // der Hohlraum als Umriss (für die dunkle Rückwand und den Schatten drinnen)
  const hollow: Poly = [];
  for (let q = 0; q <= end; q += 10) hollow.push([X(q), roof(q)]);
  hollow.push([X(end), floor + 2], [X(0), floor + 2]);
  const boxes: Rect[] = [];
  const lo = Math.min(X(-foot), X(end)), hi = Math.max(X(-foot), X(end));
  for (let xs = Math.floor(lo / STEP) * STEP; xs < hi; xs += STEP) {
    // die Säule in q gemessen
    const qa = side > 0 ? xs - x0 : x1 - (xs + STEP), qb = qa + STEP;
    if (qb <= -foot || qa >= end) continue;
    const qs = [Math.max(qa, -foot), (qa + qb) / 2, Math.min(qb, end)];
    const t = Math.min(...qs.map(top));
    if (t > floor - 4) continue;
    const y = Math.round(t);
    // über dem Hohlraum nur das Dach (bis zur höchsten Stelle der Decke in dieser Säule), dahinter der ganze Pfeiler
    const bottom = qa >= 0 ? Math.min(...qs.map(roof)) : floor + 40;
    if (bottom - y < 6) continue;
    boxes.push({ x: xs, y, w: STEP, h: Math.round(bottom - y) });
  }
  const rel = relative(pts);
  const rock: RockSpec = { x: rel.x, y: rel.y, rx: rel.rx, ry: rel.ry, seed, tone: 1, poly: rel.poly, form: 'arch' };
  return { rock, boxes, top: (x: number) => top(side > 0 ? x - x0 : x1 - x), hollow, ceil: Math.min(...hollow.map(([, y]) => y)) };
}


/** Eine flache Felsplatte (Hitbox: das Rechteck, der Umriss etwas unregelmäßig und an den Enden abgerundet). */
export function slabRock(x: number, y: number, w: number, h: number, seed: number): RockSpec {
  const r = mulberry32(seed);
  const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU;
  const top = (u: number) => 2 + 2.5 * Math.sin(u * 0.05 + p1) + 1.6 * Math.sin(u * 0.14 + p2);
  const bot = (u: number) => h - 2 - 3 * Math.sin(u * 0.06 + p3) - 1.5 * Math.sin(u * 0.17 + p1);
  const pts: Poly = [[0, h * 0.55], [2, h * 0.28], [12, top(12)]];
  for (let u = 24; u < w - 20; u += 12) pts.push([u, top(u)]);
  pts.push([w - 12, top(w - 12)], [w - 2, h * 0.28], [w, h * 0.55], [w - 4, h * 0.82], [w - 16, bot(w - 16)]);
  for (let u = w - 28; u > 20; u -= 12) pts.push([u, bot(u)]);
  pts.push([16, bot(16)], [4, h * 0.82]);
  return { x: x + w / 2, y: y + h / 2, rx: w / 2, ry: h / 2, seed, tone: 1, poly: pts.map(([px, py]) => [px - w / 2, py - h / 2] as [number, number]), form: 'slab' };
}
