import Phaser from 'phaser';
import type { Stats } from '../data/classes';
import { game, bus } from '../state/GameState';
import { audio } from '../audio/Audio';
import { CreatureView } from './CreatureView';
import type { Controls } from './Controls';
import { approach, clamp, type Rect } from '../util/math';
import { DEPTH } from '../config';

export interface PlayerHost extends Phaser.Scene {
  playerBite(rect: Rect): void;
  floatText(x: number, y: number, s: string, color: string, size?: number): void;
  puff(x: number, y: number, n: number, tint?: number): void;
  solidAt(x: number, y: number): boolean;
  surfaceY: number;
}

type Body = Phaser.Physics.Arcade.Body;

export class Player {
  rect: Phaser.GameObjects.Rectangle;
  view: CreatureView;
  stats!: Stats;
  hp = 1;
  facing = 1;
  dead = false;
  private invulnUntil = 0;
  private biteReady = 0;
  private hornReady = 0;
  dashUntil = 0;
  dashHit = new Set<object>();
  private knockUntil = 0;
  private lastGround = -1e9;
  private jumpBuf = -1e9;
  private jumpCut = false;
  private wasGround = false;
  private swimSfx = 0;
  lastSafe = { x: 0, y: 0 };
  private offY = 0;

  constructor(private host: PlayerHost, x: number, y: number, readonly water: boolean) {
    this.rect = host.add.rectangle(x, y, 40, 30, 0xff0000, 0);
    host.physics.add.existing(this.rect);
    const b = this.body;
    b.setCollideWorldBounds(true);
    if (water) b.setAllowGravity(false);
    this.view = new CreatureView(host, x, y, game.appearance());
    this.view.setDepth(DEPTH.player);
    this.refresh(true);
    this.lastSafe = { x, y };
  }

  get body() {
    return this.rect.body as Body;
  }

  get x() {
    return this.rect.x;
  }

  get y() {
    return this.rect.y;
  }

  /** Nach einer Evolution: Aussehen, Werte und Körpergröße neu setzen. */
  refresh(full = false) {
    this.stats = game.stats();
    this.view.build(game.appearance());
    const L = this.view.L;
    const w = L.halfW * 2;
    const h = L.footY - L.topY;
    const oldBottom = this.body.bottom;
    this.rect.setSize(w, h);
    this.body.setSize(w, h);
    if (!this.water && !full) this.rect.y = oldBottom - h / 2;
    this.offY = -(L.topY + L.footY) / 2;
    this.hp = full ? this.stats.hp : Math.min(this.stats.hp, Math.max(this.hp, this.stats.hp));
    bus.emit('hp', this.hp, this.stats.hp);
  }

  hitRect(): Rect {
    const b = this.body;
    return { x: b.x + 4, y: b.y + 4, w: b.width - 8, h: b.height - 6 };
  }

  biteRect(): Rect {
    const L = this.view.L;
    const bx = this.rect.x, by = this.rect.y + this.offY;
    const r = L.bite;
    return this.facing > 0
      ? { x: bx + r.x, y: by + r.y, w: r.w, h: r.h }
      : { x: bx - r.x - r.w, y: by + r.y, w: r.w, h: r.h };
  }

  get invulnerable() {
    return this.host.time.now < this.invulnUntil || this.dashing;
  }

  get dashing() {
    return this.host.time.now < this.dashUntil;
  }

  update(time: number, dt: number, c: Controls) {
    const b = this.body;
    if (this.dead) {
      this.syncView(dt, 'idle', 0);
      return;
    }
    const knocked = time < this.knockUntil;
    const dir = (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0);
    const sp = this.stats.speed;

    if (this.water) {
      const dy = (c.held.down ? 1 : 0) - (c.held.up || c.held.jump ? 1 : 0);
      if (!knocked && !this.dashing) {
        const len = Math.hypot(dir, dy) || 1;
        b.setVelocity(approach(b.velocity.x, (dir / len) * sp, 900 * dt), approach(b.velocity.y, (dy / len) * sp * 0.9 + (dy ? 0 : 6), 900 * dt));
      }
      if (dir) this.facing = dir;
      if (this.rect.y - b.height / 2 < this.host.surfaceY + 4 && b.velocity.y < 0) b.setVelocityY(Math.max(0, b.velocity.y));
      const moving = Math.hypot(b.velocity.x, b.velocity.y);
      if (moving > 60 && time > this.swimSfx) {
        this.swimSfx = time + 700;
        if (Math.random() < 0.5) this.host.puff(this.x - this.facing * 30, this.y, 1, 0xffffff);
      }
      this.view.rotation = this.facing * clamp(b.velocity.y / (sp || 1), -1, 1) * 0.35;
    } else {
      const onGround = b.blocked.down || b.touching.down;
      if (onGround) {
        this.lastGround = time;
        if (!this.wasGround && b.velocity.y >= 0) this.host.puff(this.x, b.bottom, 3);
      }
      this.wasGround = onGround;
      if (!knocked && !this.dashing) {
        b.setVelocityX(approach(b.velocity.x, dir * sp, (onGround ? 2600 : 1600) * dt));
      }
      if (dir && !this.dashing) this.facing = dir;
      if (c.pressed.jump) this.jumpBuf = time;
      if (time - this.jumpBuf < 130 && time - this.lastGround < 110 && !knocked) {
        b.setVelocityY(-this.stats.jump);
        this.jumpBuf = -1e9;
        this.lastGround = -1e9;
        this.jumpCut = false;
        audio.sfx('jump');
      }
      if (!c.held.jump && b.velocity.y < -150 && !this.jumpCut) {
        b.setVelocityY(b.velocity.y * 0.5);
        this.jumpCut = true;
      }
      if (b.velocity.y > 950) b.setVelocityY(950);
      // Rücksetzpunkt nur auf sicherem Boden (nicht direkt an einer Kante)
      if (onGround && !this.dashing && time > this.invulnUntil) {
        const by = b.bottom + 6;
        if (this.host.solidAt(b.x - 30, by) && this.host.solidAt(b.right + 30, by)) this.lastSafe = { x: this.rect.x, y: this.rect.y };
      }
      this.view.rotation = 0;
    }

    // Biss
    if (c.pressed.bite && time >= this.biteReady) {
      this.biteReady = time + 300;
      this.view.bite();
      audio.sfx('bite');
      this.host.time.delayedCall(60, () => !this.dead && this.host.playerBite(this.biteRect()));
    }
    // Hornstoß
    if (c.pressed.horn) {
      if (this.stats.horn <= 0) {
        if (!this.hornHint) {
          this.hornHint = true;
          this.host.floatText(this.x, this.y - 50, 'Kein Horn! (Evolution → Horn)', '#ffd0a0', 18);
        }
      } else if (time >= this.hornReady) {
        this.hornReady = time + 750;
        this.dashUntil = time + 260;
        this.dashHit.clear();
        b.setVelocityX(this.facing * Math.max(sp * 2.3, 440));
        if (this.water) b.setVelocityY(b.velocity.y * 0.3);
        else if (b.velocity.y > -60) b.setVelocityY(-60);
        audio.sfx('dash');
        this.host.puff(this.x - this.facing * 20, this.y + 10, 4);
      }
    }
    this.view.headTilt = this.dashing ? 0.28 : 0;

    const speed = Math.abs(b.velocity.x);
    let mode: 'swim' | 'walk' | 'air' | 'idle' = 'idle';
    if (this.water) mode = 'swim';
    else if (!(b.blocked.down || b.touching.down)) mode = 'air';
    else if (speed > 25) mode = 'walk';
    const s01 = this.water ? Math.min(1, Math.hypot(b.velocity.x, b.velocity.y) / sp) : Math.min(1, speed / sp);
    this.syncView(dt, mode, s01);

    // Unverwundbar: blinken
    this.view.setAlpha(time < this.invulnUntil ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : 1);
  }

  private hornHint = false;

  private syncView(dt: number, mode: 'swim' | 'walk' | 'air' | 'idle', s01: number) {
    this.view.setPosition(this.rect.x, this.rect.y + this.offY);
    this.view.setFacing(this.facing);
    this.view.animate(dt, mode, s01);
  }

  hurt(dmg: number, fromX: number) {
    if (this.dead || this.invulnerable) return;
    const d = Math.max(1, Math.round(dmg - this.stats.def));
    this.hp = Math.max(0, this.hp - d);
    const now = this.host.time.now;
    this.invulnUntil = now + 950;
    this.knockUntil = now + 220;
    const s = Math.sign(this.rect.x - fromX) || -this.facing;
    this.body.setVelocity(s * 300, this.water ? -60 : -280);
    this.view.flash(0xff6060);
    this.host.time.delayedCall(120, () => this.view.flash(null));
    audio.sfx('hurt');
    this.host.cameras.main.shake(120, 0.006);
    this.host.floatText(this.x, this.y - 40, `-${d}`, '#ff6a6a', 26);
    bus.emit('hp', this.hp, this.stats.hp);
    if (this.hp <= 0) this.die();
  }

  heal(n: number) {
    if (this.dead) return;
    this.hp = Math.min(this.stats.hp, this.hp + n);
    bus.emit('hp', this.hp, this.stats.hp);
  }

  private die() {
    this.dead = true;
    this.body.setVelocity(0, this.water ? -40 : -300);
    audio.sfx('death');
    this.host.tweens.add({ targets: this.view, angle: this.facing * 180, alpha: 0.4, duration: 900, ease: 'Sine.in' });
    this.host.events.emit('player-dead');
  }
}
