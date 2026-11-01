import { css, mix, shade } from '../../util/color';
import { type Ctx, ell } from '../../util/canvas';
import { mulberry32 } from '../../util/math';
import { plateLevel } from '../../state/GameState';
import { keenOf, type Pal } from '../creatureArt';
import { gradeAnimal as grade, INK, lightOf, lineOf, outline, shadowOf } from '../ink';
import { crescent, eye } from '../paint';
import { eyeBall, type FishAnatomy, type FinSpec, type P2 } from './anatomy';

// ---------------------------------------------------------------------------
// Die Zeichnung des Fisches im Tuschestil des Devons – die Quelle aller Texturen des Fischs. Alles wird aus der Anatomie
// (anatomy.ts) und der Farbpalette gemalt, im Koordinatensystem des Körpers (g-Einheiten).
//
// Gestaltungsregeln:
//   – eine Silhouette für Kopf, Rumpf und Schwanzstiel, nur außen eine kräftige Tuschelinie, innen sparsam;
//   – wenige flache Farbflächen: dunkler Rücken, mittlere Flanke, heller Bauch; ein harter Schattenstreifen unten, ein
//     schmaler Lichtstreifen oben (Licht fällt von oben/hinten);
//   – Flossen setzen UNTER der Körperfläche an (sie werden hinter den Körper gelegt oder tragen einen Ansatzschatten);
//   – Zähne wachsen aus der Lippe, ihre Wurzeln liegen unter der Lippenlinie;
//   – Schuppen nur als wenige Bögen auf der Flanke, die mit der Panzerung (armor) größer und deutlicher werden.
// ---------------------------------------------------------------------------

const LW = 1.75;

/** Eine weiche Kurve durch die Punkte, beginnend am aktuellen Punkt (Catmull-Rom, offen). */
function through(ctx: Ctx, pts: P2[]) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
}

/** Die Silhouette von Kopf und Rumpf als ein einziger Weg (das Maul ist die gerade Lippenlinie unten vorn). */
export function bodyPath(ctx: Ctx, A: FishAnatomy) {
  const { hinge, tip, loop, jawH } = A;
  ctx.beginPath();
  ctx.moveTo(hinge[0], hinge[1]);
  // die Maulspalte: ein leichtes Lächeln vom Maulwinkel zur Schnauze
  ctx.quadraticCurveTo((hinge[0] + tip[0]) * 0.5, hinge[1] + 0.7, tip[0], tip[1]);
  through(ctx, loop);
  // von der Kehle hinauf zum Maulwinkel
  ctx.quadraticCurveTo(hinge[0] - 2.6, hinge[1] + jawH * 0.62, hinge[0], hinge[1]);
  ctx.closePath();
}

/** y der Maulspalte an der Stelle x (für Zähne und Lippe). */
function lipY(A: FishAnatomy, x: number) {
  const { hinge, tip } = A;
  const t = Math.max(0, Math.min(1, (x - hinge[0]) / Math.max(1, tip[0] - hinge[0])));
  const cy = hinge[1] + 0.7;
  return (1 - t) * (1 - t) * hinge[1] + 2 * (1 - t) * t * cy + t * t * tip[1];
}

/**
 * Füllt den Teil der Form, der außerhalb ihres in der Höhe auf k verkleinerten Kerns (um die Achse yc) liegt: oben (top = true)
 * bzw. unten – das gibt Bänder, die der Kontur folgen. Der Aufrufer setzt je Aufruf die Füllfarbe.
 */
function ring(ctx: Ctx, path: () => void, yc: number, k: number, setFill: (top: boolean) => void) {
  for (const top of [true, false]) {
    ctx.save();
    path();
    ctx.clip();
    path();
    (ctx as unknown as { beginPath: () => void }).beginPath = () => undefined;
    ctx.save();
    ctx.translate(0, yc);
    ctx.scale(1, k);
    ctx.translate(0, -yc);
    path();
    ctx.restore();
    delete (ctx as unknown as { beginPath?: () => void }).beginPath;
    ctx.clip('evenodd');
    setFill(top);
    if (top) ctx.fillRect(-4000, -4000, 8000, 4000 + yc);
    else ctx.fillRect(-4000, yc, 8000, 4000);
    ctx.restore();
  }
}

function fillOf(P: Pal) {
  return { base: grade(P.base), top: grade(mix(shade(P.base, -0.4), P.camo, 0.3)), belly: grade(P.belly), fin: grade(P.fin) };
}

// ---------------------------------------------------------------------------
// Zähne

/** Ein Zahn mit Wurzel unter der Lippenlinie: schmale Krone, leicht nach hinten geneigt, dunkler Kontur. */
function tooth(ctx: Ctx, x: number, y: number, w: number, len: number, dir: number, blunt: boolean, lean = 0.22) {
  ctx.beginPath();
  if (blunt) {
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2 - lean * len * 0.3, y + dir * len * 0.72);
    ctx.quadraticCurveTo(x - lean * len, y + dir * len * 1.1, x + w / 2 - lean * len * 0.3, y + dir * len * 0.72);
    ctx.lineTo(x + w / 2, y);
  } else {
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.34 - lean * len * 0.4, y + dir * len * 0.58, x - lean * len, y + dir * len);
    ctx.quadraticCurveTo(x + w * 0.3 - lean * len * 0.3, y + dir * len * 0.52, x + w / 2, y);
  }
  ctx.closePath();
  ctx.fillStyle = css(mix(0xe9e2cc, 0xffffff, 0.1));
  ctx.fill();
  ctx.strokeStyle = css(INK, 0.95);
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

/** Zahnform und -größe des Fisches: immer dieselbe kleine Reihe – Fleischfresser etwas spitzer, Pflanzenfresser stumpf. */
function teethOf(A: FishAnatomy) {
  const m = A.m;
  const herb = m.diet < -0.3, carn = Math.max(0, m.diet);
  // Das Gebiss entwickelt sich über Kiefer UND Zähne: Das Maul wird größer (anatomy.ts), die Zähne wachsen mit – nur in Größe und
  // Breite, in kleinen Schritten (Stufen des Gebisswerts), nie in der Zahl; so bleibt die Reihe geordnet und kein Kamm entsteht.
  const tier = Math.max(0, Math.floor(m.toothTier ?? 0));
  const grow = (1 + 0.4 * Math.log2(1 + 0.15 * tier)) * (1 + 0.22 * m.jaw);
  return { n: 3, len: (herb ? 1.5 : 2.4) * (1 + 0.1 * carn) * grow, w: (herb ? 2.5 : 2.2) * (1 + 0.5 * (grow - 1)), blunt: herb };
}

// ---------------------------------------------------------------------------
// Schwanzflosse

function caudalPath(ctx: Ctx, A: FishAnatomy) {
  const { pedX, pedH, tail } = A;
  const rx = pedX - 1;
  const up = 1 + tail.up, dn = 1 - tail.up * 0.55;
  const U: P2 = [rx - tail.lobe * (1 + tail.up * 0.6), -tail.spread * up];
  const D: P2 = [rx - tail.lobe * 0.9, tail.spread * dn];
  const N: P2 = [rx - tail.lobe + tail.fork, -tail.spread * 0.04];
  ctx.beginPath();
  ctx.moveTo(rx, -pedH);
  ctx.quadraticCurveTo(rx - tail.lobe * 0.42, -tail.spread * 0.55 * up, U[0], U[1]);
  ctx.quadraticCurveTo(U[0] + tail.fork * 0.4, -tail.spread * 0.3, N[0], N[1]);
  ctx.quadraticCurveTo(D[0] + tail.fork * 0.4, tail.spread * 0.3, D[0], D[1]);
  ctx.quadraticCurveTo(rx - tail.lobe * 0.4, tail.spread * 0.55 * dn, rx, pedH);
  ctx.closePath();
  return { rx, U, D, N };
}

/** Die Schwanzflosse: Sie schließt an den Stiel an (der Stiel läuft in die Flossenhaut über) und liegt über dessen Ende. */
function paintCaudal(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const c = fillOf(P).fin;
  const path = () => caudalPath(ctx, A);
  const { rx, U, D, N } = caudalPath(ctx, A);
  // nichts vor dem Ansatz: Die Flosse beginnt dort, wo der Stiel endet
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx - 400, -400, 400, 800);
  ctx.clip();
  path();
  ctx.fillStyle = css(c);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // der untere Lappen liegt im Schatten, am Ansatz ist die Flosse dunkler
  crescent(ctx, path, -1.2, -A.tail.spread * 0.2, css(shadowOf(c), 0.55));
  ctx.fillStyle = css(shadowOf(c), 0.25);
  ctx.fillRect(rx - A.tail.lobe * 0.3, -A.tail.spread * 2, A.tail.lobe * 0.3, A.tail.spread * 4);
  // Flossenstrahlen: wenige, vom Stiel zum Rand
  ctx.strokeStyle = css(lineOf(c, 0.3), 0.75);
  ctx.lineWidth = 0.8;
  const ends: P2[] = [U, [rx - A.tail.lobe * 0.97 + A.tail.fork * 0.2, -A.tail.spread * 0.48], N, [rx - A.tail.lobe * 0.9 + A.tail.fork * 0.2, A.tail.spread * 0.5], D];
  for (const e of ends) {
    ctx.beginPath();
    ctx.moveTo(rx - 1, e[1] * 0.08);
    ctx.quadraticCurveTo((rx + e[0]) / 2, e[1] * 0.45, e[0] * 0.97 + rx * 0.03, e[1] * 0.97);
    ctx.stroke();
  }
  ctx.restore();
  // Kontur ohne die Trennlinie am Ansatz
  ctx.beginPath();
  ctx.rect(rx - 400, -400, 399.2, 800);
  ctx.clip();
  outline(ctx, path, lineOf(c), LW);
  ctx.restore();
  // der Stiel endet in einem sanften Bogen: Hier setzen die Flossenstrahlen an
  ctx.beginPath();
  ctx.moveTo(rx + 0.4, -A.pedH * 0.9);
  ctx.quadraticCurveTo(rx - 2.2, 0, rx + 0.4, A.pedH * 0.9);
  ctx.strokeStyle = css(INK, 0.4);
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Körper

/** Die Muster der Linie (Tarnung, Schwarm, Hunger …) – innerhalb der Silhouette, hängen am Körper. */
function bodyMarks(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const { m, bw, bh, hx, hy, hg } = A;
  const r = mulberry32(m.seed + 3);
  const st = m.stealth;
  const coat = m.coat ?? 0;
  const camoA = coat === 1 ? 0.8 : coat === 2 ? 0.12 : 0.1 + 0.62 * st;
  const camo = grade(P.camo);
  // Querbinden: Tarnung (grün: sieben kräftige Binden wie beim Barsch), mit einer weichen, schräg stehenden Kante
  const nb = coat === 1 ? 7 : 5;
  for (let i = 0; i < nb; i++) {
    const x = bw * 0.26 - i * (coat === 1 ? 0.12 : 0.15) * bw + (r() - 0.5) * 4;
    const w = 2.4 + r() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, -bh * 0.7);
    ctx.bezierCurveTo(x + 3, -bh * 0.2, x - 3, bh * 0.1, x + 2, bh * 0.52);
    ctx.lineTo(x + 2 + w, bh * 0.52);
    ctx.bezierCurveTo(x - 1 + w, bh * 0.1, x + 5 + w, -bh * 0.2, x + w, -bh * 0.7);
    ctx.closePath();
    ctx.fillStyle = css(camo, camoA);
    ctx.fill();
  }
  // Schwarmfisch: ein dunkles Längsband an der Flanke mit hellem, silbrigem Saum
  const school = plateLevel(m.sw ?? 0);
  if (school > 0.08) {
    const band = (dy: number, w: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(hx + 2, -bh * 0.06 + dy);
      ctx.quadraticCurveTo(-bw * 0.04, -bh * 0.02 + dy, -bw * 0.5, dy * 0.3);
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    band(-bh * (0.1 + 0.05 * school), 1.2 + 1.2 * school, css(shade(P.belly, 0.35), 0.3 + 0.45 * school));
    band(0, 1.5 + bh * 0.14 * school, css(grade(P.dark), 0.35 + 0.45 * school));
  }
  // Hunger: Rippen werden sichtbar
  if (m.belly === 0) {
    for (let i = 0; i < 5; i++) {
      const x = bw * 0.16 - i * 5.4;
      ctx.beginPath();
      ctx.moveTo(x, -bh * 0.16);
      ctx.quadraticCurveTo(x - 3.6, bh * 0.1, x - 1.6, bh * 0.3);
      ctx.strokeStyle = css(INK, 0.3);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
  void hy; void hg;
}

/** Schuppen: wenige Bögen auf der Flanke, bei hoher Panzerung größer und dunkler, dazu Knochenschilde auf Rücken und Seite. */
function bodyScales(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const { m, bw, bh, hx } = A;
  const ar = m.armor ?? 0;
  const sc = 2.3 + 0.8 * ar;
  const x0 = -bw * 0.4, x1 = hx - 9;
  // nur zwei lockere Reihen auf der Flanke, nach hinten ausklingend: eine Andeutung, die auch in Spielgröße ruhig bleibt
  const rows = [-0.2, 0.04];
  rows.forEach((fy, row) => {
    for (let x = x1 - (row % 2) * 3.4 * sc; x > x0; x -= 6.4 * sc) {
      const k = Math.max(0, Math.min(1, (x - x0) / (bw * 0.7)));
      const y = fy * bh * (0.5 + 0.5 * k);
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * sc * (0.6 + 0.4 * k), 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.strokeStyle = css(INK, (0.16 + 0.4 * ar) * (0.35 + 0.65 * k));
      ctx.lineWidth = 1.05 + 0.8 * ar;
      ctx.stroke();
    }
  });
  if (ar > 0.3) {
    const k = Math.min(1, (ar - 0.3) / 0.5);
    for (const [y0, n, s] of [[-bh * 0.43, 7, 1], [bh * 0.0, 6, 0.75]] as [number, number, number][]) {
      for (let i = 0; i < n; i++) {
        const x = bw * 0.24 - (i / (n - 1)) * bw * 0.7;
        const w = (2.4 + 2 * k) * s, h = (1.7 + 1.5 * k) * s;
        const y = y0 + Math.abs(i / (n - 1) - 0.35) * bh * (y0 < 0 ? 0.2 : 0);
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x, y - h);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fillStyle = css(mix(grade(P.base), 0xc4baa2, 0.45), 0.4 + 0.5 * k);
        ctx.fill();
        ctx.strokeStyle = css(INK, 0.5 * k + 0.25);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }
}

/** Kiemendeckel, Wange, Kopfplatten – die Gestalt des Kopfes, ohne ihn vom Rumpf abzutrennen. */
function headDetails(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const { m, hx, hy, hg, bh } = A;
  const top = -hg.H / 2;
  const L = hg.L;
  const ym = hy + hg.mouthY;
  const base = fillOf(P).base;

  // Beißfisch: ein Kaumuskel wölbt die Wange hinter dem Maulwinkel
  if (m.jaw > 0.2) {
    const a = Math.min(1, (m.jaw - 0.2) / 0.5);
    ell(ctx, A.hinge[0] + 1.5, ym - 2.2 - 1.2 * a, 3.4 + 3.6 * a, 2.2 + 2.2 * a, -0.25);
    ctx.fillStyle = css(shadowOf(base), 0.28 + 0.3 * a);
    ctx.fill();
  }

  // Kopfplatten: wachsen mit dem Schädel (skull) und dem Kopfpanzer (spike < 0) zu einem Knochenschild über Stirn und Wange
  const pl = A.plate * A.plate * 0.7;
  if (pl > 0.04) {
    const a = A.plate;
    const crown = hy + top - hg.dome;
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy + top * 0.9);
    ctx.bezierCurveTo(hx + L * 0.1, crown * 1.0 - 1, hx + L * 0.55, crown + hg.dome * 0.1 - 0.5, hx + L * 0.92, ym - hg.snoutH * 0.92);
    ctx.lineTo(hx + L + 2, ym - 0.5);
    ctx.quadraticCurveTo(hx + L * 0.62, hy + hg.ey + hg.er * (1.5 + a), hx + L * 0.2, hy + hg.ey + hg.er * (1.9 + 1.3 * a));
    ctx.bezierCurveTo(hx - 1, hy + hg.H * 0.18, hx - 12, hy + hg.H * 0.1, hx - 11, hy + top * 0.1);
    ctx.bezierCurveTo(hx - 12, hy + top * 0.55, hx - 12, hy + top * 0.8, hx - 9, hy + top * 0.9);
    ctx.closePath();
    ctx.fillStyle = css(mix(grade(P.base), 0xbab09a, 0.35 + 0.35 * a), 0.55 + 0.4 * a);
    ctx.fill();
    ctx.strokeStyle = css(INK, 0.5 + 0.3 * a);
    ctx.lineWidth = 0.9 + 0.7 * a;
    ctx.stroke();
    // Nähte zwischen den Platten und ein paar Höcker
    ctx.beginPath();
    ctx.moveTo(hx + L * 0.16, crown * 0.98);
    ctx.quadraticCurveTo(hx + L * 0.2, hy + hg.ey, hx + L * 0.24, hy + hg.ey + hg.er * 1.7);
    ctx.moveTo(hx + L * 0.56, crown * 0.86);
    ctx.quadraticCurveTo(hx + L * 0.6, hy + hg.ey - hg.er, hx + L * 0.52, hy + hg.ey - hg.er * 1.3);
    ctx.strokeStyle = css(INK, 0.3 + 0.3 * a);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    const r = mulberry32(m.seed + 9);
    for (let i = 0; i < Math.round(3 + 5 * a); i++) {
      ell(ctx, hx + L * (0.08 + 0.7 * r()), crown * (0.78 + 0.14 * r()) + 0.5, 0.7 + 0.5 * a, 0.6 + 0.4 * a);
      ctx.fillStyle = `rgba(255,244,220,${0.25 + 0.25 * a})`;
      ctx.fill();
    }
  }

  // Augenhöhle im Kopfschild: ein dunkler Ring mit Knochenbraue – das Auge bleibt auch auf der hellen Platte das Erste, was man sieht
  if (A.plate > 0.04) {
    const a = A.plate, R = eyeBall(A.eye.r), ex = A.eye.x, ey = A.eye.y;
    ell(ctx, ex, ey, R * (1.45 + 0.2 * a), R * (1.4 + 0.2 * a));
    ctx.fillStyle = css(shadowOf(mix(grade(P.base), 0xbab09a, 0.4)), 0.92);
    ctx.fill();
    ctx.strokeStyle = css(INK, 0.9);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - R * 1.75, ey - R * 0.7);
    ctx.quadraticCurveTo(ex - R * 0.2, ey - R * (2.1 + 0.4 * a), ex + R * 1.9, ey - R * 0.55);
    ctx.strokeStyle = css(INK, 0.9);
    ctx.lineWidth = 1.5 + 0.8 * a;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - R * 1.4, ey - R * 1.0);
    ctx.quadraticCurveTo(ex - R * 0.1, ey - R * (1.75 + 0.35 * a), ex + R * 1.5, ey - R * 0.7);
    ctx.strokeStyle = `rgba(255,244,220,${0.3 + 0.25 * a})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // Männchen: ein farbiger Kehlfleck
  if (m.sex === 1) {
    ell(ctx, hx + L * 0.34, hy + hg.H * 0.34, L * 0.22, hg.H * 0.13, -0.12);
    ctx.fillStyle = css(mix(grade(P.base), 0xb4502c, 0.7), 0.85);
    ctx.fill();
  }
  void bh;
}

function scars(ctx: Ctx, A: FishAnatomy) {
  const { m, bw, bh } = A;
  const r = mulberry32(m.seed + 21);
  for (let i = 0; i < m.scars; i++) {
    const x = (r() - 0.5) * bw * 0.7 - 2, y = (r() - 0.6) * bh * 0.6;
    const len = 5 + r() * 7, a = -0.6 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 0.8, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.strokeStyle = css(INK, 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Die ganze Körpertextur: Schwanzflosse, Zähne des Oberkiefers, Körper mit Kopf – ein zusammenhängendes Bild. */
export function paintBody(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const { bh } = A;
  const F = fillOf(P);
  const path = () => bodyPath(ctx, A);

  // 2) Zähne des Oberkiefers: Die Wurzeln liegen unter der Lippe, die Lippenlinie des Körpers deckt sie
  const T = teethOf(A);
  const x0 = A.hinge[0] + A.jawLen * 0.3, x1 = A.tip[0] - 1.6;
  for (let i = 0; i < T.n; i++) {
    const t = (i + 0.5) / T.n;
    const x = x0 + t * (x1 - x0);
    // vorn die längsten Zähne (Fangzähne), hinten kurze
    const len = T.len * (0.55 + 0.6 * t);
    tooth(ctx, x, lipY(A, x) - 0.9, T.w, len + 0.9, 1, T.blunt);
  }

  // 3) der Körper: Grundfarbe, Rücken, Bauch
  path();
  ctx.fillStyle = css(F.base);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();

  // Gegenschattierung: dunkler Rücken, mittlere Flanke, heller Bauch – die Bänder folgen der Kontur (nicht waagerecht
  // durchgezogen), sie sind ein Ring um einen verkleinerten Kern der Silhouette
  ring(ctx, path, -bh * 0.03, 0.52, (top) => {
    ctx.fillStyle = css(top ? F.top : F.belly, 0.97);
  });

  bodyMarks(ctx, A, P);
  bodyScales(ctx, A, P);
  headDetails(ctx, A, P);
  scars(ctx, A);

  ctx.restore();

  // Licht von oben, hart abgesetzter Schatten unten – wie mit wenigen Pinselstrichen gesetzt
  const ht = bh;
  crescent(ctx, path, -ht * 0.04, -ht * 0.17, css(shadowOf(F.base), 0.7));
  crescent(ctx, path, 0.4, ht * 0.07, css(lightOf(F.base, 0.3), 0.55));

  // 4) Kontur
  outline(ctx, path, lineOf(F.base, 0.12), LW);

  // 4b) Die Schwanzflosse schließt an den Stiel an
  paintCaudal(ctx, A, P);

  // (Das Auge ist eine eigene Ebene – siehe paintEye –, damit es der Verformung folgt und unabhängig von der Körperzeichnung bleibt)
}

/** Umfang der Augentextur (Ursprung in der Augenmitte). */
export function eyeBox(A: FishAnatomy) {
  const R = eyeBall(A.eye.r) + 1.6;
  return { x0: -R, x1: R, y0: -R, y1: R };
}

/** Das Auge: Augapfel mit Iris, Pupille und Glanz (Tuschestil). Wacher Blick (keen) und finsterer Blick (fierce) kommen aus den Merkmalen. */
export function paintEye(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const m = A.m;
  eye(ctx, 0, 0, A.eye.r, P.eye, { lid: (0.15 + m.fierce * 0.45) * (1 - 0.5 * keenOf(m)), keen: keenOf(m) });
}

// ---------------------------------------------------------------------------
// Überlagerung: der Kiemendeckel liegt ÜBER dem Ansatz der Brustflosse – sie kommt unter seinem hinteren Rand hervor

/** Rückwärtsbogen des Kiemendeckels: setzt hinter dem Auge an, holt nach hinten aus und läuft zur Kehle. */
function gillCurve(ctx: Ctx, A: FishAnatomy, dx: number, from = 0) {
  const { hx, hy, hg } = A;
  const P0: P2 = [hx + 5.6 + dx, hy - hg.H * 0.27], C1: P2 = [hx - 4.5 + dx, hy - hg.H * 0.2], C2: P2 = [hx - 5.5 + dx, hy + hg.H * 0.28], P3: P2 = [hx + 3.4 + dx, hy + hg.H * 0.46];
  if (from === 0) {
    ctx.moveTo(P0[0], P0[1]);
    ctx.bezierCurveTo(C1[0], C1[1], C2[0], C2[1], P3[0], P3[1]);
  } else {
    ctx.lineTo(P3[0], P3[1]);
    ctx.bezierCurveTo(C2[0], C2[1], C1[0], C1[1], P0[0], P0[1]);
  }
}

export function paintOverlay(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const F = fillOf(P);
  const { hx, hy, hg } = A;
  const path = () => bodyPath(ctx, A);
  const flap = () => {
    ctx.beginPath();
    gillCurve(ctx, A, 0, 0);
    gillCurve(ctx, A, -2.4, 1);
    ctx.closePath();
  };
  // der Deckel wirft einen Schatten nach hinten (auf Rumpf und Flossenansatz)
  ctx.save();
  path();
  ctx.clip();
  ctx.beginPath();
  gillCurve(ctx, A, -2.6, 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = css(shadowOf(F.base), 0.4);
  ctx.stroke();
  // die Deckelkante selbst: eine Fläche in der Farbe der Flanke, damit sie die Flosse überdeckt
  flap();
  ctx.clip();
  ctx.fillStyle = css(F.base);
  ctx.fillRect(hx - 20, hy - hg.H, 40, hg.H * 2);
  ring(ctx, path, -A.bh * 0.03, 0.52, (top) => {
    ctx.fillStyle = css(top ? F.top : F.belly, 1);
  });
  // dieselben harten Licht- und Schattenstreifen wie am Körper, damit die Kante nicht als Fleck auffällt
  crescent(ctx, path, -A.bh * 0.04, -A.bh * 0.17, css(shadowOf(F.base), 0.7));
  crescent(ctx, path, 0.4, A.bh * 0.07, css(lightOf(F.base, 0.3), 0.55));
  ctx.restore();
  // Linie des Deckelrandes, eine helle Kante davor und zwei kurze Kiemenstriche
  ctx.save();
  path();
  ctx.clip();
  ctx.beginPath();
  gillCurve(ctx, A, 0, 0);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = css(INK, 0.85);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Unterkiefer (Ursprung im Gelenk, +x nach vorn)

export function jawPath(ctx: Ctx, A: FishAnatomy) {
  const len = A.jawLen, h = A.jawH;
  ctx.beginPath();
  ctx.moveTo(-2.4, 0.2);
  ctx.lineTo(len, 0.2);
  // die Spitze: leicht aufgeworfen, dann die Kinnlinie, die hinten in die Kehle des Körpers übergeht
  ctx.quadraticCurveTo(len + 1.6, h * 0.14, len - 0.4, h * 0.46);
  ctx.bezierCurveTo(len * 0.78, h * 0.98, len * 0.4, h * 1.02, len * 0.1, h * 0.9);
  ctx.quadraticCurveTo(-1, h * 0.84, -2.6, h * 0.62);
  ctx.closePath();
}

export function paintJaw(ctx: Ctx, A: FishAnatomy, P: Pal) {
  const F = fillOf(P);
  const path = () => jawPath(ctx, A);
  const len = A.jawLen;
  // Zähne des Unterkiefers wachsen nach oben aus der Lippe
  const T = teethOf(A);
  const n = 2;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = len * 0.32 + t * (len * 0.66 - 1.2);
    tooth(ctx, x, 1, T.w * 0.9, T.len * 0.8 * (0.55 + 0.5 * t) + 1, -1, T.blunt, -0.2);
  }
  path();
  ctx.fillStyle = css(mix(F.belly, F.base, 0.55));
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // der Kiefer liegt unter dem Kopf im Schatten
  ctx.fillStyle = css(shadowOf(F.base), 0.3);
  ctx.fillRect(-4, -2, len + 8, A.jawH * 0.4);
  ctx.restore();
  crescent(ctx, path, -0.6, -A.jawH * 0.22, css(shadowOf(F.base), 0.65));
  outline(ctx, path, lineOf(F.base, 0.12), LW);
}

// ---------------------------------------------------------------------------
// Flossen (jede mit eigenem Ursprung im Ansatzpunkt)

function finPaint(ctx: Ctx, path: () => void, c: number, rays: [P2, P2][], shade2: [number, number] | null) {
  ctx.fillStyle = css(c);
  path();
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // am Ansatz liegt die Flosse im Schatten des Körpers: ein harter Streifen, der dem Umriss folgt
  if (shade2) crescent(ctx, path, shade2[0], shade2[1], css(shadowOf(c), 0.6));
  ctx.strokeStyle = css(lineOf(c, 0.3), 0.7);
  ctx.lineWidth = 0.8;
  for (const [a, b] of rays) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
  outline(ctx, path, lineOf(c), LW * 0.9);
}

/** Rückenflosse (dir = -1, wächst nach oben) bzw. Afterflosse (dir = +1, nach unten); der Ansatz liegt bei y = 0, 2 Einheiten im Körper. */
export function paintMedianFin(ctx: Ctx, F: FinSpec, P: Pal, dir: number, dorsal: boolean) {
  const c = fillOf(P).fin;
  const w = F.base, h = F.len;
  const path = () => {
    ctx.beginPath();
    if (dorsal) {
      // vorn hoch, hinten flach auslaufend
      ctx.moveTo(w * 0.5, -dir * 2.5);
      ctx.bezierCurveTo(w * 0.42, dir * h * 0.55, w * 0.18, dir * h * 1.02, w * 0.04, dir * h);
      ctx.quadraticCurveTo(-w * 0.2, dir * h * 0.86, -w * 0.5, dir * h * 0.34);
      ctx.lineTo(-w * 0.5, -dir * 2.5);
    } else {
      ctx.moveTo(w * 0.5, -dir * 2.5);
      ctx.bezierCurveTo(w * 0.3, dir * h * 0.5, w * 0.05, dir * h * 0.96, -w * 0.18, dir * h);
      ctx.quadraticCurveTo(-w * 0.4, dir * h * 0.72, -w * 0.5, -dir * 2.5);
    }
    ctx.closePath();
  };
  const rays: [P2, P2][] = [];
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    rays.push([[w * (0.45 - t * 0.9), -dir * 1], [w * (0.3 - t * 0.78), dir * h * (dorsal ? 0.93 - t * 0.5 : 0.9 - t * 0.2)]]);
  }
  finPaint(ctx, path, c, rays, [0, dir * h * 0.34]);
}

/** Bauchflosse: ein kleiner Wedel, der nach unten und hinten zeigt. */
export function paintPelvicFin(ctx: Ctx, F: FinSpec, P: Pal) {
  const c = fillOf(P).fin;
  const w = F.base, h = F.len;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(w * 0.45, -2.5);
    ctx.quadraticCurveTo(w * 0.1, h * 0.7, -w * 0.45, h);
    ctx.quadraticCurveTo(-w * 0.2, h * 0.45, -w * 0.5, -2.5);
    ctx.closePath();
  };
  finPaint(ctx, path, c, [[[0.5, -1], [-w * 0.3, h * 0.88]], [[w * 0.2, -1], [-w * 0.1, h * 0.86]]], [0, h * 0.4]);
}

/** Brustflosse: ein Blatt, das nach hinten und unten zeigt. Mit kräftigem Stiel (limb) stützt sich das Tier am Grund ab. */
export function paintPectoral(ctx: Ctx, F: FinSpec & { lobed: boolean }, P: Pal, far: boolean) {
  const c = far ? shadowOf(fillOf(P).fin, 0.3) : fillOf(P).fin;
  const len = F.len;
  if (F.lobed) {
    // fleischiger Stiel, am Ende ein Flossensaum
    const w = 3.2;
    const stalk = () => {
      ctx.beginPath();
      ctx.moveTo(1.5, -w);
      ctx.bezierCurveTo(-len * 0.4, -w * 1.2, -len * 0.8, -w * 0.9, -len * 0.92, -w * 0.5);
      ctx.quadraticCurveTo(-len * 1.05, 0, -len * 0.92, w * 0.5);
      ctx.bezierCurveTo(-len * 0.8, w * 0.9, -len * 0.4, w * 1.2, 1.5, w);
      ctx.closePath();
    };
    const sail = () => {
      ctx.beginPath();
      ctx.moveTo(-len * 0.7, -w * 0.9);
      ctx.quadraticCurveTo(-len - w * 2.4, -w * 1.5, -len - w * 2.6, 0);
      ctx.quadraticCurveTo(-len - w * 2.4, w * 1.6, -len * 0.7, w * 0.9);
      ctx.closePath();
    };
    finPaint(ctx, sail, c, [[[-len * 0.8, 0], [-len - w * 2.3, 0]], [[-len * 0.8, -w * 0.5], [-len - w * 2, -w * 1.1]], [[-len * 0.8, w * 0.5], [-len - w * 2, w * 1.2]]], null);
    ctx.fillStyle = css(grade(P.base));
    stalk();
    ctx.fill();
    crescent(ctx, stalk, -0.4, -w * 0.6, css(shadowOf(grade(P.base)), 0.65));
    outline(ctx, stalk, lineOf(grade(P.base), 0.12), LW * 0.9);
    return;
  }
  const L = len;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(2, -3.2);
    ctx.bezierCurveTo(-L * 0.25, -3.6, -L * 0.7, L * 0.05, -L * 0.92, L * 0.62);
    ctx.quadraticCurveTo(-L * 0.4, L * 0.46, 0, 3.4);
    ctx.closePath();
  };
  const rays: [P2, P2][] = [];
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    rays.push([[0, -1.6 + t * 3.6], [-L * (0.55 + 0.37 * (1 - t)), L * (0.1 + 0.5 * (1 - t) + (t > 0.6 ? 0.08 : 0))]]);
  }
  // ein Schatten, den die Flosse auf den Körper wirft, liegt unter ihr (die Wurzel steckt in der Haut)
  if (!far) {
    ell(ctx, -L * 0.18, 3, L * 0.34, 3.8, 0.35);
    ctx.fillStyle = css(INK, 0.28);
    ctx.fill();
  }
  finPaint(ctx, path, c, rays, [-1.6, -L * 0.1]);
  // kurze anatomische Linien am Ansatz: die Hautfalte, unter der die Flosse hervorkommt
  if (!far) {
    ctx.beginPath();
    ctx.moveTo(1.6, -3.4);
    ctx.quadraticCurveTo(3.4, 0, 1.4, 3.6);
    ctx.strokeStyle = css(INK, 0.75);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Umfang einer Flossentextur (Ursprung im Ansatz): von … bis in x und y. */
export function finBox(kind: 'dorsal' | 'anal' | 'pelvic' | 'pectoral', F: FinSpec & { lobed?: boolean }) {
  const pad = 3;
  switch (kind) {
    case 'dorsal': return { x0: -F.base * 0.5 - pad, x1: F.base * 0.5 + pad, y0: -F.len - pad, y1: 4 };
    case 'anal': return { x0: -F.base * 0.5 - pad, x1: F.base * 0.5 + pad, y0: -4, y1: F.len + pad };
    case 'pelvic': return { x0: -F.base * 0.5 - pad, x1: F.base * 0.5 + pad, y0: -4, y1: F.len + pad };
    case 'pectoral': return F.lobed
      ? { x0: -F.len * 1.1 - 12, x1: 6, y0: -8, y1: 8 }
      : { x0: -F.len - pad, x1: 6, y0: -8, y1: F.len * 0.8 + pad };
  }
}

export { lightOf };
