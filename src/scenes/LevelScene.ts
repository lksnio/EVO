import Phaser from 'phaser';
import { W, H, DEPTH, GRAVITY, DEBUG } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { eraById, type EraDef, type EraId, type NodeDef } from '../data/eras';
import { SPECIES } from '../data/species';
import { generateLevel, type LevelData } from '../level/LevelGen';
import { coverTextures, groundTextures, levelBackgrounds, plantTextures, THEME_TINT } from '../art/worldArt';
import { makeSpeciesTextures } from '../art/speciesArt';
import { Controls } from '../objects/Controls';
import { Player, FULL } from '../objects/Player';
import { Animal, type World } from '../objects/Animal';
import { Carcass, Plant } from '../objects/Food';
import { fadeIn, fadeTo } from '../ui/ui';
import { clamp, overlaps, type Rect } from '../util/math';

type PImg = Phaser.Physics.Arcade.Image;

const DUST: Record<EraId, number> = { ozean: 0xcfe0dc, sumpf: 0x5a4a32, reptil: 0x6a4a34, eis: 0xdfe6ec, eden: 0x6a5a3a };

/** Hunger pro Sekunde (Sättigung 0..100). */
const HUNGER_RATE = 0.55;

export class LevelScene extends Phaser.Scene implements World {
  era!: EraDef;
  node!: NodeDef;
  L!: LevelData;
  player!: Player;
  water = false;
  surfaceY = 0;
  territory?: { x0: number; x1: number; floor: number };
  animals: Animal[] = [];
  plants: Plant[] = [];
  carcasses: Carcass[] = [];
  ended = false;
  private controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private hazards: Rect[] = [];
  private lava: Phaser.GameObjects.TileSprite[] = [];
  private shots: PImg[] = [];
  private apex?: Animal;
  private exitAt = { x: 0, y: 0 };
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private darkness?: Phaser.GameObjects.Image;
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ramHit = new Map<Animal, number>();
  private vitalsAt = 0;
  private lookAt = 0;
  private hideTick = 0;
  private growlAt = 0;
  private wasInCover = false;
  /** vordere Büsche je Dickicht – werden durchsichtiger, wenn man darin steckt */
  private coverFront: Phaser.GameObjects.Image[][] = [];
  private curCover = -1;
  /** Zeitpunkt, seit dem der Spitzenräuber den Spieler jagt (0 = nicht) */
  private apexHuntAt = 0;
  private apexLostAt = 0;
  private apexAnnounced = false;
  private dbg?: Phaser.GameObjects.Text;
  private t = 0;

  constructor() {
    super('Level');
  }

  init(d: { era: EraId; node: string }) {
    this.era = eraById(d.era);
    this.node = this.era.nodes.find((n) => n.id === d.node)!;
    this.animals = [];
    this.plants = [];
    this.carcasses = [];
    this.solidRects = [];
    this.platRects = [];
    this.hazards = [];
    this.lava = [];
    this.shots = [];
    this.apex = undefined;
    this.ended = false;
    this.darkness = undefined;
    this.territory = undefined;
    this.ramHit = new Map();
    this.dbg = undefined;
    this.t = 0;
    this.wasInCover = false;
    this.coverFront = [];
    this.curCover = -1;
    this.apexHuntAt = 0;
    this.apexLostAt = 0;
    this.apexAnnounced = false;
  }

  create() {
    fadeIn(this, 600);
    game.beginJourney();
    const L = (this.L = generateLevel(this.era, this.node));
    this.water = L.mode === 'water';
    this.surfaceY = L.surfaceY;
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
    // Pflanzen
    plantTextures(this, L.theme);
    for (const p of L.plants) this.plants.push(new Plant(this, p.x, p.y, L.theme));
    // Dickicht: einzelne Büsche – dahinter dunkler, davor halbtransparent
    const bushes = coverTextures(this, L.theme);
    let bi = 0;
    for (const c of L.cover) {
      const front: Phaser.GameObjects.Image[] = [];
      this.coverFront.push(front);
      const n = Math.max(2, Math.round(c.w / 55));
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < n; i++) {
          const key = bushes[(bi++ * 7 + i) % bushes.length];
          const x = c.x + ((i + 0.5) / n) * c.w + ((bi * 37) % 17) - 8;
          const hgt = (c.h + 24 + ((bi * 53) % 30)) * (layer ? 1 : 1.08);
          const img = this.add.image(x + (layer ? 0 : 14), c.y + c.h + 4, key).setOrigin(0.5, 1);
          img.setScale(((c.w / n) * 1.9) / 150 * (layer ? 1 : 1.1), hgt / 210);
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

    // Spieler & Tiere
    this.controls = new Controls(this);
    this.player = new Player(this, L.start.x, L.start.y, this.water);
    for (const s of L.spawns) this.spawnAnimal(s.id, s.x, s.y);
    if (L.apex) {
      this.territory = L.territory;
      this.apex = this.spawnAnimal(L.apex.id, L.apex.x, L.apex.y);
    }

    // Ausgang: ein Lichtspalt
    this.exitAt = { x: L.exit.x, y: L.exit.y };
    const beam = this.add.image(L.exit.x, L.exit.y + 90, 'exitlight').setOrigin(0.5, 1).setDepth(DEPTH.decoBack + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    this.tweens.add({ targets: beam, alpha: 0.3, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.inOut' });
    this.add.particles(L.exit.x, L.exit.y, 'p_dot', {
      x: { min: -40, max: 40 }, y: { min: -60, max: 60 }, speedY: { min: -14, max: -4 }, lifespan: 2600, frequency: 220,
      scale: { start: 0.35, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: 0xffe8c0,
    }).setDepth(DEPTH.fx);

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
    this.ambient();
    if (L.variant !== 'normal') {
      this.darkness = this.add.image(0, 0, 'darkness').setScale(L.variant === 'dark' ? 3.4 : 4.2).setDepth(DEPTH.dark);
    }
    // leichte Abdunklung zum Rand hin – macht die Welt bedrohlicher
    this.add.image(W / 2, H / 2, 'vignette').setScrollFactor(0).setDisplaySize(W, H).setDepth(DEPTH.dark + 1).setAlpha(0.55);

    // Kamera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width, L.height);
    cam.startFollow(this.player.rect, true, 0.1, 0.1);
    cam.setDeadzone(90, 70);

    this.scene.launch('Hud', { era: this.era.id, node: this.node.id });
    audio.music(this.era.music);

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
    if (r.y > 0) this.add.tileSprite(r.x - 4, r.y - 10, r.w + 8, 30, top).setOrigin(0).setDepth(DEPTH.terrain + 1);
    else this.add.rectangle(r.x, r.y + r.h - 8, r.w, 8, 0x000000, 0.4).setOrigin(0).setDepth(DEPTH.terrain + 1);
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setVisible(false);
    this.solids.add(rect);
    this.solidRects.push(r);
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
    this.animals.push(a);
    return a;
  }

  shoot(x: number, y: number, vx: number, vy: number, tex: string, dmg: number, gravity: boolean) {
    const s = this.physics.add.image(x, y, tex).setDepth(DEPTH.fx - 1);
    s.setData('dmg', dmg);
    s.setData('wave', tex === 'pr_wave');
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
    s.destroy();
  }

  puff(x: number, y: number, n: number, tint?: number) {
    if (tint !== undefined) this.puffer.setParticleTint(tint);
    this.puffer.explode(n, x, y);
    if (tint !== undefined) this.puffer.setParticleTint(DUST[this.L.theme]);
  }

  bleed(x: number, y: number, n: number) {
    this.blood.explode(n, x, y);
  }

  detectFactor(a: Animal) {
    const p = this.player;
    let k = p.stats.detect;
    if (p.hidden) k *= 0.2;
    else if (p.inCover) k *= 0.5;
    k *= 0.55 + 0.6 * Math.min(1, p.speed01);
    if (this.L.variant !== 'normal') k *= 0.7;
    if (!a.alerted && Math.sign(p.x - a.x) !== a.dir) k *= 0.6;
    return k;
  }

  playerThreat() {
    const p = this.player;
    return game.threat() * (0.6 + 0.4 * (p.hp / p.stats.maxHp));
  }

  playerFear() {
    return game.fear();
  }

  playerEscaped(a: Animal) {
    if (this.ended || this.player.dead) return;
    // wer Jägern entkommt, wird vorsichtiger und unauffälliger
    game.grow('stealth', a.role === 'apex' ? 0.05 : 0.03);
  }

  animalDied(a: Animal, byPlayer: boolean) {
    this.animals = this.animals.filter((x) => x !== a);
    this.bleed(a.x, a.y, 14);
    let y = a.y;
    if (a.def.habitat === 'air' || this.water) {
      // Leiche sinkt zu Boden
      for (let k = 0; k < 80 && !this.solidAt(a.x, y + 6); k++) y += 8;
    } else y = a.b.bottom;
    this.carcasses.push(new Carcass(this, a.x, y, a.def, this.water, this.time.now, a.dir));
    if (byPlayer) game.addAggression(a.role === 'prey' ? 0.1 : 0.06);
    if (a === this.apex) {
      this.apex = undefined;
      audio.music(this.era.music);
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
      if (a.role === 'hazard') p.hurt(a.def.dmg * 0.6, a.x);
      else game.addAggression(a.role === 'prey' ? 0.04 : 0.025);
    }
    if (hit) {
      this.cameras.main.shake(70, 0.004);
      return;
    }
    for (const c of this.carcasses) {
      if (c.gone || c.units <= 0 || !overlaps(rect, c.rect)) continue;
      if (p.eat(24 * st.digestMeat)) {
        c.take();
        game.grow('jaw', 0.012);
        game.shiftDiet(0.05);
        game.grow('growth', 0.012 * st.digestMeat);
        this.crumbs(c.x, c.y - 10, 0x6a1a10);
      }
      return;
    }
    for (const pl of this.plants) {
      if (pl.units <= 0 || !overlaps(rect, pl.rect)) continue;
      if (p.eat(15 * st.digestPlant)) {
        pl.take(this.time.now);
        game.grow('stealth', 0.012);
        game.shiftDiet(-0.05);
        game.grow('growth', 0.007 * st.digestPlant);
        this.crumbs(pl.x, pl.y - 20, 0x6a7a3a);
      }
      return;
    }
  }

  private crumbs(x: number, y: number, tint: number) {
    this.puff(x, y, 4, tint);
  }

  /** Mit hohem Tempo in ein Tier rennen. */
  private ram(a: Animal) {
    const p = this.player;
    const st = p.stats;
    const sf = clamp((p.speed01 - 0.7) / 0.6, 0.3, 1);
    this.ramHit.set(a, this.time.now);
    a.hurt(st.ram * (0.6 + 0.8 * sf), p, 'ram');
    // kleine Tiere werden einfach umgestoßen, an großen prallt man ab
    p.recoil(a.x, st.ramSelf * sf * clamp(a.def.power / (st.power + 1), 0.2, 1.5), clamp(a.def.power / (st.power + 1), 0, 1));
    game.grow('skull', 0.022 * sf);
    if (a.role !== 'hazard') game.addAggression(0.035);
    audio.sfx('ram');
    this.cameras.main.shake(140, 0.009);
    this.puff((a.x + p.x) / 2, p.y, 6);
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
      a.tick(time, dt);
      if (!a.dead && a.y > L.height + 200) {
        this.animals = this.animals.filter((x) => x !== a);
        a.destroy();
      }
    }
    for (const pl of this.plants) pl.update(time);
    for (const c of this.carcasses) c.update(time);
    this.carcasses = this.carcasses.filter((c) => !c.gone);

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.08;
    this.bgMid.tilePositionX = cam.scrollX * 0.28;
    this.fog.tilePositionX = cam.scrollX * 0.5 + this.t * 12;
    for (const t of this.lava) t.tilePositionX += dt * 25;
    this.darkness?.setPosition(p.x, p.y);

    if (!p.dead && !this.ended) {
      this.interact(time, dt);
      this.apexMood(time);
    }

    // Geschosse (Schockwellen der großen Räuber)
    for (const s of this.shots) {
      if (!s.active) continue;
      if (time > (s.getData('die') as number) || s.y > L.height + 100 || s.x < -50 || s.x > L.width + 50) {
        s.destroy();
        continue;
      }
      if (!p.dead && !this.ended && overlaps(p.hitRect(), { x: s.x - s.width * 0.3, y: s.y - s.height * 0.3, w: s.width * 0.6, h: s.height * 0.6 })) {
        p.hurt(s.getData('dmg') as number, s.x);
        if (!s.getData('wave')) this.popShot(s);
      }
    }
    this.shots = this.shots.filter((s) => s.active);

    if (this.dbg && time > this.lookAt - 300) {
      const t = game.traits;
      this.dbg.setText(
        `LP ${p.hp.toFixed(0)}/${p.stats.maxHp}  Sätt ${p.satiety.toFixed(0)}  Ausd ${(p.stamina * 100).toFixed(0)}  Versteckt ${p.hidden}\n` +
          `Kiefer ${t.jaw.toFixed(3)}  Schädel ${t.skull.toFixed(3)}  Tarnung ${t.stealth.toFixed(3)}  Wachstum ${t.growth.toFixed(3)}\n` +
          `Kost ${t.diet.toFixed(2)}  Narben ${t.scars}  Aggr ${game.data.aggression.toFixed(2)}  Ruf ${game.data.infamy.toFixed(2)}  Bedrohung ${this.playerThreat().toFixed(1)}\n` +
          `Biss ${p.stats.bite.toFixed(1)}  Ramme ${p.stats.ram.toFixed(1)}  Tempo ${p.stats.speed.toFixed(0)}  Tiere ${this.animals.length}`,
      );
    }
  }

  private interact(time: number, dt: number) {
    const L = this.L;
    const p = this.player;
    const pr = p.hitRect();
    const cx = p.x, cy = p.y;

    // Dickicht: verstecken
    const ci = L.cover.findIndex((c) => cx > c.x + 6 && cx < c.x + c.w - 6 && cy > c.y - 10 && cy < c.y + c.h + 10);
    p.inCover = ci >= 0;
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
    p.hidden = p.inCover && p.speed01 < 0.55 && !p.sprinting;
    p.view.setShade(p.hidden ? 0x4e4e4e : p.inCover ? 0x8a8a8a : null);

    // Tiere berühren: Rammen, Angriffe, Nesseln
    for (const a of this.animals) {
      if (a.dead) continue;
      const ar = a.hitRect();
      if (!overlaps(pr, ar)) continue;
      const inFront = Math.sign(a.x - p.x) === p.facing || this.water;
      if (p.speed01 > 0.82 && inFront && time - (this.ramHit.get(a) ?? -1e9) > 650) {
        if (this.water) {
          const v = p.body.velocity;
          const dx = a.x - p.x, dy = a.y - p.y;
          if ((v.x * dx + v.y * dy) / (Math.hypot(dx, dy) * Math.hypot(v.x, v.y) || 1) < 0.4) continue;
        }
        this.ram(a);
        continue;
      }
      if (a.attacking || a.role === 'hazard') p.hurt(a.def.dmg * (a.attacking ? 1.15 : 1), a.x);
    }

    // Fallen und Abgründe
    let fell = !this.water && p.y > L.height + 60;
    for (const h of this.hazards) {
      if (!overlaps(pr, h)) continue;
      if (h.h > 40) fell = true;
      else {
        p.hurt(this.era.hazardDmg, p.x - p.facing * 10);
        if (!p.dead) p.body.setVelocityY(-420);
      }
      break;
    }
    if (fell) {
      p.hurt(this.era.hazardDmg, p.x);
      if (!p.dead) {
        p.body.reset(p.lastSafe.x, p.lastSafe.y - 10);
        this.cameras.main.flash(260, 0, 0, 0);
      }
    }

    // Hunger: ohne Nahrung geht es bergab, satt heilt der Körper
    const rate = HUNGER_RATE * (p.sprinting ? 2 : 1) * (0.85 + 0.3 * p.stats.size);
    p.satiety = Math.max(0, p.satiety - rate * dt);
    if (p.satiety <= 0) {
      p.hp -= p.stats.maxHp * 0.012 * dt;
      if (p.hp <= 0) {
        p.hp = 0;
        p.hurt(999, p.x);
      }
    } else if (p.satiety > 40 && time - p.lastHurt > 3000) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.01 * dt);
    }
    if (p.satiety < 18 && time > this.growlAt) {
      this.growlAt = time + 9000;
      audio.sfx('growl');
    }
    game.calm(dt);

    // Still im Dickicht, während ein Jäger in der Nähe sucht → unauffälliger
    if (time > this.hideTick) {
      this.hideTick = time + 1000;
      if (p.hidden) {
        const near = this.animals.some((a) => !a.dead && (a.role === 'predator' || a.role === 'apex') && Math.hypot(a.x - p.x, a.y - p.y) < 300);
        if (near) game.grow('stealth', 0.008);
      }
    }

    // Aussehen anpassen (Stück für Stück)
    if (time > this.lookAt) {
      this.lookAt = time + 400;
      p.refresh();
    }

    // Anzeige (ohne Zahlen)
    if (time > this.vitalsAt) {
      this.vitalsAt = time + 150;
      bus.emit('vitals', p.hp / p.stats.maxHp, p.satiety / FULL, p.hidden);
    }

    // Ausgang
    if (Math.abs(p.x - this.exitAt.x) < 50 && Math.abs(p.y - this.exitAt.y) < 140) this.complete();
  }

  /** Musik und Ankündigung, wenn der Spitzenräuber Jagd auf dich macht. */
  private apexMood(time: number) {
    const a = this.apex;
    if (!a || a.dead) return;
    if (a.huntingPlayer) {
      this.apexLostAt = 0;
      if (!this.apexHuntAt) {
        this.apexHuntAt = time;
        audio.music('apex');
        if (!this.apexAnnounced) {
          this.apexAnnounced = true;
          bus.emit('apex', a.def.name);
        }
      }
    } else if (this.apexHuntAt) {
      if (!this.apexLostAt) this.apexLostAt = time;
      else if (time - this.apexLostAt > 5000) {
        this.apexHuntAt = 0;
        this.apexLostAt = 0;
        audio.music(this.era.music);
      }
    }
  }

  // ---------------------------------------------------------------- Ende

  private complete() {
    if (this.ended) return;
    this.ended = true;
    const p = this.player;
    p.body.setVelocity(p.facing * 80, 0);
    p.body.setAllowGravity(false);
    const startCls = game.cls;
    const before = game.startTraits();
    const res = game.completeNode(this.era.id, this.node.id);
    audio.sfx('portal');
    this.tweens.add({ targets: p.view, alpha: 0, duration: 1400, ease: 'Sine.in' });
    this.cameras.main.fadeOut(1600, 255, 240, 210);
    this.time.delayedCall(1700, () => {
      this.scene.stop('Hud');
      this.scene.start('Generation', {
        mode: 'complete', era: this.era.id, node: this.node.id, before, cls: startCls,
        first: res.first, transition: res.transition, finished: res.finished,
      });
    });
  }

  private onDeath() {
    if (this.ended) return;
    this.ended = true;
    const morphAtDeath = this.player.morph();
    game.revertJourney();
    game.data.deaths++;
    // ein Nachkomme setzt die Reise fort
    game.data.generations++;
    game.save();
    audio.music(null);
    this.time.delayedCall(2400, () => {
      this.scene.stop('Hud');
      fadeTo(this, 'Generation', { mode: 'death', era: this.era.id, node: this.node.id, morph: morphAtDeath });
    });
  }

  private abort() {
    if (this.ended) return;
    this.ended = true;
    game.revertJourney();
    game.save();
    this.scene.stop('Hud');
    fadeTo(this, 'Map', { era: this.era.id, message: 'Die Reise wurde abgebrochen.' });
  }
}
