import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { EpochDef } from '../data/epochs';
import type { PlaceDef } from '../data/world';
import type { LevelData } from '../level/LevelGen';
import { groundAt } from '../level/terrain';
import { lagoonKey, lagoonEnabled } from '../art/lagoonAssets';
import { newCanvas } from '../util/canvas';
import { clamp } from '../util/math';
import { lean } from '../sim/swell';
import { stormSwell, sunlight, type Weather } from '../sim/weather';

interface Frond {
  view: Phaser.GameObjects.Rope | Phaser.GameObjects.Image;
  x: number;
  y: number;
  scale: number;
  phase: number;
}

/** Mirrors instances of the same texture, without a second panorama-sized GPU texture. */
class PaintedPlane {
  private images: Phaser.GameObjects.Image[] = [];
  private width: number;

  constructor(private scene: Phaser.Scene, private key: string, private y: number, private height: number, private factor: number, private depth: number) {
    const src = scene.textures.get(key).getSourceImage();
    this.width = height * src.width / src.height;
  }

  update(tint = 0xffffff) {
    const v = this.scene.cameras.main.worldView;
    const offset = v.left * (1 - this.factor);
    const first = Math.floor((v.left - offset - 40) / this.width);
    const count = Math.ceil((v.width + 80) / this.width) + 1;
    while (this.images.length < count) {
      this.images.push(this.scene.add.image(0, this.y, this.key).setOrigin(0).setDisplaySize(this.width, this.height).setDepth(this.depth));
    }
    this.images.forEach((image, i) => {
      const index = first + i;
      image.setVisible(i < count && v.bottom > this.y && v.top < this.y + this.height);
      if (i < count) image.setPosition(offset + index * this.width, this.y).setFlipX(Math.abs(index % 2) === 1).setTint(tint);
    });
  }

  destroy() { this.images.forEach(image => image.destroy()); this.images = []; }
}

function rayTexture(scene: Phaser.Scene) {
  const key = 'lagoon_light';
  if (scene.textures.exists(key)) return key;
  const [canvas, ctx] = newCanvas(96, 384);
  const across = ctx.createLinearGradient(0, 0, 96, 0);
  across.addColorStop(0, 'rgba(244,239,187,0)');
  across.addColorStop(.5, 'rgba(244,239,187,.65)');
  across.addColorStop(1, 'rgba(244,239,187,0)');
  ctx.fillStyle = across; ctx.fillRect(0, 0, 96, 384);
  ctx.globalCompositeOperation = 'destination-in';
  const down = ctx.createLinearGradient(0, 0, 0, 384);
  down.addColorStop(0, 'rgba(0,0,0,0)');
  down.addColorStop(.12, 'rgba(0,0,0,1)');
  down.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = down; ctx.fillRect(0, 0, 96, 384);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/**
 * A painted Devonian nursery with independently moving light, living crinoids and a distant early forest.
 * All scenery is visual: the swimming corridor, cave, eggs and collision geometry stay in LevelData.
 */
export class NurseryBackdrop {
  private water: PaintedPlane;
  private coast: PaintedPlane;
  private fronds: Frond[] = [];
  private rays: Phaser.GameObjects.Image[] = [];

  static create(scene: Phaser.Scene, ep: EpochDef, place: PlaceDef, L: LevelData) {
    if (!lagoonEnabled(scene, ep, place)) return undefined;
    return new NurseryBackdrop(scene, L);
  }

  private constructor(private scene: Phaser.Scene, private L: LevelData) {
    const height = Math.max(900, L.height - L.surfaceY - 120);
    this.water = new PaintedPlane(scene, lagoonKey('water'), L.surfaceY - 20, height, .24, DEPTH.bg);
    // Above the sky-filled wave band, below its transparent foreground crest (WaterSurface).
    this.coast = new PaintedPlane(scene, lagoonKey('coast'), L.surfaceY - 230, 230, .1, DEPTH.decoFront + .71);
    const key = rayTexture(scene);
    for (let i = 0; i < 6; i++) {
      this.rays.push(scene.add.image(0, L.surfaceY - 24, key).setOrigin(.5, 0).setDepth(DEPTH.bg + 2.3).setBlendMode(Phaser.BlendModes.ADD));
    }
    const src = scene.textures.get(lagoonKey('crinoids')).getSourceImage();
    const caveEnd = L.cave ? L.cave.x + L.cave.w : 0;
    for (let i = 0; i < 16; i++) {
      const x = caveEnd + 140 + i * (L.width - caveEnd - 260) / 16;
      const y = groundAt(L.terrain.hp, x) + 8;
      const scale = (135 + (i * 43 % 110)) / src.height;
      let view: Frond['view'];
      if (scene.game.renderer.type === Phaser.WEBGL) {
        const points = Array.from({ length: 17 }, (_, j) => new Phaser.Math.Vector2(0, (j / 16 - 1) * src.height));
        view = scene.add.rope(x, y, lagoonKey('crinoids'), undefined, points, false).setScale(scale);
      } else view = scene.add.image(x, y, lagoonKey('crinoids')).setOrigin(.5, 1).setScale(scale);
      view.setDepth(DEPTH.decoBack + 1).setAlpha(i % 3 === 0 ? .55 : .85);
      if (i % 2) view.setFlipX(true);
      this.fronds.push({ view, x, y, scale, phase: i * 2.37 });
    }
    scene.events.once('shutdown', this.destroy, this);
  }

  update(time: number, weather: Weather) {
    const t = time / 1000, v = this.scene.cameras.main.worldView;
    const light = sunlight(weather), storm = stormSwell(weather);
    const shade = Math.round(255 - weather.cloud * 35);
    const tint = (shade << 16) | (shade << 8) | shade;
    this.water.update(tint); this.coast.update(tint);
    this.rays.forEach((ray, i) => {
      const phase = i * 2.17;
      const x = v.left + ((i * 347 - v.left * .2) % 2100 + 2100) % 2100 - 170;
      ray.setPosition(x, this.L.surfaceY - 24).setDisplaySize(85 + i % 3 * 28, 760 + i % 2 * 170);
      ray.setAngle(-19 + Math.sin(t * .13 + phase) * 2.5);
      ray.setAlpha(light * (.055 + .025 * Math.sin(t * .42 + phase)));
      ray.setVisible(v.top < this.L.surfaceY + 950);
    });
    for (const f of this.fronds) {
      const visible = f.x > v.left - 220 && f.x < v.right + 220 && f.y > v.top && f.y < v.bottom + 260;
      f.view.setVisible(visible);
      if (!visible) continue;
      const sway = lean(f.x, f.y - 100, this.L.surfaceY, t, storm) * .7 + Math.sin(t * .65 + f.phase) * 2;
      if (f.view instanceof Phaser.GameObjects.Rope) {
        const height = f.view.frame.height;
        f.view.points.forEach((p, i) => {
          const bend = (1 - i / 16) ** 2;
          p.x = (sway * 1.3 + Math.sin(t * .9 + i * .18 + f.phase) * 2) * bend / f.scale;
          p.y = (i / 16 - 1) * height;
        });
        f.view.setDirty();
      } else f.view.setAngle(clamp(sway, -6, 6));
    }
  }

  private destroy() {
    this.water.destroy(); this.coast.destroy();
    this.fronds.forEach(f => f.view.destroy()); this.fronds = [];
    this.rays.forEach(ray => ray.destroy()); this.rays = [];
  }
}
