import { spriteReferenceSpan } from '../data/animalSize';
import Phaser from 'phaser';
import type { SpeciesDef } from '../data/species';
import { FishRig, type FishPose } from '../art/fish/rig';
import { InvertebrateRig } from '../art/fauna/invertebrate';
import { speciesFishTextures } from '../art/fauna/fish';
import { WORLD_FISH_IDS } from '../art/fish/worldFish';
import { EPOCHS, epochSpecies } from '../data/epochs';
import { SPECIES } from '../data/species';

/** Gezeichnete Fische und Wirbellose der gemalten Zeitalter (Devon, Perm …); Vierbeiner behalten ihre Bilder. */
const RIGGED = new Set(['fish', 'jelly', 'cone', 'trilo', 'bug']);
const supported = new Set([
  ...EPOCHS.filter(e => e.painted).flatMap(epochSpecies).filter(id => RIGGED.has(SPECIES[id]?.art.t ?? '')),
  'rhizodus', 'elonichthys', 'apsopelix', 'gillicus', 'enchodus', 'protosphyraena', 'xiphactinus']);

/** A visual child of the existing Arcade sprite: no changes to collisions, attack reach or network state. */
export class FaunaView extends Phaser.GameObjects.Container {
  readonly rig: FishRig | InvertebrateRig;
  readonly naturalWidth: number;
  readonly referenceSpan: number;
  private clock = Math.random() * 6;
  private open = 0;
  private glare = 0;
  private lastX?: number;
  private lastY?: number;
  private speed = 0;
  private lastFrame = -1;
  private lastTint = -1;
  private lastTintMode = -1;

  static supports(scene: Phaser.Scene, def: SpeciesDef) {
    return scene.sys.game.renderer.type === Phaser.WEBGL && supported.has(def.id)
      && !new URLSearchParams(location.search).has('oldfauna')
      && !(WORLD_FISH_IDS.includes(def.id as typeof WORLD_FISH_IDS[number]) && new URLSearchParams(location.search).has('oldworld'));
  }

  constructor(scene: Phaser.Scene, readonly def: SpeciesDef) {
    super(scene, 0, 0);
    this.rig = def.art.t === 'fish' ? new FishRig(scene, speciesFishTextures(scene, def)) : new InvertebrateRig(scene, def);
    if (this.rig instanceof FishRig) {
      const A = this.rig.A, b = A.bounds;
      this.add(new Phaser.GameObjects.Container(scene, -(b.x0 + b.x1) * A.s / 2, -(b.y0 + b.y1) * A.s / 2, this.rig.parts));
    } else this.add(this.rig.parts);
    this.naturalWidth = this.rig instanceof FishRig ? (this.rig.A.bounds.x1 - this.rig.A.bounds.x0) * this.rig.A.s : this.rig.width;
    const art = def.art;
    this.referenceSpan = art.t === 'jelly' ? 64 : art.t === 'cone' ? 85 : art.t === 'trilo' ? 86 : art.t === 'bug' ? 106 : this.naturalWidth;
  }

  advance(dt: number, speed01: number, open: number, coil = 0, attack = Math.min(1, open / 0.55)) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.clock += dt;
    this.open += (open - this.open) * Math.min(1, dt * 18);
    this.glare += (attack - this.glare) * Math.min(1, dt * 18);
    if (this.glare < 0.01 && attack === 0) this.glare = 0;
    const winding = Math.max(0, Math.min(1, (this.open - 0.15) / 0.55)) * (open >= this.open ? 1 : 0);
    const snapping = Math.max(0, this.open - open);
    const p: FishPose = { t: this.clock, dt, speed01, mode: speed01 < 0.04 ? 'idle' : this.def.crawl ? 'crawl' : 'swim',
      open: this.open, lunge: snapping * 0.8 - winding * 0.2, clench: snapping * 0.3, grind: 0,
      coil: Math.max(coil, winding * 0.45), dip: 0, pitch: -winding * 0.05, still: 0, crawlPhase: this.clock * 5 };
    this.rig.pose(p);
    if (this.rig instanceof FishRig) this.rig.eyes(0, 0.95 * Math.max(attack, this.glare));
  }

  /** Called immediately before rendering, after local visibility, physics, AI and network interpolation. */
  follow(sprite: Phaser.GameObjects.Sprite, dt: number, width: number, open: number, attacking?: boolean) {
    const frame = this.scene.game.loop.frame;
    const fresh = frame !== this.lastFrame;
    const dx = this.lastX === undefined ? 0 : sprite.x - this.lastX, dy = this.lastY === undefined ? 0 : sprite.y - this.lastY;
    if (fresh) { this.lastX = sprite.x; this.lastY = sprite.y; }
    const v = Math.hypot(dx, dy) / Math.max(0.001, dt);
    if (fresh) this.speed += (Math.min(1, v / Math.max(20, this.def.speed)) - this.speed) * Math.min(1, dt * 8);
    const scale = spriteReferenceSpan(this.def, width) / this.referenceSpan;
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
    if (fresh && sprite.alpha > 0.005) this.advance(dt, this.speed, open, 0, attacking === undefined ? Math.min(1, open / 0.55) : attacking ? 1 : 0);
    this.lastFrame = frame;
  }
}
