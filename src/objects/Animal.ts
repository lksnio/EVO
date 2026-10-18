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
  /** fällt auf: sprintet, stößt oder ist sehr schnell */
  loud: boolean;
  /** Körperlänge in Bildpunkten */
  bodyLen: number;
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
  /** Der Spieler schwimmt ruhig und friedlich (nicht schnell, hat eine Weile nicht gekämpft). */
  playerCalm(): boolean;
  /** Kampfkraft des Spielers (ohne Ruf und Gruppe). */
  playerPower(): number;
  /** Wie sehr dieses Tier den Spieler fürchtet (0 … gut 1): Wer klein ist, wirkt harmlos. */
  fearOf(a: Animal): number;
  /** Ein Tier ist erschöpft. */
  tired(a: Animal): void;
  /** Höhe der Wasseroberfläche */
  surfaceY: number;
  /** Eine Höhe im freien, mittleren Wasser an dieser Stelle (dort, wo kein Boden und kein Dickicht im Weg ist). */
  openY(x: number): number;
  /** Alle Tiere einer Gruppe (Schwarm, Rudel). */
  herdOf(id: number): Animal[];
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
  /** satt: ruht bis dahin (am Meeresgrund bzw. am Boden) */
  protected restUntil = 0;
  protected nextRestAt = 20000 + Math.random() * 40000;
  protected restY = 0;
  /** gereizt: verfolgt den Spieler bis dahin (und reißt unterwegs alles, was im Weg ist) */
  aggroUntil = 0;
  protected pathBiteAt = 0;
  /** Beute: bleibt bis dahin im Versteck */
  protected hideUntil = 0;
  /** Beute: wie ruhig sie neben dir bleibt (wer lange friedlich in der Nähe schwimmt, dem gegenüber lässt sie die Deckung fallen) */
  calm = 0;
  /** Beute, die sich wehrt: beißt bis dahin zurück */
  protected defendUntil = 0;
  /** Angriff: ausholen → zuschnappen → erholen */
  protected atk: '' | 'wind' | 'strike' | 'recover' = '';
  protected atkT = 0;
  protected atkTarget: Target | null = null;
  protected atkDir = { x: 1, y: 0 };
  /** dieser Angriff hat schon gewarnt */
  protected warned = false;
  protected trailAt = 0;
  /** Ausdauer: Wer lange jagt oder flieht, wird müde */
  stam = 1;
  tiredUntil = 0;
  protected puffAt = 0;
  /** zieht weiter zum Rand des Gewässers und verlässt es (-1 links, 1 rechts) */
  leaveDir = 0;
  /** Schwarm bzw. Rudel, zu dem das Tier gehört (-1 = allein) */
  herdId = -1;
  /** Elternteil: wacht über ein Gelege und bleibt in dessen Nähe */
  guardPost: { x: number; y: number } | null = null;
  /** wie lange der Spieler schon auf dem Gelege ist */
  protected guardDwell = 0;
  /** Räuber: wie sehr der Spieler dem Tier auf die Nerven geht (0 … 1, ab 1 wird es aggressiv) */
  protected irritation = 0;
  /** Räuber: wie schnell es reizbar ist */
  protected temper = 0.45 + Math.random() * 0.85;
  /** zornig über das gefressene Gelege bis dahin */
  rageUntil = 0;
  /** Beute auf der Flucht: wovor, und wie weit sie mindestens weg will */
  protected fleeFrom: Target | null = null;
  protected fleeSafe = 0;
  /** wie oft der Spieler dieses Tier schon aufgescheucht hat – ab einer Schwelle gibt es den Ort ganz auf */
  protected fright = 0;
  protected frightAt = -1e9;
  protected boltAt = 2 + Math.floor(Math.random() * 2);
  protected bolting = false;
  protected fleeVec = { x: 1, y: -0.5 };
  protected fleeVecAt = 0;
  /** Gegenstoß (wie dein Stoß mit R): ausholen → vorschnellen → erholen */
  protected cr: '' | 'wind' | 'dash' | 'rest' = '';
  protected crT = 0;
  protected crReady = 0;
  protected crDir = { x: 1, y: 0 };
  /** Rudeljäger: das Ziel, auf das ein Rudelmitglied das Rudel angesetzt hat */
  protected packTarget: Target | null = null;
  protected packUntil = 0;
  /** wann dieses Tier zuletzt vor etwas davonlief – und seit wann ununterbrochen */
  private runLast = -1e9;
  private runSince = 0;
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

  /** Jemand frisst am Gelege und das Tier hat es mitbekommen: Es greift an – auch wenn es klein ist. */
  rage(from: Target, now: number) {
    if (this.dead || this.kin || this.ally || this.visitor) return;
    this.rageUntil = now + 14000;
    this.attacker = from;
    this.attackedAt = now;
    this.threatObj = null;
    this.fleeFrom = null;
    this.hideUntil = 0;
    if (this.role === 'prey') {
      this.defendUntil = now + 14000;
      this.target = from;
    } else if (this.role === 'predator' || this.role === 'apex') this.aggroUntil = Math.max(this.aggroUntil, now + 14000);
    this.crReady = Math.min(this.crReady, now + 300);
    this.world.puff(this.x, this.y - this.displayHeight * 0.4, 5, 0xff9a80);
    audio.sfx('warn');
    this.setTint(0xff9a82);
    this.world.time.delayedCall(500, () => this.active && !this.atk && !this.cr && this.clearTint());
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
    // Jäger werden nur langsam wieder hungrig – sie jagen nicht den ganzen Tag
    const hr = this.role === 'apex' ? 0.006 : this.role === 'predator' ? 0.0085 : 0.009;
    this.hunger = Math.min(1, this.hunger + dt * hr);
    if (time < this.stunUntil) {
      if (this.atk) this.endAttack(time);
      this.b.setVelocityX(this.b.velocity.x * 0.92);
      if (this.swims || this.flies) this.b.setVelocityY(this.b.velocity.y * 0.92);
      this.setAngle(Math.sin(this.t * 30) * 4);
      return;
    }
    // erschöpft: treibt langsam dahin, schnappt nach Luft – und kann sich kaum wehren
    if (time < this.tiredUntil) {
      if (this.atk) this.endAttack(time);
      this.b.setVelocity(this.b.velocity.x * 0.9, this.swims || this.flies ? this.b.velocity.y * 0.9 : this.b.velocity.y);
      if (time > this.puffAt) {
        this.puffAt = time + 520;
        this.world.puff(this.x + this.dir * this.displayWidth * 0.4, this.y - this.displayHeight * 0.2, 2, 0xffffff);
      }
      this.setAngle(Math.sin(this.t * 3) * 3);
      return;
    }
    if (this.tiredUntil) {
      this.tiredUntil = 0;
      this.stam = 0.45;
      this.setAngle(0);
    }
    if (this.angle && !this.mv && !this.atk) this.setAngle(0);
    if (time < this.knockUntil) return;
    // Ausdauer: Wer lange jagt oder flieht, wird müde (Durchzügler und Nesseltiere ausgenommen)
    if (!this.visitor && this.role !== 'hazard') {
      const fast = Math.hypot(this.b.velocity.x, this.swims || this.flies ? this.b.velocity.y : 0) > this.def.speed * 0.75;
      const exert = fast && (this.st === 'hunt' || this.st === 'flee' || this.st === 'charge' || !!this.mv || !!this.atk);
      if (exert) {
        const drain = this.role === 'apex' || this.def.boss ? 0.065 : this.role === 'prey' ? (this.bolting ? 0.17 : 0.11) : 0.085;
        this.stam -= dt * drain;
        if (this.stam <= 0) {
          this.stam = 0;
          this.tiredUntil = time + (this.role === 'apex' || this.def.boss ? 5200 : 4000);
          if (this.mv) this.endMove();
          this.world.tired(this);
          return;
        }
      } else this.stam = Math.min(1, this.stam + dt * 0.14);
    }
    // ein Angriff läuft: ausholen, zuschnappen, erholen
    if (this.atk) {
      this.attackStep(time, dt);
      this.setFlipX(this.dir < 0);
      return;
    }
    if (time > this.nextSense) {
      this.nextSense = time + 220 + Math.random() * 90;
      this.sense(time);
    }
    this.think(time, dt);
    this.setFlipX(this.dir < 0);
    // Wer dich verfolgt, reißt unterwegs alles, was ihm vor das Maul kommt
    if (this.target === this.world.player && (this.role === 'apex' || this.role === 'predator') && time > this.pathBiteAt) {
      const b = this.b;
      const w = b.width * 0.5 + 20;
      const r: Rect = this.dir > 0 ? { x: this.x, y: b.y, w, h: b.height } : { x: this.x - w, y: b.y, w, h: b.height };
      for (const a of this.world.animals) {
        if (a === this || a.dead || a.kin || a.boss || a.visitor || a.role === 'hazard' || a.def.power >= this.def.power * 0.8) continue;
        if (!overlaps(r, a.hitRect())) continue;
        this.pathBiteAt = time + 450;
        a.hurt(Math.max(this.def.dmg * 2, a.maxHp * 0.6), this, 'bite');
        break;
      }
    }
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
    const resting = this.st === 'rest';
    // Wer ruht, wacht auf, wenn er angegriffen wird oder wieder Hunger hat
    if (resting && (time - this.attackedAt < 3000 || this.hunger > 0.72 || time < this.aggroUntil)) {
      this.restUntil = 0;
      this.go('wander');
    }
    let seen = !p.dead && role !== 'hazard' && dp < d.sense * W.detectFactor(this) * (feeding ? 0.7 : 1) * (this.st === 'rest' ? 0.4 : 1);
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
    // Räuber haben Launen: Meist schwimmen sie einfach ihres Weges. Gereizt werden sie, wenn man sie angreift, ihnen frech zu nah
    // kommt, vor ihnen herumrast oder sich lange in ihrer Nähe aufhält
    if ((role === 'apex' || role === 'predator') && !friend && !this.boss && !this.visitor?.fast) this.mood(time, seen, dp, attackedByPlayer);
    let threat: Target | null = null;
    let threatD = Infinity;
    if (role === 'prey' && !friend) {
      // Vorsicht: Beute hält Abstand – aber nur, wenn jemand wirklich nah kommt oder auffällt. Wer lange ruhig und friedlich
      // in der Nähe schwimmt, dem gegenüber lässt sie die Deckung fallen
      const calmNow = W.playerCalm();
      const fear = W.playerFear();
      const aware = !p.dead && !p.hidden && dp < Math.max(260, d.sense * 1.3);
      // Vertrauen wächst nur langsam und nie ganz – ganz nah lassen sie einen nie heran
      if (aware) this.calm = clamp(this.calm + (calmNow ? 0.014 * (1 - 0.7 * fear) : -0.25), 0, 0.75);
      else if (dp > 450) this.calm = Math.max(0, this.calm - 0.004);
      if (seen && dp < this.shyRadius()) {
        threat = p;
        threatD = dp;
      }
    }
    if (seen && !friend) {
      if (role === 'predator') {
        if (T > d.power * 1.8 && dp < d.sense * 0.8) {
          threat = p;
          threatD = dp;
        }
      }
    }
    if ((role === 'prey' || role === 'predator') && attackedByPlayer) {
      // Eltern am Gelege wehren sich, statt davonzuschwimmen
      if (this.guardPost) {
        if (time >= this.rageUntil) this.rage(p, time);
      } else if (role === 'prey' || T > d.power * 1.2) {
        threat = p;
        threatD = dp;
      }
    }
    for (const a of W.animals) {
      if (a === this || a.dead || a.def.id === d.id) continue;
      if ((friend && (a.ally || a.kin)) || (this.kin && a.kin)) continue;
      const da = this.dist(a);
      if (da > d.sense || da >= threatD) continue;
      // Beute flieht früh vor Jägern – außer sie liegen satt und ruhig am Grund
      if (role === 'prey' && (a.role === 'predator' || a.role === 'apex') && !a.ally && (a.st === 'rest' ? da < 110 : da < d.sense * 0.95)) {
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
      // gejagt wird erst mit Hunger (der Endgegner und Durchzügler sind immer hungrig)
      const hungry = this.boss || !!this.visitor || this.hunger > (role === 'apex' ? 0.62 : 0.5);
      // Wer Aas in der Nähe hat, frisst lieber, als zu kämpfen
      const scavenging = !!meatNear && this.hunger > 0.3 && !attackedByPlayer && !this.visitor;
      if (this.ally) {
        best = this.playerEnemy(d.sense);
        if (best && best.def.power > d.power * 3) best = null;
      } else if (hungry && !scavenging) {
        const bold = this.hunger > 0.75 ? 1.4 : 1.15;
        // den Spieler jagt ein Räuber nur, wenn er gereizt ist (oder der Endgegner bzw. ein angekündigter Jäger)
        const provoked = time < this.aggroUntil || this.boss || !!this.visitor?.fast;
        if (seen && provoked && (role === 'apex' || T < d.power * bold)) {
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
      // Gereizt: Wer einen großen Räuber anmacht (beißt, stößt oder ihm zu nah kommt), den verfolgt er –
      // bis man sich versteckt oder er die Spur verliert
      if (time < this.aggroUntil && !p.dead && !this.ally) {
        if (seen) this.aggroUntil = Math.max(this.aggroUntil, time + 2500);
        if (seen || (dp < 220 && !p.hidden)) best = p;
      }
      // Rudeljäger: Wer im Rudel jagt, setzt die anderen aufs gleiche Ziel an – und schließt sich ihnen an
      if (this.herdId >= 0 && !this.ally) {
        if (best && best !== this.packTarget) {
          for (const m of W.herdOf(this.herdId)) {
            if (m !== this && !m.dead && m.def.diet === 'meat' && this.dist(m) < 700 && (best !== p || T < m.def.power * 2.2)) {
              m.packTarget = best;
              m.packUntil = time + 7000;
            }
          }
        } else if (!best && this.packTarget && time < this.packUntil && !this.packTarget.dead) best = this.packTarget;
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

  /**
   * Wie nah der Spieler kommen darf, bevor diese Beute davonschwimmt (0 = gar nicht). Aus der Ferne fliehen sie nicht ohne
   * Grund: nur wenn jemand wirklich nah kommt oder auffällt (spurtet, stößt, gerade gekämpft hat). Je kleiner der Spieler,
   * desto weniger Angst; wer lange ruhig in der Nähe schwimmt, dem vertraut sie mehr. Eltern am Gelege fliehen nicht.
   */
  protected shyRadius() {
    if (this.guardPost || this.kin || this.ally || this.role !== 'prey') return 0;
    const W = this.world;
    const p = W.player;
    const k = W.fearOf(this);
    if (k < 0.12) return 0;
    const loud = p.loud || !W.playerCalm();
    return (45 + 125 * k + (loud ? 70 + 230 * k : 0)) * (1 - 0.45 * this.calm);
  }

  /** Laune eines Räubers: Er lässt sich reizen, wenn man ihn angreift, ihm zu nah kommt, vor ihm herumrast oder lange bleibt. */
  protected mood(time: number, seen: boolean, dp: number, attacked: boolean) {
    const p = this.world.player;
    const apex = this.role === 'apex';
    if (attacked) {
      this.aggroUntil = Math.max(this.aggroUntil, time + 9000);
      return;
    }
    const near = apex ? 230 : 170;
    const range = apex ? 560 : 400;
    let up = 0;
    if (seen && !p.hidden && !p.dead) {
      if (dp < 70) up = 3;
      else if (dp < near) up = 0.55;
      else if (dp < range) up = 0.1 + (p.loud ? 0.35 : 0);
    }
    // 0,28 s zwischen zwei Wahrnehmungen
    this.irritation = clamp(this.irritation + (up * this.temper - (up ? 0 : 0.12)) * 0.28, 0, 1.2);
    if (this.irritation >= 1) {
      this.aggroUntil = Math.max(this.aggroUntil, time + 9000);
      this.irritation = 0.35;
    }
  }

  /**
   * Eltern am Gelege: Sie schwimmen nicht davon, sondern halten sich in der Nähe und beobachten den Spieler. Geht er auf das
   * Gelege (oder frisst daran), greifen sie an. Gibt true zurück, solange das Tier wacht.
   */
  protected thinkGuard(time: number, dt: number) {
    const W = this.world;
    const p = W.player;
    const post = this.guardPost!;
    // vor einem Räuber (nicht dem Spieler) weicht auch ein Elternteil aus
    if (this.threatObj && this.threatObj !== p) return false;
    const roeY = post.y + 60;
    const onRoe = !p.dead && Math.hypot(p.x - post.x, p.y - roeY) < 85;
    if (onRoe) {
      this.guardDwell += dt;
      if (this.guardDwell > 0.35) {
        this.guardDwell = 0;
        this.rage(p, time);
        return false;
      }
    } else this.guardDwell = Math.max(0, this.guardDwell - dt * 2);
    const dp = this.dist(p);
    if (!p.dead && (this.seesPlayer || dp < 200)) {
      // beobachten: dem Spieler zugewandt, nahe beim Gelege, mit leichtem Schwanken
      this.dir = Math.sign(p.x - this.x) || this.dir;
      this.go('idle');
      if (this.dist(post) > 210) this.moveTo(post.x, post.y, this.def.speed * 0.7);
      else this.b.setVelocity(Math.sin(this.t * 1.7 + this.phase) * 14, Math.sin(this.t * 2.3 + this.phase) * 12);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ Entscheiden

  protected think(time: number, dt: number) {
    const role = this.role;
    this.attacking = false;
    if (role === 'hazard') return this.drift();
    if (this.visitor) return this.thinkVisitor(time, dt);
    // Eltern am Gelege bleiben und beobachten – solange sie nicht gereizt sind oder jagen
    if (this.guardPost && role !== 'apex' && !this.kin && !this.ally && !this.target && time >= this.rageUntil && time >= this.aggroUntil && this.thinkGuard(time, dt)) return;
    if (role === 'defender') return this.thinkDefender(time);
    if (role === 'apex') return this.thinkApex(time, dt);

    this.hiddenNow = false;
    // Beute, die sich wehrt: etwas größere Fische kontern mit einem Stoß (wie dein Stoß mit R), danach fliehen sie weiter
    if (role === 'prey' && time < this.defendUntil && this.target && !this.target.dead) {
      if (this.counterRam(time, dt, this.target)) return;
      // zornige Eltern lassen nicht locker
      if (time < this.rageUntil) {
        this.go('hunt');
        this.chase(this.target, this.def.speed * 1.2);
        return;
      }
    } else if (this.cr) this.endCounter();
    const pl = this.world.player;
    // Schwimmende Beute: nie im Gras verstecken und stillhalten – nach oben ins freie Wasser, weit weg
    if (role === 'prey' && this.swims && !this.kin && !this.ally) {
      if (this.fleeThink(time, dt)) return;
    }
    // Neben einem fremden Tier ausweichen – je ruhiger sie dir gegenüber ist, desto näher darfst du heran
    if (role === 'prey' && !this.swims && !this.threatObj && this.st !== 'hide' && this.st !== 'flee' && !pl.dead && !pl.hidden) {
      const dp = this.dist(pl);
      const keep = this.shyRadius();
      if (keep > 0 && dp < keep) {
        if (this.st !== 'wander') this.go('wander');
        this.runFrom(pl.x, pl.y, dp < keep * 0.6 ? this.fleeSpeed() : this.def.speed * 1.25);
        return;
      }
    }
    // Wer weiterzieht, schwimmt zum Rand des Gewässers – es sei denn, etwas ist hinter ihm her
    if (this.leaveDir && !this.threatObj && !this.target && this.st !== 'flee' && this.st !== 'hide') {
      if (this.st !== 'wander') this.go('wander');
      this.moveTo(this.x + this.leaveDir * 500, this.y, this.def.speed * 0.65);
      return;
    }
    if (this.threatObj) {
      if (this.st !== 'flee' && this.st !== 'hide' && role === 'prey' && Math.random() < 0.3) audio.sfx('scurry');
      if (this.st !== 'hide') this.go('flee');
    }
    // Bodentiere (Trilobiten): ins Dickicht oder in eine Spalte – und dort still bleiben, bis die Gefahr vorbei ist
    if (role === 'prey' && !this.swims && (this.st === 'flee' || this.st === 'hide')) {
      if (this.threatObj) this.hideUntil = time + 2500;
      const c = time < this.hideUntil ? this.nearCover(300) : null;
      if (c) {
        if (this.st !== 'hide') this.go('hide');
        const cx = c.x + c.w / 2, cy = this.swims ? c.y + c.h * 0.6 : this.y;
        if (this.x > c.x + 6 && this.x < c.x + c.w - 6 && (!this.swims || (this.y > c.y && this.y < c.y + c.h + 10))) {
          this.hiddenNow = true;
          this.halt();
        } else this.moveTo(cx, cy, this.fleeSpeed(), true);
        return;
      }
      if (this.st === 'hide') this.go(this.threatObj ? 'flee' : 'wander');
    }
    if (this.st === 'flee') {
      const th = this.threatObj;
      if (th) {
        this.runFrom(th.x, th.y, this.fleeSpeed());
      } else if (this.stT > 1.4) this.go('wander');
      else {
        this.markRun();
        this.moveTo(this.x + this.dir * 200, this.y, this.fleeSpeed(), true);
      }
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
    if (this.wantsRest(time)) return this.restOnGround(time);
    this.wander(time);
  }

  // ------------------------------------------------------------------ Flucht im freien Wasser

  /**
   * Beute im Wasser flieht nicht ins Gras, sondern weg vom Verfolger und nach oben, wo das Wasser frei ist – und zwar
   * auf eine sichere Entfernung. Wer immer wieder gejagt wird, gibt den Ort irgendwann ganz auf (und wird dabei müde).
   * Gibt true zurück, solange das Tier flieht.
   */
  protected fleeThink(time: number, dt: number) {
    const W = this.world;
    const pl = W.player;
    let from: Target | null = this.threatObj;
    // Dem Spieler weicht Beute aus, wenn er nah kommt oder auffällt – je ruhiger sie ihm gegenüber ist, desto näher darf er heran
    if (!from && !pl.dead && !pl.hidden && this.dist(pl) < this.shyRadius()) from = pl;
    if (from) this.startFlee(from, time);
    else if (this.fright > 0 && !this.fleeFrom) this.fright = Math.max(0, this.fright - dt * 0.012);
    const f = this.fleeFrom;
    if (!f) return false;
    const d = this.dist(f);
    // in Sicherheit (oder die Gefahr ist weg): wieder ruhig weiterschwimmen
    if (f.dead || this.stT > 25 || (!this.bolting && (d > this.fleeSafe || this.stT > 14))) {
      this.fleeFrom = null;
      if (this.fright < 0.5) this.bolting = false;
      this.go('wander');
      return false;
    }
    this.go('flee');
    this.fleeSwim(time, f);
    return true;
  }

  /** Eine neue Flucht beginnt (oder die laufende wird verlängert). */
  protected startFlee(from: Target, time: number, scared = false) {
    const W = this.world;
    const player = from === W.player;
    const fresh = !this.fleeFrom;
    this.fleeFrom = from;
    if (fresh) {
      if (this.role === 'prey' && Math.random() < 0.3) audio.sfx('scurry');
      this.stT = 0;
      if (player && !scared && time - this.frightAt > 800) {
        this.fright += 1;
        if (this.fright >= this.boltAt) this.bolting = true;
      }
      // der ganze Schwarm hat es gesehen
      if (this.herdId >= 0) {
        for (const m of W.herdOf(this.herdId)) {
          if (m !== this && !m.dead && !m.fleeFrom && m.dist(this) < 900) m.startFlee(from, time, true);
        }
      }
    }
    if (player) this.frightAt = time;
    const calm = player ? this.calm : 0;
    // wie weit weg es sich sicher fühlt: vor einem kleinen Spieler genügt etwas Abstand, vor einem großen Räuber geht es weit
    const k = player ? clamp(W.fearOf(this), 0.25, 1.2) : 1;
    this.fleeSafe = this.bolting ? Infinity : (170 + 190 * k + 110 * Math.min(3, this.fright)) * (1 - 0.35 * calm);
  }

  /** Davonschwimmen: weg vom Verfolger, aber nie schnurgerade – mal hoch, mal runter, mal ein Haken –, ohne gegen Felsen oder Boden zu stoßen. */
  protected fleeSwim(time: number, from: Target) {
    this.markRun();
    if (time > this.fleeVecAt) {
      this.fleeVecAt = time + 300 + Math.random() * 450;
      this.fleeVec = this.pickFlee(from);
    }
    const v = this.fleeVec;
    // dazu ein Schlängeln, damit es nicht wie auf einer Schnur aussieht
    const wig = Math.sin(this.t * 5 + this.phase) * 95;
    this.moveTo(this.x + v.x * 300, this.y + v.y * 300 + wig, this.fleeSpeed() * (this.bolting ? 1.1 : 1), true);
  }

  protected pickFlee(from: Target) {
    const W = this.world;
    const wb = W.physics.world.bounds;
    const away = this.x > from.x ? 1 : this.x < from.x ? -1 : this.x > wb.centerX ? 1 : -1;
    const wantUp = this.y > W.openY(this.x) + 40;
    // Würfeln: viele mögliche Richtungen, alle weg vom Verfolger – nach oben, nach unten oder fast geradeaus
    const cands: { x: number; y: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const ny = (Math.random() - 0.5) * 1.7 + (wantUp ? -0.3 : 0);
      const nx = away * (0.45 + Math.random() * 0.55);
      const l = Math.hypot(nx, ny);
      cands.push({ x: nx / l, y: ny / l });
    }
    cands.push({ x: 0, y: wantUp ? -1 : 1 });
    const open: { x: number; y: number }[] = [];
    let best = cands[0], bd = -1;
    for (const c of cands) {
      const clear = this.clearAhead(c.x, c.y, 320);
      // nicht wieder (fast) dieselbe Richtung wie eben – es soll Haken schlagen
      const same = c.x * this.fleeVec.x + c.y * this.fleeVec.y > 0.9;
      if (clear >= 260 && !same) open.push(c);
      if (clear > bd) {
        bd = clear;
        best = c;
      }
    }
    // oft der Gegenhaken: wer eben nach oben schwamm, taucht jetzt ab (und umgekehrt)
    const flip = open.filter((c) => Math.sign(c.y) !== Math.sign(this.fleeVec.y));
    const pool = flip.length && Math.random() < 0.6 ? flip : open;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : best;
  }

  /** Wie weit (bis len) es in dieser Richtung frei ist: kein Fels, nicht über die Wasseroberfläche hinaus. */
  protected clearAhead(nx: number, ny: number, len: number) {
    const W = this.world;
    for (let s = 40; s <= len; s += 40) {
      const x = this.x + nx * s, y = this.y + ny * s;
      if (y < W.surfaceY + 60 || W.solidAt(x, y) || W.solidAt(x, y + 16) || W.solidAt(x, y - 16)) return s - 40;
    }
    return len;
  }

  // ------------------------------------------------------------------ Gegenstoß

  /** Etwas größere Beute kann sich wehren: genug Kraft, um dem Spieler einen Stoß zu verpassen? */
  get canCounter() {
    return this.role === 'prey' && !this.kin && this.def.power * this.sz >= this.world.playerPower() * 0.62;
  }

  protected endCounter() {
    this.cr = '';
    this.crT = 0;
    this.attacking = false;
    this.clearTint();
    this.setScale(this.sz);
    this.setAngle(0);
  }

  /**
   * Der Gegenstoß: kurz ausholen (rot aufglühen), dann mit Schwung auf den Angreifer schnellen – wie dein Stoß mit R.
   * Der Schaden ist klein genug, dass man ihn überlebt. Gibt true zurück, solange das Tier mit dem Gegenstoß beschäftigt ist.
   */
  protected counterRam(time: number, dt: number, tg: Target) {
    const W = this.world;
    const free = this.swims || this.flies;
    if (this.cr === '') {
      // zu weit weg oder noch nicht wieder bereit: weiter fliehen
      if (time < this.crReady || this.dist(tg) > 300) return false;
      this.cr = 'wind';
      this.crT = 0;
    }
    this.crT += dt;
    this.go('charge');
    if (this.cr === 'wind') {
      this.dir = Math.sign(tg.x - this.x) || this.dir;
      const k = Math.min(1, this.crT / 0.3);
      if (free) this.b.setVelocity(-this.dir * 45 * k, this.b.velocity.y * 0.8);
      else this.b.setVelocityX(-this.dir * 30 * k);
      this.setScale(this.sz * (1 - 0.14 * k), this.sz * (1 + 0.1 * k));
      this.setTint(k > 0.5 ? 0xff9a82 : 0xffb8a8);
      if (this.crT >= 0.3) {
        const dx = tg.x - this.x, dy = free ? tg.y - this.y : 0;
        const l = Math.hypot(dx, dy) || 1;
        this.crDir = { x: dx / l, y: dy / l };
        this.cr = 'dash';
        this.crT = 0;
        this.setScale(this.sz);
        audio.sfx('charge');
        W.puff(this.x - this.dir * this.displayWidth * 0.4, this.y, 4, 0xffffff);
      }
      return true;
    }
    if (this.cr === 'dash') {
      this.attacking = true;
      const v = this.def.speed * 2.6 + 60;
      if (free) this.b.setVelocity(this.crDir.x * v, this.crDir.y * v);
      else this.b.setVelocityX(this.crDir.x * v);
      if (Math.random() < 0.4) W.puff(this.x - this.dir * this.displayWidth * 0.4, this.y, 1);
      if (!tg.dead && overlaps(this.hitRect(), tg.hitRect())) {
        // kein Todesstoß: etwas Schaden, der nach der Stärke des Tieres geht (ein junger Fisch überlebt etliche davon)
        const dmg = clamp(this.def.power * this.sz * 0.5, 0.8, 3.5) * (time < this.rageUntil ? 1.5 : 1);
        if (tg === W.player) {
          (tg as PlayerLike).hurt(dmg, this.x, this.def.name);
          this.hitPlayerAt = time;
        } else (tg as Animal).hurt(dmg, this, 'ram');
        audio.sfx('ram');
        this.crReady = time + 2200;
        this.cr = 'rest';
        this.crT = 0;
      } else if (this.crT > 0.4) {
        this.crReady = time + 1600;
        this.cr = 'rest';
        this.crT = 0;
      }
      return true;
    }
    // erholen: kurz benommen, dann geht es weiter
    this.attacking = false;
    this.clearTint();
    this.setScale(this.sz);
    this.halt();
    if (this.crT > 0.6) {
      this.cr = '';
      this.crT = 0;
      return false;
    }
    return true;
  }

  /** Tempo auf der Flucht: kleine Fische sind pfeilschnell – hinterherschwimmen allein reicht nicht. */
  protected fleeSpeed() {
    const s = this.def.speed * (this.def.sprint ?? 1.3);
    return this.role === 'prey' && this.def.power <= 2.2 && this.swims ? Math.max(s, 255) : s;
  }

  /** Satte Jäger ruhen oft – am Meeresgrund bzw. am Boden. */
  protected wantsRest(time: number) {
    if ((this.role !== 'predator' && this.role !== 'apex') || this.visitor || this.boss || this.flies || this.kin) return false;
    if (this.st === 'rest') return time < this.restUntil;
    return this.hunger < 0.45 && time > this.nextRestAt;
  }

  protected restOnGround(time: number) {
    if (this.st !== 'rest') {
      this.go('rest');
      this.restUntil = time + 6000 + Math.random() * 9000;
      this.restY = this.floorBelow();
    }
    if (this.swims) {
      // hinabsinken bis knapp über den Grund, dann still liegen
      const ty = this.restY - this.b.height * 0.5 - 2;
      if (this.y < ty - 8) this.moveTo(this.x, ty, this.def.speed * 0.3);
      else this.halt();
    } else this.halt();
    if (time > this.restUntil) {
      this.go('wander');
      this.nextRestAt = time + 30000 + Math.random() * 30000;
    }
  }

  /** Höhe des Bodens unter dem Tier. */
  protected floorBelow() {
    const wb = this.world.physics.world.bounds;
    let y = this.y;
    while (y < wb.bottom && !this.world.solidAt(this.x, y + 4)) y += 12;
    return Math.min(y, wb.bottom);
  }

  /** Das nächste Versteck (Dickicht, Höhle, Felsspalte). */
  protected nearCover(range: number): Rect | null {
    let best: Rect | null = null;
    let bd = range;
    for (const c of this.world.cover) {
      const d = Math.hypot(c.x + c.w / 2 - this.x, c.y + c.h / 2 - this.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
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
    if (this.wantsRest(time)) return this.restOnGround(time);
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
          if (tg && tg !== W.player) this.contactBite(time, tg);
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
          if (tg !== W.player) this.contactBite(time, tg);
        } else if (t < 3.2) {
          this.attacking = true;
          b.setVelocity(this.dir * sp * 2, 0);
          if (tg !== W.player) this.contactBite(time, tg);
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

  /** Wie lange (ms) dieses Beutetier schon ununterbrochen davonrennt – 0, wenn es das gerade nicht tut. */
  runningFor(time: number) {
    if (this.role !== 'prey' || this.kin || this.ally || this.boss || this.visitor) return 0;
    return time - this.runLast < 350 ? time - this.runSince : 0;
  }

  private markRun() {
    const now = this.world.time.now;
    if (now - this.runLast > 350) this.runSince = now;
    this.runLast = now;
  }

  protected runFrom(x: number, y: number, speed: number) {
    this.markRun();
    const away = this.x >= x ? 1 : -1;
    const ty = this.swims || this.flies ? this.y + (this.y >= y ? 120 : -120) : this.y;
    this.moveTo(this.x + away * 240, ty, speed, true);
  }

  protected chase(tg: Target, speed: number) {
    const aboveY = this.flies && this.mv !== 'dive' && this.dist(tg) > 160 ? tg.y - 110 : tg.y;
    this.moveTo(tg.x, aboveY, speed, false);
  }

  /** Der Anführer eines Schwarms bzw. Rudels: das erste lebende Mitglied. */
  protected herdLead(): Animal | null {
    if (this.herdId < 0) return null;
    for (const m of this.world.herdOf(this.herdId)) if (!m.dead && m.active) return m;
    return null;
  }

  protected wander(time: number) {
    const lead = this.herdLead();
    const follower = !!lead && lead !== this && !lead.fleeFrom && !this.ally;
    if (time > this.wanderAt) {
      this.wanderAt = time + (follower ? 1200 + Math.random() * 1500 : 2500 + Math.random() * 3500);
      if (follower) {
        // dem Schwarm folgen: in der Nähe des Anführers bleiben
        const wb = this.world.physics.world.bounds;
        this.wanderX = clamp(lead!.x + (Math.random() - 0.5) * 260, wb.x + 60, wb.right - 60);
        this.wanderY = lead!.y + (Math.random() - 0.5) * (this.swims || this.flies ? 150 : 0);
      } else if (Math.random() < 0.3) {
        this.wanderX = this.x;
        this.wanderY = this.y;
      } else {
        // Herumtreiber ziehen weit durch den Lebensraum, die anderen bleiben in ihrem Revier
        // Eltern bleiben bei ihrem Gelege
        const post = this.guardPost;
        const roams = this.def.roam || (this.role === 'predator' && this.def.power >= 5);
        const range = post ? 280 : roams ? 2600 : 440;
        const wb = this.world.physics.world.bounds;
        const hx = post ? post.x : this.home.x, hy = post ? post.y : this.home.y;
        this.wanderX = clamp(hx + (Math.random() - 0.5) * range, wb.x + 60, wb.right - 60);
        this.wanderY = hy + (Math.random() - 0.5) * (this.swims || this.flies ? (post ? 110 : 160) : 0);
        if (roams && !post) this.home.x = this.wanderX;
      }
    }
    if (Math.abs(this.wanderX - this.x) < 10 && (!this.swims || Math.abs(this.wanderY - this.y) < 10)) {
      this.go('idle');
      this.halt();
      return;
    }
    this.go('wander');
    // wer den Anschluss verliert, schließt auf
    const lag = follower && this.dist(lead!) > 340 ? 1.7 : 1;
    this.moveTo(this.wanderX, this.wanderY, this.def.speed * 0.55 * lag);
  }

  protected drift() {
    this.b.setVelocity(Math.sin(this.t * 0.5 + this.phase) * this.def.speed * 0.7, Math.sin(this.t * 1.3 + this.phase) * this.def.speed * 1.3);
    this.setScale(this.sz * (1 + Math.sin(this.t * 2.6) * 0.06), this.sz * (1 - Math.sin(this.t * 2.6) * 0.06));
  }

  // ------------------------------------------------------------------ Kampf

  /** Biss in Reichweite? */
  /**
   * Angreifen: Erst holt das Tier sichtbar aus (man kann noch ausweichen), dann schnellt es vor und
   * beißt zu. Nur der Biss selbst schadet – bloßes Berühren nicht.
   */
  protected tryBite(time: number, tg: Target, reach = 1) {
    if (this.atk || time < this.biteReady || tg.dead || time < this.tiredUntil) return false;
    const b = this.b;
    const w = (b.width * 0.5 + 46) * reach;
    const r: Rect = this.dir > 0 ? { x: this.x, y: b.y - 12, w, h: b.height + 24 } : { x: this.x - w, y: b.y - 12, w, h: b.height + 24 };
    if (!overlaps(r, tg.hitRect())) return false;
    this.atk = 'wind';
    this.atkT = 0;
    this.atkTarget = tg;
    return true;
  }

  /** Während eines großen Angriffs (Vorstoß, Sturzflug): Wer berührt wird, wird gebissen (den Spieler trifft es über die Berührung). */
  protected contactBite(time: number, tg: Target) {
    if (time < this.biteReady || tg.dead || !overlaps(this.hitRect(), tg.hitRect())) return;
    this.biteReady = time + 900;
    (tg as Animal).hurt(this.def.dmg, this, 'bite');
  }

  /** Schaden eines Bisses (Pflanzenfresser, die sich wehren, beißen auch – nur schwächer). */
  protected get biteDmg() {
    return Math.max(this.def.dmg, this.def.power * 0.8);
  }

  /** Teile der Angriffsbewegung, die an der Figur sichtbar sind (Artgenossen zeigen sie an ihrer Ansicht). */
  protected get showsAttack() {
    return true;
  }

  protected attackStep(time: number, dt: number) {
    const tg = this.atkTarget;
    this.atkT += dt;
    const big = this.role === 'apex' || !!this.def.boss;
    const WIND = big ? 0.45 : 0.28, STRIKE = 0.2, REC = 0.3;
    if (!tg || tg.dead) return this.endAttack(time);
    const sx = this.sz, vis = this.showsAttack, free = this.swims || this.flies;
    if (this.atk === 'wind') {
      // ausholen: zurückweichen, sich spannen, rötlich aufglühen
      this.dir = Math.sign(tg.x - this.x) || this.dir;
      const k = Math.min(1, this.atkT / WIND);
      // Warnung, wenn es dich trifft: ein rotes Ausrufezeichen, Blasen und ein Knurren – jetzt ausweichen!
      if (!this.warned && tg === this.world.player && (this.def.power >= 6 || this.role === 'defender')) {
        this.warned = true;
        this.cueAttack(big);
      }
      if (free) this.b.setVelocity(-this.dir * 50 * k, this.b.velocity.y * 0.85);
      else this.b.setVelocityX(-this.dir * 30 * k);
      if (vis) {
        this.setScale(sx * (1 - 0.16 * k), sx * (1 + 0.1 * k));
        if (free) this.setAngle(-this.dir * 10 * k);
        this.setTint(k > 0.5 ? 0xff9a82 : 0xffb8a8);
      }
      if (this.atkT >= WIND) {
        this.atk = 'strike';
        this.atkT = 0;
        const dx = tg.x - this.x, dy = free ? tg.y - this.y : 0;
        const l = Math.hypot(dx, dy) || 1;
        this.atkDir = { x: dx / l, y: dy / l };
        this.onStrike();
      }
    } else if (this.atk === 'strike') {
      // vorschnellen und zuschnappen – mit einer Blasenspur
      const v = Math.max(this.def.speed * 2.6, 280) * (big ? 1.15 : 1);
      if (this.world.time.now > this.trailAt) {
        this.trailAt = this.world.time.now + 45;
        this.world.puff(this.x - this.atkDir.x * this.displayWidth * 0.3, this.y, 1, 0xffffff);
      }
      if (free) this.b.setVelocity(this.atkDir.x * v, this.atkDir.y * v);
      else this.b.setVelocityX(this.atkDir.x * v);
      if (vis) {
        this.setScale(sx * 1.14, sx * 0.93);
        if (free) this.setAngle(this.dir * 6);
        this.clearTint();
      }
      const b = this.b;
      const w = b.width * 0.5 + 16;
      const r: Rect = this.dir > 0 ? { x: this.x, y: b.y, w, h: b.height } : { x: this.x - w, y: b.y, w, h: b.height };
      if (overlaps(r, tg.hitRect())) {
        this.strikeHit(time, tg);
        this.atk = 'recover';
        this.atkT = 0;
      } else if (this.atkT >= STRIKE) {
        this.atk = 'recover';
        this.atkT = 0;
      }
    } else {
      this.halt();
      if (vis) this.setScale(sx * (1 + 0.05 * (1 - this.atkT / REC)), sx);
      if (this.atkT >= REC) this.endAttack(time);
    }
  }

  /** Hinweis auf einen Angriff, der dich trifft: Ausrufezeichen, Blasen, Knurren. */
  protected cueAttack(big: boolean) {
    const sc = this.scene;
    const t = sc.add.text(this.x, this.y - this.displayHeight * 0.55 - 18, '!', { fontFamily: 'Cinzel, serif', fontSize: big ? '58px' : '44px', color: '#e0412e', fontStyle: '700', stroke: '#1a0604', strokeThickness: 7 })
      .setOrigin(0.5).setDepth(DEPTH.text);
    sc.tweens.add({ targets: t, y: t.y - 26, scale: { from: 0.6, to: 1.15 }, duration: 260, ease: 'Back.out' });
    sc.tweens.add({ targets: t, alpha: 0, delay: 260, duration: 260, onComplete: () => t.destroy() });
    this.world.puff(this.x, this.y - this.displayHeight * 0.3, big ? 6 : 3, 0xffb8a0);
    audio.sfx(big ? 'growl' : 'warn');
  }

  protected endAttack(time: number) {
    this.warned = false;
    this.atk = '';
    this.atkTarget = null;
    if (this.showsAttack) {
      this.setScale(this.sz);
      if (!this.mv) this.setAngle(0);
      this.clearTint();
    }
    this.biteReady = time + (this.role === 'apex' ? 1100 : 850);
  }

  protected strikeHit(time: number, tg: Target) {
    const p = this.world.player;
    if (tg === p) {
      p.hurt(this.biteDmg, this.x, this.def.name);
      this.hitPlayerAt = time;
      if (Math.random() < 0.5) audio.sfx('snarl');
    } else (tg as Animal).hurt(this.biteDmg, this, 'bite');
    this.onStrikeHit(tg);
  }

  /** Augenblick des Zuschnappens (Artgenossen öffnen hier ihr Maul). */
  protected onStrike() {}

  /** Der Biss hat getroffen. */
  protected onStrikeHit(tg: Target) {
    void tg;
  }

  /** Schaden nehmen. */
  hurt(dmg: number, from: Target, kind: 'bite' | 'ram' | 'other') {
    if (this.dead) return;
    const now = this.world.time.now;
    // erschöpft kann es sich kaum wehren
    this.hp -= dmg * this.weak * (now < this.tiredUntil ? 1.5 : 1);
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
    // Wer sich wehren kann, schlägt sofort zurück: aufblähen, rot aufglühen, kurz danach der Gegenangriff
    if (from === this.world.player && (this.role === 'predator' || this.role === 'apex' || this.role === 'defender') && !this.atk) {
      this.fightBack(now);
    }
    if ((this.role === 'apex' || this.role === 'predator') && !(this.ally && from === this.world.player)) this.target = from;
    // mittelgroße Pflanzenfresser wehren sich, statt zu fliehen – kleine fliehen
    const W = this.world;
    if (this.role === 'prey' && from === W.player && this.hp > this.maxHp * 0.35 && this.canCounter) {
      this.defendUntil = now + 3500;
      this.target = from;
    }
    // wer angegriffen wird, ist dir gegenüber nicht mehr ruhig
    if (from === W.player) this.calm = 0;
  }

  /** Die Gegenwehr nach einem Treffer: sichtbar aufbäumen und schnell zurückschnappen. */
  protected fightBack(now: number) {
    const sc = this.scene;
    sc.tweens.add({ targets: this, scaleX: this.sz * 1.2, scaleY: this.sz * 0.84, yoyo: true, duration: 90, repeat: 1 });
    this.world.time.delayedCall(120, () => {
      if (!this.dead && !this.atk) this.setTint(0xff7a62);
    });
    this.world.time.delayedCall(420, () => {
      if (!this.dead && !this.atk) this.clearTint();
    });
    this.world.puff(this.x, this.y, this.role === 'apex' ? 8 : 4, 0xffa890);
    this.biteReady = Math.min(this.biteReady, now + (this.role === 'apex' ? 380 : 300));
    if (this.role === 'apex' || this.def.power >= 10) audio.sfx('growl');
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
