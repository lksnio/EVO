import Phaser from 'phaser';
import { DEPTH } from '../config';
import { tex } from '../util/canvas';

/** Only public player state: the effects never change movement, damage or timing. */
export interface RetroActor {
  x: number;
  y: number;
  facing: number;
  bodyLen: number;
  speed01: number;
  sprinting: boolean;
  isRamming: boolean;
  bitAt: number;
  lastHurt: number;
  dead: boolean;
  inWater: boolean;
}

interface Flash {
  image: Phaser.GameObjects.Image;
  born: number;
  until: number;
  size: number;
}

const CYAN = [0xe4ffff, 0x64f9ff, 0x258fe8];
const ORANGE = [0xffffff, 0xffe89b, 0xff9d38, 0xf34464];
const MAGENTA = [0xffffff, 0xffa5df, 0xf451ac, 0x9f53f2];
const DOT = 'retro_fx_dot';
const STREAK = 'retro_fx_streak';
const DUST = 'retro_fx_dust';
const FLASH = 'retro_fx_impact';
const MUZZLE = 'retro_fx_muzzle';

/** Actual pixel artwork: hard rectangles and stepped silhouettes, without blurred textures. */
function textures(scene: Phaser.Scene) {
  tex(scene, DOT, 3, 3, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 3, 3);
  });
  tex(scene, STREAK, 12, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 1, 12, 2);
    c.fillRect(8, 0, 3, 4);
  });
  tex(scene, DUST, 8, 8, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(2, 0, 4, 2);
    c.fillRect(0, 2, 8, 4);
    c.fillRect(2, 6, 4, 2);
    c.fillStyle = '#8eacc4';
    c.fillRect(0, 4, 2, 2);
    c.fillRect(2, 6, 4, 2);
  });
  tex(scene, FLASH, 40, 40, (c) => {
    c.fillStyle = '#ec4767';
    c.fillRect(18, 0, 4, 40);
    c.fillRect(0, 18, 40, 4);
    c.fillStyle = '#ffac38';
    c.fillRect(15, 7, 10, 26);
    c.fillRect(7, 15, 26, 10);
    for (const [x, y] of [[6, 6], [28, 6], [6, 28], [28, 28]]) c.fillRect(x, y, 6, 6);
    c.fillStyle = '#fff1ad';
    c.fillRect(13, 13, 14, 14);
    c.fillStyle = '#fff';
    c.fillRect(16, 10, 8, 20);
    c.fillRect(10, 16, 20, 8);
  });
  tex(scene, MUZZLE, 36, 24, (c) => {
    c.fillStyle = '#297fe6';
    c.fillRect(0, 9, 34, 6);
    c.fillRect(12, 3, 12, 18);
    c.fillStyle = '#55efff';
    c.fillRect(4, 7, 24, 10);
    c.fillRect(16, 0, 4, 24);
    c.fillRect(28, 10, 8, 4);
    c.fillStyle = '#e9ffff';
    c.fillRect(8, 10, 18, 4);
    c.fillRect(15, 6, 8, 12);
  });
  for (const key of [DOT, STREAK, DUST, FLASH, MUZZLE]) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * SNES action accents, all in world space so the world camera's pixel treatment applies.
 * Four pooled emitters and twelve reused sprites put a hard ceiling on effects even in a large fight.
 * The update observes the existing player's action timestamps; no gameplay hook needs replacing.
 */
export class RetroEffects {
  enabled = true;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private wakes: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private flashes: Flash[] = [];
  private nextFlash = 0;
  private now = 0;
  private trailDebt = 0;
  private lastBite = -1e9;
  private lastHurt = -1e9;
  private wasRamming = false;
  private destroyed = false;

  constructor(private scene: Phaser.Scene, private water = true) {
    textures(scene);
    this.dust = scene.add.particles(0, 0, DUST, {
      emitting: false, maxParticles: 48, maxAliveParticles: 36,
      lifespan: { min: 180, max: 380 }, speed: { min: 15, max: 65 },
      scale: { start: 0.6, end: 1.25 }, alpha: { start: 0.7, end: 0 },
      gravityY: water ? -10 : -60, tint: [0x69c7e4, 0x376ea4, 0xb4e4ea],
    }).setDepth(DEPTH.player - 1);
    this.wakes = scene.add.particles(0, 0, STREAK, {
      emitting: false, maxParticles: 56, maxAliveParticles: 40,
      lifespan: { min: 100, max: 230 }, speed: { min: 50, max: 100 },
      scale: { start: 1, end: 0.2 }, alpha: { start: 0.85, end: 0 },
      tint: CYAN, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.player - 0.5);
    this.sparks = scene.add.particles(0, 0, DOT, {
      emitting: false, maxParticles: 96, maxAliveParticles: 80,
      lifespan: { min: 100, max: 340 }, speed: { min: 70, max: 240 },
      scale: { start: 1.3, end: 0.3 }, alpha: { start: 1, end: 0 },
      gravityY: water ? 45 : 220, tint: ORANGE,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.fx + 1);
    this.motes = scene.add.particles(0, 0, DOT, {
      emitting: false, maxParticles: 48, maxAliveParticles: 40,
      lifespan: { min: 220, max: 550 }, speed: { min: 18, max: 75 },
      scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 },
      gravityY: -50, tint: CYAN, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.fx);
    this.dust.reserve(36);
    this.wakes.reserve(40);
    this.sparks.reserve(60);
    this.motes.reserve(24);
    for (let i = 0; i < 12; i++) {
      const image = scene.add.image(0, 0, FLASH).setDepth(DEPTH.fx + 2).setVisible(false);
      this.flashes.push({ image, born: 0, until: 0, size: 1 });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(time: number, delta: number, player?: RetroActor) {
    if (this.destroyed) return;
    this.now = time;
    for (const f of this.flashes) {
      if (!f.image.visible) continue;
      if (time >= f.until || !this.enabled) { f.image.setVisible(false); continue; }
      // Three deliberately discrete poses, closer to sprite animation than a smooth vector tween.
      const phase = (time - f.born) / (f.until - f.born);
      f.image.setScale(f.size * (phase < 0.25 ? 0.8 : phase < 0.65 ? 1.15 : 1.4)).setAlpha(phase < 0.65 ? 1 : 0.5);
    }
    if (!player) return;
    if (player.lastHurt > this.lastHurt) {
      this.lastHurt = player.lastHurt;
      if (this.enabled) {
        this.sparks.setParticleTint(MAGENTA);
        this.sparks.explode(14, Math.round(player.x), Math.round(player.y));
        this.flash(player.x, player.y, FLASH, 0.85, 135, 0xffa4ef);
      }
    }
    if (player.bitAt > this.lastBite) {
      this.lastBite = player.bitAt;
      this.muzzle(player.x + player.facing * Math.max(18, player.bodyLen * 0.5), player.y, player.facing);
    }
    const active = this.enabled && !player.dead && player.speed01 > 0.6 && (player.sprinting || player.isRamming);
    if (active) {
      const ram = player.isRamming;
      this.trailDebt += Math.min(50, Math.max(0, delta));
      if (this.trailDebt >= (ram ? 48 : 80)) {
        this.trailDebt = 0;
        this.dash(player.x - player.facing * Math.max(16, player.bodyLen * 0.55), player.y + (player.inWater ? 0 : 10), player.facing, ram);
      }
      if (ram && !this.wasRamming) this.energy(player.x, player.y, 7);
    } else this.trailDebt = 0;
    this.wasRamming = player.isRamming;
  }

  /** A crisp rearward plume, cyan for a ram and blue dust/bubbles for a sprint. */
  dash(x: number, y: number, facing: number, strong = false) {
    if (!this.enabled || this.destroyed) return;
    const emitter = strong ? this.wakes : this.dust;
    const n = strong ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const p = emitter.emitParticleAt(Math.round(x), Math.round(y + (Math.random() - 0.5) * 18), 1);
      if (p) {
        p.velocityX = -facing * (40 + Math.random() * (strong ? 150 : 80));
        p.velocityY = (Math.random() - 0.5) * (strong ? 90 : 55) - (this.water ? 0 : 25);
      }
    }
  }

  /** The fish's bite is an action flash at the mouth; this also serves future projectiles. */
  muzzle(x: number, y: number, facing: number, power = 1) {
    if (!this.enabled || this.destroyed) return;
    this.flash(x, y, MUZZLE, Math.min(1.5, 0.75 + Math.max(0, power) * 0.2), 100, 0xffffff, facing < 0);
    this.motes.explode(3, Math.round(x), Math.round(y));
  }

  /** Orange-white contact star and short-lived sparks. Call once per actual hit, not every overlap frame. */
  hit(x: number, y: number, strength = 1) {
    if (!this.enabled || this.destroyed) return;
    const k = Phaser.Math.Clamp(strength, 0.25, 2);
    this.sparks.setParticleTint(ORANGE);
    this.sparks.explode(Math.round(8 + k * 6), Math.round(x), Math.round(y));
    this.flash(x, y, FLASH, 0.7 + k * 0.3, 145);
  }

  energy(x: number, y: number, count = 8) {
    if (!this.enabled || this.destroyed) return;
    this.motes.explode(Phaser.Math.Clamp(Math.round(count), 1, 24), Math.round(x), Math.round(y));
  }

  private flash(x: number, y: number, key: string, size: number, duration: number, tint = 0xffffff, flip = false) {
    const f = this.flashes[this.nextFlash++ % this.flashes.length];
    f.born = this.now || this.scene.time.now;
    f.until = f.born + duration;
    f.size = size;
    f.image.setTexture(key).setPosition(Math.round(x), Math.round(y)).setFlipX(flip).setTint(tint).setAlpha(1).setScale(size).setVisible(true);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    for (const e of [this.dust, this.wakes, this.sparks, this.motes]) e.destroy();
    for (const f of this.flashes) f.image.destroy();
    this.flashes.length = 0;
  }
}
