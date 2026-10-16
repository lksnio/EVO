import { TILE, GRAVITY } from '../config';
import { CLASSES } from '../data/classes';
import { SPECIES } from '../data/species';
import { SIDE_ZONES, centerZone, type EpochDef, type Theme, type ZoneDef } from '../data/epochs';
import { DECOR } from '../art/worldArt';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng } from '../util/math';

// Jedes Zeitalter ist ein Lebensraum, den man in beide Richtungen durchstreifen kann – mit drei
// Gebieten: links (flach, trüb, pflanzenreich), in der Mitte der Start, rechts (tief, voller Jäger).
// Er wird für jeden Lauf neu aus einer Saat erzeugt: Gelände, Pflanzen, Dickicht zum
// Verstecken und die Tiere (in Herden, Räuber etwas abseits). Es gibt keinen Ausgang –
// man muss nur die Zeit überstehen.

export interface Spawn {
  id: string;
  x: number;
  y: number;
}

export interface Decor {
  k: string;
  x: number;
  y: number;
  hang?: boolean;
}

export interface LevelData {
  mode: 'water' | 'land';
  theme: Theme;
  variant: 'normal' | 'dark' | 'cave';
  width: number;
  height: number;
  surfaceY: number;
  solids: Rect[];
  platforms: Rect[];
  hazards: Rect[];
  /** fressbare Pflanzen (v = Art) */
  plants: { x: number; y: number; v: number }[];
  /** Dickicht: x, y (oben), Breite, Höhe – unten endet es am Boden */
  cover: Rect[];
  /** Höhlen: der hohle Innenraum (dort sieht man nur noch die Augen) */
  caves: Rect[];
  spawns: Spawn[];
  decor: Decor[];
  start: { x: number; y: number };
  /** Bodenhöhe je Kachelspalte (in Pixeln) – für Zuwanderer und Ereignisse */
  ground: number[];
  /** die drei Gebiete von links nach rechts (in Pixeln) */
  zones: Zone[];
}

export interface Zone {
  x0: number;
  x1: number;
  def: ZoneDef;
}

/** Spalten der drei Gebiete – die Seiten sind etwas schmaler als die Mitte. */
function zoneCols(ep: EpochDef) {
  const side = Math.round(ep.len * 0.6);
  return { side, center: ep.len, cols: side * 2 + ep.len };
}

const T = TILE;

function base(ep: EpochDef, mode: 'water' | 'land', width: number, height: number): LevelData {
  return {
    mode,
    theme: ep.theme,
    variant: ep.cave ? 'cave' : ep.dark ? 'dark' : 'normal',
    width,
    height,
    surfaceY: mode === 'water' && !ep.cave && !ep.dark ? 56 : 0,
    solids: [],
    platforms: [],
    hazards: [],
    plants: [],
    cover: [],
    caves: [],
    spawns: [],
    decor: [],
    start: { x: 0, y: 0 },
    ground: [],
    zones: [],
  };
}

/** Gebiete anlegen und eine Funktion liefern, die zu jeder Spalte die Werte ihres Gebiets kennt. */
function makeZones(L: LevelData, ep: EpochDef) {
  const { side, center } = zoneCols(ep);
  const [left, right] = SIDE_ZONES[ep.theme];
  L.zones = [
    { x0: 0, x1: side * T, def: left },
    { x0: side * T, x1: (side + center) * T, def: centerZone(ep) },
    { x0: (side + center) * T, x1: (side * 2 + center) * T, def: right },
  ];
  return (col: number) => L.zones[col < side ? 0 : col < side + center ? 1 : 2].def;
}

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

function placeFauna(L: LevelData, ep: EpochDef, r: Rng, heights: Heights, water: boolean, startCol: number) {
  const place = (id: string, cx: number) => {
    const d = SPECIES[id];
    const cols = heights.length;
    const n = d.herd ? rint(r, d.herd[0], d.herd[1]) : 1;
    for (let i = 0; i < n; i++) {
      let col = Math.max(0, Math.min(cols - 1, Math.floor(cx + (i - n / 2) * 1.6 + r())));
      for (let k = 0; k < 8 && !water && heights[col] > 21; k++) col = Math.min(cols - 1, col + 1);
      const x = (col + 0.5) * T;
      const ground = heights[col] * T;
      let y: number;
      if (water) y = d.crawl ? ground - 24 : (3 + r() * (heights[col] - 6)) * T;
      else y = d.habitat === 'air' ? ground - T * (3 + r() * 1.5) : ground - 40;
      L.spawns.push({ id, x, y });
    }
  };
  for (const [id, groups] of ep.fauna) {
    const d = SPECIES[id];
    const danger = d.role === 'predator' || d.role === 'defender' || d.role === 'hazard';
    const hunter = d.role === 'predator' || d.role === 'apex';
    L.zones.forEach((z, zi) => {
      // Je Gebiet anders verteilt: links mehr Beute, rechts mehr Jäger
      const mul = zi === 1 ? 1 : 0.75 * (hunter ? z.def.hunters : d.role === 'prey' ? z.def.prey : 1);
      const want = groups * mul;
      const count = Math.floor(want) + (r() < want - Math.floor(want) ? 1 : 0);
      const c0 = Math.floor(z.x0 / T) + 4, c1 = Math.floor(z.x1 / T) - 5;
      for (let g = 0; g < count; g++) {
        // Räuber nicht direkt neben dem Startplatz
        const keep = danger ? 20 : 8;
        let cx = rint(r, c0, c1);
        for (let k = 0; k < 12 && Math.abs(cx - startCol) < keep; k++) cx = rint(r, c0, c1);
        place(id, cx);
      }
    });
  }
  // Im gefährlichen Gebiet lebt einer der ganz Großen
  const apex = ep.events.find((e) => e.species && SPECIES[e.species]?.role === 'apex')?.species;
  const right = L.zones[2];
  if (apex && right) place(apex, Math.floor((right.x0 + (right.x1 - right.x0) * 0.6) / T));
}

// ---------------------------------------------------------------------------

function genLand(ep: EpochDef, r: Rng): LevelData {
  const { cols, side, center } = zoneCols(ep);
  const rows = 22;
  const L = base(ep, 'land', cols * T, rows * T);
  const zoneAt = makeZones(L, ep);
  const jump = CLASSES[ep.cls].base.jump;
  const jumpTiles = Math.max(2, Math.floor(((jump * jump) / (2 * GRAVITY) - 30) / T));
  const decorKinds = DECOR[ep.theme];
  const hazardOk = ep.fauna.length > 3 || ep.theme === 'reptil';
  const heights: Heights = new Array(cols).fill(17);
  const startCol = side + Math.floor(center * 0.4);

  let h = 17;
  const ground = (x0: number, n: number, top: number, flat = false) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    for (let i = 1; i < n - 1; i += rint(r, 2, 4)) {
      if (r() < 0.6) L.decor.push({ k: pick(r, decorKinds), x: (x0 + i + r()) * T, y: top * T + 4 });
    }
    const z = zoneAt(x0 + Math.floor(n / 2));
    const pl = ep.plants * z.plants;
    // fressbare Pflanzen
    if (n >= 4) {
      const cnt = (r() < pl * 0.85 ? 1 : 0) + (r() < pl * 0.5 ? 1 : 0) + (n >= 9 && r() < pl * 0.3 ? 1 : 0) + (n >= 7 && r() < pl - 1 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1.5 + r() * (n - 3)) * T, y: top * T + 2, v: rint(r, 0, 2) });
    }
    // Dickicht
    if (n >= 6 && r() < ep.cover * z.cover * (flat ? 0.8 : 0.6)) {
      const cw = rint(r, 3, Math.min(5, n - 2));
      const cx = x0 + rint(r, 1, n - cw - 1);
      const ch = rint(r, 3, 4);
      L.cover.push({ x: cx * T, y: (top - ch) * T, w: cw * T, h: ch * T });
    }
  };
  const ceiling = (x0: number, n: number) => {
    const d = rint(r, 2, 4);
    L.solids.push({ x: x0 * T, y: -200, w: n * T, h: d * T + 200 });
    for (let i = 0; i < n; i += rint(r, 2, 4)) {
      L.decor.push({ k: ep.theme === 'eis' ? 'stalactite_ice' : 'stalactite', x: (x0 + i + r()) * T, y: d * T - 2, hang: true });
    }
  };

  ground(0, 10, h);
  if (ep.cave) ceiling(0, 10);
  let x = 10;
  let lastGap = false;
  while (x < cols - 10) {
    // rund um den Startplatz: flach und ruhig
    const nearStart = x >= startCol - 6 && x < startCol + 6;
    if (!nearStart && !lastGap && x > 12 && r() < 0.16) {
      const gap = rint(r, 2, ep.cls === 'mammal' ? 4 : 3);
      if (ep.theme === 'reptil' || (hazardOk && r() < 0.3)) L.hazards.push({ x: x * T, y: rows * T - 30, w: gap * T, h: 60 });
      if (gap >= 3 && r() < 0.6) L.platforms.push({ x: (x + 0.5) * T, y: (h - jumpTiles + 0.3) * T, w: (gap - 1) * T, h: 20 });
      if (ep.cave) ceiling(x, gap);
      for (let i = 0; i < gap; i++) heights[x + i] = rows + 4;
      x += gap;
      lastGap = true;
      continue;
    }
    const seg = nearStart ? 12 : rint(r, 6, 13);
    const steps = lastGap ? [0, 1, 2] : [-jumpTiles, -1, 1, 2];
    const wasGap = lastGap;
    lastGap = false;
    if (!nearStart && (r() < 0.45 || wasGap)) h = Math.max(13, Math.min(19, h + pick(r, steps)));
    ground(x, seg, h, nearStart);
    if (ep.cave) ceiling(x, seg);
    if (!nearStart && r() < 0.4 && seg >= 6) {
      const pw = rint(r, 3, 4);
      const px = x + rint(r, 1, seg - pw - 1);
      L.platforms.push({ x: px * T, y: (h - jumpTiles) * T, w: pw * T, h: 20 });
      if (r() < ep.plants * 0.5) L.plants.push({ x: (px + pw / 2) * T, y: (h - jumpTiles) * T + 2, v: rint(r, 0, 2) });
    }
    if (!nearStart && hazardOk && seg >= 8 && r() < 0.2) {
      const hx = x + rint(r, 3, seg - 4);
      L.hazards.push({ x: hx * T, y: h * T - 24, w: T * rint(r, 1, 2), h: 24 });
    }
    x += seg;
  }
  const rest = cols - x;
  ground(x, rest, h);
  if (ep.cave) ceiling(x, rest);
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  const sc = Math.min(cols - 1, startCol + 2);
  L.start = { x: (sc + 0.5) * T, y: heights[sc] * T - 60 };
  placeFauna(L, ep, r, heights, false, sc);
  L.ground = heights.map((v) => v * T);
  return L;
}

// ---------------------------------------------------------------------------

function genWater(ep: EpochDef, r: Rng): LevelData {
  const { cols, side, center } = zoneCols(ep);
  const rows = 22;
  const L = base(ep, 'water', cols * T, rows * T);
  const zoneAt = makeZones(L, ep);
  const covered = ep.dark || ep.cave;
  let floor = 19;
  const heights: Heights = new Array(cols).fill(floor);
  const kinds = ep.reef ? ['rock', 'shell', 'seaweed', 'coral', 'coral', 'sponge', 'anemone'] : DECOR.ozean;
  const startCol = side + Math.floor(center * 0.4);

  const floorSeg = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    const z = zoneAt(x0 + Math.floor(n / 2));
    const pl = ep.plants * z.plants;
    for (let i = 0; i < n; i += rint(r, 1, 2)) {
      if (r() < 0.7) L.decor.push({ k: pick(r, kinds), x: (x0 + Math.min(n - 0.5, i + 0.25 + r() * 0.5)) * T, y: top * T + 6 });
    }
    if (n >= 3) {
      const cnt = (r() < pl * 0.9 ? 1 : 0) + (r() < pl * 0.55 ? 1 : 0) + (n >= 7 && r() < pl * 0.35 ? 1 : 0) + (n >= 5 && r() < pl - 1 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1 + r() * (n - 2)) * T, y: top * T + 4, v: rint(r, 0, 2) });
    }
    if (n >= 4 && r() < ep.cover * z.cover * 0.65) {
      const cw = rint(r, 3, Math.min(6, n));
      const cx = x0 + rint(r, 0, n - cw);
      const ch = rint(r, 5, 7);
      L.cover.push({ x: cx * T, y: (top - ch) * T, w: cw * T, h: ch * T });
    }
  };
  const ceilSeg = (x0: number, n: number) => {
    const d = rint(r, 1, 3);
    L.solids.push({ x: x0 * T, y: -200, w: n * T, h: d * T + 200 });
  };

  floorSeg(0, 10, floor);
  if (covered) ceilSeg(0, 10);
  let x = 10;
  while (x < cols - 10) {
    const seg = rint(r, 5, 10);
    const nearStart = x >= startCol - 5 && x < startCol + 5;
    if (!nearStart && r() < 0.5) floor = Math.max(16, Math.min(20, floor + pick(r, [-1, 1, 2, -2])));
    floorSeg(x, seg, floor);
    if (covered) ceilSeg(x, seg);
    if (!nearStart && r() < 0.28) {
      const px = x + rint(r, 1, seg - 2);
      const top = floor - rint(r, 3, 7);
      L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (floor - top) * T + 2 });
      if (r() < ep.plants * zoneAt(px).plants * 0.6) L.plants.push({ x: (px + 0.5) * T, y: top * T + 4, v: rint(r, 0, 2) });
    }
    if (!nearStart && r() < 0.18) {
      const rw = rint(r, 2, 4);
      const ry = rint(r, 6, 11);
      L.solids.push({ x: (x + 1) * T, y: ry * T, w: rw * T, h: T });
    }
    x += seg;
  }
  floorSeg(x, cols - x, floor);
  if (covered) ceilSeg(x, cols - x);
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  L.start = { x: (startCol + 0.5) * T, y: 9 * T };
  if (ep.caves && !covered) addCaves(L, ep.caves + 2, r, cols, heights, startCol);
  placeFauna(L, ep, r, heights, true, startCol);
  // keine Tiere im Fels der Höhlen
  for (const sp of L.spawns) {
    for (const c of L.caves) if (sp.x > c.x - T && sp.x < c.x + c.w + T && sp.y > c.y - 2 * T) sp.y = c.y - 3 * T;
  }
  L.ground = heights.map((v) => v * T);
  return L;
}

/**
 * Höhlen im Meeresgrund: Felsdach, Wände, ein niedriger Eingang. Wer drinnen still ist,
 * ist kaum zu sehen – nur die Augen leuchten.
 */
function addCaves(L: LevelData, n: number, r: Rng, cols: number, heights: Heights, startCol: number) {
  const W = 8;
  const tried = new Set<number>();
  for (let k = 0; k < 60 && L.caves.length < n; k++) {
    // die erste Höhle nicht weit vom Start, damit man sie findet
    const c0 = L.caves.length === 0 ? startCol + rint(r, 7, 16) * (r() < 0.5 ? 1 : -1) : rint(r, 4, cols - W - 4);
    if (c0 < 3 || c0 + W > cols - 3 || tried.has(c0)) continue;
    tried.add(c0);
    const f = heights[c0];
    let flat = true;
    for (let i = 0; i < W; i++) if (heights[c0 + i] !== f) flat = false;
    if (!flat) continue;
    const x0 = c0 * T, x1 = (c0 + W) * T;
    if (L.caves.some((c) => x0 < c.x + c.w + 4 * T && x1 > c.x - 4 * T)) continue;
    if (L.solids.some((s) => s.x < x1 && s.x + s.w > x0 && s.y < f * T && s.y + s.h > (f - 7) * T && s.y > 0)) continue;
    // Dach (zweilagig, oben schmaler), rechte Wand, linke Wand mit Eingang darunter
    L.solids.push({ x: x0, y: (f - 5) * T, w: W * T, h: T });
    L.solids.push({ x: x0 + T, y: (f - 6) * T, w: (W - 2) * T, h: T });
    L.solids.push({ x: x1 - T, y: (f - 4) * T, w: T, h: 4 * T });
    L.solids.push({ x: x0, y: (f - 4) * T, w: T, h: 2 * T });
    L.caves.push({ x: x0 + T, y: (f - 4) * T, w: (W - 2) * T, h: 4 * T });
    // Bewuchs auf dem Dach – genau auf der jeweiligen Felskante
    for (let i = 0; i < W; i++) if (r() < 0.5) L.decor.push({ k: pick(r, ['seaweed', 'anemone', 'sponge']), x: x0 + (i + 0.5) * T, y: (i === 0 || i === W - 1 ? f - 5 : f - 6) * T + 4 });
  }
  // Pflanzen, Dickicht und Deko im Innern entfernen
  const inside = (x: number, y: number) => L.caves.some((c) => x > c.x - T && x < c.x + c.w + T && y > c.y - 2 * T && y <= c.y + c.h + 8);
  L.plants = L.plants.filter((p) => !inside(p.x, p.y - 10));
  L.cover = L.cover.filter((c) => !L.caves.some((cv) => c.x < cv.x + cv.w + T && c.x + c.w > cv.x - T));
  L.decor = L.decor.filter((d) => !inside(d.x, d.y - 4) || d.y < L.caves[0]?.y);
}

/** Ein Lebensraum für dieses Zeitalter – bei jedem Lauf etwas anders. */
export function generateLevel(ep: EpochDef, salt: string | number): LevelData {
  const r = mulberry32(hashStr(ep.id + '_' + salt));
  return ep.habitat === 'water' ? genWater(ep, r) : genLand(ep, r);
}
