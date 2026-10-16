import Phaser from 'phaser';
import { W, H, DEPTH, GRAVITY } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { eraById, ERAS, type EraDef, type EraId, type NodeDef } from '../data/eras';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { generateLevel, type LevelData } from '../level/LevelGen';
import { groundTextures, levelBackgrounds, THEME_TINT } from '../art/worldArt';
import { makeEnemyTextures } from '../art/enemyArt';
import { Controls } from '../objects/Controls';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Boss } from '../objects/Boss';
import { fadeIn, fadeTo } from '../ui/ui';
import { FONT } from '../config';
import { overlaps, type Rect } from '../util/math';

type Img = Phaser.GameObjects.Image;
type PImg = Phaser.Physics.Arcade.Image;

const DUST: Record<EraId, number> = { ozean: 0xffffff, sumpf: 0x8a7a5a, reptil: 0xc89a6a, eis: 0xffffff, eden: 0xd8c890 };

export class LevelScene extends Phaser.Scene {
  era!: EraDef;
  node!: NodeDef;
  L!: LevelData;
  player!: Player;
  water = false;
  surfaceY = 0;
  arena?: { x0: number; x1: number; floor: number };
  enemies: Enemy[] = [];
  private controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private solidRects: Rect[] = [];
  private platRects: Rect[] = [];
  private hazards: Rect[] = [];
  private lava: Phaser.GameObjects.TileSprite[] = [];
  private meats: PImg[] = [];
  private crystals: Img[] = [];
  private shots: PImg[] = [];
  private boss?: Boss;
  private bossStarted = false;
  private firstClear = false;
  private exitObj?: Img;
  private ended = false;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgMid!: Phaser.GameObjects.TileSprite;
  private darkness?: Img;
  private puffer!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Level');
  }

  init(d: { era: EraId; node: string }) {
    this.era = eraById(d.era);
    this.node = this.era.nodes.find((n) => n.id === d.node)!;
    this.enemies = [];
    this.solidRects = [];
    this.platRects = [];
    this.hazards = [];
    this.lava = [];
    this.meats = [];
    this.crystals = [];
    this.shots = [];
    this.boss = undefined;
    this.bossStarted = false;
    this.firstClear = false;
    this.exitObj = undefined;
    this.ended = false;
    this.darkness = undefined;
    this.arena = undefined;
  }

  create() {
    fadeIn(this);
    const L = (this.L = generateLevel(this.era, this.node));
    this.water = L.mode === 'water';
    this.surfaceY = L.surfaceY;
    const world = this.physics.world;
    world.gravity.y = this.water ? 0 : GRAVITY;
    if (this.water) world.setBounds(0, L.surfaceY, L.width, L.height - L.surfaceY);
    else world.setBounds(0, -600, L.width, L.height + 1200);
    world.setBoundsCollision(true, true, true, this.water);

    // Hintergrund
    const [far, mid] = levelBackgrounds(this, L.theme, L.variant);
    this.bgFar = this.add.tileSprite(0, 0, W, H, far).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg);
    this.bgMid = this.add.tileSprite(0, 0, W, H, mid).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1);

    // Gelände
    const gt = groundTextures(this, L.theme);
    this.solids = this.physics.add.staticGroup();
    for (const r of L.solids) this.addSolid(r, gt.gnd, gt.top);
    for (const r of L.platforms) this.addPlatform(r, gt.plat);
    for (const r of L.hazards) this.addHazard(r, gt.hz);
    for (const d of L.decor) {
      const key = 'd_' + d.k;
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(d.x, d.y, key).setOrigin(0.5, d.hang ? 0 : 1).setDepth(d.front ? DEPTH.decoFront : DEPTH.decoBack);
      if (d.front) img.setAlpha(0.8).setScale(1.2);
      if (this.water && !d.hang) {
        this.tweens.add({ targets: img, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 1800 + Math.random() * 1200, ease: 'Sine.inOut' });
      }
    }
    if (this.water && L.surfaceY > 0) {
      const s = this.add.tileSprite(0, L.surfaceY - 14, L.width, 30, 'surface').setOrigin(0).setDepth(DEPTH.decoFront);
      this.tweens.add({ targets: s, tilePositionX: 160, repeat: -1, duration: 4000 });
    }

    // Spieler & Gegner
    this.controls = new Controls(this);
    this.player = new Player(this, L.start.x, L.start.y, this.water);
    for (const s of L.spawns) this.spawnEnemy(s.id, s.x, s.y);
    if (L.boss) {
      this.arena = L.boss.arena;
      const def = ENEMIES[L.boss.id];
      makeEnemyTextures(this, def);
      this.boss = new Boss(this, def, L.boss.x, L.boss.y);
      this.enemies.push(this.boss);
    }
    for (const c of L.crystals) {
      const img = this.add.image(c.x, c.y, 'crystal').setDepth(DEPTH.pickups);
      this.tweens.add({ targets: img, y: c.y - 6, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400, ease: 'Sine.inOut' });
      this.crystals.push(img);
    }
    if (L.exit) this.makeExit(L.exit.x, L.exit.y);

    // Kollisionen
    this.physics.add.collider(this.player.rect, this.solids);
    this.physics.add.collider(this.enemies, this.solids, undefined, (e) => !(e as Enemy).def.air);
    this.physics.add.collider(this.meats, this.solids);
    this.physics.add.collider(this.shots, this.solids, (s) => this.popShot(s as PImg), (s) => !(s as PImg).getData('wave'));

    // Effekte
    this.puffer = this.add.particles(0, 0, this.water ? 'p_bubble' : 'p_dot', {
      speed: { min: 20, max: 90 },
      lifespan: this.water ? 1200 : 450,
      scale: { start: this.water ? 0.8 : 0.9, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      gravityY: this.water ? -60 : -20,
      tint: DUST[L.theme],
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.sparkle = this.add.particles(0, 0, 'p_spark', {
      speed: { min: 60, max: 240 },
      lifespan: 650,
      scale: { start: 0.8, end: 0 },
      tint: [0xffffff, 0xffe680, 0x9affff],
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.ambient();
    if (L.variant !== 'normal') {
      this.darkness = this.add.image(0, 0, 'darkness').setScale(L.variant === 'dark' ? 3.6 : 4.4).setDepth(DEPTH.dark).setAlpha(L.variant === 'dark' ? 1 : 0.85);
    }

    // Kamera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, L.width, L.height);
    cam.startFollow(this.player.rect, true, 0.12, 0.12);
    cam.setDeadzone(90, 70);

    // Anzeige & Musik
    this.scene.launch('Hud', { era: this.era.id, node: this.node.id });
    audio.music(this.era.music);

    const onEvolved = () => this.player.refresh();
    const onAbort = () => this.leave({});
    bus.on('evolved', onEvolved);
    bus.on('abortLevel', onAbort);
    this.events.on('player-dead', () => this.onDeath());
    this.events.once('shutdown', () => {
      bus.off('evolved', onEvolved);
      bus.off('abortLevel', onAbort);
      this.events.off('player-dead');
    });
  }

  // ---------------------------------------------------------------- Aufbau

  private addSolid(r: Rect, gnd: string, top: string) {
    this.add.tileSprite(r.x, r.y, r.w, r.h, gnd).setOrigin(0).setDepth(DEPTH.terrain);
    if (r.y > 0) this.add.tileSprite(r.x - 4, r.y - 9, r.w + 8, 26, top).setOrigin(0).setDepth(DEPTH.terrain + 1);
    else this.add.rectangle(r.x, r.y + r.h - 6, r.w, 6, 0x000000, 0.3).setOrigin(0).setDepth(DEPTH.terrain + 1);
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
      const key = this.L.theme === 'reptil' ? 'spk_reptil' : hz;
      this.add.tileSprite(r.x, r.y + r.h - 40, r.w, 40, key).setOrigin(0).setDepth(DEPTH.terrain + 2);
    }
    this.hazards.push(r);
  }

  private makeExit(x: number, y: number) {
    const g = this.add.image(x, y, 'glow').setScale(2.2).setTint(0x9affff).setAlpha(0.6).setDepth(DEPTH.pickups - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0.25, scale: 2.6, yoyo: true, repeat: -1, duration: 900 });
    const p = this.add.image(x, y, 'portal').setDepth(DEPTH.pickups);
    this.tweens.add({ targets: p, angle: 360, repeat: -1, duration: 3000 });
    this.exitObj = p;
    this.add.particles(x, y, 'p_spark', {
      speed: { min: 10, max: 40 }, lifespan: 1200, scale: { start: 0.5, end: 0 }, frequency: 120,
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 60) } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      tint: [0xffffff, 0x9affff],
    }).setDepth(DEPTH.fx);
  }

  private ambient() {
    const t = this.L.theme;
    const base = { x: { min: 0, max: W }, lifespan: 9000, frequency: 160, quantity: 1 };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    let key = 'p_dot';
    if (t === 'ozean') {
      key = 'p_bubble';
      cfg = { ...base, y: H + 10, speedY: { min: -30, max: -80 }, speedX: { min: -10, max: 10 }, scale: { min: 0.3, max: 0.9 }, alpha: { start: 0.6, end: 0 } };
    } else if (t === 'eis') {
      key = 'p_snow';
      cfg = { ...base, y: -10, speedY: { min: 30, max: 80 }, speedX: { min: -30, max: 10 }, scale: { min: 0.3, max: 1 }, alpha: { start: 0.9, end: 0.3 }, frequency: 60 };
    } else {
      cfg = {
        ...base, y: { min: 0, max: H }, speedY: { min: -15, max: 15 }, speedX: { min: -15, max: 15 },
        scale: { start: 0.5, end: 0.1 }, alpha: { start: 0, end: 0.8, ease: 'Sine.inOut' }, lifespan: 4000, frequency: 200,
        tint: THEME_TINT[t],
      };
    }
    this.add.particles(0, 0, key, cfg).setScrollFactor(0).setDepth(DEPTH.decoFront - 1);
  }

  // ---------------------------------------------------------------- Schnittstelle für Spieler & Gegner

  solidAt(x: number, y: number) {
    for (const r of this.solidRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    for (const r of this.platRects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    return false;
  }

  spawnEnemy(id: string, x: number, y: number) {
    const def = ENEMIES[id];
    makeEnemyTextures(this, def);
    const e = new Enemy(this, def, x, y);
    this.enemies.push(e);
    return e;
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
    if (tex === 'pr_shard') s.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    if (tex === 'pr_wave') s.setFlipX(vx < 0);
    this.shots.push(s);
  }

  private popShot(s: PImg) {
    this.puff(s.x, s.y, 4);
    s.destroy();
  }

  floatText(x: number, y: number, s: string, color: string, size = 24) {
    const t = this.add.text(x, y, s, {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: '700', stroke: '#10202e', strokeThickness: 5, resolution: 2,
    }).setOrigin(0.5).setDepth(DEPTH.text);
    this.tweens.add({ targets: t, y: y - 46, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  puff(x: number, y: number, n: number, tint?: number) {
    if (tint !== undefined) this.puffer.setParticleTint(tint);
    this.puffer.explode(n, x, y);
    if (tint !== undefined) this.puffer.setParticleTint(DUST[this.L.theme]);
  }

  playerBite(rect: Rect) {
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead || !overlaps(rect, e.hitRect())) continue;
      e.damage(this.player.stats.bite, this.player.x);
      hit = true;
    }
    if (hit) {
      this.cameras.main.shake(70, 0.004);
      this.sparkle.explode(5, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
  }

  enemyKilled(e: Enemy) {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.sparkle.explode(10, e.x, e.y);
    if (e === this.boss) {
      this.bossDefeated(e);
      return;
    }
    this.dropMeat(e.x, e.y, e.def.evo);
  }

  private dropMeat(x: number, y: number, evo: number) {
    const m = this.physics.add.image(x, y, 'meat').setDepth(DEPTH.pickups);
    m.setData('evo', evo);
    m.setBounce(0.35);
    m.setCollideWorldBounds(true);
    const b = m.body as Phaser.Physics.Arcade.Body;
    b.setSize(30, 20);
    if (this.water) {
      b.setGravityY(50);
      b.setDrag(30, 0);
      m.setVelocity(Phaser.Math.Between(-40, 40), -20);
    } else {
      m.setVelocity(Phaser.Math.Between(-80, 80), -300);
      b.setDragX(120);
    }
    this.tweens.add({ targets: m, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 500 });
    this.meats.push(m);
    this.time.delayedCall(15000, () => {
      if (!m.active) return;
      this.tweens.add({ targets: m, alpha: 0, duration: 400, repeat: 3, yoyo: true, onComplete: () => m.destroy() });
    });
  }

  // ---------------------------------------------------------------- Ablauf

  update(time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    const L = this.L;
    const p = this.player;
    if (!this.ended) this.controls.update();
    else this.controls.clear();
    p.update(time, dt, this.controls);
    for (const e of [...this.enemies]) {
      e.tick(time, dt);
      if (!e.dead && e.y > L.height + 200) {
        this.enemies = this.enemies.filter((x) => x !== e);
        e.destroy();
      }
    }

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.12;
    this.bgMid.tilePositionX = cam.scrollX * 0.35;
    for (const t of this.lava) t.tilePositionX += dt * 25;
    this.darkness?.setPosition(p.x, p.y);

    if (!p.dead && !this.ended) {
      const pr = p.hitRect();
      // Hornstoß trifft
      if (p.dashing) {
        const reach: Rect = { x: pr.x + (p.facing > 0 ? pr.w * 0.4 : -16), y: pr.y, w: pr.w * 0.6 + 16, h: pr.h };
        for (const e of this.enemies) {
          if (e.dead || p.dashHit.has(e) || !overlaps(reach, e.hitRect())) continue;
          p.dashHit.add(e);
          e.damage(p.stats.horn, p.x, 420);
          this.cameras.main.shake(90, 0.006);
          this.sparkle.explode(8, e.x, e.y);
        }
      }
      // Berührung
      for (const e of this.enemies) {
        if (!e.dead && overlaps(pr, e.hitRect())) {
          if (e instanceof Boss && !e.active2) continue;
          p.hurt(e.def.dmg, e.x);
          break;
        }
      }
      // Fallen: Stacheln schleudern hoch, Lava am Grubenboden wirkt wie ein Absturz
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
          this.cameras.main.flash(220, 0, 0, 0);
          this.puff(p.lastSafe.x, p.lastSafe.y, 6);
        }
      }
      // Fleisch
      for (const m of this.meats) {
        if (!m.active) continue;
        if (overlaps(pr, { x: m.x - 18, y: m.y - 14, w: 36, h: 28 })) {
          const v = m.getData('evo') as number;
          game.addEvo(v);
          p.heal(Math.round(v * 0.8) + 2);
          this.floatText(m.x, m.y - 20, `+${v} EVO`, '#9affff', 24);
          audio.sfx('eat');
          this.sparkle.explode(6, m.x, m.y);
          m.destroy();
        }
      }
      this.meats = this.meats.filter((m) => m.active);
      // Kristalle
      for (const c of this.crystals) {
        if (c.active && Math.hypot(c.x - p.x, c.y - p.y) < 44) {
          game.addEvo(this.era.crystal);
          this.floatText(c.x, c.y - 20, `+${this.era.crystal} EVO`, '#ffd0ff', 24);
          audio.sfx('crystal');
          this.sparkle.explode(14, c.x, c.y);
          c.destroy();
        }
      }
      this.crystals = this.crystals.filter((c) => c.active);
      // Bossarena
      if (this.boss && !this.bossStarted && L.boss && p.x > L.boss.triggerX) this.startBoss();
      // Ausgang
      if (this.exitObj && Math.hypot(this.exitObj.x - p.x, this.exitObj.y - p.y) < 56) this.complete();
    }

    // Geschosse
    for (const s of this.shots) {
      if (!s.active) continue;
      if (time > (s.getData('die') as number) || s.y > L.height + 100 || s.x < -50 || s.x > L.width + 50) {
        s.destroy();
        continue;
      }
      if (s.texture.key === 'pr_rock') s.rotation += dt * 5;
      if (!p.dead && !this.ended && overlaps(p.hitRect(), { x: s.x - s.width * 0.3, y: s.y - s.height * 0.3, w: s.width * 0.6, h: s.height * 0.6 })) {
        p.hurt(s.getData('dmg') as number, s.x);
        if (!s.getData('wave')) this.popShot(s);
      }
    }
    this.shots = this.shots.filter((s) => s.active);
  }

  private startBoss() {
    this.bossStarted = true;
    const b = this.boss!;
    b.start();
    audio.music('boss');
    bus.emit('bossShow', b.def.name, b.hp, b.maxHp);
  }

  private bossDefeated(e: Enemy) {
    audio.sfx('boom');
    this.cameras.main.shake(700, 0.015);
    this.cameras.main.flash(400, 255, 255, 255);
    bus.emit('bossHide');
    for (let i = 0; i < 12; i++) {
      this.time.delayedCall(i * 90, () => this.sparkle.explode(10, e.x + Phaser.Math.Between(-80, 80), e.y + Phaser.Math.Between(-60, 60)));
    }
    const parts = 6;
    for (let i = 0; i < parts; i++) this.dropMeat(e.x + (i - parts / 2) * 20, e.y - 20, Math.ceil(e.def.evo / parts));
    this.firstClear = game.completeNode(this.era.id, this.node.id);
    audio.music(this.era.music);
    const next = game.nextClass();
    const unlock = this.firstClear && next && CLASSES[next].requiresEra === this.era.id ? `Neue Entwicklung: ${CLASSES[next].name}!` : '';
    bus.emit('banner', `${e.def.name} besiegt!`, unlock || 'Friss das Fleisch und geh durch das Tor.');
    const A = this.arena!;
    this.time.delayedCall(1500, () => {
      if (this.ended) return;
      this.makeExit(A.x1 - 140, this.water ? A.floor - 200 : A.floor - 60);
      audio.sfx('portal');
    });
  }

  private complete() {
    if (this.ended) return;
    this.ended = true;
    const p = this.player;
    p.body.setVelocity(0, 0);
    p.body.setAllowGravity(false);
    const first = this.node.boss ? this.firstClear : game.completeNode(this.era.id, this.node.id);
    if (first) game.addEvo(this.era.bonus);
    game.save();
    audio.sfx('victory');
    bus.emit('banner', 'Geschafft!', first ? `+${this.era.bonus} EVO Bonus` : '');
    this.tweens.add({ targets: p.view, scale: 0.1, alpha: 0, x: this.exitObj!.x, y: this.exitObj!.y, duration: 900, ease: 'Cubic.in' });
    const finalEra = this.era.id === ERAS[ERAS.length - 1].id && !!this.node.boss;
    let message: string | undefined;
    const next = game.nextClass();
    if (this.node.boss && first && next && CLASSES[next].requiresEra === this.era.id) {
      message = `Neu: Du kannst dich zum ${CLASSES[next].name} entwickeln! (Evolution → Klasse)`;
    }
    this.time.delayedCall(2300, () => {
      if (finalEra) this.leaveTo('Ending', {});
      else this.leave({ completed: this.node.id, first, message });
    });
  }

  private onDeath() {
    if (this.ended) return;
    this.ended = true;
    const lost = Math.floor(game.evo * 0.2);
    game.data.evo -= lost;
    game.data.deaths++;
    game.save();
    bus.emit('evo', game.evo);
    bus.emit('banner', 'Besiegt …', lost ? `Du verlierst ${lost} EVO-Punkte.` : '');
    audio.music(null);
    this.time.delayedCall(2600, () => this.leave({ message: 'Gaia hat dich gerettet. Versuch es noch einmal!' }));
  }

  private leave(extra: { completed?: string; first?: boolean; message?: string }) {
    this.leaveTo('Map', { era: this.era.id, ...extra });
  }

  private leaveTo(key: string, data: object) {
    this.ended = true;
    this.scene.stop('Hud');
    fadeTo(this, key, data);
  }
}
