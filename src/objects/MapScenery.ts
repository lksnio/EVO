import type Phaser from 'phaser';
import { groundCurve } from '../level/terrain';
import type { LevelData } from '../level/LevelGen';
import { MAP_LAYERS, objectY, type MapLayer, type MapObject } from '../editor/document';
import { inkTexture } from '../art/inkFilter';
const DEPTH: Record<MapLayer, number> = { far: -16, back: -10, world: .7, front: 44, frame: 45 };
export const LAYER_NAMES: Record<MapLayer, string> = { far: 'Ferne', back: 'Hintergrund', world: 'Spielebene', front: 'Vordergrund am Boden', frame: 'Nahe Kulisse' };
export class MapScenery {
  readonly images = new Map<string, Phaser.GameObjects.Image>();
  private cleanup = () => this.destroy();
  constructor(private scene: Phaser.Scene, readonly level: LevelData, readonly objects: MapObject[], ink: boolean) {
    for (const o of objects) {
      if (!scene.textures.exists(o.asset)) continue;
      const key = ink && o.asset.startsWith('d2_') ? inkTexture(scene, o.asset, { bands: 4, water: .12 }) : o.asset;
      const img = scene.add.image(o.x, objectY(o, level), key).setName('map-' + o.id).setOrigin(.5, 1)
        .setDisplaySize(o.width, o.height).setAngle(o.angle).setFlipX(o.flipX).setAlpha(o.alpha).setDepth(DEPTH[o.layer]);
      if (o.layer === 'far') img.setTint(0x648f91);
      if (o.layer === 'frame') img.setTint(0x38515c);
      this.images.set(o.id, img);
    }
    scene.events.once('shutdown', this.cleanup);
  }
  update(player?: { x: number; y: number }, edit = false, hidden: Set<MapLayer> = new Set()) {
    const cam = this.scene.cameras.main, v = cam.worldView;
    for (const o of this.objects) {
      const img = this.images.get(o.id); if (!img) continue;
      let x = o.x, y = objectY(o, this.level);
      if (!edit && o.layer === 'far') { x += (x - cam.midPoint.x) * -.35; y += (y - cam.midPoint.y) * -.15; }
      if (!edit && o.layer === 'frame') {
        x += (x - cam.midPoint.x) * .14;
        // A separate near-camera frame grows out of the bottom edge. Its roots never hover over the playable ground.
        y = Math.max(y, v.bottom + o.height * .16);
      }
      const angle = !edit && o.sway && !o.solid ? o.angle + Math.sin(this.scene.time.now * .0007 + o.x * .031) * o.sway : o.angle;
      img.setPosition(x, y).setAngle(angle).setFlipX(o.flipX).setDisplaySize(o.width, o.height);
      const visible = !hidden.has(o.layer) && x + o.width > v.x - 80 && x - o.width < v.right + 80 && y > v.y - 80 && y - o.height * 1.5 < v.bottom + 80;
      img.setVisible(visible);
      img.setAlpha(o.alpha * (!edit && player && (o.layer === 'front' || o.layer === 'frame') && Math.abs(player.x - x) < o.width * .4 + 30 && player.y > y - o.height && player.y < y ? .4 : 1));
    }
  }
  destroy() { this.scene.events.off('shutdown', this.cleanup); for (const img of this.images.values()) img.destroy(); this.images.clear(); }
}
export { MAP_LAYERS, groundCurve };
