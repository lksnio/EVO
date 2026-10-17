import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { speciesKey } from '../art/speciesArt';
import { audio } from '../audio/Audio';
import { DEPTH } from '../config';
import { clamp, overlaps, type Rect } from '../util/math';
import { Meat, type Plant } from './Food';

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
  hurt(dmg: number, fromX: number, by?: string): void;
}

/** Die Welt, in der die Tiere leben (wird vom Level bereitgestellt). */
export interface World extends Phaser.Scene {
  player: PlayerLike;
  water: boolean;
  animals: Animal[];
  plants: Plant[];
  meats: Meat[];
  /** Dickicht zum Verstecken */
  cover: Rect[];
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
  /** Ein Tier hat mit dir gefressen und vertraut dir jetzt. */
  bonded(a: Animal): void;
  /** Ein durchziehendes Tier hat den Lebensraum verlassen. */
  left(a: Animal): void;
}

export type St = 'wander' | 'idle' | 'graze' | 'flee' | 'hunt' | 'search' | 'warn' | 'charge' | 'rest' | 'cruise' | 'follow' | 'hide';
export type Target = Animal | PlayerLike;

const APEX_MOVES: Record<string, string[]> = {
  cameroceras: ['lunge', 'lunge', 'charge'],
  dunkleosteus: ['lunge', 'charge'],
  meganeura: ['dive', 'dive', 'lunge'],
  trex: ['lunge', 'charge', 'roar'],
  saebelzahn: ['pounce', 'lunge', 'pounce'],
  andrewsarchus: ['lunge', 'charge', 'roar'],
  pterygotus: ['lunge', 'charge', 'lunge'],
  hyneria: ['lunge', 'lunge', 'charge'],
};

/** Ein Tier, das nur durch den Lebensraum zieht (Ereignis). */
export interface Visitor {
  dir: number;
  endX: number;
  cruiseY: number;
  /** wie lange es einem Ziel höchstens nachjagt */
  huntUntil: number;
  /** zieht nur schnell vorbei */
  fast?: boolean;
  /** bis dahin hat es das Interesse am Spieler verloren */
  boredUntil: number;
}

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
  /** Vertrauen durch geteilte Beute (ab 1: Verbündeter) */
  bond = 0;
  ally = false;
  /** ein Artgenosse des Spielers */
  kin = false;
  /** gerade im Dickicht versteckt */
  hiddenNow = false;
  /** zieht nur durch (Ereignis) */
  visitor: Visitor | null = null;
  /** Endgegner der Region: bleibt, bis er besiegt ist, und sucht dich */
  boss = false;
  /** Größe dieses Tieres: nicht jedes Exemplar ist gleich groß */
  sz = 1;
  /** Artgenossen des Spielers, die mitgekämpft haben (wollen später mitfressen) */
  helpers = new Set<Animal>();
  protected snackAt = 0;
  /** zuletzt den Spieler gebissen */
  hitPlayerAt = -1e9;
  /** zuletzt vom Spieler verletzt (für gemeinsame Beute) */
  hitByPlayerAt = -1e9;
  protected world: World;
  protected t = 0;
  protected threatObj: Target | null = null;
  protected food: Plant | Meat | null = null;
  protected attacker: Target | null = null;
  protected attackedAt = -1e9;
  protected lastSeen = { x: 0, y: 0 };
  protected nextSense = 0;
  protected biteReady = 0;
  protected stunUntil = 0;
  protected knockUntil = 0;
  protected wanderAt = 0;
  protected wanderX = 0;
  protected wanderY = 0;
  protected feedAt = 0;
  protected phase = Math.random() * 6;
  protected mv = '';
  protected mvT = 0;
  protected mvDir = { x: 1, y: 0 };
  protected nextMove = 0;
  protected weak = 1;
  protected roared = false;

  constructor(world: World, def: SpeciesDef, x: number, y: number, opts: { texture?: string } = {}) {
    super(world, x, y, opts.texture ?? speciesKey(def.id, 0));
    this.world = world;
    this.def = def;
    this.sz = def.boss ? 0.95 + Math.random() * 0.1 : 0.86 + Math.random() * 0.28;
    this.hp = Math.round(def.hp * this.sz);
    this.maxHp = this.hp;
    this.hunger = 0.15 + Math.random() * 0.5;
    this.home = { x, y };
    this.wanderX = x;
    this.wanderY = y;
    world.add.existing(this);
    this.setScale(this.sz);
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
    if (world.anims.exists(`anim_${def.id}`)) {
      this.play(`anim_${def.id}`);
      this.anims.setProgress(Math.random());
    }
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

  /** wer zuletzt angegriffen hat (Spieler oder ein anderes Tier) */
  get lastAttacker() {
    return this.attacker;
  }

  /** betäubt (z. B. nach einem Überraschungsangriff) */
  stun(ms: number) {
    this.stunUntil = Math.max(this.stunUntil, this.world.time.now + ms);
  }

  /** Panik: vor etwas Großem fliehen – ein paar Sekunden lang, ohne sich umzusehen. */
  panic(from: { x: number; y: number }) {
    if (this.dead || this.role === 'apex' || this.visitor || this.role === 'hazard') return;
    this.threatObj = from as Target;
    this.go('flee');
    this.stT = 0;
    this.nextSense = this.world.time.now + 2200 + Math.random() * 800;
  }

  hitRect(): Rect {
    const b = this.body as Body | null;
    // schon aus dem Spiel genommen: kein Körper mehr, also auch nichts zu treffen
    if (!b) return { x: -1e6, y: -1e6, w: 0, h: 0 };
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  protected get flies() {
    return this.def.habitat === 'air';
  }

  protected get swims() {
    return this.world.water && !this.def.crawl;
  }

  protected get onFloor() {
    return this.b.blocked.down || this.b.touching.down;
  }

  protected go(st: St) {
    if (this.st === st) return;
    this.st = st;
    this.stT = 0;
  }

  protected dist(o: { x: number; y: number }) {
    return Math.hypot(o.x - this.x, o.y - this.y);
  }

  /** Wer ist (oder macht sich) zum Feind des Spielers? */
  protected playerEnemy(range: number): Animal | null {
    const W = this.world;
    const p = W.player;
    const now = W.time.now;
    let best: Animal | null = null;
    let bd = range;
    for (const a of W.animals) {
      if (a === this || a.dead || a.ally || a.kin) continue;
      const hunting = a.target === p && (a.st === 'hunt' || a.attacking || !!a.mv);
      if (!hunting && now - a.hitPlayerAt > 5000) continue;
      const d = Math.min(this.dist(a), Math.hypot(a.x - p.x, a.y - p.y) + 60);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ Ablauf

  tick(time: number, dt: number) {
    if (this.dead) return;
    // Wer tot oder fort ist, ist kein Ziel mehr (sonst greift man ins Leere – das ließ das Spiel einfrieren)
    if (this.target && this.target !== this.world.player && this.target.dead) this.target = null;
    if (this.threatObj && this.threatObj !== this.world.player && this.threatObj.dead) this.threatObj = null;
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
    // Fleisch, an das ein Fleischfresser herankommt, wird gefressen – auch mitten in der Jagd
    if (this.meatEater && time > this.snackAt && this.hunger > 0.12 && !this.dead) {
      this.snackAt = time + 380;
      const r = this.hitRect();
      for (const m of this.world.meats) {
        if (!m.gone && overlaps(r, m.rect)) {
          this.snack(m, time);
          break;
        }
      }
    }
  }

  /** frisst Fleisch */
  protected get meatEater() {
    return this.def.diet === 'meat';
  }

  /** Ein Bissen von einem Fleischstück, an dem man gerade ist. */
  protected snack(m: Meat, time: number) {
    if (time < this.feedAt || !m.take(time)) return;
    this.feedAt = time + 900;
    this.hunger = Math.max(0, this.hunger - 0.3);
    m.ateFrom.add(this);
    m.kill.fed.add(this);
    this.world.puff(m.x, m.y, 3, 0x6a1a10);
    this.sharedMeal(m, time);
  }

  // ------------------------------------------------------------------ Wahrnehmen

  protected sense(time: number) {
    const W = this.world;
    const p = W.player;
    // Der Endgegner streift immer in deiner Nähe umher
    if (this.boss && !p.dead) {
      this.home.x = p.x;
      this.home.y = p.y;
      this.hunger = 1;
    }
    const role = this.role;
    const d = this.def;
    const dp = this.dist(p);
    const friend = this.ally || this.kin;
    if (this.visitor) this.hunger = 1;
    const feeding = this.st === 'graze';
    let seen = !p.dead && role !== 'hazard' && dp < d.sense * W.detectFactor(this) * (feeding ? 0.7 : 1);
    // Wer nur durchzieht, übersieht ein verstecktes Tier fast immer
    if (this.visitor && p.hidden && dp > 70) seen = false;
    if (this.visitor && time < this.visitor.boredUntil) seen = false;
    this.seesPlayer = seen;
    if (seen) {
      this.lastSeen = { x: p.x, y: p.y };
      this.alerted = true;
    } else if (this.alerted && dp > d.sense * 1.4) this.alerted = false;
    const T = W.playerThreat();
    const attackedByPlayer = this.attacker === p && time - this.attackedAt < 8000 && !p.dead;
    let threat: Target | null = null;
    let threatD = Infinity;
    if (seen && !friend) {
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
    if ((role === 'prey' || role === 'predator') && attackedByPlayer) {
      if (role === 'prey' || T > d.power * 1.2) {
        threat = p;
        threatD = dp;
      }
    }
    for (const a of W.animals) {
      if (a === this || a.dead || a.def.id === d.id) continue;
      if ((friend && (a.ally || a.kin)) || (this.kin && a.kin)) continue;
      const da = this.dist(a);
      if (da > d.sense || da >= threatD) continue;
      if (role === 'prey' && (a.role === 'predator' || a.role === 'apex') && !a.ally && da < d.sense * 0.75) {
        threat = a;
        threatD = da;
      } else if (role === 'predator' && a.role === 'apex' && a.def.power > d.power * 1.5 && da < 260) {
        threat = a;
        threatD = da;
      }
    }
    this.threatObj = threat;

    // Nahrung in der Nähe (Aas wird gern genommen – auch die Beute des Spielers)
    let meatNear: Meat | null = null;
    if (d.diet === 'meat') {
      let cd = 300;
      for (const c of W.meats) {
        if (c.gone || c.units <= 0) continue;
        const dd = this.dist(c);
        if (dd < cd) {
          cd = dd;
          meatNear = c;
        }
      }
    }

    // Jagdziel
    if (role === 'predator' || role === 'apex') {
      let best: Target | null = null;
      let bd = Infinity;
      const hungry = role === 'apex' || this.hunger > 0.35;
      // Wer Aas in der Nähe hat, frisst lieber, als zu kämpfen
      const scavenging = !!meatNear && this.hunger > 0.3 && !attackedByPlayer && !this.visitor;
      if (this.ally) {
        best = this.playerEnemy(d.sense);
        if (best && best.def.power > d.power * 3) best = null;
      } else if (hungry && !scavenging) {
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
          // Versteckte Artgenossen bemerkt man nur aus nächster Nähe
          if (a.hiddenNow && da > 70) continue;
          if (da < d.sense * 0.85 && da < bd) {
            best = a;
            bd = da;
          }
        }
      }
      if (this.attacker && time - this.attackedAt < 6000 && !this.attacker.dead) {
        if (this.attacker !== p || role === 'apex' || T < d.power * 1.6) best = this.attacker;
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
        for (const c of W.meats) {
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

  protected think(time: number, dt: number) {
    const role = this.role;
    this.attacking = false;
    if (role === 'hazard') return this.drift();
    if (this.visitor) return this.thinkVisitor(time, dt);
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
    if (this.ally) return this.followPlayer(time, 160, 300);
    this.wander(time);
  }

  /** Verbündete halten sich in der Nähe des Spielers. */
  protected followPlayer(time: number, near: number, far: number) {
    const p = this.world.player;
    if (p.dead) return this.wander(time);
    const d = this.dist(p);
    if (d > far) {
      this.go('follow');
      const side = this.x < p.x ? -1 : 1;
      this.moveTo(p.x + side * near * 0.7, p.y, this.def.speed * (d > far * 2 ? 1.2 : 0.8), true);
    } else if (d > near) {
      this.go('follow');
      this.moveTo(p.x + (this.x < p.x ? -1 : 1) * near * 0.6, p.y, this.def.speed * 0.5);
    } else {
      this.go('idle');
      this.halt();
    }
  }

  protected eatFood(time: number) {
    const f = this.food!;
    const isMeat = f instanceof Meat;
    const fy = isMeat ? f.y : f.y - 20;
    if (this.dist({ x: f.x, y: fy }) < this.width * 0.5 + 24 || (this.kin && this.dist({ x: f.x, y: fy }) < 40)) {
      this.go('graze');
      this.halt();
      this.dir = Math.sign(f.x - this.x) || this.dir;
      if (time > this.feedAt) {
        this.feedAt = time + 1300;
        if (f.take(time)) {
          this.hunger = Math.max(0, this.hunger - (isMeat ? 0.35 : 0.25));
          this.world.puff(f.x, f.y - 14, 3, isMeat ? 0x6a1a10 : 0x6a7a3a);
          if (isMeat) {
            f.kill.fed.add(this);
            this.sharedMeal(f, time);
          }
        }
      }
    } else this.moveTo(f.x, fy, this.def.speed * 0.8);
  }

  /** Frisst ein Tier von deiner Beute, während du dabei bist, wächst Vertrauen. */
  protected sharedMeal(c: Meat, time: number) {
    const W = this.world;
    const p = W.player;
    if (!c.byPlayer || p.dead || this.visitor || this.ally) return;
    if (this.dist(p) > 280) return;
    if (this.attacker === p && time - this.attackedAt < 10000) return;
    // eine geteilte Mahlzeit genügt
    this.bond += 0.5;
    if (this.bond >= 1) {
      this.ally = true;
      this.target = null;
      this.threatObj = null;
      W.bonded(this);
    }
  }

  protected thinkDefender(time: number) {
    const W = this.world;
    const p = W.player;
    let provoker: Target | null = null;
    if (this.attacker && time - this.attackedAt < 7000 && !this.attacker.dead) provoker = this.attacker;
    else if (this.ally) provoker = this.playerEnemy(220);
    else if (this.seesPlayer && this.dist(p) < 130 && (W.playerFear() > 0.35 || p.fast)) provoker = p;
    else {
      for (const a of W.animals) {
        if (a !== this && !a.dead && a.role === 'predator' && !a.ally && this.dist(a) < 140) provoker = a;
      }
    }
    switch (this.st) {
      case 'warn':
        this.halt();
        if (provoker) this.dir = Math.sign(provoker.x - this.x) || this.dir;
        this.setScale(this.sz * (1 + Math.sin(this.stT * 30) * 0.03), this.sz);
        if (this.stT > 0.9) {
          this.setScale(this.sz);
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
          if (tg === p) {
            p.hurt(this.def.dmg * 1.3, this.x, this.def.name);
            this.hitPlayerAt = time;
          } else (tg as Animal).hurt(this.def.dmg * 1.3, this, 'ram');
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
    if (this.ally) return this.followPlayer(time, 160, 320);
    this.wander(time);
  }

  // ------------------------------------------------------------------ Spitzenräuber

  protected thinkApex(time: number, dt: number) {
    const W = this.world;
    const p = W.player;
    if (this.mv) return this.apexMove(time, dt);
    const tg = this.target;
    if (tg && !tg.dead) {
      this.huntTarget(time, tg);
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
    this.wander(time);
  }

  /** Jagd eines großen Räubers – mit Spezialangriffen. */
  protected huntTarget(time: number, tg: Target) {
    const W = this.world;
    const p = W.player;
    if (tg === p && !this.huntingPlayer) {
      this.huntingPlayer = true;
      if (!this.roared) {
        this.roared = true;
        audio.sfx('roar');
        W.cameras.main.shake(500, 0.008);
      }
    }
    if (this.st !== 'hunt') this.go('hunt');
    this.chase(tg, this.def.speed * 1.1);
    this.tryBite(time, tg, this.role === 'apex' ? 1.2 : 1);
    const d = this.dist(tg);
    const moves = APEX_MOVES[this.def.id];
    if (moves && time > this.nextMove && d < 460) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      if (m !== 'lunge' || d < 260) this.startMove(m, tg);
      this.nextMove = time + 1800 + Math.random() * 1800;
    }
  }

  /** Durchziehende Räuber: jagen, was ihnen vor das Maul kommt, und ziehen dann weiter. */
  protected thinkVisitor(time: number, dt: number) {
    const v = this.visitor!;
    const W = this.world;
    const p = W.player;
    if (this.mv) return this.apexMove(time, dt);
    const tg = this.target;
    if (tg && !tg.dead) {
      if (!v.huntUntil) v.huntUntil = time + (v.fast ? 1800 : 7000);
      if (time < v.huntUntil) {
        this.huntTarget(time, tg);
        return;
      }
      // genug gejagt – weiterziehen
      if (tg === p) v.boredUntil = time + (v.fast ? 20000 : 6000);
      this.target = null;
    }
    v.huntUntil = 0;
    if (this.huntingPlayer) {
      this.huntingPlayer = false;
      if (!p.dead) W.playerEscaped(this);
    }
    this.go('cruise');
    const ty = this.swims || this.flies ? v.cruiseY + Math.sin(this.t * 0.7 + this.phase) * 40 : this.y;
    this.moveTo(v.endX, ty, this.def.speed * (v.fast ? 2.4 : 0.8));
    if ((v.dir > 0 && this.x > v.endX - 20) || (v.dir < 0 && this.x < v.endX + 20)) this.leave();
  }

  /** Verlässt den Lebensraum (ohne zu sterben). */
  leave() {
    if (this.dead || !this.body) return;
    this.dead = true;
    this.attacking = false;
    this.b.enable = false;
    this.world.left(this);
    this.world.tweens.add({ targets: this, alpha: 0, duration: 500, onComplete: () => this.destroy() });
  }

  /** Sofort aus dem Spiel nehmen (aus der Welt gefallen o. Ä.) – für alle anderen ist es dann fort. */
  vanish() {
    this.dead = true;
    this.attacking = false;
    if (this.body) this.b.enable = false;
    this.destroy();
  }

  protected startMove(m: string, tg: Target) {
    this.mv = m;
    this.mvT = 0;
    this.dir = Math.sign(tg.x - this.x) || this.dir;
    const dx = tg.x - this.x, dy = tg.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    this.mvDir = { x: dx / len, y: dy / len };
    if (m === 'roar') audio.sfx('roar');
    if (m === 'charge' || m === 'lunge' || m === 'pounce') this.setTint(0xffb0a0);
  }

  protected endMove() {
    this.mv = '';
    this.mvT = 0;
    this.clearTint();
    this.setAngle(0);
    this.setScale(this.sz);
  }

  protected apexMove(time: number, dt: number) {
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
          this.setScale(this.sz * (1 + Math.sin(t * 40) * 0.02), this.sz);
        } else {
          this.clearTint();
          this.setScale(this.sz);
          this.attacking = true;
          if (this.swims) b.setVelocity(this.mvDir.x * sp * 3, this.mvDir.y * sp * 3);
          else b.setVelocityX(this.dir * sp * 3.2);
          if (Math.random() < 0.3) W.puff(this.x - this.dir * 50, b.bottom, 1);
          if (b.blocked.left || b.blocked.right) {
            audio.sfx('boom');
            W.cameras.main.shake(380, 0.012);
            this.stunUntil = time + 1700;
            this.weak = 2;
            W.time.delayedCall(1700, () => (this.weak = 1));
            b.setVelocity(-this.dir * 80, 0);
            this.endMove();
          } else if (t > 2.2) this.endMove();
          if (tg && tg !== W.player && !tg.dead && overlaps(this.hitRect(), tg.hitRect())) (tg as Animal).hurt(this.def.dmg, this, 'ram');
        }
        break;
      case 'pounce':
        if (t < 0.4) {
          this.halt();
          this.setScale(this.sz * 1.05, this.sz * 0.9);
        } else if (this.mvDir.y !== 99) {
          this.setScale(this.sz);
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
            const floor = this.b.bottom;
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

  protected halt() {
    const b = this.b;
    if (this.swims || this.flies) b.setVelocity(b.velocity.x * 0.85, b.velocity.y * 0.85);
    else b.setVelocityX(0);
  }

  protected moveTo(x: number, y: number, speed: number, fleeing = false) {
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
    const jumpy = fleeing || this.st === 'hunt' || this.st === 'charge' || this.st === 'cruise' || this.st === 'follow';
    this.walk(speed, jumpy, fleeing);
  }

  protected walk(speed: number, jumpy: boolean, fleeing: boolean) {
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

  protected jumpV() {
    return this.def.power > 20 ? 600 : 520;
  }

  protected runFrom(x: number, y: number, speed: number) {
    const away = this.x >= x ? 1 : -1;
    const ty = this.swims || this.flies ? this.y + (this.y >= y ? 120 : -120) : this.y;
    this.moveTo(this.x + away * 240, ty, speed, true);
  }

  protected chase(tg: Target, speed: number) {
    const aboveY = this.flies && this.mv !== 'dive' && this.dist(tg) > 160 ? tg.y - 110 : tg.y;
    this.moveTo(tg.x, aboveY, speed, false);
  }

  protected wander(time: number) {
    if (time > this.wanderAt) {
      this.wanderAt = time + 2500 + Math.random() * 3500;
      if (Math.random() < 0.3) {
        this.wanderX = this.x;
        this.wanderY = this.y;
      } else {
        // Herumtreiber ziehen weit durch den Lebensraum, die anderen bleiben in ihrem Revier
        const range = this.def.roam ? 2600 : 440;
        const wb = this.world.physics.world.bounds;
        this.wanderX = clamp(this.home.x + (Math.random() - 0.5) * range, wb.x + 60, wb.right - 60);
        this.wanderY = this.home.y + (Math.random() - 0.5) * (this.swims || this.flies ? 160 : 0);
        if (this.def.roam) this.home.x = this.wanderX;
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

  protected drift() {
    this.b.setVelocity(Math.sin(this.t * 0.5 + this.phase) * this.def.speed * 0.7, Math.sin(this.t * 1.3 + this.phase) * this.def.speed * 1.3);
    this.setScale(this.sz * (1 + Math.sin(this.t * 2.6) * 0.06), this.sz * (1 - Math.sin(this.t * 2.6) * 0.06));
  }

  // ------------------------------------------------------------------ Kampf

  /** Biss in Reichweite? */
  protected tryBite(time: number, tg: Target, reach = 1) {
    if (time < this.biteReady || tg.dead) return false;
    const b = this.b;
    const w = (b.width * 0.5 + 18) * reach;
    const r: Rect = this.dir > 0 ? { x: this.x, y: b.y, w, h: b.height } : { x: this.x - w, y: b.y, w, h: b.height };
    if (!overlaps(r, tg.hitRect())) return false;
    this.biteReady = time + (this.role === 'apex' ? 1100 : 900);
    const p = this.world.player;
    if (tg === p) {
      p.hurt(this.def.dmg, this.x, this.def.name);
      this.hitPlayerAt = time;
      if (Math.random() < 0.5) audio.sfx('snarl');
    } else {
      (tg as Animal).hurt(this.def.dmg, this, 'bite');
    }
    return true;
  }

  /** Schaden nehmen. */
  hurt(dmg: number, from: Target, kind: 'bite' | 'ram' | 'other') {
    if (this.dead) return;
    const now = this.world.time.now;
    this.hp -= dmg * this.weak;
    this.attacker = from;
    this.attackedAt = now;
    if (from instanceof Animal && from.kin) this.helpers.add(from);
    if (from === this.world.player) this.hitByPlayerAt = now;
    // Wer von dir angegriffen wird, vertraut dir nicht mehr
    if (from === this.world.player && (this.ally || this.bond > 0)) {
      this.ally = false;
      this.bond = 0;
    }
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
    if ((this.role === 'apex' || this.role === 'predator') && !(this.ally && from === this.world.player)) this.target = from;
  }

  protected die(byPlayer: boolean) {
    this.dead = true;
    this.attacking = false;
    this.b.enable = false;
    audio.sfx('enemyDie');
    this.world.animalDied(this, byPlayer);
    // kurz aufleuchten und vergehen – übrig bleibt das Fleisch
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.world.tweens.add({ targets: this, alpha: 0, scaleX: this.scaleX * 0.5, scaleY: this.scaleY * 0.5, duration: 260, ease: 'Sine.in', onComplete: () => this.destroy() });
  }
}
