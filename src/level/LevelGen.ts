import { TILE, GRAVITY } from '../config';
import { CLASSES } from '../data/classes';
import { SPECIES } from '../data/species';
import type { EraDef, NodeDef, Theme } from '../data/eras';
import { DECOR } from '../art/worldArt';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng } from '../util/math';

// Die Level werden aus einer festen Saat erzeugt: Jeder Ort sieht bei jedem
// Besuch gleich aus. Neben Gelände entstehen Pflanzen, Dickicht zum Verstecken
// und die Tiere des Ortes (in Herden, Räuber weiter hinten).

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
  exit: { x: number; y: number };
  territory?: { x0: number; x1: number; floor: number };
  apex?: Spawn;
}

const T = TILE;

function base(era: EraDef, node: NodeDef, mode: 'water' | 'land', width: number, height: number): LevelData {
  return {
    mode,
    theme: era.id,
    variant: node.cave ? 'cave' : node.dark ? 'dark' : 'normal',
    width,
    height,
    surfaceY: mode === 'water' && !node.cave && !node.dark ? 56 : 0,
    solids: [],
    platforms: [],
    hazards: [],
    plants: [],
    cover: [],
    spawns: [],
    decor: [],
    start: { x: 0, y: 0 },
    exit: { x: 0, y: 0 },
  };
}

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

function placeFauna(L: LevelData, node: NodeDef, r: Rng, cols: number, heights: Heights, water: boolean, avoid: [number, number] | null) {
  for (const [id, groups] of node.fauna) {
    const d = SPECIES[id];
    for (let g = 0; g < groups; g++) {
      const predator = d.role === 'predator' || d.role === 'defender';
      const minX = predator ? 30 : 16;
      let cx = rint(r, minX, cols - 12);
      if (avoid && cx > avoid[0] && cx < avoid[1]) cx = r() < 0.5 ? avoid[0] - rint(r, 2, 6) : avoid[1] + rint(r, 2, 6);
      cx = Math.max(minX, Math.min(cols - 12, cx));
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

function genLand(era: EraDef, node: NodeDef, r: Rng): LevelData {
  const cols = node.len ?? 110;
  const rows = 22;
  const L = base(era, node, 'land', cols * T, rows * T);
  const jump = CLASSES[era.cls].base.jump;
  const jumpTiles = Math.max(2, Math.floor(((jump * jump) / (2 * GRAVITY) - 30) / T));
  const decorKinds = DECOR[era.id];
  const boss = !!node.boss;
  const terr: [number, number] | null = boss ? [Math.floor(cols * 0.25), Math.floor(cols * 0.82)] : null;
  const hazardOk = !boss && (node.fauna.length > 3 || era.id === 'reptil');
  const heights: Heights = new Array(cols).fill(17);

  let h = 17;
  const ground = (x0: number, n: number, top: number, flat = false) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    for (let i = 1; i < n - 1; i += rint(r, 2, 4)) {
      if (r() < 0.45) L.decor.push({ k: pick(r, decorKinds), x: (x0 + i + r()) * T, y: top * T + 4 });
    }
    // fressbare Pflanzen
    if (n >= 4) {
      const cnt = (r() < node.plants * 0.7 ? 1 : 0) + (r() < node.plants * 0.35 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1.5 + r() * (n - 3)) * T, y: top * T + 2 });
    }
    // Dickicht
    if (n >= 6 && r() < node.cover * (flat ? 0.8 : 0.55)) {
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
      L.decor.push({ k: era.id === 'eis' ? 'stalactite_ice' : 'stalactite', x: (x0 + i + r()) * T, y: d * T - 2, hang: true });
    }
  };

  ground(0, 12, h);
  if (node.cave) ceiling(0, 12);
  L.start = { x: 3 * T, y: h * T - 60 };
  let x = 12;
  let lastGap = false;
  while (x < cols - 14) {
    const inTerr = terr && x >= terr[0] - 2 && x < terr[1];
    if (inTerr) {
      // Revier des Spitzenräubers: flach und offen, mit etwas Dickicht
      const seg = Math.min(terr![1] - x, rint(r, 8, 12));
      ground(x, seg, h, true);
      x += seg;
      lastGap = false;
      continue;
    }
    if (!lastGap && x > 16 && r() < 0.2 + (node.fauna.length > 3 ? 0.08 : 0)) {
      const gap = rint(r, 2, era.cls === 'mammal' ? 4 : 3);
      if (era.id === 'reptil' || (hazardOk && r() < 0.3)) L.hazards.push({ x: x * T, y: rows * T - 30, w: gap * T, h: 60 });
      if (gap >= 3 && r() < 0.6) L.platforms.push({ x: (x + 0.5) * T, y: (h - jumpTiles + 0.3) * T, w: (gap - 1) * T, h: 20 });
      if (node.cave) ceiling(x, gap);
      for (let i = 0; i < gap; i++) heights[x + i] = rows + 4;
      x += gap;
      lastGap = true;
      continue;
    }
    const seg = rint(r, 6, 13);
    const steps = lastGap ? [0, 1, 2] : [-jumpTiles, -1, 1, 2];
    const wasGap = lastGap;
    lastGap = false;
    if (r() < 0.45 || wasGap) h = Math.max(13, Math.min(19, h + pick(r, steps)));
    ground(x, seg, h);
    if (node.cave) ceiling(x, seg);
    if (r() < 0.4 && seg >= 6) {
      const pw = rint(r, 3, 4);
      const px = x + rint(r, 1, seg - pw - 1);
      L.platforms.push({ x: px * T, y: (h - jumpTiles) * T, w: pw * T, h: 20 });
      if (r() < node.plants * 0.5) L.plants.push({ x: (px + pw / 2) * T, y: (h - jumpTiles) * T + 2 });
    }
    if (hazardOk && seg >= 8 && r() < 0.22) {
      const hx = x + rint(r, 3, seg - 4);
      L.hazards.push({ x: hx * T, y: h * T - 24, w: T * rint(r, 1, 2), h: 24 });
    }
    x += seg;
  }
  const rest = cols - x;
  ground(x, rest, h);
  if (node.cave) ceiling(x, rest);
  L.exit = { x: (cols - 3) * T, y: h * T - 90 };
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  placeFauna(L, node, r, cols, heights, false, terr);
  if (boss && terr) {
    const mid = Math.floor((terr[0] + terr[1]) / 2);
    L.territory = { x0: terr[0] * T, x1: terr[1] * T, floor: heights[mid] * T };
    L.apex = { id: node.boss!, x: mid * T, y: heights[mid] * T - 160 };
  }
  return L;
}

// ---------------------------------------------------------------------------

function genWater(era: EraDef, node: NodeDef, r: Rng): LevelData {
  const cols = node.len ?? 100;
  const rows = 22;
  const L = base(era, node, 'water', cols * T, rows * T);
  const covered = node.dark || node.cave;
  const boss = !!node.boss;
  const terr: [number, number] | null = boss ? [Math.floor(cols * 0.25), Math.floor(cols * 0.85)] : null;
  let floor = 19;
  const heights: Heights = new Array(cols).fill(floor);
  const kinds = node.reef ? ['rock', 'shell', 'seaweed', 'rock'] : DECOR.ozean;

  const floorSeg = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    for (let i = 0; i < n; i += rint(r, 1, 3)) {
      if (r() < 0.6) L.decor.push({ k: pick(r, kinds), x: (x0 + i + r()) * T, y: top * T + 6 });
    }
    if (n >= 3) {
      const cnt = (r() < node.plants * 0.8 ? 1 : 0) + (r() < node.plants * 0.4 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1 + r() * (n - 2)) * T, y: top * T + 4 });
    }
    if (n >= 4 && r() < node.cover * 0.6) {
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
  L.start = { x: 3 * T, y: 9 * T };
  let x = 10;
  while (x < cols - 10) {
    const seg = rint(r, 5, 10);
    const inTerr = terr && x >= terr[0] && x < terr[1];
    if (!inTerr && r() < 0.5) floor = Math.max(16, Math.min(20, floor + pick(r, [-1, 1, 2, -2])));
    floorSeg(x, seg, floor);
    if (covered) ceilSeg(x, seg);
    if (!inTerr && r() < 0.28) {
      const px = x + rint(r, 1, seg - 2);
      const top = floor - rint(r, 3, 7);
      L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (floor - top) * T + 2 });
      if (r() < node.plants * 0.6) L.plants.push({ x: (px + 0.5) * T, y: top * T + 4 });
    }
    if (!inTerr && r() < 0.18) {
      const rw = rint(r, 2, 4);
      const ry = rint(r, 6, 11);
      L.solids.push({ x: (x + 1) * T, y: ry * T, w: rw * T, h: T });
    }
    x += seg;
  }
  floorSeg(x, cols - x, floor);
  if (covered) ceilSeg(x, cols - x);
  L.exit = { x: (cols - 3) * T, y: (floor - 5) * T };
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  placeFauna(L, node, r, cols, heights, true, terr);
  if (boss && terr) {
    const mid = Math.floor((terr[0] + terr[1]) / 2);
    L.territory = { x0: terr[0] * T, x1: terr[1] * T, floor: heights[mid] * T };
    L.apex = { id: node.boss!, x: mid * T, y: 9 * T };
  }
  return L;
}

export function generateLevel(era: EraDef, node: NodeDef): LevelData {
  const r = mulberry32(hashStr(node.id + '_evo2'));
  return era.habitat === 'water' ? genWater(era, node, r) : genLand(era, node, r);
}
