import Phaser from 'phaser';
import type { ClassId } from '../data/classes';
import { css, hueShift, mix, shade } from '../util/color';
import { type Ctx, ell, newCanvas, smooth } from '../util/canvas';
import { mulberry32 } from '../util/math';
import { plateLevel } from '../state/GameState';
import { eye, ivory, skin, tooth } from './paint';

// ---------------------------------------------------------------------------
// Die Spielfigur. Sie wird aus stufenlosen Merkmalen gezeichnet:
//   jaw     → längere Schnauze, tieferer Kiefer, mehr und längere Zähne, ein Kaumuskel an der Wange
//   skull   → gewölbte Stirn, Knochenplatten, Höcker und Hörner; mit spike die Kopfplatte des Stoßfischs
//   armor   → deutlichere, glänzende Schuppen bis zum Schuppenpanzer mit Knochenschilden
//   stealth → schlanker, längere Flossen/Beine, Tarnmuster, größere Augen
//   diet    → Pflanzenfresser: stumpfe Zähne, runder Bauch; Fleischfresser: spitze Zähne
//   belly   → hungrig (Rippen sichtbar) … satt (runder Bauch)
//   fierce  → angriffslustig: schwere Lider, rötlicher Blick
// Jedes Teil (Körper, Kopf, Unterkiefer, Zähne, Schwanz, Beine, Flosse) ist eine
// eigene Textur, damit CreatureView es bewegen kann.
// ---------------------------------------------------------------------------

export interface Morph {
  cls: ClassId;
  size: number;
  jaw: number;
  skull: number;
  stealth: number;
  diet: number;
  scars: number;
  belly: number;
  fierce: number;
  hue: number;
  seed: number;
  /** 0 = ohne Angabe, 1 = Männchen (Kehlfleck, etwas kräftiger gefärbt), 2 = Weibchen */
  sex?: number;
  /** Kopfpanzer: 0 … -1 gepanzerter Schädel */
  spike?: number;
  /** Tarnfarbe: grün (Pflanzen) bzw. sandig (Boden, Höhlen) */
  green?: number;
  sand?: number;
  /** Körperbau: -1 gedrungen … +1 lang; -1 schlank … +1 massig; -1 träge … +1 flink (größere Flossen) */
  len?: number;
  girth?: number;
  swift?: number;
  /** Reißzähne, die vorn aus dem Maul stehen (viel Fleisch gefressen) */
  fang?: number;
  /** Färbung: -1 dunkel (Tiefe, Schatten) … +1 hell (oben im Licht) */
  light?: number;
  /** Bodenkontakt: fleischige Stützflossen (Fisch) bzw. kräftigere Beine */
  limb?: number;
  /** Flossengröße, Schwanzbreite, Rückenflosse/Kamm: -1 klein … +1 groß */
  fin?: number;
  tail?: number;
  crest?: number;
  /** leicht verschobener Farbton (-1 … +1) */
  tint?: number;
  /** Kopfform: -1 kurz und stumpf … +1 lang und spitz */
  snout?: number;
  /** Färbung durch eine Höhle: 0 natürlich, 1 grün (wie ein Barsch: Querbinden), 2 schwarz */
  coat?: number;
  /** Körperrobustheit (0 … 1): robustere Schuppen bis zum Schuppenpanzer */
  armor?: number;
  /**
   * Evolutionsplatten (Punkte): Stoß-, Beiß-, Verfolgungs- und Schwarmfisch – sie färben das Tier (die Form kommt aus den übrigen
   * Merkmalen; der Schwarmfisch trägt dazu ein dunkles Längsband)
   */
  st?: number;
  bs?: number;
  vf?: number;
  sw?: number;
  /** Flossen aus der Bewegung (0 … 1): Rückenflosse (nach oben geschwommen), Bauchflossen (nach unten), Seitenflossen (oft gewendet), Schwanzflosse (viel und schnell nach vorn) */
  fUp?: number;
  fDown?: number;
  fSide?: number;
  fTail?: number;
}

const q = (v: number, step: number) => +(Math.round(v / step) * step).toFixed(3);

/** Rundet die Merkmale auf Stufen, damit nicht für jede Kleinigkeit neu gezeichnet wird. */
export function quantize(m: Morph): Morph {
  return {
    cls: m.cls,
    size: q(m.size, 0.04),
    jaw: q(m.jaw, 0.05),
    skull: q(m.skull, 0.05),
    stealth: q(m.stealth, 0.05),
    diet: q(m.diet, 0.25),
    scars: Math.round(m.scars),
    belly: Math.round(m.belly),
    fierce: q(m.fierce, 0.25),
    hue: m.hue,
    seed: m.seed,
    sex: m.sex ?? 0,
    spike: q(m.spike ?? 0, 0.25),
    green: q(m.green ?? 0, 0.1),
    sand: q(m.sand ?? 0, 0.1),
    len: q(m.len ?? 0, 0.2),
    girth: q(m.girth ?? 0, 0.2),
    swift: q(m.swift ?? 0, 0.25),
    fang: q(m.fang ?? 0, 0.2),
    light: q(m.light ?? 0, 0.2),
    limb: q(m.limb ?? 0, 0.2),
    fin: q(m.fin ?? 0, 0.25),
    tail: q(m.tail ?? 0, 0.25),
    crest: q(m.crest ?? 0, 0.25),
    tint: q(m.tint ?? 0, 0.2),
    snout: q(m.snout ?? 0, 0.25),
    coat: Math.round(m.coat ?? 0),
    armor: q(m.armor ?? 0, 0.1),
    st: q(m.st ?? 0, 0.25),
    bs: q(m.bs ?? 0, 0.25),
    vf: q(m.vf ?? 0, 0.25),
    sw: q(m.sw ?? 0, 0.25),
    fUp: q(m.fUp ?? 0, 0.1),
    fDown: q(m.fDown ?? 0, 0.1),
    fSide: q(m.fSide ?? 0, 0.1),
    fTail: q(m.fTail ?? 0, 0.1),
  };
}

export function morphKey(m: Morph) {
  const k = quantize(m);
  return [k.cls, k.size, k.jaw, k.skull, k.stealth, k.diet, k.scars, k.belly, k.fierce, k.hue, k.seed % 97, k.sex, k.spike, k.green, k.sand, k.len, k.girth, k.swift, k.fang, k.light, k.limb, k.fin, k.tail, k.crest, k.tint, k.snout, k.coat, k.armor, k.st, k.bs, k.vf, k.sw, k.fUp, k.fDown, k.fSide, k.fTail].join('_');
}

interface Pal {
  base: number;
  belly: number;
  dark: number;
  camo: number;
  eye: number;
  fin: number;
}

const LINEAGE: Pal[] = [
  { base: 0x56603e, belly: 0xa8a080, dark: 0x1a1e12, camo: 0x2a3018, eye: 0xd09a36, fin: 0x6a6038 },
  { base: 0x48545e, belly: 0x9ca4a2, dark: 0x14181c, camo: 0x262e34, eye: 0xc8a856, fin: 0x55604e },
  { base: 0x664432, belly: 0xb49a78, dark: 0x1e120c, camo: 0x3a2418, eye: 0xdc9a2c, fin: 0x7a5434 },
  { base: 0x3a564e, belly: 0x8e9e8e, dark: 0x101a16, camo: 0x1e302a, eye: 0xc8b85e, fin: 0x4a5e44 },
];

function palette(m: Morph): Pal {
  const p0 = LINEAGE[m.hue % LINEAGE.length];
  // jede Linie kann im Farbton etwas abweichen
  const hs = (m.tint ?? 0) * 34;
  const p: Pal = { ...p0, base: hueShift(p0.base, hs), camo: hueShift(p0.camo, hs), fin: hueShift(p0.fin, hs * 1.3), belly: hueShift(p0.belly, hs * 0.5) };
  const st = m.stealth;
  const male = m.sex === 1;
  // Wer sich viel versteckt, nimmt die Farben seiner Verstecke an
  const g = m.green ?? 0, sd = m.sand ?? 0;
  // oben im Licht wird die Färbung heller, in der Tiefe dunkler
  const li = m.light ?? 0;
  const lit = (c: number) => shade(c, li * 0.42);
  const camoBase = (c: number) => lit(mix(mix(c, 0x4e6a34, Math.min(0.7, g * 0.75)), 0x8a7a5c, Math.min(0.7, sd * 0.75)));
  const out: Pal = {
    base: mix(mix(camoBase(p.base), shade(p.camo, 0.2), st * 0.35), shade(p.base, -0.12), male ? 0.5 : 0),
    belly: mix(mix(p.belly, 0xa89a78, Math.min(0.6, sd * 0.6)), p.base, st * 0.25),
    dark: shade(p.dark, li * 0.26),
    camo: camoBase(p.camo),
    eye: mix(p.eye, 0xc8401c, m.fierce * 0.75),
    fin: mix(camoBase(p.fin), p.camo, st * 0.3),
  };
  // Die Evolutionsplatten färben mit: Stoßfisch stahlgrau, Beißfisch dunkel bronzefarben mit rostigen Flossen,
  // Verfolgungsfisch blaugrau mit hellem Bauch, Schwarmfisch silbrig
  const ws = plateLevel(m.st ?? 0), wb = plateLevel(m.bs ?? 0), wv = plateLevel(m.vf ?? 0), wsw = plateLevel(m.sw ?? 0);
  const wt = ws + wb + wv + wsw;
  if (wt > 0) {
    const avg = (a: number, b: number, c: number, d: number) => mix(mix(mix(a, b, wb / (ws + wb || 1)), c, wv / (ws + wb + wv || 1)), d, wsw / wt);
    const k = Math.min(1, wt) * 0.6;
    out.base = mix(out.base, avg(0x5d666b, 0x6a4c3a, 0x4e6f7e, 0x8c9a9e), k);
    out.fin = mix(out.fin, avg(0x474f54, 0x7a4630, 0x3f5b68, 0x627680), k);
    out.belly = mix(out.belly, avg(0xa9aca6, 0xc2aa8c, 0xcfd6cc, 0xe2e8e4), k * 0.7);
  }
  // Höhlenfarbe: grün wie ein Barsch (grüner Rücken, helle Flanke, dunkle Querbinden) bzw. tiefschwarz
  const coat = m.coat ?? 0;
  if (coat === 1) {
    out.base = mix(out.base, 0x4f7d3c, 0.92);
    out.belly = mix(out.belly, 0xc4cc9c, 0.8);
    out.camo = 0x1d3a1b;
    out.fin = mix(out.fin, 0x93a043, 0.85);
    out.dark = shade(out.dark, -0.1);
  } else if (coat === 2) {
    out.base = mix(out.base, 0x15181b, 0.94);
    out.belly = mix(out.belly, 0x2c3236, 0.9);
    out.camo = 0x0a0c0e;
    out.fin = mix(out.fin, 0x101316, 0.9);
    out.dark = 0x040506;
    out.eye = mix(0xf0b840, out.eye, m.fierce * 0.5);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Geometrie

export interface HeadGeo {
  L: number;
  H: number;
  mouthY: number;
  hingeX: number;
  jawH: number;
  dome: number;
  snoutH: number;
  ex: number;
  ey: number;
  er: number;
}

interface Geo {
  s: number;
  bw: number;
  bh: number;
  pts: number[][];
  neck: [number, number];
  tailAt: [number, number];
  legF: [number, number];
  legB: [number, number];
  legLen: number;
  legW: number;
  hg: HeadGeo;
}

function geo(m: Morph): Geo {
  const st = m.stealth, jaw = m.jaw, sk = m.skull;
  // Körperbau: länger gestreckt bzw. massiger
  const lk = 1 + 0.42 * (m.len ?? 0);
  const slim = (1 - 0.16 * st) * (1 + 0.38 * (m.girth ?? 0)) / Math.sqrt(lk);
  const bellyK = [0.9, 1, 1.08][m.belly] + (m.diet < 0 ? -m.diet * 0.05 : 0) + 0.1 * (m.girth ?? 0);
  const s = m.size;
  const lg = 1 + 0.22 * (m.limb ?? 0), lt = 1 + 0.35 * (m.limb ?? 0);
  // ein harter (gepanzerter) Kopf wird im Verhältnis zum Körper größer
  const hk = 1 + 0.28 * sk + 0.14 * Math.max(0, -(m.spike ?? 0)) * sk;
  const sn = m.snout ?? 0;
  switch (m.cls) {
    case 'fish': {
      const bw = 60 * (1 + 0.06 * st) * lk, bh = 28 * slim;
      const bb = bh * bellyK;
      const H = (bh * 0.95 + 1) * hk * (1 + 0.1 * jaw) * (1 - 0.1 * sn), L = (20 + 16 * jaw) * hk * (1 + 0.34 * sn);
      return {
        s, bw, bh,
        pts: [[bw * 0.38, -bh * 0.42], [bw * 0.12, -bh * 0.56], [-bw * 0.2, -bh * 0.45], [-bw * 0.44, -bh * 0.17], [-bw * 0.52, -bh * 0.1],
          [-bw * 0.52, bh * 0.1], [-bw * 0.4, bb * 0.26], [-bw * 0.05, bb * 0.5], [bw * 0.28, bb * 0.44], [bw * 0.4, bh * 0.3]],
        neck: [bw * 0.34, -bh * 0.03], tailAt: [-bw * 0.5, 0], legF: [0, 0], legB: [0, 0], legLen: 0, legW: 0,
        hg: { L, H, mouthY: H * 0.14, hingeX: L * (0.42 - 0.16 * jaw), jawH: 4 + 9 * jaw, dome: 4.5 * sk, snoutH: H * 0.3, ex: L * 0.4, ey: -H * 0.14, er: 2.8 * (1 + 0.25 * st) * (1 + 0.45 * Math.max(0, -(m.light ?? 0))) },
      };
    }
    case 'amphibian': {
      const bw = 70 * lk, bh = 22 * slim, bb = bh * bellyK;
      const H = (17 + 1.5 * sk) * hk, L = (26 + 10 * jaw) * hk;
      return {
        s, bw, bh,
        pts: [[bw * 0.44, -bh * 0.3], [bw * 0.16, -bh * 0.52], [-bw * 0.22, -bh * 0.48], [-bw * 0.48, -bh * 0.2], [-bw * 0.5, bh * 0.14],
          [-bw * 0.3, bb * 0.44], [0, bb * 0.55], [bw * 0.3, bb * 0.44], [bw * 0.46, bh * 0.16]],
        neck: [bw * 0.42, -bh * 0.06], tailAt: [-bw * 0.46, -bh * 0.04],
        legF: [bw * 0.26, bh * 0.28], legB: [-bw * 0.28, bh * 0.28], legLen: (15 + 7 * st) * lg, legW: 8 * lt,
        hg: { L, H, mouthY: H * 0.2, hingeX: L * (0.3 - 0.08 * jaw), jawH: 4 + 5 * jaw, dome: 2.5 * sk, snoutH: H * 0.24, ex: L * 0.3, ey: -H * 0.5, er: 2.5 * (1 + 0.25 * st) },
      };
    }
    case 'reptile': {
      const bw = 74 * lk, bh = 27 * slim, bb = bh * bellyK;
      const H = (18 + 2.5 * sk) * hk, L = (30 + 14 * jaw) * hk;
      return {
        s, bw, bh,
        pts: [[bw * 0.44, -bh * 0.36], [bw * 0.18, -bh * 0.55], [-bw * 0.12, -bh * 0.5], [-bw * 0.4, -bh * 0.36], [-bw * 0.5, -bh * 0.08],
          [-bw * 0.44, bb * 0.28], [-bw * 0.1, bb * 0.52], [bw * 0.26, bb * 0.46], [bw * 0.46, bh * 0.14]],
        neck: [bw * 0.42, -bh * 0.22], tailAt: [-bw * 0.46, -bh * 0.12],
        legF: [bw * 0.28, bh * 0.3], legB: [-bw * 0.3, bh * 0.3], legLen: (22 + 9 * st) * lg, legW: 9 * lt,
        hg: { L, H, mouthY: H * 0.16, hingeX: L * (0.26 - 0.06 * jaw), jawH: 5 + 6 * jaw, dome: 3 * sk, snoutH: H * 0.27, ex: L * 0.34, ey: -H * 0.24, er: 2.7 * (1 + 0.25 * st) },
      };
    }
    case 'mammal': {
      const bw = 74 * lk, bh = 33 * slim, bb = bh * bellyK;
      const H = (22 + 2.5 * sk) * hk, L = (26 + 12 * jaw) * hk;
      return {
        s, bw, bh,
        pts: [[bw * 0.42, -bh * 0.42], [bw * 0.22, -bh * 0.56], [-bw * 0.08, -bh * 0.48], [-bw * 0.36, -bh * 0.5], [-bw * 0.5, -bh * 0.24],
          [-bw * 0.48, bb * 0.2], [-bw * 0.18, bb * 0.47], [bw * 0.2, bb * 0.45], [bw * 0.46, bh * 0.14]],
        neck: [bw * 0.44, -bh * 0.28], tailAt: [-bw * 0.48, -bh * 0.3],
        legF: [bw * 0.3, bh * 0.24], legB: [-bw * 0.3, bh * 0.24], legLen: (28 + 11 * st) * lg, legW: 10 * lt,
        hg: { L, H, mouthY: H * 0.22, hingeX: L * (0.36 - 0.08 * jaw), jawH: 5 + 6 * jaw, dome: 3.5 * sk, snoutH: H * 0.3, ex: L * 0.42, ey: -H * 0.2, er: 2.6 * (1 + 0.2 * st) },
      };
    }
  }
}

export interface Layout {
  s: number;
  land: boolean;
  bw: number;
  bh: number;
  neck: [number, number];
  tail: [number, number];
  legF: [number, number];
  legB: [number, number];
  legLen: number;
  hg: HeadGeo;
  topY: number;
  footY: number;
  halfW: number;
  /** Bissbereich bei Blick nach rechts, relativ zum Ursprung */
  bite: { x: number; y: number; w: number; h: number };
}

export function layoutOf(m: Morph): Layout {
  const g = geo(m);
  const s = g.s;
  const land = m.cls !== 'fish';
  const sc = (p: [number, number]): [number, number] => [p[0] * s, p[1] * s];
  const neck = sc(g.neck);
  return {
    s, land, bw: g.bw * s, bh: g.bh * s,
    neck, tail: sc(g.tailAt), legF: sc(g.legF), legB: sc(g.legB), legLen: g.legLen * s, hg: g.hg,
    topY: -g.bh * 0.5 * s,
    footY: land ? (g.legF[1] + g.legLen) * s : g.bh * 0.45 * s,
    halfW: g.bw * 0.45 * s,
    bite: { x: neck[0] - 4 * s, y: neck[1] + (g.hg.mouthY - 18) * s, w: (g.hg.L + 22) * s, h: 36 * s },
  };
}

// ---------------------------------------------------------------------------
// Körper

function bodyPath(ctx: Ctx, g: Geo) {
  smooth(ctx, g.pts, true);
}

function drawBody(ctx: Ctx, m: Morph, P: Pal, g: Geo) {
  const { bw, bh } = g;
  const st = m.stealth;
  const r = mulberry32(m.seed + 3);
  // Rückenflosse / Rückenkamm hinter dem Körper
  if (m.cls === 'fish') {
    // Rückenflosse (crest) und Afterflosse (fin) – bei jeder Linie etwas anders groß
    const k = (1 + 0.6 * st) * (1 + 0.75 * (m.crest ?? 0)) * (1 + 0.8 * (m.fUp ?? 0));
    const ka = (1 + 0.6 * st) * (1 + 0.6 * (m.fin ?? 0)) * (1 + 0.9 * (m.fDown ?? 0));
    ctx.beginPath();
    ctx.moveTo(bw * 0.16, -bh * 0.5);
    ctx.bezierCurveTo(bw * 0.06, -bh * 0.5 - 12 * k, -bw * 0.06, -bh * 0.55 - 13 * k, -bw * 0.16, -bh * 0.52 - 10 * k);
    ctx.quadraticCurveTo(-bw * 0.2, -bh * 0.45, -bw * 0.3, -bh * 0.34);
    ctx.closePath();
    finFill(ctx, P, -bh * 0.5 - 13 * k, -bh * 0.4);
    ctx.beginPath();
    ctx.moveTo(-bw * 0.18, bh * 0.4);
    ctx.quadraticCurveTo(-bw * 0.28, bh * 0.5 + 9 * ka, -bw * 0.38, bh * 0.46 + 6 * ka);
    ctx.quadraticCurveTo(-bw * 0.36, bh * 0.32, -bw * 0.34, bh * 0.26);
    ctx.closePath();
    finFill(ctx, P, bh * 0.3, bh * 0.5 + 9 * ka);
    // Bauchflossen: wer viel nach unten geschwommen ist, bekommt größere Flossen unter dem Körper
    const fd = m.fDown ?? 0;
    if (fd > 0.05) {
      const fl = 5 + 15 * fd, fw = 5 + 7 * fd;
      for (const [ox, sc] of [[bw * 0.08, 1], [-bw * 0.06, 0.8]] as [number, number][]) {
        ctx.beginPath();
        ctx.moveTo(ox + fw * 0.5, bh * 0.4);
        ctx.quadraticCurveTo(ox - fw * 0.2, bh * 0.4 + fl * 0.9 * sc, ox - fw * 1.6, bh * 0.38 + fl * sc);
        ctx.quadraticCurveTo(ox - fw * 0.9, bh * 0.36 + fl * 0.35 * sc, ox - fw * 0.9, bh * 0.34);
        ctx.closePath();
        finFill(ctx, P, bh * 0.34, bh * 0.4 + fl);
      }
    }
    // Bauchflosse: wer sich oft am Grund abstützt, bekommt einen fleischigen Stiel
    const lb = m.limb ?? 0;
    if (lb > 0.1) lobe(ctx, m, P, -bw * 0.04, bh * 0.36, 7 + 9 * lb, 3 + 3 * lb, 1.1);
  }
  const cr = m.crest ?? 0;
  if (m.cls === 'amphibian' && cr > 0.1) {
    // Rückenkamm wie bei einem Molch
    const hgt = 3 + 7 * cr;
    ctx.beginPath();
    ctx.moveTo(bw * 0.3, -bh * 0.42);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      ctx.lineTo(bw * 0.3 - t * bw * 0.78, -bh * 0.48 - hgt * Math.sin(t * Math.PI) * (i % 2 ? 0.75 : 1));
    }
    ctx.lineTo(-bw * 0.48, -bh * 0.2);
    ctx.closePath();
    finFill(ctx, P, -bh * 0.5 - hgt, -bh * 0.4);
  }
  if (m.cls === 'reptile' || (m.cls === 'mammal' && m.skull > 0.6)) {
    // kleine Rückenhöcker (bei manchen Linien größer, bei anderen kaum zu sehen)
    const n = 9;
    const ck = Math.max(0.35, 1 + 0.6 * cr);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = bw * 0.3 - t * bw * 0.72;
      const y = -bh * 0.52 + Math.abs(t - 0.4) * bh * 0.22;
      ell(ctx, x, y, 3.2 * ck, (2.6 + m.skull * 1.5) * ck);
      ctx.fillStyle = css(shade(P.base, -0.35));
      ctx.fill();
    }
  }

  const path = () => bodyPath(ctx, g);
  skin(ctx, path, {
    base: P.base,
    top: shade(P.base, -0.38),
    belly: P.belly,
    bellyBand: [bh * 0.42, bh * 0.38, bw * 0.46, 0],
    y0: -bh * 0.55,
    y1: bh * 0.55,
    noise: m.cls === 'amphibian' ? 'mottle' : 'mottle',
    noiseAlpha: m.cls === 'amphibian' ? 0.7 : 0.45,
    noiseScale: 0.28,
    seed: m.seed,
    wet: m.cls === 'amphibian' || m.cls === 'fish',
    rim: 0.32,
    edge: P.dark,
    inner: (c) => {
      // Tarnmuster: wird mit "stealth" kräftiger
      const coat = m.coat ?? 0;
      const camoA = coat === 1 ? 0.78 : coat === 2 ? 0.1 : 0.08 + 0.62 * st;
      if (m.cls === 'fish' || m.cls === 'reptile') {
        // senkrechte, unregelmäßige Bänder (grün: sieben kräftige Querbinden wie beim Barsch)
        const nb = coat === 1 ? 7 : 6;
        for (let i = 0; i < nb; i++) {
          const x = bw * 0.32 - i * (coat === 1 ? 0.13 : 0.15) * bw + (r() - 0.5) * 6;
          c.beginPath();
          c.moveTo(x - 3, -bh);
          c.bezierCurveTo(x + 4 + r() * 4, -bh * 0.2, x - 5, bh * 0.1, x + 2, bh * 0.35);
          c.lineTo(x + 5 + r() * 3, bh * 0.3);
          c.bezierCurveTo(x + 1, bh * 0.05, x + 9, -bh * 0.25, x + 4 + r() * 3, -bh);
          c.closePath();
          c.fillStyle = css(P.camo, camoA);
          c.fill();
        }
      } else {
        // Flecken
        for (let i = 0; i < 16; i++) {
          const x = (r() - 0.5) * bw, y = -bh * 0.45 + r() * bh * 0.6;
          ell(c, x, y, 2 + r() * 4, 1.6 + r() * 2.6, r() * 3);
          c.fillStyle = css(P.camo, camoA * (0.6 + r() * 0.4));
          c.fill();
        }
      }
      // Schuppen / Fell / Warzen
      if (m.cls === 'fish') {
        // Robustheit: größere, deutlich umrandete Schuppen mit hellem Glanz – bis zum Schuppenpanzer
        const ar = m.armor ?? 0;
        const sc = 1 + 0.5 * ar;
        for (let row = 0, y = -bh * 0.6; y < bh * 0.6; y += 4.6 * sc, row++) {
          for (let x = -bw * 0.55; x < bw * 0.5; x += 5.6 * sc) {
            const sx = x + (row % 2) * 2.8 * sc;
            c.beginPath();
            c.arc(sx, y, 3 * sc, 0.2 * Math.PI, 0.8 * Math.PI);
            c.strokeStyle = css(P.dark, 0.16 + 0.42 * ar);
            c.lineWidth = 0.8 + 0.9 * ar;
            c.stroke();
            if (ar > 0.15) {
              c.beginPath();
              c.arc(sx, y - 0.9 * sc, 2.2 * sc, 0.3 * Math.PI, 0.7 * Math.PI);
              c.strokeStyle = css(shade(P.belly, 0.3), 0.32 * ar);
              c.lineWidth = 0.7;
              c.stroke();
            }
          }
        }
        // ab einem gewissen Grad: eine Reihe Knochenschilde auf dem Rücken und entlang der Seite
        if (ar > 0.3) {
          const k = Math.min(1, (ar - 0.3) / 0.5);
          for (const [y0, n, s] of [[-bh * 0.43, 7, 1], [bh * 0.02, 6, 0.75]] as [number, number, number][]) {
            for (let i = 0; i < n; i++) {
              const x = bw * 0.28 - (i / (n - 1)) * bw * 0.72;
              const w = (2.6 + 2.2 * k) * s, h = (1.8 + 1.6 * k) * s;
              const y = y0 + Math.abs(i / (n - 1) - 0.35) * bh * (y0 < 0 ? 0.2 : 0);
              c.beginPath();
              c.moveTo(x - w, y);
              c.lineTo(x, y - h);
              c.lineTo(x + w, y);
              c.lineTo(x, y + h);
              c.closePath();
              c.fillStyle = css(mix(P.base, 0xc4baa2, 0.5), 0.35 + 0.5 * k);
              c.fill();
              c.strokeStyle = css(P.dark, 0.6 * k + 0.2);
              c.lineWidth = 0.8;
              c.stroke();
            }
          }
        }
        // Seitenlinie
        c.beginPath();
        c.moveTo(bw * 0.3, -bh * 0.05);
        c.quadraticCurveTo(-bw * 0.05, bh * 0.02, -bw * 0.5, 0);
        c.strokeStyle = css(P.belly, 0.25);
        c.lineWidth = 1;
        c.stroke();
        // Schwarmfisch: ein dunkles Längsband an der Flanke mit hellem, silbrigem Saum – daran erkennt sich der Schwarm
        const school = plateLevel(m.sw ?? 0);
        if (school > 0.08) {
          const band = (dy: number, w: number, col: string) => {
            c.beginPath();
            c.moveTo(bw * 0.36, -bh * 0.08 + dy);
            c.quadraticCurveTo(-bw * 0.04, -bh * 0.02 + dy, -bw * 0.54, bh * 0.02 + dy);
            c.strokeStyle = col;
            c.lineWidth = w;
            c.lineCap = 'round';
            c.stroke();
          };
          band(-bh * (0.08 + 0.05 * school), 1.2 + 1.2 * school, css(shade(P.belly, 0.35), 0.25 + 0.45 * school));
          band(0, 1.5 + bh * 0.14 * school, css(P.dark, 0.3 + 0.45 * school));
        }
      } else if (m.cls === 'reptile') {
        c.strokeStyle = css(P.dark, 0.22);
        c.lineWidth = 0.7;
        for (let x = -bw - bh; x < bw + bh; x += 4.2) {
          c.beginPath();
          c.moveTo(x, -bh);
          c.lineTo(x + bh * 2, bh);
          c.moveTo(x, bh);
          c.lineTo(x + bh * 2, -bh);
          c.stroke();
        }
        // Bauchschilde
        for (let x = -bw * 0.4; x < bw * 0.4; x += 5) {
          c.beginPath();
          c.moveTo(x, bh * 0.3);
          c.lineTo(x + 1, bh * 0.6);
          c.strokeStyle = css(P.dark, 0.18);
          c.stroke();
        }
      } else if (m.cls === 'amphibian') {
        for (let i = 0; i < 40; i++) {
          const x = (r() - 0.5) * bw, y = -bh * 0.5 + r() * bh * 0.7;
          ell(c, x, y, 0.8 + r() * 1.1, 0.8 + r() * 1.1);
          c.fillStyle = r() > 0.5 ? css(shade(P.base, 0.25), 0.4) : css(P.dark, 0.3);
          c.fill();
        }
      } else {
        // Fell: kurze Striche in Wuchsrichtung
        for (let i = 0; i < 260; i++) {
          const x = (r() - 0.5) * bw * 1.05, y = (r() - 0.5) * bh * 1.05;
          c.beginPath();
          c.moveTo(x, y);
          c.quadraticCurveTo(x - 2.5, y + 1, x - 4.5, y + 2.4);
          c.strokeStyle = r() > 0.55 ? css(shade(P.base, 0.22), 0.35) : css(P.dark, 0.32);
          c.lineWidth = 0.9;
          c.stroke();
        }
      }
      // Hunger: Rippen werden sichtbar
      if (m.belly === 0) {
        for (let i = 0; i < 6; i++) {
          const x = bw * 0.18 - i * 6;
          c.beginPath();
          c.moveTo(x, -bh * 0.18);
          c.quadraticCurveTo(x - 4, bh * 0.1, x - 2, bh * 0.32);
          c.strokeStyle = 'rgba(0,0,0,0.32)';
          c.lineWidth = 1.6;
          c.stroke();
          c.beginPath();
          c.moveTo(x + 1.5, -bh * 0.16);
          c.quadraticCurveTo(x - 2.5, bh * 0.1, x - 0.5, bh * 0.3);
          c.strokeStyle = 'rgba(255,230,200,0.12)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      // Knochenplatten am Nacken (Fisch mit dickem Schädel)
      if (m.cls === 'fish' && m.skull > 0.15) {
        const a = Math.min(1, (m.skull - 0.15) / 0.5);
        c.beginPath();
        c.moveTo(bw * 0.42, -bh * 0.6);
        c.quadraticCurveTo(bw * 0.12, -bh * 0.62, bw * 0.06, -bh * 0.2);
        c.quadraticCurveTo(bw * 0.2, bh * 0.1, bw * 0.42, bh * 0.25);
        c.closePath();
        c.fillStyle = css(mix(P.base, 0x9a907a, 0.55), a * 0.9);
        c.fill();
        c.strokeStyle = css(P.dark, a * 0.6);
        c.lineWidth = 1;
        c.stroke();
      }
      scars(c, m, bw, bh, r);
    },
  });
}

function finFill(ctx: Ctx, P: Pal, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, css(shade(P.fin, -0.2), 0.75));
  g.addColorStop(1, css(P.fin, 0.92));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = css(P.dark, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function scars(c: Ctx, m: Morph, bw: number, bh: number, r: () => number) {
  for (let i = 0; i < m.scars; i++) {
    const x = (r() - 0.5) * bw * 0.7, y = (r() - 0.6) * bh * 0.7;
    const len = 6 + r() * 8, a = -0.6 + r() * 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    c.strokeStyle = 'rgba(40,14,10,0.6)';
    c.lineWidth = 2.2;
    c.stroke();
    c.strokeStyle = 'rgba(214,170,150,0.55)';
    c.lineWidth = 1;
    c.stroke();
  }
}

// ---------------------------------------------------------------------------
// Kopf

function headPath(ctx: Ctx, hg: HeadGeo, open = false) {
  const { L, H, mouthY, hingeX, dome, snoutH } = hg;
  const top = -H / 2, bot = H / 2;
  ctx.beginPath();
  ctx.moveTo(-8, top * 0.82);
  ctx.bezierCurveTo(L * 0.12, top * 1.05 - dome, L * 0.46, top * 0.98 - dome * 0.7, L * 0.86, mouthY - snoutH);
  ctx.quadraticCurveTo(L + 2.5, mouthY - snoutH * 0.55, L, mouthY);
  ctx.lineTo(hingeX, mouthY);
  ctx.quadraticCurveTo(hingeX - 3, bot * 0.92, -2, bot * 0.86);
  if (open) return;
  ctx.bezierCurveTo(-9, bot * 0.55, -11, top * 0.35, -8, top * 0.82);
  ctx.closePath();
}

function drawHead(ctx: Ctx, m: Morph, P: Pal, hg: HeadGeo) {
  const { L, H, mouthY, hingeX } = hg;
  const top = -H / 2;
  const sk = m.skull;
  const r = mulberry32(m.seed + 9);
  // Hinter dem Kopf: Nackenschild (Echse), Ohren (Säuger)
  if (m.cls === 'reptile' && sk > 0.7) {
    const a = (sk - 0.7) / 0.3;
    ctx.beginPath();
    ctx.moveTo(-4, top * 0.4);
    for (let i = 0; i <= 6; i++) {
      const ang = -Math.PI * 0.55 - (i / 6) * Math.PI * 0.5;
      const rr = H * (0.7 + 0.35 * a) + (i % 2 ? 0 : 2.5);
      ctx.lineTo(-4 + Math.cos(ang) * rr, top * 0.4 + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = css(shade(P.base, -0.25));
    ctx.fill();
    ctx.strokeStyle = css(P.dark, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (m.cls === 'mammal') {
    const es = 7 * (1 + 0.6 * m.stealth);
    for (const [ox, far] of [[2, true], [8, false]] as const) {
      ctx.beginPath();
      ctx.moveTo(ox - es * 0.5, top * 0.6);
      ctx.quadraticCurveTo(ox - es * 0.4, top - es * 0.9, ox + es * 0.1, top - es);
      ctx.quadraticCurveTo(ox + es * 0.5, top - es * 0.4, ox + es * 0.55, top * 0.55);
      ctx.closePath();
      ctx.fillStyle = css(far ? shade(P.base, -0.35) : shade(P.base, -0.1));
      ctx.fill();
      ctx.strokeStyle = css(P.dark, 0.9);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      if (!far) {
        ctx.beginPath();
        ctx.moveTo(ox - es * 0.2, top * 0.6);
        ctx.quadraticCurveTo(ox - es * 0.1, top - es * 0.6, ox + es * 0.1, top - es * 0.7);
        ctx.quadraticCurveTo(ox + es * 0.3, top - es * 0.3, ox + es * 0.3, top * 0.6);
        ctx.closePath();
        ctx.fillStyle = 'rgba(90,50,44,0.8)';
        ctx.fill();
      }
    }
  }
  // Maulhöhle (wird sichtbar, wenn der Kiefer aufgeht)
  ctx.beginPath();
  ctx.moveTo(hingeX, mouthY);
  ctx.lineTo(L - 1, mouthY);
  ctx.lineTo(L - 4, mouthY + hg.jawH);
  ctx.lineTo(hingeX + 1, mouthY + hg.jawH * 0.85);
  ctx.closePath();
  ctx.fillStyle = '#2a0a0c';
  ctx.fill();

  const path = () => headPath(ctx, hg);
  skin(ctx, path, {
    outline: () => headPath(ctx, hg, true),
    base: P.base,
    top: shade(P.base, -0.38),
    belly: P.belly,
    bellyBand: [H * 0.42, H * 0.3, L * 0.6, L * 0.35],
    y0: top - hg.dome,
    y1: H / 2,
    noise: 'mottle',
    noiseAlpha: m.cls === 'amphibian' ? 0.7 : 0.45,
    noiseScale: 0.28,
    seed: m.seed + 1,
    wet: m.cls === 'amphibian' || m.cls === 'fish',
    edge: P.dark,
    inner: (c) => {
      // Knochige Struktur, wächst mit "skull"
      if (sk > 0.05) {
        const a = Math.min(1, sk * 1.3);
        {
          // Grübchen und Leisten: Der Schädel wird fester – ohne dass etwas dazuwächst
          for (let i = 0; i < 26; i++) {
            const x = -4 + r() * L * 0.75, y = top - hg.dome * 0.5 + r() * H * 0.45;
            ell(c, x, y, 0.7 + r() * 0.8, 0.6 + r() * 0.7);
            c.fillStyle = css(P.dark, 0.35 * a);
            c.fill();
          }
          c.beginPath();
          c.moveTo(-6, top * 0.75 - hg.dome * 0.6);
          c.quadraticCurveTo(L * 0.3, top * 1.02 - hg.dome, L * 0.6, top * 0.7);
          c.strokeStyle = css(shade(P.base, 0.3), 0.35 * a);
          c.lineWidth = 1.6;
          c.stroke();
        }
      }
      if (m.cls === 'mammal') {
        for (let i = 0; i < 70; i++) {
          const x = -8 + r() * L * 0.8, y = top + r() * H * 0.8;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 3, y + 1.5);
          c.strokeStyle = r() > 0.5 ? css(shade(P.base, 0.2), 0.3) : css(P.dark, 0.3);
          c.lineWidth = 0.8;
          c.stroke();
        }
      }
      // Männchen tragen einen farbigen Kehlfleck
      if (m.sex === 1) {
        ell(c, L * 0.32, H * 0.3, L * 0.24, H * 0.17, -0.15);
        c.fillStyle = css(mix(P.base, 0xb4502c, 0.7), 0.85);
        c.fill();
        ell(c, L * 0.3, H * 0.27, L * 0.12, H * 0.07, -0.15);
        c.fillStyle = 'rgba(255,200,150,0.18)';
        c.fill();
      }
      // Kiemendeckel
      if (m.cls === 'fish') {
        c.beginPath();
        c.arc(-12, 1, 15, -0.55, 0.6);
        c.strokeStyle = css(P.dark, 0.55);
        c.lineWidth = 1.3;
        c.stroke();
        // Beißfisch: ein kräftiger Kaumuskel wölbt die Wange hinter dem Maulwinkel
        if (m.jaw > 0.2) {
          const a = Math.min(1, (m.jaw - 0.2) / 0.5);
          ell(c, hingeX - 1, mouthY - 1.5 - 1.5 * a, 3 + 4 * a, 2 + 2.6 * a, -0.25);
          c.fillStyle = css(shade(P.base, -0.3), 0.25 + 0.3 * a);
          c.fill();
          ell(c, hingeX - 2, mouthY - 3 - 2 * a, 1.6 + 2 * a, 0.8 + 0.8 * a, -0.25);
          c.fillStyle = `rgba(255,236,200,${0.1 + 0.12 * a})`;
          c.fill();
        }
        // Stoßfisch: die Kopfplatte – ein Knochenschild über Stirn, Schnauze und Wange, mit Nähten und Höckern
        // (schon die erste Stufe soll man sehen – die Kopfplatte wächst vor allem mit spike, der Schädel macht sie fester)
        const pl = Math.max(0, -(m.spike ?? 0)) * (0.4 + sk);
        if (pl > 0.04) {
          const a = Math.min(1, Math.sqrt(pl / 0.6));
          const crown = top - hg.dome;
          c.beginPath();
          c.moveTo(-10, top * 0.92);
          c.bezierCurveTo(L * 0.1, crown * 1.06, L * 0.55, crown * 0.96, L * 0.9, mouthY - hg.snoutH * 0.95);
          c.lineTo(L + 2, mouthY - 0.5);
          c.quadraticCurveTo(L * 0.62, hg.ey + hg.er * (1.4 + a), L * 0.18, hg.ey + hg.er * (1.9 + 1.4 * a));
          c.quadraticCurveTo(-4, H * 0.08, -10, top * 0.15);
          c.closePath();
          c.fillStyle = css(mix(P.base, 0xbab09a, 0.35 + 0.35 * a), 0.45 + 0.45 * a);
          c.fill();
          c.strokeStyle = css(P.dark, 0.45 + 0.35 * a);
          c.lineWidth = 0.9 + 0.9 * a;
          c.stroke();
          // Nähte zwischen den einzelnen Platten
          c.beginPath();
          c.moveTo(L * 0.16, crown * 0.98);
          c.quadraticCurveTo(L * 0.2, hg.ey, L * 0.24, hg.ey + hg.er * 1.7);
          c.moveTo(L * 0.56, crown * 0.86);
          c.quadraticCurveTo(L * 0.6, hg.ey - hg.er, L * 0.52, hg.ey - hg.er * 1.3);
          c.strokeStyle = css(P.dark, 0.25 + 0.3 * a);
          c.lineWidth = 0.8;
          c.stroke();
          // Höcker und ein heller Grat oben auf der Platte
          for (let i = 0; i < Math.round(4 + 6 * a); i++) {
            const x = L * (0.05 + 0.75 * r()), y = crown * (0.75 + 0.15 * r());
            ell(c, x, y, 0.7 + 0.5 * a, 0.6 + 0.4 * a);
            c.fillStyle = `rgba(255,244,220,${0.25 + 0.25 * a})`;
            c.fill();
          }
          c.beginPath();
          c.moveTo(-6, top * 0.95);
          c.bezierCurveTo(L * 0.12, crown * 1.02, L * 0.5, crown * 0.93, L * 0.82, mouthY - hg.snoutH * 1.05);
          c.strokeStyle = `rgba(255,244,220,${0.18 + 0.2 * a})`;
          c.lineWidth = 1.1;
          c.stroke();
        }
      }
      scars(c, m, L * 0.8, H * 0.6, r);
    },
  });

  // Höcker, Hörner, Kämme – je nach Körperform
  drawSkullGrowth(ctx, m, P, hg);

  // Auge
  if (m.cls === 'amphibian') {
    ell(ctx, hg.ex, hg.ey + 0.5, hg.er + 2.4, hg.er + 1.8);
    ctx.fillStyle = css(shade(P.base, -0.15));
    ctx.fill();
    ctx.strokeStyle = css(P.dark, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  eye(ctx, hg.ex, hg.ey, hg.er, P.eye, { slit: m.cls === 'reptile' || m.cls === 'amphibian', lid: 0.15 + m.fierce * 0.45 });
  // Augenwulst wächst mit dem Schädel
  if (sk > 0.15 && m.cls !== 'fish') {
    ctx.beginPath();
    ctx.moveTo(hg.ex - hg.er * 1.6, hg.ey - hg.er * 0.9);
    ctx.quadraticCurveTo(hg.ex, hg.ey - hg.er * (1.6 + sk), hg.ex + hg.er * 1.8, hg.ey - hg.er * 0.7);
    ctx.strokeStyle = css(shade(P.base, -0.45));
    ctx.lineWidth = 1.4 + sk * 2.2;
    ctx.stroke();
  }
  // Nasenloch / Nase
  if (m.cls === 'mammal') {
    ell(ctx, L - 1.2, mouthY - hg.snoutH * 0.72, 3.2, 2.4);
    ctx.fillStyle = '#1a1210';
    ctx.fill();
    ell(ctx, L - 2, mouthY - hg.snoutH * 0.8, 1, 0.6);
    ctx.fillStyle = 'rgba(255,240,220,0.35)';
    ctx.fill();
  } else if (m.cls !== 'fish') {
    ell(ctx, L - 3.5, mouthY - hg.snoutH * 0.8, 1.1, 0.8);
    ctx.fillStyle = '#0c0806';
    ctx.fill();
  }
}

function boneFill(ctx: Ctx, y0: number, y1: number) {
  ctx.fillStyle = ivory(ctx, y0, y1, 1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,22,12,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Knochenwuchs am Kopf. Alles wächst stufenlos mit dem Merkmal "skull". */
function drawSkullGrowth(ctx: Ctx, m: Morph, P: Pal, hg: HeadGeo) {
  const sp = m.spike ?? 0;
  // Ein harter Kopf wird größer und fester (siehe Kopfmaße) – Fische bekommen keinen Aufsatz
  if (m.cls === 'fish') return;
  void sp;
  const sk = m.skull;
  const { L, H, mouthY, snoutH, dome } = hg;
  const top = -H / 2;
  const grow = (from: number, to = 1) => Math.max(0, Math.min(1, (sk - from) / (to - from)));
  const fx = L * 0.3, fy = top - dome * 0.95;
  const nx = L * 0.78, ny = mouthY - snoutH - 0.5;
  const cone = (bx: number, by: number, w: number, tx: number, ty: number) => {
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, by + 2);
    ctx.quadraticCurveTo(bx - w * 0.15, by - (by - ty) * 0.55, tx, ty);
    ctx.quadraticCurveTo(bx + w * 0.3, by - (by - ty) * 0.3, bx + w / 2, by + 2);
    ctx.closePath();
    boneFill(ctx, ty, by);
  };
  switch (m.cls) {
    case 'amphibian': {
      const k = grow(0.3);
      if (k > 0) {
        for (const dx of [-3, 3]) {
          ell(ctx, hg.ex + dx, hg.ey - hg.er - 1 - 1.5 * k, 1.5 + 2 * k, 1.2 + 1.6 * k);
          boneFill(ctx, hg.ey - 6, hg.ey);
        }
      }
      const n = grow(0.55);
      if (n > 0) {
        ell(ctx, nx - 2, ny - 1 - n * 2, 2 + 3.5 * n, 1.5 + 2.6 * n);
        boneFill(ctx, ny - 6, ny);
      }
      break;
    }
    case 'reptile': {
      const n = grow(0.35);
      if (n > 0) cone(nx, ny + 1, 4 + 7 * n, nx + 1 + 2 * n, ny - 2 - 12 * n);
      const c = grow(0.5);
      if (c > 0) {
        for (const [x, y] of [[-6, top * 0.2], [-2, H * 0.25]]) {
          cone(x, y, 3 + 3 * c, x - 4 - 5 * c, y - 2 - 4 * c);
        }
      }
      const b = grow(0.2, 0.7);
      if (b > 0) {
        ell(ctx, fx, fy + 2, 2 + 4 * b, 1.5 + 3 * b);
        boneFill(ctx, fy - 4, fy + 4);
      }
      break;
    }
    case 'mammal': {
      const b = grow(0.2, 0.6);
      if (b > 0) {
        ell(ctx, fx - 2, fy + 3, 3 + 5 * b, 2 + 3 * b);
        ctx.fillStyle = css(shade(P.base, -0.2));
        ctx.fill();
      }
      const k = grow(0.45);
      if (k > 0) {
        for (const off of [-3, 2]) cone(fx + off, fy + 3, 4 + 3 * k, fx + off + 2 + 2 * k, fy - 3 - 9 * k);
      }
      const h = grow(0.7);
      if (h > 0) cone(nx, ny + 1, 5 + 7 * h, nx + 3 + 3 * h, ny - 3 - 16 * h);
      break;
    }
  }
}

function teethCount(m: Morph) {
  switch (m.cls) {
    case 'fish': return Math.round(2 + 10 * m.jaw);
    case 'amphibian': return Math.round(3 + 7 * m.jaw);
    case 'reptile': return Math.round(4 + 8 * m.jaw);
    case 'mammal': return Math.round(3 + 4 * m.jaw);
  }
}

function drawTeeth(ctx: Ctx, m: Morph, hg: HeadGeo) {
  const { L, mouthY, hingeX } = hg;
  const herb = m.diet < -0.3;
  const carn = Math.max(0, m.diet);
  const n = teethCount(m);
  const len = (0.8 + (m.cls === 'fish' ? 6.5 : 4.5) * m.jaw) * (herb ? 0.6 : 1) * (1 + 0.3 * carn);
  const span = L - hingeX - 4;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = hingeX + 2 + t * span;
    const big = m.cls === 'amphibian' && m.jaw > 0.55 && i === n - 2;
    tooth(ctx, x, mouthY - 0.4, 1.6 + len * 0.45, len * (big ? 1.7 : 0.75 + 0.35 * Math.sin(t * 9 + i)), 1, herb, 0.2);
  }
  // Reißzähne: wer viel Fleisch frisst, dem wachsen vorn lange, spitze Zähne aus dem Maul
  const fg = m.fang ?? 0;
  if (fg > 0.1 && !herb) {
    const fl = 3 + 13 * fg;
    tooth(ctx, L * 0.9 - 1, mouthY - 0.6, 1.8 + fl * 0.2, fl, 1, false, 0.32);
    if (fg > 0.35) tooth(ctx, L * 0.72, mouthY - 0.6, 1.6 + fl * 0.16, fl * 0.75, 1, false, 0.28);
  }
  if (m.cls === 'mammal') {
    // Eckzahn – wird bei starkem Kiefer und Fleischkost zum Säbelzahn
    const sabre = m.jaw > 0.6 && m.diet > 0.2 ? (m.jaw - 0.6) / 0.4 : 0;
    const cl = (2.5 + 7 * m.jaw) * (herb ? 0.5 : 1) + sabre * 9;
    tooth(ctx, L * 0.74, mouthY - 0.5, 2.4 + cl * 0.18, cl, 1, false, 0.25);
  }
}

function drawJaw(ctx: Ctx, m: Morph, P: Pal, hg: HeadGeo) {
  const len = hg.L - hg.hingeX - 1;
  const h = hg.jawH;
  const herb = m.diet < -0.3;
  const n = Math.max(0, teethCount(m) - 1);
  const tl = (0.8 + (m.cls === 'fish' ? 6.5 : 4.5) * m.jaw) * (herb ? 0.6 : 1) * 0.75;
  for (let i = 0; i < n; i++) {
    const x = 3 + ((i + 0.5) * (len - 7)) / n;
    tooth(ctx, x, 0.4, 1.4 + tl * 0.45, tl, -1, herb, -0.2);
  }
  // unterer Reißzahn, der über die Oberlippe ragt
  const fg = m.fang ?? 0;
  if (fg > 0.45 && !herb) tooth(ctx, len - 5, 0.4, 1.6 + fg * 2.4, 3 + 9 * fg, -1, false, -0.3);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-2, -0.4);
    ctx.lineTo(len, -0.4);
    ctx.quadraticCurveTo(len + 1.5, h * 0.55, len - 4, h);
    ctx.quadraticCurveTo(len * 0.45, h * (1.2 + m.jaw * 0.2), -3, h * 0.8);
    ctx.closePath();
  };
  skin(ctx, path, { base: shade(P.base, -0.05), belly: P.belly, bellyBand: [h, h * 0.8, len * 0.6, len * 0.45], y0: 0, y1: h * 1.2, noise: 'mottle', noiseAlpha: 0.35, noiseScale: 0.28, seed: m.seed + 2, edge: P.dark, rim: 0.15 });
  // Kaumuskel wächst mit dem Kiefer
  if (m.jaw > 0.25) {
    ell(ctx, len * 0.18, h * 0.45, 3 + 3 * m.jaw, h * 0.32);
    ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.15 * m.jaw})`;
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Schwanz, Beine, Flossen

function drawTail(ctx: Ctx, m: Morph, P: Pal, g: Geo) {
  const st = m.stealth;
  if (m.cls === 'fish') {
    const sw = 1 + 0.35 * (m.swift ?? 0), tw = m.tail ?? 0, ft = m.fTail ?? 0;
    const lobe = (16 + 16 * st) * sw * (1 + 0.28 * tw) * (1 + 0.3 * ft), fork = 3 + 11 * st + 6 * ft, spread = (13 + 9 * st) * sw * (1 + 0.65 * tw) * (1 + 0.5 * ft);
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-lobe * 0.4, -spread * 0.6, -lobe, -spread);
    ctx.quadraticCurveTo(-lobe + fork * 0.3, -spread * 0.3, -lobe + fork, 0);
    ctx.quadraticCurveTo(-lobe + fork * 0.3, spread * 0.3, -lobe, spread);
    ctx.quadraticCurveTo(-lobe * 0.4, spread * 0.6, -4, 4);
    ctx.closePath();
    finFill(ctx, P, -spread, spread);
    ctx.strokeStyle = css(P.dark, 0.35);
    ctx.lineWidth = 0.7;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-5, i * 0.9);
      ctx.lineTo(-lobe * 0.85, i * spread * 0.27);
      ctx.stroke();
    }
    const pd = () => {
      ctx.beginPath();
      ctx.moveTo(6, -g.bh * 0.12);
      ctx.lineTo(-6, -4.5);
      ctx.lineTo(-6, 4.5);
      ctx.lineTo(6, g.bh * 0.12);
      ctx.closePath();
    };
    skin(ctx, pd, { base: P.base, belly: P.belly, y0: -6, y1: 6, noise: 'mottle', noiseAlpha: 0.4, noiseScale: 0.28, seed: m.seed, edge: P.dark, edgeW: 0.01 });
    return;
  }
  const len = m.cls === 'amphibian' ? 46 * (1 + 0.3 * st) : m.cls === 'reptile' ? 56 * (1 + 0.35 * st) : 30 * (1 + 0.45 * st);
  const baseH = g.bh * (m.cls === 'mammal' ? 0.32 : 0.5) * (1 + 0.25 * (m.tail ?? 0));
  const tipY = m.cls === 'mammal' ? -6 : -2;
  const tailLine = () => {
    ctx.beginPath();
    ctx.moveTo(6, -baseH / 2);
    ctx.bezierCurveTo(-len * 0.3, -baseH * 0.5, -len * 0.7, tipY - baseH * 0.15, -len, tipY);
    ctx.bezierCurveTo(-len * 0.7, tipY + baseH * 0.12, -len * 0.3, baseH * 0.45, 6, baseH / 2);
  };
  const path = () => {
    tailLine();
    ctx.closePath();
  };
  if (m.cls === 'amphibian') {
    // Flossensaum, wird mit der Zeit schmaler
    const fh = 5 * (1 - 0.5 * st) * (1 + 0.6 * (m.tail ?? 0));
    ctx.beginPath();
    ctx.moveTo(2, -baseH / 2);
    ctx.quadraticCurveTo(-len * 0.5, -baseH / 2 - fh * 1.6, -len, tipY - 1);
    ctx.lineTo(-len, tipY + 1);
    ctx.quadraticCurveTo(-len * 0.5, baseH / 2 + fh * 1.2, 2, baseH / 2);
    ctx.closePath();
    finFill(ctx, P, -baseH, baseH);
  }
  const r = mulberry32(m.seed + 5);
  skin(ctx, path, {
    outline: tailLine,
    base: P.base,
    top: shade(P.base, -0.35),
    belly: P.belly,
    bellyBand: [baseH * 0.4, baseH * 0.3, len * 0.5, -len * 0.4],
    y0: -baseH,
    y1: baseH,
    noise: 'mottle',
    noiseAlpha: m.cls === 'amphibian' ? 0.7 : 0.45,
    noiseScale: 0.28,
    seed: m.seed + 4,
    edge: P.dark,
    wet: m.cls === 'amphibian',
    inner: (c) => {
      const camoA = 0.1 + 0.6 * st;
      for (let i = 1; i < 6; i++) {
        const x = -len * (i / 6);
        c.fillStyle = css(P.camo, camoA);
        c.fillRect(x - 2, -baseH, 3.2 + r() * 2, baseH * 2);
      }
      if (m.cls === 'mammal') {
        for (let i = 0; i < 40; i++) {
          const x = -r() * len, y = (r() - 0.5) * baseH;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 3.5, y + 1.6);
          c.strokeStyle = css(P.dark, 0.35);
          c.lineWidth = 0.9;
          c.stroke();
        }
      }
    },
  });
  if (m.cls === 'mammal') {
    // Quaste an der Spitze
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(-len + 4, tipY);
      ctx.lineTo(-len - 4 - (i % 3) * 1.5, tipY - 4 + i);
      ctx.strokeStyle = css(shade(P.base, -0.45), 0.9);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
}

function drawLeg(ctx: Ctx, m: Morph, P: Pal, len: number, w: number) {
  const hoof = m.cls === 'mammal' && m.diet < -0.4 && m.stealth > 0.3;
  const thigh = w * 1.2;
  const ankle = w * (m.cls === 'mammal' ? 0.42 : 0.5);
  const knee = m.cls === 'amphibian' ? len * 0.06 : len * (m.cls === 'mammal' ? 0.12 : 0.15);
  const legLine = () => {
    ctx.beginPath();
    ctx.moveTo(-thigh * 0.62, -6);
    ctx.bezierCurveTo(-thigh * 0.9, len * 0.28, -ankle * 0.4 + knee, len * 0.52, -ankle * 0.55, len - 3);
    ctx.lineTo(ankle * 0.6 + 1, len - 3);
    ctx.bezierCurveTo(ankle * 0.8 + knee, len * 0.5, thigh * 0.85, len * 0.25, thigh * 0.62, -6);
  };
  const path = () => {
    legLine();
    ctx.closePath();
  };
  skin(ctx, path, { outline: legLine, base: P.base, top: P.base, belly: shade(P.base, -0.2), y0: -6, y1: len, noise: 'mottle', noiseAlpha: 0.45, noiseScale: 0.28, seed: m.seed + 7, edge: P.dark, rim: 0.2 });
  // Fuß
  if (m.cls === 'amphibian') {
    for (let i = 0; i < 4; i++) {
      const a = -0.5 + i * 0.35;
      ctx.beginPath();
      ctx.moveTo(1, len - 2.5);
      ctx.lineTo(1 + Math.cos(a) * 6.5, len - 1.5 + Math.sin(a) * 2.5);
      ctx.strokeStyle = css(shade(P.base, -0.25));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (hoof) {
    ctx.beginPath();
    ctx.moveTo(-ankle * 0.7, len - 4);
    ctx.lineTo(ankle * 0.9 + 1, len - 4);
    ctx.lineTo(ankle + 1.5, len + 0.5);
    ctx.lineTo(-ankle * 0.8, len + 0.5);
    ctx.closePath();
    ctx.fillStyle = '#1c1612';
    ctx.fill();
  } else {
    ell(ctx, 2.5, len - 2.2, w * 0.68, 2.6);
    ctx.fillStyle = css(shade(P.base, -0.3));
    ctx.fill();
    ctx.strokeStyle = css(P.dark, 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Krallen: länger bei Fleischfressern
    const cl = 2 + 2.5 * Math.max(0, m.diet) + 1.5 * m.jaw;
    for (let i = 0; i < 3; i++) {
      const x = w * 0.45 + i * 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 1, len - 3.2);
      ctx.quadraticCurveTo(x + cl, len - 2.5, x + cl * 0.8, len + 1.2);
      ctx.lineTo(x, len - 1);
      ctx.closePath();
      ctx.fillStyle = '#d8ccb0';
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,8,0.8)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

/**
 * Eine fleischige Stützflosse (wie bei den Quastenflossern): ein muskulöser Stiel mit Knochen
 * darin, an dessen Ende ein Saum aus Flossenstrahlen sitzt.
 */
function lobe(ctx: Ctx, m: Morph, P: Pal, x: number, y: number, len: number, w: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // Flossensaum am Ende
  ctx.beginPath();
  ctx.moveTo(len * 0.7, -w * 0.9);
  ctx.quadraticCurveTo(len + w * 2.2, -w * 1.2, len + w * 2.4, 0);
  ctx.quadraticCurveTo(len + w * 2.2, w * 1.3, len * 0.7, w * 0.9);
  ctx.closePath();
  finFill(ctx, P, -w, w);
  ctx.strokeStyle = css(P.dark, 0.35);
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(len * 0.8, i * w * 0.3);
    ctx.lineTo(len + w * 2.2, i * w * 0.5);
    ctx.stroke();
  }
  // muskulöser Stiel
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.bezierCurveTo(len * 0.4, -w * 1.25, len * 0.8, -w * 0.9, len, -w * 0.45);
    ctx.quadraticCurveTo(len + w * 0.6, 0, len, w * 0.45);
    ctx.bezierCurveTo(len * 0.8, w * 0.9, len * 0.4, w * 1.2, 0, w);
    ctx.closePath();
  };
  skin(ctx, path, { base: P.base, top: shade(P.base, -0.25), belly: P.belly, y0: -w, y1: w, noise: 'mottle', noiseAlpha: 0.35, noiseScale: 0.4, seed: m.seed + 13, edge: P.dark, rim: 0.25, wet: true });
  ctx.restore();
}

function drawFin(ctx: Ctx, m: Morph, P: Pal) {
  const lb = m.limb ?? 0;
  if (lb > 0.1) {
    // Brustflosse mit kräftigem Stiel – damit stützt sich der Fisch am Grund ab
    lobe(ctx, m, P, 0, 0, (8 + 10 * lb) * (1 + 0.2 * (m.fin ?? 0)) * (1 + 0.6 * (m.fSide ?? 0)), 3 + 3.2 * lb, 2.4);
    return;
  }
  // Seitenflossen: wer oft die Richtung gewechselt hat, bekommt größere
  const k = (1 + 0.5 * m.stealth) * (1 + 0.6 * (m.fin ?? 0)) * (1 + 0.95 * (m.fSide ?? 0));
  ctx.beginPath();
  ctx.moveTo(1, -2.5);
  ctx.quadraticCurveTo(-5 * k, 9 * k, -14 * k, 10 * k);
  ctx.quadraticCurveTo(-8 * k, 4 * k, -1, 3);
  ctx.closePath();
  finFill(ctx, P, -2, 10 * k);
  ctx.strokeStyle = css(P.dark, 0.4);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo((-8 - i * 2) * k, (4 + i * 2) * k);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Texturen

export const CREATURE_RES = 2;

export interface PartTex {
  key: string;
  ox: number;
  oy: number;
}

export interface CreatureTex {
  body: PartTex;
  head: PartTex;
  jaw: PartTex;
  teeth: PartTex;
  tail: PartTex;
  leg?: PartTex;
  fin?: PartTex;
  layout: Layout;
}

function part(scene: Phaser.Scene, key: string, w: number, h: number, px: number, py: number, s: number, draw: (ctx: Ctx) => void): PartTex {
  if (!scene.textures.exists(key)) {
    const R = CREATURE_RES;
    const [c, ctx] = newCanvas(w * s * R, h * s * R);
    ctx.scale(R * s, R * s);
    ctx.translate(px, py);
    draw(ctx);
    scene.textures.addCanvas(key, c);
  }
  return { key, ox: px / w, oy: py / h };
}

/** Erzeugt (einmalig je Stufe) alle Teil-Texturen für dieses Aussehen. */
export function creatureTextures(scene: Phaser.Scene, mIn: Morph): CreatureTex {
  const m = quantize(mIn);
  const g = geo(m);
  const P = palette(m);
  const L = layoutOf(m);
  const id = 'cr2_' + morphKey(m);
  const s = g.s;
  const hg = g.hg;
  const body = part(scene, id + '_b', g.bw + 90, g.bh + 120, g.bw / 2 + 45, g.bh / 2 + 70, s, (ctx) => drawBody(ctx, m, P, g));
  const hw = hg.L + 76, hh = hg.H + 90;
  const head = part(scene, id + '_h', hw, hh, 44, hg.H / 2 + 52, s, (ctx) => drawHead(ctx, m, P, hg));
  const teeth = part(scene, id + '_t', hw, hh, 44, hg.H / 2 + 52, s, (ctx) => drawTeeth(ctx, m, hg));
  const jl = hg.L - hg.hingeX + 10;
  const jaw = part(scene, id + '_j', jl + 12, hg.jawH + 30, 6, 12, s, (ctx) => drawJaw(ctx, m, P, hg));
  const tail = part(scene, id + '_s', 120, 100, 108, 50, s, (ctx) => drawTail(ctx, m, P, g));
  const out: CreatureTex = { body, head, teeth, jaw, tail, layout: L };
  if (L.land) {
    const lw = g.legW * 2.4 + 26;
    out.leg = part(scene, id + '_l', lw, g.legLen + 16, lw / 2 - 1, 7, s, (ctx) => drawLeg(ctx, m, P, g.legLen, g.legW));
  } else {
    out.fin = part(scene, id + '_f', 76, 64, 62, 12, s, (ctx) => drawFin(ctx, m, P));
  }
  return out;
}
