import Phaser from 'phaser';
import type { EnemyDef } from '../data/enemies';
import { enemyKey } from '../art/enemyArt';
import { audio } from '../audio/Audio';
import { DEPTH, GRAVITY } from '../config';
import { clamp, type Rect } from '../util/math';
import type { Player } from './Player';

type Body = Phaser.Physics.Arcade.Body;

export interface EnemyHost extends Phaser.Scene {
  player: Player;
  water: boolean;
  arena?: { x0: number; x1: number; floor: number };
  solidAt(x: number, y: number): boolean;
  shoot(x: number, y: number, vx: number, vy: number, tex: string, dmg: number, gravity: boolean): void;
  spawnEnemy(id: string, x: number, y: number): Enemy;
  enemyKilled(e: Enemy): void;
  floatText(x: number, y: number, s: string, color: string, size?: number): void;
  puff(x: number, y: number, n: number, tint?: number): void;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  dir = -1;
  dead = false;
  protected host: EnemyHost;
  protected t = 0;
  protected st = 'walk';
  protected stT = 0;
  protected next = 0;
  protected homeX: number;
  protected homeY: number;
  protected phase = Math.random() * 6;
  protected knockUntil = 0;
  protected target = { x: 0, y: 0 };

  constructor(host: EnemyHost, def: EnemyDef, x: number, y: number) {
    super(host, x, y, enemyKey(def.id, 0));
    this.host = host;
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.homeX = x;
    this.homeY = y;
    host.add.existing(this);
    host.physics.add.existing(this);
    const [fw, fh] = def.hit ?? [0.8, 0.8];
    const w = this.width * fw, h = this.height * fh;
    const b = this.body as Body;
    b.setSize(w, h);
    const grounded = (!def.air && !host.water) || def.move === 'crawl';
    b.setOffset((this.width - w) / 2, grounded ? this.height - h : (this.height - h) / 2);
    if (def.air || (host.water && def.move !== 'crawl')) b.setAllowGravity(false);
    if (host.water && def.move === 'crawl') b.setGravityY(900);
    b.setCollideWorldBounds(true);
    this.play(`anim_${def.id}`);
    this.anims.setProgress(Math.random());
    this.setDepth(DEPTH.enemies);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.next = host.time.now + 800 + Math.random() * 1500;
  }

  get b() {
    return this.body as Body;
  }

  hitRect(): Rect {
    const b = this.b;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  protected go(st: string) {
    this.st = st;
    this.stT = 0;
  }

  protected get onFloor() {
    return this.b.blocked.down || this.b.touching.down;
  }

  tick(time: number, dt: number) {
    if (this.dead) return;
    this.t += dt;
    this.stT += dt;
    if (time < this.knockUntil) return;
    this.behave(time, dt);
    this.setFlipX(this.dir < 0);
  }

  protected behave(time: number, _dt: number) {
    const d = this.def;
    const p = this.host.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const sp = d.speed;
    const b = this.b;
    const alive = !p.dead;
    switch (d.move) {
      case 'patrol':
      case 'crawl':
        this.walk(sp);
        break;
      case 'chase':
        if (alive && Math.abs(dx) < 380 && Math.abs(dy) < 160) {
          this.dir = Math.sign(dx) || this.dir;
          this.walk(sp * 1.5, true);
          if ((b.blocked.left || b.blocked.right) && this.onFloor) b.setVelocityY(-480);
        } else this.walk(sp * 0.55);
        break;
      case 'hop':
        if (this.onFloor) {
          b.setVelocityX(0);
          if (time > this.next) {
            if (alive && Math.abs(dx) < 420) this.dir = Math.sign(dx) || this.dir;
            else if (Math.random() < 0.35) this.dir *= -1;
            if (!this.host.solidAt(this.x + this.dir * 70, b.bottom + 8)) this.dir *= -1;
            b.setVelocity(this.dir * sp, -430 - Math.random() * 140);
            this.next = time + 900 + Math.random() * 700;
          }
        }
        if (b.blocked.left) this.dir = 1;
        else if (b.blocked.right) this.dir = -1;
        break;
      case 'charge':
        switch (this.st) {
          case 'walk':
            this.walk(sp * 0.6);
            if (alive && Math.abs(dx) < 400 && Math.abs(dy) < 90 && Math.sign(dx) === this.dir) {
              this.go('wind');
              this.setTint(0xff9a8a);
            }
            break;
          case 'wind':
            b.setVelocityX(0);
            this.setScale(1 + Math.sin(this.stT * 40) * 0.04, 1);
            if (this.stT > 0.55) {
              this.setScale(1);
              this.clearTint();
              this.go('run');
            }
            break;
          case 'run':
            b.setVelocityX(this.dir * sp * 3.6);
            if (Math.random() < 0.3) this.host.puff(this.x - this.dir * 20, b.bottom, 1);
            if (b.blocked.left || b.blocked.right || this.stT > 1.6 || !this.host.solidAt(this.x + this.dir * (b.halfWidth + 8), b.bottom + 8)) {
              b.setVelocityX(0);
              this.go('rest');
            }
            break;
          default:
            b.setVelocityX(0);
            if (this.stT > 0.9) this.go('walk');
        }
        break;
      case 'shoot':
        if (alive && Math.abs(dx) < 560 && Math.abs(dy) < 320) {
          this.dir = Math.sign(dx) || this.dir;
          b.setVelocityX(0);
          if (time > this.next) {
            this.next = time + (d.shot?.every ?? 2000);
            this.fire(p.x, p.y);
          }
        } else this.walk(sp);
        break;
      case 'fly':
        this.fly(sp);
        if (d.shot && alive && dist < 520 && time > this.next) {
          this.next = time + d.shot.every;
          this.fire(p.x, p.y);
        }
        break;
      case 'swoop':
        if (this.st === 'dive') {
          const a = Math.atan2(this.target.y - this.y, this.target.x - this.x);
          b.setVelocity(Math.cos(a) * sp * 2.6, Math.sin(a) * sp * 2.6);
          this.dir = Math.sign(b.velocity.x) || this.dir;
          if (this.stT > 0.9 || Math.hypot(this.target.x - this.x, this.target.y - this.y) < 24) this.go('rise');
        } else if (this.st === 'rise') {
          b.setVelocity(this.dir * sp * 0.6, -sp * 1.3);
          if (this.y <= this.homeY || this.stT > 1.6) {
            this.go('walk');
            this.next = time + 1600;
          }
        } else {
          this.fly(sp);
          if (alive && time > this.next && Math.abs(dx) < 280 && dy > 40 && dy < 380) {
            this.target = { x: p.x, y: p.y };
            this.go('dive');
            audio.sfx('buzz');
          }
        }
        break;
      case 'float':
        if (alive && dist < 460) {
          const a = Math.atan2(dy, dx);
          b.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp + Math.sin(this.t * 3) * 25);
          this.dir = Math.sign(dx) || this.dir;
        } else this.fly(sp * 0.6);
        break;
      case 'swim':
        this.swim(sp);
        break;
      case 'swimChase':
        if (alive && dist < 300) {
          const a = Math.atan2(dy, dx);
          b.setVelocity(Math.cos(a) * sp * 1.3, Math.sin(a) * sp * 1.3);
          this.dir = Math.sign(dx) || this.dir;
        } else this.swim(sp * 0.7);
        break;
      case 'drift':
        b.setVelocity(Math.sin(this.t * 0.5 + this.phase) * sp * 0.7, Math.sin(this.t * 1.3 + this.phase) * sp * 1.3);
        this.setScale(1 + Math.sin(this.t * 2.6) * 0.06, 1 - Math.sin(this.t * 2.6) * 0.06);
        break;
      default:
        break;
    }
  }

  protected walk(speed: number, chasing = false) {
    const b = this.b;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    if (this.onFloor && !this.host.solidAt(this.x + this.dir * (b.halfWidth + 6), b.bottom + 8)) {
      if (chasing) {
        b.setVelocityX(0);
        return;
      }
      this.dir *= -1;
    }
    b.setVelocityX(this.dir * speed);
  }

  protected fly(speed: number) {
    if (this.x > this.homeX + 180) this.dir = -1;
    else if (this.x < this.homeX - 180) this.dir = 1;
    if (this.b.blocked.left) this.dir = 1;
    else if (this.b.blocked.right) this.dir = -1;
    this.b.setVelocity(this.dir * speed, Math.cos(this.t * 2 + this.phase) * 40 + (this.homeY - this.y) * 0.8);
  }

  protected swim(speed: number) {
    const b = this.b;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    if (this.x > this.homeX + 220) this.dir = -1;
    else if (this.x < this.homeX - 220) this.dir = 1;
    b.setVelocity(this.dir * speed, Math.cos(this.t * 2 + this.phase) * 28 + (this.homeY - this.y) * 0.5);
  }

  /** Schießt auf ein Ziel (im Bogen oder gerade). */
  protected fire(tx: number, ty: number, tex = this.def.shot?.tex ?? 'pr_slime', dmg = this.def.shot?.dmg ?? this.def.dmg, speed = this.def.shot?.speed ?? 300) {
    const ox = this.x + this.dir * this.width * 0.35;
    const oy = this.y - this.height * 0.15;
    if (this.def.shot?.arc && !this.host.water) {
      const T = clamp(Math.abs(tx - ox) / speed, 0.45, 1.3);
      const vx = (tx - ox) / T;
      const vy = (ty - oy - 0.5 * GRAVITY * T * T) / T;
      this.host.shoot(ox, oy, vx, vy, tex, dmg, true);
    } else {
      const a = Math.atan2(ty - oy, tx - ox);
      this.host.shoot(ox, oy, Math.cos(a) * speed, Math.sin(a) * speed, tex, dmg, false);
    }
    audio.sfx('shoot');
  }

  /** Schaden nehmen. Gibt true zurück, wenn der Gegner dabei stirbt. */
  damage(amount: number, fromX: number, knock = 220): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.host.time.delayedCall(90, () => {
      if (this.active) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
    this.host.floatText(this.x, this.y - this.height * 0.5, `${amount}`, '#ffffff', 22);
    if (!this.def.boss) {
      this.knockUntil = this.host.time.now + 200;
      const s = Math.sign(this.x - fromX) || 1;
      this.b.setVelocity(s * knock, this.def.air || this.host.water ? -knock * 0.25 : -170);
    }
    if (this.hp <= 0) {
      this.kill();
      return true;
    }
    audio.sfx('hit');
    return false;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.b.enable = false;
    audio.sfx('enemyDie');
    this.host.enemyKilled(this);
    this.host.tweens.add({
      targets: this,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0,
      angle: this.dir * 90,
      duration: 260,
      onComplete: () => this.destroy(),
    });
  }
}
