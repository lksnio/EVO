import type Phaser from 'phaser';
import type { RockSpec } from '../level/terrain';
import { newCanvas } from '../util/canvas';

const FILES = {
  roof: new URL('../assets/reef/roof.webp', import.meta.url).href,
  support_low: new URL('../assets/reef/support_low.webp', import.meta.url).href,
  support_tall: new URL('../assets/reef/support_tall.webp', import.meta.url).href,
  stones: new URL('../assets/reef/stones.webp', import.meta.url).href,
  kelp: new URL('../assets/reef/kelp.webp', import.meta.url).href,
  coral: new URL('../assets/reef/coral.webp', import.meta.url).href,
  frame: new URL('../assets/reef/frame.webp', import.meta.url).href,
  sediment: new URL('../assets/reef/sediment.webp', import.meta.url).href,
};
export type ReefPart = keyof typeof FILES;
export const reefKey = (part: ReefPart) => 'reef_' + part;
export function preloadReef(scene: Phaser.Scene) {
  for (const [part, file] of Object.entries(FILES)) scene.load.image('reef_' + part, file);
}
export function paintedReef(scene: Phaser.Scene) {
  return !new URLSearchParams(globalThis.location?.search ?? '').has('oldreef') && scene.textures.exists(reefKey('roof'));
}

const materials = new WeakMap<object, HTMLCanvasElement>();
/** Mirrored repeat meets at identical edge pixels, even if a generated tile is only approximately seamless. CPU bake only. */
export function reefMaterial(scene: Phaser.Scene) {
  const src = scene.textures.get(reefKey('sediment')).getSourceImage() as HTMLImageElement;
  const hit = materials.get(src);
  if (hit) return hit;
  const [cv, ctx] = newCanvas(src.width * 2, src.height * 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    ctx.save(); ctx.translate(x ? src.width * 2 : 0, y ? src.height * 2 : 0);
    ctx.scale(x ? -1 : 1, y ? -1 : 1); ctx.drawImage(src, 0, 0); ctx.restore();
  }
  materials.set(src, cv);
  return cv;
}

/** Visual registration only. The existing solid slices and swim-through gap stay authoritative. */
export function reefRock(scene: Phaser.Scene, rock: RockSpec) {
  const roof = rock.form === 'slab';
  const part = roof ? 'roof' : rock.ry > rock.rx * 0.8 ? 'support_tall' : 'support_low';
  const img = scene.add.image(rock.x, rock.y + (roof ? 0 : rock.ry + 4), reefKey(part))
    .setName(roof ? 'reef-shelter-roof' : 'reef-sandstone').setOrigin(0.5, roof ? 0.5 : 1);
  // Small overhangs cover the rounded collision corners; never paint across the passage below the roof.
  img.setDisplaySize(rock.rx * 2 + 12, rock.ry * 2 + (roof ? 0 : 8));
  if (!roof && rock.seed % 2) img.setFlipX(true);
  return img;
}
