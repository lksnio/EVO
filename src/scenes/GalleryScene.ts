import Phaser from 'phaser';
import type { Morph } from '../art/creatureArt';
import type { ClassId } from '../data/classes';
import { SPECIES } from '../data/species';
import { EPOCHS, epochSpecies } from '../data/epochs';
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
    this.cameras.main.setBackgroundColor(new URLSearchParams(location.search).has('gallery') && new URLSearchParams(location.search).get('gallery') === 'devon' ? '#1b4048' : '#1a1814');
    this.views = [];
    this.show();
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.page = (this.page + 1) % (1 + Math.ceil(this.ids().length / 18));
      this.children.removeAll(true);
      this.views = [];
      this.show();
    });
  }

  /** ?gallery=devon zeigt nur die Tiere des Devons (Reihenfolge wie in der Chronik) */
  private ids() {
    const only = new URLSearchParams(location.search).get('gallery');
    return only === 'devon' ? epochSpecies(EPOCHS.find((e) => e.id === 'devon')!).filter((id) => SPECIES[id]) : Object.keys(SPECIES);
  }

  /** ?gallery=fish: die Fisch-Werkstatt – wenige Fische groß, jede Taste 1–5 stellt eine Bewegung ein (siehe art/fish/rig.ts) */
  private lab() {
    const q = new URLSearchParams(location.search);
    const extra = q.get('morph') ? (JSON.parse(q.get('morph')!) as Partial<Morph>) : {};
    const zoom = Number(q.get('zoom') ?? 3.2);
    const base: Morph = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7, ...extra };
    let set: [string, Partial<Morph>][] = JSON.parse(q.get('set') ?? '[["neu",{}]]');
    // n: so viele Fische (die Liste wird wiederholt, jeder mit eigenem Saatwert) – für Leistungsmessungen
    const n = Number(q.get('n') ?? 0);
    if (n) set = Array.from({ length: n }, (_, i) => [`${set[i % set.length][0]}`, { ...set[i % set.length][1], seed: i }] as [string, Partial<Morph>]);
    set.forEach(([name, v], i) => {
      const view = new CreatureView(this, 0, 0, { ...base, ...v }, zoom);
      const cols = Math.min(set.length, Number(q.get('cols') ?? 3));
      // px: Das Tier soll auf dem Bildschirm so viele Pixel breit sein (Größenvergleich), unabhängig von seiner Größe
      const px = Number(q.get('px') ?? 0);
      if (px && view.fishAnatomy) {
        const ratio = this.game.canvas.getBoundingClientRect().width / this.scale.width;
        const A = view.fishAnatomy!, b = A.bounds;
        view.setBaseScale(px / (ratio * (b.x1 - b.x0) * A.s));
      }
      view.setPosition(this.scale.width * ((i % cols) + 0.5) / cols, (px ? 70 : 140) + Math.floor(i / cols) * (px ? 120 : 230));
      this.views.push(view);
      text(this, view.x, view.y + (px ? 40 : 95), name, 14).setOrigin(0.5, 0);
    });
  }

  private show() {
    if (new URLSearchParams(location.search).get('gallery') === 'fish') return this.lab();
    if (this.page >= 1) {
      const ids = this.ids().slice((this.page - 1) * 18, this.page * 18);
      ids.forEach((id, i) => {
        const def = SPECIES[id];
        makeSpeciesTextures(this, def);
        const col = i % 6, row = Math.floor(i / 6);
        const img = this.add.image(110 + col * 212, 110 + row * 230, speciesKey(id, 0));
        const s = Math.min(1.6, 196 / img.width, 170 / img.height);
        img.setScale(s);
        // daneben ein zweites Mal so groß, wie das Tier im Spiel zu sehen ist (Kamera 0,72)
        this.add.image(110 + col * 212 + 80, 110 + row * 230 + 70, speciesKey(id, 0)).setScale(0.72).setAlpha(0.95);
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
    const q = new URLSearchParams(location.search);
    const mode = (q.get('mode') ?? 'swim') as 'swim' | 'idle' | 'crawl';
    const speed = Number(q.get('speed') ?? 0.5);
    const bite = q.get('bite') ? Number(q.get('bite')) : 0;
    this.biteClock += dms / 1000;
    if (bite && this.biteClock > bite) {
      this.biteClock = 0;
      for (const v of this.views) v.bite();
    }
    for (const v of this.views) v.animate(dms / 1000, v.L.land ? 'walk' : mode, speed);
    // ?perf: Bildrate und Zeit je Bild, damit man die Leistung auf der eigenen Grafikkarte prüfen kann
    if (q.has('perf')) {
      this.perfT += dms;
      this.perfText ??= text(this, 10, 6, '', 14).setScrollFactor(0).setDepth(100);
      if (this.perfT > 500) {
        this.perfT = 0;
        const l = this.game.loop;
        this.perfText.setText(`${this.views.length} Fische · ${l.actualFps.toFixed(0)} B/s · ${(1000 / Math.max(1, l.actualFps)).toFixed(1)} ms/Bild · ${this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'}`);
      }
    }
  }

  private biteClock = 0;
  private perfText?: Phaser.GameObjects.Text;
  private perfT = 0;
}
