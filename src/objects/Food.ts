import Phaser from 'phaser';
import type { Theme } from '../data/epochs';
import { foodKey, HEAL, MEAT_SIZES, roeKey, TOXIC } from '../art/worldArt';
import type { Animal } from './Animal';
import { DEPTH } from '../config';
import type { Rect } from '../util/math';

/** Eine fressbare Pflanze. Wird abgefressen und wächst langsam nach. */
export class Plant {
  img: Phaser.GameObjects.Image;
  units: number;
  readonly max: number;
  private regrowAt = 0;
  /** giftig: schadet ein wenig, gibt aber kurz Schwung */
  readonly toxic: boolean;
  /** Heilkraut: schließt Wunden (Fleisch und gewöhnliche Pflanzen tun das nicht) */
  readonly heals: boolean;
  /** Artgenossen, die gerade hierher wollen */
  wanted = new Set<object>();

  constructor(private scene: Phaser.Scene, public x: number, public y: number, private theme: Theme, units = 3, private variant = 0) {
    this.max = units;
    this.units = units;
    this.toxic = variant === TOXIC;
    this.heals = variant === HEAL;
    this.img = scene.add.image(x, y, foodKey(theme, 0, variant)).setOrigin(0.5, 1).setDepth(DEPTH.plants);
    if (x % 2 > 1) this.img.setFlipX(true);
  }

  private get key() {
    return foodKey(this.theme, this.stage, this.variant);
  }

  get stage() {
    return this.units >= this.max ? 0 : this.units > 0 ? 1 : 2;
  }

  get rect(): Rect {
    return { x: this.x - 26, y: this.y - 50, w: 52, h: 52 };
  }

  /** Ein Bissen davon. Gibt false zurück, wenn nichts mehr da ist. */
  take(now: number) {
    if (this.units <= 0) return false;
    this.units--;
    this.regrowAt = now + 22000;
    this.img.setTexture(this.key);
    this.scene.tweens.add({ targets: this.img, scaleY: { from: 0.85, to: 1 }, duration: 200 });
    return true;
  }

  update(now: number, fast = false) {
    if (this.units < this.max && now > this.regrowAt) {
      this.units++;
      this.regrowAt = now + (fast ? 2500 : 22000);
      this.img.setTexture(this.key);
    }
  }

  /** Alles wächst auf einmal nach (Blütezeit). */
  refill() {
    if (this.units >= this.max) return;
    this.units = this.max;
    this.img.setTexture(this.key);
    this.scene.tweens.add({ targets: this.img, scaleY: { from: 0.6, to: 1 }, duration: 600, ease: 'Back.out' });
  }
}

/**
 * Ein Gelege am Meeresboden. Die Eltern (Wächter) bleiben in der Nähe und werden zornig, wenn jemand daran frisst und
 * sie es mitbekommen. Unberührt schlüpft es nach einer Weile.
 */
export class Roe {
  img: Phaser.GameObjects.Image;
  units: number;
  readonly max: number;
  /** Eltern, die über dem Gelege wachen */
  guards: Animal[] = [];
  /** wann es schlüpft (Spielzeit in ms), unendlich = nie */
  hatchAt = Infinity;
  hatched = false;
  /** Laich deiner Art aus dem Laichfluss (dein eigenes Gelege bzw. eins, das du befruchten kannst): Man frisst es nicht */
  spared = false;

  constructor(private scene: Phaser.Scene, public x: number, public y: number, readonly species: string, readonly tone: number, units = 4, readonly own = false) {
    this.max = units;
    this.units = units;
    this.img = scene.add.image(x, y, roeKey(tone, 0)).setOrigin(0.5, 1).setDepth(DEPTH.plants + 1);
    if (x % 2 > 1) this.img.setFlipX(true);
  }

  get stage() {
    return this.units >= this.max ? 0 : this.units > 1 ? 1 : 2;
  }

  get rect(): Rect {
    return { x: this.x - 32, y: this.y - 38, w: 64, h: 42 };
  }

  /** Ein Bissen. Gibt false zurück, wenn nichts mehr da ist. */
  take() {
    if (this.units <= 0) return false;
    this.units--;
    if (this.units <= 0) {
      this.scene.tweens.add({ targets: this.img, alpha: 0, duration: 400, onComplete: () => this.img.destroy() });
    } else this.img.setTexture(roeKey(this.tone, this.stage));
    this.scene.tweens.add({ targets: this.img, scaleY: { from: 0.8, to: 1 }, duration: 180 });
    return true;
  }

  /** Die Jungen sind geschlüpft: das Gelege verschwindet. */
  vanish() {
    this.hatched = true;
    this.units = 0;
    this.scene.tweens.add({ targets: this.img, alpha: 0, scaleY: 0.4, duration: 600, onComplete: () => this.img.destroy() });
  }
}

/** Wo ein Fleischstück treibt: Wasseroberfläche und fester Boden. */
export interface MeatEnv {
  water: boolean;
  surfaceY: number;
  solidAt(x: number, y: number): boolean;
}

/**
 * Was von einem erlegten Tier übrig bleibt: ein oder mehrere Stücke. Merkt sich, wer bei der Jagd
 * geholfen hat (Artgenossen wollen dann mitfressen) und ob der Spieler etwas abgegeben hat.
 */
export class Kill {
  meats: Meat[] = [];
  /** Artgenossen, die mitgekämpft haben */
  helpers = new Set<object>();
  /** wer schon etwas davon gefressen hat */
  fed = new Set<object>();
  playerAte = false;
  constructor(public byPlayer: boolean) {}

  get left() {
    return this.meats.some((m) => !m.gone && m.value > 0.5);
  }
}

/** Fressen für andere Tiere: so viel Sättigung nimmt ein Tier mit einem Bissen. */
const ANIMAL_BITE = 2;

/**
 * Ein saftiges Stück Fleisch (wie in E.V.O.). Im Wasser sinkt es zügig zu Boden (große Stücke
 * schneller), an Land fällt es herunter. Nach einer Weile verdirbt es.
 */
export class Meat {
  img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  /** Sättigung, die noch darin steckt */
  value: number;
  readonly max: number;
  /** 0 klein, 1 mittel, 2 groß */
  readonly size: 0 | 1 | 2;
  private vx: number;
  private vy: number;
  private resting = false;
  private bornAt: number;
  private ph = Math.random() * 6;
  gone = false;
  /** wer davon fressen will bzw. gefressen hat (für das Lernen der Artgenossen) */
  wanted = new Set<object>();
  ateFrom = new Set<object>();
  playerBites = 0;
  /** Mehrspieler: Nummer des Stücks im Ort */
  netId = 0;
  /** Mehrspieler: Das Stück gehört dem Ortswächter – es liegt dort, wo er es meldet, und verdirbt nicht von selbst */
  net?: { x: number; y: number };
  /** Mehrspieler: Jemand hat davon abgebissen (so viel) – der Ortswächter erfährt es */
  onBite?: (got: number) => void;

  constructor(
    private scene: Phaser.Scene,
    private env: MeatEnv,
    public x: number,
    public y: number,
    value: number,
    now: number,
    public kill: Kill,
    vx = 0,
    vy = 0,
  ) {
    this.value = value;
    this.max = value;
    this.size = value < 3 ? 0 : value < 6 ? 1 : 2;
    this.vx = vx;
    this.vy = vy;
    this.bornAt = now;
    this.glow = scene.add.image(x, y, 'glow').setDepth(DEPTH.carcass - 1).setTint(0xff6040).setAlpha(0.18)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(0.22 + this.size * 0.12);
    this.img = scene.add.image(x, y, `meat_${this.size}`).setDepth(DEPTH.carcass).setScale(0.5).setFlipX(Math.random() < 0.5);
    // kurz aufploppen
    scene.tweens.add({ targets: this.img, scale: { from: 0.2, to: 0.5 }, duration: 260, ease: 'Back.out' });
    kill.meats.push(this);
  }

  get byPlayer() {
    return this.kill.byPlayer;
  }

  /** Bissen, die ein anderes Tier noch davon nehmen kann */
  get units() {
    return this.gone ? 0 : Math.ceil(this.value / ANIMAL_BITE);
  }

  get rect(): Rect {
    const w = MEAT_SIZES[this.size][0] + 14, h = MEAT_SIZES[this.size][1] + 14;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  /** Ein anderes Tier beißt hinein. */
  take(_now?: number) {
    return this.bite(ANIMAL_BITE) > 0;
  }

  /** Nimmt höchstens so viel Sättigung heraus und gibt zurück, wie viel es war. */
  bite(amount: number) {
    if (this.gone || this.value <= 0) return 0;
    const got = Math.min(this.value, amount);
    this.value -= got;
    if (got > 0) this.onBite?.(got);
    if (this.value <= 0.5) this.remove(true);
    else this.img.setScale(0.5 * (0.6 + 0.4 * this.value / this.max));
    return got;
  }

  /** Mehrspieler: neue Meldung des Ortswächters (Lage und was noch übrig ist). */
  netUpdate(x: number, y: number, value: number) {
    this.net = { x, y };
    if (value < this.value - 0.01) {
      this.value = value;
      if (this.value <= 0.5) this.remove(true);
      else this.img.setScale(0.5 * (0.6 + 0.4 * this.value / this.max));
    }
  }

  update(now: number, dt: number) {
    if (this.gone) return;
    if (this.net) {
      this.x += (this.net.x - this.x) * Math.min(1, dt * 8);
      this.y += (this.net.y - this.y) * Math.min(1, dt * 8);
      this.img.setPosition(this.x, this.y).setAngle(Math.sin(now / 700 + this.ph) * 8);
      this.glow.setPosition(this.x, this.y).setAlpha(0.14 + 0.08 * Math.sin(now / 260 + this.ph));
      return;
    }
    const e = this.env;
    const h = MEAT_SIZES[this.size][1] * 0.5;
    if (e.water) {
      // Fleisch sinkt zu Boden – große Stücke schneller
      const target = this.size === 0 ? 45 : this.size === 1 ? 70 : 100;
      this.vy += (target - this.vy) * Math.min(1, dt * 1.6);
      this.vx *= Math.max(0, 1 - dt * 1.8);
      const sway = this.vy > 0 && !this.resting ? Math.sin(now / 900 + this.ph) * 5 : 0;
      let ny = this.y + this.vy * dt;
      const nx = this.x + (this.vx + sway) * dt;
      if (this.vy < 0 && (ny - h < e.surfaceY + 6 || e.solidAt(nx, ny - h))) {
        ny = this.y;
        this.vy = 0;
      }
      if (this.vy > 0 && e.solidAt(nx, ny + h)) {
        ny = this.y;
        this.vy = 0;
      }
      if (!e.solidAt(nx, ny)) this.x = nx;
      this.y = ny;
      this.img.setAngle(Math.sin(now / 700 + this.ph) * 8);
    } else if (!this.resting) {
      this.vy = Math.min(900, this.vy + 1100 * dt);
      const ny = this.y + this.vy * dt;
      const nx = this.x + this.vx * dt;
      if (e.solidAt(this.x, ny + h)) {
        // aufschlagen, ein kleiner Hüpfer, dann liegen bleiben
        if (this.vy > 260) this.vy = -this.vy * 0.3;
        else {
          this.vy = 0;
          this.resting = true;
        }
      } else this.y = ny;
      if (!e.solidAt(nx, this.y)) this.x = nx;
      this.vx *= Math.max(0, 1 - dt * 2.5);
    }
    this.img.setPosition(this.x, this.y);
    this.glow.setPosition(this.x, this.y).setAlpha(0.14 + 0.08 * Math.sin(now / 260 + this.ph));
    // nach einer Weile verdirbt es: erst blinken, dann weg
    const age = now - this.bornAt;
    if (age > 48000) this.img.setAlpha(Math.floor(now / 120) % 2 ? 0.4 : 1);
    if (age > 52000) this.remove();
  }

  remove(eaten = false) {
    if (this.gone) return;
    this.gone = true;
    this.value = 0;
    const img = this.img, glow = this.glow;
    if (eaten) this.scene.tweens.add({ targets: img, scale: 0.1, duration: 160 });
    this.scene.tweens.add({
      targets: [img, glow],
      alpha: 0,
      duration: eaten ? 160 : 700,
      onComplete: () => {
        img.destroy();
        glow.destroy();
      },
    });
  }
}

/** Eine Muschel auf dem Grund. Wer sie berührt, legt eine Zeile der Steintafel frei. */
export class Shell {
  img: Phaser.GameObjects.Image;
  /** nur ein ganz zarter Schimmer, damit man sie findet – kein Leuchten */
  halo: Phaser.GameObjects.Image;
  taken = false;

  constructor(private scene: Phaser.Scene, public x: number, public y: number, readonly id: string) {
    this.halo = scene.add.image(x, y - 20, 'glow').setTint(0xffe6d6).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.pickups - 0.1).setDisplaySize(130, 100).setAlpha(0.09);
    this.img = scene.add.image(x, y + 4, 'shell').setOrigin(0.5, 1).setDepth(DEPTH.pickups).setDisplaySize(62, 68);
    scene.tweens.add({ targets: this.halo, alpha: 0.045, yoyo: true, repeat: -1, duration: 2400 + (x % 7) * 110, ease: 'Sine.inOut' });
  }

  get rect(): Rect {
    return { x: this.x - 34, y: this.y - 62, w: 68, h: 68 };
  }

  /** Aufgehoben: Die Muschel steigt ein Stück auf und verblasst. */
  take() {
    if (this.taken) return;
    this.taken = true;
    this.scene.tweens.killTweensOf(this.halo);
    this.scene.tweens.add({ targets: this.halo, alpha: 0, duration: 600, onComplete: () => this.halo.destroy() });
    this.scene.tweens.add({ targets: this.img, y: this.y - 34, alpha: 0, duration: 650, ease: 'Sine.out', onComplete: () => this.img.destroy() });
  }
}
