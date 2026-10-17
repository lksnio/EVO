import Phaser from 'phaser';
import { type Ctx, ell, rgrad, tex, vgrad } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';

// Grafiken der Steintafel: Platte, Moos, Fische für die Wertung und die Muschel.

// ---------------------------------------------------------------- Moos

/** Ein weicher Mooshügel. */
function mossBlob(ctx: Ctx, x: number, y: number, r: number, a = 1) {
  ctx.fillStyle = rgrad(ctx, x - r * 0.2, y - r * 0.35, r * 0.05, r, [
    [0, `rgba(128,158,64,${0.95 * a})`],
    [0.5, `rgba(74,102,40,${0.95 * a})`],
    [1, 'rgba(34,52,24,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const MOSS = ['#2f4620', '#3f5a24', '#4d6a2a', '#5f7f33', '#7a9a41', '#94b050'];

/** Ein kleiner Moosbüschel: ein paar kurze, gebogene Halme. */
function tuft(ctx: Ctx, x: number, y: number, r: number, rnd: Rng) {
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    const len = r * (0.8 + rnd() * 1.2);
    ctx.strokeStyle = MOSS[Math.floor(rnd() * MOSS.length)];
    ctx.globalAlpha = 0.75 + rnd() * 0.25;
    ctx.lineWidth = Math.max(0.8, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * r, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Moos über einer Fläche: dunkler Grund, weiche helle und dunkle Flecken, tausende kleine Büschel. */
function mossField(ctx: Ctx, x: number, y: number, w: number, h: number, rnd: Rng, size: number) {
  ctx.fillStyle = '#233318';
  ctx.fillRect(x, y, w, h);
  // große, weiche Flecken: Tiefe und Abwechslung
  const macro = Math.ceil((w * h) / (size * size * 9));
  for (let i = 0; i < macro; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, r = size * (1.4 + rnd() * 2.2);
    const light = rnd() < 0.5;
    ctx.fillStyle = rgrad(ctx, px, py, 0, r, [[0, light ? 'rgba(110,140,56,0.5)' : 'rgba(10,22,8,0.55)'], [1, 'rgba(0,0,0,0)']]);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Büschel
  const r0 = Math.max(1.6, size * 0.34);
  const n = Math.ceil((w * h) / (r0 * r0 * 2.6));
  for (let i = 0; i < n; i++) tuft(ctx, x + rnd() * w, y + rnd() * h + r0, r0 * (0.7 + rnd() * 0.8), rnd);
  // Ränder: Büschel, die über die Fläche hinauswachsen
  const m = Math.ceil((w + h) / (r0 * 1.4));
  for (let i = 0; i < m; i++) {
    const t = rnd() * (w * 2 + h * 2);
    let px = x, py = y;
    if (t < w) px += t;
    else if (t < w + h) { px += w; py += t - w; }
    else if (t < 2 * w + h) { px += t - w - h; py += h; }
    else py += t - 2 * w - h;
    tuft(ctx, px, py + r0, r0 * (0.9 + rnd() * 0.9), rnd);
  }
  // feine Punkte: Tau und Sporen
  for (let i = 0; i < n * 0.6; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(190,214,110,0.55)' : 'rgba(14,24,10,0.55)';
    const sz = 0.7 + rnd() * 1.1;
    ctx.fillRect(x + rnd() * w, y + rnd() * h, sz, sz);
  }
}

/** Ein Stück Moos, das eine Zeile der Tafel bedeckt (ragt über die Ränder hinaus). */
export function mossPatch(scene: Phaser.Scene, w: number, h: number, seed: number) {
  const pad = Math.round(Math.min(8, h * 0.28));
  const key = `moss_${Math.round(w)}x${Math.round(h)}_${seed % 7}`;
  return {
    key: tex(scene, key, w + pad * 2, h + pad * 2, (ctx, cw, ch) => {
      const rnd = mulberry32(seed * 977 + 13);
      const size = Math.max(5, Math.min(11, h * 0.4));
      mossField(ctx, pad * 0.9, pad * 0.9, cw - pad * 1.8, ch - pad * 1.8, rnd, size);
      // dunkler Schatten unter dem Moos, damit es auf dem Stein aufliegt
    }, 2),
    pad,
  };
}

// ---------------------------------------------------------------- Platte

/** Umriss der Tafel: oben abgerundet, unten gerade, an den Kanten leicht ausgebrochen. */
function slabPath(ctx: Ctx, w: number, h: number, rnd: Rng, inset = 0) {
  const r = Math.min(w, h) * 0.13;
  const pts: [number, number][] = [];
  const j = () => (rnd() - 0.5) * 2.4;
  const step = 14;
  // oben links: Bogen
  for (let a = Math.PI; a <= Math.PI * 1.5; a += 0.2) pts.push([r + Math.cos(a) * r, r + Math.sin(a) * r]);
  for (let x = r + step; x < w - r; x += step) pts.push([x, j()]);
  for (let a = Math.PI * 1.5; a <= Math.PI * 2; a += 0.2) pts.push([w - r + Math.cos(a) * r, r + Math.sin(a) * r]);
  for (let y = r + step; y < h - 6; y += step) pts.push([w + j(), y]);
  pts.push([w - 4, h - 1]);
  for (let x = w - step; x > 8; x -= step) pts.push([x, h + j() * 0.8]);
  pts.push([3, h - 2]);
  for (let y = h - 8; y > r; y -= step) pts.push([j(), y]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = Math.max(inset, Math.min(w - inset, x)), py = Math.max(inset, Math.min(h - inset, y));
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
}

/** Die Steinplatte mit Rahmen, Rissen und Moos an den Rändern. */
export function slabTexture(scene: Phaser.Scene, w: number, h: number, seed = 5) {
  const key = `slab_${w}x${h}_${seed}`;
  return tex(scene, key, w, h, (ctx) => {
    const rnd = mulberry32(seed * 131 + w);
    const mini = w < 300;
    // Schatten unter der Platte
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = mini ? 6 : 16;
    ctx.shadowOffsetY = mini ? 2 : 6;
    slabPath(ctx, w, h - 8, rnd);
    ctx.fillStyle = '#4d4a43';
    ctx.fill();
    ctx.restore();
    const body = mulberry32(seed * 131 + w);
    ctx.save();
    slabPath(ctx, w, h - 8, body);
    ctx.clip();
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#77736a'], [0.5, '#5a5750'], [1, '#403d37']]);
    ctx.fillRect(0, 0, w, h);
    // Körnung und Flecken im Stein
    for (let i = 0; i < w * h / 26; i++) {
      ctx.fillStyle = rnd() < 0.5 ? `rgba(255,250,235,${0.03 + rnd() * 0.07})` : `rgba(0,0,0,${0.05 + rnd() * 0.1})`;
      const s = 0.8 + rnd() * 2.4;
      ctx.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd()));
    }
    for (let i = 0; i < (mini ? 5 : 14); i++) {
      const x = rnd() * w, y = rnd() * h, r = (mini ? 8 : 18) + rnd() * (mini ? 16 : 46);
      ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, rnd() < 0.5 ? 'rgba(20,18,14,0.22)' : 'rgba(210,205,185,0.12)'], [1, 'rgba(0,0,0,0)']]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Schichtlinien
    ctx.lineWidth = 1;
    for (let i = 0; i < (mini ? 3 : 7); i++) {
      const y = rnd() * h;
      ctx.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 3 + (rnd() - 0.5) * 2);
      ctx.stroke();
    }
    // Risse
    for (let i = 0; i < (mini ? 1 : 3); i++) {
      let x = w * (0.15 + rnd() * 0.7), y = rnd() * h * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const len = h * (0.2 + rnd() * 0.25);
      for (let t = 0; t < len; t += 7) {
        x += (rnd() - 0.5) * 12;
        y += 6 + rnd() * 4;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(8,7,6,0.7)';
      ctx.lineWidth = mini ? 0.8 : 1.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,230,0.1)';
      ctx.lineWidth = 1;
      ctx.translate(1.2, 1.2);
      ctx.stroke();
      ctx.translate(-1.2, -1.2);
    }
    // gemeißelter Rahmen: dunkle Rille mit heller Kante
    const m = mini ? 7 : 16;
    for (const [inset, dark] of [[m, true], [m + 1.4, false]] as const) {
      ctx.strokeStyle = dark ? 'rgba(10,9,8,0.75)' : 'rgba(255,248,225,0.16)';
      ctx.lineWidth = mini ? 1 : 1.8;
      ctx.strokeRect(inset, inset + (mini ? 6 : 14), w - inset * 2, h - 8 - inset * 2 - (mini ? 6 : 14));
    }
    // Rand: Abschattung innen, helle Kante oben links
    ctx.lineWidth = mini ? 3 : 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    slabPath(ctx, w, h - 8, mulberry32(seed * 131 + w));
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,248,225,0.2)';
    ctx.save();
    ctx.translate(-0.6, -0.6);
    slabPath(ctx, w, h - 8, mulberry32(seed * 131 + w));
    ctx.stroke();
    ctx.restore();

    // Moos: am Fuß, in den oberen Ecken und an den Seiten
    const sz = mini ? 5 : 9;
    for (let i = 0; i < w / (sz * 0.8); i++) {
      const x = (i / (w / (sz * 0.8))) * w + (rnd() - 0.5) * sz;
      mossBlob(ctx, x, h - 8 - rnd() * sz * 1.1, sz * (0.7 + rnd() * 1.1), 0.95);
    }
    for (const [cx, cy, n] of [[w * 0.06, h * 0.09, 12], [w * 0.95, h * 0.07, 9], [w * 0.04, h * 0.5, 8], [w * 0.97, h * 0.62, 8]] as const) {
      for (let i = 0; i < (mini ? n / 2 : n); i++) mossBlob(ctx, cx + (rnd() - 0.5) * sz * 4, cy + (rnd() - 0.5) * sz * 5, sz * (0.5 + rnd() * 0.9), 0.9);
    }
    // herabhängende Ranken
    if (!mini) {
      for (let i = 0; i < 9; i++) {
        const x = w * (0.04 + rnd() * 0.92), y0 = rnd() < 0.5 ? 2 : h * (0.5 + rnd() * 0.4);
        const len = 14 + rnd() * 30;
        ctx.strokeStyle = 'rgba(66,92,36,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.quadraticCurveTo(x + (rnd() - 0.5) * 12, y0 + len * 0.5, x + (rnd() - 0.5) * 8, y0 + len);
        ctx.stroke();
        mossBlob(ctx, x, y0 + len, 3.5, 1);
      }
    }
  }, 1);
}

// ---------------------------------------------------------------- Fische (Wertung)

/** Ein kleiner Fisch als Wertungszeichen: gefüllt (golden) oder nur als dunkle Rille. */
export function fishIcons(scene: Phaser.Scene) {
  const draw = (ctx: Ctx, on: boolean) => {
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(3, 12);
      ctx.bezierCurveTo(8, 3, 19, 3, 25, 12);
      ctx.bezierCurveTo(19, 21, 8, 21, 3, 12);
      ctx.closePath();
      ctx.moveTo(24, 12);
      ctx.lineTo(33, 4.5);
      ctx.quadraticCurveTo(31, 12, 33, 19.5);
      ctx.closePath();
    };
    if (on) {
      body();
      ctx.fillStyle = vgrad(ctx, 3, 21, [[0, '#f6e6b0'], [0.55, '#d8aa55'], [1, '#9a6a2c']]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,24,8,0.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,24,8,0.9)';
      ell(ctx, 8.5, 10.2, 1.3, 1.3);
      ctx.fill();
    } else {
      // eingeritzt: dunkle Rille, helle Kante darunter
      ctx.save();
      ctx.translate(0.9, 1);
      body();
      ctx.strokeStyle = 'rgba(255,248,225,0.2)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
      body();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,9,8,0.7)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  };
  tex(scene, 'fish_on', 36, 24, (ctx) => draw(ctx, true), 2);
  tex(scene, 'fish_off', 36, 24, (ctx) => draw(ctx, false), 2);
}

// ---------------------------------------------------------------- Muschel

/** Eine Fächermuschel: rosiges Perlmutt mit Rippen. */
export function shellTexture(scene: Phaser.Scene) {
  return tex(scene, 'shell', 46, 40, (ctx) => {
    // Schloss unten, Fächer oben
    ctx.save();
    ctx.translate(23, 36);
    const R = 31;
    const fan = () => {
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-R * Math.sin(1.0), -R * Math.cos(1.0) * 0.98);
      for (let a = -1.0; a <= 1.0; a += 0.1) ctx.lineTo(R * Math.sin(a) * 1.0, -R * Math.cos(a) * 0.98 - (Math.abs(Math.sin(a * 9)) * 1.6));
      ctx.lineTo(4, 0);
      ctx.closePath();
    };
    fan();
    ctx.fillStyle = rgrad(ctx, 0, -14, 2, 34, [[0, '#fff6ea'], [0.45, '#f0cfc6'], [1, '#b98a92']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,48,0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Rippen
    ctx.save();
    fan();
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,76,86,0.55)';
    ctx.lineWidth = 1.1;
    for (let i = -5; i <= 5; i++) {
      const a = i * 0.19;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(Math.sin(a) * R * 1.1, -Math.cos(a) * R * 1.08);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.8;
    for (let i = -5; i <= 5; i++) {
      const a = i * 0.19 + 0.05;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(Math.sin(a) * R * 1.1, -Math.cos(a) * R * 1.08);
      ctx.stroke();
    }
    ctx.restore();
    // Schloss
    ctx.fillStyle = '#d6b4ae';
    ctx.strokeStyle = 'rgba(70,40,48,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.quadraticCurveTo(0, -6, 9, 1);
    ctx.lineTo(7, 4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, 2);
}

/** Zeichnet die Texturen dieser Datei (einmal). */
export function tabletTextures(scene: Phaser.Scene) {
  fishIcons(scene);
  shellTexture(scene);
}
