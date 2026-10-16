import Phaser from 'phaser';
import type { Morph } from '../art/creatureArt';
import { game, maxSatiety, type Stats } from '../state/GameState';
import { audio } from '../audio/Audio';
import { CreatureView } from './CreatureView';
import type { Controls } from './Controls';
import { approach, clamp, type Rect } from '../util/math';
import { DEPTH } from '../config';

export interface PlayerHost extends Phaser.Scene {
  playerBite(rect: Rect): void;
  puff(x: number, y: number, n: number, tint?: number): void;
  bleed(x: number, y: number, n: number): void;
  solidAt(x: number, y: number): boolean;
  surfaceY: number;
}

type Body = Phaser.Physics.Arcade.Body;

/** Sättigung: 0 = verhungert … maxSat = randvoll (je nach Größe). */
export const FULL = 100;

export class Player {
  rect: Phaser.GameObjects.Rectangle;
  view: CreatureView;
  stats!: Stats;
  hp = 1;
  satiety = 50;
  /** so viel passt in den Magen (größere Tiere fassen mehr) */
  maxSat = 100;
  stamina = 1;
  facing = 1;
  dead = false;
  inCover = false;
  hidden = false;
  sprinting = false;
  /** Tempo relativ zum Normaltempo (0..~1.5) */
  speed01 = 0;
  lastHurt = -1e9;
  /** woran das Tier zuletzt Schaden nahm (für den Stammbaum) */
  lastCause = 'unbekannt';
  private invulnUntil = 0;
  private biteReady = 0;
  private knockUntil = 0;
  private lastGround = -1e9;
  private jumpBuf = -1e9;
  private jumpCut = false;
  private wasGround = false;
  private breath = 0;
  lastSafe = { x: 0, y: 0 };
  private offY = 0;
  private ramUntil = 0;
  private ramReady = 0;
  private ramDir = { x: 1, y: 0 };
  /** in einer Höhle (nur die Augen sind zu sehen) */
  inCave = false;
  /** liegt still am Boden (Sandtarnung) */
  grounded = false;
  /** im Hinterhalt (versteckt/getarnt): leicht durchsichtig, der erste Angriff überrascht */
  ambush = false;
  private boostUntil = 0;

  constructor(private host: PlayerHost, x: number, y: number, readonly water: boolean) {
    this.rect = host.add.rectangle(x, y, 40, 30, 0xff0000, 0);
    host.physics.add.existing(this.rect);
    const b = this.body;
    b.setCollideWorldBounds(true);
    if (water) b.setAllowGravity(false);
    this.view = new CreatureView(host, x, y, this.morph());
    this.view.setDepth(DEPTH.player);
    this.refresh(true);
    // Jedes Zeitalter beginnt etwa halb satt
    this.satiety = this.maxSat * 0.5;
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

  get fast() {
    return this.speed01 > 0.8 || this.isRamming;
  }

  /** kurzer Schwung (z. B. nach einer giftigen Pflanze): schneller, die Kraft kehrt rasch zurück */
  boost(ms: number) {
    this.boostUntil = Math.max(this.boostUntil, this.host.time.now + ms);
  }

  /** gerade mitten im gezielten Rammstoß */
  get isRamming() {
    return this.host.time.now < this.ramUntil;
  }

  /** Aussehen aus den aktuellen (verborgenen) Merkmalen. */
  morph(): Morph {
    const f = this.satiety / Math.max(1, this.maxSat);
    return game.morph({ belly: f < 0.22 ? 0 : f > 0.78 ? 2 : 1, fierce: game.fear() });
  }

  /**
   * Werte neu berechnen und – falls sich das Aussehen sichtbar verändert hat – neu zeichnen.
   * look = false: nur die Werte (das Neuzeichnen kostet Zeit und wartet auf einen ruhigen Moment).
   * Gibt true zurück, wenn neu gezeichnet wurde.
   */
  refresh(full = false, look = true) {
    const ratio = full ? 1 : this.hp / Math.max(1, this.stats?.maxHp ?? 1);
    this.stats = game.stats();
    this.maxSat = maxSatiety(this.stats.size);
    this.satiety = Math.min(this.satiety, this.maxSat);
    const before = this.view.key;
    if (look || full) this.view.build(this.morph());
    if (before === this.view.key && !full) {
      this.hp = Math.min(this.hp, this.stats.maxHp);
      return false;
    }
    const L = this.view.L;
    const w = Math.round(L.halfW * 2);
    // massige Tiere sind auch höher – sie passen nicht mehr durch jede Felsspalte
    const h = Math.round((L.footY - L.topY) * (1 + 0.22 * Math.max(0, game.traits.girth)));
    if (full || w !== Math.round(this.rect.width) || h !== Math.round(this.rect.height)) {
      // Unterkante des Objekts (nicht des Körpers!) beibehalten: Der Körper ist in diesem
      // Moment schon weiterbewegt, das Objekt folgt erst danach – sonst rutscht man in den Boden.
      const oldBottom = this.rect.y + this.rect.height / 2;
      this.rect.setSize(w, h);
      this.body.setSize(w, h);
      if (!this.water && !full) this.rect.y = oldBottom - h / 2;
    }
    this.offY = -(L.topY + L.footY) / 2;
    this.hp = full ? this.stats.maxHp : Math.min(this.stats.maxHp, ratio * this.stats.maxHp);
    return !full;
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
    return this.host.time.now < this.invulnUntil;
  }

  update(time: number, dt: number, c: Controls) {
    const b = this.body;
    if (this.dead) {
      this.syncView(dt, 'idle', 0);
      return;
    }
    const knocked = time < this.knockUntil;
    const dir = (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0);
    // Sprint: hält nur kurz, erholt sich langsam
    const wantSprint = c.held.sprint && (dir !== 0 || (this.water && (c.held.up || c.held.down)));
    this.sprinting = wantSprint && this.stamina > 0.05;
    this.stamina = clamp(this.stamina + (this.sprinting ? -dt / 2.2 : dt / 4.5), 0, 1);
    // verletzt: ein klein wenig langsamer – gerade so, dass man es merkt
    const hurtSlow = 1 - 0.12 * clamp((0.45 - this.hp / this.stats.maxHp) / 0.45, 0, 1);
    const starving = this.satiety <= 0 ? 0.85 : 1;
    const boosted = time < this.boostUntil;
    if (boosted) this.stamina = Math.min(1, this.stamina + dt * 0.6);
    const sp = this.stats.speed * (this.sprinting ? 1.45 : 1) * hurtSlow * starving * (boosted ? 1.25 : 1);

    if (this.water) {
      const dy = (c.held.down ? 1 : 0) - (c.held.up || c.held.jump ? 1 : 0);
      if (!knocked) {
        const len = Math.hypot(dir, dy) || 1;
        b.setVelocity(approach(b.velocity.x, (dir / len) * sp, 900 * dt), approach(b.velocity.y, (dy / len) * sp * 0.9 + (dy ? 0 : 6), 900 * dt));
      }
      if (dir) this.facing = dir;
      if (this.rect.y - b.height / 2 < this.host.surfaceY + 4 && b.velocity.y < 0) b.setVelocityY(Math.max(0, b.velocity.y));
      this.view.rotation = this.facing * clamp(b.velocity.y / (sp || 1), -1, 1) * 0.35;
      this.speed01 = Math.hypot(b.velocity.x, b.velocity.y) / this.stats.speed;
    } else {
      const onGround = b.blocked.down || b.touching.down;
      if (onGround) {
        this.lastGround = time;
        if (!this.wasGround && b.velocity.y >= 0) this.host.puff(this.x, b.bottom, 3);
      }
      this.wasGround = onGround;
      if (!knocked) b.setVelocityX(approach(b.velocity.x, dir * sp, (onGround ? 2600 : 1600) * dt));
      if (dir) this.facing = dir;
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
      if (onGround && time > this.invulnUntil) {
        const by = b.bottom + 6;
        if (this.host.solidAt(b.x - 30, by) && this.host.solidAt(b.right + 30, by)) this.lastSafe = { x: this.rect.x, y: this.rect.y };
      }
      this.view.rotation = 0;
      this.speed01 = Math.abs(b.velocity.x) / this.stats.speed;
    }

    // Rammstoß (erst mit hartem Kopf möglich)
    if (c.pressed.ram && game.canRam && time >= this.ramReady && this.stamina > 0.2 && !knocked) {
      this.ramReady = time + 1100;
      this.ramUntil = time + 380;
      this.stamina = Math.max(0, this.stamina - 0.25);
      const dy = this.water ? (c.held.down ? 1 : 0) - (c.held.up ? 1 : 0) : 0;
      const len = Math.hypot(this.facing, dy * 0.7) || 1;
      this.ramDir = { x: this.facing / len, y: (dy * 0.7) / len };
      audio.sfx('charge');
      this.host.puff(this.x - this.facing * this.view.L.halfW, this.y, 5);
    }
    if (time < this.ramUntil) {
      const v = this.stats.speed * 2.4;
      if (this.water) b.setVelocity(this.ramDir.x * v, this.ramDir.y * v);
      else b.setVelocityX(this.ramDir.x * v);
      this.speed01 = 2.4;
      if (Math.random() < 0.4) this.host.puff(this.x - this.facing * this.view.L.halfW, this.y, 1);
    }

    // Beißen (und Fressen)
    if (c.pressed.bite && time >= this.biteReady) {
      this.biteReady = time + 320;
      this.view.bite();
      audio.sfx('bite');
      this.host.time.delayedCall(60, () => !this.dead && this.host.playerBite(this.biteRect()));
    }
    this.view.headTilt = time < this.ramUntil ? 0.42 : this.sprinting ? 0.18 : 0;

    // Atem und Erschöpfung sichtbar machen
    if (this.stamina < 0.25 && time > this.breath) {
      this.breath = time + 500;
      this.host.puff(this.x + this.facing * this.view.L.halfW, this.y - 6, 1, this.water ? 0xffffff : 0xcfd8dc);
    }
    this.view.weary = clamp((1 - this.hp / this.stats.maxHp) * 0.7 + (this.satiety < this.maxSat * 0.1 ? 0.3 : 0) + (this.stamina < 0.2 ? 0.2 : 0), 0, 1);

    const speed = Math.abs(b.velocity.x);
    let mode: 'swim' | 'walk' | 'air' | 'idle' = 'idle';
    if (this.water) mode = 'swim';
    else if (!(b.blocked.down || b.touching.down)) mode = 'air';
    else if (speed > 25) mode = 'walk';
    this.syncView(dt, mode, Math.min(1.3, this.speed01));
    this.view.setAlpha(time < this.invulnUntil ? (Math.floor(time / 90) % 2 ? 0.55 : 1) : this.ambush ? 0.62 : 1);
  }

  private syncView(dt: number, mode: 'swim' | 'walk' | 'air' | 'idle', s01: number) {
    this.view.setPosition(this.rect.x, this.rect.y + this.offY);
    this.view.setFacing(this.facing);
    this.view.animate(dt, mode, s01);
  }

  /** Nahrung aufnehmen. Gibt false zurück, wenn das Tier satt ist. */
  eat(nutrition: number) {
    // nie mehr als das Maximum
    if (this.satiety >= this.maxSat - 0.5) {
      this.view.refuse();
      audio.sfx('refuse');
      return false;
    }
    this.satiety = Math.min(this.maxSat, this.satiety + nutrition);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.02);
    this.view.chew();
    audio.sfx('chew');
    return true;
  }

  hurt(dmg: number, fromX: number, by?: string) {
    if (this.dead || this.invulnerable) return;
    if (by) this.lastCause = by;
    const d = Math.max(1, dmg * this.stats.defense);
    this.hp = Math.max(0, this.hp - d);
    const now = this.host.time.now;
    this.lastHurt = now;
    this.invulnUntil = now + 800;
    this.knockUntil = now + 220;
    const s = Math.sign(this.rect.x - fromX) || -this.facing;
    this.body.setVelocity(s * 300, this.water ? -60 : -260);
    this.view.flash(0xff5040);
    this.host.time.delayedCall(120, () => this.view.flash(null));
    this.host.bleed(this.x, this.y, 5);
    audio.sfx('hurt');
    this.host.cameras.main.shake(130, 0.007);
    // Schwere Treffer, die man überlebt, hinterlassen Narben
    if (d > this.stats.maxHp * 0.22 && this.hp > 0) game.addScar();
    if (this.hp <= 0) this.die();
  }

  /** Rückstoß beim Rammen (ohne Unverwundbarkeit). k: 0 = kleines Tier, kaum Widerstand … 1 = prallt ab */
  recoil(fromX: number, selfDmg: number, k = 1) {
    const s = Math.sign(this.rect.x - fromX) || -this.facing;
    if (k > 0.3) {
      this.body.setVelocity(s * 220 * k, this.water ? -40 * k : -200 * k);
      this.knockUntil = this.host.time.now + 200 * k;
    } else this.body.setVelocityX(this.body.velocity.x * 0.6);
    if (selfDmg > 0.1) {
      this.hp = Math.max(0, this.hp - selfDmg * this.stats.defense);
      this.lastHurt = this.host.time.now;
      this.lastCause = 'Beim Zusammenstoß verletzt';
      this.view.flash(0xffa080);
      this.host.time.delayedCall(90, () => this.view.flash(null));
      if (this.hp <= 0) this.die();
    }
  }

  private die() {
    this.dead = true;
    this.body.setVelocity(0, this.water ? -30 : -260);
    audio.sfx('death');
    this.host.tweens.add({ targets: this.view, angle: this.facing * 180, alpha: 0.5, duration: 1100, ease: 'Sine.in' });
    this.host.events.emit('player-dead');
  }
}
