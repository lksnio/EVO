import { TILE, GRAVITY } from '../config';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import type { EraDef, NodeDef, Theme } from '../data/eras';
import { DECOR } from '../art/worldArt';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng, weighted } from '../util/math';

// Die Level werden aus einer festen Saat erzeugt: Jeder Ort sieht also bei
// jedem Besuch gleich aus, ohne dass man alles von Hand bauen muss.

export interface Spawn {
  id: string;
  x: number;
  y: number;
}

export interface Decor {
  k: string;
  x: number;
  y: number;
  front?: boolean;
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
  spawns: Spawn[];
  crystals: { x: number; y: number }[];
  decor: Decor[];
  start: { x: number; y: number };
  exit: { x: number; y: number } | null;
  boss?: { id: string; x: number; y: number; triggerX: number; arena: { x0: number; x1: number; floor: number } };
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
    spawns: [],
    crystals: [],
    decor: [],
    start: { x: 0, y: 0 },
    exit: null,
  };
}

function enemyY(id: string, groundTop: number, r: Rng) {
  const d = ENEMIES[id];
  if (d.air) return groundTop - T * (3 + r() * 1.5);
  return groundTop - 30;
}

// ---------------------------------------------------------------------------

function genLand(era: EraDef, node: NodeDef, r: Rng): LevelData {
  const cols = node.len ?? 110;
  const rows = 22;
  const L = base(era, node, 'land', cols * T, rows * T);
  const jump = CLASSES[era.minClass].base.jump;
  // Stufen höchstens so hoch, dass auch ein nicht ganz perfekter Sprung reicht
  const jumpTiles = Math.max(2, Math.floor(((jump * jump) / (2 * GRAVITY) - 30) / T));
  const pool = node.pool ?? {};
  const decorKinds = DECOR[era.id];
  const hazardOk = node.diff >= 0.3 || era.id === 'reptil';

  let h = 17;
  const ground = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    // Pflanzen
    for (let i = 0; i < n; i += rint(r, 2, 4)) {
      if (r() < 0.55) L.decor.push({ k: pick(r, decorKinds), x: (x0 + i + r()) * T, y: top * T + 4, front: r() < 0.12 });
    }
  };
  const ceiling = (x0: number, n: number) => {
    const d = rint(r, 2, 4);
    L.solids.push({ x: x0 * T, y: -200, w: n * T, h: d * T + 200 });
    for (let i = 0; i < n; i += rint(r, 2, 4)) {
      L.decor.push({ k: era.id === 'eis' ? 'stalactite_ice' : 'stalactite', x: (x0 + i + r()) * T, y: d * T - 2, hang: true });
    }
  };
  const addEnemy = (x: number, top: number) => {
    const id = weighted(r, pool);
    L.spawns.push({ id, x: x * T, y: enemyY(id, top * T, r) });
  };

  // Start
  ground(0, 12, h);
  if (node.cave) ceiling(0, 12);
  L.start = { x: 3 * T, y: h * T - 60 };
  let x = 12;
  let lastGap = false;
  while (x < cols - 14) {
    // Abgrund
    if (!lastGap && x > 16 && r() < 0.22 + node.diff * 0.12) {
      const gap = rint(r, 2, era.minClass === 'mammal' ? 4 : 3);
      if (era.id === 'reptil' || (hazardOk && r() < 0.3)) {
        L.hazards.push({ x: x * T, y: rows * T - 30, w: gap * T, h: 60 });
      }
      if (gap >= 3 && r() < 0.6) {
        L.platforms.push({ x: (x + 0.5) * T, y: (h - jumpTiles + 0.3) * T, w: (gap - 1) * T, h: 20 });
      }
      if (node.cave) ceiling(x, gap);
      if (r() < 0.35) L.crystals.push({ x: (x + gap / 2) * T, y: (h - jumpTiles - 0.6) * T });
      x += gap;
      lastGap = true;
      continue;
    }
    const seg = rint(r, 6, 13);
    // direkt nach einem Abgrund nur gleich hoch oder tiefer, damit jeder Sprung schaffbar bleibt
    const steps = lastGap ? [0, 1, 2] : [-jumpTiles, -1, 1, 2];
    const wasGap = lastGap;
    lastGap = false;
    if (r() < 0.45 || wasGap) h = Math.max(13, Math.min(19, h + pick(r, steps)));
    ground(x, seg, h);
    if (node.cave) ceiling(x, seg);
    // Plattformen mit Kristallen
    if (r() < 0.45 && seg >= 6) {
      const pw = rint(r, 3, 4);
      const px = x + rint(r, 1, seg - pw - 1);
      const py = h - jumpTiles;
      L.platforms.push({ x: px * T, y: py * T, w: pw * T, h: 20 });
      if (r() < 0.6) {
        if (r() < 0.5 && !node.cave) {
          const py2 = py - jumpTiles;
          L.platforms.push({ x: (px + 1) * T, y: py2 * T, w: pw * T, h: 20 });
          L.crystals.push({ x: (px + 1 + pw / 2) * T, y: py2 * T - 30 });
        } else L.crystals.push({ x: (px + pw / 2) * T, y: py * T - 30 });
      }
    }
    // Stachelfallen am Boden
    if (hazardOk && seg >= 8 && r() < 0.22 + node.diff * 0.15) {
      const hx = x + rint(r, 3, seg - 4);
      L.hazards.push({ x: hx * T, y: h * T - 24, w: T * rint(r, 1, 2), h: 24 });
    }
    // Gegner
    if (r() < 0.6 + node.diff * 0.3) addEnemy(x + seg * (0.3 + r() * 0.5), h);
    if (r() < node.diff * 0.45) addEnemy(x + seg * (0.2 + r() * 0.6), h);
    x += seg;
  }
  // Ziel
  const rest = cols - x;
  ground(x, rest, h);
  if (node.cave) ceiling(x, rest);
  L.exit = { x: (cols - 4) * T, y: h * T - 50 };
  // Wände links und rechts
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  return L;
}

// ---------------------------------------------------------------------------

function genWater(era: EraDef, node: NodeDef, r: Rng): LevelData {
  const cols = node.len ?? 100;
  const rows = 22;
  const L = base(era, node, 'water', cols * T, rows * T);
  const pool = node.pool ?? {};
  const covered = node.dark || node.cave;
  let floor = 19;
  const kinds = node.reef ? ['coral_a', 'coral_b', 'coral_a', 'anemone', 'seaweed'] : node.kelp ? ['kelp', 'seaweed', 'kelp', 'rock'] : DECOR.ozean;

  const floorSeg = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i += rint(r, 1, 3)) {
      if (r() < 0.7) L.decor.push({ k: pick(r, kinds), x: (x0 + i + r()) * T, y: top * T + 6, front: r() < 0.1 });
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
    if (r() < 0.5) floor = Math.max(16, Math.min(20, floor + pick(r, [-1, 1, 2, -2])));
    floorSeg(x, seg, floor);
    if (covered) ceilSeg(x, seg);
    // Felssäule
    if (r() < 0.28) {
      const px = x + rint(r, 1, seg - 2);
      const top = floor - rint(r, 3, 7);
      L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (floor - top) * T + 2 });
      if (r() < 0.5) L.crystals.push({ x: (px + 0.5) * T, y: top * T - 30 });
    }
    // schwebender Fels
    if (r() < 0.2) {
      const rw = rint(r, 2, 4);
      const ry = rint(r, 6, 11);
      L.solids.push({ x: (x + 1) * T, y: ry * T, w: rw * T, h: T });
      if (r() < 0.5) L.crystals.push({ x: (x + 1 + rw / 2) * T, y: ry * T - 26 });
    }
    // Gegner
    const n = (r() < 0.55 + node.diff * 0.25 ? 1 : 0) + (r() < node.diff * 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const id = weighted(r, pool);
      const ex = (x + r() * seg) * T;
      const ey = ENEMIES[id].move === 'crawl' ? floor * T - 20 : (3 + r() * (floor - 6)) * T;
      L.spawns.push({ id, x: ex, y: ey });
    }
    if (r() < 0.25) L.crystals.push({ x: (x + r() * seg) * T, y: (floor - 1) * T - 10 });
    x += seg;
  }
  floorSeg(x, cols - x, floor);
  if (covered) ceilSeg(x, cols - x);
  L.exit = { x: (cols - 4) * T, y: (floor - 4) * T };
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  return L;
}

// ---------------------------------------------------------------------------

function genBoss(era: EraDef, node: NodeDef): LevelData {
  const water = era.habitat === 'water';
  const cols = 36;
  const rows = 22;
  const L = base(era, { ...node, cave: false, dark: false }, water ? 'water' : 'land', cols * T, rows * T);
  const floor = water ? 20 : 17;
  L.solids.push({ x: 0, y: floor * T, w: cols * T, h: (rows - floor) * T + 200 });
  L.solids.push({ x: -T, y: -400, w: T * 2, h: rows * T + 800 });
  L.solids.push({ x: (cols - 1) * T, y: -400, w: T * 2, h: rows * T + 800 });
  const kinds = DECOR[era.id];
  for (let i = 2; i < cols - 2; i += 3) L.decor.push({ k: kinds[i % kinds.length], x: i * T + 10, y: floor * T + 4 });
  if (!water) {
    L.platforms.push({ x: 8 * T, y: (floor - 3) * T + 12, w: 4 * T, h: 20 });
    L.platforms.push({ x: 24 * T, y: (floor - 3) * T + 12, w: 4 * T, h: 20 });
  } else {
    L.solids.push({ x: 15 * T, y: (floor - 2) * T, w: 5 * T, h: 2 * T + 2 });
  }
  L.start = { x: 3 * T, y: water ? 10 * T : floor * T - 60 };
  L.boss = {
    id: node.boss!,
    x: 26 * T,
    y: water ? 10 * T : floor * T - 160,
    triggerX: 7 * T,
    arena: { x0: T, x1: (cols - 1) * T, floor: floor * T },
  };
  return L;
}

export function generateLevel(era: EraDef, node: NodeDef): LevelData {
  const r = mulberry32(hashStr(node.id + '_evo1'));
  if (node.boss) return genBoss(era, node);
  return era.habitat === 'water' ? genWater(era, node, r) : genLand(era, node, r);
}
