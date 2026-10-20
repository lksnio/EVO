import Phaser from 'phaser';
import { W, H, DEBUG, FONT, TITLE_FONT, UI } from '../config';
import { audio, type Sfx } from '../audio/Audio';
import { game } from '../state/GameState';
import { SPECIES } from '../data/species';
import { EPOCHS, yearsAgo } from '../data/epochs';
import { STAGE_NAME, stageOf, worldYears } from '../sim/life';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { tex, vgrad } from '../util/canvas';
import { clamp } from '../util/math';
import { MenuNav, fadeIn, fadeTo, soundIcon, text, type NavItem } from '../ui/ui';
import { openKeys } from '../ui/keysPanel';
import { capture } from '../state/keymap';
import { continueLife } from './flow';
import { changedCount } from '../data/tuning';
import { openDevConfig } from '../ui/devConfig';
import fossilUrl from '../assets/title/fossil.webp';

// Das Titelbild: ein versteinerter Urfisch in einer Unterwasserhöhle, durch eine Öffnung fällt Licht. Davor lebt das Wasser –
// Lichtstrahlen, ein Lichtnetz am Grund, Schwebeteilchen, Blasen und ein ferner Schwarm. Links Titel und Menü, schlicht; unten
// die Weltzeit des gewählten Zeitalters, die für alle gleich weiterläuft.

/** Kleine Schwarmfische der Zeit, die in der Ferne vorüberziehen */
const SCHOOL_SPECIES = ['birkenia', 'kieferlos', 'arandaspis', 'astraspis'];

/** Lage des Bildes: so groß und so weit rechts, dass links Platz für Titel und Menü bleibt */
const PIC = { x: 432, y: -84, s: 884 };
/** Wo im Bild das Licht hereinfällt (Anteil der Bildbreite) und wo es den Grund trifft (Anteil der Höhe) */
const BEAM_X = PIC.x + 0.5 * PIC.s;
const BEAM_FLOOR = PIC.y + 0.8 * PIC.s;

/** Ein dunkler Schleier links (dort stehen Titel und Menü) und unten (Weltzeit) – nach rechts läuft er aus. */
function scrimTexture(scene: Phaser.Scene) {
  return tex(scene, 'ttl_scrim', W, H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(2,6,8,.78)');
    g.addColorStop(0.3, 'rgba(2,6,8,.5)');
    g.addColorStop(0.56, 'rgba(2,6,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = vgrad(ctx, H - 170, H, [[0, 'rgba(2,5,6,0)'], [1, 'rgba(2,5,6,.75)']]);
    ctx.fillRect(0, H - 170, W, 170);
  });
}

/** Der linke Rand des Bildes läuft weich ins Dunkel aus (in der Farbe des Hintergrunds). */
function fadeTexture(scene: Phaser.Scene) {
  // (die letzten Spalten bleiben ganz leer – sonst zeichnet die Glättung am Rand eine feine Linie)
  return tex(scene, 'ttl_fade', 70, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(3,7,10,1)');
    g.addColorStop(0.35, 'rgba(3,7,10,0.72)');
    g.addColorStop(1, 'rgba(3,7,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 6);
  });
}

/** Die feine Linie unter dem Titel: ocker, nach rechts auslaufend. */
function ruleTexture(scene: Phaser.Scene) {
  return tex(scene, 'ttl_rule', 380, 4, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 380, 0);
    g.addColorStop(0, 'rgba(200,145,60,.95)');
    g.addColorStop(0.6, 'rgba(200,145,60,.45)');
    g.addColorStop(1, 'rgba(200,145,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 1, 380, 2);
  });
}

/** Das Zeichen vor einer angewählten Menüzeile: eine feine Linie, die aus dem Dunkel kommt und in einer kleinen Raute endet. */
function markTexture(scene: Phaser.Scene) {
  return tex(scene, 'ttl_mark', 46, 12, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 36, 0);
    g.addColorStop(0, 'rgba(214,160,74,0)');
    g.addColorStop(1, 'rgba(226,176,92,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 5.25, 36, 1.5);
    ctx.beginPath();
    ctx.moveTo(35, 6);
    ctx.lineTo(40.5, 1.5);
    ctx.lineTo(46, 6);
    ctx.lineTo(40.5, 10.5);
    ctx.closePath();
    const d = ctx.createLinearGradient(0, 1.5, 0, 10.5);
    d.addColorStop(0, '#f6dca4');
    d.addColorStop(1, '#a8702c');
    ctx.fillStyle = d;
    ctx.fill();
  }, 2);
}

/**
 * Eine Zeile des Menüs: schlichte Schrift. Angewählt leuchtet sie warm auf, rückt ein Stück ein, davor erscheint ein feines
 * Zeichen – und einmal streicht ein heller Glanz über die Buchstaben.
 */
class MenuItem extends Phaser.GameObjects.Container implements NavItem {
  disabled = false;
  /** die Trefferfläche (über einer Tafel muss sie über deren Schatten liegen) */
  readonly zone: Phaser.GameObjects.Zone;
  private label: Phaser.GameObjects.Text;
  private shine: Phaser.GameObjects.Text;
  private mark: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private focused = false;
  private sheen = { p: -1 };

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, private onClick: () => void, onHover: () => void, private sound: Sfx = 'select') {
    super(scene, x, y);
    markTexture(scene);
    const style = { fontFamily: TITLE_FONT, fontSize: '22px', fontStyle: '700', resolution: 2 };
    this.label = scene.add.text(0, 0, str, { ...style, color: UI.bone }).setOrigin(0, 0.5).setLetterSpacing(4).setAlpha(0.6);
    this.shine = scene.add.text(0, 0, str, { ...style, color: 'rgba(0,0,0,0)' }).setOrigin(0, 0.5).setLetterSpacing(4).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = scene.add.image(this.label.width * 0.5, 0, 'glow').setDisplaySize(this.label.width + 150, 46).setTint(0xd8a868)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.mark = scene.add.image(-6, 0, 'ttl_mark').setOrigin(0, 0.5).setScale(0, 0.5).setAlpha(0);
    this.add([this.glow, this.mark, this.label, this.shine]);
    scene.add.existing(this);
    // die Trefferfläche: die ganze Zeile, etwas großzügiger als die Schrift
    const zone = (this.zone = scene.add.zone(x - 12, y, this.label.width + 90, 42).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => {
      if (!this.focused && this.visible && this.alpha > 0.5) audio.sfx('hover');
      onHover();
    });
    zone.on('pointerdown', () => this.click());
    this.once('destroy', () => zone.destroy());
  }

  click() {
    if (this.disabled || !this.visible) return;
    audio.sfx(this.sound);
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.32, to: this.focused ? 0.12 : 0 }, duration: 600, ease: 'Sine.out' });
    this.onClick();
  }

  setFocus(f: boolean) {
    if (f === this.focused) return this;
    this.focused = f;
    const tw = this.scene.tweens;
    tw.killTweensOf([this.mark, this.label, this.shine, this.glow]);
    tw.add({ targets: this.mark, scaleX: f ? 0.5 : 0, alpha: f ? 1 : 0, duration: 300, ease: 'Cubic.out' });
    tw.add({ targets: [this.label, this.shine], x: f ? 48 : 0, duration: 300, ease: 'Cubic.out' });
    tw.add({ targets: this.label, alpha: f ? 1 : 0.6, duration: 300, ease: 'Cubic.out' });
    tw.add({ targets: this.glow, x: (f ? 48 : 0) + this.label.width * 0.5, alpha: f ? 0.12 : 0, duration: 420, ease: 'Sine.out' });
    this.label.setColor(f ? '#fbf1dc' : UI.bone);
    if (f) this.sweep();
    return this;
  }

  /** Ein heller Glanz wandert einmal über die Schrift. */
  private sweep() {
    const s = this.sheen, shine = this.shine;
    const paint = () => {
      const p = s.p, b = 0.18;
      if (p + b <= 0 || p - b >= 1) return shine.setFill('rgba(0,0,0,0)');
      const g = shine.context.createLinearGradient(0, 0, shine.width, 0);
      const at = (o: number) => `rgba(255,236,196,${(0.75 * Math.max(0, 1 - Math.abs(o - p) / b)).toFixed(3)})`;
      for (const o of [Math.max(0, p - b), clamp(p, 0, 1), Math.min(1, p + b)]) g.addColorStop(o, at(o));
      shine.setFill(g);
    };
    s.p = -0.2;
    this.scene.tweens.add({ targets: s, p: 1.2, duration: 700, delay: 60, ease: 'Sine.inOut', onUpdate: paint, onComplete: () => { s.p = -1; paint(); } });
  }
}

/** Ein kleiner Bewohner, der durchs Bild zieht (Schwarmfisch, Kopffüßer, Trilobit). */
interface Swimmer {
  s: Phaser.GameObjects.Sprite;
  ox: number;
  oy: number;
  ph: number;
}

export class TitleScene extends Phaser.Scene {
  /** schon einmal gezeigt: Beim Zurückkehren baut sich alles schneller auf */
  private static seen = false;
  private nav?: MenuNav;
  private overlay?: Phaser.GameObjects.Container;
  private overlayNav?: MenuNav;
  /** die Entwickler-Einstellung ist offen (sie liegt als Seite über dem Spiel) */
  private devOpen = false;
  private sways: { o: Phaser.GameObjects.Image; amp: number; sp: number; ph: number }[] = [];
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private school: { members: Swimmer[]; x: number; y: number; vx: number; at: number } = { members: [], x: 0, y: 0, vx: 0, at: 0 };
  private t = 0;
  private clock?: Phaser.GameObjects.Text;
  private clockAt = 0;

  constructor() {
    super('Title');
  }

  preload() {
    if (!this.textures.exists('ttl_fossil')) this.load.image('ttl_fossil', fossilUrl);
  }

  create() {
    this.devOpen = false;
    const quick = TitleScene.seen;
    TitleScene.seen = true;
    const k = quick ? 0.45 : 1;
    fadeIn(this, 1100 * k);
    audio.music('title');
    this.overlay = undefined;
    this.overlayNav = undefined;
    this.sways = [];
    this.caustics = [];
    this.t = 0;

    this.world();
    this.life();
    this.ui(k);
    this.input.keyboard!.on('keydown-ESC', () => !capture.on && this.closeOverlay());
  }

  // ---------------------------------------------------------------- die Welt

  /**
   * Das Bild: die Höhle mit dem versteinerten Urfisch rechts; nach links läuft sie weich ins Dunkel aus (dort stehen Titel und
   * Menü). Ganz langsam kommt die Kamera näher und weicht wieder zurück. Davor: Licht, Wasser und Leben.
   */
  private world() {
    this.add.rectangle(0, 0, W, H, 0x03070a).setOrigin(0).setDepth(-101);
    const { x, y, s } = PIC;
    const cave = this.add.container(x + s / 2, y + s / 2).setDepth(-100);
    const main = this.add.image(-s / 2, -s / 2, 'ttl_fossil').setOrigin(0).setDisplaySize(s, s);
    fadeTexture(this);
    const fade = this.add.image(-s / 2 - 2, -s / 2, 'ttl_fade').setOrigin(0).setDisplaySize(284, s);
    cave.add([main, fade]);
    this.tweens.add({ targets: cave, scale: 1.045, x: cave.x - 16, y: cave.y - 10, duration: 36000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Licht: Strahlen aus der Öffnung oben, bis hinunter zum Grund – sie atmen langsam
    for (const [dx, sx, a, rot, ph] of [[0, 2.4, 0.2, 0.02, 0], [-70, 1.3, 0.12, 0.1, 2], [90, 1.5, 0.11, -0.08, 4], [30, 3.4, 0.07, -0.02, 1]] as const) {
      const ray = this.add.image(BEAM_X + dx, -40, 'lightray').setOrigin(0.5, 0).setScale(sx, 1.4).setRotation(rot).setDepth(-60)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTint(0xd8f2ee);
      this.tweens.add({ targets: ray, alpha: a * 1.7, rotation: rot + 0.03, duration: 5200 + ph * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: ph * 400 });
    }
    // ein Lichtnetz, wo der Strahl den Grund trifft (nach oben auslaufend), dazu ein heller Fleck
    for (const [key, a, v, sc] of [['caustics', 0.2, -5, 1.1], ['caustics2', 0.14, 4, 1.5]] as const) {
      const c = this.add.tileSprite(BEAM_X - 330, BEAM_FLOOR - 90, 660, 200, key).setOrigin(0).setDepth(-58)
        .setBlendMode(Phaser.BlendModes.ADD).setTileScale(sc, sc * 0.45);
      c.setAlpha(0, 0, a, a);
      this.caustics.push({ s: c, v });
    }
    const spot = this.add.image(BEAM_X, BEAM_FLOOR + 20, 'glow').setScale(5.6, 1.3).setTint(0xcfe8e0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1).setDepth(-57);
    this.tweens.add({ targets: spot, alpha: 0.18, duration: 5400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // oben schimmert ein wenig Lichtnetz über die Höhlendecke
    const roof = this.add.tileSprite(0, -10, W, 210, 'caustics').setOrigin(0).setDepth(-59).setBlendMode(Phaser.BlendModes.ADD).setTileScale(1.3, 1.3);
    roof.setAlpha(0.1, 0.1, 0, 0);
    this.caustics.push({ s: roof, v: 6 });

    // ganz vorn: Tang, unscharf und dunkel – an beiden Seiten, das Bild bekommt Tiefe
    for (const [key, x, sx, sy, a, amp, sp, ph] of [
      ['d2_kelp', W + 18, 2.5, 2.7, 0.94, 1.6, 0.35, 1], ['d2_algae_sheet', W - 70, 2.4, 2.4, 0.9, 2.2, 0.42, 3],
      ['d2_kelp', -26, 2.2, 2.3, 0.9, 1.4, 0.3, 2], ['d2_seaweed', 46, 2, 2, 0.85, 2, 0.4, 5],
    ] as const) {
      if (!this.textures.exists(key)) continue;
      const o = this.add.image(x, H + 28, key).setOrigin(0.5, 1).setScale(sx, sy).setTint(0x030809).setAlpha(a).setDepth(40);
      this.sways.push({ o, amp, sp, ph });
    }

    // Meeresschnee, Schwebstoffe im Licht, Blasen aus einer Spalte am Grund
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: -20, max: H }, lifespan: 14000, frequency: 110,
      speedY: { min: 3, max: 12 }, speedX: { min: -4, max: 4 },
      scale: { min: 0.06, max: 0.24 }, alpha: { start: 0, end: 0.45, ease: 'Sine.inOut' }, tint: 0xd8e0d8,
    }).setDepth(13);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: BEAM_X - 160, max: BEAM_X + 160 }, y: { min: 0, max: BEAM_FLOOR }, lifespan: 6500, frequency: 120,
      speedY: { min: -3, max: 6 }, speedX: { min: -3, max: 3 },
      scale: { min: 0.05, max: 0.15 }, alpha: { start: 0, end: 0.9, ease: 'Sine.inOut' }, tint: 0xf4fff4, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(14);
    const vent = this.add.particles(PIC.x + 0.86 * PIC.s, PIC.y + 0.83 * PIC.s, 'p_bubble', {
      lifespan: 9000, frequency: 1500, speedY: { min: -46, max: -24 }, speedX: { min: -5, max: 5 },
      scale: { start: 0.4, end: 0.95 }, alpha: { start: 0.7, end: 0 }, accelerationX: { min: -2, max: 2 },
    }).setDepth(11);
    this.time.addEvent({ delay: 6400, loop: true, callback: () => vent.explode(4) });

    // Schärfentiefe: ein paar weiche Lichtpunkte ganz vorn
    for (let i = 0; i < 7; i++) {
      const b = this.add.image(520 + Math.random() * 740, 60 + Math.random() * 520, 'glow').setScale(0.4 + Math.random() * 0.9)
        .setTint(0xa8e0d4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.03 + Math.random() * 0.05).setDepth(41);
      this.tweens.add({ targets: b, y: b.y + (Math.random() - 0.5) * 70, x: b.x + (Math.random() - 0.5) * 40, duration: 9000 + Math.random() * 7000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.75).setDepth(44);
    scrimTexture(this);
    this.add.image(0, 0, 'ttl_scrim').setOrigin(0).setDepth(45);
  }

  /** Die Lebenden: in der Ferne zieht ab und zu ein Schwarm vorbei. */
  private life() {
    for (const id of SCHOOL_SPECIES) if (SPECIES[id]) makeSpeciesTextures(this, SPECIES[id]);
    this.newSchool(true);
  }

  /** Ein Schwarm kleiner Fische – beim Aufbau schon mitten im Bild, später von einer Seite hereinschwimmend. */
  private newSchool(first = false) {
    for (const m of this.school.members) m.s.destroy();
    const id = SCHOOL_SPECIES[Math.floor(Math.random() * SCHOOL_SPECIES.length)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const n = 7 + Math.floor(Math.random() * 5);
    const members: Swimmer[] = [];
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(0, 0, speciesKey(id, 0)).setScale(0.5 + Math.random() * 0.16).setDepth(12).setTint(0x6f8a90).setAlpha(0.62).setFlipX(dir < 0);
      s.play({ key: `anim_${id}`, startFrame: i % 2 });
      members.push({ s, ox: (Math.random() - 0.5) * 150, oy: (Math.random() - 0.5) * 56, ph: Math.random() * 6 });
    }
    const x = first ? 760 + Math.random() * 260 : dir > 0 ? -140 : W + 140;
    this.school = { members, x, y: 250 + Math.random() * 120, vx: dir * (24 + Math.random() * 12), at: 0 };
  }

  // ---------------------------------------------------------------- Titel und Menü

  private ui(k: number) {
    const run = game.run;
    const X = 100;

    // EVO – schlank und hell, darunter eine feine Linie und der Untertitel
    const halo = this.add.image(X + 190, 128, 'glow').setScale(6, 2.4).setTint(0x9ccfc6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(59);
    const logo = this.add
      .text(X - 6, 58, 'EVO', {
        fontFamily: TITLE_FONT, fontSize: '150px', color: UI.bone, fontStyle: '400', resolution: 2,
        shadow: { offsetX: 0, offsetY: 6, color: 'rgba(0,0,0,.55)', blur: 24, fill: true },
      })
      .setLetterSpacing(22)
      .setDepth(60);
    const grad = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grad.addColorStop(0.2, '#f6eedb');
    grad.addColorStop(0.75, '#d9c69c');
    grad.addColorStop(1, '#b89a68');
    logo.setFill(grad);
    // ab und zu streicht ein Glanz über die Buchstaben: dieselbe Schrift noch einmal darüber, aufhellend, mit einem schmalen
    // hellen Band, das von links nach rechts wandert
    const shine = this.add
      .text(X - 6, 58, 'EVO', { fontFamily: TITLE_FONT, fontSize: '150px', color: 'rgba(0,0,0,0)', fontStyle: '400', resolution: 2 })
      .setLetterSpacing(22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(61);
    const sheen = { p: -1 };
    const paint = () => {
      const p = sheen.p, b = 0.12;
      if (p + b <= 0 || p - b >= 1) {
        shine.setFill('rgba(0,0,0,0)');
        return;
      }
      // das Band: in der Mitte am hellsten, zu den Rändern hin unsichtbar (auch wenn es gerade am Rand der Schrift steht)
      const g = shine.context.createLinearGradient(0, 0, shine.width, 0);
      const at = (o: number) => `rgba(255,249,230,${(0.5 * Math.max(0, 1 - Math.abs(o - p) / b)).toFixed(3)})`;
      for (const o of [Math.max(0, p - b), clamp(p, 0, 1), Math.min(1, p + b)]) g.addColorStop(o, at(o));
      shine.setFill(g);
    };
    this.time.addEvent({
      delay: 9000, loop: true, startAt: 3500,
      callback: () => {
        sheen.p = -0.15;
        this.tweens.add({ targets: sheen, p: 1.15, duration: 1500, ease: 'Sine.inOut', onUpdate: paint, onComplete: () => { sheen.p = -1; paint(); } });
      },
    });
    ruleTexture(this);
    const rule = this.add.image(X, 236, 'ttl_rule').setOrigin(0, 0.5).setDepth(60).setScale(0, 1);
    const sub = this.add
      .text(X, 262, 'LIVING WORLD', { fontFamily: TITLE_FONT, fontSize: '21px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0, 0.5)
      .setLetterSpacing(12)
      .setDepth(60);

    // das Menü: weiterleben – oder ein Zeitalter wählen (für das erste Leben heißt das „Leben beginnen“)
    const entries: [string, () => void, Sfx][] = [];
    if (run) entries.push(['Weiterleben', () => this.continueGame(), 'confirm']);
    entries.push([run ? 'Zeitalter' : 'Leben beginnen', () => !this.overlay && fadeTo(this, 'Eras', {}, 600), 'open']);
    if (game.hasTree()) entries.push(['Stammbaum', () => !this.overlay && fadeTo(this, 'Tree', { mode: 'view', epoch: game.chosenEpoch }, 600), 'open']);
    entries.push(['Aquapendium', () => !this.overlay && fadeTo(this, 'Aquapendium', { epoch: game.chosenEpoch }, 600), 'open']);
    entries.push(['Steuerung', () => this.showHelp(), 'select']);
    const items: MenuItem[] = [];
    entries.forEach(([label, fn, sound], i) => {
      const it = new MenuItem(this, X, 330 + i * 48, label, fn, () => !this.overlay && this.nav?.focus(i), sound);
      it.setDepth(60);
      items.push(it);
    });
    this.nav = new MenuNav(this, items);

    // unten links: die Weltzeit des gewählten Zeitalters – sie läuft für alle gleich weiter
    const ep = EPOCHS[game.chosenEpoch];
    const era = this.add.text(X, H - 82, ep.name.toUpperCase(), { fontFamily: TITLE_FONT, fontSize: '13px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setLetterSpacing(6).setDepth(60);
    this.clock = text(this, X, H - 60, '', 19, UI.bone).setDepth(60).setAlpha(0.85);
    this.clockAt = 0;
    this.tickClock(0);
    // ein leiser Herzschlag: Die Welt lebt
    const beat = this.add.circle(X + era.width + 14, H - 82 + era.height / 2, 3, 0xc8913c).setDepth(60).setAlpha(0);

    // unten rechts: wer da schwimmt
    const cap: Phaser.GameObjects.Text[] = [];
    if (run) {
      const L = game.life;
      cap.push(this.add.text(W - 96, H - 84, game.currentName, { fontFamily: FONT, fontSize: '20px', color: UI.bone, fontStyle: 'italic', resolution: 2 }).setOrigin(1, 0).setDepth(60).setAlpha(0.9));
      cap.push(text(this, W - 96, H - 58, `Generation ${L.gen} · ${STAGE_NAME[stageOf(L.age, L.gen)]}`, 15, UI.boneDim).setOrigin(1, 0).setDepth(60));
    }

    const snd = soundIcon(this, W - 48, 44, 28).setDepth(60);
    const gear = this.devButton(W - 92, 44);
    const dbg = DEBUG ? [text(this, 16, 12, 'Debug', 14, UI.boneDim).setDepth(60).setAlpha(0.6)] : [];

    // der Auftritt: der Titel atmet sich ins Bild, dann die Linie, der Untertitel, das Menü
    const spacing = { v: 46 };
    logo.setAlpha(0).setY(72);
    shine.setY(72);
    this.tweens.add({ targets: [logo, shine], y: 58, duration: 1700 * k, delay: 250 * k, ease: 'Cubic.out' });
    this.tweens.add({ targets: logo, alpha: 1, duration: 1700 * k, delay: 250 * k, ease: 'Cubic.out' });
    this.tweens.add({
      targets: spacing, v: 22, duration: 1900 * k, delay: 250 * k, ease: 'Cubic.out',
      onUpdate: () => {
        logo.setLetterSpacing(spacing.v);
        shine.setLetterSpacing(spacing.v);
      },
    });
    this.tweens.add({ targets: halo, alpha: 0.09, duration: 2400 * k, delay: 500 * k, onComplete: () => this.tweens.add({ targets: halo, alpha: 0.05, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' }) });
    this.tweens.add({ targets: rule, scaleX: 1, duration: 1000 * k, delay: 900 * k, ease: 'Cubic.out' });
    sub.setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 900 * k, delay: 1150 * k });
    items.forEach((it, i) => {
      it.setAlpha(0).setX(X - 14);
      this.tweens.add({ targets: it, alpha: 1, x: X, duration: 600 * k, delay: (1500 + i * 90) * k, ease: 'Cubic.out' });
    });
    this.tweens.add({
      targets: beat, alpha: 1, duration: 900 * k, delay: 2000 * k,
      onComplete: () => this.tweens.add({ targets: beat, alpha: 0.25, scale: 0.7, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' }),
    });
    for (const o of [era, this.clock, ...cap, snd, ...gear, ...dbg]) {
      const a = o.alpha;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: 900 * k, delay: 2000 * k });
    }
  }

  /**
   * Für Entwickler und Tester: ein kleines Zahnrad neben dem Ton – es öffnet die Einstellung aller Zahlen, die das Gleichgewicht
   * bestimmen. Sind eigene Werte gesetzt, steht darunter leise „eigene Werte“.
   */
  private devButton(x: number, y: number) {
    const img = this.add.image(x, y, 'ic_gear').setDisplaySize(26, 26).setAlpha(0.45).setDepth(60).setInteractive({ useHandCursor: true });
    const note = text(this, x + 22, y + 24, '', 12, UI.ochre).setOrigin(1, 0).setDepth(60).setAlpha(0.8);
    const upd = () => {
      const n = changedCount();
      note.setText(n ? 'eigene Werte' : '');
      img.setTint(n ? 0xe8c07a : 0xffffff);
    };
    upd();
    img.on('pointerover', () => img.setAlpha(0.95));
    img.on('pointerout', () => img.setAlpha(0.45));
    img.on('pointerdown', () => {
      if (this.overlay || this.devOpen) return;
      audio.sfx('select');
      this.devOpen = true;
      const kb = this.input.keyboard;
      if (kb) kb.enabled = false;
      if (this.nav) this.nav.enabled = false;
      openDevConfig(upd, () => {
        this.devOpen = false;
        if (kb) kb.enabled = true;
        if (this.nav) this.nav.enabled = true;
      });
    });
    return [img, note];
  }

  /** Die Weltzeit, auf das Jahr genau – sie tickt sichtbar weiter. */
  private tickClock(dt: number) {
    this.clockAt -= dt;
    if (this.clockAt > 0 || !this.clock) return;
    this.clockAt = 0.2;
    const ep = EPOCHS[game.chosenEpoch];
    this.clock.setText(yearsAgo(worldYears(ep.from, ep.to), 1));
  }

  // ---------------------------------------------------------------- jedes Bild

  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.t += dt;
    const t = this.t;
    for (const c of this.caustics) c.s.tilePositionX += dt * c.v;
    for (const w of this.sways) w.o.setAngle(Math.sin(t * w.sp + w.ph) * w.amp);
    this.tickClock(dt);

    // der Schwarm
    const s = this.school;
    s.x += s.vx * dt;
    for (const m of s.members) {
      m.s.setPosition(s.x + m.ox + Math.sin(t * 0.9 + m.ph) * 7, s.y + m.oy + Math.sin(t * 1.3 + m.ph * 2) * 5 + Math.sin(t * 0.4) * 10);
    }
    if ((s.vx > 0 && s.x > W + 220) || (s.vx < 0 && s.x < -220)) {
      s.at += dt;
      if (s.at > 4) this.newSchool();
    }
  }

  // ---------------------------------------------------------------- Menü-Aktionen

  private continueGame() {
    if (this.overlay) return;
    continueLife(this);
  }

  /** Die Seite "Steuerung": Tasten ansehen und neu belegen. */
  private showHelp() {
    this.closeOverlay();
    const c = openKeys(this, 100, () => {
      if (this.overlay !== c) return;
      this.overlay = undefined;
      if (this.nav) this.nav.enabled = true;
    });
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
  }

  private closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy();
    this.overlay = undefined;
    if (this.overlayNav) this.overlayNav.enabled = false;
    this.overlayNav = undefined;
    if (this.nav) this.nav.enabled = true;
  }
}
