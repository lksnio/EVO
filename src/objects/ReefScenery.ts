import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { LevelData } from '../level/LevelGen';
import { groundCurve } from '../level/terrain';
import { hashStr, mulberry32 } from '../util/math';
import { reefKey, type ReefPart } from '../art/reefProps';

type Near = { img: Phaser.GameObjects.Image; x: number; y: number; f: number; height: number; phase: number };

/** Shared painted modules: quieter middle distance, full colour on the floor, dark near-camera framing. */
export class ReefScenery {
  private near: Near[] = [];
  private middle: { img: Phaser.GameObjects.Image; phase: number; sway: number }[] = [];
  private images: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, level: LevelData, place: string) {
    const r = mulberry32(hashStr('reef/' + place));
    const floor = (x: number) => groundCurve(level.terrain.hp, x);
    const blocked = (x: number, margin: number) => {
      const c = level.cave, d = level.chasm;
      return (c && x > c.x - margin && x < c.x + c.w + margin)
        || (d && x > d.x0 - margin && x < d.x1 + margin)
        || level.crevices.some(c => x > c.x - margin && x < c.x + c.w + margin);
    };
    const make = (part: ReefPart, x: number, y: number, h: number, depth: number) => {
      const img = scene.add.image(x, y, reefKey(part)).setOrigin(0.5, 1).setDepth(depth).setName('reef-' + part);
      img.setScale(h / img.height).setFlipX(r() < 0.5);
      this.images.push(img);
      return img;
    };
    // Loosely grouped, with deliberate gaps. Never put a new vignette inside a playable cave or narrow shelter.
    for (let x = 180; x < level.width - 120; x += 240 + r() * 240) {
      if (blocked(x, 135) || floor(x) > level.height - 60) continue;
      const part = r() < 0.48 ? 'kelp' : 'coral';
      const h = part === 'kelp' ? 155 + r() * 110 : 75 + r() * 42;
      const img = make(part, x, floor(x) + 9, h, DEPTH.decoBack + 0.3);
      this.middle.push({ img, phase: r() * 6, sway: part === 'kelp' ? 1.3 : 0 });
      if (r() < 0.6) make('stones', x + 80 + r() * 35, floor(x + 80) + 5, 26 + r() * 16, DEPTH.terrain + 0.7);
      // Same painted language in the distance, mixed into the water rather than black cutouts.
      if (r() < 0.55) {
        const back = make('kelp', x + 135, floor(x + 135) + 4, 230 + r() * 90, DEPTH.decoBack - 5);
        back.setTint(0x47777b).setAlpha(0.3);
      }
    }
    // Sparse foreground cadence leaves most of the swimming space open; these plants share the ground's movement.
    for (let x = 320; x < level.width - 150; x += 850 + r() * 600) {
      if (blocked(x, 210) || floor(x) > level.height - 60) continue;
      const h = 260 + r() * 125;
      const img = make(r() < 0.5 ? 'frame' : 'kelp', x, floor(x) + 65, h, DEPTH.decoFront + 2);
      img.setTint(0x38515c).setAlpha(0.96);
      this.near.push({ img, x, y: floor(x) + 65, f: 1, height: h, phase: r() * 6 });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  update(time: number, dt: number, player: { x: number; y: number }) {
    const cam = this.scene.cameras.main, v = cam.worldView;
    for (const img of this.images) img.setVisible(img.x + img.displayWidth / 2 > v.x - 80 && img.x - img.displayWidth / 2 < v.right + 80
      && img.y > v.y - 80 && img.y - img.displayHeight < v.bottom + 80);
    for (const { img, phase, sway } of this.middle) {
      if (img.visible && sway) img.setAngle(Math.sin(time * 0.0006 + phase) * sway);
    }
    for (const n of this.near) {
      const { img } = n;
      // These plants root in the playable ground, so their feet must share its camera movement.
      img.setPosition(n.x, n.y);
      const hw = img.displayWidth / 2;
      const visible = img.x + hw > v.x - 80 && img.x - hw < v.right + 80 && img.y > v.y && img.y - n.height < v.bottom;
      img.setVisible(visible);
      if (!visible) continue;
      img.setAngle(Math.sin(time * 0.00045 + n.phase) * 1.1);
      // If the player swims behind a tall frond, keep its silhouette readable through the nearest layer.
      const close = Math.abs(player.x - img.x) < hw * 0.8 + 45 && player.y > img.y - n.height && player.y < img.y + 20;
      img.alpha += ((close ? 0.38 : 0.96) - img.alpha) * Math.min(1, dt * 5);
    }
  }

  destroy() {
    for (const img of this.images) img.destroy();
    this.images = []; this.near = []; this.middle = [];
  }
}
