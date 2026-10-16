import Phaser from 'phaser';
import type { Theme } from '../data/epochs';
import type { SpeciesDef } from '../data/species';
import { foodKey } from '../art/worldArt';
import { speciesKey } from '../art/speciesArt';
import { DEPTH } from '../config';
import type { Rect } from '../util/math';

/** Eine fressbare Pflanze. Wird abgefressen und wächst langsam nach. */
export class Plant {
  img: Phaser.GameObjects.Image;
  units: number;
  readonly max: number;
  private regrowAt = 0;
  /** Artgenossen, die gerade hierher wollen */
  wanted = new Set<object>();

  constructor(private scene: Phaser.Scene, public x: number, public y: number, private theme: Theme, units = 3, private variant = 0) {
    this.max = units;
    this.units = units;
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

/** Die Überreste eines Tiers. Liefert Fleisch, bis es aufgefressen oder verrottet ist. */
export class Carcass {
  img: Phaser.GameObjects.Image;
  private blood: Phaser.GameObjects.Image;
  units: number;
  readonly max: number;
  private bornAt: number;
  gone = false;
  /** wer davon fressen wollte bzw. gefressen hat (für das Lernen der Artgenossen) */
  wanted = new Set<object>();
  ateFrom = new Set<object>();
  playerBites = 0;

  constructor(
    private scene: Phaser.Scene,
    public x: number,
    public y: number,
    public def: SpeciesDef,
    water: boolean,
    now: number,
    dir: number,
    /** vom Spieler erlegt – wer davon mitfrisst, fasst Vertrauen */
    public byPlayer = false,
  ) {
    this.units = Math.max(1, def.meat);
    this.max = this.units;
    this.bornAt = now;
    this.blood = scene.add.image(x, y + 2, 'blood').setDepth(DEPTH.carcass - 1).setAlpha(water ? 0.35 : 0.8);
    this.blood.setScale(Math.min(3.6, 0.6 + def.meat * 0.2), 1.2);
    this.img = scene.add.image(x, y, speciesKey(def.id, 0))
      .setDepth(DEPTH.carcass)
      .setFlipY(true)
      .setFlipX(dir < 0)
      .setTint(0x7a5048)
      .setOrigin(0.5, 0.75);
    if (water) this.img.setAlpha(0.9);
  }

  get rect(): Rect {
    const w = Math.max(40, this.img.displayWidth * 0.8), h = Math.max(30, this.img.displayHeight * 0.8);
    return { x: this.x - w / 2, y: this.y - h, w, h: h + 10 };
  }

  take(_now?: number) {
    if (this.units <= 0) return false;
    this.units--;
    const k = 0.5 + 0.5 * (this.units / this.max);
    this.img.setScale(k);
    this.img.setTint(this.units > 0 ? 0x7a4840 : 0x4a2420);
    if (this.units <= 0) this.remove();
    return true;
  }

  update(now: number) {
    // nach einer Weile verrotten die Reste
    if (!this.gone && now - this.bornAt > 60000) this.remove();
  }

  remove() {
    if (this.gone) return;
    this.gone = true;
    this.scene.tweens.add({
      targets: [this.img, this.blood],
      alpha: 0,
      duration: 900,
      onComplete: () => {
        this.img.destroy();
        this.blood.destroy();
      },
    });
  }
}
