import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { FishRig, type FishPose } from '../art/fish/rig';
import { InvertebrateRig } from '../art/fauna/invertebrate';
import { speciesFishTextures } from '../art/fauna/fish';
import { EPOCHS, epochSpecies } from '../data/epochs';

const supported = new Set([...epochSpecies(EPOCHS.find(e => e.id === 'devon')!), 'rhizodus',
  'elonichthys', 'apsopelix', 'gillicus', 'enchodus', 'protosphyraena', 'xiphactinus']);

/** A visual child of the existing Arcade sprite: no changes to collisions, attack reach or network state. */
export class FaunaView extends Phaser.GameObjects.Container {
  readonly rig: FishRig | InvertebrateRig;
  readonly naturalWidth: number;
  private clock = Math.random() * 6;
  private open = 0;
  private lastX?: number;
  private lastY?: number;
  private speed = 0;
  private lastFrame = -1;
  private lastTint = -1;
  private lastTintMode = -1;

  static supports(scene: Phaser.Scene, def: SpeciesDef) {
    return scene.sys.game.renderer.type === Phaser.WEBGL && supported.has(def.id)
      && !new URLSearchParams(location.search).has('oldfauna');
  }

  constructor(scene: Phaser.Scene, readonly def: SpeciesDef) {
    super(scene, 0, 0);
    this.rig = def.art.t === 'fish' ? new FishRig(scene, speciesFishTextures(scene, def)) : new InvertebrateRig(scene, def);
    this.add(this.rig.parts);
    this.naturalWidth = this.rig instanceof FishRig ? (this.rig.A.bounds.x1 - this.rig.A.bounds.x0) * this.rig.A.s : this.rig.width;
  }

  advance(dt: number, speed01: number, open: number, coil = 0) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.clock += dt;
    this.open += (open - this.open) * Math.min(1, dt * 18);
    const p: FishPose = { t: this.clock, dt, speed01, mode: speed01 < 0.04 ? 'idle' : this.def.crawl ? 'crawl' : 'swim',
      open: this.open, lunge: open > 0.7 ? 0.2 : 0, clench: 0, grind: 0, coil, dip: 0, pitch: 0, still: 0, crawlPhase: this.clock * 5 };
    this.rig.pose(p);
  }

  /** Called immediately before rendering, after local visibility, physics, AI and network interpolation. */
  follow(sprite: Phaser.GameObjects.Sprite, dt: number, width: number, open: number) {
    const frame = this.scene.game.loop.frame;
    const fresh = frame !== this.lastFrame;
    const dx = this.lastX === undefined ? 0 : sprite.x - this.lastX, dy = this.lastY === undefined ? 0 : sprite.y - this.lastY;
    if (fresh) { this.lastX = sprite.x; this.lastY = sprite.y; }
    const v = Math.hypot(dx, dy) / Math.max(0.001, dt);
    if (fresh) this.speed += (Math.min(1, v / Math.max(20, this.def.speed)) - this.speed) * Math.min(1, dt * 8);
    const scale = width / this.naturalWidth;
    this.setPosition(sprite.x, sprite.y).setRotation(sprite.rotation)
      .setScale(scale * sprite.scaleX * (sprite.flipX ? -1 : 1), scale * sprite.scaleY * (sprite.flipY ? -1 : 1))
      .setAlpha(sprite.alpha).setScrollFactor(sprite.scrollFactorX, sprite.scrollFactorY);
    // Tint is inherited explicitly by every renderable part, including nested appendages.
    const tint = (container: Phaser.GameObjects.Container) => {
      for (const child of container.list) {
        if (child instanceof Phaser.GameObjects.Container) tint(child);
        else if ('setTint' in child) {
          const part = child as Phaser.GameObjects.Image;
          if (sprite.isTinted) part.setTint(sprite.tintTopLeft).setTintMode(sprite.tintMode);
          else part.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        }
      }
    };
    const color = sprite.isTinted ? sprite.tintTopLeft : 0xffffff;
    const tintMode = sprite.isTinted ? sprite.tintMode : Phaser.TintModes.MULTIPLY;
    if (color !== this.lastTint || tintMode !== this.lastTintMode) {
      tint(this);
      this.lastTint = color; this.lastTintMode = tintMode;
    }
    if (fresh && sprite.alpha > 0.005) this.advance(dt, this.speed, open);
    this.lastFrame = frame;
  }
}
