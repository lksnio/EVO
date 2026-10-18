import { PALEO, type PaleoContinent, type Pt } from '../data/paleo';
import { hashStr, mulberry32 } from '../util/math';

// Die Rechnerei hinter der Weltkarte (ohne Zeichnen): Küstenlinien, ein Raster aus Land und Wasser
// und die Wege, die ein Fisch um das Land herum schwimmt.

/** Seitenverhältnis der Kartenfläche (Breite : Höhe in Bildpunkten) – damit Rauschen und Abstände überall gleich wirken. */
export const ASPECT = 1080 / 454;

/** Raster: 270 × 114 Zellen (eine Zelle ≈ 4 Bildpunkte). */
export const GW = 270;
export const GH = 114;
/** Bildpunkte je Zelle (ungefähr) */
export const CELL = 4;

/** Küstenlinie: aus den groben Eckpunkten wird eine zerklüftete, weiche Linie (immer gleich je Zeitalter). */
export function outline(epId: string, c: PaleoContinent): Pt[] {
  const r = mulberry32(hashStr(`${epId}:${c.name}:${c.pts.length}:${c.label[0]}`));
  // im "echten" Maßstab arbeiten, damit die Auslenkung rundum gleich aussieht
  let pts: Pt[] = c.pts.map(([x, y]) => [x * ASPECT, y]);
  for (let pass = 0; pass < 3; pass++) {
    const out: Pt[] = [];
    const amp = 0.2 / (1 + pass * 0.7);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      out.push(a);
      const k = Math.max(1, Math.round(len / 0.07));
      for (let j = 1; j <= k; j++) {
        const t = j / (k + 1) + (r() - 0.5) * 0.12;
        const off = (r() - 0.5) * 2 * amp * Math.min(len, 0.2);
        out.push([a[0] + dx * t - (dy / len) * off, a[1] + dy * t + (dx / len) * off]);
      }
    }
    pts = out;
  }
  // weich machen (Chaikin)
  for (let it = 0; it < 2; it++) {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts.map(([x, y]) => [x / ASPECT, y] as Pt);
}

function inside(poly: Pt[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

interface Grid {
  land: Uint8Array;
  /** Abstand zum nächsten Land (bzw. zum Kartenrand) in Zellen */
  dist: Float32Array;
  outlines: Pt[][];
}

const grids = new Map<string, Grid>();

export function gridOf(epId: string): Grid {
  let g = grids.get(epId);
  if (g) return g;
  const outlines = PALEO[epId].continents.map((c) => outline(epId, c));
  const land = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) / GW, y = (j + 0.5) / GH;
      if (outlines.some((o) => inside(o, x, y))) land[j * GW + i] = 1;
    }
  }
  // Abstandsfeld (Chamfer 3-4)
  const dist = new Float32Array(GW * GH);
  const INF = 1e6;
  for (let k = 0; k < dist.length; k++) dist[k] = land[k] ? 0 : INF;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= GW || j >= GH ? 0 : dist[j * GW + i]);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      let d = dist[k];
      d = Math.min(d, at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.4, at(i + 1, j - 1) + 1.4);
      dist[k] = d;
    }
  }
  for (let j = GH - 1; j >= 0; j--) {
    for (let i = GW - 1; i >= 0; i--) {
      const k = j * GW + i;
      let d = dist[k];
      d = Math.min(d, at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.4, at(i - 1, j + 1) + 1.4);
      dist[k] = d;
    }
  }
  g = { land, dist, outlines };
  grids.set(epId, g);
  return g;
}

const drawnCache = new Map<string, Pt[][]>();

/** Land, das über das Gebiet der Orte hinausragt (Gondwana bis zum Südpol), soll auf der weit herausgezoomten Karte bis über den Rand reichen. */
const stretch = (v: number) => (v < 0.04 ? 0.04 + (v - 0.04) * 14 : v > 0.96 ? 0.96 + (v - 0.96) * 14 : v);

/** Küstenlinien zum Zeichnen (für Wege zählt dagegen nur das Raster in gridOf). */
export function drawnOutlines(epId: string): Pt[][] {
  let d = drawnCache.get(epId);
  if (!d) {
    d = PALEO[epId].continents.map((c) => outline(epId, { ...c, pts: c.pts.map(([x, y]) => [stretch(x), stretch(y)] as Pt) }));
    drawnCache.set(epId, d);
  }
  return d;
}

const farCache = new Map<string, Pt[][]>();

/** Land weit außerhalb des Gebiets der Orte (nur zum Zeichnen, nicht für Wege). */
export function farOutlines(epId: string): Pt[][] {
  let f = farCache.get(epId);
  if (!f) {
    f = (PALEO[epId].far ?? []).map((c) => outline(epId, c));
    farCache.set(epId, f);
  }
  return f;
}

const cellOf = (x: number, y: number): [number, number] => [Math.min(GW - 1, Math.max(0, Math.floor(x * GW))), Math.min(GH - 1, Math.max(0, Math.floor(y * GH)))];

export function isLand(epId: string, x: number, y: number) {
  const [i, j] = cellOf(x, y);
  return gridOf(epId).land[j * GW + i] === 1;
}

/** Abstand zum Land in Bildpunkten (ungefähr). */
export function landDist(epId: string, x: number, y: number) {
  const [i, j] = cellOf(x, y);
  const d = gridOf(epId).dist[j * GW + i];
  return Math.min(d, 999) * CELL;
}

// ------------------------------------------------------------------ Wegsuche

/** Kleiner Heap für A*. */
class Heap {
  private a: { k: number; f: number; g: number }[] = [];
  get size() {
    return this.a.length;
  }
  push(k: number, f: number, g = 0) {
    const a = this.a;
    a.push({ k, f, g });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const routes = new Map<string, Pt[]>();

function segClear(epId: string, a: Pt, b: Pt) {
  const n = Math.ceil(Math.hypot((b[0] - a[0]) * GW, (b[1] - a[1]) * GH) * 1.5);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (isLand(epId, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

/**
 * Der Schwimmweg von A nach B (Koordinaten 0..1): immer im Wasser, mit etwas Abstand zur Küste, glatt gezogen.
 * Gibt eine dichte Punktfolge zurück (etwa alle 6 Bildpunkte).
 */
export function waterRoute(epId: string, a: Pt, b: Pt): Pt[] {
  const key = `${epId}|${a}|${b}`;
  const hit = routes.get(key);
  if (hit) return hit;
  const g = gridOf(epId);
  const [ai, aj] = cellOf(a[0], a[1]);
  const [bi, bj] = cellOf(b[0], b[1]);
  const start = aj * GW + ai, goal = bj * GW + bi;
  const cost = new Float64Array(GW * GH).fill(Infinity);
  const from = new Int32Array(GW * GH).fill(-1);
  const heap = new Heap();
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - bi), dy = Math.abs(j - bj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  cost[start] = 0;
  heap.push(start, h(ai, aj));
  // Küstennähe kostet extra: der Weg hält Abstand
  const pen = (d: number) => (d < 9 ? (9 - d) * (9 - d) * 0.06 : 0);
  while (heap.size) {
    const { k, g: gk } = heap.pop();
    if (gk > cost[k]) continue;
    if (k === goal) break;
    const i = k % GW, j = (k / GW) | 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const n = nj * GW + ni;
        if (g.land[n]) continue;
        // Ecken nicht über Land schneiden
        if (di && dj && (g.land[j * GW + ni] || g.land[nj * GW + i])) continue;
        const c = cost[k] + (di && dj ? 1.414 : 1) * (1 + pen(g.dist[n]));
        if (c < cost[n]) {
          cost[n] = c;
          from[n] = k;
          heap.push(n, c + h(ni, nj), c);
        }
      }
    }
  }
  let pts: Pt[] = [];
  if (from[goal] >= 0 || start === goal) {
    for (let k = goal; k >= 0; k = from[k]) {
      pts.push([((k % GW) + 0.5) / GW, (((k / GW) | 0) + 0.5) / GH]);
      if (k === start) break;
    }
    pts.reverse();
    pts[0] = a;
    pts[pts.length - 1] = b;
  } else pts = [a, b];

  // glätten, solange der Weg im Wasser bleibt
  const smoothPass = (src: Pt[]) =>
    src.map((p, i) => {
      if (i === 0 || i === src.length - 1) return p;
      let sx = 0, sy = 0, n = 0;
      for (let d = -4; d <= 4; d++) {
        const q = src[Math.min(src.length - 1, Math.max(0, i + d))];
        sx += q[0];
        sy += q[1];
        n++;
      }
      return [sx / n, sy / n] as Pt;
    });
  for (let it = 0; it < 5; it++) {
    const next = smoothPass(pts);
    let ok = true;
    for (let i = 1; i < next.length && ok; i++) ok = segClear(epId, next[i - 1], next[i]);
    if (!ok) break;
    pts = next;
  }

  // gleichmäßig auflösen (alle ~6 Bildpunkte)
  const px = (p: Pt) => [p[0] * 1080, p[1] * 454];
  const out: Pt[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = px(pts[i - 1]), [x1, y1] = px(pts[i]);
    const len = Math.hypot(x1 - x0, y1 - y0);
    let s = 6 - carry;
    while (s <= len) {
      const t = s / len;
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
      s += 6;
    }
    carry = len - (s - 6);
  }
  out.push(pts[pts.length - 1]);
  routes.set(key, out);
  return out;
}

/** Länge eines Weges in Bildpunkten. */
export function routeLength(pts: Pt[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot((pts[i][0] - pts[i - 1][0]) * 1080, (pts[i][1] - pts[i - 1][1]) * 454);
  return l;
}
