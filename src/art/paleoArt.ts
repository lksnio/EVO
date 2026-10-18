import Phaser from 'phaser';
import { FONT, H, TITLE_FONT, W } from '../config';
import { PALEO, type Pt } from '../data/paleo';
import type { PlaceKind } from '../data/world';
import { mulberry32, hashStr } from '../util/math';
import { type Ctx, newCanvas, rgrad, vgrad } from '../util/canvas';
import { MAP_BOX, mapPos, placeField } from './mapArt';
import { drawnOutlines, farOutlines, waterRoute } from './paleoGeo';

// Die Weltkarte als Bild: die Urzeit-Erde von oben (Land, Küstenschelf, Meer) in zwei Fassungen –
// "hell" (was man schon gesehen hat) und "dunkel" (unbekannt). Das Bild, das man sieht, ist die dunkle Fassung,
// durch die die helle um jeden bekannten Ort und entlang der geschwommenen Wege hindurchscheint.

/** Größe des Gebiets, das ein Ort auf der Karte färbt (Tang, Trübung, Tiefe). */
const FIELD = 170;

const scr = (p: Pt) => mapPos(p[0], p[1]);

export interface MapPlace {
  id: string;
  x: number;
  y: number;
  kind: PlaceKind;
}

interface Palette {
  seaTop: string;
  seaMid: string;
  seaLow: string;
  shelf: (a: number) => string;
  land: string;
  landHi: string;
  landLo: string;
  coast: string;
  grat: string;
  label: string;
  ocean: string;
  blobs: boolean;
}

const BRIGHT: Palette = {
  seaTop: '#175a60', seaMid: '#11474f', seaLow: '#0b333d',
  shelf: (a) => `rgba(130,215,196,${a})`,
  land: '#6c684a', landHi: '#8d8660', landLo: '#48452f', coast: 'rgba(208,240,224,0.55)',
  grat: 'rgba(200,236,226,0.09)', label: 'rgba(236,226,200,0.62)', ocean: 'rgba(170,222,212,0.5)', blobs: true,
};

const DIM: Palette = {
  seaTop: '#0a1f26', seaMid: '#071820', seaLow: '#04111a',
  shelf: (a) => `rgba(90,150,150,${a * 0.28})`,
  land: '#0d1b1d', landHi: '#12242a', landLo: '#091416', coast: 'rgba(120,170,160,0.13)',
  grat: 'rgba(160,210,200,0.035)', label: 'rgba(190,200,190,0.17)', ocean: 'rgba(130,180,180,0.13)', blobs: false,
};

function tracePoly(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = scr(p);
    if (i) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  });
  ctx.closePath();
}

function spaced(ctx: Ctx, s: string, x: number, y: number, track: number) {
  // Buchstabenabstand von Hand (falls ctx.letterSpacing fehlt)
  const w = [...s].reduce((n, ch) => n + ctx.measureText(ch).width + track, -track);
  let cx = x - w / 2;
  ctx.textAlign = 'left';
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
}

/** Eine Fassung der Karte zeichnen. fields: die Gebiete der Orte (nur in der hellen Fassung). */
function drawWorld(epId: string, pal: Palette, fields: { x: number; y: number; img: HTMLCanvasElement }[]) {
  const [cv, ctx] = newCanvas(W, H);
  const map = PALEO[epId];
  const b = MAP_BOX;
  const rnd = mulberry32(hashStr(epId) * 31 + (pal.blobs ? 7 : 3));
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();

  // Meer
  ctx.fillStyle = vgrad(ctx, b.y, b.y + b.h, [[0, pal.seaTop], [0.5, pal.seaMid], [1, pal.seaLow]]);
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (pal.blobs) {
    for (let i = 0; i < 16; i++) {
      const x = b.x + rnd() * b.w, y = b.y + rnd() * b.h, r = 110 + rnd() * 160;
      ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, `rgba(110,200,190,${0.03 + rnd() * 0.04})`], [1, 'rgba(110,200,190,0)']]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const x = b.x + rnd() * b.w, y = b.y + rnd() * b.h, r = 100 + rnd() * 150;
      ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, `rgba(0,10,16,${0.1 + rnd() * 0.1})`], [1, 'rgba(0,10,16,0)']]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gradnetz und Äquator (über die ganze Fläche)
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = pal.grat;
  for (let i = -8; i <= 18; i++) {
    const p = mapPos(i / 10, i / 10);
    if (p.x > b.x && p.x < b.x + b.w) {
      ctx.beginPath();
      ctx.moveTo(p.x, b.y);
      ctx.lineTo(p.x, b.y + b.h);
      ctx.stroke();
    }
    if (p.y > b.y && p.y < b.y + b.h) {
      ctx.beginPath();
      ctx.moveTo(b.x, p.y);
      ctx.lineTo(b.x + b.w, p.y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = pal.grat.replace(/[\d.]+\)$/, pal.blobs ? '0.2)' : '0.07)');
  const eq = mapPos(0, 0.36).y;
  ctx.beginPath();
  ctx.moveTo(b.x, eq);
  ctx.lineTo(b.x + b.w, eq);
  ctx.stroke();
  ctx.setLineDash([]);

  // alles Land: zuerst das Gebiet der Orte, dann das ferne Land ringsum
  const lands = [...drawnOutlines(epId), ...farOutlines(epId)];

  // Küstenschelf: flaches Wasser rund ums Land
  for (const [w, a] of [[46, 0.045], [32, 0.06], [20, 0.08], [10, 0.1]] as [number, number][]) {
    ctx.strokeStyle = pal.shelf(a);
    ctx.lineWidth = w;
    for (const o of lands) {
      tracePoly(ctx, o);
      ctx.stroke();
    }
  }

  // Gebiete der Orte (das Land darüber verdeckt, was ins Land ragt)
  for (const f of fields) ctx.drawImage(f.img, f.x - FIELD / 2, f.y - FIELD / 2, FIELD, FIELD);

  // Land
  for (const o of lands) {
    tracePoly(ctx, o);
    ctx.fillStyle = pal.land;
    ctx.fill();
    ctx.save();
    tracePoly(ctx, o);
    ctx.clip();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of o) {
      const q = scr(p);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const n = Math.round(((Math.min(x1, b.x + b.w) - Math.max(x0, b.x)) * (Math.min(y1, b.y + b.h) - Math.max(y0, b.y))) / 2600);
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 18 + rnd() * 36;
      const hi = rnd() < 0.5;
      ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, hi ? pal.landHi : pal.landLo], [1, 'rgba(0,0,0,0)']]);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (pal.blobs) {
      // Gebirgsrücken und Körnung
      ctx.strokeStyle = 'rgba(40,38,26,0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < n / 3; i++) {
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), l = 8 + rnd() * 16, a = rnd() * 6.28;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5 - 4, x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(214,204,160,0.18)';
      for (let i = 0; i < n * 2; i++) ctx.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1.4, 1.4);
    }
    // heller Saum an der Küste (innen)
    tracePoly(ctx, o);
    ctx.lineWidth = 6;
    ctx.strokeStyle = pal.blobs ? 'rgba(214,206,160,0.22)' : 'rgba(120,160,150,0.05)';
    ctx.stroke();
    ctx.restore();
    // Brandungslinie
    tracePoly(ctx, o);
    ctx.lineWidth = 5;
    ctx.strokeStyle = pal.coast.replace(/[\d.]+\)$/, pal.blobs ? '0.14)' : '0.04)');
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pal.coast;
    ctx.stroke();
  }

  // Namen
  ctx.textBaseline = 'middle';
  for (const [list, far] of [[map.continents, false], [map.far ?? [], true]] as [typeof map.continents, boolean][]) {
    for (const c of list) {
      if (!c.name) continue;
      const p = scr(c.label);
      ctx.font = `700 ${far ? 11 : 12}px ${TITLE_FONT}`;
      ctx.fillStyle = pal.label;
      spaced(ctx, c.name.toUpperCase(), p.x, p.y, 3.6);
    }
  }
  for (const o of map.oceans) {
    const p = scr([o.x, o.y]);
    ctx.font = `italic 500 13px ${FONT}`;
    ctx.fillStyle = pal.ocean;
    spaced(ctx, o.name, p.x, p.y, 1.8);
  }
  ctx.restore();
  return cv;
}

/** Rahmen, Rand, Kompass und Zeitangabe – liegen über der Karte. */
export function mapFrame(scene: Phaser.Scene, epId: string, label: string) {
  const key = `mapframe_${epId}`;
  if (scene.textures.exists(key)) return key;
  const [cv, ctx] = newCanvas(W, H);
  const b = MAP_BOX;
  ctx.fillStyle = rgrad(ctx, W / 2, H / 2, H * 0.3, H * 0.95, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']]);
  ctx.fillRect(0, 0, W, H);
  // Rand der Karte weich ins Dunkle
  for (const top of [true, false]) {
    const y = top ? b.y : b.y + b.h - 26;
    const gr = ctx.createLinearGradient(0, y, 0, y + 26);
    gr.addColorStop(top ? 0 : 1, 'rgba(0,0,0,0.5)');
    gr.addColorStop(top ? 1 : 0, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(b.x, y, b.w, 26);
  }
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#2a2723';
  ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(200,145,60,0.55)';
  ctx.strokeRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20);

  // Kompass oben links
  const cx = b.x + 50, cy = b.y + 52;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(200,170,110,0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.fillStyle = i === 0 ? 'rgba(224,168,72,0.85)' : 'rgba(200,170,110,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(4.5, -4.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4.5, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.font = `700 12px ${TITLE_FONT}`;
  ctx.fillStyle = 'rgba(224,190,120,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -37);
  ctx.restore();

  // Zeitangabe unten rechts
  ctx.font = `700 14px ${TITLE_FONT}`;
  ctx.fillStyle = 'rgba(224,190,120,0.78)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w - 20, b.y + b.h - 24);
  scene.textures.addCanvas(key, cv);
  return key;
}

/** Der Schwimmweg zwischen zwei Orten in Bildpunkten (um das Land herum). */
export function routePoints(epId: string, from: Pt, to: Pt) {
  return waterRoute(epId, from, to).map((p) => mapPos(p[0], p[1]));
}

/** So weit hellt sich die Karte um einen bekannten Ort bzw. um einen geschwommenen Weg auf (Bildpunkte). */
const FOG_PLACE = 86;
const FOG_ROUTE = 30;

interface Disc {
  x: number;
  y: number;
  k: number;
  blobs: { dx: number; dy: number; r: number }[];
}

interface Corridor {
  pts: { x: number; y: number }[];
  /** wie weit der Weg aufgedeckt ist (0..1) */
  p: number;
}

/**
 * Die Karte auf dem Bildschirm: dunkle Fassung, darüber die helle, nur dort sichtbar, wo man schon war.
 * Mit reveal() und showRoute() deckt sich Neues sanft auf.
 */
export class FogMap {
  readonly key: string;
  private tex: Phaser.Textures.CanvasTexture;
  private dim: HTMLCanvasElement;
  private bright: HTMLCanvasElement;
  private mask: HTMLCanvasElement;
  private mctx: Ctx;
  private tmp: HTMLCanvasElement;
  private tctx: Ctx;
  private discs = new Map<string, Disc>();
  private corridors = new Map<string, Corridor>();

  constructor(scene: Phaser.Scene, epId: string, places: MapPlace[], known: string[]) {
    this.key = `fogmap_${epId}`;
    const fields = places.map((p, i) => ({
      x: p.x, y: p.y,
      img: scene.textures.get(placeField(scene, p.kind, hashStr(epId) + i)).getSourceImage() as HTMLCanvasElement,
    }));
    this.dim = drawWorld(epId, DIM, []);
    this.bright = drawWorld(epId, BRIGHT, fields);
    [this.mask, this.mctx] = newCanvas(W, H);
    [this.tmp, this.tctx] = newCanvas(W, H);
    if (scene.textures.exists(this.key)) scene.textures.remove(this.key);
    this.tex = scene.textures.createCanvas(this.key, W, H)!;
    const r = mulberry32(hashStr(epId) + 99);
    for (const p of places) {
      const blobs = Array.from({ length: 5 }, () => ({ dx: (r() - 0.5) * 70, dy: (r() - 0.5) * 46, r: 44 + r() * 34 }));
      this.discs.set(p.id, { x: p.x, y: p.y, k: known.includes(p.id) ? 1 : 0, blobs });
    }
    scene.events.once('shutdown', () => scene.textures.exists(this.key) && scene.textures.remove(this.key));
    this.refresh();
  }

  reveal(id: string, k: number) {
    const d = this.discs.get(id);
    if (d) d.k = k;
  }

  showRoute(id: string, pts: { x: number; y: number }[], p: number) {
    this.corridors.set(id, { pts, p });
  }

  /** Aus dunkler Fassung, heller Fassung und Aufdeck-Maske das Bild zusammensetzen. */
  refresh() {
    const m = this.mctx;
    m.clearRect(0, 0, W, H);
    const spot = (x: number, y: number, r: number, a = 1) => {
      m.fillStyle = rgrad(m, x, y, 0, r, [[0, `rgba(255,255,255,${a})`], [0.55, `rgba(255,255,255,${a * 0.92})`], [1, 'rgba(255,255,255,0)']]);
      m.beginPath();
      m.arc(x, y, r, 0, Math.PI * 2);
      m.fill();
    };
    for (const c of this.corridors.values()) {
      const n = Math.floor(c.pts.length * c.p);
      for (let i = 0; i < n; i += 3) spot(c.pts[i].x, c.pts[i].y, FOG_ROUTE);
      if (c.p >= 1 && n) spot(c.pts[c.pts.length - 1].x, c.pts[c.pts.length - 1].y, FOG_ROUTE);
    }
    for (const d of this.discs.values()) {
      if (d.k <= 0) continue;
      spot(d.x, d.y, FOG_PLACE * d.k);
      for (const b of d.blobs) spot(d.x + b.dx * d.k, d.y + b.dy * d.k, b.r * d.k, 0.9);
    }
    const t = this.tctx;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.drawImage(this.bright, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(this.mask, 0, 0);
    const c = this.tex.getContext();
    c.clearRect(0, 0, W, H);
    c.drawImage(this.dim, 0, 0);
    c.drawImage(this.tmp, 0, 0);
    this.tex.refresh();
  }
}
