import Phaser from 'phaser';
import { W, H, DEPTH, GRAVITY, DEBUG, TILE } from '../config';
import { audio } from '../audio/Audio';
import { bus, game, type Traits } from '../state/GameState';
import { EPOCHS, type EpochDef, type EventDef, type Theme } from '../data/epochs';
import { SPECIES, type SpeciesDef } from '../data/species';
import { generateLevel, type LevelData } from '../level/LevelGen';
import { caveShade, coverTextures, groundTextures, levelBackgrounds, plantTextures, THEME_TINT } from '../art/worldArt';
import { makeSpeciesTextures } from '../art/speciesArt';
import type { Morph } from '../art/creatureArt';
import { Controls } from '../objects/Controls';
import { Player, FULL } from '../objects/Player';
import { Animal } from '../objects/Animal';
import { Kin, type KinWorld } from '../objects/Kin';
import { Carcass, Plant } from '../objects/Food';
import { fadeIn, fadeTo } from '../ui/ui';
import { clamp, overlaps, pick, type Rect } from '../util/math';
import { reportError } from '../util/guard';

type PImg = Phaser.Physics.Arcade.Image;

const DUST: Record<Theme, number> = { ozean: 0xcfe0dc, sumpf: 0x5a4a32, reptil: 0x6a4a34, eis: 0xdfe6ec, eden: 0x6a5a3a };

/** Hunger pro Sekunde (Sättigung 0..100). */
const HUNGER_RATE = 0.55;

/** Daten für den Generationen-Bildschirm nach einem überlebten Zeitalter. */
export interface SurvivedData {
  epoch: number;
  before: Traits;
  traits: Traits;
  cls: Morph['cls'];
  look: { hue: number; seed: number; sex: number };
  kinAlive: number;
  kinLooks: Morph[];
  transition?: { from: Morph['cls']; to: Morph['cls'] };
  /** Merkmale nach den Jahrmillionen bis zum nächsten Zeitalter */
  drifted?: Traits;
  finished?: boolean;
  node: string;
}

/**
 * Ein Zeitalter. Die Uhr läuft von Beginn bis Ende des Zeitraums – wer bis dahin
 * überlebt, dessen Linie zieht weiter. Wie, ist egal: verstecken, kämpfen, teilen.
 * Wer stirbt, beendet das Spiel: Die Linie stirbt aus.
 */
export class LevelScene extends Phaser.Scene implements KinWorld {
  ep!: EpochDef;
  epochIdx = 0;
  L!: LevelData;
  player!: Player;
  water = false;
  surfaceY = 0;
  animals: Animal[] = [];
  plants: Plant[] = [];
  carcasses: Carcass[] = [];
  cover: Rect[] = [];
  ended = false;
  /** gelebte Sekunden in diesem Zeitalter */
  elapsed = 0;
  private controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private hazards: Rect[] = [];
  private lava: Phaser.GameObjects.TileSprite[] = [];
  private shots: PImg[] = [];
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private darkness?: Phaser.GameObjects.Image;
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ramHit = new Map<Animal, number>();
  private vitalsAt = 0;
  private clockAt = 0;
  private lookAt = 0;
  private hideTick = 0;
  private growlAt = 0;
  private wasInCover = false;
  private coverFront: Phaser.GameObjects.Image[][] = [];
  private curCover = -1;
  private timeline: { def: EventDef; done: boolean }[] = [];
  private kinDef!: SpeciesDef;
  private faunaCount = 0;
  private nextMigrate = 0;
  private bloomUntil = 0;
  private stormUntil = 0;
  private stormK = 0;
  private stormFx?: { veil: Phaser.GameObjects.Image; p: Phaser.GameObjects.Particles.ParticleEmitter };
  private quakeUntil = 0;
  private meteorUntil = 0;
  private skyFire?: Phaser.GameObjects.Rectangle;
  private nextRock = 0;
  private huntMusic = 0;
  private huntLost = 0;
  private announced = new Set<string>();
  private bloodClouds?: Phaser.GameObjects.Particles.ParticleEmitter;
  private caustics: { s: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private glints = new Map<object, Phaser.GameObjects.Image>();
  private leftNoted = false;
  /** Blutflecken am Boden – werden wiederverwendet statt immer neu erzeugt */
  private splats: Phaser.GameObjects.Image[] = [];
  /** zuletzt gekämpft (gebissen, gerammt, zusammengestoßen) */
  private fightAt = -1e9;
  /** frühestens dann das Aussehen wieder neu zeichnen */
  private redrawAt = 0;
  private dbg?: Phaser.GameObjects.Text;
  private t = 0;

  constructor() {
    super('Level');
  }

  init(d: { epoch?: number }) {
    this.epochIdx = d?.epoch ?? game.epochIndex;
    this.ep = EPOCHS[this.epochIdx];
    this.animals = [];
    this.plants = [];
    this.carcasses = [];
    this.cover = [];
    this.solidRects = [];
    this.platRects = [];
    this.hazards = [];
    this.lava = [];
    this.shots = [];
    this.ended = false;
    this.elapsed = 0;
    this.darkness = undefined;
    this.ramHit = new Map();
    this.dbg = undefined;
    this.t = 0;
    this.wasInCover = false;
    this.coverFront = [];
    this.curCover = -1;
    this.timeline = this.ep.events.map((def) => ({ def, done: false }));
    this.bloomUntil = this.stormUntil = this.quakeUntil = this.meteorUntil = 0;
    this.stormK = 0;
    this.stormFx = undefined;
    this.skyFire = undefined;
    this.huntMusic = this.huntLost = 0;
    this.announced = new Set();
    this.nextMigrate = 0;
    this.glints = new Map();
    this.leftNoted = false;
    this.bloodClouds = undefined;
    this.caustics = [];
    this.splats = [];
    this.fightAt = -1e9;
    this.redrawAt = 0;
  }

  create() {
    fadeIn(this, 900);
    game.beginEpoch();
    const ep = this.ep;
    const L = (this.L = generateLevel(ep, game.run?.id ?? 0));
    this.water = L.mode === 'water';
    this.surfaceY = L.surfaceY;
    this.cover = L.cover;
    const world = this.physics.world;
    world.gravity.y = this.water ? 0 : GRAVITY;
    if (this.water) world.setBounds(0, L.surfaceY, L.width, L.height - L.surfaceY);
    else world.setBounds(0, -600, L.width, L.height + 1200);
    world.setBoundsCollision(true, true, true, this.water);
    this.cameras.main.setBackgroundColor('#020304');

    // Hintergrund mit Nebel
    const [far, mid, fog] = levelBackgrounds(this, L.theme, L.variant);
    this.bgFar = this.add.tileSprite(0, 0, W, H, far).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg);
    this.bgMid = this.add.tileSprite(0, 0, W, H, mid).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1);
    this.fog = this.add.tileSprite(0, H * 0.35, W, H * 0.65, fog).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 2).setAlpha(0.35);

    // Gelände
    const gt = groundTextures(this, L.theme);
    this.solids = this.physics.add.staticGroup();
    for (const r of L.solids) this.addSolid(r, gt.gnd, gt.top);
    for (const r of L.platforms) this.addPlatform(r, gt.plat);
    for (const r of L.hazards) this.addHazard(r, gt.hz);
    for (const d of L.decor) {
      const key = 'd2_' + d.k;
      if (this.textures.exists(key)) this.add.image(d.x, d.y, key).setOrigin(0.5, d.hang ? 0 : 1).setDepth(DEPTH.decoBack);
    }
    if (this.water && L.surfaceY > 0) {
      const s = this.add.tileSprite(0, L.surfaceY - 14, L.width, 30, 'surface').setOrigin(0).setDepth(DEPTH.decoFront);
      this.tweens.add({ targets: s, tilePositionX: 160, repeat: -1, duration: 5000 });
    }
    plantTextures(this, L.theme);
    // Alle Tierarten dieses Zeitalters schon jetzt malen (auch die großen Durchzügler) –
    // sonst stockt das Spiel, wenn eines zum ersten Mal auftaucht.
    for (const [id] of ep.fauna) if (SPECIES[id]) makeSpeciesTextures(this, SPECIES[id]);
    for (const e of ep.events) if (e.species && SPECIES[e.species]) makeSpeciesTextures(this, SPECIES[e.species]);
    for (const p of L.plants) this.plants.push(new Plant(this, p.x, p.y, L.theme, 3, p.v));
    this.buildCover();
    this.buildCaves();
    // Artgenossen verstecken sich auch in Höhlen
    this.cover = [...L.cover, ...L.caves];
    if (this.water && L.surfaceY > 0) this.surfaceLight();

    // Spieler, Artgenossen, Tiere
    this.controls = new Controls(this);
    this.player = new Player(this, L.start.x, L.start.y, this.water);
    this.spawnKin();
    for (const s of L.spawns) this.spawnAnimal(s.id, s.x, s.y);
    this.faunaCount = L.spawns.length;

    // Kollisionen
    this.physics.add.collider(this.player.rect, this.solids);
    this.physics.add.collider(this.animals, this.solids, undefined, (a) => (a as Animal).def.habitat !== 'air');
    this.physics.add.collider(this.shots, this.solids, (s) => this.popShot(s as PImg), (s) => !(s as PImg).getData('wave'));

    // Effekte
    this.puffer = this.add.particles(0, 0, this.water ? 'p_bubble' : 'p_dot', {
      speed: { min: 20, max: 80 }, lifespan: this.water ? 1300 : 500, scale: { start: 0.8, end: 0.1 },
      alpha: { start: 0.6, end: 0 }, gravityY: this.water ? -60 : -20, tint: DUST[L.theme], emitting: false,
    }).setDepth(DEPTH.fx);
    this.blood = this.add.particles(0, 0, 'p_blood', {
      speed: { min: 40, max: 160 }, lifespan: 700, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 },
      gravityY: this.water ? 30 : 500, emitting: false,
    }).setDepth(DEPTH.fx);
    if (this.water) {
      this.bloodClouds = this.add.particles(0, 0, 'blood_cloud', {
        speed: { min: 4, max: 26 }, lifespan: 2600, scale: { start: 0.35, end: 1.6 }, alpha: { start: 0.75, end: 0 },
        gravityY: -4, emitting: false,
      }).setDepth(DEPTH.fx - 2);
    }
    this.sparkle = this.add.particles(0, 0, 'p_dot', {
      speed: { min: 10, max: 50 }, lifespan: 1400, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
      gravityY: -30, tint: [0xffd890, 0xfff0c8], emitting: false, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.fx);
    this.ambient();
    if (L.variant !== 'normal') {
      this.darkness = this.add.image(0, 0, 'darkness').setScale(L.variant === 'dark' ? 3.4 : 4.2).setDepth(DEPTH.dark);
    }
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(W, H).setDepth(DEPTH.dark + 1).setAlpha(0.55);

    // Kamera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width, L.height);
    cam.startFollow(this.player.rect, true, 0.1, 0.1);
    cam.setDeadzone(90, 70);

    this.scene.launch('Hud', { epoch: this.epochIdx });
    audio.music(ep.music);

    if (DEBUG) {
      this.dbg = this.add.text(12, H - 120, '', { fontFamily: 'monospace', fontSize: '13px', color: '#9f9', backgroundColor: 'rgba(0,0,0,.6)' })
        .setScrollFactor(0).setDepth(DEPTH.text + 10);
    }

    const onAbort = () => this.abort();
    bus.on('abortLevel', onAbort);
    this.events.on('player-dead', () => this.onDeath());
    this.events.once('shutdown', () => {
      bus.off('abortLevel', onAbort);
      this.events.off('player-dead');
    });
  }

  // ---------------------------------------------------------------- Aufbau

  private addSolid(r: Rect, gnd: string, top: string) {
    this.add.tileSprite(r.x, r.y, r.w, r.h, gnd).setOrigin(0).setDepth(DEPTH.terrain);
    if (r.y > 0) {
      for (const [x0, x1] of this.exposedTop(r)) this.add.tileSprite(x0 - 4, r.y - 10, x1 - x0 + 8, 30, top).setOrigin(0).setDepth(DEPTH.terrain + 1);
    } else this.add.rectangle(r.x, r.y + r.h - 8, r.w, 8, 0x000000, 0.4).setOrigin(0).setDepth(DEPTH.terrain + 1);
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setVisible(false);
    this.solids.add(rect);
    this.solidRects.push(r);
  }

  /** Die Abschnitte der Oberkante, auf denen kein anderer Fels liegt (dort wächst die Grasnarbe). */
  private exposedTop(r: Rect): [number, number][] {
    let segs: [number, number][] = [[r.x, r.x + r.w]];
    for (const s of this.L.solids) {
      if (s === r || s.y + s.h !== r.y || s.x >= r.x + r.w || s.x + s.w <= r.x) continue;
      const out: [number, number][] = [];
      for (const [a, b] of segs) {
        if (s.x > a) out.push([a, Math.min(b, s.x)]);
        if (s.x + s.w < b) out.push([Math.max(a, s.x + s.w), b]);
      }
      segs = out.filter(([a, b]) => b - a > 2);
    }
    return segs;
  }

  private addPlatform(r: Rect, plat: string) {
    this.add.tileSprite(r.x, r.y - 2, r.w, 22, plat).setOrigin(0).setDepth(DEPTH.terrain + 1);
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + 8, r.w, 16).setVisible(false);
    this.solids.add(rect);
    const b = rect.body as Phaser.Physics.Arcade.StaticBody;
    b.checkCollision.down = false;
    b.checkCollision.left = false;
    b.checkCollision.right = false;
    this.platRects.push({ x: r.x, y: r.y, w: r.w, h: 16 });
  }

  private addHazard(r: Rect, hz: string) {
    if (r.h > 40) {
      const t = this.add.tileSprite(r.x, r.y - 6, r.w, 46, hz).setOrigin(0).setDepth(DEPTH.terrain + 2);
      if (this.L.theme === 'reptil') this.lava.push(t);
    } else {
      const key = this.L.theme === 'reptil' ? 'spk2_reptil' : hz;
      this.add.tileSprite(r.x, r.y + r.h - 40, r.w, 40, key).setOrigin(0).setDepth(DEPTH.terrain + 2);
    }
    this.hazards.push(r);
  }

  /** Dickicht: einzelne Büsche – dahinter dunkler, davor halbtransparent. */
  private buildCover() {
    const bushes = coverTextures(this, this.L.theme);
    let bi = 0;
    for (const c of this.L.cover) {
      const front: Phaser.GameObjects.Image[] = [];
      this.coverFront.push(front);
      const n = Math.max(2, Math.round(c.w / 55));
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < n; i++) {
          const key = bushes[(bi++ * 7 + i) % bushes.length];
          const x = c.x + ((i + 0.5) / n) * c.w + ((bi * 37) % 17) - 8;
          const hgt = (c.h + 24 + ((bi * 53) % 30)) * (layer ? 1 : 1.08);
          const img = this.add.image(x + (layer ? 0 : 14), c.y + c.h + 4, key).setOrigin(0.5, 1);
          img.setScale((((c.w / n) * 1.9) / 150) * (layer ? 1 : 1.1), hgt / 210);
          if ((bi + i) % 2) img.setFlipX(true);
          if (layer === 0) img.setDepth(DEPTH.decoBack + 1).setTint(0x5a5a5a);
          else {
            img.setDepth(DEPTH.cover).setAlpha(0.82);
            front.push(img);
          }
          if (this.water) this.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, yoyo: true, repeat: -1, duration: 2200 + ((bi * 131) % 900), ease: 'Sine.inOut' });
        }
      }
    }
  }

  /** Höhlen: dunkle Rückwand, davor ein Schatten – drinnen sieht man nur noch die Augen. */
  private buildCaves() {
    this.L.caves.forEach((c, i) => {
      this.add.tileSprite(c.x - 4, c.y - 4, c.w + 8, c.h + 8, 'cave_back').setOrigin(0).setDepth(DEPTH.decoBack + 3);
      const sh = caveShade(this, c.w, c.h, TILE, i % 3, groundTextures(this, this.L.theme).gnd);
      this.add.image(c.x + sh.ox, c.y + sh.oy, sh.key).setOrigin(0).setDepth(DEPTH.cover);
    });
  }

  /** Licht von oben: Lichtbahnen, Kaustik und ein heller Schein unter der Oberfläche. */
  private surfaceLight() {
    const L = this.L;
    // etwas kürzer als die Textur – sonst schimmert unten deren helle Oberkante durch (Kachel-Wiederholung)
    this.add.tileSprite(0, L.surfaceY - 8, L.width, 352, 'surface_light').setOrigin(0).setDepth(DEPTH.fx + 1)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.42);
    for (const [key, a, v] of [['caustics', 0.34, 9], ['caustics2', 0.26, -6]] as const) {
      const s = this.add.tileSprite(0, L.surfaceY - 4, L.width, 194, key).setOrigin(0).setDepth(DEPTH.decoBack - 1)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(a);
      this.caustics.push({ s, v });
    }
    for (let x = 120; x < L.width; x += 260 + ((x * 37) % 220)) {
      const ray = this.add.image(x, L.surfaceY - 30, 'lightray').setOrigin(0.5, 0).setDepth(DEPTH.decoBack)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(0.8 + ((x * 13) % 7) / 10, 1.1);
      ray.setAngle(-14 + ((x * 7) % 9));
      this.tweens.add({ targets: ray, angle: ray.angle + 5, alpha: 0.12, yoyo: true, repeat: -1, duration: 4200 + ((x * 31) % 2500), ease: 'Sine.inOut' });
    }
  }

  /** Eine kleine Gruppe deiner eigenen Art – fast gleich, aber nicht ganz. */
  private spawnKin() {
    const st = game.stats();
    const d = game.traits.diet;
    const diet = d > 0.3 ? 'meat' : 'plant';
    this.kinDef = {
      id: 'kin', name: 'Artgenosse', art: { t: 'jelly', r: 1, c: 0 }, role: 'prey', diet,
      habitat: this.water ? 'water' : 'land',
      hp: Math.max(8, st.maxHp * 0.6), dmg: Math.max(1, st.bite * 0.6), power: st.power * 0.75,
      speed: st.speed * 0.95, sense: 280, meat: 2, sprint: 1.35,
    };
    const n = game.run?.kin ?? 4;
    const s = this.L.start;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = clamp(s.x + side * (46 + Math.floor(i / 2) * 40), 60, this.L.width - 60);
      const y = this.water ? s.y + ((i % 3) - 1) * 34 : s.y;
      const social = game.run?.social ?? 0.55;
      const k = new Kin(this, this.kinDef, x, y, game.kinMorph(i), i, social + (Math.random() - 0.5) * 0.12);
      k.omni = d >= -0.3 && d <= 0.3;
      k.dir = -side;
      this.animals.push(k);
    }
  }

  private ambient() {
    const t = this.L.theme;
    const base = { x: { min: 0, max: W }, lifespan: 9000, frequency: 170, quantity: 1 };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    let key = 'p_dot';
    if (t === 'ozean') {
      key = 'p_bubble';
      cfg = { ...base, y: H + 10, speedY: { min: -25, max: -60 }, speedX: { min: -8, max: 8 }, scale: { min: 0.3, max: 0.8 }, alpha: { start: 0.45, end: 0 } };
    } else if (t === 'eis') {
      key = 'p_snow';
      cfg = { ...base, y: -10, speedY: { min: 30, max: 80 }, speedX: { min: -40, max: 0 }, scale: { min: 0.3, max: 1 }, alpha: { start: 0.8, end: 0.2 }, frequency: 55 };
    } else {
      cfg = {
        ...base, y: { min: 0, max: H }, speedY: t === 'reptil' ? { min: -40, max: -10 } : { min: -10, max: 10 }, speedX: { min: -12, max: 12 },
        scale: { start: 0.4, end: 0.05 }, alpha: { start: 0, end: 0.7, ease: 'Sine.inOut' }, lifespan: 4500, frequency: 200, tint: THEME_TINT[t],
      };
    }
    this.add.particles(0, 0, key, cfg).setScrollFactor(0).setDepth(DEPTH.decoFront - 1);
  }

  // ---------------------------------------------------------------- Welt-Schnittstelle

  solidAt(x: number, y: number) {
    for (const r of this.solidRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    for (const r of this.platRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    return false;
  }

  spawnAnimal(id: string, x: number, y: number) {
    const def = SPECIES[id];
    makeSpeciesTextures(this, def);
    const a = new Animal(this, def, x, y);
    this.groundIt(a);
    this.animals.push(a);
    return a;
  }

  /** Landtiere mit den Füßen auf den Boden stellen (große Tiere steckten sonst im Fels). */
  private groundIt(a: Animal) {
    if (this.water || a.def.habitat === 'air') return;
    const L = this.L;
    let col = clamp(Math.floor(a.x / TILE), 0, L.ground.length - 1);
    for (let k = 1; k < 8 && L.ground[col] >= L.height; k++) {
      const c2 = clamp(col + (k % 2 ? k : -k), 0, L.ground.length - 1);
      if (L.ground[c2] < L.height) col = c2;
    }
    const gy = L.ground[col];
    if (gy >= L.height) return;
    a.b.reset((col + 0.5) * TILE, gy - a.displayHeight / 2 - 2);
  }

  shoot(x: number, y: number, vx: number, vy: number, tex: string, dmg: number, gravity: boolean) {
    const s = this.physics.add.image(x, y, tex).setDepth(DEPTH.fx - 1);
    s.setData('dmg', dmg);
    s.setData('wave', tex === 'pr_wave');
    s.setData('by', tex === 'pr_wave' ? 'Druckwelle' : tex === 'fireball' ? 'Feuerregen' : 'Steinschlag');
    s.setData('die', this.time.now + 4500);
    const b = s.body as Phaser.Physics.Arcade.Body;
    b.setAllowGravity(gravity && !this.water);
    b.setSize(s.width * 0.7, s.height * 0.7);
    b.setVelocity(vx, vy);
    if (tex === 'pr_wave') s.setFlipX(vx < 0);
    this.shots.push(s);
  }

  private popShot(s: PImg) {
    this.puff(s.x, s.y, 4);
    if (s.texture.key === 'fireball') this.cameras.main.shake(120, 0.004);
    s.destroy();
  }

  puff(x: number, y: number, n: number, tint?: number) {
    if (tint !== undefined) this.puffer.setParticleTint(tint);
    this.puffer.explode(n, x, y);
    if (tint !== undefined) this.puffer.setParticleTint(DUST[this.L.theme]);
  }

  bleed(x: number, y: number, n: number) {
    this.blood.explode(Math.round(n * 2), x, y);
    if (this.water) this.bloodClouds?.explode(Math.max(1, Math.round(n / 3)), x, y);
    else if (n >= 5) this.splat(x, y);
  }

  /** Ein Blutfleck auf dem Boden unter der Stelle (höchstens 24 – die ältesten werden wiederverwendet). */
  private splat(x: number, y: number) {
    let gy = y;
    for (let k = 0; k < 40 && !this.solidAt(x, gy + 4); k++) gy += 8;
    if (!this.solidAt(x, gy + 4)) return;
    let s: Phaser.GameObjects.Image;
    if (this.splats.length < 24) s = this.add.image(0, 0, 'blood_splat').setDepth(DEPTH.terrain + 3);
    else {
      s = this.splats.shift()!;
      this.tweens.killTweensOf(s);
    }
    this.splats.push(s);
    s.setPosition(x + (Math.random() - 0.5) * 20, gy + 2).setScale(0.6 + Math.random() * 0.7, 0.8).setAlpha(0.9);
    this.tweens.add({ targets: s, alpha: 0, delay: 30000, duration: 4000 });
  }

  detectFactor(a: Animal) {
    const p = this.player;
    const t = game.traits;
    let k = p.stats.detect;
    if (p.hidden && p.inCave) k *= 0.08;
    else if (p.hidden) k *= 0.2 * (1 - 0.5 * t.green);
    else if (p.inCover) k *= 0.5;
    else if (p.grounded) k *= 0.75 - 0.4 * t.sand;
    k *= 0.55 + 0.6 * Math.min(1, p.speed01);
    if (this.L.variant !== 'normal') k *= 0.7;
    if (this.stormK > 0) k *= 1 - 0.45 * this.stormK;
    if (!a.alerted && Math.sign(p.x - a.x) !== a.dir) k *= 0.6;
    return k;
  }

  playerThreat() {
    const p = this.player;
    let t = game.threat() * (0.6 + 0.4 * (p.hp / p.stats.maxHp));
    // Wer nicht allein ist, wirkt gefährlicher
    for (const a of this.animals) {
      if (a.dead || !(a.ally || a.kin)) continue;
      if (Math.abs(a.x - p.x) < 260 && Math.abs(a.y - p.y) < 200) t += a.def.power * (a.ally ? 0.5 : 0.15);
    }
    return t;
  }

  playerFear() {
    return game.fear();
  }

  playerEscaped(a: Animal) {
    if (this.ended || this.player.dead) return;
    // wer Jägern entkommt, wird vorsichtiger und unauffälliger
    game.grow('stealth', a.role === 'apex' ? 0.05 : 0.03);
  }

  bonded(a: Animal) {
    this.sparkle.explode(14, a.x, a.y - 10);
    audio.sfx('bond');
  }

  left(a: Animal) {
    this.removeAnimal(a);
  }

  kinSnubbed(k: Kin) {
    audio.sfx('snub');
    this.puff(k.x, k.y - 6, 3);
  }

  kinLeaving(k: Kin) {
    void k;
    if (!this.leftNoted) {
      this.leftNoted = true;
      bus.emit('story', 'Einige deiner Art ziehen allein weiter.');
    }
  }

  kinShared(k: Kin) {
    this.sparkle.explode(6, k.x, k.y - 8);
  }

  /** Die Gruppe hilft bei der Jagd auf das, was du angreifst. */
  private callHunt(a: Animal) {
    if (a.kin || a.ally || a.dead || a.role === 'hazard') return;
    const p = this.player;
    const now = this.time.now;
    const kin = this.animals.filter((k): k is Kin => k instanceof Kin && !k.dead);
    const groupPower = kin.reduce((sum, k) => sum + k.def.power, p.stats.power);
    for (const k of kin) {
      if (Math.hypot(k.x - p.x, k.y - p.y) > 460) continue;
      const brave = a.def.power <= groupPower * 1.2 || k.loyalty > 0.75;
      if (k.loyalty >= 0.3 && brave) k.joinHunt(a, now + 7000);
    }
  }

  /** Aus der Liste nehmen – ohne die Liste zu ersetzen (die Kollision hängt an genau diesem Array). */
  private removeAnimal(a: Animal) {
    const i = this.animals.indexOf(a);
    if (i >= 0) this.animals.splice(i, 1);
    this.ramHit.delete(a);
    const g = this.glints.get(a);
    if (g) {
      g.destroy();
      this.glints.delete(a);
    }
  }

  animalDied(a: Animal, byPlayer: boolean) {
    this.removeAnimal(a);
    this.bleed(a.x, a.y, 14);
    if (a.kin) {
      audio.sfx('squeal');
      if (byPlayer) game.addAggression(0.2);
      return;
    }
    let y = a.y;
    if (a.def.habitat === 'air' || this.water) {
      // Leiche sinkt zu Boden
      for (let k = 0; k < 80 && !this.solidAt(a.x, y + 6); k++) y += 8;
    } else y = a.b.bottom;
    // Beute, an der du beteiligt warst, gilt als deine – wer davon mitfrisst, teilt mit dir
    const ours = byPlayer || this.time.now - a.hitByPlayerAt < 8000;
    this.carcasses.push(new Carcass(this, a.x, y, a.def, this.water, this.time.now, a.dir, ours));
    if (byPlayer) {
      game.addAggression(a.role === 'prey' ? 0.1 : 0.06);
      this.player.view.showMeat(4500);
      audio.sfx('tear');
    }
    this.bleed(a.x, a.y, 10);
    if (a.visitor) {
      this.cameras.main.shake(600, 0.012);
      audio.sfx('boom');
    }
  }

  // ---------------------------------------------------------------- Spieler-Aktionen

  playerBite(rect: Rect) {
    const p = this.player;
    const st = p.stats;
    let hit = false;
    for (const a of [...this.animals]) {
      if (a.dead || !overlaps(rect, a.hitRect())) continue;
      hit = true;
      a.hurt(st.bite, p, 'bite');
      game.grow('jaw', 0.004);
      if (!a.dead) this.callHunt(a);
      if (a.role === 'hazard') p.hurt(a.def.dmg * 0.6, a.x, a.def.name);
      else game.addAggression(a.kin ? 0.08 : a.role === 'prey' ? 0.04 : 0.025);
    }
    if (hit) {
      this.fightAt = this.time.now;
      this.cameras.main.shake(70, 0.004);
      return;
    }
    for (const c of this.carcasses) {
      if (c.gone || c.units <= 0 || !overlaps(rect, c.rect)) continue;
      if (p.eat(24 * st.digestMeat)) {
        c.take();
        c.playerBites++;
        game.grow('jaw', 0.012);
        game.shiftDiet(0.05);
        game.grow('growth', 0.012 * st.digestMeat);
        this.puff(c.x, c.y - 10, 4, 0x6a1a10);
        this.bleed(c.x, c.y - 8, 3);
        p.view.showMeat(3000);
        audio.sfx('tear');
        // Wer warten musste und nichts bekam, wendet sich ab
        if (c.units <= 0) {
          for (const w of c.wanted) if (w instanceof Kin && !c.ateFrom.has(w)) w.snub(0.24);
        }
      }
      return;
    }
    for (const pl of this.plants) {
      if (pl.units <= 0 || !overlaps(rect, pl.rect)) continue;
      if (p.eat(15 * st.digestPlant)) {
        pl.take(this.time.now);
        if (pl.units <= 0) for (const w of pl.wanted) if (w instanceof Kin) w.snub(0.07);
        game.grow('stealth', 0.012);
        game.shiftDiet(-0.05);
        game.grow('growth', 0.007 * st.digestPlant);
        this.puff(pl.x, pl.y - 20, 4, 0x6a7a3a);
      }
      return;
    }
  }

  /**
   * Zusammenstoß: Wer in ein Tier hineinschwimmt oder -rennt, verletzt beide.
   * Wer dabei mehr austeilt, dessen Kopf wird stacheliger; wer mehr einsteckt, dessen Schädel härter.
   * Ein gezielter Rammstoß (erst mit hartem Kopf) trifft viel stärker und schont den eigenen Kopf.
   */
  private collide(a: Animal, approach: number, rammed: boolean) {
    const p = this.player;
    const st = p.stats;
    const t = game.traits;
    const sf = rammed ? 1.3 : clamp(approach, 0.5, 1.4);
    this.ramHit.set(a, this.time.now);
    this.fightAt = this.time.now;
    const dealt = st.ram * sf * (rammed ? 1.6 : 0.7);
    const plates = Math.max(0, -t.spike) * t.skull;
    const back = (a.def.power * 0.32 + a.def.dmg * 0.25) * sf * (rammed ? 0.45 : 1) * (1 - 0.65 * t.skull) * (1 - 0.5 * plates);
    a.hurt(dealt, p, 'ram');
    const k = clamp(a.def.power / (st.power + 1), 0, 1);
    p.recoil(a.x, back, rammed ? k * 0.6 : k);
    game.grow('skull', (rammed ? 0.02 : 0.012) * sf);
    game.shiftSpike(dealt > back * 1.2 ? 0.05 : -0.05);
    if (game.checkRamUnlock()) {
      bus.emit('ramUnlocked');
      game.save();
    }
    if (a.role !== 'hazard') game.addAggression(rammed ? 0.035 : 0.02);
    if (!a.dead) this.callHunt(a);
    audio.sfx('ram');
    this.cameras.main.shake(rammed ? 180 : 110, rammed ? 0.011 : 0.007);
    this.puff((a.x + p.x) / 2, p.y, 6);
    this.bleed((a.x + p.x) / 2, (a.y + p.y) / 2, rammed ? 8 : 4);
  }

  // ---------------------------------------------------------------- Ablauf

  update(time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    const L = this.L;
    const p = this.player;
    if (!this.ended) this.controls.update();
    else this.controls.clear();
    p.update(time, dt, this.controls);
    for (const a of [...this.animals]) {
      try {
        a.tick(time, dt);
      } catch (e) {
        // Ein Fehler im Verhalten eines Tieres darf nicht das ganze Spiel anhalten
        reportError('Tier ' + a.def.id, e);
        this.removeAnimal(a);
        a.vanish();
        continue;
      }
      if (!a.dead && a.y > L.height + 200) {
        // aus der Welt gefallen: als fort markieren, damit niemand mehr danach greift
        this.removeAnimal(a);
        a.vanish();
      }
    }
    const bloom = time < this.bloomUntil;
    for (const pl of this.plants) pl.update(time, bloom);
    for (const c of this.carcasses) c.update(time);
    this.carcasses = this.carcasses.filter((c) => !c.gone);

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.08;
    this.bgMid.tilePositionX = cam.scrollX * 0.28;
    this.fog.tilePositionX = cam.scrollX * 0.5 + this.t * 12;
    for (const t of this.lava) t.tilePositionX += dt * 25;
    for (const c of this.caustics) c.s.tilePositionX += dt * c.v;
    this.darkness?.setPosition(p.x, p.y);
    this.eyeGlints();

    if (!p.dead && !this.ended) {
      this.elapsed += dt;
      this.clock(time);
      this.interact(time, dt);
      this.weather(time, dt);
      this.migrate(time);
      this.huntMood(time);
      if (this.elapsed >= this.ep.seconds) this.complete();
    }

    // Geschosse (Druckwellen, Steinschlag, Feuerregen)
    for (const s of this.shots) {
      if (!s.active) continue;
      if (time > (s.getData('die') as number) || s.y > L.height + 100 || s.x < -50 || s.x > L.width + 50) {
        s.destroy();
        continue;
      }
      if (!p.dead && !this.ended && overlaps(p.hitRect(), { x: s.x - s.width * 0.3, y: s.y - s.height * 0.3, w: s.width * 0.6, h: s.height * 0.6 })) {
        p.hurt(s.getData('dmg') as number, s.x, s.getData('by') as string);
        if (!s.getData('wave')) this.popShot(s);
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (!this.shots[i].active) this.shots.splice(i, 1);

    if (this.dbg && time > this.lookAt - 300) {
      const t = game.traits;
      const kin = this.animals.filter((a) => a.kin).length;
      const allies = this.animals.filter((a) => a.ally).length;
      const vis = this.animals.filter((a) => a.visitor).length;
      this.dbg.setText(
        `LP ${p.hp.toFixed(0)}/${p.stats.maxHp}  Sätt ${p.satiety.toFixed(0)}  Ausd ${(p.stamina * 100).toFixed(0)}  Versteckt ${p.hidden}  Zeit ${this.elapsed.toFixed(0)}/${this.ep.seconds}\n` +
          `Kiefer ${t.jaw.toFixed(3)}  Schädel ${t.skull.toFixed(3)}  Tarnung ${t.stealth.toFixed(3)}  Wachstum ${t.growth.toFixed(3)}\n` +
          `Kost ${t.diet.toFixed(2)}  Narben ${t.scars}  Aggr ${game.run?.aggression.toFixed(2)}  Ruf ${game.run?.infamy.toFixed(2)}  Bedrohung ${this.playerThreat().toFixed(1)}\n` +
          `Biss ${p.stats.bite.toFixed(1)}  Ramme ${p.stats.ram.toFixed(1)}  Tempo ${p.stats.speed.toFixed(0)}  Tiere ${this.animals.length}  Artgenossen ${kin}  Verbündete ${allies}  Durchzügler ${vis}`,
      );
    }
  }

  /** In der Höhle sieht man von dir und deiner Art nur noch die Augen. */
  private eyeGlints() {
    if (!this.L.caves.length) return;
    // erst alle aus – so bleibt auch von Toten oder Fortgezogenen kein Leuchten zurück
    for (const g of this.glints.values()) g.setVisible(false);
    const inCave = (x: number, y: number) => this.L.caves.some((c) => x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h);
    const p = this.player;
    this.glint(p, p.view, !p.dead && p.inCave);
    for (const a of this.animals) if (a instanceof Kin) this.glint(a, a.view, !a.dead && inCave(a.x, a.y));
  }

  private glint(key: object, v: Player['view'], show: boolean) {
    if (!show) return;
    let g = this.glints.get(key);
    if (!g) {
      g = this.add.image(0, 0, 'eyeglint').setDepth(DEPTH.cover + 1).setBlendMode(Phaser.BlendModes.ADD).setData('ph', Math.random() * 4);
      this.glints.set(key, g);
    }
    const e = v.eyeWorld();
    // gelegentlich blinzeln
    const blink = (this.t + (g.getData('ph') as number)) % 4.3 < 0.12;
    const sc = Math.max(0.5, e.r / 5);
    g.setVisible(true).setPosition(e.x, e.y).setScale(sc, blink ? 0.08 : sc).setAlpha(0.9);
  }

  /** Die Uhr des Zeitalters – und was zu welcher Zeit geschieht. */
  private clock(time: number) {
    const ep = this.ep;
    const prog = clamp(this.elapsed / ep.seconds, 0, 1);
    for (const e of this.timeline) {
      if (!e.done && prog >= e.def.at) {
        e.done = true;
        this.trigger(e.def);
      }
    }
    if (time > this.clockAt) {
      this.clockAt = time + 100;
      const span = ep.from - ep.to;
      bus.emit('clock', ep.from - span * prog, prog, (span / ep.seconds) * 0.1);
    }
  }

  private trigger(ev: EventDef) {
    if (ev.line) bus.emit('story', ev.line);
    const now = this.time.now;
    switch (ev.kind) {
      case 'predator':
        this.spawnVisitors(ev.species!, ev.count ?? 1);
        break;
      case 'bloom':
        this.bloomUntil = now + 20000;
        for (const pl of this.plants) {
          pl.refill();
          this.sparkle.explode(4, pl.x, pl.y - 24);
        }
        break;
      case 'storm':
        this.stormUntil = now + (ev.dur ?? 18) * 1000;
        this.startStormFx();
        break;
      case 'quake':
        this.quakeUntil = now + (ev.dur ?? 6) * 1000;
        this.cameras.main.shake((ev.dur ?? 6) * 1000, 0.004);
        audio.sfx('rumble');
        break;
      case 'meteor':
        this.meteorUntil = now + (ev.dur ?? 20) * 1000;
        this.cameras.main.flash(900, 255, 160, 80);
        audio.sfx('boom');
        audio.sfx('rumble');
        this.skyFire = this.add.rectangle(0, 0, W, H, 0x8a1a06, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.dark - 1).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: this.skyFire, fillAlpha: 0.22, duration: 6000 });
        break;
    }
  }

  /** Große Räuber ziehen durch – von der Seite, die weiter weg ist, zur anderen. */
  private spawnVisitors(id: string, count: number) {
    const def = SPECIES[id];
    if (!def) return;
    makeSpeciesTextures(this, def);
    const L = this.L;
    const p = this.player;
    const fromLeft = p.x > L.width / 2;
    const dir = fromLeft ? 1 : -1;
    audio.sfx('rumble');
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 900, () => {
        if (this.ended) return;
        const x = fromLeft ? 50 + i * 20 : L.width - 50 - i * 20;
        const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
        const ground = L.ground[col] < L.height ? L.ground[col] : L.start.y + 60;
        let y: number;
        let cruiseY: number;
        if (this.water) {
          cruiseY = clamp(p.y + (Math.random() - 0.5) * 160 + i * 40, L.surfaceY + 90, ground - 90);
          y = cruiseY;
        } else if (def.habitat === 'air') {
          cruiseY = ground - 190 - Math.random() * 80;
          y = cruiseY;
        } else {
          y = ground - 90;
          cruiseY = y;
        }
        const a = new Animal(this, def, x, y);
        this.groundIt(a);
        a.visitor = { dir, endX: fromLeft ? L.width - 40 : 40, cruiseY, huntUntil: 0, boredUntil: 0 };
        a.dir = dir;
        a.setAlpha(0);
        this.tweens.add({ targets: a, alpha: 1, duration: 900 });
        this.animals.push(a);
      });
    }
  }

  /** Neue Tiere wandern ein, wenn der Lebensraum leerer wird. */
  private migrate(time: number) {
    if (time < this.nextMigrate) return;
    this.nextMigrate = time + 15000;
    const resident = this.animals.filter((a) => !a.dead && !a.kin && !a.visitor).length;
    if (resident >= this.faunaCount) return;
    const pool = this.ep.fauna.map(([id]) => id).filter((id) => SPECIES[id].role !== 'hazard');
    if (!pool.length) return;
    const id = pick(Math.random, pool);
    const def = SPECIES[id];
    const L = this.L;
    const x = this.player.x > L.width / 2 ? 70 : L.width - 70;
    const col = clamp(Math.floor(x / TILE), 0, L.ground.length - 1);
    const ground = L.ground[col];
    const y = this.water ? (def.crawl ? ground - 24 : clamp(ground - 140 - Math.random() * 200, L.surfaceY + 60, ground - 40)) : def.habitat === 'air' ? ground - 150 : ground - 50;
    const a = this.spawnAnimal(id, x, y);
    a.setAlpha(0);
    this.tweens.add({ targets: a, alpha: 1, duration: 800 });
  }

  /** Wetter, Beben und Feuerregen. */
  private weather(time: number, dt: number) {
    const storm = time < this.stormUntil;
    this.stormK = clamp(this.stormK + (storm ? dt / 3 : -dt / 3), 0, 1);
    if (this.stormFx) {
      this.stormFx.veil.setAlpha(this.stormK * 0.55);
      if (!storm && this.stormK <= 0) {
        this.stormFx.p.stop();
        this.stormFx.veil.destroy();
        this.stormFx = undefined;
      }
    }
    const p = this.player;
    const cam = this.cameras.main;
    if (time < this.quakeUntil && !this.water && time > this.nextRock) {
      this.nextRock = time + 650;
      const x = clamp(p.x + (Math.random() - 0.5) * 700, 40, this.L.width - 40);
      this.shoot(x, cam.scrollY - 40, (Math.random() - 0.5) * 40, 80, 'd2_rock', this.ep.hazardDmg * 0.8, true);
    }
    if (time < this.meteorUntil && time > this.nextRock) {
      this.nextRock = time + 420;
      const x = clamp(p.x + (Math.random() - 0.5) * 1000, 40, this.L.width - 40);
      this.shoot(x, cam.scrollY - 60, (Math.random() - 0.5) * 140, 260, 'fireball', this.ep.hazardDmg * 1.2, true);
      if (Math.random() < 0.25) cam.shake(200, 0.004);
    }
  }

  private startStormFx() {
    if (this.stormFx) return;
    const t = this.L.theme;
    const veilTint = t === 'eis' ? 0xc8d4e0 : t === 'ozean' ? 0x1a3a30 : t === 'sumpf' ? 0x3a3020 : 0x2a2018;
    const veil = this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(W * 1.4, H * 1.4).setTint(veilTint).setAlpha(0).setDepth(DEPTH.dark - 2);
    const key = t === 'eis' ? 'p_snow' : this.water ? 'p_dot' : 'p_dot';
    const cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = t === 'eis'
      ? { x: { min: 0, max: W + 200 }, y: -10, speedX: { min: -260, max: -140 }, speedY: { min: 120, max: 220 }, lifespan: 4000, frequency: 12, scale: { min: 0.4, max: 1.2 }, alpha: { start: 0.9, end: 0.3 } }
      : this.water
        ? { x: { min: 0, max: W }, y: { min: 0, max: H }, speedX: { min: -60, max: 60 }, speedY: { min: -20, max: 20 }, lifespan: 3000, frequency: 20, scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.5, end: 0 }, tint: 0x6a7a60 }
        : t === 'reptil' || t === 'sumpf'
          ? { x: { min: 0, max: W + 300 }, y: { min: 0, max: H }, speedX: { min: -320, max: -180 }, speedY: { min: -10, max: 30 }, lifespan: 3000, frequency: 14, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.6, end: 0 }, tint: 0x9a7a50 }
          : { x: { min: 0, max: W }, y: -10, speedX: { min: -40, max: -10 }, speedY: { min: 500, max: 700 }, lifespan: 1600, frequency: 10, scaleX: 0.12, scaleY: 1.4, alpha: { start: 0.5, end: 0.1 }, tint: 0x9ab0b8 };
    const pe = this.add.particles(0, 0, key, cfg).setScrollFactor(0).setDepth(DEPTH.decoFront);
    this.stormFx = { veil, p: pe };
  }

  /** Musik und Ankündigung, wenn ein großer Räuber Jagd auf dich macht. */
  private huntMood(time: number) {
    const hunter = this.animals.find((a) => !a.dead && a.huntingPlayer && (a.visitor || a.role === 'apex'));
    if (hunter) {
      this.huntLost = 0;
      if (!this.huntMusic) {
        this.huntMusic = time;
        audio.music('apex');
      }
      if (!this.announced.has(hunter.def.id)) {
        this.announced.add(hunter.def.id);
        bus.emit('apex', hunter.def.name);
      }
    } else if (this.huntMusic) {
      if (!this.huntLost) this.huntLost = time;
      else if (time - this.huntLost > 5000) {
        this.huntMusic = 0;
        this.huntLost = 0;
        audio.music(this.ep.music);
      }
    }
  }

  private interact(time: number, dt: number) {
    const L = this.L;
    const p = this.player;
    const pr = p.hitRect();
    const cx = p.x, cy = p.y;

    // Dickicht: verstecken
    const ci = L.cover.findIndex((c) => cx > c.x + 6 && cx < c.x + c.w - 6 && cy > c.y - 10 && cy < c.y + c.h + 10);
    p.inCave = L.caves.some((c) => cx > c.x && cx < c.x + c.w && cy > c.y && cy < c.y + c.h);
    p.inCover = ci >= 0 || p.inCave;
    p.hidden = p.inCover && p.speed01 < 0.55 && !p.sprinting;
    const b = p.body;
    p.grounded = !p.inCover && p.speed01 < 0.15 && (this.water ? this.solidAt(cx, b.bottom + 8) : b.blocked.down);
    p.view.setShade(p.inCave ? 0x2a2a2a : p.hidden ? 0x4e4e4e : p.inCover ? 0x8a8a8a : null);
    // Wer sich viel versteckt, nimmt die Farben seiner Verstecke an
    if (p.hidden && ci >= 0) game.grow('green', 0.006 * dt);
    else if (p.hidden && p.inCave) game.grow('sand', 0.005 * dt);
    else if (p.grounded) game.grow('sand', 0.004 * dt);
    if (p.inCover !== this.wasInCover) {
      this.wasInCover = p.inCover;
      if (p.inCover) audio.sfx('rustle');
    }
    if (ci !== this.curCover) {
      // das Gestrüpp, in dem man steckt, wird lichter – man sieht sich selbst noch schemenhaft
      if (this.curCover >= 0) this.tweens.add({ targets: this.coverFront[this.curCover], alpha: 0.82, duration: 300 });
      if (ci >= 0) this.tweens.add({ targets: this.coverFront[ci], alpha: 0.5, duration: 300 });
      this.curCover = ci;
    }

    // Tiere berühren: Zusammenstöße, Angriffe, Nesseln (Artgenossen und Verbündete stören nicht)
    for (const a of this.animals) {
      if (a.dead || a.kin || a.ally) continue;
      const ar = a.hitRect();
      if (!overlaps(pr, ar)) continue;
      const v = p.body.velocity;
      const dx = a.x - p.x, dy = this.water ? a.y - p.y : 0;
      const dl = Math.hypot(dx, dy) || 1;
      const approach = Math.max(0, (v.x * dx + v.y * dy) / dl) / Math.max(1, p.stats.speed);
      const since = time - (this.ramHit.get(a) ?? -1e9);
      if (p.isRamming && since > 400) {
        this.collide(a, approach, true);
        continue;
      }
      if (approach > 0.5 && since > 700) {
        this.collide(a, approach, false);
        continue;
      }
      if (a.attacking || a.role === 'hazard') {
        p.hurt(a.def.dmg * (a.attacking ? 1.15 : 1), a.x, a.def.name);
        a.hitPlayerAt = time;
      }
    }

    // Fallen und Abgründe
    let fell = !this.water && p.y > L.height + 60;
    for (const h of this.hazards) {
      if (!overlaps(pr, h)) continue;
      if (h.h > 40) fell = true;
      else {
        p.hurt(this.ep.hazardDmg, p.x - p.facing * 10, this.L.theme === 'reptil' ? 'Glühende Felsen' : 'Dornen');
        if (!p.dead) p.body.setVelocityY(-420);
      }
      break;
    }
    if (fell) {
      p.hurt(this.ep.hazardDmg, p.x, this.L.theme === 'reptil' ? 'Lava' : 'Sturz in die Tiefe');
      if (!p.dead) {
        p.body.reset(p.lastSafe.x, p.lastSafe.y - 10);
        this.cameras.main.flash(260, 0, 0, 0);
      }
    }

    // Hunger: ohne Nahrung geht es bergab, satt heilt der Körper (Kälte zehrt mehr)
    const cold = this.L.theme === 'eis' ? 1 + 0.4 * this.stormK : 1;
    const rate = HUNGER_RATE * (p.sprinting ? 2 : 1) * (0.85 + 0.3 * p.stats.size) * cold;
    p.satiety = Math.max(0, p.satiety - rate * dt);
    if (p.satiety <= 0) {
      p.hp -= p.stats.maxHp * 0.012 * dt;
      if (p.hp <= 0) {
        p.hp = 0;
        p.hurt(999, p.x, this.L.theme === 'eis' ? 'Verhungert und erfroren' : 'Verhungert');
      }
    } else if (p.satiety > 40 && time - p.lastHurt > 3000) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.01 * dt);
    }
    if (p.satiety < 18 && time > this.growlAt) {
      this.growlAt = time + 9000;
      audio.sfx('growl');
    }
    game.calm(dt);

    // Still im Dickicht, während ein Jäger in der Nähe ist → unauffälliger
    if (time > this.hideTick) {
      this.hideTick = time + 1000;
      if (p.hidden) {
        const near = this.animals.some((a) => !a.dead && !a.ally && (a.role === 'predator' || a.role === 'apex') && Math.hypot(a.x - p.x, a.y - p.y) < 320);
        if (near) game.grow('stealth', 0.008);
      }
    }

    // Aussehen anpassen (Stück für Stück). Neu zeichnen kostet ein paar Millisekunden – deshalb
    // nicht mitten im Kampf und höchstens alle 3 Sekunden; die Werte selbst stimmen immer sofort.
    if (time > this.lookAt) {
      this.lookAt = time + 400;
      const calm = time - this.fightAt > 2500 && time - p.lastHurt > 2500 && !p.isRamming && !this.huntMusic;
      const redraw = calm && time > this.redrawAt;
      if (p.refresh(false, redraw)) this.redrawAt = time + 3000;
    }

    // Anzeige (ohne Zahlen)
    if (time > this.vitalsAt) {
      this.vitalsAt = time + 150;
      bus.emit('vitals', p.hp / p.stats.maxHp, p.satiety / FULL, p.hidden);
    }
  }

  // ---------------------------------------------------------------- Ende

  /** Die Zeit ist um, und du lebst noch. */
  private complete() {
    if (this.ended) return;
    this.ended = true;
    const run = game.run!;
    const kin = this.animals.filter((a): a is Kin => a instanceof Kin && !a.dead);
    const data: SurvivedData = {
      epoch: this.epochIdx,
      before: game.startTraits(),
      traits: { ...game.traits },
      cls: game.cls,
      look: { hue: run.hue, seed: run.seed, sex: run.sex },
      kinAlive: kin.length,
      kinLooks: kin.slice(0, 3).map((k) => k.view.m),
      node: '',
    };
    const social = kin.length ? kin.reduce((sum, k) => sum + k.loyalty, 0) / kin.length : undefined;
    const res = game.surviveEpoch(kin.length, social);
    data.transition = res.transition;
    if (res.drift && !res.finished) data.drifted = res.drift.after;
    data.finished = res.finished;
    data.node = res.node;
    bus.emit('clock', this.ep.to, 1, 1);
    audio.sfx('portal');
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(1800, 230, 214, 180);
    this.time.delayedCall(1900, () => {
      this.scene.stop('Hud');
      this.scene.start('Generation', data);
    });
  }

  /** Das Tier ist tot – das Spiel ist vorbei, die Linie stirbt aus. */
  private onDeath() {
    if (this.ended) return;
    this.endLine(this.player.lastCause, 2600);
  }

  private abort() {
    if (this.ended) return;
    this.endLine('Aufgegeben', 300);
  }

  private endLine(cause: string, wait: number) {
    this.ended = true;
    const frac = clamp(this.elapsed / this.ep.seconds, 0, 1);
    const years = this.ep.from - (this.ep.from - this.ep.to) * frac;
    const morph = this.player.morph();
    const leaf = game.extinct(frac, cause);
    audio.music(null);
    this.time.delayedCall(wait, () => {
      this.scene.stop('Hud');
      fadeTo(this, 'Tree', { mode: 'extinct', leaf, morph, epoch: this.epochIdx, cause, years }, 1200);
    });
  }
}
