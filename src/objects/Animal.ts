import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { speciesKey } from '../art/speciesArt';
import { audio } from '../audio/Audio';
import { DEPTH } from '../config';
import { clamp, overlaps, type Rect } from '../util/math';
import type { Carcass, Plant } from './Food';

type Body = Phaser.Physics.Arcade.Body;

/** Was ein Tier über den Spieler wissen muss. */
export interface PlayerLike {
  x: number;
  y: number;
  dead: boolean;
  /** bewegt sich gerade schnell */
  fast: boolean;
  /** still im Dickicht versteckt */
  hidden: boolean;
  hitRect(): Rect;
  hurt(dmg: number, fromX: number): void;
}

/** Die Welt, in der die Tiere leben (wird vom Level bereitgestellt). */
export interface World extends Phaser.Scene {
  player: PlayerLike;
  water: boolean;
  animals: Animal[];
  plants: Plant[];
  carcasses: Carcass[];
  territory?: { x0: number; x1: number; floor: number };
  solidAt(x: number, y: number): boolean;
  shoot(x: number, y: number, vx: number, vy: number, tex: string, dmg: number, gravity: boolean): void;
  animalDied(a: Animal, byPlayer: boolean): void;
  puff(x: number, y: number, n: number, tint?: number): void;
  bleed(x: number, y: number, n: number): void;
  /** Wie gut dieses Tier den Spieler sehen kann (Faktor auf seine Sichtweite). */
  detectFactor(a: Animal): number;
  /** Wie gefährlich der Spieler wirkt. */
  playerThreat(): number;
  /** Ruf des Spielers (0 friedlich … 1 gefürchtet). */
  playerFear(): number;
  /** Ein Jäger hat den Spieler aus den Augen verloren. */
  playerEscaped(a: Animal): void;
}

type St = 'wander' | 'idle' | 'graze' | 'flee' | 'hunt' | 'search' | 'warn' | 'charge' | 'rest';
type Target = Animal | PlayerLike;

const APEX_MOVES: Record<string, string[]> = {
  dunkleosteus: ['lunge', 'charge'],
  meganeura: ['dive', 'dive', 'lunge'],
  trex: ['lunge', 'charge', 'roar'],
  saebelzahn: ['pounce', 'lunge', 'pounce'],
  andrewsarchus: ['lunge', 'charge', 'roar'],
};

export class Animal extends Phaser.Physics.Arcade.Sprite {
  def: SpeciesDef;
  hp: number;
  maxHp: number;
  dir = 1;
  dead = false;
  st: St = 'wander';
  stT = 0;
  hunger: number;
  home: { x: number; y: number };
  target: Target | null = null;
  seesPlayer = false;
  alerted = false;
  huntingPlayer = false;
  /** bei einem Angriff gefährlich bei Berührung */
  attacking = false;
  private world: World;
  private t = 0;
  private threatObj: Target | null = null;
  private food: Plant | Carcass | null = null;
  private attacker: Target | null = null;
  private attackedAt = -1e9;
  private lastSeen = { x: 0, y: 0 };
  private nextSense = 0;
  private biteReady = 0;
  private stunUntil = 0;
  private knockUntil = 0;
  private wanderAt = 0;
  private wanderX = 0;
  private wanderY = 0;
  private feedAt = 0;
  private phase = Math.random() * 6;
  private mv = '';
  private mvT = 0;
  private mvDir = { x: 1, y: 0 };
  private nextMove = 0;
  private weak = 1;
  private roared = false;

  constructor(world: World, def: SpeciesDef, x: number, y: number) {
    super(world, x, y, speciesKey(def.id, 0));
    this.world = world;
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.hunger = 0.15 + Math.random() * 0.5;
    this.home = { x, y };
    this.wanderX = x;
    this.wanderY = y;
    world.add.existing(this);
    world.physics.add.existing(this);
    const [fw, fh] = def.hit ?? [0.8, 0.8];
    const w = this.width * fw, h = this.height * fh;
    const b = this.b;
    b.setSize(w, h);
    const flies = def.habitat === 'air';
    const swims = world.water && !def.crawl;
    b.setOffset((this.width - w) / 2, flies || swims ? (this.height - h) / 2 : this.height - h);
    if (flies || swims) b.setAllowGravity(false);
    if (world.water && def.crawl) b.setGravityY(900);
    b.setCollideWorldBounds(true);
    this.play(`anim_${def.id}`);
    this.anims.setProgress(Math.random());
    this.setDepth(DEPTH.enemies);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextSense = world.time.now + Math.random() * 300;
  }

  get b() {
    return this.body as Body;
  }

  get role() {
    return this.def.role;
  }

  hitRect(): Rect {
    const b = this.b;
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  private get flies() {
    return this.def.habitat === 'air';
  }

  private get swims() {
    return this.world.water && !this.def.crawl;
  }

  private get onFloor() {
    return this.b.blocked.down || this.b.touching.down;
  }

  private go(st: St) {
    if (this.st === st) return;
    this.st = st;
    this.stT = 0;
  }

  private dist(o: { x: number; y: number }) {
    return Math.hypot(o.x - this.x, o.y - this.y);
  }

  // ------------------------------------------------------------------ Ablauf

  tick(time: number, dt: number) {
    if (this.dead) return;
    this.t += dt;
    this.stT += dt;
    this.hunger = Math.min(1, this.hunger + dt * (this.def.diet === 'meat' ? 0.012 : 0.009));
    if (time < this.stunUntil) {
      this.b.setVelocityX(this.b.velocity.x * 0.92);
      if (this.swims || this.flies) this.b.setVelocityY(this.b.velocity.y * 0.92);
      this.setAngle(Math.sin(this.t * 30) * 4);
      return;
    }
    if (this.angle && !this.mv) this.setAngle(0);
    if (time < this.knockUntil) return;
    if (time > this.nextSense) {
      this.nextSense = time + 220 + Math.random() * 90;
      this.sense(time);
    }
    this.think(time, dt);
    this.setFlipX(this.dir < 0);
  }

  // ------------------------------------------------------------------ Wahrnehmen

  private sense(time: number) {
    const W = this.world;
    const p = W.player;
    const role = this.role;
    const d = this.def;
    const dp = this.dist(p);
    const feeding = this.st === 'graze';
    let k = W.detectFactor(this) * (feeding ? 0.7 : 1);
    // Im eigenen Revier entgeht dem Spitzenräuber kaum etwas – außer man versteckt sich
    const A = W.territory;
    if (role === 'apex' && A && !p.hidden && p.x > A.x0 && p.x < A.x1) k = Math.max(k, 0.85);
    const seen = !p.dead && role !== 'hazard' && dp < d.sense * k;
    this.seesPlayer = seen;
    if (seen) {
      this.lastSeen = { x: p.x, y: p.y };
      this.alerted = true;
    } else if (this.alerted && dp > d.sense * 1.4) this.alerted = false;
    const T = W.playerThreat();
    let threat: Target | null = null;
    let threatD = Infinity;
    if (seen) {
      if (role === 'prey') {
        const fear = W.playerFear();
        const fleeR = d.sense * (0.22 + 0.78 * fear) + (p.fast ? 70 : 0);
        if (T > d.power * 1.15 && dp < fleeR) {
          threat = p;
          threatD = dp;
        }
      } else if (role === 'predator') {
        if (T > d.power * 1.8 && dp < d.sense * 0.8) {
          threat = p;
          threatD = dp;
        }
      }
    }
    if ((role === 'prey' || role === 'predator') && this.attacker === p && time - this.attackedAt < 8000 && !p.dead) {
      if (role === 'prey' || T > d.power * 1.2) {
        threat = p;
        threatD = dp;
      }
    }
    for (const a of W.animals) {
      if (a === this || a.dead || a.def.id === d.id) continue;
      const da = this.dist(a);
      if (da > d.sense || da >= threatD) continue;
      if (role === 'prey' && (a.role === 'predator' || a.role === 'apex') && da < d.sense * 0.75) {
        threat = a;
        threatD = da;
      } else if (role === 'predator' && a.role === 'apex' && a.def.power > d.power * 1.5 && da < 260) {
        threat = a;
        threatD = da;
      }
    }
    this.threatObj = threat;

    // Jagdziel
    if (role === 'predator' || role === 'apex') {
      let best: Target | null = null;
      let bd = Infinity;
      const hungry = role === 'apex' || this.hunger > 0.35;
      if (hungry) {
        const bold = this.hunger > 0.75 ? 1.4 : 1.15;
        if (seen && (role === 'apex' || T < d.power * bold)) {
          best = p;
          bd = dp * 0.9;
        }
        for (const a of W.animals) {
          if (a === this || a.dead || a.def.id === d.id) continue;
          if (a.role !== 'prey' && !(role === 'apex' && a.role !== 'apex' && a.role !== 'hazard')) continue;
          if (a.def.power > d.power) continue;
          if (a.flies && !this.flies && !this.swims) continue;
          const da = this.dist(a);
          if (da < d.sense * 0.85 && da < bd) {
            best = a;
            bd = da;
          }
        }
      }
      if (this.attacker && time - this.attackedAt < 6000 && !this.attacker.dead) {
        if (this.attacker !== p || role === 'apex' || T < d.power * 1.6) best = this.attacker;
      }
      if (this.target === p && best !== p && p.dead === false && !seen) {
        // gerade aus den Augen verloren
      }
      this.target = best;
    }

    // Nahrung
    this.food = null;
    if (this.hunger > 0.3 && !this.target) {
      let fd = Infinity;
      if (this.def.diet === 'plant') {
        for (const pl of W.plants) {
          if (pl.units <= 0) continue;
          const dd = this.dist(pl);
          if (dd < 380 && dd < fd && (this.swims || this.flies || Math.abs(pl.y - this.b.bottom) < 90)) {
            this.food = pl;
            fd = dd;
          }
        }
      } else if (this.def.diet === 'meat') {
        for (const c of W.carcasses) {
          if (c.gone || c.units <= 0) continue;
          const dd = this.dist(c);
          if (dd < d.sense && dd < fd) {
            this.food = c;
            fd = dd;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ Entscheiden

  private think(time: number, dt: number) {
    const role = this.role;
    this.attacking = false;
    if (role === 'hazard') return this.drift();
    if (role === 'defender') return this.thinkDefender(time);
    if (role === 'apex') return this.thinkApex(time, dt);

    if (this.threatObj) {
      if (this.st !== 'flee' && role === 'prey' && Math.random() < 0.3) audio.sfx('scurry');
      this.go('flee');
    }
    if (this.st === 'flee') {
      const th = this.threatObj;
      if (th) {
        this.runFrom(th.x, th.y, this.def.speed * (this.def.sprint ?? 1.3));
      } else if (this.stT > 1.4) this.go('wander');
      else this.moveTo(this.x + this.dir * 200, this.y, this.def.speed * (this.def.sprint ?? 1.3), true);
      if (this.stT > 7) this.go('wander');
      return;
    }
    if (role === 'predator' && this.target) {
      if (this.st !== 'hunt') {
        this.go('hunt');
        this.huntingPlayer = this.target === this.world.player;
      }
      this.chase(this.target, this.def.speed * 1.25);
      this.tryBite(time, this.target);
      return;
    }
    if (this.st === 'hunt') {
      if (this.huntingPlayer && !this.world.player.dead) this.world.playerEscaped(this);
      this.huntingPlayer = false;
      this.go('search');
    }
    if (this.st === 'search') {
      this.moveTo(this.lastSeen.x, this.lastSeen.y, this.def.speed * 0.7);
      if (this.stT > 2.5 || this.dist(this.lastSeen) < 30) this.go('wander');
      return;
    }
    if (this.food) return this.eatFood(time);
    this.wander(time);
  }

  private eatFood(time: number) {
    const f = this.food!;
    const fy = 'def' in f ? f.y - 10 : f.y - 20;
    if (this.dist({ x: f.x, y: fy }) < this.width * 0.5 + 24) {
      this.go('graze');
      this.halt();
      this.dir = Math.sign(f.x - this.x) || this.dir;
      if (time > this.feedAt) {
        this.feedAt = time + 1300;
        if (f.take(time)) {
          this.hunger = Math.max(0, this.hunger - ('def' in f ? 0.35 : 0.25));
          this.world.puff(f.x, f.y - 14, 3, 'def' in f ? 0x6a1a10 : 0x6a7a3a);
        }
      }
    } else this.moveTo(f.x, fy, this.def.speed * 0.8);
  }

  private thinkDefender(time: number) {
    const W = this.world;
    const p = W.player;
    let provoker: Target | null = null;
    if (this.attacker && time - this.attackedAt < 7000 && !this.attacker.dead) provoker = this.attacker;
    else if (this.seesPlayer && this.dist(p) < 130 && (W.playerFear() > 0.35 || p.fast)) provoker = p;
    else {
      for (const a of W.animals) {
        if (a !== this && !a.dead && a.role === 'predator' && this.dist(a) < 140) provoker = a;
      }
    }
    switch (this.st) {
      case 'warn':
        this.halt();
        if (provoker) this.dir = Math.sign(provoker.x - this.x) || this.dir;
        this.setScale(1 + Math.sin(this.stT * 30) * 0.03, 1);
        if (this.stT > 0.9) {
          this.setScale(1);
          this.target = provoker;
          this.go(provoker ? 'charge' : 'wander');
        }
        return;
      case 'charge': {
        this.attacking = true;
        const tg = this.target;
        if (tg && this.stT < 0.25) this.dir = Math.sign(tg.x - this.x) || this.dir;
        if (this.swims) this.b.setVelocity(this.dir * this.def.speed * 3, 0);
        else this.b.setVelocityX(this.dir * this.def.speed * 3.2);
        if (tg && !tg.dead && overlaps(this.hitRect(), tg.hitRect()) && time > this.biteReady) {
          this.biteReady = time + 900;
          if (tg === p) p.hurt(this.def.dmg * 1.3, this.x);
          else (tg as Animal).hurt(this.def.dmg * 1.3, this, 'ram');
          audio.sfx('ram');
          this.go('rest');
        }
        if (this.stT > 1.4 || this.b.blocked.left || this.b.blocked.right) this.go('rest');
        return;
      }
      case 'rest':
        this.halt();
        if (this.stT > 1.3) this.go('wander');
        return;
    }
    if (provoker) {
      this.go('warn');
      audio.sfx('warn');
      return;
    }
    if (this.food) return this.eatFood(time);
    this.wander(time);
  }

  // ------------------------------------------------------------------ Spitzenräuber

  private thinkApex(time: number, dt: number) {
    const W = this.world;
    const p = W.player;
    const A = W.territory;
    if (this.mv) return this.apexMove(time, dt);
    const tg = this.target;
    if (tg && !tg.dead) {
      if (tg === p && !this.huntingPlayer) {
        this.huntingPlayer = true;
        if (!this.roared) {
          this.roared = true;
          audio.sfx('roar');
          W.cameras.main.shake(500, 0.008);
        }
      }
      if (this.st !== 'hunt') this.go('hunt');
      // Revier nicht verlassen
      if (A && (tg.x < A.x0 + 30 || tg.x > A.x1 - 30) && Math.abs(tg.x - this.x) > 120) {
        this.halt();
        this.dir = Math.sign(tg.x - this.x) || this.dir;
        if (this.stT > 2.5) {
          this.target = null;
          if (this.huntingPlayer) W.playerEscaped(this);
          this.huntingPlayer = false;
          this.go('wander');
        }
        return;
      }
      this.chase(tg, this.def.speed * 1.1);
      this.tryBite(time, tg);
      const d = this.dist(tg);
      if (time > this.nextMove && d < 460) {
        const moves = APEX_MOVES[this.def.id] ?? ['lunge'];
        const m = moves[Math.floor(Math.random() * moves.length)];
        if (m !== 'lunge' || d < 260) this.startMove(m, tg);
        this.nextMove = time + 1800 + Math.random() * 1800;
      }
      return;
    }
    if (this.huntingPlayer) {
      if (!p.dead) W.playerEscaped(this);
      this.huntingPlayer = false;
      this.go('search');
    }
    if (this.st === 'search') {
      this.moveTo(this.lastSeen.x, this.lastSeen.y, this.def.speed * 0.6);
      if (this.stT > 3.5) this.go('wander');
      return;
    }
    if (this.food && this.hunger > 0.5) return this.eatFood(time);
    // Revier ablaufen
    if (A) {
      if (time > this.wanderAt || Math.abs(this.x - this.wanderX) < 30) {
        this.wanderAt = time + 4000 + Math.random() * 3000;
        this.wanderX = A.x0 + 120 + Math.random() * (A.x1 - A.x0 - 240);
        this.wanderY = this.home.y + (Math.random() - 0.5) * 120;
      }
      this.moveTo(this.wanderX, this.wanderY, this.def.speed * 0.45);
    } else this.wander(time);
  }

  private startMove(m: string, tg: Target) {
    this.mv = m;
    this.mvT = 0;
    this.dir = Math.sign(tg.x - this.x) || this.dir;
    const dx = tg.x - this.x, dy = tg.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.mvDir = { x: dx / len, y: dy / len };
    if (m === 'roar') audio.sfx('roar');
    if (m === 'charge' || m === 'lunge' || m === 'pounce') this.setTint(0xffb0a0);
  }

  private endMove() {
    this.mv = '';
    this.mvT = 0;
    this.clearTint();
    this.setAngle(0);
    this.setScale(1);
  }

  private apexMove(time: number, dt: number) {
    this.mvT += dt;
    const t = this.mvT;
    const b = this.b;
    const tg = this.target;
    const W = this.world;
    const sp = this.def.speed;
    switch (this.mv) {
      case 'lunge':
        if (t < 0.35) this.halt();
        else if (t < 0.7) {
          this.clearTint();
          this.attacking = true;
          if (this.swims || this.flies) b.setVelocity(this.mvDir.x * sp * 2.6, this.mvDir.y * sp * 2.6);
          else b.setVelocityX(this.dir * sp * 2.6);
          if (tg) this.tryBite(time, tg, 1.4);
        } else this.endMove();
        break;
      case 'charge':
        if (t < 0.6) {
          this.halt();
          this.setScale(1 + Math.sin(t * 40) * 0.02, 1);
        } else {
          this.clearTint();
          this.setScale(1);
          this.attacking = true;
          if (this.swims) b.setVelocity(this.mvDir.x * sp * 3, this.mvDir.y * sp * 3);
          else b.setVelocityX(this.dir * sp * 3.2);
          if (Math.random() < 0.3) W.puff(this.x - this.dir * 50, b.bottom, 1);
          const A = W.territory;
          const wall = b.blocked.left || b.blocked.right || (A && (this.x < A.x0 + 60 || this.x > A.x1 - 60));
          if (wall) {
            audio.sfx('boom');
            W.cameras.main.shake(380, 0.012);
            this.stunUntil = time + 1700;
            this.weak = 2;
            W.time.delayedCall(1700, () => (this.weak = 1));
            b.setVelocity(-this.dir * 80, 0);
            this.endMove();
          } else if (t > 2.4) this.endMove();
          if (tg && tg !== W.player && overlaps(this.hitRect(), tg.hitRect())) (tg as Animal).hurt(this.def.dmg, this, 'ram');
        }
        break;
      case 'pounce':
        if (t < 0.4) {
          this.halt();
          this.setScale(1.05, 0.9);
        } else if (this.mvDir.y !== 99) {
          this.setScale(1);
          this.clearTint();
          const tx = tg ? tg.x : this.x + this.dir * 200;
          b.setVelocity(clamp((tx - this.x) / 0.9, -460, 460), -640);
          this.mvDir.y = 99;
        } else {
          this.attacking = true;
          if (t > 0.65 && this.onFloor) {
            W.puff(this.x, b.bottom, 6);
            W.cameras.main.shake(180, 0.006);
            this.halt();
            this.stunUntil = time + 500;
            this.endMove();
          } else if (t > 2.2) this.endMove();
        }
        break;
      case 'dive': {
        if (!tg) return this.endMove();
        if (t < 0.8) {
          b.setVelocity(-this.dir * sp * 0.4, -sp * 1.2);
        } else if (t < 2.0 && this.y < tg.y - 30) {
          this.clearTint();
          this.attacking = true;
          const dx = tg.x - this.x, dy = tg.y - this.y;
          const len = Math.hypot(dx, dy) || 1;
          b.setVelocity((dx / len) * sp * 3, (dy / len) * sp * 3);
          this.dir = Math.sign(dx) || this.dir;
          this.tryBite(time, tg, 1.3);
        } else if (t < 3.2) {
          this.attacking = true;
          b.setVelocity(this.dir * sp * 2, 0);
          this.tryBite(time, tg, 1.3);
        } else this.endMove();
        break;
      }
      case 'roar':
        this.halt();
        if (t > 0.15 && this.mvDir.y !== 77) {
          this.mvDir.y = 77;
          W.cameras.main.shake(600, 0.01);
          if (!this.swims && !this.flies) {
            const floor = W.territory?.floor ?? this.b.bottom;
            for (const s of [-1, 1]) W.shoot(this.x + s * 60, floor - 20, s * 300, 0, 'pr_wave', this.def.dmg * 0.8, false);
          }
        }
        if (t > 1.3) this.endMove();
        break;
      default:
        this.endMove();
    }
  }

  // ------------------------------------------------------------------ Bewegung

  private halt() {
    const b = this.b;
    if (this.swims || this.flies) b.setVelocity(b.velocity.x * 0.85, b.velocity.y * 0.85);
    else b.setVelocityX(0);
  }

  private moveTo(x: number, y: number, speed: number, fleeing = false) {
    const b = this.b;
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) > 4) this.dir = dx > 0 ? 1 : -1;
    if (this.swims || this.flies) {
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 40);
      let vy = (dy / len) * speed * k;
      if (this.flies && !this.attacking) vy += Math.sin(this.t * 3 + this.phase) * 25;
      b.setVelocity(Phaser.Math.Linear(b.velocity.x, (dx / len) * speed * k, 0.15), Phaser.Math.Linear(b.velocity.y, vy, 0.15));
      if (b.blocked.left || b.blocked.right) b.setVelocityY(b.velocity.y - 60);
      return;
    }
    if (Math.abs(dx) < 6) {
      b.setVelocityX(0);
      return;
    }
    this.walk(speed, fleeing || this.st === 'hunt' || this.st === 'charge', fleeing);
  }

  private walk(speed: number, jumpy: boolean, fleeing: boolean) {
    const b = this.b;
    const floor = this.onFloor;
    const blocked = (b.blocked.left && this.dir < 0) || (b.blocked.right && this.dir > 0);
    if (blocked) {
      if (floor && jumpy) b.setVelocityY(-this.jumpV());
      else if (!fleeing) this.dir *= -1;
    }
    if (floor && !this.world.solidAt(this.x + this.dir * (b.halfWidth + 8), b.bottom + 10)) {
      if (jumpy) b.setVelocityY(-this.jumpV());
      else {
        this.dir *= -1;
        this.wanderX = this.x + this.dir * 120;
      }
    }
    b.setVelocityX(this.dir * speed);
  }

  private jumpV() {
    return this.def.power > 20 ? 600 : 520;
  }

  private runFrom(x: number, y: number, speed: number) {
    const away = this.x >= x ? 1 : -1;
    const ty = this.swims || this.flies ? this.y + (this.y >= y ? 120 : -120) : this.y;
    this.moveTo(this.x + away * 240, ty, speed, true);
  }

  private chase(tg: Target, speed: number) {
    const aboveY = this.flies && this.mv !== 'dive' && this.dist(tg) > 160 ? tg.y - 110 : tg.y;
    this.moveTo(tg.x, aboveY, speed, false);
  }

  private wander(time: number) {
    if (time > this.wanderAt) {
      this.wanderAt = time + 2500 + Math.random() * 3500;
      if (Math.random() < 0.3) {
        this.wanderX = this.x;
        this.wanderY = this.y;
      } else {
        this.wanderX = this.home.x + (Math.random() - 0.5) * 440;
        this.wanderY = this.home.y + (Math.random() - 0.5) * (this.swims || this.flies ? 160 : 0);
      }
    }
    if (Math.abs(this.wanderX - this.x) < 10 && (!this.swims || Math.abs(this.wanderY - this.y) < 10)) {
      this.go('idle');
      this.halt();
      return;
    }
    this.go('wander');
    this.moveTo(this.wanderX, this.wanderY, this.def.speed * 0.55);
  }

  private drift() {
    this.b.setVelocity(Math.sin(this.t * 0.5 + this.phase) * this.def.speed * 0.7, Math.sin(this.t * 1.3 + this.phase) * this.def.speed * 1.3);
    this.setScale(1 + Math.sin(this.t * 2.6) * 0.06, 1 - Math.sin(this.t * 2.6) * 0.06);
  }

  // ------------------------------------------------------------------ Kampf

  /** Biss in Reichweite? */
  private tryBite(time: number, tg: Target, reach = 1) {
    if (time < this.biteReady || tg.dead) return;
    const b = this.b;
    const w = (b.width * 0.5 + 18) * reach;
    const r: Rect = this.dir > 0 ? { x: this.x, y: b.y, w, h: b.height } : { x: this.x - w, y: b.y, w, h: b.height };
    if (!overlaps(r, tg.hitRect())) return;
    this.biteReady = time + (this.role === 'apex' ? 1100 : 900);
    const p = this.world.player;
    if (tg === p) {
      p.hurt(this.def.dmg, this.x);
      if (Math.random() < 0.5) audio.sfx('snarl');
    } else {
      (tg as Animal).hurt(this.def.dmg, this, 'bite');
    }
  }

  /** Schaden nehmen. */
  hurt(dmg: number, from: Target, kind: 'bite' | 'ram' | 'other') {
    if (this.dead) return;
    const now = this.world.time.now;
    this.hp -= dmg * this.weak;
    this.attacker = from;
    this.attackedAt = now;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.world.time.delayedCall(90, () => {
      if (this.active) this.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
    this.world.bleed(this.x, this.y, kind === 'ram' ? 4 : 6);
    const s = Math.sign(this.x - from.x) || 1;
    const heavy = this.role === 'apex' ? 0.25 : this.role === 'defender' ? 0.4 : 1;
    if (kind === 'ram') {
      this.b.setVelocity(s * Math.min(560, 200 + dmg * 14) * heavy, this.swims || this.flies ? -40 : -260 * heavy);
      this.stunUntil = now + 450 * heavy + 150;
    } else {
      this.b.setVelocity(s * 140 * heavy, this.swims || this.flies ? -20 : -120 * heavy);
      this.knockUntil = now + 160;
    }
    if (this.hp <= 0) {
      this.die(from === this.world.player);
      return;
    }
    audio.sfx(this.role === 'prey' ? 'squeal' : 'hit');
    if (this.role === 'apex' || this.role === 'predator') this.target = from;
  }

  private die(byPlayer: boolean) {
    this.dead = true;
    this.attacking = false;
    this.b.enable = false;
    audio.sfx('enemyDie');
    this.world.animalDied(this, byPlayer);
    this.world.tweens.add({ targets: this, alpha: 0, duration: 200, onComplete: () => this.destroy() });
  }
}
