import type Phaser from 'phaser';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { skyAbove } from '../level/waterBounds';
import { newCanvas } from '../util/canvas';
import { DEPTH } from '../config';

const FILES = {
  sky: new URL('../assets/water/sky.webp', import.meta.url).href,
  waterline: new URL('../assets/water/waterline.webp', import.meta.url).href,
};
export function preloadWaterSurface(scene: Phaser.Scene) {
  for (const [id, url] of Object.entries(FILES)) if (!scene.textures.exists('surface_' + id)) scene.load.image('surface_' + id, url);
}

/** Mirror once at load time so both joins are continuous, even when crossing a long painting's boundary. */
function panorama(scene: Phaser.Scene, id: keyof typeof FILES) {
  const key = 'surface_loop_' + id;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get('surface_' + id).getSourceImage() as HTMLImageElement;
  const [canvas, ctx] = newCanvas(source.width * 2, source.height, true);
  ctx.drawImage(source, 0, 0); ctx.translate(source.width * 2, 0); ctx.scale(-1, 1); ctx.drawImage(source, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Five static quads, two scrolling wave UVs. No per-frame canvases, geometry, particles or texture allocations. */
export class WaterSurface {
  private sky: Phaser.GameObjects.TileSprite;
  private air: Phaser.GameObjects.Rectangle;
  private seam: Phaser.GameObjects.Rectangle;
  private waves: Phaser.GameObjects.TileSprite[];
  private shown = true;
  private objects: (Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle)[];

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (skyAbove(ep, place, L) === undefined || !scene.textures.exists('surface_sky')) return undefined;
    return new WaterSurface(scene, L.surfaceY);
  }
  private constructor(private scene: Phaser.Scene, readonly y: number) {
    this.air = scene.add.rectangle(0, y - 2400, 6000, 2400, 0xb6c9c3).setOrigin(0).setDepth(DEPTH.decoFront + .4);
    this.sky = scene.add.tileSprite(0, y - 640, 6000, 650, panorama(scene, 'sky')).setOrigin(0).setDepth(DEPTH.decoFront + .5).setTileScale(2, 1);
    this.seam = scene.add.rectangle(0, y + 2, 6000, 5, 0x153e42).setOrigin(0).setDepth(DEPTH.decoFront + .6);
    const key = panorama(scene, 'waterline');
    this.waves = [
      scene.add.tileSprite(0, y - 16, 6000, 66, key).setOrigin(0).setDepth(DEPTH.decoFront + .7).setTileScale(2, .5),
      scene.add.tileSprite(0, y - 12, 6000, 58, key).setOrigin(0).setDepth(DEPTH.decoFront + .8).setTileScale(1.43, .4).setAlpha(.28).setTint(0xc1e5dc),
    ];
    this.objects = [this.air, this.sky, this.seam, ...this.waves];
    scene.events.once('shutdown', this.destroy, this);
    this.update(0);
  }
  update(time: number) {
    const cam = this.scene.cameras.main, view = cam.worldView;
    const visible = view.top < this.y + 100 && view.bottom > this.y - 2400;
    if (visible !== this.shown) { this.shown = visible; for (const o of this.objects) o.setVisible(visible); }
    if (!visible) return;
    const x = view.left - 100, width = view.width + 200;
    this.air.setPosition(x, this.y - 2400).setSize(width, 2400);
    this.sky.setPosition(x, this.y - 640).setSize(width, 650);
    this.sky.tilePositionX = x * .08;
    this.seam.setPosition(x, this.y + 2).setSize(width, 5);
    const seconds = time / 1000;
    this.waves.forEach((wave, i) => {
      wave.setPosition(x, this.y - (i ? 12 : 16) + Math.sin(seconds * (i ? .43 : .67) + i * 2) * (i ? 1.3 : 1.8)).setSize(width, i ? 58 : 66);
      // Anchor to world x: camera motion must not make the water slide with the player.
      wave.tilePositionX = x + seconds * (i ? -2.1 : 3.4) + i * 1783;
    });
  }
  destroy() {
    this.scene.events.off('shutdown', this.destroy, this);
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
