import Phaser from 'phaser';
import { W, H, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { ERAS, inEra, yearsAgo, type EpochDef } from '../data/epochs';
import { SPECIES } from '../data/species';
import { game, speciesName } from '../state/GameState';
import { worldYears } from '../sim/life';
import { makeSpeciesPortrait, makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { pattern } from '../art/paint';
import { newCanvas, rgrad, tex, vgrad, type Ctx } from '../util/canvas';
import { clamp, mulberry32 } from '../util/math';
import { Button, fadeIn, fadeTo, soundIcon, text } from '../ui/ui';
import { continueLife, startNewLife } from './flow';
import devonUrl from '../assets/eras/devon.webp';
import karbonUrl from '../assets/eras/karbon.webp';
import permUrl from '../assets/eras/perm.webp';
import kreideUrl from '../assets/eras/kreide.webp';

// ---------------------------------------------------------------------------
// Die Wahl des Zeitalters: sieben Bilder nebeneinander, so hoch wie der Bildschirm – das gewählte öffnet sich weit, die
// anderen bleiben schmale Streifen (wie Buchrücken: Name senkrecht, oben der Zeitraum, unten die Nummer). Jedes Bild lebt:
// Im Meer fällt Licht von oben, ein Lichtnetz spielt am Grund, ein Schwarm zieht vorbei; im Kohlesumpf treiben Nebelbänke
// und Sporen, eine Riesenlibelle schwirrt; im Perm glüht die Sonne im Dunst, goldener Staub steigt, ein Farn wiegt sich.
// Zeitalter, in denen man noch nicht leben kann, ruhen „im Gestein“: grau, mit feinen Rissen – angewählt kehrt etwas Farbe
// zurück, und Licht streicht über den Stein. Wo das Bild noch fehlt, steht eine dunkle Steintafel mit einem eingemeißelten
// Fossil, und in ihren Rissen glimmt es: Bald bricht sie auf.
// Jedes Bild hat seine eigene Kamera (so bleibt alles in seinem Streifen); darüber liegt die Kamera mit Schrift und Knöpfen.
// ---------------------------------------------------------------------------

/** wie ein Bild lebt: Meer, Sumpf, Land – oder noch Stein (das Bild fehlt) */
type Kind = 'water' | 'swamp' | 'land' | 'stone';

/** Wie ein Zeitalter in der Auswahl aussieht: sein Bild und was darin lebt. */
interface Look {
  kind: Kind;
  /** ohne Bild: eine Steintafel */
  url?: string;
  /** Blickpunkt (Anteil der Bildbreite) – als schmaler Streifen bzw. weit geöffnet */
  focus: [number, number];
  /** wo das Licht einfällt (Anteil der Bildbreite) und wie schräg */
  light: number;
  tilt: number;
  /** Farbe des Lichts (im Wasser, im Nebel, in der Sonne) */
  tint: number;
  /** Meer: ab hier ist Grund (Anteil der Bildhöhe) – dort spielt das Lichtnetz */
  floor?: number;
  /** Meer: ein Schwarm, der in der Ferne vorüberzieht (Art, Höhe als Anteil der Bildhöhe, Farbe) */
  school?: string;
  schoolY?: number;
  schoolTint?: number;
  /** Land und Sumpf: hier zieht der Dunst (Höhen als Anteil der Bildhöhe) */
  mist?: number[];
  /** Land: hier steht die Sonne */
  sun?: [number, number];
  /** eine Libelle (Mitte ihres Flugs, Größe) */
  fly?: [number, number, number];
  /** Stein: das Fossil in der Tafel */
  relic?: string;
}

const LOOK: Record<string, Look> = {
  devon: { kind: 'water', url: devonUrl, focus: [0.7, 0.56], light: 0.22, tilt: 0.2, tint: 0xcfe6ff, floor: 0.74, school: 'moythomasia', schoolY: 0.12, schoolTint: 0x24476a },
  karbon: { kind: 'swamp', url: karbonUrl, focus: [0.66, 0.55], light: 0.36, tilt: 0.12, tint: 0xe6f2d4, mist: [0.27, 0.43, 0.56, 0.8], fly: [0.7, 0.2, 1.05] },
  perm: { kind: 'land', url: permUrl, focus: [0.36, 0.42], light: 0.6, tilt: 0.5, tint: 0xffdcaa, mist: [0.36, 0.52], sun: [0.58, 0.2], fly: [0.3, 0.14, 0.62] },
  trias: { kind: 'stone', focus: [0.5, 0.5], light: 0.4, tilt: 0.2, tint: 0xffd9a8, relic: 'ammonit' },
  jura: { kind: 'stone', focus: [0.46, 0.5], light: 0.4, tilt: 0.2, tint: 0xffd9a8, relic: 'elasmosaurus' },
  kreide: { kind: 'water', url: kreideUrl, focus: [0.62, 0.52], light: 0.48, tilt: 0.05, tint: 0xd2f0ff, floor: 0.7, school: 'apsopelix', schoolY: 0.45, schoolTint: 0x2a6488 },
  palaeogen: { kind: 'stone', focus: [0.5, 0.5], light: 0.4, tilt: 0.2, tint: 0xffd9a8, relic: 'cretoxyrhina' },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const GAP = 3;
/** Breite des geöffneten Bildes; die anderen teilen sich den Rest */
const WIDE = 620;
const NARROW = (W - WIDE - GAP * (ERAS.length - 1)) / (ERAS.length - 1);
/** Hier liegen die Bühnen der Zeitalter in der Welt – weit weg von Schrift und Knöpfen */
const STAGE_X = 20000, STAGE_STEP = 6000;
/** linker Rand des Schriftblocks eines geöffneten Bildes */
const TEXT_X = 50;
/** die Steintafel (wo das Bild noch fehlt) */
const SLAB_W = 700, SLAB_H = 800;

interface Swimmer {
  s: Phaser.GameObjects.Sprite;
  ox: number;
  oy: number;
  ph: number;
}

interface Panel {
  /** Platz in der Auswahl und Nummer des Zeitalters */
  k: number;
  i: number;
  ep: EpochDef;
  look: Look;
  playable: boolean;
  cam: Phaser.Cameras.Scene2D.Camera;
  /** ruhende Zeitalter mit Bild: grau wie Stein (wie grau: 1 ganz, weniger lässt Farbe durch) */
  grey?: Phaser.Filters.ColorMatrix;
  greyNow: number;
  layer: Phaser.GameObjects.Layer;
  /** die Bühne in der Welt: linker Rand, Bildgröße, Oberkante des Bildes */
  ox: number;
  dw: number;
  dh: number;
  top: number;
  /** auf dem Bildschirm: links und Breite; wie weit geöffnet (0 … 1) */
  x: number;
  w: number;
  t: number;
  ph: number;
  narrowC: Phaser.GameObjects.Container;
  wideC: Phaser.GameObjects.Container;
  shadeB: Phaser.GameObjects.Image;
  shadeT: Phaser.GameObjects.Image;
  /** geöffnet: unten links, hinter der Schrift, wird es dunkler */
  corner: Phaser.GameObjects.Image;
  side: Phaser.GameObjects.Image;
  /** nicht gewählt: etwas dunkler */
  dim: Phaser.GameObjects.Rectangle;
  clock?: Phaser.GameObjects.Text;
  school: Swimmer[];
  schoolX: number;
  schoolV: number;
  /** ruhend: Maserung und Risse über dem Bild (angewählt treten sie zurück), das Glimmen in den Rissen der Tafel */
  veil: { o: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite; a: number; on: number }[];
  glow?: Phaser.GameObjects.Image;
  sweep?: Phaser.GameObjects.Image;
  fly?: Phaser.GameObjects.Sprite;
  buttons: Button[];
}

// ---------------------------------------------------------------- Texturen

/** feine Risse (immer dieselben: gleiche Saat) – als dunkle Linien oder als Glut darin */
function drawCracks(ctx: Ctx, style: string, wMul: number) {
  const r = mulberry32(19);
  const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      ctx.lineTo(x, y);
      if (depth < 2 && r() < 0.08) {
        ctx.stroke();
        crack(x, y, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), Math.floor(len * 0.4), w * 0.6, depth + 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.lineWidth = w * wMul;
    ctx.stroke();
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style;
  for (const [x, y, a, len] of [[40, -10, 1.2, 60], [300, 0, 1.75, 70], [512, 260, 2.8, 40], [0, 420, -0.25, 50], [180, 730, -1.4, 30]] as const) {
    crack(x, y, a, len, 1.1, 0);
  }
}

/** ein Wedel: Stiel im Bogen, Fiedern zu beiden Seiten (zur Spitze hin kürzer) */
function frond(ctx: Ctx, x: number, y: number, a: number, len: number, bend: number, leaf: number) {
  const n = 22;
  let px = x, py = y;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const pts: [number, number, number][] = [];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const aa = a + bend * u * u;
    px += Math.cos(aa) * (len / n);
    py += Math.sin(aa) * (len / n);
    ctx.lineTo(px, py);
    pts.push([px, py, aa]);
  }
  ctx.lineWidth = 2.6;
  ctx.stroke();
  pts.forEach(([qx, qy, aa], i) => {
    const u = i / n, l = leaf * (1 - u * 0.85) * (u < 0.1 ? u * 10 : 1);
    for (const s of [-1, 1]) {
      const b = aa + s * 1.05;
      ctx.beginPath();
      ctx.moveTo(qx, qy);
      ctx.quadraticCurveTo(qx + Math.cos(b - s * 0.3) * l * 0.6, qy + Math.sin(b - s * 0.3) * l * 0.6, qx + Math.cos(b + s * 0.25) * l, qy + Math.sin(b + s * 0.25) * l);
      ctx.lineWidth = 3.4 * (1 - u * 0.6);
      ctx.stroke();
    }
  });
}

function eraTextures(scene: Phaser.Scene) {
  // unten dunkel (dort steht die Schrift), oben ein Hauch
  // (keine Zweierpotenzen: Solche Texturen wiederholen sich, und die Glättung zieht am Rand eine feine Linie)
  tex(scene, 'era_shadeB', 6, 250, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 250, [[0, 'rgba(3,6,8,0)'], [0.35, 'rgba(3,6,8,0.45)'], [0.75, 'rgba(3,6,8,0.86)'], [1, 'rgba(3,6,8,0.96)']]);
    ctx.fillRect(0, 0, 6, 250);
  });
  tex(scene, 'era_corner', 330, 270, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 0, 270, 0, 330, [[0, 'rgba(3,6,8,0.8)'], [0.5, 'rgba(3,6,8,0.5)'], [1, 'rgba(3,6,8,0)']]);
    ctx.fillRect(0, 0, 330, 270);
  });
  tex(scene, 'era_shadeT', 6, 130, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 130, [[0, 'rgba(3,6,8,0.78)'], [1, 'rgba(3,6,8,0)']]);
    ctx.fillRect(0, 0, 6, 130);
  });
  // die Ränder eines Bildes: links und rechts etwas dunkler
  tex(scene, 'era_side', 66, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 66, 0);
    g.addColorStop(0, 'rgba(2,4,6,0.85)');
    g.addColorStop(0.18, 'rgba(2,4,6,0.2)');
    g.addColorStop(0.5, 'rgba(2,4,6,0)');
    g.addColorStop(0.82, 'rgba(2,4,6,0.2)');
    g.addColorStop(1, 'rgba(2,4,6,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 66, 6);
  });
  // Stein: eine feine, unruhige Maserung (wird über das Bild gelegt, multipliziert)
  tex(scene, 'era_stone', 256, 256, (ctx) => {
    ctx.fillStyle = '#d8ccb6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'stone', 0.6);
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pattern(ctx, 'grain', 0.8);
    ctx.fillRect(0, 0, 256, 256);
  });
  // feine Risse im Gestein – und dieselben Risse als Glut
  tex(scene, 'era_cracks', 512, 720, (ctx) => drawCracks(ctx, 'rgba(30,22,14,0.6)', 1));
  tex(scene, 'era_embers', 512, 720, (ctx) => {
    ctx.shadowColor = 'rgba(255,150,60,1)';
    ctx.shadowBlur = 10;
    drawCracks(ctx, 'rgba(255,196,120,0.9)', 1.3);
  });
  // eine feine Linie in Ocker, nach rechts auslaufend
  tex(scene, 'era_rule', 380, 4, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 380, 0);
    g.addColorStop(0, 'rgba(200,145,60,.95)');
    g.addColorStop(0.6, 'rgba(200,145,60,.45)');
    g.addColorStop(1, 'rgba(200,145,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 1, 380, 2);
  });
  // ein schmaler Lichtstreif, der schräg über den Stein wandert
  tex(scene, 'era_sweep', 256, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,246,226,0)');
    g.addColorStop(0.5, 'rgba(255,246,226,0.9)');
    g.addColorStop(1, 'rgba(255,246,226,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
  });
  // Dunst: Wolken, die sich nach links und rechts endlos fortsetzen, oben und unten weich auslaufen
  tex(scene, 'era_fog', 512, 160, (ctx) => {
    ctx.fillStyle = pattern(ctx, 'cloud', 2);
    ctx.fillRect(0, 0, 512, 160);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = vgrad(ctx, 0, 160, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, 512, 160);
  });
  // ein weiches Glühen (Sonne)
  tex(scene, 'era_glow', 250, 250, (ctx) => {
    ctx.fillStyle = rgrad(ctx, 125, 125, 0, 125, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 250, 250);
  });
  // eine Riesenlibelle, von oben gesehen – zwei Bilder: Flügel ausgebreitet und im Schlag (verkürzt, verwischt)
  for (const f of [0, 1]) {
    tex(scene, `era_fly${f}`, 90, 44, (ctx) => {
      const cy = 22;
      for (const [ax, l, sweep] of [[55, 20, 0.22], [49, 19, 0.5]] as const) {
        for (const s of [-1, 1]) {
          const a = s * (Math.PI / 2 - sweep), len = f ? l * 0.5 : l;
          ctx.save();
          ctx.translate(ax, cy);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.ellipse(len / 2, 0, len / 2, f ? 3.2 : 4.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = f ? 'rgba(226,238,230,0.32)' : 'rgba(226,238,230,0.56)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(20,26,22,0.9)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(1, 0);
          ctx.lineTo(len - 2, 0);
          ctx.lineWidth = 0.6;
          ctx.stroke();
          // das Flügelmal nahe der Spitze
          ctx.fillStyle = 'rgba(30,26,20,0.8)';
          ctx.fillRect(len * 0.78, -1.6, 2.6, 2.2);
          ctx.restore();
        }
      }
      // der lange Hinterleib, Brust und Kopf
      ctx.fillStyle = '#232a1c';
      ctx.beginPath();
      ctx.moveTo(50, cy - 2.2);
      ctx.quadraticCurveTo(26, cy - 1.6, 6, cy - 0.8);
      ctx.lineTo(6, cy + 0.8);
      ctx.quadraticCurveTo(26, cy + 1.6, 50, cy + 2.2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(54, cy, 5.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(61.5, cy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }, 2);
  }
  if (!scene.anims.exists('era_fly')) {
    scene.anims.create({ key: 'era_fly', frames: [{ key: 'era_fly0' }, { key: 'era_fly1' }], frameRate: 26, repeat: -1 });
  }
  // ein Farn im Vordergrund – nur als Schattenriss
  tex(scene, 'era_fern', 240, 320, (ctx) => {
    ctx.strokeStyle = 'rgba(10,14,8,0.96)';
    ctx.lineCap = 'round';
    frond(ctx, 120, 320, -1.95, 250, 0.9, 30);
    frond(ctx, 116, 320, -1.35, 280, -0.7, 34);
    frond(ctx, 124, 320, -2.5, 190, 1.2, 24);
    frond(ctx, 118, 320, -0.85, 200, -1.1, 26);
  });
  // das Zeichen für „noch im Gestein“: ein Ammonit im Fels
  tex(scene, 'era_fossil', 40, 40, (ctx) => {
    ctx.strokeStyle = '#d9a75a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const th = (i / 140) * Math.PI * 2 * 2.6;
      const rr = 1.4 + th * 2.1;
      const x = 20 + Math.cos(th - 1.2) * rr, y = 20 + Math.sin(th - 1.2) * rr;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const th = 3 + (i / 18) * Math.PI * 2 * 1.5;
      const r0 = 1.4 + (th - Math.PI * 2) * 2.1, r1 = 1.4 + th * 2.1;
      if (r0 < 2) continue;
      ctx.beginPath();
      ctx.moveTo(20 + Math.cos(th - 1.2) * r0, 20 + Math.sin(th - 1.2) * r0);
      ctx.lineTo(20 + Math.cos(th - 1.2) * r1, 20 + Math.sin(th - 1.2) * r1);
      ctx.stroke();
    }
  }, 2);
}

/** Die Tafel eines Zeitalters, dessen Bild noch fehlt: dunkler Stein in Schichten, darin ein Fossil, eingemeißelt. */
function slabTexture(scene: Phaser.Scene, id: string, relic?: string) {
  const key = `era_slab_${id}`;
  if (scene.textures.exists(key)) return key;
  const [c, ctx] = newCanvas(SLAB_W, SLAB_H);
  ctx.fillStyle = vgrad(ctx, 0, SLAB_H, [[0, '#26272a'], [0.5, '#1b1c1e'], [1, '#0e0f10']]);
  ctx.fillRect(0, 0, SLAB_W, SLAB_H);
  // Schichten, leicht gewellt: Hier hat sich über Jahrmillionen Schlamm auf Schlamm gelegt
  const r = mulberry32(id.length * 977 + id.charCodeAt(0));
  let y = 10;
  while (y < SLAB_H) {
    const h = 18 + r() * 60, a = r() * 6, f = 0.004 + r() * 0.006, ph = r() * 6;
    const wave = (x: number) => y + Math.sin(x * f + ph) * a + Math.sin(x * f * 3.1 + ph * 2) * a * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, wave(0));
    for (let x = 0; x <= SLAB_W; x += 10) ctx.lineTo(x, wave(x));
    ctx.lineTo(SLAB_W, wave(SLAB_W) + h);
    for (let x = SLAB_W; x >= 0; x -= 10) ctx.lineTo(x, wave(x) + h);
    ctx.closePath();
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.04 + r() * 0.07})` : `rgba(255,236,210,${0.01 + r() * 0.025})`;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= SLAB_W; x += 10) ctx.lineTo(x, wave(x));
    ctx.strokeStyle = 'rgba(255,235,205,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    y += h;
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = pattern(ctx, 'stone', 1.3);
  ctx.fillRect(0, 0, SLAB_W, SLAB_H);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = pattern(ctx, 'grain', 1);
  ctx.fillRect(0, 0, SLAB_W, SLAB_H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // das Fossil: eine Mulde im Stein – oben links liegt ihr Rand im Schatten, unten rechts fängt er Licht
  const def = relic ? SPECIES[relic] : undefined;
  if (def) {
    const src = scene.textures.get(makeSpeciesPortrait(scene, def, 520)).getSourceImage() as HTMLCanvasElement;
    const k = Math.min(500 / src.width, 300 / src.height);
    const w = src.width * k, h = src.height * k, x = (SLAB_W - w) / 2, top = SLAB_H * 0.33 - h / 2;
    const sil = (fill: string) => {
      const [s, sc] = newCanvas(w, h);
      sc.drawImage(src, 0, 0, w, h);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = fill;
      sc.fillRect(0, 0, w, h);
      return s;
    };
    ctx.drawImage(sil('rgba(226,206,172,0.26)'), x + 2.5, top + 2.5);
    ctx.drawImage(sil('rgba(0,0,0,0.85)'), x - 2, top - 2);
    ctx.drawImage(sil('#141415'), x, top);
    // innen bleibt die Zeichnung des Tieres erhalten – nur ohne Farbe, wie im Stein abgedrückt
    const [g, gc] = newCanvas(w, h);
    gc.drawImage(src, 0, 0, w, h);
    gc.globalCompositeOperation = 'saturation';
    gc.fillStyle = '#808080';
    gc.fillRect(0, 0, w, h);
    gc.globalCompositeOperation = 'destination-in';
    gc.drawImage(src, 0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(g, x, top);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = pattern(ctx, 'grain', 0.7);
    ctx.fillRect(x - 4, top - 4, w + 8, h + 8);
    ctx.globalCompositeOperation = 'source-over';
  }
  // ein Hauch Licht von oben links, dunkle Ränder
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgrad(ctx, SLAB_W * 0.3, SLAB_H * 0.12, 0, SLAB_W * 0.8, [[0, 'rgba(120,110,96,0.22)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, SLAB_W, SLAB_H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgrad(ctx, SLAB_W / 2, SLAB_H * 0.42, SLAB_W * 0.25, SLAB_W * 0.85, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]);
  ctx.fillRect(0, 0, SLAB_W, SLAB_H);
  scene.textures.addCanvas(key, c);
  return key;
}

const ease = (x: number) => x * x * (3 - 2 * x);

/** ein weicher, dunkler Schatten unter kleiner Schrift (über hellen Stellen eines Bildes) */
const SHADOW = { offsetX: 0, offsetY: 1, color: 'rgba(0,0,0,.85)', blur: 6, fill: true };

/** „vor 359 bis 299 Millionen Jahren“ */
const span = (ep: EpochDef) => `vor ${ep.period[0]} bis ${ep.period[1]} Millionen Jahren`;

export class EraScene extends Phaser.Scene {
  private panels: Panel[] = [];
  private sel = 0;
  private hoverK = -1;
  private hoverAt = 0;
  /** das Bild unter der Maus ist schon geöffnet worden (oder die Tastatur hat gewählt) – erst ein neues Bild zählt wieder */
  private hoverDone = true;
  private launching = false;
  private overlay?: Phaser.GameObjects.Container;
  private ui!: Phaser.Cameras.Scene2D.Camera;
  private t = 0;
  private clockAt = 0;
  private px = 0.5;
  private py = 0.5;
  /** Knopf, der mit der Tastatur gewählt ist (0 = der erste des geöffneten Bildes) */
  private btnFocus = 0;

  constructor() {
    super('Eras');
  }

  preload() {
    for (const { ep } of ERAS) {
      const key = `era_${ep.id}`, url = LOOK[ep.id]?.url;
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }

  init() {
    this.panels = [];
    this.launching = false;
    this.overlay = undefined;
    this.hoverK = -1;
    this.hoverDone = true;
    this.t = 0;
    this.btnFocus = 0;
  }

  create() {
    eraTextures(this);
    audio.music('title');
    const base = this.cameras.main;
    // je Zeitalter eine Kamera, darüber die für Schrift und Knöpfe (sie ist die Hauptkamera: Überblenden betrifft alles)
    const start = Math.max(0, ERAS.findIndex((e) => e.i === game.chosenEpoch));
    this.sel = start;
    ERAS.forEach(({ i, ep }, k) => {
      const cam = this.cameras.add(0, 0, 10, H, false, `era_${ep.id}`).setBackgroundColor('#04080a');
      const layer = this.add.layer();
      const look = LOOK[ep.id] ?? { kind: 'stone', focus: [0.5, 0.5], light: 0.4, tilt: 0.2, tint: 0xffd9a8 };
      const p: Panel = {
        k, i, ep, look, playable: !!ep.playable, cam, greyNow: 1, layer,
        ox: STAGE_X + k * STAGE_STEP, dw: 0, dh: 0, top: 0,
        x: 0, w: k === start ? WIDE : NARROW, t: k === start ? 1 : 0, ph: k * 1.7,
        shadeB: this.add.image(0, H, 'era_shadeB').setOrigin(0, 1).setDepth(1),
        shadeT: this.add.image(0, 0, 'era_shadeT').setOrigin(0, 0).setDepth(1),
        corner: this.add.image(0, H, 'era_corner').setOrigin(0, 1).setDepth(1),
        side: this.add.image(0, 0, 'era_side').setOrigin(0, 0).setDepth(1),
        dim: this.add.rectangle(0, 0, 10, H, 0x020406, 1).setOrigin(0, 0).setDepth(1),
        narrowC: this.add.container(0, 0).setDepth(5), wideC: this.add.container(0, 0).setDepth(5),
        school: [], schoolX: 0, schoolV: 0, veil: [], buttons: [],
      };
      this.stage(p);
      if (!p.playable && look.kind !== 'stone') {
        // ruhend: grau und dunkel wie Stein
        p.grey = cam.filters.internal.addColorMatrix();
        p.grey.colorMatrix.desaturate();
        p.grey.colorMatrix.brightness(0.66, true);
      }
      this.panels.push(p);
    });
    this.ui = this.cameras.add(0, 0, W, H, true, 'ui');
    this.cameras.remove(base);
    // die Kameras der Bilder sehen nur ihre eigene Bühne; die oberste nur Schrift und Knöpfe
    for (const p of this.panels) {
      this.ui.ignore(p.layer);
      for (const q of this.panels) if (q !== p) p.cam.ignore(q.layer);
    }
    fadeIn(this, 700);

    for (const p of this.panels) this.labels(p);
    this.header();
    this.layout(0);
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.pointer(ptr));
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.overlay || this.launching) return;
      const k = this.panelAt(ptr.x);
      if (k < 0) return;
      if (k !== this.sel) this.select(k);
      else if (!this.panels[k].playable && ptr.y > 120) this.stone(this.panels[k]);
    });
    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.step(-1));
    kb.on('keydown-RIGHT', () => this.step(1));
    kb.on('keydown-A', () => this.step(-1));
    kb.on('keydown-D', () => this.step(1));
    kb.on('keydown-UP', () => this.focusBtn(-1));
    kb.on('keydown-DOWN', () => this.focusBtn(1));
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.focusBtn(1);
    });
    const act = () => {
      if (this.overlay || this.launching) return;
      const p = this.panels[this.sel];
      if (!p.playable) return this.stone(p);
      p.buttons[Math.min(this.btnFocus, p.buttons.length - 1)]?.click();
    };
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-ESC', () => (this.overlay ? this.closeOverlay() : this.back()));
    this.showButtons();
  }

  // ---------------------------------------------------------------- die Bühne eines Zeitalters

  private stage(p: Panel) {
    const L = p.look;
    const key = L.url ? `era_${p.ep.id}` : slabTexture(this, p.ep.id, L.relic);
    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const s = Math.max(WIDE / src.width, H / src.height) * 1.1;
    p.dw = src.width * s;
    p.dh = src.height * s;
    p.top = (H - p.dh) / 2;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      p.layer.add(o);
      return o;
    };
    add(this.add.image(p.ox, p.top, key).setOrigin(0).setScale(s));
    if (L.kind === 'water') this.sea(p, add);
    else if (L.kind === 'swamp') this.swamp(p, add);
    else if (L.kind === 'land') this.land(p, add);
    else this.slab(p, add);
    if (L.fly) {
      p.fly = add(this.add.sprite(0, 0, 'era_fly0').setScale(L.fly[2] / 2).setAlpha(0.9));
      if (L.kind === 'land') p.fly.setTint(0xffe4c4);
      p.fly.play({ key: 'era_fly', startFrame: p.k % 2 });
    }
    if (!p.playable) {
      if (L.url) {
        // im Gestein: Maserung und Risse über dem Bild – angewählt treten sie zurück
        const grain = add(this.add.tileSprite(p.ox, p.top, p.dw, p.dh, 'era_stone').setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.55));
        const cracks = add(this.add.image(p.ox, p.top, 'era_cracks').setOrigin(0).setDisplaySize(p.dw, p.dh).setAlpha(0.45));
        p.veil.push({ o: grain, a: 0.55, on: 0.22 }, { o: cracks, a: 0.45, on: 0.28 });
      }
      // ein Lichtstreif, der beim Anwählen über den Stein streicht
      p.sweep = add(this.add.image(p.ox, H / 2, 'era_sweep').setDisplaySize(260, H * 2.4).setRotation(0.32).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    }
  }

  /** Lichtstrahlen von oben, die langsam atmen */
  private rays(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, x: number, y: number, len: number, gain = 1) {
    const L = p.look;
    for (const [dx, sx, a, rot, ph] of [[0, 2.4, 0.15, 0, 0], [-80, 1.3, 0.09, 0.08, 2], [90, 1.5, 0.08, -0.07, 4], [30, 3.6, 0.05, 0.02, 1]] as const) {
      const ray = add(this.add.image(x + dx, y, 'lightray').setOrigin(0.5, 0).setScale(sx, len / 560)
        .setRotation(L.tilt + rot).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a * gain).setTint(L.tint));
      this.tweens.add({ targets: ray, alpha: a * gain * 1.8, rotation: L.tilt + rot + 0.03, duration: 5000 + ph * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: ph * 300 });
    }
  }

  /** Dunstbänder, die in verschiedenen Höhen und Geschwindigkeiten ziehen und dabei atmen */
  private mist(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, tint: number, alpha: number) {
    (p.look.mist ?? []).forEach((m, j) => {
      const sy = 0.7 + (j % 3) * 0.35, h = 160 * sy;
      const fog = add(this.add.tileSprite(p.ox, p.top + p.dh * m - h / 2, p.dw, h, 'era_fog').setOrigin(0).setTileScale(1.5 + (j % 2) * 0.7, sy).setTint(tint));
      fog.tilePositionX = j * 170;
      const a = alpha * (j === 0 ? 1.15 : 1 - j * 0.12);
      fog.setAlpha(a).setData('v', (j % 2 ? -1 : 1) * (5 + j * 3));
      this.tweens.add({ targets: fog, alpha: a * 0.55, duration: 6000 + j * 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: j * 900 });
    });
  }

  private sea(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = p.look, live = p.playable;
    this.rays(p, add, p.ox + p.dw * L.light, p.top - 10, p.dh * 0.95);
    // oben flimmert die Oberfläche, unten spielt ein Lichtnetz auf dem Grund
    const surf = add(this.add.tileSprite(p.ox, p.top, p.dw, p.dh * 0.3, 'caustics').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(1.4, 0.8));
    surf.setAlpha(0.12, 0.12, 0, 0);
    const fy = p.top + p.dh * (L.floor ?? 0.7);
    const floor = add(this.add.tileSprite(p.ox, fy, p.dw, p.top + p.dh - fy, 'caustics2').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(1.3, 0.55));
    floor.setAlpha(0, 0, 0.16, 0.16);
    surf.setData('v', 5);
    floor.setData('v', -4);
    // Schwebeteilchen im ganzen Bild, Blasen vom Grund
    add(this.add.particles(0, 0, 'p_dot', {
      x: { min: p.ox, max: p.ox + p.dw }, y: { min: p.top, max: p.top + p.dh }, lifespan: 12000, frequency: live ? 70 : 160,
      speedY: { min: 2, max: 10 }, speedX: { min: -5, max: 5 }, scale: { min: 0.06, max: 0.22 },
      alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: L.tint, blendMode: Phaser.BlendModes.ADD,
    }));
    const bubbles = add(this.add.particles(0, 0, 'p_bubble', {
      x: { min: p.ox + p.dw * 0.15, max: p.ox + p.dw * 0.85 }, y: p.top + p.dh * 0.9, lifespan: 9000, frequency: -1,
      speedY: { min: -60, max: -30 }, speedX: { min: -6, max: 6 }, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.65, end: 0 },
    }));
    this.time.addEvent({ delay: 2600 + p.k * 700, loop: true, callback: () => bubbles.explode(2 + Math.floor(Math.random() * 3)) });
    // ein Schwarm in der Ferne
    const def = L.school ? SPECIES[L.school] : undefined;
    if (def) {
      makeSpeciesTextures(this, def);
      for (let j = 0; j < 9; j++) {
        const sp = add(this.add.sprite(0, 0, speciesKey(def.id, 0)).setScale(0.42 + Math.random() * 0.14).setTint(L.schoolTint ?? 0x24476a).setAlpha(0.55));
        sp.play({ key: `anim_${def.id}`, startFrame: j % 2 });
        p.school.push({ s: sp, ox: (Math.random() - 0.5) * 170, oy: (Math.random() - 0.5) * 60, ph: Math.random() * 6 });
      }
      p.schoolV = (p.k % 2 ? -1 : 1) * (18 + Math.random() * 8);
      p.schoolX = p.ox + p.dw * (0.25 + Math.random() * 0.5);
    }
  }

  /** Der Kohlesumpf: Nebel zieht zwischen den Stämmen, Sporen treiben im fahlen Licht, das Wasser glänzt. */
  private swamp(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = p.look;
    this.rays(p, add, p.ox + p.dw * L.light, p.top - 20, p.dh * 0.8, 0.7);
    // das stille Wasser: ein matter Glanz, der sich kaum rührt
    const wy = p.top + p.dh * 0.6;
    const shine = add(this.add.tileSprite(p.ox, wy, p.dw, p.top + p.dh - wy, 'caustics').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(2.4, 0.22));
    shine.setAlpha(0.02, 0.02, 0.1, 0.1).setTint(L.tint).setData('v', 3);
    this.mist(p, add, 0xe2ecdf, 0.3);
    add(this.add.particles(0, 0, 'p_dot', {
      x: { min: p.ox, max: p.ox + p.dw }, y: { min: p.top + p.dh * 0.05, max: p.top + p.dh * 0.85 }, lifespan: 14000, frequency: 110,
      speedY: { min: -7, max: 3 }, speedX: { min: 3, max: 12 }, scale: { min: 0.05, max: 0.17 },
      alpha: { start: 0, end: 0.6, ease: 'Sine.inOut' }, tint: 0xf2f6c8, blendMode: Phaser.BlendModes.ADD,
    }));
  }

  /** Das Perm: Die Sonne glüht im Dunst, goldener Staub steigt, vorn wiegt sich ein Farn. */
  private land(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = p.look, [sx, sy] = L.sun ?? [0.6, 0.2];
    const glow = add(this.add.image(p.ox + p.dw * sx, p.top + p.dh * sy, 'era_glow').setScale(3.2, 2.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffcf8a).setAlpha(0.3));
    this.tweens.add({ targets: glow, alpha: 0.45, scaleX: 3.5, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.rays(p, add, p.ox + p.dw * L.light, p.top + p.dh * sy - 40, p.dh * 1.1, 0.75);
    this.mist(p, add, 0xffe6c4, 0.24);
    add(this.add.particles(0, 0, 'p_dot', {
      x: { min: p.ox, max: p.ox + p.dw }, y: { min: p.top + p.dh * 0.2, max: p.top + p.dh }, lifespan: 13000, frequency: 85,
      speedY: { min: -9, max: -2 }, speedX: { min: -4, max: 7 }, scale: { min: 0.05, max: 0.2 },
      alpha: { start: 0, end: 0.75, ease: 'Sine.inOut' }, tint: 0xffd27a, blendMode: Phaser.BlendModes.ADD,
    }));
    const fern = add(this.add.image(p.ox + p.dw * 0.66, p.top + p.dh + 30, 'era_fern').setOrigin(0.5, 1).setScale(1.25).setAngle(-2));
    this.tweens.add({ targets: fern, angle: 1.5, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  /** Noch kein Bild: die Steintafel – Staub rieselt, in den Rissen glimmt es. */
  private slab(p: Panel, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    add(this.add.image(p.ox, p.top, 'era_cracks').setOrigin(0).setDisplaySize(p.dw, p.dh).setAlpha(0.7));
    p.glow = add(this.add.image(p.ox, p.top, 'era_embers').setOrigin(0).setDisplaySize(p.dw, p.dh).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.08));
    this.tweens.add({ targets: p.glow, alpha: 0.24, duration: 2600 + p.k * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    add(this.add.particles(0, 0, 'p_dot', {
      x: { min: p.ox, max: p.ox + p.dw }, y: { min: p.top, max: p.top + p.dh * 0.7 }, lifespan: 9000, frequency: 260,
      speedY: { min: 4, max: 14 }, speedX: { min: -2, max: 2 }, scale: { min: 0.04, max: 0.12 },
      alpha: { start: 0, end: 0.45, ease: 'Sine.inOut' }, tint: 0xcabca4,
    }));
  }

  // ---------------------------------------------------------------- Schrift und Knöpfe

  private labels(p: Panel) {
    const ep = p.ep, run = game.runIn(p.i);
    // ---- schmal, wie ein Buchrücken: oben der Zeitraum, der Name senkrecht, unten Nummer und Stand
    const nc = p.narrowC;
    const small = (y: number, s: string, size: number, color: string, sp = 2) =>
      nc.add(this.add.text(0, y, s, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color, fontStyle: '700', resolution: 2, shadow: SHADOW }).setOrigin(0.5).setLetterSpacing(sp));
    small(86, String(ep.period[0]), 14, UI.bone);
    nc.add(this.add.rectangle(0, 101, 16, 1, 0xc8913c, 0.8));
    small(116, String(ep.period[1]), 14, UI.bone);
    small(134, 'MIO. J.', 9, UI.ochre, 3);
    nc.add(this.add.text(0, H - 112, ep.name.toUpperCase(), {
      fontFamily: TITLE_FONT, fontSize: '25px', color: '#f0e6cf', fontStyle: '700', resolution: 2,
      shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,.8)', blur: 10, fill: true },
    }).setOrigin(0, 0.5).setAngle(-90).setLetterSpacing(7));
    small(H - 80, ROMAN[p.k], 15, UI.ochre, 3);
    if (p.playable) small(H - 52, run ? `GEN. ${run.life.gen}` : 'SPIELBAR', 10, '#e2b876', 3);
    else nc.add(this.add.image(0, H - 50, 'era_fossil').setScale(0.36).setAlpha(0.85));

    // ---- weit geöffnet: der ganze Block unten links
    const wc = p.wideC;
    const x = TEXT_X;
    wc.add(this.add.text(x, H - 376, `ZEITALTER ${ROMAN[p.k]}`, { fontFamily: TITLE_FONT, fontSize: '13px', color: '#d9a24c', fontStyle: '700', resolution: 2, shadow: SHADOW }).setLetterSpacing(7));
    const name = this.add.text(x - 3, H - 358, ep.name.toUpperCase(), {
      fontFamily: TITLE_FONT, fontSize: '54px', color: '#f3ead4', fontStyle: '400', resolution: 2,
      shadow: { offsetX: 0, offsetY: 4, color: 'rgba(0,0,0,.6)', blur: 16, fill: true },
    }).setLetterSpacing(7);
    wc.add(name);
    wc.add(text(this, x, H - 284, ep.tagline, 23, UI.bone, { fontStyle: 'italic' }).setAlpha(0.95));
    wc.add(this.add.image(x, H - 246, 'era_rule').setOrigin(0, 0.5).setDisplaySize(170, 3));
    wc.add(text(this, x, H - 233, ep.blurb, 16, UI.boneDim, { wordWrap: { width: WIDE - x - 44 }, lineSpacing: 3 }));
    if (p.playable) {
      // die Weltzeit (sie läuft für alle gleich) und die eigene Linie
      p.clock = text(this, x, H - 142, '', 15, UI.ochre, { fontStyle: '700' }).setLetterSpacing(1);
      wc.add(p.clock);
      const line = run ? `Deine Linie: ${speciesName({ cls: run.cls, traits: run.traits, epoch: p.i })} · Generation ${run.life.gen}` : 'Hier beginnt deine Linie – mit einem Urfisch.';
      wc.add(text(this, x, H - 120, line, 15, UI.bone, { fontStyle: 'italic' }).setAlpha(0.85));
      const main = new Button(this, x + 124, H - 64, run ? 'Weiterleben' : 'Leben beginnen', {
        w: 248, h: 52, size: 19, icon: 'ic_play', color: UI.ochreN, sound: null, onClick: () => this.launch(p, run ? 'continue' : 'new'),
      });
      p.buttons.push(main);
      wc.add(main);
      if (run) {
        const fresh = new Button(this, x + 248 + 22 + 96, H - 64, 'Neue Linie', { w: 192, h: 46, size: 17, sound: 'select', onClick: () => this.askNew(p) });
        p.buttons.push(fresh);
        wc.add(fresh);
      }
    } else {
      wc.add(text(this, x, H - 142, span(ep), 15, UI.ochre, { fontStyle: '700' }).setLetterSpacing(1));
      const em = this.add.image(x + 16, H - 68, 'era_fossil').setScale(0.5);
      wc.add(em);
      p.wideC.setData('emblem', em);
      wc.add(this.add.text(x + 46, H - 86, 'NOCH IM GESTEIN', { fontFamily: TITLE_FONT, fontSize: '17px', color: '#e2b876', fontStyle: '700', resolution: 2 }).setLetterSpacing(6));
      wc.add(text(this, x + 46, H - 60, p.look.url ? 'Diese Welt ruht noch im Fels – bald bricht sie auf.' : 'Ihr Bild liegt noch im Fels – bald bricht es auf.', 16, UI.boneDim, { fontStyle: 'italic' }));
    }
  }

  private header() {
    // oben: wohin es geht, links zurück, rechts der Ton
    const head = this.add.text(W / 2, 30, 'WÄHLE DEIN ZEITALTER', { fontFamily: TITLE_FONT, fontSize: '14px', color: UI.ochre, fontStyle: '700', resolution: 2, shadow: SHADOW })
      .setOrigin(0.5).setLetterSpacing(9).setDepth(10);
    const rule = this.add.image(W / 2 - 75, 52, 'era_rule').setDisplaySize(150, 3).setAlpha(0.8).setOrigin(0, 0.5).setDepth(10);
    const back = this.add.text(30, 30, '‹  TITELBILD', { fontFamily: TITLE_FONT, fontSize: '13px', color: UI.boneDim, fontStyle: '700', resolution: 2, shadow: SHADOW })
      .setOrigin(0, 0.5).setLetterSpacing(4).setDepth(10).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => {
      back.setColor(UI.bone);
      audio.sfx('hover');
    });
    back.on('pointerout', () => back.setColor(UI.boneDim));
    back.on('pointerdown', () => this.back());
    soundIcon(this, W - 40, 30, 24).setDepth(10);
    const hint = text(this, W / 2, H - 16, '← →  wählen   ·   Eingabe  aufbrechen   ·   Esc  zurück', 13, UI.boneDim).setOrigin(0.5).setAlpha(0.55).setDepth(10);
    for (const o of [head, rule, back, hint]) {
      const a = o.alpha;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: 900, delay: 400 });
    }
  }

  // ---------------------------------------------------------------- Wählen

  private panelAt(x: number) {
    return this.panels.findIndex((p) => x >= p.x && x < p.x + p.w + GAP);
  }

  private pointer(ptr: Phaser.Input.Pointer) {
    this.px = ptr.x / W;
    this.py = ptr.y / H;
    if (this.overlay || this.launching) return;
    const k = this.panelAt(ptr.x);
    if (k !== this.hoverK) {
      this.hoverK = k;
      this.hoverAt = this.time.now;
      this.hoverDone = false;
    }
  }

  private step(d: number) {
    if (this.overlay || this.launching) return;
    this.hoverDone = true;
    this.select(clamp(this.sel + d, 0, this.panels.length - 1));
  }

  private select(k: number) {
    if (k === this.sel || this.launching) return;
    this.sel = k;
    this.btnFocus = 0;
    audio.sfx('era');
    this.showButtons();
    const p = this.panels[k];
    if (p.sweep) {
      // Licht streicht über den Stein
      this.tweens.killTweensOf(p.sweep);
      p.sweep.setX(p.ox - 200).setAlpha(p.look.url ? 0.2 : 0.12);
      this.tweens.add({ targets: p.sweep, x: p.ox + p.dw + 200, duration: 1800, delay: 250, ease: 'Sine.inOut' });
    }
  }

  /** Nur die Knöpfe des geöffneten Bildes nehmen Klicks an; der mit der Tastatur gewählte leuchtet. */
  private showButtons() {
    for (const p of this.panels) {
      const on = p.k === this.sel;
      p.buttons.forEach((b, j) => {
        b.setDisabled(!on).setFocus(on && j === this.btnFocus);
        if (b.input) b.input.enabled = on;
      });
    }
  }

  private focusBtn(d: number) {
    const p = this.panels[this.sel];
    if (this.overlay || this.launching || p.buttons.length < 2) return;
    this.btnFocus = (this.btnFocus + d + p.buttons.length) % p.buttons.length;
    audio.sfx('click');
    this.showButtons();
  }

  /** Ein ruhendes Zeitalter: Stein reibt über Stein – es rührt sich (noch) nichts, nur die Glut in den Rissen flackert auf. */
  private stone(p: Panel) {
    audio.sfx('stone');
    this.cameras.main.shake(160, 0.002);
    const em = p.wideC.getData('emblem') as Phaser.GameObjects.Image | undefined;
    if (em) this.tweens.add({ targets: em, angle: { from: -14, to: 0 }, duration: 420, ease: 'Back.out' });
    if (p.glow) {
      const g = p.glow;
      const a = g.alpha;
      this.tweens.add({ targets: g, alpha: { from: 0.75, to: a }, duration: 900, ease: 'Cubic.out' });
    }
  }

  private back() {
    if (this.launching) return;
    audio.sfx('back');
    fadeTo(this, 'Title', {}, 500);
  }

  /** Aufbrechen: Das gewählte Bild öffnet sich ganz, man taucht hinein – dann beginnt (oder geht weiter) das Leben. */
  private launch(p: Panel, how: 'continue' | 'new') {
    if (this.launching || this.overlay || !p.playable || p.k !== this.sel) return;
    this.launching = true;
    audio.sfx('epoch');
    for (const q of this.panels) {
      this.tweens.add({ targets: [q.wideC, q.narrowC], alpha: 0, duration: 500 });
    }
    this.time.delayedCall(1150, () => (how === 'new' ? startNewLife(this, p.i) : continueLife(this, p.i)));
  }

  /** Eine neue Linie beginnen – die jetzige endet dann. Erst nachfragen. */
  private askNew(p: Panel) {
    if (this.overlay || this.launching) return;
    const c = this.add.container(0, 0).setDepth(100);
    const shade = this.add.rectangle(0, 0, W, H, 0x010304, 0.74).setOrigin(0).setInteractive();
    shade.on('pointerdown', () => this.closeOverlay());
    const w = 620, h = 270, x = (W - w) / 2, y = (H - h) / 2;
    const g = this.add.graphics();
    g.fillStyle(0x05090a, 0.96);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0xc8913c, 0.4);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
    c.add([shade, g]);
    c.add(this.add.text(W / 2, y + 44, 'NEUE LINIE', { fontFamily: TITLE_FONT, fontSize: '17px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(10));
    c.add(text(this, W / 2, y + 112, `${inEra(p.ep).replace(/^./, (c) => c.toUpperCase())} schlüpft ein neuer Urfisch –\ndeine jetzige Linie endet dann.`, 21, UI.bone, { align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    const no = new Button(this, W / 2 - 130, y + 210, 'Abbrechen', { w: 220, h: 48, size: 18, sound: 'back', onClick: () => this.closeOverlay() });
    const yes = new Button(this, W / 2 + 130, y + 210, 'Neu beginnen', { w: 220, h: 48, size: 18, color: UI.bloodN, sound: null, onClick: () => {
      this.closeOverlay();
      this.launch(p, 'new');
    } });
    c.add([no, yes]);
    no.setFocus(true);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.overlay = c;
    audio.sfx('open');
    for (const b of this.panels[this.sel].buttons) if (b.input) b.input.enabled = false;
    const kb = this.input.keyboard!;
    const pick = (e: KeyboardEvent) => {
      if (!this.overlay) return kb.off('keydown', pick);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const yesOn = !yes.focused;
        yes.setFocus(yesOn);
        no.setFocus(!yesOn);
        audio.sfx('click');
      } else if (e.key === 'Enter' || e.key === ' ') {
        kb.off('keydown', pick);
        (yes.focused ? yes : no).click();
      }
    };
    // erst im nächsten Bild hören – sonst löst die Eingabe, die den Knopf gedrückt hat, gleich noch einmal aus
    this.time.delayedCall(0, () => kb.on('keydown', pick));
  }

  private closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy();
    this.overlay = undefined;
    this.showButtons();
  }

  // ---------------------------------------------------------------- jedes Bild

  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.t += dt;
    // wer mit der Maus kurz über einem Bild verweilt, öffnet es
    if (!this.overlay && !this.launching && !this.hoverDone && this.hoverK >= 0 && this.time.now - this.hoverAt > 110) {
      this.hoverDone = true;
      this.select(this.hoverK);
    }
    this.layout(dt);
    this.clockAt -= dt;
    if (this.clockAt <= 0) {
      this.clockAt = 0.2;
      for (const p of this.panels) if (p.clock) p.clock.setText(yearsAgo(worldYears(p.ep.from, p.ep.to), 1));
    }
  }

  /** Breiten, Kameras, Schrift: alles folgt weich der Wahl (beim Aufbrechen öffnet sich das gewählte Bild ganz). */
  private layout(dt: number) {
    const k0 = this.sel, ps = this.panels;
    const gap = this.launching ? 0 : GAP;
    const f = dt <= 0 ? 1 : 1 - Math.exp(-dt * (this.launching ? 3.2 : 7));
    let x = 0;
    for (const p of ps) {
      const target = this.launching ? (p.k === k0 ? W : 0) : p.k === k0 ? WIDE : NARROW;
      p.w += (target - p.w) * f;
      p.x = x;
      x += p.w + gap;
      p.t = clamp((p.w - NARROW) / (WIDE - NARROW), 0, 1);
      const L = p.look;
      // Kamera: ihr Streifen auf dem Bildschirm, darin der Blickpunkt; ganz langsam näher und wieder zurück
      const vw = Math.max(1, Math.round(p.w));
      p.cam.setViewport(Math.round(p.x), 0, vw, H).setVisible(p.w > 1);
      const breath = 1.03 + 0.025 * Math.sin(this.t * 0.16 + p.ph);
      const z = breath * (this.launching && p.k === k0 ? 1 + 0.1 * clamp((p.w - WIDE) / (W - WIDE), 0, 1) : 1);
      p.cam.setZoom(z);
      const hv = vw / (2 * z), vv = H / (2 * z);
      const sel = p.k === k0 ? 1 : 0;
      const fx = L.focus[0] + (L.focus[1] - L.focus[0]) * ease(p.t);
      // ein wenig Tiefe: Das geöffnete Bild folgt der Maus ein Stück
      const cx = clamp(p.ox + p.dw * fx + sel * (this.px - 0.5) * 30 + Math.sin(this.t * 0.11 + p.ph) * 14, p.ox + hv, p.ox + p.dw - hv);
      const cy = clamp(H / 2 + sel * (this.py - 0.5) * 18 + Math.sin(this.t * 0.09 + p.ph * 2) * 8, p.top + vv, p.top + p.dh - vv);
      p.cam.centerOn(cx, cy);
      // ruhende Zeitalter: angewählt kehrt Farbe zurück, Maserung und Risse treten zurück
      if (p.grey) {
        p.greyNow += ((sel ? 0.4 : 1) - p.greyNow) * f;
        p.grey.colorMatrix.alpha = p.greyNow;
      }
      const open = ease(p.t);
      for (const v of p.veil) v.o.setAlpha(v.a + (v.on - v.a) * open);
      // der Schwarm zieht weiter (und kommt von der anderen Seite wieder)
      if (p.school.length) {
        p.schoolX += p.schoolV * dt;
        if (p.schoolX > p.ox + p.dw + 160) p.schoolX = p.ox - 160;
        if (p.schoolX < p.ox - 160) p.schoolX = p.ox + p.dw + 160;
        const sy = p.top + p.dh * (L.schoolY ?? 0.3);
        for (const m of p.school) {
          m.s.setFlipX(p.schoolV < 0);
          m.s.setPosition(p.schoolX + m.ox + Math.sin(this.t * 0.9 + m.ph) * 7, sy + m.oy + Math.sin(this.t * 1.3 + m.ph * 2) * 5);
        }
      }
      // die Libelle: weite, träge Schleifen, dazwischen ein kurzes Stehen in der Luft
      if (p.fly && L.fly) {
        const tt = this.t + p.ph, r = L.fly[2];
        const fx2 = Math.sin(tt * 0.21) * p.dw * 0.2 + Math.sin(tt * 0.63) * 40 * r;
        const fy2 = Math.sin(tt * 0.33) * 46 * r + Math.sin(tt * 2.1) * 4;
        const vx = Math.cos(tt * 0.21) * 0.21 * p.dw * 0.2 + Math.cos(tt * 0.63) * 0.63 * 40 * r;
        p.fly.setPosition(p.ox + p.dw * L.fly[0] + fx2, p.top + p.dh * L.fly[1] + fy2).setFlipX(vx < 0).setRotation(Math.sin(tt * 0.33 + 1) * 0.08);
      }
      for (const o of p.layer.list) {
        const v = (o as Phaser.GameObjects.TileSprite).getData?.('v') as number | undefined;
        if (v) (o as Phaser.GameObjects.TileSprite).tilePositionX += v * dt;
      }
      // Schrift und Schatten folgen dem Streifen
      p.shadeB.setPosition(p.x, H).setDisplaySize(p.w, 420);
      p.shadeT.setPosition(p.x, 0).setDisplaySize(p.w, 170);
      p.corner.setPosition(p.x, H).setDisplaySize(Math.max(1, Math.min(p.w, 700)), 560).setAlpha(ease(p.t) * (p.look.kind === 'stone' ? 0.5 : 0.85));
      p.side.setPosition(p.x, 0).setDisplaySize(p.w, H).setAlpha(0.35 + 0.45 * (1 - p.t));
      p.dim.setPosition(p.x, 0).setSize(Math.max(1, p.w), H).setAlpha(0.3 * (1 - p.t));
      p.narrowC.setPosition(p.x + p.w / 2, 0).setAlpha(this.launching ? p.narrowC.alpha : 1 - ease(clamp(p.t * 1.6, 0, 1)));
      p.wideC.setPosition(p.x, 0).setAlpha(this.launching ? p.wideC.alpha : ease(clamp((p.t - 0.55) / 0.45, 0, 1)));
      for (const o of [p.shadeB, p.shadeT, p.corner, p.side, p.dim]) o.setVisible(p.w > 1);
    }
  }
}
