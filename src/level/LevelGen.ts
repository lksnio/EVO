import { TILE, GRAVITY } from '../config';
import { CLASSES } from '../data/classes';
import { SPECIES } from '../data/species';
import type { EpochDef, Theme } from '../data/epochs';
import { DECOR } from '../art/worldArt';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng } from '../util/math';

// Jedes Zeitalter ist ein Lebensraum, den man in beide Richtungen durchstreifen kann.
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
  plants: { x: number; y: number }[];
  /** Dickicht: x, y (oben), Breite, Höhe – unten endet es am Boden */
  cover: Rect[];
  spawns: Spawn[];
  decor: Decor[];
  start: { x: number; y: number };
  /** Bodenhöhe je Kachelspalte (in Pixeln) – für Zuwanderer und Ereignisse */
  ground: number[];
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
    spawns: [],
    decor: [],
    start: { x: 0, y: 0 },
    ground: [],
  };
}

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

function placeFauna(L: LevelData, ep: EpochDef, r: Rng, cols: number, heights: Heights, water: boolean, startCol: number) {
  for (const [id, groups] of ep.fauna) {
    const d = SPECIES[id];
    for (let g = 0; g < groups; g++) {
      const danger = d.role === 'predator' || d.role === 'defender' || d.role === 'hazard';
      // Räuber nicht direkt neben dem Startplatz
      const keep = danger ? 20 : 8;
      let cx = rint(r, 4, cols - 5);
      for (let k = 0; k < 12 && Math.abs(cx - startCol) < keep; k++) cx = rint(r, 4, cols - 5);
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
    }
  }
}

// ---------------------------------------------------------------------------

function genLand(ep: EpochDef, r: Rng): LevelData {
  const cols = ep.len;
  const rows = 22;
  const L = base(ep, 'land', cols * T, rows * T);
  const jump = CLASSES[ep.cls].base.jump;
  const jumpTiles = Math.max(2, Math.floor(((jump * jump) / (2 * GRAVITY) - 30) / T));
  const decorKinds = DECOR[ep.theme];
  const hazardOk = ep.fauna.length > 3 || ep.theme === 'reptil';
  const heights: Heights = new Array(cols).fill(17);
  const startCol = Math.floor(cols * 0.3);

  let h = 17;
  const ground = (x0: number, n: number, top: number, flat = false) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    for (let i = 1; i < n - 1; i += rint(r, 2, 4)) {
      if (r() < 0.45) L.decor.push({ k: pick(r, decorKinds), x: (x0 + i + r()) * T, y: top * T + 4 });
    }
    // fressbare Pflanzen
    if (n >= 4) {
      const cnt = (r() < ep.plants * 0.75 ? 1 : 0) + (r() < ep.plants * 0.4 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1.5 + r() * (n - 3)) * T, y: top * T + 2 });
    }
    // Dickicht
    if (n >= 6 && r() < ep.cover * (flat ? 0.8 : 0.6)) {
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
      if (r() < ep.plants * 0.5) L.plants.push({ x: (px + pw / 2) * T, y: (h - jumpTiles) * T + 2 });
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
  placeFauna(L, ep, r, cols, heights, false, sc);
  L.ground = heights.map((v) => v * T);
  return L;
}

// ---------------------------------------------------------------------------

function genWater(ep: EpochDef, r: Rng): LevelData {
  const cols = ep.len;
  const rows = 22;
  const L = base(ep, 'water', cols * T, rows * T);
  const covered = ep.dark || ep.cave;
  let floor = 19;
  const heights: Heights = new Array(cols).fill(floor);
  const kinds = ep.reef ? ['rock', 'shell', 'seaweed', 'rock'] : DECOR.ozean;
  const startCol = Math.floor(cols * 0.3);

  const floorSeg = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    for (let i = 0; i < n; i += rint(r, 1, 3)) {
      if (r() < 0.6) L.decor.push({ k: pick(r, kinds), x: (x0 + i + r()) * T, y: top * T + 6 });
    }
    if (n >= 3) {
      const cnt = (r() < ep.plants * 0.85 ? 1 : 0) + (r() < ep.plants * 0.45 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1 + r() * (n - 2)) * T, y: top * T + 4 });
    }
    if (n >= 4 && r() < ep.cover * 0.65) {
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
      if (r() < ep.plants * 0.6) L.plants.push({ x: (px + 0.5) * T, y: top * T + 4 });
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
  placeFauna(L, ep, r, cols, heights, true, startCol);
  L.ground = heights.map((v) => v * T);
  return L;
}

/** Ein Lebensraum für dieses Zeitalter – bei jedem Lauf etwas anders. */
export function generateLevel(ep: EpochDef, salt: string | number): LevelData {
  const r = mulberry32(hashStr(ep.id + '_' + salt));
  return ep.habitat === 'water' ? genWater(ep, r) : genLand(ep, r);
}
