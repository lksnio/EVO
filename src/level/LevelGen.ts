import { TILE } from '../config';
import { SPECIES } from '../data/species';
import type { EpochDef, Theme } from '../data/epochs';
import { SHAPE_OF, type CaveKind, type PlaceDef, type ZoneDef } from '../data/world';
import { HEAL, TOXIC } from '../data/plants';
import { pickBio } from '../data/biota';
import { hashStr, mulberry32, pick, rint, type Rect, type Rng } from '../util/math';
import { caveRock, buildHeightfield, flatness, flatten, groundAt, groundRects, makeZones, rockBottom, rockPoly, rockSlices, slabRock, STEP, zoneAt as matAt, type RockSpec, type Terrain } from './terrain';

// Jedes Zeitalter hat mehrere Orte (siehe data/world.ts). Ein Ort ist ein Stück Meer, das man in
// beide Richtungen durchstreifen kann – an seinen Rändern geht es zurück auf die Karte. Er wird für
// jeden Lauf aus einer Saat erzeugt (derselbe Ort sieht beim Wiederkommen gleich aus): Gelände,
// Pflanzen, Dickicht zum Verstecken, Höhlen, Muscheln und die Tiere (in Herden, Räuber abseits).

export interface Spawn {
  id: string;
  x: number;
  y: number;
  /** Schwarm bzw. Rudel, zu dem das Tier gehört */
  herd?: number;
  /** Elternteil, das über das Gelege mit dieser Nummer wacht */
  guard?: number;
}

/** Ein Gelege (Fischlaich) am Boden. */
export interface RoeSpot {
  x: number;
  y: number;
  /** welche Art dort laicht ('own' = deine eigene Brut am Start) */
  species: string;
  tone: number;
  own: boolean;
}

/** Eine Mikrobenmatte auf dem Boden von x0 bis x1; tone: 0 olivgrün, 1 purpurbraun, 2 rosa, 3 ocker. */
export interface MatSpec {
  x0: number;
  x1: number;
  tone: number;
  seed: number;
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
  /** Hitboxen der Felsen, Bögen und Platten (gezeichnet werden sie über rocks) – der Boden selbst steht in groundRects */
  solids: Rect[];
  /** der Boden: Säulen entlang der glatten Höhenlinie (terrain.hp) */
  groundRects: Rect[];
  terrain: Terrain;
  /** Felsen auf dem Boden (die kleinen sind nur Kiesel ohne Hitbox) und große Felsen im Vordergrund, hinter denen man schwimmen kann */
  rocks: RockSpec[];
  fore: RockSpec[];
  /** Mikrobenmatten: dünne, farbige Beläge auf Sand und Schlamm (werden in den Boden gemalt) */
  mats: MatSpec[];
  platforms: Rect[];
  hazards: Rect[];
  /** fressbare Pflanzen (v = Art) */
  plants: { x: number; y: number; v: number }[];
  /** Dickicht: x, y (oben), Breite, Höhe – unten endet es am Boden */
  cover: Rect[];
  /** Höhlen im Fels: Wer bis ans hintere Ende schwimmt und wieder heraus, kommt mit der Farbe der Höhle heraus. */
  caves: Cave[];
  /** Geröll, das eine Höhle verschüttet – ein kräftiger Stoß (oder der Stoß im Schwarm) bricht es auf */
  walls: CaveWall[];
  spawns: Spawn[];
  decor: Decor[];
  start: { x: number; y: number };
  /** Bodenhöhe je Kachelspalte (in Pixeln) – für Zuwanderer und Ereignisse */
  ground: number[];
  /** der Ort (ein Gebiet über die ganze Breite) */
  zones: Zone[];
  /** die große Muschel (nur im Startgebiet): Hier betet man um mehr Ausdauer */
  shrine?: { x: number; y: number };
  /** Kachelspalte, in der man ankommt */
  startCol: number;
  /** Strömungen im Wasser (dir: Richtung, -1 oder 1) */
  currents: (Rect & { dir: number })[];
  /** Felsspalten: niedrige Durchgänge unter einer Felsplatte – nur Schlanke passen hindurch */
  crevices: Rect[];
  /** Stellen an der Oberfläche, an denen Licht ins Wasser fällt – überall sonst liegt Schatten */
  lit: { x0: number; x1: number }[];
  /** Fischlaich am Boden */
  roe: RoeSpot[];
  /** Ende des Flussabschnitts am Start (Pixel) – davor ist es still: keine Tiere, keine Durchzügler */
  riverEnd?: number;
}

/** Eine Höhle: Innenraum und die Farbe, die man darin annimmt (1 grün, 2 schwarz). */
export interface Cave extends Rect {
  coat: number;
  /** Seite der Öffnung (1 rechts, -1 links) – die andere Seite ist geschlossen */
  side: 1 | -1;
  /** Umriss des Hohlraums (Weltkoordinaten) */
  hollow: [number, number][];
}

/** Geröll in der Öffnung einer Höhle (cave: Nummer der Höhle). */
export interface CaveWall extends Rect {
  cave: number;
  /** Richtung, aus der man von außen kommt (1: von rechts, -1: von links) */
  side: 1 | -1;
  seed: number;
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
    groundRects: [],
    terrain: { hp: [], zones: [] },
    rocks: [],
    fore: [],
    mats: [],
    platforms: [],
    hazards: [],
    plants: [],
    cover: [],
    caves: [],
    walls: [],
    spawns: [],
    decor: [],
    start: { x: 0, y: 0 },
    ground: [],
    zones: [],
    startCol: 0,
    currents: [],
    crevices: [],
    lit: [],
    roe: [],
  };
}

/** Manche Pflanzen sind giftig (etwa jede achte). */
const plantVariant = (r: Rng) => {
  const q = r();
  return q < 0.1 ? TOXIC : q < 0.18 ? HEAL : rint(r, 0, 2);
};

/** Bodenhöhe (in Kacheln) für jede Spalte – damit Tiere passend platziert werden. */
type Heights = number[];

/** Der Boden beim Bauen eines Ortes: die glatte Höhenlinie und die daraus gerundeten Kachelhöhen. */
interface Ground {
  hp: number[];
  heights: Heights;
  /** Oberkante des Bodens bei x (Bildpunkte) */
  at(x: number): number;
  /** größte Höhendifferenz zwischen x0 und x1 */
  flat(x0: number, x1: number): number;
  /** den Boden zwischen x0 und x1 auf die Höhe y einebnen */
  flatten(x0: number, x1: number, y: number, blend?: number): void;
}

function makeGround(hp: number[], cols: number): Ground {
  const heights: Heights = new Array(cols).fill(0);
  const refresh = () => {
    for (let c = 0; c < cols; c++) heights[c] = Math.round((hp[2 * c] + hp[2 * c + 1]) / 2 / T);
  };
  refresh();
  return {
    hp,
    heights,
    at: (x) => groundAt(hp, x),
    flat: (x0, x1) => flatness(hp, x0, x1),
    flatten: (x0, x1, y, blend = 140) => {
      flatten(hp, x0, x1, y, blend);
      refresh();
    },
  };
}

function placeFauna(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, G: Ground, arrCols: number[], minCol = 4) {
  // im sicheren Startgebiet lebt außer der eigenen Art kein Tier
  if (place.safe) return;
  const def = place.def;
  const heights = G.heights;
  const cols = heights.length;
  // im tiefen Wasser leben die Jäger weiter unten
  const low = Math.max(0, Math.min(0.62, place.deep / 20));
  // Wer lebt wo? Am Start wimmelt es von kleinen Fischen, in bewachsenen Orten weiden sie in Ruhe, in der
  // Tiefe gibt es kaum noch kleine – dafür starke, große Tiere, die dort unten warten.
  const SIZE_K: Record<string, [number, number]> = { start: [0.6, 1.25], lush: [0.3, 0.85], murky: [1, 1], deep: [2.4, 0.2], abyss: [3.2, 0.05] };
  const [bigK, smallK] = SIZE_K[place.kind] ?? [1, 1];
  const vee = place.kind === 'deep' || place.kind === 'abyss';
  let herdNo = 0;
  const put = (id: string, cx: number, deepDweller: boolean) => {
    const d = SPECIES[id];
    const n = d.herd ? rint(r, d.herd[0], d.herd[1]) : 1;
    // wer in einer Gruppe lebt, bleibt zusammen (Schwarm bzw. Rudel)
    const herd = n > 1 ? herdNo++ : undefined;
    for (let i = 0; i < n; i++) {
      const col = Math.max(0, Math.min(cols - 1, Math.floor(cx + (i - n / 2) * 1.6 + r())));
      const x = (col + 0.5) * T;
      const ground = G.at(x);
      const span = heights[col] - 6;
      let y: number;
      if (d.crawl) y = ground - 24;
      else if (d.layer === 'floor') y = ground - (70 + r() * 150);
      else if (d.layer === 'mid') y = (3 + span * (0.3 + r() * 0.35)) * T;
      else if (d.layer === 'open') y = (3 + span * (0.12 + r() * 0.5)) * T;
      else y = (3 + span * (deepDweller ? low + r() * (1 - low) : r())) * T;
      L.spawns.push({ id, x, y, herd });
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
    // Die Zahl in der Fauna-Liste ist ein Richtwert für Tiere; je Gruppengröße ergibt das die Zahl der Schwärme bzw. Rudel.
    // Die Orte sind groß – und es soll in ihnen ordentlich wimmeln.
    const avgHerd = d.herd ? (d.herd[0] + d.herd[1]) / 2 : 1;
    // Beute etwas dichter als früher; Räuber bleiben, wie sie waren (sie wirken im Rudel ohnehin mehr)
    const dens = d.role === 'prey' || d.role === 'hazard' ? 0.75 : 0.6;
    const want = (groups * mul * sizeK * place.wide * dens * (1 + Math.max(0, place.deep) * 0.008)) / avgHerd;
    // keine Art überschwemmt einen Ort: Räuber und Verteidiger höchstens etwa neun Tiere je Art
    const count = Math.min(d.role === 'prey' || d.role === 'hazard' ? 99 : Math.max(1, Math.round(9 / avgHerd)), Math.floor(want) + (r() < want - Math.floor(want) ? 1 : 0));
    const c0 = Math.max(4, minCol), c1 = cols - 5;
    for (let g = 0; g < count; g++) {
      // Räuber nicht direkt neben einem Ankunftsplatz
      const keep = danger ? 20 : 8;
      const near = (c: number) => arrCols.some((a) => Math.abs(c - a) < keep);
      // Im Trichter sammeln sich die großen Jäger in der Mitte, ganz unten
      const pickCol = () => (vee && hunter && sizeK > 1 && r() < 0.7 ? Math.round(cols / 2 + (r() - 0.5) * cols * 0.45) : rint(r, c0, c1));
      let cx = pickCol();
      for (let k = 0; k < 12 && near(cx); k++) cx = pickCol();
      put(id, cx, hunter && place.deep > 0);
    }
  }
  // Im tiefsten Wasser lebt einer der ganz Großen
  const apex = ep.events.find((e) => e.species && SPECIES[e.species]?.role === 'apex')?.species;
  if (apex && place.apex) put(apex, Math.floor(cols * 0.62), true);
}

/**
 * Fischlaich: Am Start liegt deine eigene Brut im Fluss. Überall im Meer kleben außerdem Gelege der Bewohner am Boden,
 * und die Eltern wachen in der Nähe. Wer daran frisst, wird von ihnen (wenn sie es mitbekommen) angegriffen.
 */
function placeRoe(L: LevelData, place: PlaceDef, r: Rng, G: Ground, startCol: number, arrCols: number[], riverEndCol: number) {
  const heights = G.heights;
  const cols = heights.length;
  const rocky = (c: number) => L.solids.some((q) => (c + 0.5) * T > q.x - 50 && (c + 0.5) * T < q.x + q.w + 50) || L.fore.some((f) => Math.abs((c + 0.5) * T - f.x) < f.rx);
  const flat = (c: number, tol = 12) => c >= 3 && c < cols - 4 && G.flat((c - 1) * T, (c + 2) * T) <= tol && !rocky(c);
  const spot = (c: number, tone: number, species: string, own: boolean) => ({ x: (c + 0.5) * T, y: G.at((c + 0.5) * T) + 3, species, tone, own });
  const nearFlat = (c: number, spread: number, tol = 12) => {
    for (let d = 0; d <= spread; d++) {
      if (flat(c + d, tol)) return c + d;
      if (flat(c - d, tol)) return c - d;
    }
    return -1;
  };
  if (riverEndCol) {
    // die eigene Brut: ein paar Gelege rund um den Schlüpfplatz
    for (const off of [-7, 2, 10]) {
      const c = nearFlat(startCol + off, 4, 24);
      if (c >= 0 && !L.roe.some((q) => Math.abs(q.x - (c + 0.5) * T) < 3 * T)) L.roe.push(spot(c, 1, 'own', true));
    }
  }
  // Gelege der Bewohner (Hazards wie Quallen laichen nicht, die Herrscher ziehen nur durch) – im sicheren Startgebiet keine
  if (place.safe) return;
  const pool = L.spawns.filter((s) => {
    const d = SPECIES[s.id];
    return d && d.role !== 'hazard' && d.role !== 'apex' && !d.boss && d.power < 16 && s.guard === undefined;
  });
  if (!pool.length) return;
  // Kleine Fische laichen im Flachen, am Fluss und in der Tiefe kaum oder gar nicht
  const k = place.kind === 'abyss' || place.kind === 'deep' ? 0 : place.kind === 'start' ? 0.5 : place.kind === 'murky' ? 0.6 : 1;
  const want = Math.round((cols / 60) * k * (0.7 + r() * 0.6));
  const toneOf = (id: string) => [0, 2, 3][hashStr(id) % 3];
  for (let n = 0, tries = 0; n < want && tries < want * 12; tries++) {
    const sp = pool[Math.floor(r() * pool.length)];
    const d = SPECIES[sp.id];
    // gefährliche Eltern kommen seltener vor
    if (d.role === 'predator' && r() > 0.45) continue;
    const c = nearFlat(Math.round(sp.x / T) + rint(r, -6, 6), 8);
    if (c < 0 || c < riverEndCol + 40 || heights[c] > 32 || arrCols.some((a) => Math.abs(c - a) < 16) || L.roe.some((q) => Math.abs(q.x - (c + 0.5) * T) < 6 * T)) continue;
    const idx = L.roe.length;
    const roe = spot(c, toneOf(sp.id), sp.id, false);
    L.roe.push(roe);
    // die Eltern: ein, zwei Tiere in der Nähe
    const parents = d.role === 'predator' ? 1 : 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < parents; i++) L.spawns.push({ id: sp.id, x: roe.x + (i ? 70 : -60), y: roe.y - 60 - r() * 40, guard: idx });
    n++;
  }
}

// ---------------------------------------------------------------------------

function genWater(ep: EpochDef, r: Rng, place: PlaceDef, edge?: EdgeEntry): LevelData {
  const cols = Math.round(ep.len * place.wide);
  const extra = place.deep;
  // das Meer ist tief: Unten wird es dunkel, oben fällt das Licht herein
  const rows = 31 + extra;
  const L = base(ep, 'water', cols * T, rows * T);
  L.zones = [{ x0: 0, x1: cols * T, def: place.def }];
  // Man kommt links an, aber nicht am Rand – zurück zur Karte geht es bewusst am Ende
  const startCol = Math.round(cols * 0.16);
  L.startCol = startCol;
  // Der Fluss am Start reicht gut ein Drittel des Ortes weit
  const riverEndCol = place.shape === 'river' || (!place.shape && SHAPE_OF[place.kind] === 'river') ? Math.round(cols * 0.36) : 0;
  if (riverEndCol) L.riverEnd = riverEndCol * T;

  // Jeder Ort hat seine eigene Form: eine Mulde (Start), eine flache Wiese (bewachsen), Hügelketten (trüb), ein Trichter
  // in V-Form (tief) oder ein Schacht zwischen zwei Rändern (Abgrund). Wer hineinschwimmt, wird tiefer und dunkler.
  const shape = place.shape ?? SHAPE_OF[place.kind];
  const mid = (cols - 1) / 2;
  const lowest = rows - 4;
  const floor0 = 27 + extra;
  const TAU = Math.PI * 2;
  const ease = (u: number) => {
    const t = clampN(u, 0, 1);
    return t * t * (3 - 2 * t);
  };
  // Höhe des Bodens (in Kacheln, gebrochen) bei der Spalte c – die Feinheit kommt aus buildHeightfield
  let prof: (c: number) => number = () => floor0;
  let undulate = 0.8;
  if (shape === 'river') {
    // Der Start: ein flacher Fluss, der in der Mündung ins Meer abfällt. Links ein tieferer Tümpel, in dem man schlüpft.
    undulate = 0.25;
    const seaFloor = Math.min(lowest, floor0 - 4);
    const slope = Math.round(cols * 0.2);
    prof = (c) => {
      // ganz links entspringt der Fluss: Das Ufer steigt bis zur Wasseroberfläche an – dort geht es nicht weiter
      if (c < 14) return 17 - 15.4 * ease((11 - c) / 11);
      const bed = 17 - 5 * ease((c - 14) / 20) + Math.sin(c * 0.21) * 0.9 * ease((c - 30) / 14) * (1 - ease((c - (riverEndCol - 10)) / 10));
      if (c < riverEndCol) return bed;
      if (c < riverEndCol + slope) return 12 + (seaFloor - 12) * ease((c - riverEndCol) / slope);
      return clampN(seaFloor + Math.sin(c * 0.13) * 1.5 + Math.sin(c * 0.05 + 2) * 2, floor0 - 8, lowest);
    };
  } else if (shape === 'vee') {
    undulate = 1;
    const rim = 21;
    const steep = place.kind === 'abyss' ? 0.8 : 0.95;
    prof = (c) => rim + (lowest - rim) * Math.pow(Math.max(0, 1 - Math.abs(c - mid) / (mid * 0.93)), steep);
  } else if (shape === 'well') {
    // breite Ränder, dazwischen ein Schacht, der steil nach unten führt
    undulate = 1;
    const rim = 21;
    prof = (c) => rim + (lowest - rim) * Math.pow(Math.max(0, 1 - Math.abs(c - mid) / (mid * 0.5)), 0.6);
  } else if (shape === 'bowl') {
    // eine Mulde, deren tiefste Stelle nicht genau in der Mitte liegt – ein Ufer fällt sanfter ab als das andere
    const rim = floor0 - 8, bot = lowest;
    const c0 = mid + (r() - 0.5) * cols * 0.3;
    prof = (c) => {
      const u = Math.min(1, Math.abs(c - c0) / (c < c0 ? c0 : cols - c0));
      return rim + (bot - rim) * (1 - Math.pow(u, 1.6));
    };
  } else if (shape === 'ridges') {
    undulate = 0.4;
    const ph = r() * TAU, ph2 = r() * TAU;
    prof = (c) => clampN(floor0 - 2 + 4.6 * Math.sin((c * TAU) / 31 + ph) + 2.2 * Math.sin((c * TAU) / 12 + ph2), floor0 - 8, lowest);
  }
  // Der Boden: eine glatte Höhenlinie; Sand, Fels und Schlamm wechseln sich ab
  const zones = makeZones(r, cols * T, place.kind, riverEndCol * T);
  // (nur der Startfluss darf links bis zur Wasseroberfläche ansteigen: dort ist die Quelle)
  const hp = buildHeightfield(r, cols, rows, zones, prof, undulate, riverEndCol ? 2.2 : 9);
  L.terrain = { hp, zones };
  const G = makeGround(hp, cols);
  L.start = { x: (startCol + 0.5) * T, y: riverEndCol ? G.at((startCol + 0.5) * T) - 130 : 12 * T };
  addTunnels(L, place.caves, r, cols, G, startCol);
  addCrevices(L, 2, r, cols, G, startCol);
  addCurrents(L, r, cols, G.heights, startCol);
  if (L.surfaceY > 0) placeSun(L, place.sun, r, cols, startCol);
  // Die Welt ist für alle gleich – egal, von wo man kommt. Deshalb bleibt an jedem möglichen Ankunftsplatz Platz: am Start
  // und an beiden Rändern (Felsen, Räuber, Gelege und Dickicht halten dort Abstand).
  const arrCols = [startCol, 9, cols - 10];
  // Felsen und Kiesel – nicht dort, wo man ankommt
  const shrine = shrineCol(L, place, G, startCol);
  placeRocks(L, place, r, G, [[(startCol - 11) * T, (startCol + 13) * T], ...arrCols.map((c): [number, number] => [(c - 9) * T, (c + 9) * T]), ...(shrine >= 0 ? [[(shrine - 9) * T, (shrine + 9) * T] as [number, number]] : [])], riverEndCol);
  placeMats(L, place, r, G, riverEndCol);
  dressGround(L, ep, place, r, G, riverEndCol);
  placeShrine(L, G, startCol, shrine);
  // am Start ist es still: Tiere gibt es erst in den anderen Orten (siehe PlaceDef.safe)
  placeFauna(L, ep, place, r, G, arrCols, riverEndCol ? riverEndCol + 12 : 4);
  placeRoe(L, place, r, G, startCol, arrCols, riverEndCol);
  // Am Ankunftsplatz soll man sein Tier sehen: kein Dickicht direkt dort
  L.cover = L.cover.filter((c) => (c.x > (startCol + 9) * T || c.x + c.w < (startCol - 5) * T) && arrCols.every((a) => c.x > (a + 9) * T || c.x + c.w < (a - 9) * T));
  // … und vor der großen Muschel kein Dickicht, das sie verdeckt
  const sx = L.shrine?.x;
  if (sx !== undefined) L.cover = L.cover.filter((c) => c.x > sx + 150 || c.x + c.w < sx - 150);
  // Wo man selbst ankommt (das Einzige, was davon abhängt, von wo man kommt): wer über den Rand hereinschwimmt, am Gegenrand
  // auf derselben Höhe (soweit es dort Wasser gibt)
  if (edge) {
    const col = edge.side === 'left' ? cols - 10 : 9;
    const floorY = G.at((col + 0.5) * T);
    const top = L.surfaceY + 120, bot = Math.max(top + 10, floorY - 130);
    L.start = { x: (col + 0.5) * T, y: clampN(L.surfaceY + edge.frac * (floorY - L.surfaceY), top, bot) };
  }
  // keine Tiere im Fels (Felsen, Platten, Bögen) und nicht im Boden
  for (const sp of L.spawns) {
    const crawl = SPECIES[sp.id]?.crawl;
    for (let k = 0; k < 8; k++) {
      const s = L.solids.find((q) => sp.x > q.x - 24 && sp.x < q.x + q.w + 24 && sp.y > q.y - 40 && sp.y < q.y + q.h + 40);
      if (!s) break;
      // Krabbler rücken zur Seite, alle anderen schwimmen über den Felsen
      if (crawl) sp.x = sp.x < s.x + s.w / 2 ? s.x - 90 : s.x + s.w + 90;
      else sp.y = Math.max(L.surfaceY + 60, s.y - 60);
    }
    sp.y = Math.min(sp.y, G.at(sp.x) - 24);
  }
  // keine Tiere im Fels der Tunnel (das Dach reicht vier Kacheln über den Gang)
  for (const sp of L.spawns) {
    for (const c of L.caves) if (sp.x > c.x - 2 * T && sp.x < c.x + c.w + 2 * T && sp.y > c.y - 5 * T) sp.y = c.y - 5 * T - 30;
  }
  L.groundRects = groundRects(hp, rows * T);
  L.ground = Array.from({ length: cols }, (_, c) => G.at((c + 0.5) * T));
  return L;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Felsen und Kiesel: Brocken liegen auf dem Boden – in Felsgebieten viele, im Sand wenige. Sie sind fest (Hitbox), man schwimmt
 * um sie herum und über sie hinweg; manche lehnen aneinander. Kleine Steine liegen als Geröll davor. Dazu große, dunkle
 * Felsen im Vordergrund ohne Hitbox: Wer hinter ihnen schwimmt, verschwindet kurz aus dem Bild.
 */
function placeRocks(L: LevelData, place: PlaceDef, r: Rng, G: Ground, keep: [number, number][], riverEndCol: number) {
  const cols = G.heights.length;
  const zones = L.terrain.zones;
  const taken: [number, number][] = [];
  const frozen = (x0: number, x1: number) =>
    keep.some(([a, b]) => x1 > a && x0 < b)
    || L.caves.some((c) => x1 > c.x - 5 * T && x0 < c.x + c.w + 5 * T)
    || L.crevices.some((c) => x1 > c.x - 4 * T && x0 < c.x + c.w + 4 * T);
  // der Felsen sitzt auf dem tiefsten Punkt unter ihm, ein Stück im Boden
  const seat = (x: number, rx: number, ry: number, tone: number, sink: number): RockSpec => {
    const seed = Math.floor(r() * 1e9);
    let low = -Infinity;
    for (let px = x - rx * 0.8; px <= x + rx * 0.8; px += STEP / 2) low = Math.max(low, G.at(px));
    return { x, y: low + sink - rockBottom(rockPoly(seed, rx, ry)), rx, ry, seed, tone, form: 'boulder' };
  };
  const solid = (rock: RockSpec) => {
    L.rocks.push(rock);
    for (const sl of rockSlices(rock, (px) => G.at(px))) L.solids.push(sl);
  };
  const WEIGHT = { rock: 1, sand: 0.4, mud: 0.2 };
  const dens = place.kind === 'abyss' || place.kind === 'deep' ? 1.1 : place.kind === 'murky' ? 0.9 : place.kind === 'lush' ? 0.55 : 0.6;
  const toneOf = (m: string) => (m === 'rock' ? (r() < 0.45 ? 2 : 1) : m === 'sand' ? (r() < 0.5 ? 0 : 1) : 2);
  const want = Math.round((cols / 16) * dens);
  for (let n = 0, tries = 0; n < want && tries < want * 25; tries++) {
    const x = (6 + r() * (cols - 12)) * T;
    const m = matAt(zones, x);
    if (r() > WEIGHT[m] * (x < riverEndCol * T ? 0.6 : 1)) continue;
    const q = r();
    const rx = q < 0.5 ? 34 + r() * 22 : q < 0.85 ? 54 + r() * 36 : 88 + r() * 50;
    const ry = Math.min(96, rx * (0.6 + r() * 0.3));
    if (frozen(x - rx - 30, x + rx + 30) || taken.some(([a, b]) => x + rx + 30 > a && x - rx - 30 < b)) continue;
    if (G.flat(x - rx * 0.8, x + rx * 0.8) > ry * 1.3) continue;
    const tone = toneOf(m);
    solid(seat(x, rx, ry, tone, 8));
    let reach = rx;
    // ein kleinerer Brocken lehnt daneben – dazwischen eine Ritze, in die sich Kleine drücken
    if (rx > 54 && r() < 0.5) {
      const side = r() < 0.5 ? -1 : 1;
      const rx2 = 34 + r() * 12, ry2 = rx2 * (0.6 + r() * 0.25);
      const x2 = x + side * (rx * 0.8 + rx2 * 0.75);
      if (!frozen(x2 - rx2, x2 + rx2) && G.flat(x2 - rx2 * 0.8, x2 + rx2 * 0.8) <= ry2) {
        solid(seat(x2, rx2, ry2, tone, 8));
        reach = Math.max(reach, Math.abs(x2 - x) + rx2);
      }
    }
    // Geröll am Fuß
    for (let i = Math.floor(r() * 4); i > 0; i--) {
      const prx = 8 + r() * 12;
      L.rocks.push(seat(x + (r() < 0.5 ? -1 : 1) * (reach * 0.9 + prx + r() * 34), prx, prx * (0.6 + r() * 0.3), tone, 5));
    }
    taken.push([x - reach - 60, x + reach + 60]);
    n++;
  }
  // Kiesel überall verstreut, im Sand und im Fels
  for (let i = 0, n = Math.round(cols * 0.6); i < n; i++) {
    const x = (2 + r() * (cols - 4)) * T;
    const m = matAt(zones, x);
    if (r() > WEIGHT[m] + 0.1 || L.caves.some((c) => x > c.x - 20 && x < c.x + c.w + 20)) continue;
    const prx = 5 + r() * 9;
    L.rocks.push(seat(x, prx, prx * (0.55 + r() * 0.3), toneOf(m), 4));
  }
  // große Felsen im Vordergrund
  const nf = Math.round((cols / 40) * (place.kind === 'lush' ? 0.7 : 1));
  for (let n = 0, tries = 0; n < nf && tries < nf * 30; tries++) {
    const x = (8 + r() * (cols - 16)) * T;
    const rx = 70 + r() * 90, ry = Math.min(128, rx * (0.55 + r() * 0.3));
    if (frozen(x - rx, x + rx) || G.flat(x - rx * 0.8, x + rx * 0.8) > ry * 0.8 || L.fore.some((f) => Math.abs(f.x - x) < f.rx + rx + 300)) continue;
    L.fore.push(seat(x, rx, ry, 2, 30));
    n++;
  }
}

/** Mikrobenmatten: dünne, farbige Beläge auf Sand und Schlamm – am meisten im trüben Flachwasser, kaum in der Tiefe. */
function placeMats(L: LevelData, place: PlaceDef, r: Rng, G: Ground, riverEndCol: number) {
  const cols = G.heights.length;
  const zones = L.terrain.zones;
  const k = place.kind === 'murky' ? 1.3 : place.kind === 'lush' ? 1 : place.kind === 'start' ? 0.8 : place.kind === 'deep' ? 0.6 : 0.25;
  const want = Math.round((cols / 14) * k);
  // olivgrün (Cyanobakterien) überall, purpurbraun und rosa (Schwefelbakterien) eher trüb und tief, ocker im Flachen
  const tones = place.kind === 'murky' || place.kind === 'deep' || place.kind === 'abyss' ? [0, 1, 1, 2, 3] : [0, 0, 0, 3, 2];
  for (let n = 0, tries = 0; n < want && tries < want * 14; tries++) {
    const x0 = 100 + r() * (cols * T - 700);
    const w = 150 + r() * 300;
    const x1 = x0 + w;
    const m = matAt(zones, x0 + w / 2);
    if (m === 'rock' && r() < 0.85) continue;
    if (x0 < riverEndCol * T && x1 > riverEndCol * T) continue;
    if (L.caves.some((c) => x1 > c.x - T && x0 < c.x + c.w + T) || L.crevices.some((c) => x1 > c.x - T && x0 < c.x + c.w + T)) continue;
    if (L.solids.some((s) => s.x < x1 && s.x + s.w > x0 && s.y < G.at(s.x + s.w / 2) - 8)) continue;
    if (G.flat(x0, x1) > 40 || L.mats.some((q) => x0 < q.x1 + 40 && x1 > q.x0 - 40)) continue;
    L.mats.push({ x0, x1, tone: tones[Math.floor(r() * tones.length)], seed: Math.floor(r() * 1e9) });
    n++;
  }
}

/** Bewuchs auf dem Boden: Deko, fressbare Pflanzen und Dickicht – nicht in Tunneln und auf oder hinter Felsen. */
function dressGround(L: LevelData, ep: EpochDef, place: PlaceDef, r: Rng, G: Ground, riverEndCol: number) {
  const cols = G.heights.length;
  const z = place.def;
  const lush = place.kind === 'lush';
  const zones = L.terrain.zones;
  const free = (x: number, w: number) =>
    !L.caves.some((c) => x + w > c.x - T && x - w < c.x + c.w + T)
    && !L.crevices.some((c) => x + w > c.x - T && x - w < c.x + c.w + T)
    && !L.solids.some((s) => x + w > s.x && x - w < s.x + s.w && s.y < G.at(x) - 8)
    && !L.fore.some((f) => Math.abs(x - f.x) < f.rx * 0.95 + w);
  // Wer hier lebt, hängt vom Ort, vom Zeitalter und vom Untergrund ab (data/biota.ts); manche wachsen in kleinen Gruppen
  for (let c = 0; c < cols; c += rint(r, 1, 2)) {
    const x = (c + 0.25 + r() * 0.5) * T;
    const m = matAt(zones, x);
    if (r() >= (lush ? 1 : 0.85) * (m === 'rock' ? 0.85 : 1)) continue;
    if (!free(x, 6)) continue;
    const b = pickBio(r, place.kind, ep.id, m, !!ep.reef);
    if (!b) continue;
    const n = b.group ? rint(r, b.group[0], b.group[1]) : 1;
    for (let i = 0; i < n; i++) {
      const gx = i ? x + (r() < 0.5 ? -1 : 1) * (9 + r() * 22) * i : x;
      if (i && (!free(gx, 6) || G.flat(gx - 10, gx + 10) > 30)) continue;
      L.decor.push({ k: b.key, x: gx, y: G.at(gx) + 6 });
    }
  }
  for (let x0 = 0; x0 < cols;) {
    const n = rint(r, 5, 9);
    // im Fluss wächst nur wenig: ein paar Pflanzen, bevor es ins Meer hinausgeht
    const pl = ep.plants * z.plants * (x0 < riverEndCol ? 0.3 : 1) * (matAt(zones, (x0 + n / 2) * T) === 'rock' ? 0.6 : 1);
    const cnt = (r() < pl * 0.9 ? 1 : 0) + (r() < pl * 0.55 ? 1 : 0) + (n >= 7 && r() < pl * 0.35 ? 1 : 0) + (r() < pl - 1 ? 1 : 0);
    // liegt die Stelle auf einem Felsen oder am steilen Hang, wird eine andere gesucht
    for (let i = 0; i < cnt; i++) {
      for (let t = 0; t < 4; t++) {
        const x = (x0 + 1 + r() * (n - 2)) * T;
        if (!free(x, 24) || G.flat(x - 24, x + 24) > 36) continue;
        L.plants.push({ x, y: G.at(x) + 4, v: plantVariant(r) });
        break;
      }
    }
    if (r() < ep.cover * z.cover * (lush ? 0.85 : 0.65)) {
      for (let t = 0; t < 3; t++) {
        const cw = rint(r, 3, Math.min(lush ? 8 : 6, n));
        const cx = x0 + rint(r, 0, n - cw);
        const ch = lush ? rint(r, 6, 10) : rint(r, 5, 7);
        let low = -Infinity;
        for (let px = cx * T; px <= (cx + cw) * T; px += STEP) low = Math.max(low, G.at(px));
        if (!free((cx + cw / 2) * T, (cw / 2) * T) || G.flat(cx * T, (cx + cw) * T) > 90) continue;
        L.cover.push({ x: cx * T, y: low - ch * T, w: cw * T, h: ch * T });
        break;
      }
    }
    x0 += n;
  }
}

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
 * Höhlen im Fels: ein Hohlraum mit unregelmäßiger Decke, hinten rund und geschlossen. Die Öffnung zeigt zum Ankunftsplatz –
 * sie ist mit Geröll verschüttet (L.walls), das nur ein kräftiger Stoß aufbricht. Drinnen liegt eine Muschel; wer bis ans
 * hintere Ende schwimmt und wieder heraus, nimmt die Farbe der Höhle an (grün bzw. schwarz). Der Boden wird dort eingeebnet.
 */
function addTunnels(L: LevelData, kinds: CaveKind[], r: Rng, cols: number, G: Ground, startCol: number) {
  const used: { c0: number; c1: number }[] = [];
  kinds.forEach((kind, idx) => {
    for (let k = 0; k < 500; k++) {
      const W = rint(r, 11, 15);
      // die erste Höhle nicht weit vom Ankunftsplatz, damit man sie findet
      const off = rint(r, 9, 26);
      const c0 = idx === 0 && k < 150 ? (r() < 0.5 ? startCol + off : startCol - off - W) : rint(r, 8, cols - W - 8);
      if (c0 < 8 || c0 + W > cols - 8) continue;
      if ((idx > 0 || k >= 150) && Math.abs(c0 + W / 2 - startCol) < 12) continue;
      if (used.some((u) => c0 < u.c1 + 8 && c0 + W > u.c0 - 8)) continue;
      if (G.flat((c0 - 3) * T, (c0 + W + 3) * T) > (k < 200 ? 90 : 170)) continue;
      const f = Math.round(G.at((c0 + W / 2) * T) / T);
      if (f < 14) continue;
      const x0 = c0 * T, x1 = (c0 + W) * T;
      // die Öffnung zeigt zum Ankunftsplatz
      const side: 1 | -1 = c0 + W / 2 < startCol ? 1 : -1;
      // einebnen: der Hohlraum hat einen ebenen Boden, davor und dahinter geht er weich ins Gelände über
      G.flatten((c0 - 4) * T, (c0 + W + 4) * T, f * T, 140);
      const cave = caveRock(x0, x1, f * T, 3.3 * T, 3 * T, 3.9 * T, 1.5 * T, side, Math.floor(r() * 1e9));
      L.rocks.push(cave.rock);
      for (const b of cave.boxes) L.solids.push(b);
      const top = Math.floor(cave.ceil);
      L.caves.push({ x: x0, y: top, w: W * T, h: f * T - top, coat: kind === 'g' ? 1 : 2, side, hollow: cave.hollow });
      L.walls.push({ ...cave.wall, cave: L.caves.length - 1, side, seed: Math.floor(r() * 1e9) });
      used.push({ c0, c1: c0 + W });
      // Bewuchs auf der Kuppel
      for (let i = 0; i < W; i++) if (r() < 0.45) L.decor.push({ k: pick(r, ['seaweed', 'anemone', 'sponge', 'seagrass']), x: x0 + (i + 0.5) * T, y: cave.top(x0 + (i + 0.5) * T) + 4 });
      // hinter dem geschlossenen Ende wächst dichter Bewuchs – vor dem Geröll bleibt es frei, damit man es sieht
      L.cover.push({ x: side > 0 ? x0 - 4 * T : x1 + T, y: (f - 7) * T, w: 3 * T, h: 7 * T });
      break;
    }
  });
}

/**
 * Felsspalten: Eine Felsplatte liegt knapp über dem Grund. Darunter bleibt ein niedriger Durchgang,
 * in den große Jäger nicht hineinkommen – und wer selbst zu massig ist, auch nicht.
 */
function addCrevices(L: LevelData, n: number, r: Rng, cols: number, G: Ground, startCol: number) {
  const W = 6;
  for (let k = 0; k < 400 && L.crevices.length < n; k++) {
    const c0 = rint(r, 6, cols - W - 6);
    if (Math.abs(c0 - startCol) < 12) continue;
    if (G.flat((c0 - 2) * T, (c0 + W + 2) * T) > (k < 200 ? 70 : 110)) continue;
    const f = Math.round(G.at((c0 + W / 2) * T) / T);
    const x0 = c0 * T, x1 = (c0 + W) * T;
    const gap = 34 + Math.floor(r() * 7);
    const slabY = f * T - gap - 2 * T;
    const busy = L.caves.some((c) => c.x < x1 + 5 * T && c.x + c.w > x0 - 5 * T) || L.crevices.some((c) => c.x < x1 + 6 * T && c.x + c.w > x0 - 6 * T);
    if (busy) continue;
    // der Boden darunter wird eben; die Felsplatte liegt auf einem Felsbrocken am einen Ende auf (dort ist der Spalt geschlossen)
    G.flatten(x0 - 2 * T, x1 + 2 * T, f * T, 120);
    L.solids.push({ x: x0, y: slabY, w: W * T, h: 2 * T });
    L.rocks.push(slabRock(x0, slabY, W * T, 2 * T, Math.floor(r() * 1e9)));
    L.crevices.push({ x: x0, y: f * T - gap, w: W * T, h: gap });
    const side = r() < 0.5 ? -1 : 1;
    const rx = 46 + r() * 8, ry = 60 + r() * 12;
    const seed = Math.floor(r() * 1e9);
    const rock: RockSpec = { x: side < 0 ? x0 + 6 : x1 - 6, y: f * T + 10 - rockBottom(rockPoly(seed, rx, ry)), rx, ry, seed, tone: 1, form: 'boulder' };
    L.rocks.push(rock);
    for (const sl of rockSlices(rock, (px) => G.at(px))) L.solids.push(sl);
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
 * Die große Muschel: Im Startgebiet liegt sie ein Stück vor dem Platz, an dem man schlüpft, auf möglichst ebenem Grund –
 * dort betet man um mehr Ausdauer. Gewählt wird ihr Platz vor den Felsen (die halten Abstand), gesetzt danach.
 */
function shrineCol(L: LevelData, place: PlaceDef, G: Ground, startCol: number) {
  if (place.kind !== 'start') return -1;
  const cols = G.heights.length;
  let best = -1, bestScore = Infinity;
  for (let col = startCol + 12; col < Math.min(cols - 10, startCol + 36); col++) {
    const x = (col + 0.5) * T;
    if (L.caves.some((c) => x > c.x - 4 * T && x < c.x + c.w + 4 * T) || L.crevices.some((c) => x > c.x - 4 * T && x < c.x + c.w + 4 * T)) continue;
    // möglichst eben und nicht zu weit weg
    const score = G.flat((col - 3) * T, (col + 4) * T) + (col - startCol) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best >= 0 ? best : Math.min(cols - 10, startCol + 16);
}

function placeShrine(L: LevelData, G: Ground, startCol: number, col: number) {
  if (col < 0) return;
  // am Start beginnt man knapp über dem Grund
  L.start.y = Math.max(L.surfaceY + 160, G.at((startCol + 0.5) * T) - 190);
  const x = (col + 0.5) * T;
  L.shrine = { x, y: G.at(x) };
  // davor wächst nichts, das sie verdeckt
  L.plants = L.plants.filter((p) => Math.abs(p.x - x) > 110);
}

/** Wie man in einen Ort gekommen ist, wenn man über den Rand eines anderen hinausgeschwommen ist (side = dort verlassene Seite). */
export interface EdgeEntry {
  side: 'left' | 'right';
  /** Tiefe beim Verlassen: 0 Oberfläche … 1 Grund */
  frac: number;
}

/** Ein Ort dieses Zeitalters – bei jedem Lauf etwas anders, aber immer derselbe für einen Lauf. */
export function generateLevel(ep: EpochDef, salt: string | number, place: PlaceDef, edge?: EdgeEntry): LevelData {
  const r = mulberry32(hashStr(`${ep.id}_${place.id}_${salt}`));
  return genWater(ep, r, place, edge);
}
