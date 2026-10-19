import Phaser from 'phaser';
import { W, H, DEBUG, FONT, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, ZERO_TRAITS } from '../state/GameState';
import { SPECIES } from '../data/species';
import { EPOCHS, yearsAgo } from '../data/epochs';
import { ADULT, STAGE_NAME, stageOf, worldYears } from '../sim/life';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { levelBackgrounds, SWAYS } from '../art/worldArt';
import { LIFE_SWAY } from '../art/lifeArt';
import { CreatureView } from '../objects/CreatureView';
import { BackSea } from '../objects/BackSea';
import { ell, tex, vgrad } from '../util/canvas';
import { clamp, mulberry32 } from '../util/math';
import { MenuNav, controlsList, fadeIn, fadeTo, soundIcon, text, type NavItem } from '../ui/ui';
import { continueLife, startNewLife } from './flow';

// Das Titelbild: ein lebendiger Ausschnitt des Urmeers – Licht fällt von oben, Seelilien und Algen wiegen sich, Trilobiten
// kriechen über den Sand, ein Schwarm zieht vorbei, in der Tiefe gleitet ab und zu ein riesiger Kopffüßer. Mittendrin schwimmt
// dein eigenes Tier. Links Titel und Menü, schlicht; unten die Weltzeit, die für alle gleich weiterläuft.

/** Wo der Meeresgrund im Bild beginnt (die Dünen liegen etwas tiefer, siehe crest) */
const FLOOR_Y = H - 236;

/** Die Oberkante des Meeresgrunds: sanfte Dünen (y im Bild). */
const crest = (x: number) => FLOOR_Y + 62 + Math.sin(x * 0.0042 + 0.6) * 20 + Math.sin(x * 0.011 + 2) * 8 + Math.sin(x * 0.029 + 1) * 2.5;

/** Was am Grund wächst und liegt: Textur (ohne „d2_“), Lage, Größe – von links nach rechts. */
const FLOOR_LIFE: [string, number, number][] = [
  ['kelp', 34, 1.25],
  ['seagrass', 196, 0.85],
  ['shell', 292, 0.9],
  ['algae_tuft', 404, 0.85],
  ['brachio_cluster', 452, 0.8],
  ['crinoid_tall', 548, 1.1],
  ['crinoid_short', 590, 0.85],
  ['boulder', 676, 1.2],
  ['sponge_vase', 712, 0.9],
  ['algae_sheet', 758, 1],
  ['stromatolite', 836, 1],
  ['seagrass', 884, 1.1],
  ['bryo_fan', 952, 0.9],
  ['crinoid_cluster', 1012, 1],
  ['coral_horn', 1062, 0.9],
  ['kelp', 1122, 1.45],
  ['rock', 1172, 1.1],
  ['anemone', 1206, 0.9],
  ['grapto_bush', 1236, 0.9],
  ['seaweed', 1264, 1.2],
];

/** Kleine Schwarmfische der Zeit, die vorüberziehen */
const SCHOOL_SPECIES = ['birkenia', 'kieferlos', 'arandaspis', 'astraspis'];

/** Der Sandgrund, einmal gemalt: Dünen, Rippel, Kiesel – zur Tiefe hin dunkel und bläulich. */
function floorTexture(scene: Phaser.Scene) {
  const FH = H - FLOOR_Y;
  return tex(scene, 'ttl_floor', W, FH, (ctx) => {
    const r = mulberry32(23);
    const top = (x: number) => crest(x) - FLOOR_Y;
    const outline = (dy: number) => {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, top(x) + dy);
    };
    ctx.beginPath();
    ctx.moveTo(0, FH);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, top(x));
    ctx.lineTo(W, FH);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, 28, FH, [[0, '#8e8467'], [0.16, '#6b624b'], [0.42, '#38362c'], [0.75, '#161a19'], [1, '#080b0c']]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Rippel, die den Dünen folgen
    for (let k = 0; k < 26; k++) {
      const off = 10 + k * 7 + r() * 4;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, top(x) + off + Math.sin(x * 0.05 + k * 1.7) * 2.2);
      ctx.strokeStyle = k % 2 ? 'rgba(255,240,200,.05)' : 'rgba(0,0,0,.09)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Kiesel und Schalenbruch
    for (let i = 0; i < 280; i++) {
      const x = r() * W, d = Math.pow(r(), 0.8);
      const y = top(x) + 6 + d * (FH - top(x));
      const s = 0.8 + r() * 2.6 * (1 - d * 0.5);
      ell(ctx, x, y, s * 1.4, s);
      ctx.fillStyle = r() > 0.45 ? `rgba(28,26,20,${0.25 + r() * 0.35})` : `rgba(170,160,128,${0.15 + r() * 0.3})`;
      ctx.fill();
    }
    // Wasser über dem Sand: bläulich, nach unten dunkel
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, 'rgba(14,52,56,.22)'], [0.5, 'rgba(6,20,24,.4)'], [1, 'rgba(2,6,8,.7)']]);
    ctx.fillRect(0, 0, W, FH);
    ctx.restore();
    // Licht auf der Kante
    outline(1.5);
    ctx.strokeStyle = 'rgba(232,220,180,.32)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

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

/** Eine Zeile des Menüs: schlichte Schrift; angewählt leuchtet sie auf, und davor erscheint ein feiner Strich. */
class MenuItem extends Phaser.GameObjects.Container implements NavItem {
  disabled = false;
  /** die Trefferfläche (über einer Tafel muss sie über deren Schatten liegen) */
  readonly zone: Phaser.GameObjects.Zone;
  private label: Phaser.GameObjects.Text;
  private mark: Phaser.GameObjects.Image;
  private focused = false;

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, private onClick: () => void, onHover: () => void) {
    super(scene, x, y);
    this.mark = scene.add.image(0, 0, 'ttl_rule').setOrigin(0, 0.5).setDisplaySize(28, 3).setScale(0, 1);
    this.label = scene.add
      .text(0, 0, str, { fontFamily: TITLE_FONT, fontSize: '22px', color: UI.bone, fontStyle: '700', resolution: 2 })
      .setOrigin(0, 0.5)
      .setLetterSpacing(4)
      .setAlpha(0.6);
    this.add([this.mark, this.label]);
    scene.add.existing(this);
    // die Trefferfläche: die ganze Zeile, etwas großzügiger als die Schrift
    const zone = (this.zone = scene.add.zone(x - 12, y, this.label.width + 90, 42).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', onHover);
    zone.on('pointerdown', () => this.click());
    this.once('destroy', () => zone.destroy());
  }

  click() {
    if (this.disabled || !this.visible) return;
    audio.sfx('click');
    this.onClick();
  }

  setFocus(f: boolean) {
    if (f === this.focused) return this;
    this.focused = f;
    const tw = this.scene.tweens;
    tw.killTweensOf([this.mark, this.label]);
    tw.add({ targets: this.mark, scaleX: f ? (28 / 380) : 0, duration: 260, ease: 'Cubic.out' });
    tw.add({ targets: this.label, x: f ? 40 : 0, alpha: f ? 1 : 0.6, duration: 260, ease: 'Cubic.out' });
    return this;
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
  private hero!: CreatureView;
  private heroShadow!: Phaser.GameObjects.Image;
  private heroT = 0;
  private nav?: MenuNav;
  private overlay?: Phaser.GameObjects.Container;
  private overlayNav?: MenuNav;
  private backSea?: BackSea;
  private sways: { o: Phaser.GameObjects.Image; amp: number; sp: number; ph: number }[] = [];
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private fog?: Phaser.GameObjects.TileSprite;
  private school: { members: Swimmer[]; x: number; y: number; vx: number; at: number } = { members: [], x: 0, y: 0, vx: 0, at: 0 };
  private crawlers: { s: Phaser.GameObjects.Sprite; vx: number; lo: number; hi: number }[] = [];
  private t = 0;
  private clock?: Phaser.GameObjects.Text;
  private clockAt = 0;

  constructor() {
    super('Title');
  }

  create() {
    const quick = TitleScene.seen;
    TitleScene.seen = true;
    const k = quick ? 0.45 : 1;
    fadeIn(this, 1100 * k);
    audio.music('title');
    this.overlay = undefined;
    this.overlayNav = undefined;
    this.sways = [];
    this.caustics = [];
    this.crawlers = [];
    this.t = 0;
    this.heroT = Math.random() * 60;

    this.world();
    this.life();
    this.ui(k);
    this.input.keyboard!.on('keydown-ESC', () => this.closeOverlay());
  }

  // ---------------------------------------------------------------- die Welt

  /** Wasser, Licht und Grund. */
  private world() {
    const [far, mid, fog] = levelBackgrounds(this, 'ozean', 'normal');
    this.add.image(0, 0, far).setOrigin(0).setDepth(-100);
    this.add.image(0, 0, mid).setOrigin(0).setDepth(-98.9).setAlpha(0.9);
    this.fog = this.add.tileSprite(0, H * 0.35, W, H * 0.65, fog).setOrigin(0).setDepth(-98.5).setAlpha(0.3);
    // ferne Schwärme in zwei Tiefen (wie im Spiel)
    this.backSea = new BackSea(this, { x: 0, y: 0, w: W, h: H }, EPOCHS[0], 'lagune', 'deep', -400, false);

    // Licht von oben: die Wasseroberfläche schimmert, Lichtnetze, Strahlen bis hinunter zum Grund
    this.add.tileSprite(0, -40, W, 220, 'surface_light').setOrigin(0).setDepth(-90).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setTileScale(1, 0.62);
    for (const [key, a, v, sc] of [['caustics', 0.22, 7, 1.2], ['caustics2', 0.16, -5, 1.6]] as const) {
      const s = this.add.tileSprite(0, -10, W, 200, key).setOrigin(0).setDepth(-89).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTileScale(sc, sc);
      this.caustics.push({ s, v });
    }
    for (const [x, sx, a, rot, ph] of [[940, 2.6, 0.2, -0.16, 0], [700, 1.5, 0.11, -0.1, 2], [1170, 1.9, 0.12, -0.2, 4]] as const) {
      const ray = this.add.image(x, -30, 'lightray').setOrigin(0.5, 0).setScale(sx, 1.25).setRotation(rot).setDepth(-60)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(a);
      this.tweens.add({ targets: ray, alpha: a * 1.6, rotation: rot + 0.035, duration: 5200 + ph * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: ph * 400 });
    }

    // der Grund – mit einem leisen Lichtnetz, wo die Sonne ihn trifft (nur oben, nach unten verlöschend)
    floorTexture(this);
    this.add.image(0, FLOOR_Y, 'ttl_floor').setOrigin(0).setDepth(5);
    const cy = Math.max(...Array.from({ length: 65 }, (_, i) => crest(i * 20))) + 4;
    for (const [key, a, v, sc] of [['caustics', 0.1, -4, 1.3], ['caustics2', 0.07, 3, 1.8]] as const) {
      const s = this.add.tileSprite(0, cy, W, 200 * sc * 0.42, key).setOrigin(0).setDepth(5.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTileScale(sc, sc * 0.42);
      this.caustics.push({ s, v });
    }
    // wo der Hauptstrahl auftrifft, ist der Sand heller
    const spot = this.add.image(1010, crest(1010) + 22, 'glow').setScale(5.2, 1.2).setTint(0xcfe8d8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.13).setDepth(5.6);
    this.tweens.add({ targets: spot, alpha: 0.2, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // was am Grund wächst: Es wiegt sich in der Strömung
    const rnd = mulberry32(5);
    for (const [key, x, sc] of FLOOR_LIFE) {
      const k = 'd2_' + key;
      if (!this.textures.exists(k)) continue;
      const img = this.add.image(x, crest(x) + 7, k).setOrigin(0.5, 1).setScale(sc).setDepth(6 + rnd() * 0.5).setTint(0xc4cec8);
      if (SWAYS.has(key) || key in LIFE_SWAY) this.sways.push({ o: img, amp: (2.4 + rnd() * 3) * (LIFE_SWAY[key] ?? 1), sp: 0.5 + rnd() * 0.7, ph: rnd() * 6 });
    }

    // ganz vorn: Tang, unscharf und dunkel – das Bild bekommt Tiefe
    const front = this.add.image(W + 18, H + 30, 'd2_kelp').setOrigin(0.5, 1).setScale(2.5, 2.7).setTint(0x030809).setAlpha(0.94).setDepth(40);
    this.sways.push({ o: front, amp: 1.6, sp: 0.35, ph: 1 });
    const front2 = this.add.image(W - 70, H + 26, 'd2_algae_sheet').setOrigin(0.5, 1).setScale(2.4).setTint(0x030809).setAlpha(0.9).setDepth(40);
    this.sways.push({ o: front2, amp: 2.2, sp: 0.42, ph: 3 });

    // Meeresschnee, Schwebstoffe im Licht, Blasen aus dem Grund
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: -20, max: H }, lifespan: 14000, frequency: 120,
      speedY: { min: 3, max: 12 }, speedX: { min: -4, max: 4 },
      scale: { min: 0.06, max: 0.24 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: 0xd8e0d8,
    }).setDepth(13);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 820, max: 1120 }, y: { min: 40, max: 520 }, lifespan: 6000, frequency: 160,
      speedY: { min: -3, max: 6 }, speedX: { min: -3, max: 3 },
      scale: { min: 0.05, max: 0.14 }, alpha: { start: 0, end: 0.9, ease: 'Sine.inOut' }, tint: 0xf4fff4, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(14);
    const vent = this.add.particles(1052, crest(1052) - 6, 'p_bubble', {
      lifespan: 9000, frequency: 1300, speedY: { min: -46, max: -24 }, speedX: { min: -5, max: 5 },
      scale: { start: 0.45, end: 1 }, alpha: { start: 0.75, end: 0 }, accelerationX: { min: -2, max: 2 },
    }).setDepth(11);
    this.time.addEvent({ delay: 6200, loop: true, callback: () => vent.explode(4) });

    // Schärfentiefe: ein paar weiche Lichtpunkte ganz vorn
    for (let i = 0; i < 6; i++) {
      const b = this.add.image(560 + Math.random() * 700, 80 + Math.random() * 480, 'glow').setScale(0.4 + Math.random() * 0.9)
        .setTint(0xa8e0d4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.03 + Math.random() * 0.05).setDepth(41);
      this.tweens.add({ targets: b, y: b.y + (Math.random() - 0.5) * 70, x: b.x + (Math.random() - 0.5) * 40, duration: 9000 + Math.random() * 7000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.8).setDepth(44);
    scrimTexture(this);
    this.add.image(0, 0, 'ttl_scrim').setOrigin(0).setDepth(45);
  }

  /** Die Bewohner: dein Tier, ein Schwarm, Trilobiten am Grund, Kopffüßer in der Ferne. */
  private life() {
    // dein Tier (oder ein Urfisch, der auf sein erstes Leben wartet) – ausgewachsen gezeigt
    const run = game.run;
    const m = run ? game.morph({ belly: 1, life: ADULT }) : game.morph({ cls: 'fish', traits: { ...ZERO_TRAITS }, fierce: 0, hue: 0, seed: 7, sex: 0 });
    this.heroShadow = this.add.image(900, crest(900) + 4, 'shadow').setDepth(5.8).setAlpha(0.35);
    this.hero = new CreatureView(this, 900, 400, m, 1.9);
    this.hero.setDepth(20);

    for (const id of [...SCHOOL_SPECIES, 'trilobit', 'isotelus', 'orthoceras', 'cameroceras']) if (SPECIES[id]) makeSpeciesTextures(this, SPECIES[id]);
    this.newSchool(true);

    // Trilobiten kriechen über den Sand
    for (const [id, x, lo, hi, sc] of [['trilobit', 780, 640, 900, 0.85], ['isotelus', 1150, 1040, 1250, 0.7], ['trilobit', 470, 380, 560, 0.7]] as const) {
      const s = this.add.sprite(x, crest(x), speciesKey(id, 0)).setScale(sc).setDepth(9).setTint(0xc8d0c8);
      s.play({ key: `anim_${id}`, frameRate: 3 });
      this.crawlers.push({ s, vx: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 6), lo, hi });
    }

    // ein Orthoceras zieht in einiger Entfernung vorüber – immer wieder
    const ortho = () => {
      const ltr = Math.random() < 0.5;
      const s = this.add.sprite(ltr ? -160 : W + 160, 170 + Math.random() * 140, speciesKey('orthoceras', 0))
        .setScale(0.75).setTint(0x9fb6b8).setAlpha(0.78).setDepth(10).setFlipX(!ltr);
      s.play('anim_orthoceras');
      this.tweens.add({
        targets: s, x: ltr ? W + 160 : -160, y: s.y + (Math.random() - 0.5) * 60, duration: 42000 + Math.random() * 12000, ease: 'Sine.inOut',
        onComplete: () => {
          s.destroy();
          this.time.delayedCall(9000 + Math.random() * 14000, ortho);
        },
      });
    };
    this.time.delayedCall(2500, ortho);

    // tief unten im Blau: der Riesenkopffüßer, nur als Schatten
    const giant = () => {
      const ltr = Math.random() < 0.5;
      const s = this.add.sprite(ltr ? -700 : W + 700, 300 + Math.random() * 120, speciesKey('cameroceras', 0))
        .setScale(2.3).setTint(0x081419).setAlpha(0.5).setDepth(-99.7).setFlipX(!ltr);
      s.play({ key: 'anim_cameroceras', frameRate: 2 });
      this.tweens.add({
        targets: s, x: ltr ? W + 700 : -700, y: s.y + (Math.random() - 0.5) * 90, duration: 52000, ease: 'Sine.inOut',
        onComplete: () => {
          s.destroy();
          this.time.delayedCall(18000 + Math.random() * 20000, giant);
        },
      });
    };
    this.time.delayedCall(5000, giant);
  }

  /** Ein Schwarm kleiner Fische – beim Aufbau schon mitten im Bild, später von einer Seite hereinschwimmend. */
  private newSchool(first = false) {
    for (const m of this.school.members) m.s.destroy();
    const id = SCHOOL_SPECIES[Math.floor(Math.random() * SCHOOL_SPECIES.length)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    const n = 7 + Math.floor(Math.random() * 5);
    const members: Swimmer[] = [];
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(0, 0, speciesKey(id, 0)).setScale(0.7 + Math.random() * 0.22).setDepth(12).setTint(0xdce6e2).setFlipX(dir < 0);
      s.play({ key: `anim_${id}`, startFrame: i % 2 });
      members.push({ s, ox: (Math.random() - 0.5) * 150, oy: (Math.random() - 0.5) * 56, ph: Math.random() * 6 });
    }
    const x = first ? 760 + Math.random() * 260 : dir > 0 ? -140 : W + 140;
    this.school = { members, x, y: 230 + Math.random() * 110, vx: dir * (30 + Math.random() * 14), at: 0 };
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

    // das Menü
    const entries: [string, () => void][] = [];
    if (run) entries.push(['Weiterleben', () => this.continueGame()]);
    entries.push(['Neues Leben', () => this.newGame()]);
    if (game.hasTree()) entries.push(['Stammbaum', () => !this.overlay && fadeTo(this, 'Tree', { mode: 'view' }, 600)]);
    entries.push(['Aquapendium', () => !this.overlay && fadeTo(this, 'Aquapendium', { page: 0 }, 600)]);
    entries.push(['Steuerung', () => this.showHelp()]);
    const items: MenuItem[] = [];
    entries.forEach(([label, fn], i) => {
      const it = new MenuItem(this, X, 330 + i * 48, label, fn, () => !this.overlay && this.nav?.focus(i));
      it.setDepth(60);
      items.push(it);
    });
    this.nav = new MenuNav(this, items);

    // unten links: die Weltzeit – sie läuft für alle gleich weiter
    const ep = EPOCHS[run?.epoch ?? 0];
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
    for (const o of [era, this.clock, ...cap, snd, ...dbg]) {
      const a = o.alpha;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: 900 * k, delay: 2000 * k });
    }
  }

  /** Die Weltzeit, auf das Jahr genau – sie tickt sichtbar weiter. */
  private tickClock(dt: number) {
    this.clockAt -= dt;
    if (this.clockAt > 0 || !this.clock) return;
    this.clockAt = 0.2;
    const ep = EPOCHS[game.run?.epoch ?? 0];
    this.clock.setText(yearsAgo(worldYears(ep.from, ep.to), 1));
  }

  // ---------------------------------------------------------------- jedes Bild

  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.t += dt;
    const t = this.t;
    this.backSea?.update(this.time.now, dt, 0, 0);
    for (const c of this.caustics) c.s.tilePositionX += dt * c.v;
    if (this.fog) this.fog.tilePositionX += dt * 4;
    for (const w of this.sways) w.o.setAngle(Math.sin(t * w.sp + w.ph) * w.amp);
    this.tickClock(dt);

    // dein Tier zieht gemächlich seine Bahnen durchs Licht
    this.heroT += dt;
    const ht = this.heroT;
    const x = 905 + Math.sin(ht * 0.16) * 120 + Math.sin(ht * 0.41) * 18;
    const y = 366 + Math.sin(ht * 0.27) * 26 + Math.sin(ht * 0.9) * 4;
    const vx = (x - this.hero.x) / Math.max(0.001, dt), vy = (y - this.hero.y) / Math.max(0.001, dt);
    if (Math.abs(vx) > 1) this.hero.setFacing(vx > 0 ? 1 : -1);
    this.hero.setPosition(x, y);
    // beim Steigen und Sinken neigt es sich ein wenig
    this.hero.setRotation(this.hero.rotation + (clamp(vy / 160, -0.14, 0.14) * (vx >= 0 ? 1 : -1) - this.hero.rotation) * Math.min(1, dt * 3));
    this.hero.animate(dt, 'swim', clamp(Math.abs(vx) / 70, 0.15, 0.7));
    const gy = crest(x);
    const lift = clamp((gy - y) / 260, 0, 1);
    this.heroShadow.setPosition(x, gy + 5).setScale(2.2 - lift, 1).setAlpha(0.42 - 0.22 * lift);

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

    // die Trilobiten am Grund
    for (const c of this.crawlers) {
      let nx = c.s.x + c.vx * dt;
      if (nx < c.lo || nx > c.hi) {
        c.vx = -c.vx;
        nx = clamp(nx, c.lo, c.hi);
      }
      const slope = crest(nx + 6) - crest(nx - 6);
      c.s.setPosition(nx, crest(nx) - c.s.displayHeight * 0.32).setFlipX(c.vx < 0).setRotation(Math.atan2(slope, 12));
    }
  }

  // ---------------------------------------------------------------- Menü-Aktionen

  private continueGame() {
    if (this.overlay) return;
    continueLife(this);
  }

  private newGame() {
    if (this.overlay) return;
    if (game.hasRun()) {
      this.confirm('Ein neuer Urfisch schlüpft –\ndeine jetzige Linie endet dann.', () => startNewLife(this));
      return;
    }
    startNewLife(this);
  }

  /** Eine schlichte Tafel über dem Bild – dunkel, ein feiner Rand, die Überschrift wie „Living World“. */
  private sheet(w: number, h: number, head: string) {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    const x = (W - w) / 2, y = (H - h) / 2;
    const shade = this.add.rectangle(0, 0, W, H, 0x010304, 0.72).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x05090a, 0.95);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0xc8913c, 0.35);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
    g.lineStyle(1, 0xc8913c, 0.55);
    g.lineBetween(W / 2 - 54, y + 70, W / 2 + 54, y + 70);
    const t = this.add.text(W / 2, y + 44, head, { fontFamily: TITLE_FONT, fontSize: '18px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(10);
    c.add([shade, g, t]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 220 });
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
    return { c, x, y, shade };
  }

  private confirm(msg: string, yes: () => void) {
    const { c, y } = this.sheet(620, 290, 'NEUES LEBEN');
    c.add(text(this, W / 2, y + 128, msg, 22, UI.bone, { align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    const opts: [string, () => void][] = [['Abbrechen', () => this.closeOverlay()], ['Neu beginnen', () => yes()]];
    const items = opts.map(([label, fn], i) => {
      const it = new MenuItem(this, W / 2 - 230 + i * 250, y + 222, label, fn, () => this.overlayNav?.focus(i));
      it.zone.setDepth(101);
      c.add(it);
      return it;
    });
    this.overlayNav = new MenuNav(this, items);
  }

  private showHelp() {
    const { c, y, shade } = this.sheet(900, 560, 'STEUERUNG');
    shade.on('pointerdown', () => this.closeOverlay());
    controlsList(this, c, W / 2 + 10, y + 100, 20, 34);
    c.add(text(this, W / 2, y + 522, 'Auf dem Handy erscheinen Knöpfe auf dem Bildschirm  ·  Esc: zurück', 15, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
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
