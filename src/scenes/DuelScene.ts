import Phaser from 'phaser';
import { DEPTH, H, LEVEL_ZOOM, TILE, UI, W } from '../config';
import { audio } from '../audio/Audio';
import type { Morph } from '../art/creatureArt';
import { caveBack, caveShade, terrainArt } from '../art/terrainArt';
import { coverTextures, levelBackgrounds, roeKey, roeTextures } from '../art/worldArt';
import { caveRock, groundAt, rockBottom, rockPoly, type RockSpec, type TerrainZone } from '../level/terrain';
import { CreatureView } from '../objects/CreatureView';
import { Controls } from '../objects/Controls';
import { Player, type FishSource, type PlayerHost } from '../objects/Player';
import type { Duel } from '../net/NetClient';
import { serverUrl } from '../net/NetSync';
import { ANIM, SEND_HZ, type DuelHatchMsg, type DuelHurtMsg, type DuelPosMsg } from '../net/protocol';
import { RemoteFish, type FishRow } from '../net/RemoteFish';
import type { DuelFish } from '../net/schema';
import { ARENA, BEATS, DUEL, duelReward, duelStart, ELEM_COLOR, ELEM_NAME, ELEMS, flowAt, type Elem } from '../sim/duel';
import { ADULT } from '../sim/life';
import { game, ZERO_TRAITS, type Traits } from '../state/GameState';
import { keyLabel } from '../state/keymap';
import { touchButton } from '../ui/touchPad';
import { touch } from '../objects/Controls';
import { fadeIn, fadeTo, text, title } from '../ui/ui';
import { mix } from '../util/color';
import { clamp, mulberry32, overlaps, type Rect } from '../util/math';

/** Was das Laichduell beim Start braucht (vom Ort, siehe LevelScene.startDuel). */
export interface DuelData {
  epoch: number;
  place: string;
  room: string;
  ticket: string;
  side: number;
  foe: string;
}

const Z = LEVEL_ZOOM;
const VW = W / Z, VH = H / Z, VX = (W - VW) / 2, VY = (H - VH) / 2;

/** Wie die Fische aussehen: der Urfisch – und ein wenig verändert, so wie ihr Gebiet (Stein, Wasser, Pflanze). */
const LOOK: Record<Elem, Partial<Traits>> = {
  base: {},
  // sandig-grau, gedrungen, mit festeren Schuppen und einem harten Kopf
  stone: { sand: 0.9, armor: 0.45, light: -0.3, girth: 0.3, spike: -0.4, skull: 0.15 },
  // blau wie das freie Wasser, schlank, mit langen Flossen
  water: { vf: 3, light: 0.5, swift: 0.6, fin: 0.5, tail: 0.5, len: 0.3 },
  // grün mit Querbinden wie ein Barsch, mit hoher Rückenflosse
  plant: { coat: 1, green: 0.9, fin: 0.4, crest: 0.6 },
};

const looks = new Map<Elem, string>();

/** Der Wasserfisch bekommt zusätzlich einen blauen Schimmer (über die Färbung der Figur gelegt). */
const shadeOf = (e: Elem) => (e === 'water' ? 0xa8d4ff : null);

function duelMorph(e: Elem): Morph {
  return game.morph({ cls: 'fish', traits: { ...ZERO_TRAITS, ...LOOK[e] } as Traits, fierce: 0, belly: 1, hue: e === 'water' ? 1 : 0, seed: 11, sex: 1 });
}

/** Ein Fisch im Duell: die Werte des Urfischs (Lebenskraft DUEL.hp, Schaden rechnet der Server), das Aussehen nach dem Element. */
function sourceOf(e: Elem): FishSource {
  const traits = { ...ZERO_TRAITS, ...LOOK[e] } as Traits;
  const base = { ...ZERO_TRAITS } as Traits;
  return {
    stats: () => ({ ...game.stats('fish', base, ADULT, false), maxHp: DUEL.hp, defense: 1 }),
    morph: () => duelMorph(e),
    traits,
    staminaMax: 1,
    canRam: false,
  };
}

/** der helle Laich im Becken (ROE_TONES: der letzte, fast farblose) */
const EGG_TONE = 4;

const asElem = (s: string): Elem => (s === 'stone' || s === 'water' || s === 'plant' ? s : 'base');

/**
 * Das Laichduell (Regeln: sim/duel.ts, gerechnet auf dem Server: server/DuelRoom.ts). Das Becken ist ein Bildschirm groß:
 * links Fels mit einer Höhle, in der Mitte freies Wasser, rechts Pflanzen; oben zieht eine Strömung nach rechts, unten eine nach
 * links. Beißen mit der Biss-Taste, laichen mit der Aktionstaste (F). Danach geht es zurück in die Höhle im Laichfluss –
 * mit etwas Nahrung für den Nachwuchs (Sieger 25 %, Verlierer 10 % dessen, was ein Nachkomme braucht).
 */
export class DuelScene extends Phaser.Scene implements PlayerHost {
  surfaceY = ARENA.surface;
  amphibious = false;
  private d!: DuelData;
  private duel?: Duel;
  private player!: Player;
  private gen = 1;
  private foe?: RemoteFish;
  private controls!: Controls;
  private eggs = new Map<string, { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; tint: number }>();
  private bars!: Phaser.GameObjects.Graphics;
  private hud!: { top: Phaser.GameObjects.Text; big: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; me: Phaser.GameObjects.Text; foe: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text };
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sway: { o: Phaser.GameObjects.Image; amp: number; sp: number; ph: number }[] = [];
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private keys: string[] = [];
  private sendAt = 0;
  private phase = 'join';
  private shownCount = -1;
  /** das Duell ist vorbei: Ergebnis (null: abgebrochen), seit wann, und ob die Nahrung schon gutgeschrieben ist */
  private result?: { won: boolean | null; at: number; food: number };
  private leaving = false;
  private lostAt = 0;
  private escAt = -1e9;
  private t = 0;

  constructor() {
    super('Duel');
  }

  init(d: DuelData) {
    this.d = d;
    this.duel = undefined;
    this.foe = undefined;
    this.gen = 1;
    this.eggs = new Map();
    this.sway = [];
    this.caustics = [];
    this.keys = [];
    this.sendAt = 0;
    this.phase = 'join';
    this.shownCount = -1;
    this.result = undefined;
    this.leaving = false;
    this.lostAt = 0;
    this.escAt = -1e9;
    this.t = 0;
  }

  create() {
    fadeIn(this, 700);
    const A = ARENA;
    const world = this.physics.world;
    world.gravity.y = 0;
    world.setBounds(0, A.surface, A.w, A.floor - A.surface);
    world.setBoundsCollision(true, true, true, true);
    world.OVERLAP_BIAS = 22;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#020304');
    cam.setZoom(Z);
    cam.centerOn(A.w / 2, A.h / 2);
    this.buildArena();
    roeTextures(this);
    this.puffer = this.add.particles(0, 0, 'p_bubble', {
      speed: { min: 20, max: 80 }, lifespan: 1300, scale: { start: 0.8, end: 0.1 }, alpha: { start: 0.6, end: 0 }, gravityY: -60, emitting: false,
    }).setDepth(DEPTH.fx);
    this.blood = this.add.particles(0, 0, 'p_blood', {
      speed: { min: 40, max: 160 }, lifespan: 700, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 }, gravityY: 30, emitting: false,
    }).setDepth(DEPTH.fx);
    this.sparkle = this.add.particles(0, 0, 'p_dot', {
      speed: { min: 10, max: 50 }, lifespan: 1400, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, gravityY: -30,
      tint: [0xffd890, 0xfff0c8], emitting: false, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.fx);
    const at = duelStart(this.d.side);
    this.player = new Player(this, at.x, at.y, true, sourceOf('base'));
    this.player.facing = this.d.side ? -1 : 1;
    this.controls = new Controls(this);
    this.bars = this.add.graphics().setDepth(DEPTH.text - 2);
    this.buildHud();
    // am Handy und Tablet: Bildschirm-Knöpfe (eine eigene Ebene ohne Zoom)
    if (this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch')) {
      this.scene.launch('DuelPad');
      this.hud.hint.setText('Biss · Laichen (kostet die Hälfte der Lebenskraft) · Aufgeben: zweimal antippen');
    }
    this.events.on('player-dead', () => {
      if (this.duel?.state.eggs.has(this.duel.me)) this.notice('Dein Fisch ist tot', 'Gleich schlüpft dein Laich – dann geht es weiter.');
    });
    // Esc: zweimal kurz hintereinander gibt auf
    const onEsc = () => this.giveUp();
    this.input.keyboard?.on('keydown-ESC', onEsc);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC', onEsc);
      this.scene.stop('DuelPad');
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
      this.events.off('player-dead');
      this.duel?.leave();
      this.duel = undefined;
      this.foe?.destroy();
      for (const k of this.keys) if (this.textures.exists(k)) this.textures.remove(k);
    });
    audio.sfx('portal');
    void this.connect();
  }

  /** Aufgeben (Esc bzw. der Knopf am Handy): erst fragen, beim zweiten Mal kurz danach gilt es – der andere gewinnt. */
  giveUp() {
    if (this.result || this.leaving) return this.back();
    const now = this.time.now;
    if (now - this.escAt < 2000) {
      this.duel?.forfeit();
      if (this.phase === 'join' || this.phase === 'wait') this.finish(null);
    } else this.notice('Aufgeben?', 'Noch einmal – dann hast du verloren.');
    this.escAt = now;
  }

  // ---------------------------------------------------------------- das Becken

  /**
   * Das Becken: links Fels (mit einer dunklen Höhle), in der Mitte freies Wasser über Sand, rechts dichter Bewuchs – alles
   * hinter den Fischen, nur Kulisse. Oben fällt Licht herein, zwei Strömungen zeigen sich als helle Schlieren.
   */
  private buildArena() {
    const A = ARENA;
    const r = mulberry32(4711);
    const [far, mid, fog] = levelBackgrounds(this, 'ozean', 'normal', true);
    this.add.tileSprite(VX, VY, VW, VH, far).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg).setTileScale(1 / Z);
    this.add.tileSprite(VX, VY, VW, VH, mid).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1).setTileScale(1 / Z);
    this.add.tileSprite(VX, VY + VH * 0.35, VW, VH * 0.65, fog).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 2).setAlpha(0.3).setTileScale(1 / Z);
    // der Grund: Fels links, Sand in der Mitte, Schlamm unter den Pflanzen
    const cols = Math.ceil(A.w / TILE) + 2;
    const hp = Array.from({ length: cols * 2 }, (_, i) => A.floor + 8 + 5 * Math.sin(i * 0.37) + 3 * Math.sin(i * 0.13 + 1));
    const zones: TerrainZone[] = [
      { x0: 0, x1: A.w / 3, kind: 'rock' },
      { x0: A.w / 3, x1: (A.w * 2) / 3, kind: 'sand' },
      { x0: (A.w * 2) / 3, x1: A.w + 200, kind: 'mud' },
    ];
    const rocks: RockSpec[] = [];
    // links: ein Felsmassiv mit einer Höhle, davor Brocken und Kiesel
    const cave = caveRock(40, 330, A.floor + 8, 190, 40, 250, 70, 1, 4242);
    rocks.push(cave.rock);
    const boulder = (x: number, rx: number, ry: number, tone: number, sink: number) => {
      const seed = Math.floor(r() * 1e9);
      rocks.push({ x, y: groundAt(hp, x) + sink - rockBottom(rockPoly(seed, rx, ry)), rx, ry, seed, tone, form: 'boulder' });
    };
    boulder(470, 74, 58, 2, 10);
    boulder(560, 44, 34, 1, 8);
    boulder(395, 36, 26, 1, 6);
    boulder(520, 96, 150, 1, 14);
    boulder(-20, 90, 220, 2, 10);
    for (let i = 0; i < 14; i++) boulder(20 + r() * (A.w / 3 + 60), 6 + r() * 10, 5 + r() * 6, r() < 0.5 ? 1 : 2, 4);
    for (let i = 0; i < 6; i++) boulder(A.w / 3 + r() * (A.w / 3), 5 + r() * 7, 4 + r() * 4, 0, 3);
    const art = terrainArt(this, { width: A.w, terrain: { hp, zones }, mats: [{ x0: A.w * 0.7, x1: A.w * 0.95, tone: 0, seed: 77 }], rocks, fore: [] }, 'ozean', 0);
    this.keys.push(...art.keys);
    for (const c of art.chunks) {
      this.add.image(c.x, c.y, c.key).setOrigin(0).setDisplaySize(c.w, c.h).setDepth(DEPTH.terrain);
      this.add.rectangle(c.x, c.deepY - 1, c.w, A.h + 200 - c.deepY, art.deep).setOrigin(0).setDepth(DEPTH.terrain - 0.1);
    }
    for (const k of art.rocks) this.add.image(k.x, k.y, k.key).setOrigin(0).setDisplaySize(k.w, k.h).setDepth(DEPTH.terrain + 0.5);
    // die Höhle: dunkle Rückwand und der Schatten darin
    const bk = caveBack(this, cave.hollow, this.keys);
    this.add.image(bk.x, bk.y, bk.key).setOrigin(0).setDisplaySize(bk.w, bk.h).setDepth(DEPTH.decoBack + 3);
    const sh = caveShade(this, cave.hollow, 1, this.keys);
    this.add.image(sh.x, sh.y, sh.key).setOrigin(0).setDisplaySize(sh.w, sh.h).setDepth(DEPTH.terrain + 0.6);
    // rechts: dichter Bewuchs – Büsche, Tang und Seegras, die sich wiegen
    const bushes = coverTextures(this, 'ozean');
    const plant = (key: string, x: number, sc: number, depth: number, tint: number, alpha = 1) => {
      if (!this.textures.exists(key)) return;
      const img = this.add.image(x, groundAt(hp, x) + 6, key).setOrigin(0.5, 1).setScale(sc).setDepth(depth).setTint(tint).setAlpha(alpha).setFlipX(r() < 0.5);
      this.sway.push({ o: img, amp: 3 + r() * 4, sp: 0.5 + r() * 0.9, ph: r() * 6 });
    };
    for (let x = A.w * 0.69; x < A.w + 40; x += 70 + r() * 70) plant(bushes[Math.floor(r() * bushes.length)], x, 1.1 + r() * 0.7, DEPTH.decoBack + 2, mix(0xffffff, 0x9fe08a, 0.25));
    for (let x = A.w * 0.68; x < A.w + 20; x += 26 + r() * 30) {
      plant('d2_' + ['kelp', 'seagrass', 'seaweed', 'seafan', 'anemone', 'kelp'][Math.floor(r() * 6)], x, 0.9 + r() * 0.9, DEPTH.terrain + 0.4 + r() * 0.2, 0xe6ffe0);
    }
    // ferne, dunkle Tangschatten dahinter
    for (let x = A.w * 0.62; x < A.w + 60; x += 60 + r() * 60) plant('d2_kelp', x, 1.8 + r() * 1.2, DEPTH.decoBack - 4, 0x1e3a36, 0.8);
    // ein wenig Seegras auch im Sand
    for (let i = 0; i < 6; i++) plant('d2_seagrass', A.w / 3 + 60 + r() * (A.w / 3 - 120), 0.6 + r() * 0.4, DEPTH.terrain + 0.4, 0xffffff);
    // Licht von oben (in der Mitte am meisten), Lichtnetz unter der Oberfläche, die Oberfläche selbst
    for (const [key, a, v, sc] of [['caustics', 0.3, 9, 1], ['caustics2', 0.22, -6, 1.37]] as const) {
      const s = this.add.tileSprite(0, A.surface - 4, A.w, 194, key).setOrigin(0).setDepth(DEPTH.decoBack - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(a).setTileScale(sc, sc);
      this.caustics.push({ s, v });
    }
    for (let x = A.w * 0.3; x < A.w * 0.75; x += 120 + r() * 140) {
      const base = 0.14 + r() * 0.2;
      const ray = this.add.image(x, A.surface - 30, 'lightray').setOrigin(0.5, 0).setDepth(DEPTH.decoBack).setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(base).setScale(0.6 + r() * 1.1, 0.6 + r() * 0.3).setAngle(-14 + r() * 10);
      this.tweens.add({ targets: ray, angle: ray.angle + 4, alpha: base * 0.45, yoyo: true, repeat: -1, duration: 3000 + r() * 4000, ease: 'Sine.inOut' });
    }
    this.add.tileSprite(0, A.surface - 8, A.w, 218, 'surface_light').setOrigin(0).setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setTileScale(1, 0.62);
    const surf = this.add.tileSprite(0, A.surface - 14, A.w, 30, 'surface').setOrigin(0).setDepth(DEPTH.decoFront);
    this.tweens.add({ targets: surf, tilePositionX: 160, repeat: -1, duration: 5000 });
    // die Gebiete leise gefärbt: links kühles Grau, rechts ein grüner Schimmer
    this.add.image(A.w * 0.12, A.floor - 160, 'glow').setDisplaySize(A.w * 0.5, 620).setTint(0x8a8478).setAlpha(0.12).setDepth(DEPTH.decoBack + 1);
    this.add.image(A.w * 0.88, A.floor - 160, 'glow').setDisplaySize(A.w * 0.5, 620).setTint(0x6fc060).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.decoBack + 1);
    // die Strömungen: ein heller Schleier im Band und Schlieren, die in seine Richtung ziehen
    for (const c of A.currents) {
      const band = this.add.image(A.w / 2, (c.y0 + c.y1) / 2, 'glow').setDisplaySize(A.w * 1.3, (c.y1 - c.y0) * 1.5).setTint(0xcfeee8)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.07).setDepth(DEPTH.decoBack + 1);
      this.tweens.add({ targets: band, alpha: 0.12, yoyo: true, repeat: -1, duration: 2600, ease: 'Sine.inOut' });
      this.add.particles(0, 0, 'p_dot', {
        x: { min: -100, max: A.w + 100 }, y: { min: c.y0 + 6, max: c.y1 - 6 }, speedX: { min: c.dir * 170, max: c.dir * 260 }, speedY: { min: -5, max: 5 },
        lifespan: { min: 1200, max: 2200 }, frequency: 22, quantity: 1, scaleX: { start: 4.4, end: 1 }, scaleY: 0.26, alpha: { start: 0.42, end: 0 },
        tint: 0xe0f6f0, blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.decoBack + 2);
    }
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(VW, VH).setDepth(DEPTH.dark + 1).setAlpha(0.32);
    this.add.rectangle(VX, VY, VW, VH, 0x7fd6e6, 0.06).setOrigin(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.decoFront + 1.5);
  }

  /** Ein Punkt auf dem Bildschirm (sx, sy) – als Lage für ein Objekt ohne Kamerabewegung (die Kamera ist herausgezoomt). */
  private screen(sx: number, sy: number) {
    return { x: W / 2 + (sx - W / 2) / Z, y: H / 2 + (sy - H / 2) / Z };
  }

  private buildHud() {
    const put = (sx: number, sy: number, o: Phaser.GameObjects.Text, ox: number, oy: number) => {
      const p = this.screen(sx, sy);
      return o.setPosition(p.x, p.y).setOrigin(ox, oy).setScrollFactor(0).setScale(1 / Z).setDepth(DEPTH.text + 2);
    };
    const opts = { stroke: '#050403', strokeThickness: 4 };
    this.hud = {
      top: put(W / 2, 14, title(this, 0, 0, 'LAICHDUELL', 22, UI.ochre), 0.5, 0),
      big: put(W / 2, H * 0.4, title(this, 0, 0, '', 64), 0.5, 0.5),
      sub: put(W / 2, H * 0.4 + 52, text(this, 0, 0, '', 22, UI.bone, { ...opts, align: 'center' }), 0.5, 0),
      me: put(22, 16, text(this, 0, 0, '', 19, UI.bone, opts), 0, 0),
      foe: put(W - 22, 16, text(this, 0, 0, '', 19, UI.bone, { ...opts, align: 'right' }), 1, 0),
      hint: put(W / 2, H - 14, text(this, 0, 0, '', 16, UI.boneDim, opts), 0.5, 1),
    };
    this.hud.hint.setText(`${keyLabel('bite')} beißen · ${keyLabel('talk')} laichen (kostet die Hälfte der Lebenskraft) · ${keyLabel('sprint')} spurten · Esc zweimal: aufgeben`);
  }

  /** Eine kurze Meldung in der Mitte. */
  private notice(head: string, sub: string) {
    if (this.result) return;
    this.hud.big.setText(head).setFontSize(40).setAlpha(1);
    this.hud.sub.setText(sub).setAlpha(1);
    this.tweens.killTweensOf([this.hud.big, this.hud.sub]);
    this.tweens.add({ targets: [this.hud.big, this.hud.sub], alpha: 0, delay: 1800, duration: 700 });
  }

  // ---------------------------------------------------------------- Verbindung

  private async connect() {
    try {
      const { joinDuel } = await import('../net/NetClient');
      const duel = await joinDuel(serverUrl(), this.d.room, this.d.ticket, {
        hurt: (m) => this.onHurt(m),
        hatch: (m) => this.onHatch(m),
        snap: (m) => !this.player.dead && this.player.body.reset(m.x, m.y),
        closed: () => {
          if (!this.result) this.lost();
        },
      });
      if (!this.scene.isActive()) return duel.leave();
      this.duel = duel;
    } catch (e) {
      console.warn('[EVO] Das Becken des Laichduells ist nicht erreichbar.', e);
      this.lost();
    }
  }

  /** Die Verbindung ist fort (oder kam nie zustande): zurück, ohne Ergebnis. */
  private lost() {
    if (this.result || this.lostAt) return;
    this.lostAt = this.time.now;
    this.finish(null, 'Die Verbindung zum Becken ist abgerissen.');
  }

  private onHurt(m: DuelHurtMsg) {
    const me = this.duel?.me;
    const p = this.player;
    if (m.to === me) {
      // der Server hat den Treffer gezählt: genau so viel Lebenskraft ist übrig
      if (!p.dead) {
        p.hp = m.hp + m.dmg;
        p.hurt(m.dmg, m.x, this.d.foe, undefined, true);
        p.hp = m.hp;
      }
      this.floatNum(p.x, p.y - 40, m.dmg, true);
    } else if (this.foe) {
      this.blood.explode(8, this.foe.x, this.foe.y);
      this.puffer.explode(4, this.foe.x, this.foe.y);
      this.foe.view.flash(0xff5040);
      this.time.delayedCall(140, () => this.foe?.view.flash(null));
      this.floatNum(this.foe.x, this.foe.y - 40, m.dmg, false);
      audio.sfx('hit');
    }
  }

  /** Ein neuer Fisch ist geschlüpft: der eigene (das alte Tier stirbt, man spielt den neuen) oder der des Gegners. */
  private onHatch(m: DuelHatchMsg) {
    const elem = asElem(m.elem);
    this.puffer.explode(14, m.x, m.y);
    this.sparkle.explode(10, m.x, m.y - 10);
    audio.sfx('laich');
    if (m.owner !== this.duel?.me) {
      if (this.foe) this.ghost(this.foe.view, this.foe.x, this.foe.y);
      return;
    }
    const old = this.player;
    this.ghost(old.view, old.x, old.y);
    this.tweens.killTweensOf(old.view);
    old.destroy();
    this.gen = m.gen;
    this.player = new Player(this, m.x, m.y, true, sourceOf(elem));
    this.player.facing = m.x < ARENA.w / 2 ? 1 : -1;
    this.player.view.setShade(shadeOf(elem));
    const strong = BEATS[elem], weak = ELEMS.find((k) => BEATS[k] === elem);
    this.notice(ELEM_NAME[elem].toUpperCase(), strong && weak ? `stark gegen ${ELEM_NAME[strong]} · schwach gegen ${ELEM_NAME[weak]}` : '');
  }

  /** Das alte Tier stirbt: Es dreht sich und verblasst. */
  private ghost(v: CreatureView, x: number, y: number) {
    const g = new CreatureView(this, x, y, { ...v.m }).setDepth(DEPTH.enemies).setFacing(v.dir).setAlpha(0.8);
    g.animate(0, 'idle', 0);
    this.tweens.add({ targets: g, angle: v.dir * 180, alpha: 0, y: y + 30, duration: 1400, ease: 'Sine.in', onComplete: () => g.destroy() });
  }

  private floatNum(x: number, y: number, n: number, mine: boolean) {
    const t = text(this, x, y, `−${n}`, 26, mine ? '#ff8a70' : '#f0e0b0', { stroke: '#050403', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.text);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 900, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- PlayerHost

  /** Der eigene Biss: Trifft er den Gegner (so, wie man ihn sieht), meldet man es – den Schaden rechnet der Server. */
  playerBite(rect: Rect) {
    const f = this.foe, st = this.duel?.state;
    if (!f || !st || this.phase !== 'play' || f.dead || !f.view.L) return;
    const L = f.view.L, hh = (L.footY - L.topY) / 2;
    if (!overlaps(rect, { x: f.x - L.halfW, y: f.y - hh, w: L.halfW * 2, h: hh * 2 })) return;
    this.duel?.hit();
  }

  puff(x: number, y: number, n: number, tint?: number) {
    if (tint !== undefined) this.puffer.setParticleTint(tint);
    this.puffer.explode(n, x, y);
    if (tint !== undefined) this.puffer.setParticleTint(0xffffff);
  }

  bleed(x: number, y: number, n: number) {
    this.blood.explode(n, x, y);
  }

  solidAt(x: number, y: number) {
    return y >= ARENA.floor || x <= 0 || x >= ARENA.w;
  }

  // ---------------------------------------------------------------- Ablauf

  update(time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    const st = this.duel?.state;
    this.phase = st?.phase || (this.lostAt ? 'over' : 'join');
    const me = st && this.duel ? st.fish.get(this.duel.me) : undefined;
    const p = this.player;
    const play = this.phase === 'play' && !this.result && !this.leaving;
    if (play && !p.dead) this.controls.update();
    else this.controls.clear();
    p.update(time, dt, this.controls);
    if (play && !p.dead && this.controls.pressed.talk) this.lay();
    // die Strömung schiebt mit
    const flow = flowAt(p.y);
    if (flow && !p.dead) p.body.position.x += flow * DUEL.push * dt;
    // die Lebenskraft rechnet der Server
    if (me && !p.dead) {
      p.hp = me.hp;
      if (!me.alive) p.expire(`Im Laichduell von ${this.d.foe} besiegt`);
    }
    this.foeStep(st);
    this.eggStep(st, dt);
    this.drawBars();
    this.hudStep(st, me);
    this.send(time);
    for (const c of this.caustics) c.s.tilePositionX += dt * c.v;
    for (const w of this.sway) w.o.setAngle(Math.sin(this.t * w.sp + w.ph) * w.amp);
    if (this.phase === 'over' && st && !this.result) this.finish(st.winner ? st.winner === this.duel?.me : null);
    if (this.result && !this.leaving && time - this.result.at > 6500) this.back();
  }

  /** Laichen: nur, solange kein eigener Laich liegt. */
  private lay() {
    const d = this.duel;
    if (!d || d.state.eggs.has(d.me)) return;
    d.lay();
    const p = this.player;
    this.puffer.explode(10, p.x, p.y + 10);
    this.sparkle.explode(6, p.x, p.y + 6);
    audio.sfx('laich');
  }

  /** Der Gegner: wie ihn der Server meldet, geglättet (RemoteFish), mit dem Aussehen seines Elements. */
  private foeStep(st: Duel['state'] | undefined) {
    const id = st ? [...st.fish.keys()].find((k) => k !== this.duel?.me) : undefined;
    const f = id ? st!.fish.get(id) : undefined;
    const now = performance.now();
    if (f) {
      const row = this.row(f);
      if (!this.foe) this.foe = new RemoteFish(this, row, now);
      else this.foe.push(row, now);
      this.foe.view.setShade(shadeOf(asElem(f.elem)));
    }
    this.foe?.update(now, Math.min(0.05, this.game.loop.delta / 1000));
  }

  private row(f: DuelFish): FishRow {
    const e = asElem(f.elem);
    let look = looks.get(e);
    if (!look) looks.set(e, (look = JSON.stringify(duelMorph(e))));
    return { name: f.name, x: f.x, y: f.y, facing: f.facing, anim: f.alive ? f.anim : ANIM.dead, look, t: f.t, away: f.away };
  }

  /** Laich im Becken: treibt mit der Strömung, nimmt ein wenig die Farbe seines Gebiets an; ein Ring zeigt, wann er schlüpft. */
  private eggStep(st: Duel['state'] | undefined, dt: number) {
    const live = new Set<string>();
    for (const [id, e] of st?.eggs ?? []) {
      live.add(id);
      let s = this.eggs.get(id);
      if (!s) {
        const img = this.add.image(e.x, e.y, roeKey(EGG_TONE, 0)).setOrigin(0.5, 0.6).setDepth(DEPTH.enemies - 1).setScale(0.3);
        this.tweens.add({ targets: img, scale: 1.1, duration: 600, ease: 'Back.out' });
        const glow = this.add.image(e.x, e.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(110, 80).setAlpha(0.3).setDepth(DEPTH.enemies - 1.5);
        s = { img, glow, ring: this.add.graphics().setDepth(DEPTH.enemies - 0.5), tint: 0xffffff };
        this.eggs.set(id, s);
      }
      const k = Math.min(1, dt * 4);
      s.img.setPosition(s.img.x + (e.x - s.img.x) * k, s.img.y + (e.y - s.img.y) * k);
      s.glow.setPosition(s.img.x, s.img.y);
      // die Farbe des Gebiets – ein wenig, und erst nach und nach
      s.tint = mix(s.tint, mix(0xffffff, ELEM_COLOR[asElem(e.elem)], 0.6), Math.min(1, dt * 1.5));
      s.img.setTint(s.tint);
      s.glow.setTint(s.tint);
      const mine = id === this.duel?.me;
      const u = clamp(e.age / DUEL.hatch, 0, 1);
      s.ring.clear();
      s.ring.lineStyle(4, 0x000000, 0.35).strokeCircle(s.img.x, s.img.y - 4, 44);
      s.ring.lineStyle(3, mine ? 0xe0a848 : 0xd0d8e0, 0.9).beginPath();
      s.ring.arc(s.img.x, s.img.y - 4, 44, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2, false).strokePath();
    }
    for (const [id, s] of this.eggs) {
      if (live.has(id)) continue;
      s.img.destroy();
      s.glow.destroy();
      s.ring.destroy();
      this.eggs.delete(id);
    }
  }

  /** Über jedem Fisch ein kleiner Balken: Lebenskraft, umrandet in der Farbe seines Elements. */
  private drawBars() {
    const g = this.bars;
    g.clear();
    const st = this.duel?.state;
    if (!st || this.phase === 'join') return;
    const bar = (x: number, y: number, hp: number, max: number, e: Elem, mine: boolean) => {
      const w = 84, h = 9, u = clamp(hp / Math.max(1, max), 0, 1);
      g.fillStyle(0x000000, 0.55).fillRoundedRect(x - w / 2 - 3, y - 3, w + 6, h + 6, 4);
      g.fillStyle(mine ? 0xd8a048 : 0xb04030, 0.95).fillRect(x - w / 2, y, w * u, h);
      g.lineStyle(2, ELEM_COLOR[e], 0.95).strokeRoundedRect(x - w / 2 - 3, y - 3, w + 6, h + 6, 4);
    };
    for (const [id, f] of st.fish) {
      if (!f.alive) continue;
      const mine = id === this.duel?.me;
      const x = mine ? this.player.x : this.foe?.x ?? f.x, y = mine ? this.player.y : this.foe?.y ?? f.y;
      const top = (mine ? this.player.view.L?.topY : this.foe?.view.L?.topY) ?? -24;
      bar(x, y + top - (mine ? 34 : 60), f.hp, f.maxHp, asElem(f.elem), mine);
    }
  }

  private hudStep(st: Duel['state'] | undefined, me: DuelFish | undefined) {
    const h = this.hud;
    const foe = st ? [...st.fish.entries()].find(([k]) => k !== this.duel?.me)?.[1] : undefined;
    const line = (f: DuelFish | undefined, name: string, egg: { age: number } | undefined, mine: boolean) => {
      if (!f) return `${name}\n…`;
      const e = asElem(f.elem);
      const life = f.alive ? `${Math.ceil(f.hp)}/${f.maxHp} Lebenskraft` : 'tot';
      const lay = egg ? `Laich: noch ${Math.max(0, Math.ceil(DUEL.hatch - egg.age))} s` : mine && f.alive ? `${keyLabel('talk')}: laichen` : '';
      return `${name} · ${ELEM_NAME[e]}\n${life}${lay ? `\n${lay}` : ''}`;
    };
    const id = this.duel?.me ?? '';
    const foeId = st ? [...st.fish.keys()].find((k) => k !== id) ?? '' : '';
    h.me.setText(line(me, 'Du', st?.eggs.get(id), true));
    h.foe.setText(line(foe, this.d.foe, st?.eggs.get(foeId), false));
    if (this.result) return;
    if (this.phase === 'join' || this.phase === 'wait') {
      h.big.setText('').setAlpha(1);
      h.sub.setText(this.phase === 'join' ? 'Ins Becken …' : `Warte auf ${this.d.foe} … ${Math.ceil(st?.left ?? 0)}`).setAlpha(1);
    } else if (this.phase === 'count') {
      const n = Math.max(1, Math.ceil(st?.left ?? 0));
      if (n !== this.shownCount) {
        this.shownCount = n;
        h.big.setText(String(n)).setFontSize(64).setAlpha(1);
        h.sub.setText(`Stein schlägt Wasser · Wasser schlägt Pflanze · Pflanze schlägt Stein`).setAlpha(1);
        audio.sfx('click');
      }
    } else if (this.phase === 'play' && this.shownCount !== 0) {
      this.shownCount = 0;
      h.big.setText('LOS!').setFontSize(64).setAlpha(1);
      h.sub.setAlpha(0);
      this.tweens.add({ targets: h.big, alpha: 0, delay: 600, duration: 500 });
      audio.sfx('confirm');
    }
  }

  /** Die eigene Lage an den Server – so oft wie im Ort. */
  private send(time: number) {
    const d = this.duel, p = this.player;
    if (!d || p.dead || time < this.sendAt || this.result) return;
    this.sendAt = time + 1000 / SEND_HZ;
    const anim = p.isRamming ? ANIM.ram : time - p.bitAt < 260 ? ANIM.bite : p.speed01 > 1.2 ? ANIM.dash : p.speed01 > 0.08 ? ANIM.swim : ANIM.idle;
    const m: DuelPosMsg = { t: Math.round(performance.now()), x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, facing: p.facing, anim, size: p.stats.size, gen: this.gen };
    d.pos(m);
  }

  /** Das Duell ist vorbei: Sieg oder Niederlage – und die Nahrung für den Nachwuchs (won: null = abgebrochen). */
  private finish(won: boolean | null, why = '') {
    if (this.result) return;
    const food = won === null ? 0 : duelReward(game.broodBase, won);
    if (food > 0) {
      game.feed(food);
      game.save();
    }
    this.result = { won, at: this.time.now, food };
    const h = this.hud;
    this.tweens.killTweensOf([h.big, h.sub]);
    h.big.setText(won === null ? 'ABGEBROCHEN' : won ? 'SIEG' : 'NIEDERLAGE').setFontSize(64).setAlpha(1).setColor(won ? '#f0c060' : UI.bone);
    h.sub.setText(`${why || (won === null ? 'Das Laichduell hat nicht stattgefunden.' : won ? `${this.d.foe} ist besiegt.` : `${this.d.foe} hat gewonnen.`)}${food ? `\n+${food} Nahrung für deinen Nachwuchs` : ''}\n\nweiter mit einer Taste`).setAlpha(1);
    audio.sfx(won ? 'victory' : 'fail');
    if (won) this.sparkle.explode(30, this.player.x, this.player.y);
    // nach einem Augenblick geht es mit einer Taste (oder einem Tippen) weiter – sonst von selbst
    this.time.delayedCall(1500, () => {
      this.input.keyboard?.once('keydown', () => this.back());
      this.input.once('pointerdown', () => this.back());
    });
  }

  /** Zurück in die Höhle im Laichfluss – dort wartet das eigene Tier. */
  private back() {
    if (this.leaving) return;
    this.leaving = true;
    this.duel?.leave();
    fadeTo(this, 'Level', { epoch: this.d.epoch, place: this.d.place }, 700);
  }
}

/** Am Handy und Tablet: die Bildschirm-Knöpfe des Laichduells (über dem Becken, ohne Zoom). */
export class DuelPadScene extends Phaser.Scene {
  constructor() {
    super('DuelPad');
  }

  create() {
    this.input.addPointer(3);
    touchButton(this, 80, 610, 46, '◀', 'left');
    touchButton(this, 220, 610, 46, '▶', 'right');
    touchButton(this, 150, 540, 40, '▲', 'up');
    touchButton(this, 150, 680, 36, '▼', 'down');
    touchButton(this, 1190, 600, 60, 'Biss', 'bite', 0xc8473a);
    touchButton(this, 1070, 520, 44, 'Sprint', 'sprint', 0xc8913c);
    touchButton(this, 1066, 650, 46, 'Laichen', 'talk', 0xe0a848);
    // aufgeben: oben rechts, zweimal antippen
    const t = text(this, W - 20, 96, 'Aufgeben', 17, UI.boneDim, { stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0).setDepth(6);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', () => (this.scene.get('Duel') as DuelScene).giveUp());
  }
}
