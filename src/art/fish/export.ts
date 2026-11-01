import { newCanvas, type Ctx } from '../../util/canvas';
import { palette, quantize, type Morph } from '../creatureArt';
import { withInk } from '../ink';
import { fishAnatomy, type FishAnatomy } from './anatomy';
import { eyeBox, finBox, paintBody, paintEye, paintJaw, paintMedianFin, paintOverlay, paintPectoral, paintPelvicFin } from './paint';

// ---------------------------------------------------------------------------
// Vorlagen für die gemalte Zeichnung des Fisches (Entwickler-Werkzeug, siehe art/vorlagen/fisch/README.md): Aus der tatsächlichen
// Implementierung entstehen
//   – jedes Teil als eigenes transparentes Bild in seiner Ruhelage (so groß, wie es das Rig auf das Netz legt),
//   – der ganze Fisch in der neutralen Ausgangspose (alle Teile an ihrem Platz, in der Zeichenreihenfolge),
//   – Hilfslinien als SEPARATE Bilder (Netz- und UV-Grenzen; Ansatzpunkte), nie in die Zeichnung eingebrannt,
//   – ein Manifest mit allen Koordinaten.
// Einheit: „g-Einheit“ = Zeicheneinheit des Fisches (bei Größe 1 etwa ein Bildpunkt im Spiel). Ursprung des Fisch-Koordinatensystems
// ist die Körpermitte, +x zeigt zur Schnauze, +y nach unten (Bildkoordinaten).
// ---------------------------------------------------------------------------

type Box = { x0: number; x1: number; y0: number; y1: number };

export interface PartInfo {
  name: string;
  /** Datei (ohne Ordner) */
  file: string;
  /** Umfang des Bildes in g-Einheiten, im Koordinatensystem des Teils (Ursprung = sein Ansatz) */
  box: Box;
  /** Lage des Teil-Ursprungs im Fischkoordinatensystem (g-Einheiten) */
  placedAt: [number, number];
  /** Bildgröße in Pixeln und Pixel des Teil-Ursprungs im Bild */
  size: [number, number];
  originPx: [number, number];
  /** Netz, das auf dem Teil liegt (Spalten × Zeilen) – 0 = unverformt als Bild bewegt */
  mesh: { cols: number; rows: number } | null;
  note: string;
}

export interface Templates {
  name: string;
  pxPerUnit: number;
  /** Umfang der zusammengesetzten Vorlage in g-Einheiten (Fischkoordinaten) */
  union: Box;
  parts: PartInfo[];
  canvases: Record<string, HTMLCanvasElement>;
  manifest: Record<string, unknown>;
}

function paintTo(box: Box, res: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const [c, ctx] = newCanvas((box.x1 - box.x0) * res, (box.y1 - box.y0) * res);
  ctx.scale(res, res);
  ctx.translate(-box.x0, -box.y0);
  draw(ctx);
  return c;
}

const COLS = 16, ROWS = 3;

export function fishTemplates(mIn: Morph, name = 'neutral', pxPerUnit = 16): Templates {
  return withInk(true, () => {
    const m = quantize(mIn);
    const A = fishAnatomy(m);
    const P = palette(m);
    const R = pxPerUnit;
    const ovBox: Box = { x0: A.hx - 13, x1: A.hx + 9, y0: A.hy - A.hg.H * 0.34, y1: A.hy + A.hg.H * 0.54 };
    const jawBox: Box = { x0: -4, x1: A.jawLen + 4, y0: -(m.diet < -0.3 ? 3 : 5), y1: A.jawH + 3 };
    const defs: { name: string; box: Box; at: [number, number]; mesh: { cols: number; rows: number } | null; note: string; draw: (ctx: Ctx) => void }[] = [
      { name: 'pectoral_far', box: finBox('pectoral', A.pectoral), at: A.pectoral.at, mesh: { cols: 3, rows: 2 }, note: 'ferne Brustflosse (dunkler), liegt hinter dem Körper; Ursprung = Flossenansatz', draw: (c) => paintPectoral(c, A.pectoral, P, true) },
      { name: 'pelvic', box: finBox('pelvic', A.pelvic), at: A.pelvic.at, mesh: { cols: 4, rows: 2 }, note: 'Bauchflosse, hinter dem Körper; Ursprung = Ansatz an der Bauchlinie', draw: (c) => paintPelvicFin(c, A.pelvic, P) },
      { name: 'dorsal', box: finBox('dorsal', A.dorsal), at: A.dorsal.at, mesh: { cols: 4, rows: 2 }, note: 'Rückenflosse, hinter dem Körper; Ursprung = Mitte des Ansatzes (liegt 2–4 Einheiten unter der Haut)', draw: (c) => paintMedianFin(c, A.dorsal, P, -1, true) },
      { name: 'anal', box: finBox('anal', A.anal), at: A.anal.at, mesh: { cols: 4, rows: 2 }, note: 'Afterflosse, hinter dem Körper', draw: (c) => paintMedianFin(c, A.anal, P, 1, false) },
      { name: 'jaw', box: jawBox, at: A.hinge, mesh: null, note: 'Unterkiefer; Ursprung = Kiefergelenk; dreht sich beim Öffnen um diesen Punkt; trägt die unteren Zähne', draw: (c) => paintJaw(c, A, P) },
      { name: 'body', box: A.bounds, at: [0, 0], mesh: { cols: COLS, rows: ROWS }, note: 'Kopf, Rumpf, Schwanzstiel und Schwanzflosse mit den oberen Zähnen – ohne Auge, ohne Kiemendeckel-Überlagerung; verformt sich als Netz', draw: (c) => paintBody(c, A, P) },
      { name: 'pectoral', box: finBox('pectoral', A.pectoral), at: A.pectoral.at, mesh: { cols: 3, rows: 2 }, note: 'nahe Brustflosse, liegt vor dem Körper, unter der Überlagerung', draw: (c) => paintPectoral(c, A.pectoral, P, false) },
      { name: 'overlay', box: ovBox, at: [0, 0], mesh: { cols: 5, rows: 3 }, note: 'Kiemendeckel: liegt über dem Ansatz der Brustflosse; folgt dem Körper', draw: (c) => paintOverlay(c, A, P) },
      { name: 'eye', box: eyeBox(A), at: [A.eye.x, A.eye.y], mesh: null, note: 'Auge (Augapfel, Iris, Pupille, Glanz); Ursprung = Augenmitte; wird als Bild an den Kopf gehängt', draw: (c) => paintEye(c, A, P) },
    ];

    const canvases: Record<string, HTMLCanvasElement> = {};
    const parts: PartInfo[] = [];
    const placed = (d: (typeof defs)[number]): Box => ({ x0: d.at[0] + d.box.x0, x1: d.at[0] + d.box.x1, y0: d.at[1] + d.box.y0, y1: d.at[1] + d.box.y1 });
    let U: Box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const d of defs) {
      const b = placed(d);
      U = { x0: Math.min(U.x0, b.x0), x1: Math.max(U.x1, b.x1), y0: Math.min(U.y0, b.y0), y1: Math.max(U.y1, b.y1) };
    }
    const pad = 4;
    U = { x0: Math.floor(U.x0 - pad), x1: Math.ceil(U.x1 + pad), y0: Math.floor(U.y0 - pad), y1: Math.ceil(U.y1 + pad) };

    for (const d of defs) {
      const c = paintTo(d.box, R, d.draw);
      const file = `teil_${d.name}.png`;
      canvases[file] = c;
      parts.push({
        name: d.name, file, box: d.box, placedAt: d.at, size: [c.width, c.height],
        originPx: [-d.box.x0 * R, -d.box.y0 * R], mesh: d.mesh, note: d.note,
      });
    }

    // der ganze Fisch in der Ruhelage (in der Reihenfolge, in der das Rig die Teile übereinander legt)
    const [comp, cctx] = newCanvas((U.x1 - U.x0) * R, (U.y1 - U.y0) * R);
    for (const d of defs) {
      const b = placed(d);
      cctx.drawImage(canvases[`teil_${d.name}.png`], (b.x0 - U.x0) * R, (b.y0 - U.y0) * R);
    }
    canvases['fisch_neutral.png'] = comp;

    // Hilfslinien: getrennte, transparente Bilder in genau der Größe der Zusammensetzung
    canvases['hilfslinien_netz.png'] = guideMesh(A, defs.map((d) => ({ ...d, box: placed(d) })), U, R);
    canvases['hilfslinien_ansatzpunkte.png'] = guidePoints(A, U, R);
    for (const d of defs) canvases[`raster_${d.name}.png`] = guideGrid(d.box, R);

    // Vorschau (nur zur Ansicht, nicht zum Malen): Zeichnung und beide Hilfslinien übereinander
    const [prev, pctx] = newCanvas(comp.width, comp.height);
    pctx.fillStyle = '#2b3a40';
    pctx.fillRect(0, 0, comp.width, comp.height);
    pctx.drawImage(comp, 0, 0);
    pctx.drawImage(canvases['hilfslinien_netz.png'], 0, 0);
    pctx.drawImage(canvases['hilfslinien_ansatzpunkte.png'], 0, 0);
    canvases['vorschau_mit_hilfslinien.png'] = prev;

    const manifest = {
      name, pxPerUnit: R,
      koordinaten: 'g-Einheiten; Ursprung Körpermitte, +x zur Schnauze (Blick nach rechts), +y nach unten; Bildpixel = (x − union.x0) · pxPerUnit',
      blickrichtung: 'nach rechts', hintergrund: 'transparent (Alpha), Ränder ≥ 4 Einheiten leer',
      union: U, bildPx: [comp.width, comp.height],
      morph: m,
      anker: {
        auge: { x: A.eye.x, y: A.eye.y, radiusRoh: A.eye.r, augapfel: Math.max(2.6, A.eye.r * 1.3) },
        kiefergelenk: A.hinge, maulspitzeOberkiefer: A.tip, unterkieferLaenge: A.jawLen, unterkieferTiefe: A.jawH,
        kopfUrsprungNacken: [A.hx, A.hy], drehpunktVerformung_x: A.anchorX, halszoneBeginn_x: A.neckX,
        schwanzstielEnde_x: A.pedX, schwanzstielHalbeHoehe: A.pedH,
        schwanzflosse: A.tail,
        rueckenflosse: A.dorsal, afterflosse: A.anal, bauchflosse: A.pelvic, brustflosse: A.pectoral,
        kopfpanzer: A.plate,
      },
      netz: { koerper: { spalten: COLS, zeilen: ROWS, box: A.bounds }, uv: 'u = (x − box.x0)/(box.x1 − box.x0), v = (y − box.y0)/(box.y1 − box.y0); v wird beim Zeichnen gespiegelt (flipV)' },
      silhouette: A.loop,
      teile: parts,
    };
    return { name, pxPerUnit: R, union: U, parts, canvases, manifest };
  });
}

// ---------------------------------------------------------------------------
// Hilfslinien

const toPx = (U: Box, R: number, x: number, y: number): [number, number] => [(x - U.x0) * R, (y - U.y0) * R];

function label(ctx: Ctx, text: string, x: number, y: number, color: string, size = 15) {
  ctx.font = `600 ${size}px sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function guideMesh(A: FishAnatomy, defs: { name: string; box: Box; mesh: { cols: number; rows: number } | null }[], U: Box, R: number) {
  const [c, ctx] = newCanvas((U.x1 - U.x0) * R, (U.y1 - U.y0) * R);
  const colors: Record<string, string> = { body: '#ffd400', overlay: '#ff7a1a', dorsal: '#4fd1ff', anal: '#4fd1ff', pelvic: '#4fd1ff', pectoral: '#7dff7a', pectoral_far: '#3fae3c', jaw: '#ff4fa8', eye: '#ffffff' };
  ctx.lineWidth = 1.5;
  for (const d of defs) {
    const col = colors[d.name] ?? '#fff';
    ctx.strokeStyle = col;
    const [x0, y0] = toPx(U, R, d.box.x0, d.box.y0), [x1, y1] = toPx(U, R, d.box.x1, d.box.y1);
    ctx.setLineDash([]);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (d.mesh) {
      ctx.globalAlpha = 0.85;
      ctx.setLineDash(d.name === 'body' ? [] : [6, 4]);
      for (let i = 1; i < d.mesh.cols; i++) {
        const x = x0 + ((x1 - x0) * i) / d.mesh.cols;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      }
      for (let j = 1; j < d.mesh.rows; j++) {
        const y = y0 + ((y1 - y0) * j) / d.mesh.rows;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([]);
    // UV-Ecken des Netzes beschriften
    label(ctx, `${d.name}  UV (0,0)`, x0 + 4, y0 + 16, col, 13);
    label(ctx, 'UV (1,1)', x1 - 70, y1 - 6, col, 13);
  }
  // Spaltenmarken des Körpernetzes mit der Gelenknummer
  const b = defs.find((d) => d.name === 'body')!.box;
  ctx.fillStyle = '#ffd400';
  for (let i = 0; i <= COLS; i++) {
    const [x, y] = toPx(U, R, b.x0 + ((b.x1 - b.x0) * i) / COLS, b.y1);
    label(ctx, String(i), x - 4, y + 16, '#ffd400', 12);
  }
  label(ctx, 'Körpernetz: 16 Spalten (Gelenke 0 … 16) × 3 Zeilen', toPx(U, R, b.x0, b.y1)[0] + 20, toPx(U, R, b.x0, b.y1)[1] + 34, '#ffd400', 14);
  void A;
  return c;
}

function guidePoints(A: FishAnatomy, U: Box, R: number) {
  const [c, ctx] = newCanvas((U.x1 - U.x0) * R, (U.y1 - U.y0) * R);
  const P = (x: number, y: number) => toPx(U, R, x, y);
  const dot = (x: number, y: number, col: string, txt: string, dx = 8, dy = -8, r = 6) => {
    const [px, py] = P(x, y);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - r - 4, py); ctx.lineTo(px + r + 4, py); ctx.moveTo(px, py - r - 4); ctx.lineTo(px, py + r + 4); ctx.stroke();
    label(ctx, `${txt} (${x.toFixed(1)} | ${y.toFixed(1)})`, px + dx, py + dy, col);
  };
  const vline = (x: number, col: string, txt: string, ty: number) => {
    const [px] = P(x, 0);
    ctx.setLineDash([10, 6]); ctx.lineWidth = 1.5; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, c.height); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, txt, px + 4, ty, col, 13);
  };
  // Mittellinie (Wirbelsäule) und Senkrechte der Verformung
  const [, y0] = P(0, 0);
  ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(c.width, y0); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, 'Wirbelsäule y = 0', 8, y0 - 6, '#ffffff', 13);
  vline(A.anchorX, '#c9a0ff', 'Drehpunkt (Rumpf bleibt in Ruhe)', 22);
  vline(A.neckX, '#c9a0ff', 'Halszone beginnt (ab hier folgt es dem Kopf)', 40);
  vline(A.pedX - 1, '#ff9a9a', 'Schwanzstiel endet / Flossenansatz', 58);
  // Maul: Oberlippe und Unterkiefer
  const [hx, hy] = P(A.hinge[0], A.hinge[1]), [tx, ty] = P(A.tip[0], A.tip[1]);
  ctx.strokeStyle = '#ff4fa8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + tx) / 2, hy + 0.7 * R, tx, ty); ctx.stroke();
  dot(A.hinge[0], A.hinge[1], '#ff4fa8', 'Kiefergelenk (Drehpunkt Unterkiefer)', -250, 60);
  dot(A.tip[0], A.tip[1], '#ff4fa8', 'Maulspitze (Oberkiefer)', -190, -26);
  // Unterkieferspitze (in Ruhe) und Öffnungswinkel
  const jt = P(A.hinge[0] + A.jawLen, A.hinge[1] + 0.3);
  ctx.beginPath(); ctx.arc(jt[0], jt[1], 5, 0, Math.PI * 2); ctx.fillStyle = '#ff4fa8'; ctx.fill();
  label(ctx, 'Unterkiefer-Spitze', jt[0] - 60, jt[1] + A.jawH * R + 20, '#ff4fa8');
  dot(A.eye.x, A.eye.y, '#ffffff', 'Auge', -20, -18, Math.max(2.6, A.eye.r * 1.3) * R);
  // Flossenansätze mit Achse der Flosse
  const fin = (f: { at: [number, number] }, ax: number, ay: number, len: number, col: string, txt: string) => {
    const [px, py] = P(f.at[0], f.at[1]);
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + ax * len * R, py + ay * len * R); ctx.stroke();
    dot(f.at[0], f.at[1], col, txt, ax < 0 ? -420 : 8, ax < 0 ? 70 : ay < 0 ? -10 : 22);
  };
  fin(A.dorsal, 0, -1, A.dorsal.len, '#4fd1ff', 'Ansatz Rückenflosse');
  fin(A.anal, 0, 1, A.anal.len, '#4fd1ff', 'Ansatz Afterflosse');
  fin(A.pelvic, 0, 1, A.pelvic.len, '#4fd1ff', 'Ansatz Bauchflosse');
  fin(A.pectoral, -0.7, 0.7, A.pectoral.len, '#7dff7a', 'Ansatz Brustflosse (unter dem Kiemendeckel)');
  // Schwanzflosse: Umriss der Spannweite
  const [sx, sy0] = P(A.pedX - 1 - A.tail.lobe, -A.tail.spread), [, sy1] = P(0, A.tail.spread);
  ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ff9a9a'; ctx.lineWidth = 1.5;
  ctx.strokeRect(sx, sy0, P(A.pedX - 1, 0)[0] - sx, sy1 - sy0); ctx.setLineDash([]);
  label(ctx, `Schwanzflosse: Länge ${A.tail.lobe.toFixed(1)}, Spannweite ±${A.tail.spread.toFixed(1)}`, sx + 4, sy1 + 18, '#ff9a9a', 14);
  return c;
}

/** Raster mit Beschriftung je 5 Einheiten für ein Einzelteil (Ursprung = Kreuz). */
function guideGrid(box: Box, R: number) {
  const [c, ctx] = newCanvas((box.x1 - box.x0) * R, (box.y1 - box.y0) * R);
  const px = (x: number) => (x - box.x0) * R, py = (y: number) => (y - box.y0) * R;
  ctx.lineWidth = 1;
  for (let x = Math.ceil(box.x0 / 5) * 5; x <= box.x1; x += 5) {
    ctx.strokeStyle = x === 0 ? 'rgba(255,60,60,0.95)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), c.height); ctx.stroke();
    label(ctx, String(x), px(x) + 3, 14, '#ffffff', 12);
  }
  for (let y = Math.ceil(box.y0 / 5) * 5; y <= box.y1; y += 5) {
    ctx.strokeStyle = y === 0 ? 'rgba(255,60,60,0.95)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(c.width, py(y)); ctx.stroke();
    label(ctx, String(y), 3, py(y) - 3, '#ffffff', 12);
  }
  ctx.strokeStyle = '#ff3c3c'; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
  return c;
}
