import Phaser from 'phaser';
import { CAMERA, DEPTH, W } from '../config';
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
  private coast: Phaser.GameObjects.Image;
  private farSea: Phaser.GameObjects.Rectangle;
  private cliffAir: Phaser.GameObjects.Image;
  private cliffWater: Phaser.GameObjects.Image;
  private trees: { image: Phaser.GameObjects.Image; fraction: number }[] = [];
  private coastWidth: number;

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (!lagoonEnabled(scene, ep, place)) return undefined;
    return new NurseryBackdrop(scene, L);
  }

  private constructor(scene: Phaser.Scene, L: LevelData) {
    const height = Math.max(900, L.height - L.surfaceY - 120);
    this.water = new PaintedPlane(scene, lagoonKey('water'), L.surfaceY - 20, height, .24, DEPTH.bg);
    // One far shore covers the complete travel range. Never mirror or repeat its individual irregular trees.
    const coastSource = scene.textures.get(lagoonKey('coast')).getSourceImage();
    this.coastWidth = W / CAMERA.min + L.width * .04 + 320;
    const coastScale = this.coastWidth / coastSource.width;
    this.farSea = scene.add.rectangle(0, L.surfaceY - 28, this.coastWidth, 40, 0x5b8790)
      .setOrigin(0).setDepth(DEPTH.decoFront + .705);
    this.coast = scene.add.image(-160, L.surfaceY - 28 - 659 * coastScale, lagoonKey('coast'))
      .setOrigin(0).setScale(coastScale).setAlpha(.55).setDepth(DEPTH.decoFront + .71);
    // Atlas frames keep tree size independent from the width needed to cover the horizon.
    const treeTexture = scene.textures.get(lagoonKey('trees'));
    const sourceScale = treeTexture.getSourceImage().width / 2172;
    const positions = [195, 650, 1535, 1995], ground = [636, 632, 640, 634], scales = [.85, .7, 1.1, .6];
    for (let i = 0; i < positions.length; i++) {
      const frame = 'shore-tree-' + i;
      if (!treeTexture.has(frame)) treeTexture.add(frame, 0, Math.round((positions[i] - 75) * sourceScale),
        Math.round(540 * sourceScale), Math.round(150 * sourceScale), Math.round(92 * sourceScale));
      const image = scene.add.image(0, this.coast.y + ground[i] * coastScale + 2, lagoonKey('trees'), frame)
        .setOrigin(.5, 1).setScale(scales[i]).setAlpha(.55).setDepth(DEPTH.decoFront + .711);
      this.trees.push({ image, fraction: positions[i] / 2172 });
    }

    // A single landmark at the left world edge. Two registered views share one painting; only air/water tint differs.
    const cliffSource = scene.textures.get(lagoonKey('cliff')).getSourceImage();
    const waterRow = 360;
    const cliffScale = 1.1;
    const x = -40, y = L.surfaceY - waterRow * cliffScale;
    this.cliffWater = scene.add.image(x, y, lagoonKey('cliff')).setOrigin(0).setScale(cliffScale).setDepth(DEPTH.decoBack - 6);
    this.cliffAir = scene.add.image(x, y, lagoonKey('cliff')).setOrigin(0).setScale(cliffScale)
      .setCrop(0, 0, cliffSource.width, waterRow + Math.ceil(12 / cliffScale)).setDepth(DEPTH.decoFront + .715);
    this.update({ cloud: 0, rain: 0 });
    scene.events.once('shutdown', this.destroy, this);
  }

  update(weather: Weather) {
    const shade = Math.round(255 - weather.cloud * 35);
    const tint = (shade << 16) | (shade << 8) | shade;
    const v = this.coast.scene.cameras.main.worldView;
    this.water.update(tint);
    this.coast.setX(v.left * .96 - 160).setTint(tint);
    for (const tree of this.trees) tree.image.setX(this.coast.x + tree.fraction * this.coastWidth).setTint(tint);
    this.farSea.setX(v.left - 20).setSize(v.width + 40, 40)
      .setFillStyle((Math.round(shade * .357) << 16) | (Math.round(shade * .529) << 8) | Math.round(shade * .565));
    this.cliffAir.setTint(tint);
    this.cliffWater.setTint((Math.round(shade * .545) << 16) | (Math.round(shade * .722) << 8) | Math.round(shade * .757));
  }

  private destroy() {
    this.water.destroy(); this.coast.destroy(); this.farSea.destroy(); this.cliffAir.destroy(); this.cliffWater.destroy();
    this.trees.forEach(tree => tree.image.destroy()); this.trees = [];
  }
}
