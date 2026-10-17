import { TILE } from '../config';
import { SPECIES } from '../data/species';
import type { EpochDef, Theme } from '../data/epochs';
import { shellId, type PlaceDef, type ZoneDef } from '../data/world';
import { DECOR, TOXIC } from '../art/worldArt';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng } from '../util/math';

// Jedes Zeitalter hat mehrere Orte (siehe data/world.ts). Ein Ort ist ein Stück Meer, das man in
// beide Richtungen durchstreifen kann – an seinen Rändern geht es zurück auf die Karte. Er wird für
// jeden Lauf aus einer Saat erzeugt (derselbe Ort sieht beim Wiederkommen gleich aus): Gelände,
// Pflanzen, Dickicht zum Verstecken, Höhlen, Muscheln und die Tiere (in Herden, Räuber abseits).

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
  /** der Ort (ein Gebiet über die ganze Breite) */
  zones: Zone[];
  /** Muscheln: Kennung und Lage */
  shells: { id: string; x: number; y: number }[];
  /** Kachelspalte, in der man ankommt */
  startCol: number;
  /** Strömungen im Wasser (dir: Richtung, -1 oder 1) */
  currents: (Rect & { dir: number })[];
  /** Felsspalten: niedrige Durchgänge unter einer Felsplatte – nur Schlanke passen hindurch */
  crevices: Rect[];
}

export interface Zone {
  x0: number;
  x1: number;
  def: ZoneDef;
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
    shells: [],
    startCol: 0,
    currents: [],
    crevices: [],
  };
}

/** Manche Pflanzen sind giftig (etwa jede achte). */
const plantVariant = (r: Rng) => (r() < 0.12 ? TOXIC : rint(r, 0, 2));

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

function placeFauna(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, heights: Heights, startCol: number) {
  const def = place.def;
  const cols = heights.length;
  // im tiefen Wasser leben die Jäger weiter unten
  const low = Math.min(0.62, place.deep / 20);
  const put = (id: string, cx: number, deepDweller: boolean) => {
    const d = SPECIES[id];
    const n = d.herd ? rint(r, d.herd[0], d.herd[1]) : 1;
    for (let i = 0; i < n; i++) {
      const col = Math.max(0, Math.min(cols - 1, Math.floor(cx + (i - n / 2) * 1.6 + r())));
      const x = (col + 0.5) * T;
      const ground = heights[col] * T;
      const span = heights[col] - 6;
      const y = d.crawl ? ground - 24 : (3 + span * (deepDweller ? low + r() * (1 - low) : r())) * T;
      L.spawns.push({ id, x, y });
    }
  };
  for (const [id, groups] of ep.fauna) {
    const d = SPECIES[id];
    const danger = d.role === 'predator' || d.role === 'defender' || d.role === 'hazard';
    const hunter = d.role === 'predator' || d.role === 'apex';
    // je Ort anders verteilt: Wo es viel zu fressen gibt, mehr Beute – in der Tiefe mehr Jäger
    const mul = hunter ? def.hunters : d.role === 'prey' ? def.prey : 1;
    const want = groups * mul * place.wide * (1 + place.deep * 0.015);
    const count = Math.floor(want) + (r() < want - Math.floor(want) ? 1 : 0);
    const c0 = 4, c1 = cols - 5;
    for (let g = 0; g < count; g++) {
      // Räuber nicht direkt neben dem Ankunftsplatz
      const keep = danger ? 20 : 8;
      let cx = rint(r, c0, c1);
      for (let k = 0; k < 12 && Math.abs(cx - startCol) < keep; k++) cx = rint(r, c0, c1);
      put(id, cx, hunter && place.deep > 0);
    }
  }
  // Im tiefsten Wasser lebt einer der ganz Großen
  const apex = ep.events.find((e) => e.species && SPECIES[e.species]?.role === 'apex')?.species;
  if (apex && place.apex) put(apex, Math.floor(cols * 0.62), true);
}

// ---------------------------------------------------------------------------

function genWater(ep: EpochDef, r: Rng, place: PlaceDef): LevelData {
  const cols = Math.round(ep.len * place.wide);
  const extra = place.deep;
  // das Meer ist tief: Unten wird es dunkel, oben fällt das Licht herein
  const rows = 31 + extra;
  const L = base(ep, 'water', cols * T, rows * T);
  L.zones = [{ x0: 0, x1: cols * T, def: place.def }];
  const zoneAt = () => place.def;
  const covered = ep.dark || ep.cave;
  let floor = 27 + extra;
  const heights: Heights = new Array(cols).fill(floor);
  const kinds = ep.reef ? ['rock', 'shell', 'seaweed', 'coral', 'coral', 'sponge', 'anemone'] : DECOR.ozean;
  // Man kommt links an, aber nicht am Rand – zurück zur Karte geht es bewusst am Ende
  const startCol = Math.round(cols * 0.16);
  L.startCol = startCol;

  const floorSeg = (x0: number, n: number, top: number) => {
    L.solids.push({ x: x0 * T, y: top * T, w: n * T, h: (rows - top) * T + 200 });
    for (let i = 0; i < n; i++) heights[Math.min(cols - 1, x0 + i)] = top;
    const z = zoneAt();
    const pl = ep.plants * z.plants;
    // bewachsene Orte: dichter und mit viel Tang
    const lush = place.kind === 'lush';
    for (let i = 0; i < n; i += rint(r, 1, 2)) {
      if (r() < (lush ? 0.95 : 0.7)) L.decor.push({ k: lush && r() < 0.5 ? 'seaweed' : pick(r, kinds), x: (x0 + Math.min(n - 0.5, i + 0.25 + r() * 0.5)) * T, y: top * T + 6 });
    }
    if (n >= 3) {
      const cnt = (r() < pl * 0.9 ? 1 : 0) + (r() < pl * 0.55 ? 1 : 0) + (n >= 7 && r() < pl * 0.35 ? 1 : 0) + (n >= 5 && r() < pl - 1 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1 + r() * (n - 2)) * T, y: top * T + 4, v: plantVariant(r) });
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
    if (!nearStart && r() < 0.5) floor = Math.max(24 + extra, Math.min(29 + extra, floor + pick(r, [-1, 1, 2, -2])));
    floorSeg(x, seg, floor);
    if (covered) ceilSeg(x, seg);
    if (!nearStart && r() < 0.28) {
      const px = x + rint(r, 1, seg - 2);
      const top = floor - rint(r, 3, 9 + Math.floor(extra / 2));
      L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (floor - top) * T + 2 });
      if (r() < ep.plants * zoneAt().plants * 0.6) L.plants.push({ x: (px + 0.5) * T, y: top * T + 4, v: plantVariant(r) });
    }
    if (!nearStart && r() < 0.18 + (extra ? 0.12 : 0)) {
      const rw = rint(r, 2, 4);
      const ry = rint(r, 8, floor - 6);
      L.solids.push({ x: (x + 1) * T, y: ry * T, w: rw * T, h: T });
    }
    x += seg;
  }
  floorSeg(x, cols - x, floor);
  if (covered) ceilSeg(x, cols - x);
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  L.start = { x: (startCol + 0.5) * T, y: 12 * T };
  if (ep.caves && !covered) addCaves(L, ep.caves + 2, r, cols, heights, startCol);
  addCrevices(L, 3, r, cols, heights, startCol);
  addCurrents(L, r, cols, heights, startCol);
  placeShells(L, ep, place, r, heights, startCol);
  placeFauna(L, ep, place, r, heights, startCol);
  // Am Ankunftsplatz soll man sein Tier sehen: kein Dickicht direkt dort
  L.cover = L.cover.filter((c) => c.x > (startCol + 9) * T || c.x + c.w < (startCol - 5) * T);
  // keine Tiere im Fels (Felsplatten, Säulen)
  for (const sp of L.spawns) {
    for (const s of L.solids) {
      if (s.y > 0 && s.h < 200 && sp.x > s.x - 20 && sp.x < s.x + s.w + 20 && sp.y > s.y - 40 && sp.y < s.y + s.h + 40) sp.y = Math.max(L.surfaceY + 60, s.y - 60);
    }
  }
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

/**
 * Felsspalten: Eine Felsplatte liegt knapp über dem Grund. Darunter bleibt ein niedriger Durchgang,
 * in den große Jäger nicht hineinkommen – und wer selbst zu massig ist, auch nicht.
 */
function addCrevices(L: LevelData, n: number, r: Rng, cols: number, heights: Heights, startCol: number) {
  const W = 6;
  for (let k = 0; k < 80 && L.crevices.length < n; k++) {
    const c0 = rint(r, 6, cols - W - 6);
    if (Math.abs(c0 - startCol) < 12) continue;
    const f = heights[c0];
    let flat = true;
    for (let i = -1; i <= W; i++) if (heights[c0 + i] !== f) flat = false;
    if (!flat) continue;
    const x0 = c0 * T, x1 = (c0 + W) * T;
    const gap = 34 + Math.floor(r() * 7);
    const slabY = f * T - gap - 2 * T;
    const busy = (x: number, w: number) => L.solids.some((s) => s.x < x + w && s.x + s.w > x && s.y < f * T && s.y + s.h > slabY - T && s.y > 0)
      || L.caves.some((c) => c.x < x + w + 2 * T && c.x + c.w > x - 2 * T) || L.crevices.some((c) => c.x < x + w + 4 * T && c.x + c.w > x - 4 * T);
    if (busy(x0, x1 - x0)) continue;
    L.solids.push({ x: x0, y: slabY, w: W * T, h: 2 * T });
    L.crevices.push({ x: x0, y: f * T - gap, w: W * T, h: gap });
  }
  // nichts in den Durchgang stellen
  const inside = (x: number, y: number) => L.crevices.some((c) => x > c.x - 20 && x < c.x + c.w + 20 && y > c.y - 2 * T - 10 && y <= c.y + c.h + 8);
  L.plants = L.plants.filter((p) => !inside(p.x, p.y - 10));
  L.decor = L.decor.filter((d) => !inside(d.x, d.y - 4));
  L.cover = L.cover.filter((c) => !L.crevices.some((cv) => c.x < cv.x + cv.w + T && c.x + c.w > cv.x - T));
}

/** Strömungen im freien Wasser: Kleine werden mitgerissen, Massige schwimmen dagegen an. */
function addCurrents(L: LevelData, r: Rng, cols: number, heights: Heights, startCol: number) {
  for (let k = 0; k < 30 && L.currents.length < 4; k++) {
    const w = rint(r, 9, 14) * T;
    const c0 = rint(r, 4, cols - Math.ceil(w / T) - 4);
    if (Math.abs(c0 + w / T / 2 - startCol) < 14) continue;
    const x = c0 * T;
    if (L.currents.some((c) => c.x < x + w + 6 * T && c.x + c.w > x - 6 * T)) continue;
    let floor = Infinity;
    for (let i = c0; i < c0 + w / T; i++) floor = Math.min(floor, heights[i] * T);
    const h = rint(r, 3, 4) * T;
    const y = Math.max(L.surfaceY + 2 * T, floor - h - rint(r, 3, 6) * T);
    if (y + h > floor - T) continue;
    L.currents.push({ x, y, w, h, dir: r() < 0.5 ? -1 : 1 });
  }
}

/**
 * Muscheln: Die erste liegt im ersten Gewässer direkt vor dir auf dem Grund. Die anderen sind
 * versteckt – in Höhlen, in Felsspalten oder weit draußen am Grund, in der Tiefe am weitesten weg.
 */
function placeShells(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, heights: Heights, startCol: number) {
  const cols = heights.length;
  const spots: { x: number; y: number }[] = [];
  for (const c of L.caves) spots.push({ x: c.x + c.w * (0.3 + r() * 0.4), y: c.y + c.h - 14 });
  for (const c of L.crevices) spots.push({ x: c.x + c.w * (0.3 + r() * 0.4), y: c.y + c.h - 12 });
  // weit draußen am Grund: nur dort, wo der Boden eben ist
  for (let k = 0; k < 60 && spots.length < 10; k++) {
    const col = rint(r, 6, cols - 8);
    if (Math.abs(col - startCol) < 24) continue;
    if (heights[col] !== heights[col - 1] || heights[col] !== heights[col + 1]) continue;
    const x = (col + 0.5) * T, y = heights[col] * T - 14;
    if (L.solids.some((s) => s.y > 0 && s.h < 200 && x > s.x - 30 && x < s.x + s.w + 30 && y > s.y - 40 && y < s.y + s.h + 20)) continue;
    spots.push({ x, y });
  }
  // sortieren: draußen, tief unten zuletzt – so liegen die Muscheln in Tiefen weiter weg
  const tutorial = ep.id === 'ordovizium' && place.kind === 'start';
  for (let k = 0; k < place.shells; k++) {
    let at: { x: number; y: number } | undefined;
    if (k === 0 && tutorial) {
      // Du beginnst knapp über dem Grund – und direkt vor dir schimmert etwas
      at = { x: (startCol + 4.5) * T, y: heights[startCol + 4] * T - 14 };
      L.start.y = Math.max(L.surfaceY + 160, heights[startCol] * T - 190);
    }
    else {
      const i = Math.floor(r() * spots.length);
      at = spots.splice(i, 1)[0];
    }
    if (at) L.shells.push({ id: shellId(ep.id, place.id, k), x: at.x, y: at.y });
  }
}

/** Ein Ort dieses Zeitalters – bei jedem Lauf etwas anders, aber immer derselbe für einen Lauf. */
export function generateLevel(ep: EpochDef, salt: string | number, place: PlaceDef): LevelData {
  const r = mulberry32(hashStr(`${ep.id}_${place.id}_${salt}`));
  return genWater(ep, r, place);
}
