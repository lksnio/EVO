import Phaser from 'phaser';
import type { Appearance } from '../art/creatureArt';
import type { ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { enemyKey } from '../art/enemyArt';
import { CreatureView } from '../objects/CreatureView';
import { text } from '../ui/ui';

/** Nur für Entwickler (?debug&gallery): zeigt viele Körper-Kombinationen und alle Gegner. */
export class GalleryScene extends Phaser.Scene {
  private views: CreatureView[] = [];
  private page = 0;

  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor('#2a4a6a');
    this.views = [];
    this.show();
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.page = (this.page + 1) % 2;
      this.children.removeAll(true);
      this.views = [];
      this.show();
    });
  }

  private show() {
    if (this.page === 1) {
      const ids = Object.keys(ENEMIES);
      ids.forEach((id, i) => {
        const col = i % 7, row = Math.floor(i / 7);
        const big = ENEMIES[id].boss;
        const img = this.add.image(90 + col * 180, 90 + row * 170, enemyKey(id, 0));
        if (big) img.setScale(Math.min(160 / img.width, 140 / img.height));
        text(this, 90 + col * 180, 165 + row * 170, id, 14).setOrigin(0.5);
      });
      return;
    }
    const classes: ClassId[] = ['fish', 'amphibian', 'reptile', 'mammal'];
    classes.forEach((cls, r) => {
      for (let i = 0; i < 6; i++) {
        const a: Appearance = { cls, kiefer: i, horn: i, koerper: Math.min(4, i), haut: i, schwanz: Math.min(4, i), beine: cls === 'fish' ? 0 : Math.min(4, i), farbe: (i + r) % 8 };
        const v = new CreatureView(this, 110 + i * 210, 0, a, 1.2);
        v.setY(v.L.land ? 150 + r * 175 - v.L.footY * 1.2 + 40 : 140 + r * 175);
        this.views.push(v);
      }
    });
  }

  update(_t: number, dms: number) {
    for (const v of this.views) v.animate(dms / 1000, v.L.land ? 'walk' : 'swim', 0.5);
  }
}
