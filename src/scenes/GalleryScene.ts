import Phaser from 'phaser';
import type { Morph } from '../art/creatureArt';
import type { ClassId } from '../data/classes';
import { SPECIES } from '../data/species';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { CreatureView } from '../objects/CreatureView';
import { text } from '../ui/ui';

/** Nur für Entwickler (?debug&gallery): viele Ausprägungen der Spielfigur und alle Tierarten. Leertaste blättert. */
export class GalleryScene extends Phaser.Scene {
  private views: CreatureView[] = [];
  private page = 0;

  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1814');
    this.views = [];
    this.show();
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.page = (this.page + 1) % (1 + Math.ceil(Object.keys(SPECIES).length / 18));
      this.children.removeAll(true);
      this.views = [];
      this.show();
    });
  }

  private show() {
    if (this.page >= 1) {
      const ids = Object.keys(SPECIES).slice((this.page - 1) * 18, this.page * 18);
      ids.forEach((id, i) => {
        const def = SPECIES[id];
        makeSpeciesTextures(this, def);
        const col = i % 6, row = Math.floor(i / 6);
        const img = this.add.image(110 + col * 212, 110 + row * 230, speciesKey(id, 0));
        const s = Math.min(1.6, 196 / img.width, 170 / img.height);
        img.setScale(s);
        text(this, 110 + col * 212, 210 + row * 230, `${def.name} (${def.role})`, 14).setOrigin(0.5);
      });
      return;
    }
    const classes: ClassId[] = ['fish', 'amphibian', 'reptile', 'mammal'];
    const variants: [string, Partial<Morph>][] = [
      ['neu', {}],
      ['Kiefer', { jaw: 0.6, diet: 0.6 }],
      ['Kiefer++', { jaw: 1, diet: 1, size: 1.25, scars: 3, fierce: 1 }],
      ['Schädel', { skull: 0.6 }],
      ['Schädel++', { skull: 1, size: 1.2, scars: 2 }],
      ['Tarnung', { stealth: 0.6, diet: -0.6, size: 0.8 }],
      ['Tarnung++', { stealth: 1, diet: -1, size: 0.7, belly: 0 }],
    ];
    classes.forEach((cls, r) => {
      variants.forEach(([name, v], i) => {
        const m: Morph = { cls, size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: r, seed: 7, ...v };
        const view = new CreatureView(this, 95 + i * 180, 0, m, 1.05);
        view.setY(view.L.land ? 150 + r * 172 - view.L.footY * 1.05 + 30 : 130 + r * 172);
        this.views.push(view);
        if (r === 0) text(this, 95 + i * 180, 14, name, 14).setOrigin(0.5, 0);
      });
    });
  }

  update(_t: number, dms: number) {
    for (const v of this.views) v.animate(dms / 1000, v.L.land ? 'walk' : 'swim', 0.5);
  }
}
