import { CURSOR } from './cursor';
import Phaser from 'phaser';
import { COLLECTION_FOSSILS, COLLECTION_SHELLS } from '../data/collection';
import { collectionFossilTexture, collectionShellTexture, collectionStarTexture, starPoint } from '../art/collectionArt';
import type { CollectionState } from '../sim/collection';

/** Der Sammlungsstern in der Übersicht; gefundene Platten und Muscheln sprechen für sich. */
export function collectionStar(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, c: CollectionState, x: number, y: number, radius: number,
  inspect?: (kind: 'shell' | 'fossil', index: number) => void) {
  const star = scene.add.container(x, y).setName('collection-star');
  parent.add(star);
  star.add(scene.add.image(0, 0, collectionStarTexture(scene)).setDisplaySize(radius * 2.22, radius * 2.22));
  for (let i = 0; i < 7; i++) {
    const f = COLLECTION_FOSSILS[i], s = COLLECTION_SHELLS[i];
    const fp = starPoint(i, radius * .8), sp = starPoint(i, radius * .48, true);
    const fossil = scene.add.image(fp.x, fp.y, collectionFossilTexture(scene,i,c.fossils.includes(f.id)))
      .setDisplaySize(radius * .37, radius * .37).setName(`collection-fossil-${f.id}`);
    const shell = scene.add.image(sp.x, sp.y, collectionShellTexture(scene,i,c.shells.includes(s.id)))
      .setDisplaySize(radius * .19, radius * .19).setName(`collection-shell-${s.id}`);
    star.add([fossil,shell]);
    if (inspect) for (const [img,kind] of [[fossil,'fossil'],[shell,'shell']] as const) {
      img.setInteractive({cursor: CURSOR.pointer});
      img.on('pointerover',()=>inspect(kind,i)).on('pointerdown',()=>inspect(kind,i));
    }
  }
  return star;
}
