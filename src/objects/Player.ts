import Phaser from 'phaser';
import type { Morph } from '../art/creatureArt';
import { game, type Stats, type UpKey } from '../state/GameState';
import { audio } from '../audio/Audio';
import { CreatureView, type AnimMode } from './CreatureView';
import type { Controls } from './Controls';
import { approach, clamp, type Rect } from '../util/math';
import { DEPTH } from '../config';
import { STAMINA } from '../data/life';

export interface PlayerHost extends Phaser.Scene {
  playerBite(rect: Rect, momentum?: number): void;
  /** Zur Laichzeit: E laicht (befruchtet bzw. legt ab), statt zu beißen – true, wenn gelaicht wurde */
  spawnAct?(): boolean;
  puff(x: number, y: number, n: number, tint?: number): void;
  bleed(x: number, y: number, n: number): void;
  solidAt(x: number, y: number): boolean;
  surfaceY: number;
}

type Body = Phaser.Physics.Arcade.Body;

/** So lange (ms) schlägt das Tier beim Stoß höchstens kräftiger, bevor es gleitet. */
const CHARGE_MS = 650;
/** So lange (s) dauert das Einschlafen am Ende des Lebens: still werden, die Augen schließen, sanft absinken. */
export const SLEEP_S = 3.2;

export class Player {
  rect: Phaser.GameObjects.Rectangle;
  view: CreatureView;
  stats!: Stats;
  hp = 1;
  /**
   * Ausdauer in Kreisen (wie in Breath of the Wild): höchstens game.staminaMax – ein Kreis, und für jeden Segen der großen
   * Muschel ein Stück mehr. Wie schnell sie schwindet, hängt am Körper (stats.endurance: Schwere ermüden schneller).
   */
  stamina = game.staminaMax;
  /** wann zuletzt Ausdauer verbraucht wurde (erst kurz danach füllt sich der Kreis wieder) */
  private usedAt = -1e9;
  /** wann die große Muschel zuletzt gesegnet hat (der Kreis wächst sichtbar um ein Stück) */
  grewAt = -1e9;
  /** am Lebensende: Es wird langsamer (1 = wie immer … 0 = steht still) */
  fade = 1;
  /** Einschlafen am Ende des Lebens: seit wann (Spielzeit in ms, < 0: wach) – nach der Uhr der Szene, wie das Abblenden */
  private sleepAt = -1;
  /** erschöpft: lahm unterwegs, kein Spurt und kein Rammen, bis der Kreis wieder ganz voll ist (er ist dann rot) */
  exhausted = false;
  /** lässt sich ruhig treiben bzw. liegt still und sammelt Kraft (und heilt ein wenig) */
  resting = false;
  facing = 1;
  dead = false;
  inCover = false;
  hidden = false;
  sprinting = false;
  /** Tempo relativ zum Normaltempo (0..~1.5) */
  speed01 = 0;
  lastHurt = -1e9;
  /** wann zuletzt zugebissen wurde (Spielzeit in ms) – so sehen die anderen Spieler den Biss */
  bitAt = -1e9;
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
  /** Stoß (R): erst baut das Tier mit kräftigen Flossenschlägen langsam Tempo auf, dann gleitet es mit dem Schwung */
  private dash: 'none' | 'charge' | 'glide' = 'none';
  /** wie lange (ms Spielzeit) die aktuelle Phase des Stoßes schon läuft */
  private dashAge = 0;
  private dashV = 0;
  private dashV0 = 0;
  private dashPeak = 0;
  private ramReady = 0;
  private ramDir = { x: 1, y: 0 };
  /** Spurt: je länger man kräftig schlägt, desto schneller wird man (0..1) */
  private surge = 0;
  /** Wenden (im Wasser): in diese Richtung dreht sich das Tier gerade (0 = nicht), und wie weit es schon ist (0..1) */
  private turnDir = 0;
  private turnT = 0;
  /** wie oft die Richtung gewechselt wurde (für die Seitenflossen) */
  private turnCount = 0;
  private lastVSign = 0;
  private lastVTurn = 0;
  /** in einer Höhle (nur die Augen sind zu sehen) */
  inCave = false;
  /** liegt still am Boden (Sandtarnung) */
  grounded = false;
  /** im Hinterhalt (versteckt/getarnt): leicht durchsichtig, der erste Angriff überrascht */
  ambush = false;
  /** stützt sich am Grund ab und läuft dort entlang (im Wasser) */
  bottomWalk = false;
  /** lässt sich vom Wasser tragen (keine Steuerung) */
  drifting = false;
  /** während eines Kino-Moments: nichts kann einem etwas tun */
  shielded = false;
  private boostUntil = 0;
  /** wann zuletzt etwas getan wurde (schwimmen, beißen, rammen …) – danach beginnt das Ausruhen */
  private lastAct = 0;
  /** überstandene Treffer seit dem letzten Abruf, nach Schwere gewichtet (daraus werden robustere Schuppen der Nachkommen) */
  private endured = 0;
  private driftPh = Math.random() * 6.28;

  constructor(private host: PlayerHost, x: number, y: number, readonly water: boolean) {
    this.rect = host.add.rectangle(x, y, 40, 30, 0xff0000, 0);
    host.physics.add.existing(this.rect);
    const b = this.body;
    b.setCollideWorldBounds(true);
    if (water) b.setAllowGravity(false);
    this.view = new CreatureView(host, x, y, this.morph());
    this.view.setDepth(DEPTH.player);
    this.refresh(true);
    this.lastSafe = { x, y };
  }

  /** die größte Ausdauer (in Kreisen) */
  get staminaMax() {
    return game.staminaMax;
  }

  /**
   * Die große Muschel hat gesegnet: Ausdauer – der Kreis wächst, und er ist voll; Lebenskraft – der Körper wird etwas größer, und
   * sie ist ganz wieder da; Sicht – die Augen werden größer (der Blick reicht weiter, siehe LevelScene.sightStep).
   */
  blessed(k: UpKey = 'stam') {
    if (k === 'stam') {
      this.grewAt = this.host.time.now;
      this.stamina = this.staminaMax;
      this.exhausted = false;
      return;
    }
    this.refresh(false, true);
    if (k === 'hp') this.hp = this.stats.maxHp;
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

  /** fällt auf: Wer spurtet, stößt oder gleitet mit Schwung, wird auch aus der Ferne bemerkt */
  get loud() {
    return this.sprinting || this.dash !== 'none' || this.speed01 > 1.25;
  }

  get bodyLen() {
    return this.rect.width;
  }

  /** kurzer Schwung (z. B. nach einer giftigen Pflanze): schneller, die Kraft kehrt rasch zurück */
  boost(ms: number) {
    this.boostUntil = Math.max(this.boostUntil, this.host.time.now + ms);
  }

  /** Heilung (Heilkraut): Anteil an der maximalen Lebenskraft */
  heal(frac: number) {
    if (this.dead) return;
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * frac);
  }

  /** gerade mitten im Stoß: erst mit viel Tempo ist es ein Stoß, vorher nur das Anschwimmen */
  get isRamming() {
    return this.dash !== 'none' && this.speed01 > 1.45;
  }

  /** Schwung (0..1): so viel Tempo hat der Stoß aufgebaut – im Schwung beißt man weiter und härter */
  get momentum() {
    return this.dash === 'none' ? 0 : clamp((this.speed01 - 1.2) / 1.1, 0, 1);
  }

  /** Aussehen aus den aktuellen (verborgenen) Merkmalen. */
  morph(): Morph {
    return game.morph({ belly: 1, fierce: game.fear() });
  }

  /**
   * Werte neu berechnen und – falls sich das Aussehen sichtbar verändert hat – neu zeichnen.
   * look = false: nur die Werte (das Neuzeichnen kostet Zeit und wartet auf einen ruhigen Moment).
   * Gibt true zurück, wenn neu gezeichnet wurde.
   */
  refresh(full = false, look = true) {
    const ratio = full ? 1 : this.hp / Math.max(1, this.stats?.maxHp ?? 1);
    this.stats = game.stats();
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
    // im Schwung reicht der Biss weiter nach vorn (ohne Sprung nach vorn bekommt er ein klein wenig Grundreichweite)
    const reach = 8 + 46 * this.momentum;
    return this.facing > 0
      ? { x: bx + r.x, y: by + r.y, w: r.w + reach, h: r.h }
      : { x: bx - r.x - r.w - reach, y: by + r.y, w: r.w + reach, h: r.h };
  }

  get invulnerable() {
    return this.host.time.now < this.invulnUntil;
  }

  update(time: number, dt: number, c: Controls) {
    const b = this.body;
    if (this.dead) {
      if (this.sleepAt >= 0) this.sleepStep(time, dt);
      this.syncView(dt, 'idle', 0);
      return;
    }
    const knocked = time < this.knockUntil;
    const dir = (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0);
    const dyIn = (c.held.down ? 1 : 0) - (c.held.up || c.held.jump ? 1 : 0);
    // Ausruhen: eine Weile nichts tun (nicht schwimmen, beißen, rammen) – im Wasser lässt man sich treiben
    if (dir !== 0 || (this.water && dyIn !== 0) || c.held.sprint || c.held.bite || c.held.ram || c.pressed.jump || knocked) this.lastAct = time;
    this.resting = time - this.lastAct > 650 && time - this.lastHurt > 1200;
    const en = this.stats.endurance;
    // Sprint: hält je nach Körperbau kürzer oder länger
    const wantSprint = c.held.sprint && (dir !== 0 || (this.water && (c.held.up || c.held.down)));
    this.sprinting = wantSprint && !this.exhausted && this.stamina > 0.05;
    const max = this.staminaMax;
    // kräftiger schlagen: das Tempo baut sich langsam auf und klingt nach dem Spurt langsam ab
    this.surge = approach(this.surge, this.sprinting ? 1 : 0, dt / (this.sprinting ? 1.4 : 0.9));
    // Ausdauer: Der Spurt zehrt sie auf (ein Kreis reicht STAMINA.sprint Sekunden, schwere Tiere kürzer). Kurz nach dem
    // Verbrauch füllt sich der Kreis wieder – beim Schwimmen langsam, beim Treiben rasch. Ganz leer ist man erschöpft:
    // Dann füllt er sich rot, und erst wenn er voll ist, geht es wieder (wie in Breath of the Wild).
    const refill = this.stats.recover;
    if (this.sprinting) this.usedAt = time;
    const regen = time - this.usedAt < 550 ? 0 : this.exhausted || this.resting ? refill / 5 : refill / 14;
    this.stamina = clamp(this.stamina + (this.sprinting ? -dt / (STAMINA.sprint * en) : dt * regen), 0, max);
    if (!this.exhausted && this.stamina <= 0.02) {
      this.exhausted = true;
      this.host.puff(this.x + this.facing * this.view.L.halfW, this.y - 6, 4, this.water ? 0xffffff : 0xcfd8dc);
    } else if (this.exhausted && this.stamina >= max - 0.001) this.exhausted = false;
    // verletzt: ein klein wenig langsamer – gerade so, dass man es merkt
    const hurtSlow = 1 - 0.12 * clamp((0.45 - this.hp / this.stats.maxHp) / 0.45, 0, 1);
    // am Lebensende: langsamer
    const starving = this.fade;
    const boosted = time < this.boostUntil;
    if (boosted) {
      this.stamina = Math.min(max, this.stamina + dt * 0.6 * max);
      this.exhausted = false;
    }
    const sp = this.stats.speed * (1 + 0.45 * this.surge) * hurtSlow * starving * (boosted ? 1.25 : this.exhausted ? 0.68 : 1);

    if (this.water) {
      const dy = dyIn;
      // Am Grund abstützen und entlanglaufen: kostet wenig Kraft; mit kräftigen Flossen geht es flott
      const floor = (b.blocked.down || b.touching.down) && dy >= 0;
      this.bottomWalk = floor && dir !== 0 && !knocked;
      const agi = this.stats.agility;
      // Wenden braucht Zeit: erst abbremsen, dann dreht sich das Tier, dann nimmt es in die neue Richtung Fahrt auf.
      // Mit großen Seitenflossen (und kurzem Körper) geht es schneller.
      if (dir !== 0 && dir !== this.facing && this.turnDir === 0 && !knocked && !this.bottomWalk) {
        this.turnDir = dir;
        this.turnT = 0;
        if (Math.abs(b.velocity.x) > 0.25 * this.stats.speed) this.turnCount += 1;
      }
      if (this.turnDir !== 0) {
        this.turnT += dt / (0.42 / agi);
        if (this.turnT >= 0.5) this.facing = this.turnDir;
        if (this.turnT >= 1) this.turnDir = 0;
      } else if (this.bottomWalk && dir) this.facing = dir;
      // auch ein Wechsel zwischen oben und unten ist eine Richtungsänderung (halb so viel wert)
      const vs = dy === 0 ? 0 : Math.sign(dy);
      if (vs !== 0) {
        if (this.lastVSign !== 0 && vs !== this.lastVSign && time - this.lastVTurn > 450) {
          this.lastVTurn = time;
          this.turnCount += 0.5;
        }
        this.lastVSign = vs;
      }
      if (!knocked) {
        const len = Math.hypot(dir, dy) || 1;
        // mitten im Wenden: erst steht man fast still, dann zieht es in die neue Richtung
        const gate = this.turnDir !== 0 ? clamp((this.turnT - 0.4) / 0.6, 0, 1) : 1;
        const cruise = this.stats.cruise;
        const upDown = dy < 0 ? this.stats.climb : dy > 0 ? this.stats.dive : 1;
        const vx = this.bottomWalk ? dir * this.stats.speed * this.stats.groundSpeed * (1 + 0.3 * this.surge) * hurtSlow * starving * (this.exhausted ? 0.68 : 1) : (dir / len) * sp * cruise * gate;
        // Ohne Steuerung steht man nie ganz still: das Wasser trägt einen leicht nach links oder rechts
        const drift = dir === 0 && dy === 0 && !floor;
        this.driftPh += dt;
        const dvx = drift ? Math.sin(this.driftPh * 0.42) * 20 + Math.sin(this.driftPh * 1.3 + 1) * 7 : 0;
        const dvy = drift ? Math.sin(this.driftPh * 0.9) * 6 : 0;
        const acc = (drift ? 260 : 900 * agi) * dt;
        b.setVelocity(approach(b.velocity.x, vx + dvx, acc), approach(b.velocity.y, (dy / len) * sp * 0.9 * upDown + (dy ? 0 : 6) + dvy, acc));
        this.drifting = drift;
      }
      if (this.rect.y - b.height / 2 < this.host.surfaceY + 4 && b.velocity.y < 0) b.setVelocityY(Math.max(0, b.velocity.y));
      this.view.rotation = this.facing * clamp(b.velocity.y / (sp || 1), -1, 1) * 0.35;
      this.speed01 = Math.hypot(b.velocity.x, b.velocity.y) / this.stats.speed;
      // das Treiben zählt als ruhig (fürs Verstecken und Auffallen)
      if (this.drifting && !knocked) this.speed01 = Math.min(this.speed01, 0.08);
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

    // Stoß (R, erst mit hartem Kopf möglich): kein Blitzstart. Das Tier schlägt kräftiger und wird langsam
    // schneller (so lange R gehalten wird, höchstens eine gute halbe Sekunde) – danach gleitet es und nutzt den
    // aufgebauten Schwung. Genau dann stößt und beißt man am besten.
    if (this.dash === 'none' && c.pressed.ram && game.canRam && time >= this.ramReady && this.stamina > 0.12 && !this.exhausted && !knocked) {
      this.dash = 'charge';
      this.dashAge = 0;
      this.dashV0 = Math.max(this.stats.speed * 0.6, Math.hypot(b.velocity.x, this.water ? b.velocity.y : 0));
      this.dashV = this.dashV0;
      this.dashPeak = this.stats.speed * 2.3 * this.fade;
      const dy = this.water ? (c.held.down ? 1 : 0) - (c.held.up ? 1 : 0) : 0;
      const len = Math.hypot(this.facing, dy * 0.7) || 1;
      this.ramDir = { x: this.facing / len, y: (dy * 0.7) / len };
      audio.sfx('charge');
    }
    if (this.dash !== 'none') {
      if (knocked) {
        this.dash = 'none';
        this.ramReady = time + 450;
      } else if (this.dash === 'charge') {
        this.dashAge += dt * 1000;
        const k = clamp(this.dashAge / CHARGE_MS, 0, 1);
        this.dashV = this.dashV0 + (this.dashPeak - this.dashV0) * Math.pow(k, 1.5);
        this.stamina = Math.max(0, this.stamina - (0.27 / en) * (dt * 1000) / CHARGE_MS);
        this.usedAt = time;
        // wer R loslässt (oder keine Kraft mehr hat), nutzt den Schwung, den er bis dahin hat
        if (k >= 1 || (!c.held.ram && this.dashAge > 220) || this.exhausted) this.dash = 'glide';
        // nach oben/unten lässt sich der Stoß noch lenken
        if (this.water) {
          const want = ((c.held.down ? 1 : 0) - (c.held.up ? 1 : 0)) * 0.7;
          const ny = approach(this.ramDir.y, want / Math.hypot(this.facing, want), 1.6 * dt);
          this.ramDir = { x: this.facing * Math.sqrt(Math.max(0.01, 1 - ny * ny)), y: ny };
        }
        if (this.dash === 'glide') this.dashAge = 0;
      } else {
        this.dashAge += dt * 1000;
        this.dashV *= Math.exp(-dt / 0.55);
        if (this.dashV < this.stats.speed * 1.1 || this.dashAge > 900) {
          this.dash = 'none';
          this.ramReady = time + 450;
        }
      }
    }
    if (this.dash !== 'none') {
      if (this.water) b.setVelocity(this.ramDir.x * this.dashV, this.ramDir.y * this.dashV);
      else b.setVelocityX(this.ramDir.x * this.dashV);
      this.speed01 = this.dashV / this.stats.speed;
      if (Math.random() < (this.dash === 'glide' ? 0.35 : 0.2)) this.host.puff(this.x - this.facing * this.view.L.halfW, this.y, 1);
    }

    // Beißen (und Fressen): aus dem Stand, der Körper bleibt, wo er ist – nur der Kopf schnappt zu.
    // Nach vorn trägt einen allein der Schwung eines Stoßes oder Spurts.
    if (c.pressed.bite && time >= this.biteReady && this.host.spawnAct?.()) this.biteReady = time + 380;
    else if (c.pressed.bite && time >= this.biteReady) {
      this.biteReady = time + 380;
      this.bitAt = time;
      // ein kräftiger Biss kostet Kraft – ein schwacher Kiefer kaum
      this.stamina = Math.max(0, this.stamina - 0.035 * (1 + 1.4 * game.traits.jaw) / en);
      this.usedAt = time;
      this.view.bite();
      audio.sfx('bite', game.traits.jaw);
      const m = this.momentum;
      this.host.time.delayedCall(60, () => !this.dead && this.host.playerBite(this.biteRect(), m));
    }
    this.view.headTilt = this.dash === 'charge' ? 0.3 : this.dash === 'glide' ? 0.42 : this.sprinting ? 0.18 : 0;

    // Atem und Erschöpfung sichtbar machen
    const low = this.stamina / max;
    if ((low < 0.25 || this.exhausted) && time > this.breath) {
      this.breath = time + 500;
      this.host.puff(this.x + this.facing * this.view.L.halfW, this.y - 6, 1, this.water ? 0xffffff : 0xcfd8dc);
    }
    this.view.weary = clamp((1 - this.hp / this.stats.maxHp) * 0.7 + (this.exhausted ? 0.3 : low < 0.2 ? 0.2 : 0) + (1 - this.fade) * 0.6, 0, 1);

    const speed = Math.abs(b.velocity.x);
    let mode: AnimMode = 'idle';
    if (this.water) mode = this.bottomWalk ? 'crawl' : 'swim';
    else if (!(b.blocked.down || b.touching.down)) mode = 'air';
    else if (speed > 25) mode = 'walk';
    // beim Anlauf schlägt der Schwanz immer kräftiger, im Gleiten liegt er ruhig
    const beat = this.dash === 'charge' ? 0.8 + 1.1 * clamp(this.dashAge / CHARGE_MS, 0, 1) : this.dash === 'glide' ? 0.12 : Math.min(1.3, this.speed01) + 0.3 * this.surge;
    this.syncView(dt, mode, beat);
    this.view.setAlpha(time < this.invulnUntil ? (Math.floor(time / 90) % 2 ? 0.55 : 1) : this.ambush ? 0.62 : 1);
  }

  private syncView(dt: number, mode: AnimMode, s01: number) {
    this.view.setPosition(this.rect.x, this.rect.y + this.offY);
    // beim Wenden dreht sich das Tier sichtbar (statt auf einmal umzuspringen)
    if (this.turnDir !== 0) {
      const k = clamp(this.turnT, 0, 1), e = k * k * (3 - 2 * k);
      this.view.setTurn(-this.turnDir + 2 * this.turnDir * e);
    } else this.view.setTurn(this.facing);
    this.view.animate(dt, mode, s01);
  }

  /** Wie oft seit dem letzten Aufruf die Richtung gewechselt wurde. */
  takeTurns() {
    const n = this.turnCount;
    this.turnCount = 0;
    return n;
  }

  /** Was seit dem letzten Aufruf an Treffern überstanden wurde (ein schwerer Treffer zählt ein Vielfaches eines Kratzers). */
  takeEndured() {
    const n = this.endured;
    this.endured = 0;
    return n;
  }

  /**
   * Nahrung aufnehmen. Hunger gibt es nicht: Was gefressen wird, nährt die Brut (daraus werden die Nachkommen) – man kann
   * immer weiterfressen. Heilen tun nur Ruhe und besondere Heilkräuter.
   */
  eat(nutrition: number, kind: 'meat' | 'plant' = 'plant') {
    if (nutrition <= 0) return false;
    game.feed(nutrition);
    this.view.chew();
    audio.sfx(kind === 'meat' ? 'eatMeat' : 'eatPlant');
    return true;
  }

  hurt(dmg: number, fromX: number, by?: string) {
    if (this.dead || this.invulnerable || this.shielded) return;
    if (by) this.lastCause = by;
    const d = Math.max(1, dmg * this.stats.defense);
    this.hp = Math.max(0, this.hp - d);
    const now = this.host.time.now;
    // Wie hart war der Treffer? Schwere Treffer schleudern einen weit zurück, betäuben kurz und erschüttern das Bild.
    const ratio = clamp(d / Math.max(1, this.stats.maxHp), 0, 1);
    this.lastHurt = now;
    this.invulnUntil = now + 800;
    // ein Schuppenpanzer hält dagegen: Man wird weniger weit zurückgeworfen und fängt sich schneller
    const kb = this.stats.knock;
    this.knockUntil = now + (220 + 420 * ratio) * (0.4 + 0.6 * kb);
    const s = Math.sign(this.rect.x - fromX) || -this.facing;
    this.body.setVelocity(s * (300 + 520 * ratio) * kb, (this.water ? -60 - 120 * ratio : -260) * (this.water ? kb : 1));
    this.view.flash(0xff5040);
    this.host.time.delayedCall(120 + 160 * ratio, () => this.view.flash(null));
    this.host.bleed(this.x, this.y, 5 + Math.round(ratio * 16));
    audio.sfx('hurt');
    this.host.cameras.main.shake(130 + 320 * ratio, 0.007 + 0.022 * ratio);
    if (ratio > 0.25) this.host.cameras.main.flash(140 + 200 * ratio, 140, 10, 0);
    // Überstandene Treffer machen die Nachkommen robuster (das Tier selbst bleibt, wie es ist)
    if (this.hp > 0) this.endured += 0.25 + 3 * ratio;
    if (this.hp <= 0) this.die();
  }

  /** Rückstoß beim Rammen (ohne Unverwundbarkeit). k: 0 = kleines Tier, kaum Widerstand … 1 = prallt ab */
  recoil(fromX: number, selfDmg: number, k = 1) {
    const s = Math.sign(this.rect.x - fromX) || -this.facing;
    if (k > 0.3) {
      const kb = this.stats.knock;
      this.body.setVelocity(s * 220 * k * kb, this.water ? -40 * k * kb : -200 * k);
      this.knockUntil = this.host.time.now + 200 * k * (0.4 + 0.6 * kb);
    } else this.body.setVelocityX(this.body.velocity.x * 0.6);
    if (selfDmg > 0.1) {
      const d = selfDmg * this.stats.defense;
      this.hp = Math.max(0, this.hp - d);
      // ein Zusammenprall mit etwas Größerem ist auch ein überstandener Kampf
      if (this.hp > 0) this.endured += 0.1 + 2 * clamp(d / Math.max(1, this.stats.maxHp), 0, 1);
      this.lastHurt = this.host.time.now;
      this.lastCause = 'Beim Zusammenstoß verletzt';
      this.view.flash(0xffa080);
      this.host.time.delayedCall(90, () => this.view.flash(null));
      if (this.hp <= 0) this.die();
    }
  }

  /**
   * Das Leben endet ohne Gewalt – am Ende des Lebens: Das Tier wird still, die Augen fallen zu, es sinkt langsam ab. Danach
   * (SLEEP_S) ist es ganz zur Ruhe gekommen.
   */
  fallAsleep(cause: string) {
    if (this.dead) return;
    this.lastCause = cause;
    this.dead = true;
    this.sleepAt = this.host.time.now;
    this.sprinting = false;
    this.dash = 'none';
  }

  private sleepStep(time: number, dt: number) {
    const t = (time - this.sleepAt) / 1000;
    const k = clamp(t / SLEEP_S, 0, 1);
    const b = this.body;
    // ausgleiten und sanft absinken
    b.setVelocityX(b.velocity.x * Math.pow(0.2, dt));
    if (this.water) b.setVelocityY(b.velocity.y + (12 - b.velocity.y) * Math.min(1, dt * 1.2));
    this.view.still = k;
    this.view.weary = 1;
    this.view.headTilt = 0.1 * k;
    this.view.rotation = this.facing * 0.14 * k * k;
    // erst werden die Lider schwer, dann fallen sie zu
    this.view.eyes(clamp((t - 0.5) / (SLEEP_S * 0.55), 0, 1));
  }

  /** Das Leben endet ohne Gewalt (das Leben an die Nachkommen weitergeben). */
  expire(cause: string) {
    if (this.dead) return;
    this.lastCause = cause;
    this.hp = 0;
    this.die();
  }

  private die() {
    this.dead = true;
    this.body.setVelocity(0, this.water ? -30 : -260);
    audio.sfx('death');
    this.host.tweens.add({ targets: this.view, angle: this.facing * 180, alpha: 0.5, duration: 1100, ease: 'Sine.in' });
    this.host.events.emit('player-dead');
  }
}
