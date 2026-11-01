import Phaser from 'phaser';
import { H, W } from '../config';
import type { PlaceDef } from '../data/world';
import { css, mix, shade } from '../util/color';
import { noiseTex } from './paint';
import { type Ctx, tex, vgrad, wrapX } from '../util/canvas';
import { mulberry32, type Rng } from '../util/math';

// ---------------------------------------------------------------------------
// Die Welt des Devons im Tuschestil: gestaffelte Ebenen aus flachen Silhouetten – ganz hinten blass und kontrastarm im Dunst,
// weiter vorn dunkler und schärfer, ganz vorn fast schwarz. Jeder der drei Orte hat seine eigene Stimmung (Farben, Licht,
// Bewuchs): der helle, klare Laichfluss, das grüne, dichte Flachwasser und das düstere Tiefental. Alle Bilder sind horizontal
// kachelbar und werden im Spiel mit unterschiedlicher Parallaxe verschoben (LevelScene.update).
// ---------------------------------------------------------------------------

export type MoodId = 'river' | 'garden' | 'valley';

export interface Mood {
  /** Verlauf des Wassers: oben, Mitte, unten */
  sky: [number, number, number];
  /** Farbe des Dunstes (Nebel und trübes Wasser) */
  fog: number;
  /** Silhouetten: fern (blass), mittel, nah (fast schwarz) */
  far: number;
  mid: number;
  near: number;
  /** Lichtstrahlen: Farbe und Stärke */
  ray: number;
  rayA: number;
  /** ein Akzent, der aus der Dunkelheit sticht (Leuchtzeug, Blüten) */
  accent: number;
  /** Bewuchs der Ebenen: Büschel Tang je Ebene (Anzahl) und Höhe-Faktor */
  weed: number;
  tall: number;
  /** wie dicht der Dunst über dem Grund liegt (0 … 1) */
  haze: number;
}

export const MOODS: Record<MoodId, Mood> = {
  // der Laichfluss: klares, helles Wasser, viel Licht von oben, ein paar schlanke Gräser
  river: {
    sky: [0x5cb8bc, 0x2e8a94, 0x145664], fog: 0x4a9ca2,
    far: 0x2c7f8a, mid: 0x14515c, near: 0x072a33,
    ray: 0xe6f8ee, rayA: 0.13, accent: 0xf0cd86, weed: 7, tall: 0.8, haze: 0.5,
  },
  // das Flachwasser: grün, üppig, dichter Bewuchs, gedämpftes Licht durch das Blätterdach des Tangs
  garden: {
    sky: [0x429a74, 0x226e58, 0x0f4040], fog: 0x378566,
    far: 0x26624f, mid: 0x0f3f38, near: 0x04211e,
    ray: 0xe9f4c4, rayA: 0.1, accent: 0xe88f86, weed: 12, tall: 1.2, haze: 0.55,
  },
  // das Tiefental: kalt, blau-violett, wenig Licht, hohe Säulen und Schatten – etwas Bedrohliches lauert dahinter
  valley: {
    sky: [0x2e5a8c, 0x1b3f6c, 0x0f2348], fog: 0x34509a,
    far: 0x20386a, mid: 0x0f2040, near: 0x040913,
    ray: 0xa8c0f0, rayA: 0.06, accent: 0x7fe3e6, weed: 5, tall: 1.5, haze: 0.7,
  },
};

/** Welche Stimmung hat ein Ort des Devons? */
export const moodOf = (place: PlaceDef): MoodId => (place.waterway === 2 ? 'valley' : place.waterway === 1 ? 'garden' : 'river');

const TAU = Math.PI * 2;
const grad = (ctx: Ctx, y0: number, y1: number, stops: [number, string][]) => vgrad(ctx, y0, y1, stops);

/** Eine Bergkette aus ganzen Wellen (kachelbar), mit gelegentlichen spitzen Zacken: flach gefüllt bis zum unteren Rand. */
function ridge(ctx: Ctx, r: Rng, baseY: number, amp: number, color: string, spikes = 0.35) {
  const waves = [1 + Math.floor(r() * 2), 3 + Math.floor(r() * 2), 6 + Math.floor(r() * 3), 11 + Math.floor(r() * 4)];
  const ph = waves.map(() => r() * TAU);
  const ws = [1, 0.55, 0.3, 0.13];
  const y = (x: number) => baseY - amp * (0.5 + 0.5 * waves.reduce((s, k, i) => s + ws[i] * Math.sin((x / W) * TAU * k + ph[i]), 0) / 2);
  ctx.beginPath();
  ctx.moveTo(-10, H + 10);
  const spikeAt = new Map<number, number>();
  for (let x = 0; x <= W; x += 16) if (r() < spikes * 0.12) spikeAt.set(x, amp * (0.25 + r() * 0.5));
  for (let x = -10; x <= W + 10; x += 8) {
    const gx = Math.round(x / 16) * 16;
    const sp = spikeAt.get(gx) ?? 0;
    // die Zacke: ein schmaler, spitzer Ausschlag (Stalagmit)
    const k = sp ? Math.max(0, 1 - Math.abs(x - gx) / 14) : 0;
    ctx.lineTo(x, y(x) - sp * k * k);
  }
  ctx.lineTo(W + 10, H + 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Ein Tangbüschel: schwingende Bänder mit Blättern, als flache Silhouette (kachelbar). */
function kelp(ctx: Ctx, r: Rng, x: number, baseY: number, ht: number, wd: number, color: string, leaves = true) {
  wrapX(W, x, wd * 6 + ht * 0.25, (xx) => {
    const n = 1 + Math.floor(r() * 3);
    for (let s = 0; s < n; s++) {
      const bx = xx + (s - (n - 1) / 2) * wd * 2.2 + (r() - 0.5) * wd;
      const h2 = ht * (0.75 + r() * 0.5);
      const ph = r() * TAU, sw = 8 + r() * 22;
      const steps = 14;
      const cx = (t: number) => bx + Math.sin(t * 3.2 + ph) * sw * t;
      const w = (t: number) => wd * (1 - t * 0.78) * (0.8 + 0.2 * Math.sin(t * 9 + ph));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.lineTo(cx(t) - w(t), baseY - h2 * t);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        ctx.lineTo(cx(t) + w(t), baseY - h2 * t);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (!leaves) continue;
      // Blätter: spitze Tropfen abwechselnd links und rechts
      for (let i = 2; i < steps; i += 2) {
        const t = i / steps, side = i % 4 ? 1 : -1, L = wd * (2.4 - t * 1.4) + 4;
        const px = cx(t), py = baseY - h2 * t;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + side * L * 0.5, py - L * 0.55, px + side * L, py - L * 0.9);
        ctx.quadraticCurveTo(px + side * L * 0.55, py - L * 0.2, px, py + wd * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

/** Eine Säule bzw. ein Felspfeiler: oben rundlich und schief, nach unten breiter (kachelbar). */
function pillar(ctx: Ctx, r: Rng, x: number, baseY: number, ht: number, wd: number, color: string) {
  wrapX(W, x, wd * 2, (xx) => {
    const lean = (r() - 0.5) * wd * 0.8;
    ctx.beginPath();
    ctx.moveTo(xx - wd, baseY + 4);
    ctx.bezierCurveTo(xx - wd * 0.8, baseY - ht * 0.4, xx - wd * 0.5 + lean, baseY - ht * 0.8, xx - wd * 0.28 + lean, baseY - ht);
    ctx.quadraticCurveTo(xx + lean, baseY - ht * 1.05, xx + wd * 0.3 + lean, baseY - ht * 0.98);
    ctx.bezierCurveTo(xx + wd * 0.5 + lean, baseY - ht * 0.75, xx + wd * 0.85, baseY - ht * 0.35, xx + wd, baseY + 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });
}

/** Schwamm- und Korallenkuppen: runde Hügel mit einem Kranz kleiner Buckel (kachelbar). */
function domes(ctx: Ctx, r: Rng, x: number, baseY: number, rad: number, color: string) {
  wrapX(W, x, rad * 2, (xx) => {
    ctx.beginPath();
    ctx.moveTo(xx - rad, baseY + 4);
    ctx.bezierCurveTo(xx - rad, baseY - rad * 1.2, xx + rad, baseY - rad * 1.2, xx + rad, baseY + 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.15 + 0.7 * (i / 3));
      ctx.beginPath();
      ctx.arc(xx + Math.cos(a) * rad * 0.82, baseY - rad * 0.3 + Math.sin(a) * rad * 0.8, rad * (0.2 + r() * 0.12), 0, TAU);
      ctx.fill();
    }
  });
}

/** Breite, weiche Lichtkegel von oben (kachelbar). */
function beams(ctx: Ctx, r: Rng, n: number, color: number, a: number) {
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.3 + r() * 0.4) / n) * W, w = 40 + r() * 90, len = H * (0.55 + r() * 0.3), lean = 60 + r() * 120;
    wrapX(W, x, w + lean, (xx) => {
      ctx.beginPath();
      ctx.moveTo(xx - w * 0.4, 0);
      ctx.lineTo(xx + w * 0.4, 0);
      ctx.lineTo(xx + w + lean, len);
      ctx.lineTo(xx - w + lean, len);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, len, [[0, css(color, a * (0.6 + r() * 0.8))], [0.55, css(color, a * 0.3)], [1, css(color, 0)]]);
      ctx.fill();
    });
  }
}

/** Das ferne Bild (deckend): Wasser, Lichtkegel, ganz blasse Silhouetten im Dunst. */
function farLayer(ctx: Ctx, mood: Mood, id: MoodId) {
  const r = mulberry32(id.length * 977 + 11);
  ctx.fillStyle = grad(ctx, 0, H, [[0, css(mood.sky[0])], [0.58, css(mood.sky[1])], [1, css(mood.sky[2])]]);
  ctx.fillRect(0, 0, W, H);
  beams(ctx, r, id === 'valley' ? 3 : 6, mood.ray, mood.rayA);
  // ganz fern: blasse Bergketten und Säulen, kaum dunkler als das Wasser
  const hazeTo = (c: number, k: number) => css(mix(c, mood.fog, k));
  ridge(ctx, r, H - 250, 170, hazeTo(mood.far, 0.35), 0.5);
  if (id !== 'river') for (let i = 0; i < 6; i++) pillar(ctx, r, (i + r() * 0.6) * (W / 6), H - 190, 150 + r() * 190 * mood.tall, 22 + r() * 24, hazeTo(mood.far, 0.25));
  ctx.fillStyle = grad(ctx, H - 360, H - 140, [[0, css(mood.fog, 0)], [1, css(mood.fog, 0.5 * mood.haze)]]);
  ctx.fillRect(0, H - 360, W, 220);
  ridge(ctx, r, H - 160, 130, hazeTo(mood.far, 0.1), 0.35);
  for (let i = 0; i < mood.weed; i++) kelp(ctx, r, r() * W, H - 130, 150 + r() * 130 * mood.tall, 5 + r() * 4, hazeTo(mood.far, 0.18), false);
  ctx.fillStyle = grad(ctx, H - 300, H, [[0, css(mood.fog, 0)], [1, css(mood.fog, 0.55 * mood.haze)]]);
  ctx.fillRect(0, H - 300, W, 300);
}

/** Das mittlere Bild (durchsichtig): dunklere, schärfere Silhouetten: Tangwälder, Pfeiler, Kuppen. */
function midLayer(ctx: Ctx, mood: Mood, id: MoodId) {
  const r = mulberry32(id.length * 331 + 7);
  const col = css(mood.mid);
  if (id === 'valley') for (let i = 0; i < 5; i++) pillar(ctx, r, (i + 0.2 + r() * 0.6) * (W / 5), H - 60, 260 + r() * 260, 30 + r() * 30, col);
  if (id === 'garden') for (let i = 0; i < 5; i++) domes(ctx, r, r() * W, H - 40, 50 + r() * 60, col);
  if (id === 'river') for (let i = 0; i < 3; i++) domes(ctx, r, r() * W, H - 40, 40 + r() * 40, css(mix(mood.mid, mood.far, 0.35)));
  for (let i = 0; i < mood.weed; i++) kelp(ctx, r, r() * W, H - 30 - r() * 40, 160 + r() * 200 * mood.tall, 6 + r() * 6, col);
  // der Dunst am Boden, damit die Silhouetten dort in den Grund übergehen
  ctx.fillStyle = grad(ctx, H - 220, H, [[0, css(mood.mid, 0)], [1, css(mix(mood.mid, mood.fog, 0.4), 0.7)]]);
  ctx.fillRect(0, H - 220, W, 220);
}

/** Dunst: wolkige, weiche Bänder in der Farbe des Ortes (kachelbar in der Breite). */
function fogLayer(ctx: Ctx, mood: Mood, w: number, h: number) {
  ctx.fillStyle = css(mood.fog);
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = ctx.createPattern(noiseTex('cloud'), 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, `rgba(0,0,0,${0.55 * mood.haze})`);
  g.addColorStop(1, `rgba(0,0,0,${0.75 * mood.haze})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Alle Bilder des Hintergrunds eines Ortes: fern, mittel, Dunst – wie levelBackgrounds in worldArt.ts. */
export function inkBackdrop(scene: Phaser.Scene, id: MoodId): [string, string, string] {
  const mood = MOODS[id];
  const far = tex(scene, `inkbg_far_${id}`, W, H, (ctx) => farLayer(ctx, mood, id));
  const mid = tex(scene, `inkbg_mid_${id}`, W, H, (ctx) => midLayer(ctx, mood, id));
  const FH = Math.round(H * 0.65);
  const fog = tex(scene, `inkbg_fog_${id}`, 512, FH, (ctx) => fogLayer(ctx, mood, 512, FH));
  return [far, mid, fog];
}

/**
 * Das trübe Wasser für die Sicht (siehe objects/Sight.ts): wo man nichts mehr sieht, ist nur Wasser in den Farben des Ortes –
 * oben heller, unten dunkler, ein wenig Dunst. alpha: wie dicht.
 */
export function inkMurk(scene: Phaser.Scene, id: MoodId, alpha: number): string {
  const mood = MOODS[id];
  return tex(scene, `inkmurk_${id}_${Math.round(alpha * 100)}`, W / 2, H / 2, (ctx) => {
    const w = W / 2, h = H / 2;
    const d = id === 'valley' ? 0.55 : 0.42;
    ctx.fillStyle = grad(ctx, 0, h, [[0, css(shade(mood.sky[0], -0.05))], [0.55, css(mix(mood.sky[1], mood.fog, 0.3))], [1, css(shade(mix(mood.sky[2], mood.fog, 0.4), -d * 0.12))]]);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = ctx.createPattern(noiseTex('cloud'), 'repeat')!;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  });
}
