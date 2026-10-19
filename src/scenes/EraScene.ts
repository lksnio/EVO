import Phaser from 'phaser';
import { W, H, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { ERAS, inEra, yearsAgo, type EpochDef } from '../data/epochs';
import { SPECIES } from '../data/species';
import { game, speciesName } from '../state/GameState';
import { worldYears } from '../sim/life';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { pattern } from '../art/paint';
import { tex, vgrad } from '../util/canvas';
import { clamp, mulberry32 } from '../util/math';
import { Button, fadeIn, fadeTo, soundIcon, text } from '../ui/ui';
import { continueLife, startNewLife } from './flow';
import ordovizUrl from '../assets/eras/ordovizium.webp';
import devonUrl from '../assets/eras/devon.webp';
import kreideUrl from '../assets/eras/kreide.webp';

// ---------------------------------------------------------------------------
// Die Wahl des Zeitalters: drei Bilder nebeneinander, so hoch wie der Bildschirm – das gewählte öffnet sich weit, die
// anderen bleiben schmale Streifen. In jedem Bild lebt das Wasser (Licht von oben, ein Lichtnetz am Grund, Schwebeteilchen,
// Blasen, ein ferner Schwarm), und ganz langsam kommt man näher. Zeitalter, in denen man noch nicht leben kann, ruhen „im
// Gestein“: grau, mit feinen Rissen – wer sie anwählt, sieht Licht über den Stein streichen.
// Jedes Bild hat seine eigene Kamera (so bleibt alles in seinem Streifen); darüber liegt die Kamera mit Schrift und Knöpfen.
// ---------------------------------------------------------------------------

/** Wie ein Zeitalter in der Auswahl aussieht: sein Bild und was darin lebt. */
interface Look {
  url: string;
  /** Blickpunkt (Anteil der Bildbreite) – als schmaler Streifen bzw. weit geöffnet */
  focus: [number, number];
  /** wo das Licht einfällt (Anteil der Bildbreite) und wie schräg */
  light: number;
  tilt: number;
  /** Farbe des Lichts im Wasser */
  water: number;
  /** ab hier ist Grund (Anteil der Bildhöhe) – dort spielt das Lichtnetz */
  floor: number;
  /** ein Schwarm, der in der Ferne vorüberzieht (Art, Höhe als Anteil der Bildhöhe, Farbe) */
  school: string;
  schoolY: number;
  schoolTint: number;
}

const LOOK: Record<string, Look> = {
  ordovizium: { url: ordovizUrl, focus: [0.58, 0.5], light: 0.6, tilt: -0.1, water: 0xbfeee0, floor: 0.68, school: 'arandaspis', schoolY: 0.2, schoolTint: 0x33585a },
  devon: { url: devonUrl, focus: [0.7, 0.56], light: 0.22, tilt: 0.2, water: 0xcfe6ff, floor: 0.74, school: 'moythomasia', schoolY: 0.12, schoolTint: 0x24476a },
  kreide: { url: kreideUrl, focus: [0.62, 0.52], light: 0.48, tilt: 0.05, water: 0xd2f0ff, floor: 0.7, school: 'apsopelix', schoolY: 0.45, schoolTint: 0x2a6488 },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const GAP = 3;
/** Breite des geöffneten Bildes; die anderen teilen sich den Rest */
const WIDE = 760;
const NARROW = (W - WIDE - GAP * (ERAS.length - 1)) / (ERAS.length - 1);
/** Hier liegen die Bühnen der Zeitalter in der Welt – weit weg von Schrift und Knöpfen */
const STAGE_X = 20000, STAGE_STEP = 6000;
/** so weit unten beginnt der Schriftblock eines geöffneten Bildes */
const TEXT_X = 56;

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
  /** ruhende Zeitalter: grau wie Stein (wie grau: 1 ganz, weniger lässt etwas Farbe durch) */
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
  side: Phaser.GameObjects.Image;
  /** nicht gewählt: etwas dunkler */
  dim: Phaser.GameObjects.Rectangle;
  clock?: Phaser.GameObjects.Text;
  school: Swimmer[];
  schoolX: number;
  schoolV: number;
  sweep?: Phaser.GameObjects.Image;
  buttons: Button[];
}

// ---------------------------------------------------------------- Texturen

function eraTextures(scene: Phaser.Scene) {
  // unten dunkel (dort steht die Schrift), oben ein Hauch
  // (keine Zweierpotenzen: Solche Texturen wiederholen sich, und die Glättung zieht am Rand eine feine Linie)
  tex(scene, 'era_shadeB', 6, 250, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 250, [[0, 'rgba(3,6,8,0)'], [0.35, 'rgba(3,6,8,0.45)'], [0.75, 'rgba(3,6,8,0.86)'], [1, 'rgba(3,6,8,0.96)']]);
    ctx.fillRect(0, 0, 6, 250);
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
  // feine Risse im Gestein
  tex(scene, 'era_cracks', 512, 720, (ctx) => {
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
      ctx.lineWidth = w;
      ctx.stroke();
    };
    ctx.lineJoin = 'round';
    for (const [x, y, a, len] of [[40, -10, 1.2, 60], [300, 0, 1.75, 70], [512, 260, 2.8, 40], [0, 420, -0.25, 50], [180, 730, -1.4, 30]] as const) {
      ctx.strokeStyle = 'rgba(30,22,14,0.6)';
      crack(x, y, a, len, 1.1, 0);
    }
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

const ease = (x: number) => x * x * (3 - 2 * x);

/** ein weicher, dunkler Schatten unter kleiner Schrift (über hellen Stellen eines Bildes) */
const SHADOW = { offsetX: 0, offsetY: 1, color: 'rgba(0,0,0,.85)', blur: 6, fill: true };

/** „vor 382 bis 372 Millionen Jahren“ */
const span = (ep: EpochDef) => `vor ${Math.round(ep.from / 1e6)} bis ${Math.round(ep.to / 1e6)} Millionen Jahren`;

export class EraScene extends Phaser.Scene {
  private panels: Panel[] = [];
  private sel = 0;
  private hoverK = -1;
  private hoverAt = 0;
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
      const key = `era_${ep.id}`;
      if (!this.textures.exists(key)) this.load.image(key, LOOK[ep.id].url);
    }
  }

  init() {
    this.panels = [];
    this.launching = false;
    this.overlay = undefined;
    this.hoverK = -1;
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
      const p: Panel = {
        k, i, ep, look: LOOK[ep.id], playable: !!ep.playable, cam, greyNow: 1, layer,
        ox: STAGE_X + k * STAGE_STEP, dw: 0, dh: 0, top: 0,
        x: 0, w: k === start ? WIDE : NARROW, t: k === start ? 1 : 0, ph: k * 1.7,
        shadeB: this.add.image(0, H, 'era_shadeB').setOrigin(0, 1).setDepth(1),
        shadeT: this.add.image(0, 0, 'era_shadeT').setOrigin(0, 0).setDepth(1),
        side: this.add.image(0, 0, 'era_side').setOrigin(0, 0).setDepth(1),
        dim: this.add.rectangle(0, 0, 10, H, 0x020406, 1).setOrigin(0, 0).setDepth(1),
        narrowC: this.add.container(0, 0).setDepth(5), wideC: this.add.container(0, 0).setDepth(5),
        school: [], schoolX: 0, schoolV: 0, buttons: [],
      };
      this.stage(p);
      if (!p.playable) {
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
    const L = p.look, key = `era_${p.ep.id}`;
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
    const live = p.playable;
    // Licht von oben: Strahlen, die langsam atmen
    const lx = p.ox + p.dw * L.light;
    for (const [dx, sx, a, rot, ph] of [[0, 2.4, 0.15, 0, 0], [-80, 1.3, 0.09, 0.08, 2], [90, 1.5, 0.08, -0.07, 4], [30, 3.6, 0.05, 0.02, 1]] as const) {
      const ray = add(this.add.image(lx + dx, p.top - 10, 'lightray').setOrigin(0.5, 0).setScale(sx, (p.dh * 0.95) / 560)
        .setRotation(L.tilt + rot).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTint(L.water));
      this.tweens.add({ targets: ray, alpha: a * 1.8, rotation: L.tilt + rot + 0.03, duration: 5000 + ph * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: ph * 300 });
    }
    // oben flimmert die Oberfläche, unten spielt ein Lichtnetz auf dem Grund
    const surf = add(this.add.tileSprite(p.ox, p.top, p.dw, p.dh * 0.3, 'caustics').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(1.4, 0.8));
    surf.setAlpha(0.12, 0.12, 0, 0);
    const fy = p.top + p.dh * L.floor;
    const floor = add(this.add.tileSprite(p.ox, fy, p.dw, p.top + p.dh - fy, 'caustics2').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setTileScale(1.3, 0.55));
    floor.setAlpha(0, 0, 0.16, 0.16);
    surf.setData('v', 5);
    floor.setData('v', -4);
    // Schwebeteilchen im ganzen Bild, Blasen vom Grund
    add(this.add.particles(0, 0, 'p_dot', {
      x: { min: p.ox, max: p.ox + p.dw }, y: { min: p.top, max: p.top + p.dh }, lifespan: 12000, frequency: live ? 70 : 160,
      speedY: { min: 2, max: 10 }, speedX: { min: -5, max: 5 }, scale: { min: 0.06, max: 0.22 },
      alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: L.water, blendMode: Phaser.BlendModes.ADD,
    }));
    const bubbles = add(this.add.particles(0, 0, 'p_bubble', {
      x: { min: p.ox + p.dw * 0.15, max: p.ox + p.dw * 0.85 }, y: p.top + p.dh * 0.9, lifespan: 9000, frequency: -1,
      speedY: { min: -60, max: -30 }, speedX: { min: -6, max: 6 }, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.65, end: 0 },
    }));
    this.time.addEvent({ delay: 2600 + p.k * 700, loop: true, callback: () => bubbles.explode(2 + Math.floor(Math.random() * 3)) });
    // ein Schwarm in der Ferne
    const def = SPECIES[L.school];
    if (def) {
      makeSpeciesTextures(this, def);
      const n = 9;
      for (let j = 0; j < n; j++) {
        const sp = add(this.add.sprite(0, 0, speciesKey(def.id, 0)).setScale(0.42 + Math.random() * 0.14).setTint(L.schoolTint).setAlpha(0.55));
        sp.play({ key: `anim_${def.id}`, startFrame: j % 2 });
        p.school.push({ s: sp, ox: (Math.random() - 0.5) * 170, oy: (Math.random() - 0.5) * 60, ph: Math.random() * 6 });
      }
      p.schoolV = (p.k % 2 ? -1 : 1) * (18 + Math.random() * 8);
      p.schoolX = p.ox + p.dw * (0.25 + Math.random() * 0.5);
    }
    if (!live) {
      // im Gestein: Maserung und Risse über dem Bild, und ein Lichtstreif, der beim Anwählen darüber streicht
      add(this.add.tileSprite(p.ox, p.top, p.dw, p.dh, 'era_stone').setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0.55));
      add(this.add.image(p.ox, p.top, 'era_cracks').setOrigin(0).setDisplaySize(p.dw, p.dh).setAlpha(0.45));
      p.sweep = add(this.add.image(p.ox, H / 2, 'era_sweep').setDisplaySize(260, H * 2.4).setRotation(0.32).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    }
  }

  // ---------------------------------------------------------------- Schrift und Knöpfe

  private labels(p: Panel) {
    const ep = p.ep, run = game.runIn(p.i);
    // ---- schmal: Nummer, Name, darunter leise der Stand
    const nc = p.narrowC;
    nc.add(this.add.text(0, H - 152, ROMAN[p.k], { fontFamily: TITLE_FONT, fontSize: '15px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(4));
    nc.add(this.add.text(0, H - 120, ep.name.toUpperCase(), { fontFamily: TITLE_FONT, fontSize: '21px', color: UI.bone, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(5));
    if (p.playable) {
      nc.add(text(this, 0, H - 88, run ? `Generation ${run.life.gen}` : ep.tagline, 15, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));
    } else {
      nc.add(this.add.image(0, H - 70, 'era_fossil').setScale(0.36).setAlpha(0.85));
      nc.add(this.add.text(0, H - 96, 'NOCH IM GESTEIN', { fontFamily: TITLE_FONT, fontSize: '11px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(4));
    }

    // ---- weit geöffnet: der ganze Block unten links
    const wc = p.wideC;
    const x = TEXT_X;
    wc.add(this.add.text(x, H - 376, `ZEITALTER ${ROMAN[p.k]}`, { fontFamily: TITLE_FONT, fontSize: '13px', color: '#d9a24c', fontStyle: '700', resolution: 2, shadow: SHADOW }).setLetterSpacing(7));
    const name = this.add.text(x - 3, H - 358, ep.name.toUpperCase(), {
      fontFamily: TITLE_FONT, fontSize: '58px', color: '#f3ead4', fontStyle: '400', resolution: 2,
      shadow: { offsetX: 0, offsetY: 4, color: 'rgba(0,0,0,.6)', blur: 16, fill: true },
    }).setLetterSpacing(8);
    wc.add(name);
    wc.add(text(this, x, H - 280, ep.tagline, 24, UI.bone, { fontStyle: 'italic' }).setAlpha(0.95));
    wc.add(this.add.image(x, H - 240, 'era_rule').setOrigin(0, 0.5).setDisplaySize(170, 3));
    wc.add(text(this, x, H - 226, ep.blurb, 17, UI.boneDim, { wordWrap: { width: WIDE - x - 70 }, lineSpacing: 3 }));
    if (p.playable) {
      // die Weltzeit (sie läuft für alle gleich) und die eigene Linie
      p.clock = text(this, x, H - 142, '', 15, UI.ochre, { fontStyle: '700' }).setLetterSpacing(1);
      wc.add(p.clock);
      const line = run ? `Deine Linie: ${speciesName({ cls: run.cls, traits: run.traits, epoch: p.i })} · Generation ${run.life.gen}` : 'Hier beginnt deine Linie – mit einem Urfisch.';
      wc.add(text(this, x, H - 120, line, 15, UI.bone, { fontStyle: 'italic' }).setAlpha(0.85));
      const main = new Button(this, x + 128, H - 64, run ? 'Weiterleben' : 'Leben beginnen', {
        w: 256, h: 52, size: 19, icon: 'ic_play', color: UI.ochreN, sound: null, onClick: () => this.launch(p, run ? 'continue' : 'new'),
      });
      p.buttons.push(main);
      wc.add(main);
      if (run) {
        const fresh = new Button(this, x + 256 + 26 + 100, H - 64, 'Neue Linie', { w: 200, h: 46, size: 17, sound: 'select', onClick: () => this.askNew(p) });
        p.buttons.push(fresh);
        wc.add(fresh);
      }
    } else {
      wc.add(text(this, x, H - 142, span(ep), 15, UI.ochre, { fontStyle: '700' }).setLetterSpacing(1));
      const em = this.add.image(x + 16, H - 68, 'era_fossil').setScale(0.5);
      wc.add(em);
      p.wideC.setData('emblem', em);
      wc.add(this.add.text(x + 46, H - 86, 'NOCH IM GESTEIN', { fontFamily: TITLE_FONT, fontSize: '17px', color: '#e2b876', fontStyle: '700', resolution: 2 }).setLetterSpacing(6));
      wc.add(text(this, x + 46, H - 60, 'Diese Welt ruht noch im Fels – bald bricht sie auf.', 16, UI.boneDim, { fontStyle: 'italic' }));
    }
  }

  private header() {
    // oben: wohin es geht, links zurück, rechts der Ton
    const head = this.add.text(W / 2, 30, 'WÄHLE DEIN ZEITALTER', { fontFamily: TITLE_FONT, fontSize: '14px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(9).setDepth(10);
    this.add.image(W / 2 - 75, 52, 'era_rule').setDisplaySize(150, 3).setAlpha(0.8).setOrigin(0, 0.5).setDepth(10);
    const back = this.add.text(30, 30, '‹  TITELBILD', { fontFamily: TITLE_FONT, fontSize: '13px', color: UI.boneDim, fontStyle: '700', resolution: 2 })
      .setOrigin(0, 0.5).setLetterSpacing(4).setDepth(10).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => {
      back.setColor(UI.bone);
      audio.sfx('hover');
    });
    back.on('pointerout', () => back.setColor(UI.boneDim));
    back.on('pointerdown', () => this.back());
    soundIcon(this, W - 40, 30, 24).setDepth(10);
    const hint = text(this, W / 2, H - 16, '← →  wählen   ·   Eingabe  aufbrechen   ·   Esc  zurück', 13, UI.boneDim).setOrigin(0.5).setAlpha(0.55).setDepth(10);
    for (const o of [head, back, hint]) {
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
    }
  }

  private step(d: number) {
    if (this.overlay || this.launching) return;
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
      p.sweep.setX(p.ox - 200).setAlpha(0.2);
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

  /** Ein ruhendes Zeitalter: Stein reibt über Stein – es rührt sich (noch) nichts. */
  private stone(p: Panel) {
    audio.sfx('stone');
    this.cameras.main.shake(160, 0.002);
    const em = p.wideC.getData('emblem') as Phaser.GameObjects.Image | undefined;
    if (em) this.tweens.add({ targets: em, angle: { from: -14, to: 0 }, duration: 420, ease: 'Back.out' });
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
    if (!this.overlay && !this.launching && this.hoverK >= 0 && this.hoverK !== this.sel && this.time.now - this.hoverAt > 110) this.select(this.hoverK);
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
      // ruhende Zeitalter: angewählt schimmert ein wenig Farbe durch
      if (p.grey) {
        p.greyNow += ((sel ? 0.8 : 1) - p.greyNow) * f;
        p.grey.colorMatrix.alpha = p.greyNow;
      }
      // der Schwarm zieht weiter (und kommt von der anderen Seite wieder)
      p.schoolX += p.schoolV * dt;
      if (p.schoolX > p.ox + p.dw + 160) p.schoolX = p.ox - 160;
      if (p.schoolX < p.ox - 160) p.schoolX = p.ox + p.dw + 160;
      const sy = p.top + p.dh * L.schoolY;
      for (const m of p.school) {
        m.s.setFlipX(p.schoolV < 0);
        m.s.setPosition(p.schoolX + m.ox + Math.sin(this.t * 0.9 + m.ph) * 7, sy + m.oy + Math.sin(this.t * 1.3 + m.ph * 2) * 5);
      }
      for (const o of p.layer.list) {
        const v = (o as Phaser.GameObjects.TileSprite).getData?.('v') as number | undefined;
        if (v) (o as Phaser.GameObjects.TileSprite).tilePositionX += v * dt;
      }
      // Schrift und Schatten folgen dem Streifen
      p.shadeB.setPosition(p.x, H).setDisplaySize(p.w, 420);
      p.shadeT.setPosition(p.x, 0).setDisplaySize(p.w, 150);
      p.side.setPosition(p.x, 0).setDisplaySize(p.w, H).setAlpha(0.35 + 0.45 * (1 - p.t));
      p.dim.setPosition(p.x, 0).setSize(Math.max(1, p.w), H).setAlpha(0.3 * (1 - p.t));
      p.narrowC.setPosition(p.x + p.w / 2, 0).setAlpha(this.launching ? p.narrowC.alpha : 1 - ease(clamp(p.t * 1.6, 0, 1)));
      p.wideC.setPosition(p.x, 0).setAlpha(this.launching ? p.wideC.alpha : ease(clamp((p.t - 0.55) / 0.45, 0, 1)));
      for (const o of [p.shadeB, p.shadeT, p.side, p.dim]) o.setVisible(p.w > 1);
    }
  }
}
