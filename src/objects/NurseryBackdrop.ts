import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { lagoonKey, lagoonEnabled } from '../art/lagoonAssets';
import type { Weather } from '../sim/weather';

/** Mirrors instances of the same texture, without a second panorama-sized GPU texture. */
class PaintedPlane {
  private images: Phaser.GameObjects.Image[] = [];
  private width: number;

  constructor(private scene: Phaser.Scene, private key: string, private y: number, private height: number, private factor: number, private depth: number, private alpha = 1) {
    const src = scene.textures.get(key).getSourceImage();
    this.width = height * src.width / src.height;
  }

  update(tint = 0xffffff) {
    const v = this.scene.cameras.main.worldView;
    const offset = v.left * (1 - this.factor);
    const first = Math.floor((v.left - offset - 40) / this.width);
    const count = Math.ceil((v.width + 80) / this.width) + 1;
    while (this.images.length < count) {
      this.images.push(this.scene.add.image(0, this.y, this.key).setOrigin(0).setDisplaySize(this.width, this.height).setDepth(this.depth).setAlpha(this.alpha));
    }
    this.images.forEach((image, i) => {
      const index = first + i;
      image.setVisible(i < count && v.bottom > this.y && v.top < this.y + this.height);
      if (i < count) image.setPosition(offset + index * this.width, this.y).setFlipX(Math.abs(index % 2) === 1).setTint(tint);
    });
  }

  destroy() { this.images.forEach(image => image.destroy()); this.images = []; }
}

/** Quiet painted distance; existing waves, drifting particles and water light provide the motion. */
export class NurseryBackdrop {
  private water: PaintedPlane;
  private coast: PaintedPlane;

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (!lagoonEnabled(scene, ep, place)) return undefined;
    return new NurseryBackdrop(scene, L);
  }

  private constructor(scene: Phaser.Scene, L: LevelData) {
    const height = Math.max(900, L.height - L.surfaceY - 120);
    this.water = new PaintedPlane(scene, lagoonKey('water'), L.surfaceY - 20, height, .24, DEPTH.bg);
    // The source has transparent sky above the trees: register its painted shoreline, not the canvas bottom.
    // Tree tips at row 435, shoreline at 659 of 724. Keep the actual trees only 100 world pixels tall.
    const coastScale = 100 / (659 - 435);
    this.coast = new PaintedPlane(scene, lagoonKey('coast'), L.surfaceY + 5 - 659 * coastScale,
      724 * coastScale, .08, DEPTH.decoFront + .71, .8);
    scene.events.once('shutdown', this.destroy, this);
  }

  update(weather: Weather) {
    const shade = Math.round(255 - weather.cloud * 35);
    const tint = (shade << 16) | (shade << 8) | shade;
    this.water.update(tint); this.coast.update(tint);
  }

  private destroy() { this.water.destroy(); this.coast.destroy(); }
}
