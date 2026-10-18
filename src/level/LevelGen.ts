import { TILE } from '../config';
import { SPECIES } from '../data/species';
import type { EpochDef, Theme } from '../data/epochs';
import { gateKind, placeOf, SHAPE_OF, shellId, type CaveKind, type GateKind, type PlaceDef, type ZoneDef } from '../data/world';
import { DECOR, HEAL, TOXIC } from '../art/worldArt';
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
  /** Höhlen: durchquerbare Tunnel im Fels. Wer sie ganz durchschwimmt, kommt mit der Farbe der Höhle heraus. */
  caves: Cave[];
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
  /** Stellen an der Oberfläche, an denen Licht ins Wasser fällt – überall sonst liegt Schatten */
  lit: { x0: number; x1: number }[];
  /** Durchgänge zu den Nachbarorten */
  gates: Gate[];
}

/** Ein Durchgang: Wer hindurchschwimmt, kommt im Nachbarort an (und schaltet ihn frei). */
export interface Gate extends Rect {
  to: string;
  kind: GateKind;
  /** wo man im Ort ankommt, wenn man von dort (to) kommt */
  arrive: { x: number; y: number };
}

/** Ein Tunnel: Innenraum und die Farbe, die man beim Durchschwimmen annimmt (1 grün, 2 schwarz). */
export interface Cave extends Rect {
  coat: number;
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
    lit: [],
    gates: [],
  };
}

/** Manche Pflanzen sind giftig (etwa jede achte). */
const plantVariant = (r: Rng) => {
  const q = r();
  return q < 0.1 ? TOXIC : q < 0.18 ? HEAL : rint(r, 0, 2);
};

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

function placeFauna(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, heights: Heights, startCol: number) {
  const def = place.def;
  const cols = heights.length;
  // im tiefen Wasser leben die Jäger weiter unten
  const low = Math.max(0, Math.min(0.62, place.deep / 20));
  // Wer lebt wo? Am Start wimmelt es von kleinen Fischen, in bewachsenen Orten weiden sie in Ruhe, in der
  // Tiefe gibt es kaum noch kleine – dafür starke, große Tiere, die dort unten warten.
  const SIZE_K: Record<string, [number, number]> = { start: [0.6, 1.25], lush: [0.3, 0.85], murky: [1, 1], deep: [2.4, 0.2], abyss: [3.2, 0.05] };
  const [bigK, smallK] = SIZE_K[place.kind] ?? [1, 1];
  const vee = place.kind === 'deep' || place.kind === 'abyss';
  const put = (id: string, cx: number, deepDweller: boolean) => {
    const d = SPECIES[id];
    const n = d.herd ? rint(r, d.herd[0], d.herd[1]) : 1;
    for (let i = 0; i < n; i++) {
      const col = Math.max(0, Math.min(cols - 1, Math.floor(cx + (i - n / 2) * 1.6 + r())));
      const x = (col + 0.5) * T;
      const ground = heights[col] * T;
      const span = heights[col] - 6;
      let y: number;
      if (d.crawl) y = ground - 24;
      else if (d.layer === 'floor') y = ground - (70 + r() * 150);
      else if (d.layer === 'mid') y = (3 + span * (0.3 + r() * 0.35)) * T;
      else if (d.layer === 'open') y = (3 + span * (0.12 + r() * 0.5)) * T;
      else y = (3 + span * (deepDweller ? low + r() * (1 - low) : r())) * T;
      L.spawns.push({ id, x, y });
    }
  };
  // Jeder Ort hat seine eigene Mischung: Manche Arten fehlen fast ganz, andere sind besonders häufig (je Ort fest)
  const hash01 = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
  };
  const taste = (id: string) => {
    const key = ep.id + '/' + place.id + '/' + id;
    if (place.kind === 'start') return 0.85 + 0.3 * hash01('b' + key);
    return hash01('a' + key) < 0.25 ? 0.12 : 0.55 + 1.3 * hash01('b' + key);
  };
  for (const [id, groups] of ep.fauna) {
    const d = SPECIES[id];
    const danger = d.role === 'predator' || d.role === 'defender' || d.role === 'hazard';
    const hunter = d.role === 'predator' || d.role === 'apex';
    // je Ort anders verteilt: Wo es viel zu fressen gibt, mehr Beute – in der Tiefe mehr Jäger
    const mul = (hunter ? def.hunters : d.role === 'prey' ? def.prey : 1) * (d.where?.[place.kind] ?? 1) * taste(id);
    const sizeK = (d.role === 'predator' || d.role === 'apex' || d.role === 'defender') && d.power >= 8 ? bigK : d.role === 'prey' && d.power <= 3 ? smallK : 1;
    // die Orte sind groß: Auf die Strecke gerechnet leben hier etwas weniger Tiere als früher
    const want = groups * mul * sizeK * place.wide * 0.6 * (1 + Math.max(0, place.deep) * 0.008);
    // keine Art überschwemmt einen Ort: Räuber und Verteidiger höchstens ein halbes Dutzend Gruppen
    const count = Math.min(d.role === 'prey' || d.role === 'hazard' ? 99 : 6, Math.floor(want) + (r() < want - Math.floor(want) ? 1 : 0));
    const c0 = 4, c1 = cols - 5;
    for (let g = 0; g < count; g++) {
      // Räuber nicht direkt neben dem Ankunftsplatz
      const keep = danger ? 20 : 8;
      // Im Trichter sammeln sich die großen Jäger in der Mitte, ganz unten
      const pickCol = () => (vee && hunter && sizeK > 1 && r() < 0.7 ? Math.round(cols / 2 + (r() - 0.5) * cols * 0.45) : rint(r, c0, c1));
      let cx = pickCol();
      for (let k = 0; k < 12 && Math.abs(cx - startCol) < keep; k++) cx = pickCol();
      put(id, cx, hunter && place.deep > 0);
    }
  }
  // Im tiefsten Wasser lebt einer der ganz Großen
  const apex = ep.events.find((e) => e.species && SPECIES[e.species]?.role === 'apex')?.species;
  if (apex && place.apex) put(apex, Math.floor(cols * 0.62), true);
}

// ---------------------------------------------------------------------------

function genWater(ep: EpochDef, r: Rng, place: PlaceDef, from?: string): LevelData {
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
      if (r() < (lush ? 0.95 : 0.7)) L.decor.push({ k: lush && r() < 0.6 ? pick(r, ['seaweed', 'kelp', 'seagrass', 'seaweed']) : pick(r, kinds), x: (x0 + Math.min(n - 0.5, i + 0.25 + r() * 0.5)) * T, y: top * T + 6 });
    }
    if (n >= 3) {
      const cnt = (r() < pl * 0.9 ? 1 : 0) + (r() < pl * 0.55 ? 1 : 0) + (n >= 7 && r() < pl * 0.35 ? 1 : 0) + (n >= 5 && r() < pl - 1 ? 1 : 0);
      for (let i = 0; i < cnt; i++) L.plants.push({ x: (x0 + 1 + r() * (n - 2)) * T, y: top * T + 4, v: plantVariant(r) });
    }
    if (n >= 4 && r() < ep.cover * z.cover * (lush ? 0.85 : 0.65)) {
      const cw = rint(r, 3, Math.min(lush ? 8 : 6, n));
      const cx = x0 + rint(r, 0, n - cw);
      const ch = lush ? rint(r, 6, 10) : rint(r, 5, 7);
      L.cover.push({ x: cx * T, y: (top - ch) * T, w: cw * T, h: ch * T });
    }
  };
  const ceilSeg = (x0: number, n: number) => {
    const d = rint(r, 1, 3);
    L.solids.push({ x: x0 * T, y: -200, w: n * T, h: d * T + 200 });
  };

  // Jeder Ort hat seine eigene Form: eine Mulde (Start), eine flache Wiese (bewachsen), Hügelketten (trüb), ein Trichter
  // in V-Form (tief) oder ein Schacht zwischen zwei Rändern (Abgrund). Wer hineinschwimmt, wird von Stufe zu Stufe
  // tiefer und dunkler.
  const shape = place.shape ?? SHAPE_OF[place.kind];
  const vee = shape === 'vee' || shape === 'well';
  const mid = (cols - 1) / 2;
  const lowest = rows - 4;
  const floor0 = 27 + extra;
  const TAU = Math.PI * 2;
  let prof: ((col: number) => number) | null = null;
  if (shape === 'vee') {
    const rim = 21;
    const steep = place.kind === 'abyss' ? 0.8 : 0.95;
    prof = (col) => Math.round(rim + (lowest - rim) * Math.pow(Math.max(0, 1 - Math.abs(col - mid) / (mid * 0.93)), steep));
  } else if (shape === 'well') {
    // breite Ränder, dazwischen ein Schacht, der steil nach unten führt
    const rim = 21;
    prof = (col) => {
      const t = Math.max(0, 1 - Math.abs(col - mid) / (mid * 0.5));
      return Math.round(rim + (lowest - rim) * Math.pow(t, 0.6));
    };
  } else if (shape === 'bowl') {
    // eine Mulde, deren tiefste Stelle nicht genau in der Mitte liegt – ein Ufer fällt sanfter ab als das andere
    const rim = floor0 - 8, bot = lowest;
    const c0 = mid + (r() - 0.5) * cols * 0.3;
    prof = (col) => {
      const u = Math.min(1, Math.abs(col - c0) / (col < c0 ? c0 : cols - c0));
      return Math.round(rim + (bot - rim) * (1 - Math.pow(u, 1.6)));
    };
  } else if (shape === 'ridges') {
    const ph = r() * TAU, ph2 = r() * TAU;
    prof = (col) => clampN(Math.round(floor0 - 2 + 4.6 * Math.sin((col * TAU) / 31 + ph) + 2.2 * Math.sin((col * TAU) / 12 + ph2)), floor0 - 8, lowest);
  }
  if (prof) {
    let vx = 0;
    while (vx < cols) {
      const seg = Math.min(cols - vx, rint(r, 5, 9));
      const fl = prof(vx + Math.floor(seg / 2));
      floorSeg(vx, seg, fl);
      if (r() < (vee ? 0.3 : 0.26) && seg >= 4 && Math.abs(vx - startCol) > 6) {
        const px = vx + rint(r, 1, seg - 2);
        // nur niedrige Felsbuckel – nichts, was das Wasser versperrt
        const top = fl - rint(r, 1, 3);
        L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (fl - top) * T + 2 });
      }
      if (r() < 0.14 && Math.abs(vx - startCol) > 6) L.solids.push({ x: (vx + 1) * T, y: rint(r, 8, Math.max(9, fl - 6)) * T, w: rint(r, 2, 4) * T, h: T });
      vx += seg;
    }
    floor = heights[Math.floor(cols / 2)];
  }
  if (!prof) floorSeg(0, 10, floor);
  if (covered) ceilSeg(0, 10);
  let x = prof ? cols : 10;
  // flache Wiese: der Boden steigt und fällt kaum
  const lo = floor - 1, hi = floor + 1;
  while (x < cols - 10) {
    const seg = rint(r, 6, 12);
    const nearStart = x >= startCol - 5 && x < startCol + 5;
    if (!nearStart && r() < 0.5) floor = Math.max(lo, Math.min(hi, floor + pick(r, [-1, 1])));
    floorSeg(x, seg, floor);
    if (covered) ceilSeg(x, seg);
    if (!nearStart && r() < 0.28) {
      const px = x + rint(r, 1, seg - 2);
      const top = floor - rint(r, 1, 3);
      L.solids.push({ x: px * T, y: top * T, w: T * rint(r, 1, 2), h: (floor - top) * T + 2 });
      if (r() < ep.plants * zoneAt().plants * 0.6) L.plants.push({ x: (px + 0.5) * T, y: top * T + 4, v: plantVariant(r) });
    }
    if (!nearStart && r() < 0.12) {
      const rw = rint(r, 2, 4);
      const ry = rint(r, 8, floor - 6);
      L.solids.push({ x: (x + 1) * T, y: ry * T, w: rw * T, h: T });
    }
    x += seg;
  }
  if (!prof) floorSeg(x, cols - x, floor);
  if (covered) ceilSeg(x, cols - x);
  L.solids.push({ x: -T, y: -400, w: T, h: rows * T + 800 });
  L.solids.push({ x: cols * T, y: -400, w: T, h: rows * T + 800 });
  L.start = { x: (startCol + 0.5) * T, y: 12 * T };
  if (!covered) {
    addTunnels(L, place.caves, r, cols, heights, startCol);
  }
  addCrevices(L, 2, r, cols, heights, startCol);
  addCurrents(L, r, cols, heights, startCol);
  if (L.surfaceY > 0) placeSun(L, place.sun, r, cols, startCol);
  addGates(L, ep, place, r, cols, heights, startCol);
  placeShells(L, ep, place, r, heights, startCol);
  // Wer durch einen Durchgang kommt, taucht dort auf – Räuber halten Abstand zu dieser Stelle
  const arrive = from ? L.gates.find((g) => g.to === from)?.arrive : undefined;
  const arrCol = arrive ? Math.floor(arrive.x / T) : startCol;
  placeFauna(L, ep, place, r, heights, arrCol);
  if (arrive) L.start = { x: arrive.x, y: arrive.y };
  // Am Ankunftsplatz soll man sein Tier sehen: kein Dickicht direkt dort
  L.cover = L.cover.filter((c) => c.x > (startCol + 9) * T || c.x + c.w < (startCol - 5) * T);
  // keine Tiere im Fels (Felsplatten, Säulen)
  for (const sp of L.spawns) {
    for (const s of L.solids) {
      if (s.y > 0 && s.h < 200 && sp.x > s.x - 20 && sp.x < s.x + s.w + 20 && sp.y > s.y - 40 && sp.y < s.y + s.h + 40) sp.y = Math.max(L.surfaceY + 60, s.y - 60);
    }
  }
  // keine Tiere im Fels der Tunnel (das Dach reicht vier Kacheln über den Gang)
  for (const sp of L.spawns) {
    for (const c of L.caves) if (sp.x > c.x - 2 * T && sp.x < c.x + c.w + 2 * T && sp.y > c.y - 5 * T) sp.y = c.y - 5 * T - 30;
  }
  L.ground = heights.map((v) => v * T);
  return L;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Stellen an der Oberfläche, an denen Licht ins Wasser fällt (eine davon beim Ankunftsplatz). */
function placeSun(L: LevelData, n: number, r: Rng, cols: number, startCol: number) {
  const free = (c0: number, w: number) => !L.lit.some((l) => c0 * T < l.x1 + 6 * T && (c0 + w) * T > l.x0 - 6 * T);
  for (let k = 0; k < 80 && L.lit.length < n; k++) {
    const w = rint(r, 9, 18);
    const c0 = L.lit.length === 0 ? clampN(startCol - rint(r, 2, w - 2), 2, cols - w - 2) : rint(r, 2, cols - w - 2);
    if (free(c0, w)) L.lit.push({ x0: c0 * T, x1: (c0 + w) * T });
  }
}

/**
 * Höhlen: durchquerbare Tunnel im Fels – drei Kacheln hoch, an beiden Enden offen. Wer einen Tunnel ganz durchschwimmt,
 * kommt auf der anderen Seite mit der Farbe der Höhle heraus (grün bzw. schwarz). Der Boden wird dort eingeebnet.
 */
function addTunnels(L: LevelData, kinds: CaveKind[], r: Rng, cols: number, heights: Heights, startCol: number) {
  const used: { c0: number; c1: number }[] = [];
  kinds.forEach((kind, idx) => {
    for (let k = 0; k < 500; k++) {
      const W = rint(r, 11, 15);
      // die erste Höhle nicht weit vom Ankunftsplatz, damit man sie findet
      const off = rint(r, 9, 26);
      const c0 = idx === 0 && k < 150 ? (r() < 0.5 ? startCol + off : startCol - off - W) : rint(r, 6, cols - W - 6);
      if (c0 < 6 || c0 + W > cols - 6) continue;
      if ((idx > 0 || k >= 150) && Math.abs(c0 + W / 2 - startCol) < 12) continue;
      if (used.some((u) => c0 < u.c1 + 8 && c0 + W > u.c0 - 8)) continue;
      let lo = Infinity, hi = -Infinity;
      for (let i = c0 - 2; i < c0 + W + 2; i++) {
        lo = Math.min(lo, heights[i]);
        hi = Math.max(hi, heights[i]);
      }
      if (hi - lo > (k < 200 ? 3 : 5) || lo < 14) continue;
      const f = lo;
      const rx0 = (c0 - 2) * T, rx1 = (c0 + W + 2) * T, ry0 = (f - 9) * T, ry1 = f * T;
      // Säulen und Platten über dem Gang werden abgetragen
      L.solids = L.solids.filter((s) => !(s.x > -T && s.x < cols * T && s.x < rx1 && s.x + s.w > rx0 && s.y < ry1 - 2 && s.y + s.h > ry0));
      // einebnen: tiefer liegende Spalten bis zur Höhe des höchsten Punkts auffüllen
      for (let i = c0 - 2; i < c0 + W + 2; i++) {
        if (heights[i] > f) L.solids.push({ x: i * T, y: f * T, w: T, h: (heights[i] - f) * T + 2 });
        heights[i] = f;
      }
      const x0 = c0 * T, x1 = (c0 + W) * T;
      // Dach (vier Kacheln dick) und zwei Stufen an jedem Ende – wie ein Fels, der über den Gang ragt
      L.solids.push({ x: x0, y: (f - 7) * T, w: W * T, h: 4 * T });
      L.solids.push({ x: x0 - T, y: (f - 6) * T, w: T, h: 3 * T });
      L.solids.push({ x: x0 - 2 * T, y: (f - 5) * T, w: T, h: 2 * T });
      L.solids.push({ x: x1, y: (f - 6) * T, w: T, h: 3 * T });
      L.solids.push({ x: x1 + T, y: (f - 5) * T, w: T, h: 2 * T });
      L.caves.push({ x: x0, y: (f - 3) * T, w: W * T, h: 3 * T, coat: kind === 'g' ? 1 : 2 });
      used.push({ c0, c1: c0 + W });
      // Bewuchs auf dem Dach
      for (let i = 0; i < W; i++) if (r() < 0.45) L.decor.push({ k: pick(r, ['seaweed', 'anemone', 'sponge', 'seagrass']), x: x0 + (i + 0.5) * T, y: (f - 7) * T + 4 });
      // nichts im Fels und im Gang
      const inside = (px: number) => px > rx0 && px < rx1;
      L.plants = L.plants.filter((p) => !inside(p.x));
      L.cover = L.cover.filter((c) => !(c.x < rx1 && c.x + c.w > rx0));
      L.decor = L.decor.filter((d) => !inside(d.x) || d.y < (f - 8) * T);
      // Die Eingänge liegen hinter dichtem Bewuchs – man muss genau hinsehen
      for (const side of [-1, 1]) {
        const bx = side < 0 ? x0 - 4 * T : x1 + T;
        L.cover.push({ x: bx, y: (f - 7) * T, w: 3 * T, h: 7 * T });
      }
      break;
    }
  });
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

/**
 * Durchgänge zu den Nachbarorten. Westen und Osten: eine Öffnung in der Felswand an einer bestimmten Höhe. Süden: ein Loch
 * im Boden. Norden: eine Lichtöffnung an der Oberfläche. Man muss sie finden – nur dort kommt man hinaus.
 */
function addGates(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, cols: number, heights: Heights, startCol: number) {
  const rows = L.height / T;
  const usedRows: Record<'left' | 'right', number[]> = { left: [], right: [] };
  const usedCols: number[] = [];
  let sun = 0;
  // Öffnungen räumen alles ab, was im Weg steht (Säulen, Platten)
  const clear = (x0: number, y0: number, x1: number, y1: number) => {
    L.solids = L.solids.filter((s) => !(s.x > -T && s.x < cols * T && s.x < x1 && s.x + s.w > x0 && s.y < y1 && s.y + s.h > y0 && s.y + s.h < rows * T - 2 * T));
    L.plants = L.plants.filter((p) => !(p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 + T));
  };
  const wall = (kind: 'left' | 'right', to: string) => {
    const idx = kind === 'left' ? [0, 1, 2, 3, 4, 5] : [cols - 6, cols - 5, cols - 4, cols - 3, cols - 2, cols - 1];
    const hEdge = Math.min(...idx.map((i) => heights[i]));
    const lo = 6, hi = Math.max(lo + 1, hEdge - 7);
    let row = rint(r, lo, hi);
    for (let k = 0; k < 40; k++) {
      row = rint(r, lo, hi);
      if (usedRows[kind].every((u) => Math.abs(u - row) >= 8)) break;
    }
    usedRows[kind].push(row);
    const x = kind === 'left' ? 0 : (cols - 3) * T;
    clear(kind === 'left' ? 0 : (cols - 10) * T, (row - 1) * T, kind === 'left' ? 10 * T : cols * T, (row + 5) * T);
    L.gates.push({ x, y: row * T, w: 3 * T, h: 4 * T, to, kind, arrive: { x: kind === 'left' ? 7 * T : (cols - 7) * T, y: (row + 2) * T } });
  };
  for (const lid of place.links) {
    const q = placeOf(ep, lid);
    let kind = gateKind(place, q);
    if (kind === 'surface' && !L.lit.length) kind = 'left';
    if (kind === 'surface') {
      const lit = L.lit[sun % L.lit.length];
      const nth = Math.floor(sun++ / L.lit.length);
      const x = Math.round(((lit.x0 + lit.x1) / 2 + (nth % 2 ? 1 : -1) * nth * 5 * T) / T) * T - 2 * T;
      clear(x - T, L.surfaceY, x + 5 * T, L.surfaceY + 7 * T);
      L.gates.push({ x, y: L.surfaceY, w: 4 * T, h: 4 * T, to: lid, kind, arrive: { x: x + 2 * T, y: L.surfaceY + 7 * T } });
    } else if (kind === 'floor') {
      let done = false;
      for (let k = 0; k < 400 && !done; k++) {
        const c = rint(r, 8, cols - 14);
        const f = heights[c];
        let flat = true;
        for (let i = -1; i <= 5; i++) if (heights[c + i] !== f) flat = false;
        if (!flat || Math.abs(c + 2 - startCol) < 12 || usedCols.some((u) => Math.abs(u - c) < 14) || L.caves.some((cv) => c * T < cv.x + cv.w + 4 * T && (c + 4) * T > cv.x - 4 * T)) continue;
        if (f < 12) continue;
        usedCols.push(c);
        clear(c * T - T, (f - 7) * T, (c + 5) * T, f * T);
        L.gates.push({ x: c * T, y: f * T - 80, w: 4 * T, h: 100, to: lid, kind, arrive: { x: (c + 2) * T, y: f * T - 150 } });
        done = true;
      }
      if (!done) wall(q.x < place.x ? 'left' : 'right', lid);
    } else wall(kind, lid);
  }
}

/** Ein Ort dieses Zeitalters – bei jedem Lauf etwas anders, aber immer derselbe für einen Lauf. */
export function generateLevel(ep: EpochDef, salt: string | number, place: PlaceDef, from?: string): LevelData {
  const r = mulberry32(hashStr(`${ep.id}_${place.id}_${salt}`));
  return genWater(ep, r, place, from);
}
