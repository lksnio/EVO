import { adultLengthCm, animalScale, playLengthCm, spriteReferenceSpan, worldLength } from '../data/animalSize';
import { lengthText } from '../data/aquapendium';
import Phaser from 'phaser';
import type { Morph } from '../art/creatureArt';
import type { ClassId } from '../data/classes';
import { SPECIES } from '../data/species';
import { EPOCHS, epochSpecies } from '../data/epochs';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { riverCave, riverRoeTexture } from '../art/riverProps';
import { FaunaView } from '../objects/FaunaView';
import { CreatureView } from '../objects/CreatureView';
import { WORLD_FISH_IDS } from '../art/fish/worldFish';
import { WorldFishView } from '../objects/WorldFishView';
import { text } from '../ui/ui';
import { STARTER_FORMS, validStarterForm } from '../sim/starterFish';

/** Nur für Entwickler (?debug&gallery): viele Ausprägungen der Spielfigur und alle Tierarten. Leertaste blättert. */
export class GalleryScene extends Phaser.Scene {
  private views: CreatureView[] = [];
  private worldViews: WorldFishView[] = [];
  private page = 0;
  private fauna: FaunaView[] = [];

  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor(new URLSearchParams(location.search).has('gallery') && new URLSearchParams(location.search).get('gallery') === 'devon' ? '#1b4048' : '#1a1814');
    this.views = [];
    this.worldViews = [];
    this.fauna = [];
    this.page = Number(new URLSearchParams(location.search).get('page') ?? 0);
    this.show();
    this.input.keyboard!.on('keydown-SPACE', () => {
      const fauna = new URLSearchParams(location.search).get('gallery') === 'fauna';
      const sizes = new URLSearchParams(location.search).get('gallery') === 'sizes';
      const pages = sizes ? Math.ceil(this.sizeIds().length / 6) : fauna ? Math.ceil(this.faunaIds().length / 12) : 1 + Math.ceil(this.ids().length / 18);
      this.page = (this.page + 1) % Math.max(1, pages);
      this.children.removeAll(true);
      this.views = [];
      this.worldViews = [];
      this.fauna = [];
      this.show();
    });
  }

  /** ?gallery=devon zeigt nur die Tiere des Devons (Reihenfolge wie in der Chronik) */
  private ids() {
    const only = new URLSearchParams(location.search).get('gallery');
    return only === 'devon' ? epochSpecies(EPOCHS.find((e) => e.id === 'devon')!).filter((id) => SPECIES[id]) : Object.keys(SPECIES);
  }

  /** Die tatsächlich im Spiel verwendeten 25 Master mit Schwimmen, Biss und Rammhaltung. */
  private starterLab() {
    const q=new URLSearchParams(location.search);
    const forms=q.has('forms') ? q.get('forms')!.split(',').map(Number).filter(validStarterForm) : STARTER_FORMS.map((_,i)=>i);
    const cols=Math.min(forms.length,Number(q.get('cols')??5)),rows=Math.ceil(forms.length/cols);
    const cw=this.scale.width/cols,ch=this.scale.height/rows;
    const zoom=Number(q.get('zoom')??Math.min(cw/135,(ch-24)/65));
    this.cameras.main.setBackgroundColor('#163b44');
    forms.forEach((form,i)=>{
      const m:Morph={cls:'fish',size:1,fishForm:form,jaw:STARTER_FORMS[form][0]/3,skull:STARTER_FORMS[form][2]/3,stealth:0,diet:0,scars:0,belly:1,fierce:0,hue:1,seed:7};
      const x=(i%cols+.5)*cw,y=(Math.floor(i/cols)+.44)*ch;
      const view=new CreatureView(this,x,y,m,zoom);
      view.headTilt=Number(q.get('pitch')??0);view.setFacing(q.has('left')?-1:1);
      this.views.push(view);
      text(this,x,(Math.floor(i/cols)+1)*ch-20,STARTER_FORMS[form].join(' – '),14).setOrigin(.5);
    });
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

  private faunaIds() {
    return new URLSearchParams(location.search).get('ids')?.split(',')
      ?? [...epochSpecies(EPOCHS.find(e => e.id === 'devon')!), 'rhizodus'];
  }

  /** Living fauna, including future rayfins, without unlocking another epoch. */
  private faunaLab() {
    const q = new URLSearchParams(location.search);
    const ids = this.faunaIds();
    const subset = ids.slice(this.page * 12, this.page * 12 + 12);
    this.cameras.main.setBackgroundColor('#24464b');
    subset.forEach((id, i) => {
      const def = SPECIES[id];
      if (!def) return;
      const x = 160 + i % 4 * 320, y = 105 + Math.floor(i / 4) * 230;
      makeSpeciesTextures(this, def);
      const ratio = this.game.canvas.getBoundingClientRect().width / this.scale.width;
      const width = q.has('px') ? Number(q.get('px')) / ratio : 225;
      if (FaunaView.supports(this, def)) {
        const view = new FaunaView(this, def);
        this.add.existing(view); view.setPosition(x, y).setScale(width / view.naturalWidth);
        this.fauna.push(view);
      } else this.add.image(x, y, speciesKey(id, 0)).setDisplaySize(width, width * 0.4);
      text(this, x, y + 82, def.name, 16).setOrigin(0.5);
    });
  }

  /**
   * ?gallery=world: die acht festen Weltfische im Rig (art/fish/worldFish.ts). Parameter: ids (Komma), cols, zoom (Maßstab gegenüber dem alten
   * Bild), compare (darunter das alte Bild), jaw (0 zu, 1 halb, 2 weit auf), speed, bite (alle n s Ausholen und Zuschnappen), mode.
   */
  private worldLab() {
    const q = new URLSearchParams(location.search);
    const ids = (q.get('ids') ?? WORLD_FISH_IDS.join(',')).split(',').filter((id) => SPECIES[id]);
    const cols = Math.min(ids.length, Number(q.get('cols') ?? 4)), zoom = Number(q.get('zoom') ?? 2);
    const rowH = q.has('compare') ? 230 : 150;
    ids.forEach((id, i) => {
      const def = SPECIES[id];
      makeSpeciesTextures(this, def);
      const old = this.textures.get(speciesKey(id, 0)).getSourceImage() as HTMLCanvasElement;
      const x = this.scale.width * ((i % cols) + 0.5) / cols, y = 90 + Math.floor(i / cols) * rowH;
      // px: Breite des Tieres auf dem Bildschirm in Pixeln (Größenvergleich, 1:1 bei Seitenverhältnis 1)
      const px = Number(q.get('px') ?? 0), ratio = this.game.canvas.getBoundingClientRect().width / this.scale.width;
      const k = px ? px / (ratio * old.width) : zoom;
      const v = new WorldFishView(this, def, old.width);
      v.root.setPosition(x, y).setScale(k * (q.has('flip') ? -1 : 1), k);
      this.worldViews.push(v);
      if (!q.has('nolabel')) text(this, x, y + (px ? 36 : 55), def.name, px ? 11 : 13).setOrigin(0.5, 0);
      if (q.has('compare')) this.add.image(x, y + (px ? 70 : 115), speciesKey(id, 0)).setScale(k);
    });
  }

  private riverLab() {
    this.cameras.main.setBackgroundColor('#24464b');
    const ratio = this.game.canvas.getBoundingClientRect().width / this.scale.width;
    for (const [i, width] of [80, 110, 140].entries()) {
      this.add.image(210 + i * 350, 180, riverRoeTexture(this, 5, 5)).setOrigin(0.5, 1).setScale(width / (72 * ratio));
      text(this, 210 + i * 350, 205, `${width} px · 5 Eier`, 16).setOrigin(0.5);
      this.add.image(210 + i * 350, 290, riverRoeTexture(this, i, 5)).setOrigin(0.5, 1).setScale(1.5);
      text(this, 210 + i * 350, 310, `${i} Eier`, 16).setOrigin(0.5);
    }
    const cave = riverCave(this, { x: 300, y: 500, w: 320, h: 150 });
    cave.back.setDepth(-7); cave.front.setDepth(40);
    this.add.rectangle(300, 655, 680, 25, 0x747c69).setDepth(41);
    const m: Morph = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7 };
    for (const [x, y, depth] of [[285, 510, 20], [410, 590, 20], [680, 570, 45]]) {
      const view = new CreatureView(this, x, y, m, 1.1).setDepth(depth);
      this.views.push(view);
    }
    text(this, 840, 460, 'Gemeinsamer Höhlenrahmen\nRückwand → Fisch → Felsrand', 20).setOrigin(0.5);
  }

  private sizeIds() {
    const raw = new URLSearchParams(location.search).get('ids');
    return raw === 'all' ? Object.keys(SPECIES).sort((a, b) => worldLength(SPECIES[a]) - worldLength(SPECIES[b]))
      : (raw ?? 'moythomasia,cheirolepis,cladoselache,hyneria,dunkleosteus,rhizodus').split(',').filter(id => SPECIES[id]);
  }

  /** Shared play scale; scientific lengths stay labelled separately from the compressed display. */
  private sizeLab() {
    const defs = this.sizeIds().slice(this.page * 6, this.page * 6 + 6).map(id => SPECIES[id]);
    this.cameras.main.setBackgroundColor('#173b43');
    const max = Math.max(...defs.map(d => worldLength(d)), 100);
    for (const d of defs) makeSpeciesTextures(this, d);
    const heights = defs.map(d => {
      const f = this.textures.get(speciesKey(d.id, 0)).getSourceImage() as HTMLCanvasElement;
      return f.height * animalScale(d, spriteReferenceSpan(d, f.width));
    });
    let k = Math.min(.72, 900 / max);
    while (heights.reduce((n, h) => n + Math.max(74, h * k + 32), 100) > 705) k *= .92;
    text(this, 35, 20, 'Körpergrößen · gestauchter Spielmaßstab', 22);
    text(this, 35, 51, 'Kleine Tiere vergrößert · gemeinsame Spielansicht · Leertaste blättert', 14);
    const ruler = this.add.graphics();
    ruler.lineStyle(1, 0x91b5b5, .5).lineBetween(300, 87, 300 + max * k, 87);
    for (let pixels = 0; pixels <= max; pixels += 200) {
      const x = 300 + pixels * k; ruler.lineBetween(x, 82, x, 92);
      text(this, x, 66, `${pixels} px`, 11).setOrigin(.5, 0);
    }
    let y = 105;
    defs.forEach((def, i) => {
      const h = Math.max(74, heights[i] * k + 32), span = worldLength(def);
      const x = 300 + span * k / 2, cy = y + h / 2;
      text(this, 35, cy - 15, def.name, 17);
      const reference = adultLengthCm(def), chosen = playLengthCm(def);
      text(this, 35, cy + 6, `Referenz: ${lengthText(reference)}`, 13);
      if (chosen !== reference) text(this, 35, cy + 23, `Spielauswahl: ${lengthText(chosen)}`, 11);
      if (FaunaView.supports(this, def)) {
        const view = new FaunaView(this, def);
        this.add.existing(view); view.setPosition(x, cy).setScale(span * k / view.referenceSpan); this.fauna.push(view);
      } else {
        const img = this.add.image(x, cy, speciesKey(def.id, 0));
        img.setScale(animalScale(def, spriteReferenceSpan(def, img.width)) * k);
      }
      ruler.lineStyle(1, 0xc5d6bf, .3).lineBetween(300, cy + h / 2 - 7, 300 + span * k, cy + h / 2 - 7);
      y += h;
    });
  }

  private show() {
    if (new URLSearchParams(location.search).get('gallery') === 'starter') return this.starterLab();
    if (new URLSearchParams(location.search).get('gallery') === 'sizes') return this.sizeLab();
    if (new URLSearchParams(location.search).get('gallery') === 'river') return this.riverLab();
    if (new URLSearchParams(location.search).get('gallery') === 'world') return this.worldLab();
    if (new URLSearchParams(location.search).get('gallery') === 'fauna') return this.faunaLab();
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
    const hold = Number(q.get('hold') ?? 0);
    for (const view of this.fauna) view.advance(dms / 1000, mode === 'idle' ? 0 : speed, hold || (bite ? Math.max(0, Math.sin(this.biteClock / bite * Math.PI * 2)) : 0));
    if (this.worldViews.length) {
      const jawL = (q.get('jaw') ?? '0').split(',').map(Number) as (0 | 1 | 2)[], cyc = bite ? this.biteClock : 0;
      // Ausholen (0,18 s) und Zuschnappen (0,3 s) nach jedem Ablauf des Taktes
      this.worldViews.forEach((v, i) => v.animate(dms / 1000, mode === 'idle' ? 0 : speed, bite ? (cyc < 0.18 ? 1 : cyc < 0.5 ? 2 : 0) : jawL[i % jawL.length]));
    }
    for (const v of this.views) {
      v.holdOpen = hold;
      if (q.has('lift')) v.setLift(Number(q.get('lift')));
      v.animate(dms / 1000, v.L.land ? 'walk' : mode, speed);
    }
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
