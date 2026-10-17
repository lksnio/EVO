import Phaser from 'phaser';
import { type Ctx, ell, tex, vgrad } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';

// Grafiken der Steintafel: eine gebrochene Steinplatte mit Rissen und Runen, Moos in flachen,
// weichen Formen, die Fische der Wertung und die Muschel. Alles bewusst schlicht – wenige Farben,
// klare Flächen, keine Rauschtexturen.

type Pt = [number, number];

// ---------------------------------------------------------------- Aufteilung

/** Wo die Zeilen der Tafel liegen (gemeinsam für das Bild der Platte und die Zeilen darauf). */
export function tabletLayout(w: number, h: number, mini: boolean) {
  const top = mini ? h * 0.15 : h * 0.275;
  const bottom = mini ? h * 0.93 : h * 0.915;
  const padX = mini ? w * 0.07 : w * 0.105;
  return { top, bottom, padX, rowH: (bottom - top) / 14 };
}

// ---------------------------------------------------------------- Farben

const STONE = { lit: '#8d8878', mid: '#6f6b5f', low: '#4f4c44', side: '#2f2d29', edge: '#1d1b18' };
const MOSS = { dark: '#25361d', mid: '#3d562a', light: '#62833a', hi: '#8fae55' };

// ---------------------------------------------------------------- Moos

type Lobe = [number, number, number];

/**
 * Eine Moosmasse aus runden Lappen, ganz flach gemalt: dunkle Unterseite, mittlere Fläche und
 * eine helle Kante oben links – wie ein Polster, auf das von links oben Licht fällt.
 */
function mossMass(ctx: Ctx, lobes: Lobe[], rnd: Rng) {
  ctx.fillStyle = MOSS.dark;
  for (const [x, y, r] of lobes) {
    ctx.beginPath();
    ctx.arc(x + r * 0.08, y + r * 0.16, r * 1.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = MOSS.mid;
  for (const [x, y, r] of lobes) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (const [x, y, r] of lobes) {
    if (r < 3.5 || rnd() < 0.62) continue;
    const a0 = Math.PI * (1.0 + rnd() * 0.2);
    ctx.strokeStyle = rnd() < 0.25 ? MOSS.hi : MOSS.light;
    ctx.lineWidth = Math.max(0.9, r * (0.12 + rnd() * 0.1));
    ctx.beginPath();
    ctx.arc(x, y, r * (0.62 + rnd() * 0.2), a0, a0 + Math.PI * (0.25 + rnd() * 0.35));
    ctx.stroke();
  }
}

/**
 * Ein Stück Moos, das eine Zeile der Tafel bedeckt. Es ragt oben kaum, unten aber ein Stück über
 * die Zeile hinaus (so wächst das Moos zu einer Decke zusammen), und jedes sieht anders aus.
 * Rückgabe: Maße des Bildes relativ zur Zeile.
 */
export function mossPatch(scene: Phaser.Scene, w: number, h: number, seed: number) {
  const padX = Math.max(3, Math.round(h * 0.18));
  const padTop = Math.max(2, Math.round(h * 0.1));
  const padBot = Math.round(h * 0.42);
  const key = `moss3_${Math.round(w)}x${Math.round(h)}_${seed % 11}`;
  const cw = w + padX * 2, ch = h + padTop + padBot;
  tex(scene, key, cw, ch, (ctx) => {
    const rnd = mulberry32(seed * 977 + 13);
    // kleine Tafeln (Karten): größere Kuppen im Verhältnis, sonst wird das Moos zu kleinteilig
    const r0 = h * (h < 20 ? 0.85 : 0.5);
    // Grundfläche: deckt die ganze Zeile sicher ab
    ctx.fillStyle = MOSS.dark;
    ctx.beginPath();
    ctx.roundRect(padX + r0 * 1.2, padTop + 1, cw - padX * 2 - r0 * 2.4, h + padBot * 0.4, r0 * 0.6);
    ctx.fill();
    const lobes: Lobe[] = [];
    // obere Reihe: reicht fast bis zur Oberkante der Zeile – Größe, Abstand und Enden sehr unterschiedlich
    const endR = cw - padX * 0.8 - rnd() * h * 0.9;
    let x = padX * 0.4 + rnd() * h * 1.1;
    while (x < endR) {
      const r = r0 * (0.35 + rnd() * rnd() * 1.5 + rnd() * 0.3);
      lobes.push([x + r * 0.4, padTop + r - rnd() * 2.5, r]);
      x += r * (0.45 + rnd() * 0.9);
    }
    // darunter: größere Polster, die nach unten über die Zeile hinauswachsen
    x = padX * 0.3 + rnd() * h * 1.4;
    const endB = cw - padX * 0.6 - rnd() * h * 1.2;
    while (x < endB) {
      const r = r0 * (0.5 + rnd() * 0.9);
      lobes.push([x + r * 0.5, padTop + h * (0.5 + rnd() * 0.7), r]);
      x += r * (0.7 + rnd() * 0.9);
    }
    // die oberen zuletzt malen, damit ihre helle Kante vorn liegt
    lobes.sort((a, b) => b[1] - a[1]);
    mossMass(ctx, lobes, rnd);
  }, 2);
  return { key, padX, padTop, padBot, cw, ch };
}

// ---------------------------------------------------------------- Platte

/** Umriss der Tafel: oben abgebrochen (Stufen), an den Seiten ausgesplittert, unten fast gerade. */
function outline(w: number, h: number, rnd: Rng, k: number): Pt[] {
  const m = 12 * k;
  const L = m, R = w - m, B = h - m * 1.1;
  const pts: Pt[] = [];
  // Oberkante von links nach rechts: unterschiedlich hohe, abgebrochene Blöcke
  pts.push([L, h * (0.17 + rnd() * 0.04)]);
  let y = h * (0.07 + rnd() * 0.07);
  pts.push([L + 6 * k, y]);
  const steps = k > 0.6 ? 8 : 5;
  for (let i = 1; i <= steps; i++) {
    const x = L + 6 * k + ((R - L - 12 * k) * i) / steps + (rnd() - 0.5) * 0.35 * ((R - L) / steps);
    if (rnd() < 0.55) pts.push([x - 2 * k, y]);
    // Stufe oder Schräge
    y = h * (0.025 + rnd() * 0.12);
    if (rnd() < 0.5) pts.push([x - 1 * k, y]);
    pts.push([x + 1 * k, y]);
  }
  pts.push([R, h * (0.15 + rnd() * 0.05)]);
  // rechte Kante nach unten, mit ein oder zwei Ausbrüchen
  const chipR = [0.34 + rnd() * 0.2, 0.68 + rnd() * 0.15];
  let yy = pts[pts.length - 1][1];
  for (const c of chipR) {
    const cy = h * c, cs = (14 + rnd() * 14) * k;
    pts.push([R + (rnd() - 0.4) * 5 * k, cy - cs * 1.2]);
    pts.push([R - cs, cy - cs * 0.4], [R - cs * 0.7, cy + cs * 0.8], [R + (rnd() - 0.4) * 4 * k, cy + cs * 1.4]);
    yy = cy;
  }
  void yy;
  pts.push([R + (rnd() - 0.5) * 4 * k, B - 6 * k]);
  // Boden: fast gerade, mit einer abgeschlagenen Ecke links
  pts.push([R - 3 * k, B + (rnd() - 0.5) * 3 * k]);
  for (let x = R - 40 * k; x > L + 60 * k; x -= (30 + rnd() * 40) * k) pts.push([x, B + (rnd() - 0.5) * 5 * k]);
  pts.push([L + 34 * k, B], [L + 2 * k, B - 30 * k - rnd() * 16 * k]);
  // linke Kante nach oben, mit einem Ausbruch
  const cl = h * (0.4 + rnd() * 0.2), cs = (12 + rnd() * 12) * k;
  pts.push([L + (rnd() - 0.5) * 4 * k, cl + cs * 1.4], [L + cs * 0.9, cl + cs * 0.5], [L + cs * 0.6, cl - cs * 0.7], [L + (rnd() - 0.4) * 3 * k, cl - cs * 1.3]);
  return pts;
}

function poly(ctx: Ctx, pts: Pt[], dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.closePath();
}

/** Ein Riss: eckiger Linienzug, dunkel mit heller Kante. */
function crack(ctx: Ctx, x: number, y: number, len: number, rnd: Rng, k: number, bias = 0) {
  const pts: Pt[] = [[x, y]];
  let cx = x, cy = y;
  while (cy < y + len) {
    cx += (rnd() - 0.5 + bias) * 22 * k;
    cy += (7 + rnd() * 14) * k;
    pts.push([cx, cy]);
  }
  const line = (dx: number, dy: number, col: string, lw: number) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  line(1.4 * k, 1 * k, 'rgba(255,246,225,0.22)', 1.2 * k + 0.4);
  line(0, 0, 'rgba(14,12,10,0.8)', 1.7 * k + 0.4);
  return pts;
}

/** Eingemeißelter Strich: dunkle Rille, helle Kante darunter. */
function carve(ctx: Ctx, draw: () => void, k: number) {
  ctx.save();
  ctx.translate(1.2 * k, 1.1 * k);
  draw();
  ctx.strokeStyle = 'rgba(255,246,225,0.25)';
  ctx.lineWidth = 1.5 * k + 0.2;
  ctx.stroke();
  ctx.restore();
  draw();
  ctx.strokeStyle = 'rgba(14,12,10,0.78)';
  ctx.lineWidth = 1.7 * k + 0.2;
  ctx.stroke();
}

/** Ein Runenzeichen: wenige gerade Striche, jedes anders. */
function rune(ctx: Ctx, x: number, y: number, s: number, kind: number, k: number) {
  carve(ctx, () => {
    ctx.beginPath();
    switch (kind % 7) {
      case 0: ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.moveTo(x, y - s * 0.2); ctx.lineTo(x + s * 0.7, y - s * 0.8); break;
      case 1: ctx.moveTo(x - s * 0.6, y - s); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.6, y + s); break;
      case 2: ctx.moveTo(x - s * 0.7, y + s); ctx.lineTo(x, y - s); ctx.lineTo(x + s * 0.7, y + s); ctx.moveTo(x - s * 0.4, y + s * 0.2); ctx.lineTo(x + s * 0.4, y + s * 0.2); break;
      case 3: ctx.moveTo(x - s * 0.6, y - s * 0.8); ctx.lineTo(x + s * 0.6, y + s * 0.8); ctx.moveTo(x + s * 0.6, y - s * 0.8); ctx.lineTo(x - s * 0.6, y + s * 0.8); break;
      case 4: ctx.moveTo(x + s * 0.8, y); ctx.arc(x, y, s * 0.8, 0, Math.PI * 2); ctx.moveTo(x, y - s * 0.2); ctx.lineTo(x, y + s * 0.2); break;
      case 5: ctx.moveTo(x - s * 0.5, y - s); ctx.lineTo(x - s * 0.5, y + s); ctx.lineTo(x + s * 0.6, y + s * 0.2); break;
      default: ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.6, y); ctx.closePath();
    }
  }, k);
}

/**
 * Die Steinplatte. Der Umriss ist gebrochen und für jede Größe etwas anders; die Fläche besteht
 * aus wenigen hellen und dunklen Facetten, ein paar Rissen, Ausbrüchen und – bei der großen
 * Tafel – einem Rahmen aus gemeißelten Linien und Runen. Moos wächst unten und an den Rändern.
 */
export function slabTexture(scene: Phaser.Scene, w: number, h: number, seed = 5) {
  const mini = w < 300;
  const k = w / 560;
  const key = `slab2_${w}x${h}_${seed}`;
  return tex(scene, key, w, h, (ctx) => {
    const rnd = mulberry32(seed * 131 + Math.round(w));
    const pts = outline(w, h, rnd, k);

    // Schatten und Seitenfläche (die Dicke der Platte)
    poly(ctx, pts, 8 * k, 10 * k);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
    poly(ctx, pts, 5 * k, 6.5 * k);
    ctx.fillStyle = STONE.side;
    ctx.fill();

    // Vorderseite
    poly(ctx, pts);
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, STONE.lit], [0.5, STONE.mid], [1, STONE.low]]);
    ctx.fill();
    ctx.save();
    poly(ctx, pts);
    ctx.clip();
    // große Facetten: Licht fällt von links oben
    for (let i = 0; i < (mini ? 5 : 11); i++) {
      const cx = rnd() * w, cy = rnd() * h, r = (60 + rnd() * 150) * k;
      const a = rnd() * 6.28;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a + 2.1) * r * (0.6 + rnd() * 0.6), cy + Math.sin(a + 2.1) * r * (0.6 + rnd() * 0.6));
      ctx.lineTo(cx + Math.cos(a + 4.1) * r * (0.6 + rnd() * 0.6), cy + Math.sin(a + 4.1) * r * (0.6 + rnd() * 0.6));
      ctx.closePath();
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,248,225,0.07)' : 'rgba(10,8,6,0.1)';
      ctx.fill();
    }
    // ein breiter Lichtstreif von links oben
    const sweep = ctx.createLinearGradient(0, 0, w * 0.8, h * 0.55);
    sweep.addColorStop(0, 'rgba(255,248,225,0.13)');
    sweep.addColorStop(1, 'rgba(255,248,225,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, w, h);
    // Abschattung unten
    const shade = ctx.createLinearGradient(0, h * 0.6, 0, h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    // Ausbrüche in der Fläche
    for (let i = 0; i < (mini ? 3 : 9); i++) {
      let cx = 0, cy = 0;
      for (let t = 0; t < 8; t++) {
        cx = (0.04 + rnd() * 0.92) * w;
        cy = (0.1 + rnd() * 0.85) * h;
        const lay = tabletLayout(w, h, mini);
        if (!(cx > lay.padX * 0.8 && cx < w - lay.padX * 0.8 && cy > lay.top - 4 && cy < lay.bottom + 4)) break;
      }
      const r = (4 + rnd() * 10) * k;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx - r * 0.2, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.9, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.7);
      ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(20,18,15,0.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,225,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy + r * 0.6);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.9, cy - r * 0.2);
      ctx.stroke();
    }

    // Risse
    crack(ctx, w * (0.2 + rnd() * 0.15), h * 0.05, h * (mini ? 0.25 : 0.34), rnd, k, 0.06);
    if (!mini) {
      crack(ctx, w * (0.62 + rnd() * 0.15), h * 0.04, h * 0.22, rnd, k, -0.05);
      crack(ctx, w * (0.7 + rnd() * 0.2), h * 0.8, h * 0.18, rnd, k, 0.1);
    }

    // Gemeißeltes: Überschrift-Zeichen, unterbrochener Rahmen, Runen an den Rändern
    if (!mini) {
      const lay = tabletLayout(w, h, false);
      // Spiralzeichen links und rechts von der Überschrift
      for (const sx of [w * 0.12 + 18 * k, w * 0.88 - 18 * k]) {
        carve(ctx, () => {
          ctx.beginPath();
          for (let a = 0; a < 11; a += 0.25) {
            const rr = 1.6 + a * 1.35;
            const px = sx + Math.cos(a) * rr * (sx < w / 2 ? 1 : -1), py = h * 0.2 + Math.sin(a) * rr;
            if (a) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
        }, k);
      }
      // Trennlinie unter der Überschrift: mit Lücken
      const yl = h * 0.245;
      for (let x = lay.padX; x < w - lay.padX; ) {
        const seg = (30 + rnd() * 90) * k;
        const x1 = Math.min(w - lay.padX, x + seg);
        carve(ctx, () => { ctx.beginPath(); ctx.moveTo(x, yl + (rnd() - 0.5) * 2); ctx.lineTo(x1, yl + (rnd() - 0.5) * 2); }, k);
        x = x1 + (6 + rnd() * 22) * k;
      }
      // Rahmenlinien links und rechts neben den Zeilen – mit Lücken, wo der Stein abgeplatzt ist
      for (const fx of [w * 0.062, w * 0.938]) {
        for (let y = h * 0.29; y < h * 0.9; ) {
          const seg = (40 + rnd() * 110) * k;
          const y1 = Math.min(h * 0.9, y + seg);
          carve(ctx, () => { ctx.beginPath(); ctx.moveTo(fx + (rnd() - 0.5) * 2, y); ctx.lineTo(fx + (rnd() - 0.5) * 2, y1); }, k);
          y = y1 + (8 + rnd() * 30) * k;
        }
      }
      // Runen: einzeln, mit Abständen, an manchen Stellen fehlen sie
      for (const rx of [w * 0.03, w * 0.97]) {
        for (let y = h * 0.3; y < h * 0.88; y += (22 + rnd() * 12) * k) {
          if (rnd() < 0.3) continue;
          rune(ctx, rx + (rnd() - 0.5) * 3 * k, y, (4 + rnd() * 2) * k, Math.floor(rnd() * 7), k);
        }
      }
    }
    ctx.restore();

    // Kanten: hell, wo sie zum Licht (links oben) zeigen, sonst dunkel
    const cxm = w / 2, cym = h / 2;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      // Außennormale (der Umriss läuft im Uhrzeigersinn)
      let nx = dy / len, ny = -dx / len;
      if ((x0 - cxm) * nx + (y0 - cym) * ny < 0) { nx = -nx; ny = -ny; }
      const lit = -nx * 0.6 - ny * 0.8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = lit > 0.1 ? `rgba(255,246,225,${0.18 + 0.4 * lit})` : `rgba(10,8,6,${0.35 + 0.3 * -lit})`;
      ctx.lineWidth = (lit > 0.1 ? 1.6 : 2.2) * k + 0.3;
      ctx.stroke();
    }

    // Moos: ein unregelmäßiger Saum unten, Polster an den Rändern, ein paar hängende Ranken
    const lobes: Lobe[] = [];
    const B = h - 12 * k * 1.1;
    const bandMax = mini ? 16 : 34;
    let phase = rnd() * 6;
    for (let x = 4 * k; x < w; x += (7 + rnd() * 9) * k) {
      const n = (Math.sin(x * 0.012 + phase) + Math.sin(x * 0.031 + phase * 2) * 0.6 + 1.6) / 3.2;
      const hh = (7 + n * bandMax) * k;
      lobes.push([x, B + 3 * k - hh * 0.5, hh * 0.55 + rnd() * 6 * k]);
    }
    // Polster an der linken Seite (wächst vom Boden hoch) und rechts oben
    const climb = (x0: number, y0: number, up: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lobes.push([x0 + (rnd() - 0.5) * 18 * k, y0 - up * t + (rnd() - 0.5) * 8 * k, (11 - 6 * t + rnd() * 6) * k]);
      }
    };
    climb(w * 0.035, B - 6 * k, h * (mini ? 0.2 : 0.32), mini ? 6 : 14);
    climb(w * 0.97, B - 6 * k, h * (mini ? 0.1 : 0.16), mini ? 4 : 8);
    // Polster auf den waagerechten Stücken der abgebrochenen Oberkante
    const ledges: [Pt, Pt][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b2 = pts[(i + 1) % pts.length];
      if (a[1] < h * 0.2 && b2[1] < h * 0.2 && Math.abs(b2[1] - a[1]) < 6 * k && Math.abs(b2[0] - a[0]) > 22 * k) ledges.push([a, b2]);
    }
    for (let i = 0; i < (mini ? 1 : Math.min(3, ledges.length)); i++) {
      const [a, b2] = ledges[Math.floor(rnd() * ledges.length)];
      const n = 3 + Math.floor(rnd() * 3);
      const t0 = rnd() * 0.4;
      for (let j = 0; j < n; j++) {
        const t = t0 + (j / n) * 0.55;
        const r = (4 + rnd() * 5) * k;
        lobes.push([a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t - r * 0.5, r]);
      }
    }
    // Moostropfen, die an den Rändern herabhängen: eine Kette immer kleinerer Kuppen
    if (!mini) {
      for (let i = 0; i < 4; i++) {
        const x = w * (0.07 + rnd() * 0.86), y0 = h * (0.12 + rnd() * 0.08), len = (16 + rnd() * 30) * k;
        const m = 4;
        for (let j = 0; j < m; j++) {
          const t = j / (m - 1);
          lobes.push([x + (rnd() - 0.5) * 3 * k, y0 + len * t, (4.2 - 2.6 * t) * k]);
        }
      }
    }
    mossMass(ctx, lobes, rnd);
  }, 1);
}

// ---------------------------------------------------------------- Fische (Wertung)

/** Ein kleiner Fisch als Wertungszeichen: gefüllt (warmes Ocker) oder nur als eingeritzte Linie. */
export function fishIcons(scene: Phaser.Scene) {
  const body = (ctx: Ctx) => {
    ctx.beginPath();
    ctx.moveTo(2, 12);
    ctx.bezierCurveTo(8, 3.5, 18, 3.5, 24, 12);
    ctx.bezierCurveTo(18, 20.5, 8, 20.5, 2, 12);
    ctx.closePath();
    ctx.moveTo(23, 12);
    ctx.lineTo(32, 5);
    ctx.lineTo(32, 19);
    ctx.closePath();
  };
  tex(scene, 'fish_on', 36, 24, (ctx) => {
    body(ctx);
    ctx.fillStyle = '#c9a04a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,6,0.9)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,14,6,0.9)';
    ell(ctx, 7.5, 10.4, 1.3, 1.3);
    ctx.fill();
  }, 2);
  tex(scene, 'fish_off', 36, 24, (ctx) => {
    ctx.save();
    ctx.translate(0.9, 1);
    body(ctx);
    ctx.strokeStyle = 'rgba(255,246,225,0.22)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    body(ctx);
    ctx.strokeStyle = 'rgba(14,12,10,0.7)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }, 2);
}

// ---------------------------------------------------------------- Muschel

/**
 * Eine Spiralmuschel, ganz schlicht: cremeweiß, von oben nach unten immer größere Windungen, unten
 * die rosa Mündung, ein heller Fleck. Dazu ein flacher Schatten – kein Leuchten.
 */
export function shellTexture(scene: Phaser.Scene) {
  tex(scene, 'shell', 44, 48, (ctx) => {
    const OUT = '#8a5d58', CREAM = '#f5e8d3', CREAM2 = '#e8d2b8', PINK = '#eaa9a1', DEEP = '#b9726d';
    // flacher Schatten auf dem Boden
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ell(ctx, 23, 44, 15, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(22, 25);
    ctx.rotate(0.16);
    // Windungen von der Spitze (oben) zur großen Windung (unten)
    const whorls: [number, number, number, number][] = [
      [-4, -19, 3.6, 3.1],
      [-3.4, -13.6, 6, 4.8],
      [-2, -6.2, 9, 6.6],
      [0.5, 3.2, 12.6, 9.4],
    ];
    for (const [x, y, rx, ry] of whorls) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.06, 0, Math.PI * 2);
      ctx.fillStyle = CREAM;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // Schattenseite der Windung (unten rechts)
      ctx.beginPath();
      ctx.ellipse(x + rx * 0.1, y + ry * 0.16, rx * 0.86, ry * 0.8, -0.06, 0.15, Math.PI * 0.85);
      ctx.strokeStyle = CREAM2;
      ctx.lineWidth = Math.max(1.5, ry * 0.34);
      ctx.stroke();
    }
    // Rippen quer über die große Windung
    ctx.strokeStyle = 'rgba(138,93,88,0.5)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const x = -8 + i * 4.6;
      ctx.beginPath();
      ctx.moveTo(x, -4.6);
      ctx.quadraticCurveTo(x + 2.6, 3, x + 0.6, 11.4);
      ctx.stroke();
    }
    // Mündung unten rechts
    ctx.beginPath();
    ctx.ellipse(7.4, 9.6, 5.6, 4.4, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(8.2, 10.2, 3, 2.3, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = DEEP;
    ctx.fill();
    // heller Fleck
    ctx.beginPath();
    ctx.ellipse(-6.6, -1.4, 1.3, 2.8, 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,252,245,0.85)';
    ctx.fill();
    ctx.restore();
  }, 3);
}

/** Zeichnet die Texturen dieser Datei (einmal). */
export function tabletTextures(scene: Phaser.Scene) {
  fishIcons(scene);
  shellTexture(scene);
}
