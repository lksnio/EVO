import Phaser from 'phaser';
import { W, H } from '../config';
import { audio } from '../audio/Audio';
import { bus, game, type BuyResult } from '../state/GameState';
import { CLASSES, CLASS_ORDER, classIndex, type ClassId, type Stats } from '../data/classes';
import { PARTS, PART_ORDER, categoryName, optionName, type PartId } from '../data/parts';
import { ERAS } from '../data/eras';
import { PALETTES } from '../art/palettes';
import type { Appearance } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, panel, soundButton, text, title } from '../ui/ui';
import { clamp } from '../util/math';

type Cat = 'klasse' | PartId;
const CATS: Cat[] = ['klasse', ...PART_ORDER];

const STAT_ROWS: { k: keyof Stats; name: string; max: number }[] = [
  { k: 'hp', name: 'Lebenspunkte', max: 320 },
  { k: 'bite', name: 'Biss', max: 64 },
  { k: 'horn', name: 'Horn', max: 40 },
  { k: 'def', name: 'Abwehr', max: 32 },
  { k: 'speed', name: 'Tempo', max: 420 },
  { k: 'jump', name: 'Sprungkraft', max: 800 },
];

interface Row {
  c: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
}

export class EvolutionScene extends Phaser.Scene {
  private from = 'Map';
  private inLevel = false;
  private prevMusic: string | null = null;
  private cat = 1;
  private opt = 0;
  private creature!: CreatureView;
  private catButtons: Button[] = [];
  private rows: Row[] = [];
  private rowLayer!: Phaser.GameObjects.Container;
  private statG!: Phaser.GameObjects.Graphics;
  private statTexts: Phaser.GameObjects.Text[] = [];
  private evoText!: Phaser.GameObjects.Text;
  private clsTitle!: Phaser.GameObjects.Text;
  private clsSub!: Phaser.GameObjects.Text;
  private desc!: Phaser.GameObjects.Text;
  private buyBtn!: Button;
  private helix!: Phaser.GameObjects.Graphics;
  private t = 0;
  private previewKey = '';

  constructor() {
    super('Evolution');
  }

  init(d: { from?: string; inLevel?: boolean }) {
    this.from = d.from ?? 'Map';
    this.inLevel = !!d.inLevel;
    this.catButtons = [];
    this.rows = [];
    this.statTexts = [];
    this.previewKey = '';
  }

  create() {
    this.prevMusic = audio.current;
    audio.music('evolution');
    this.cameras.main.fadeIn(200, 5, 12, 22);
    this.add.image(0, 0, 'title_bg').setOrigin(0).setTint(0x8a7ab8);
    this.add.rectangle(0, 0, W, H, 0x0a0618, 0.55).setOrigin(0);
    this.helix = this.add.graphics();
    title(this, 34, 18, 'Evolution', 44, '#e0c8ff');
    text(this, 270, 40, 'Verändere deinen Körper mit EVO-Punkten', 19, '#d8ccf0');
    panel(this, W - 330, 18, 220, 54, 0.75, 0x1a1036, 27);
    this.add.image(W - 300, 45, 'evo_gem').setScale(0.85);
    this.evoText = title(this, W - 274, 45, `${game.evo}`, 28, '#bff6ff').setOrigin(0, 0.5);
    soundButton(this, W - 50, 45, 54);

    // Vorschau
    panel(this, 30, 92, 560, 384, 0.6, 0x1a1036);
    this.add.image(310, 420, 'pedestal').setScale(1.9, 1.5);
    const glow = this.add.image(310, 300, 'glow').setScale(4.2).setTint(0x9a7aff).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.45, yoyo: true, repeat: -1, duration: 1600 });
    this.creature = new CreatureView(this, 310, 300, game.appearance(), 2.4);
    this.clsTitle = title(this, 54, 104, '', 30, '#ffffff');
    this.clsSub = text(this, 56, 142, '', 18, '#cfc0f0');

    // Werte
    panel(this, 30, 488, 560, 214, 0.6, 0x1a1036);
    this.statG = this.add.graphics();
    STAT_ROWS.forEach((r, i) => {
      text(this, 52, 504 + i * 32, r.name, 19, '#e8e0ff');
      this.statTexts.push(text(this, 572, 504 + i * 32, '', 19, '#ffffff', { fontStyle: '700' }).setOrigin(1, 0));
    });

    // Kategorien
    CATS.forEach((_c, i) => {
      const b = new Button(this, 708, 122 + i * 62, '', { w: 196, h: 52, size: 21, color: 0x5a3a9a, onClick: () => this.selectCat(i) });
      this.catButtons.push(b);
    });
    new Button(this, 708, 668, 'Zurück', { w: 196, h: 52, size: 21, icon: 'ic_back', color: 0x3a6ea8, sound: 'back', onClick: () => this.close() });

    // Optionen
    panel(this, 822, 92, 428, 476, 0.6, 0x1a1036);
    this.rowLayer = this.add.container(0, 0);
    this.desc = text(this, 840, 580, '', 18, '#e8e0ff', { wordWrap: { width: 400 } });
    this.buyBtn = new Button(this, 1036, 668, 'Entwickeln', { w: 420, h: 60, size: 24, icon: 'ic_dna', color: 0x2fa86a, sound: null, onClick: () => this.buy() });

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => this.moveOpt(-1));
    kb.on('keydown-DOWN', () => this.moveOpt(1));
    kb.on('keydown-W', () => this.moveOpt(-1));
    kb.on('keydown-S', () => this.moveOpt(1));
    kb.on('keydown-LEFT', () => this.selectCat(this.cat - 1));
    kb.on('keydown-RIGHT', () => this.selectCat(this.cat + 1));
    kb.on('keydown-A', () => this.selectCat(this.cat - 1));
    kb.on('keydown-D', () => this.selectCat(this.cat + 1));
    kb.on('keydown-ENTER', () => this.buy());
    kb.on('keydown-SPACE', () => this.buy());
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-E', () => this.close());

    // Zum Start: Klasse zeigen, wenn eine neue Entwicklung möglich ist
    const next = game.nextClass();
    const canClass = !this.inLevel && next && game.classUnlocked(next);
    this.selectCat(canClass ? 0 : 1, false);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.t += dt;
    this.creature.animate(dt, this.creature.L.land ? 'idle' : 'swim', 0.3);
    // DNA-Helix im Hintergrund
    const g = this.helix;
    g.clear();
    for (let i = 0; i < 40; i++) {
      const x = i * 34 - 10;
      const a = this.t * 1.2 + i * 0.35;
      const y1 = 380 + Math.sin(a) * 60, y2 = 380 + Math.sin(a + Math.PI) * 60;
      const z = (Math.cos(a) + 1) / 2;
      g.lineStyle(2, 0xb090ff, 0.08);
      g.lineBetween(x, y1, x, y2);
      g.fillStyle(0xc0a0ff, 0.08 + z * 0.12);
      g.fillCircle(x, y1, 4 + z * 3);
      g.fillStyle(0x80e0ff, 0.08 + (1 - z) * 0.12);
      g.fillCircle(x, y2, 4 + (1 - z) * 3);
    }
  }

  // ----------------------------------------------------------------------

  private catLabel(c: Cat) {
    return c === 'klasse' ? 'Klasse' : categoryName(c, game.data.cls);
  }

  private options(c: Cat): number {
    return c === 'klasse' ? CLASS_ORDER.length : PARTS[c].options.length;
  }

  private currentIndex(c: Cat) {
    return c === 'klasse' ? classIndex(game.data.cls) : game.data.parts[c];
  }

  private selectCat(i: number, sound = true) {
    i = clamp(i, 0, CATS.length - 1);
    if (sound && i !== this.cat) audio.sfx('click');
    this.cat = i;
    this.catButtons.forEach((b, k) => {
      b.setLabel(this.catLabel(CATS[k]));
      b.setColor(k === i ? 0x9a5ae0 : 0x4a3480);
      b.setFocus(k === i);
    });
    this.opt = this.currentIndex(CATS[i]);
    this.buildRows();
    this.refresh();
  }

  private moveOpt(d: number) {
    const n = this.options(CATS[this.cat]);
    const o = clamp(this.opt + d, 0, n - 1);
    if (o !== this.opt) {
      audio.sfx('click');
      this.opt = o;
      this.refresh();
    }
  }

  private buildRows() {
    this.rowLayer.removeAll(true);
    this.rows = [];
    const c = CATS[this.cat];
    const n = this.options(c);
    const rh = n > 6 ? 56 : 72;
    for (let i = 0; i < n; i++) {
      const y = 104 + i * rh;
      const row = this.add.container(836, y);
      const bg = this.add.graphics();
      row.add(bg);
      row.setSize(400, rh - 6);
      row.setInteractive(new Phaser.Geom.Rectangle(0, 0, 400, rh - 6), Phaser.Geom.Rectangle.Contains);
      if (row.input) row.input.cursor = 'pointer';
      row.on('pointerdown', () => {
        if (this.opt === i) this.buy();
        else {
          audio.sfx('click');
          this.opt = i;
          this.refresh();
        }
      });
      this.rowLayer.add(row);
      this.rows.push({ c: row, bg });
    }
  }

  /** Aussehen, Klasse und Werte, wenn die markierte Option gewählt würde. */
  private preview(): { a: Appearance; s: Stats; cls: ClassId } {
    const c = CATS[this.cat];
    let cls = game.data.cls;
    const parts = { ...game.data.parts };
    if (c === 'klasse') {
      cls = CLASS_ORDER[this.opt];
      if (cls !== 'fish' && game.data.cls === 'fish') parts.beine = 0;
    } else parts[c] = this.opt;
    const s = game.stats(cls, parts);
    return { a: game.appearance(cls, parts), s, cls };
  }

  /** Status einer Option: Text, Farbe, kaufbar? */
  private status(c: Cat, i: number): { txt: string; col: string; ok: boolean; reason?: string } {
    if (c === 'klasse') {
      const cls = CLASS_ORDER[i];
      const cur = classIndex(game.data.cls);
      if (i === cur) return { txt: 'Aktuell', col: '#8aff9a', ok: false };
      if (i < cur) return { txt: 'Hinter dir', col: '#9a90b8', ok: false, reason: 'Diese Stufe hast du schon hinter dir.' };
      if (i > cur + 1) return { txt: 'Später', col: '#9a90b8', ok: false, reason: 'Entwickle dich Schritt für Schritt.' };
      if (this.inLevel) return { txt: `${CLASSES[cls].cost} EVO`, col: '#9a90b8', ok: false, reason: 'Die Klasse kannst du nur auf der Weltkarte wechseln.' };
      if (!game.classUnlocked(cls)) {
        const era = ERAS.find((e) => e.id === CLASSES[cls].requiresEra);
        return { txt: 'Gesperrt', col: '#ff9a8a', ok: false, reason: `Besiege zuerst den Endgegner von „${era?.name}“.` };
      }
      const cost = CLASSES[cls].cost;
      return { txt: `${cost} EVO`, col: game.evo >= cost ? '#ffffff' : '#ff8a7a', ok: game.evo >= cost, reason: game.evo >= cost ? undefined : 'Nicht genug EVO-Punkte.' };
    }
    const o = PARTS[c].options[i];
    if (game.data.parts[c] === i) return { txt: 'Aktuell', col: '#8aff9a', ok: false };
    if (!game.optionAllowed(c, i)) {
      const need = PARTS[c].landOnly && game.data.cls === 'fish' ? CLASSES.amphibian.name : CLASSES[o.minClass].name;
      return { txt: `ab ${need}`, col: '#9a90b8', ok: false, reason: `Erst als ${need} möglich.` };
    }
    if (game.isOwned(c, i)) return { txt: 'Gratis', col: '#8affff', ok: true };
    return { txt: `${o.cost} EVO`, col: game.evo >= o.cost ? '#ffffff' : '#ff8a7a', ok: game.evo >= o.cost, reason: game.evo >= o.cost ? undefined : 'Nicht genug EVO-Punkte.' };
  }

  private refresh() {
    const c = CATS[this.cat];
    const n = this.options(c);
    const rh = n > 6 ? 56 : 72;
    // Zeilen
    this.rows.forEach((r, i) => {
      r.c.list.filter((o) => o !== r.bg).forEach((o) => o.destroy());
      const st = this.status(c, i);
      const sel = i === this.opt;
      const g = r.bg;
      g.clear();
      g.fillStyle(sel ? 0x7a4ad0 : 0x2a1c50, sel ? 0.95 : 0.7);
      g.fillRoundedRect(0, 0, 400, rh - 6, 12);
      if (sel) {
        g.lineStyle(3, 0xffe680, 1);
        g.strokeRoundedRect(0, 0, 400, rh - 6, 12);
      }
      const name = c === 'klasse' ? CLASSES[CLASS_ORDER[i]].name : optionName(c, i, game.data.cls);
      let nx = 16;
      if (c === 'farbe') {
        const p = PALETTES[i];
        const sw = this.add.graphics();
        sw.fillStyle(p.base, 1);
        sw.fillCircle(30, (rh - 6) / 2, 15);
        sw.fillStyle(p.belly, 1);
        sw.fillCircle(30, (rh - 6) / 2 + 5, 7);
        sw.lineStyle(2, p.dark, 1);
        sw.strokeCircle(30, (rh - 6) / 2, 15);
        r.c.add(sw);
        nx = 56;
      }
      r.c.add(title(this, nx, (rh - 6) / 2, name, rh > 60 ? 23 : 20, st.ok || st.txt === 'Aktuell' ? '#ffffff' : '#c8bce0').setOrigin(0, 0.5));
      r.c.add(text(this, 386, (rh - 6) / 2, st.txt, 18, st.col, { fontStyle: '700' }).setOrigin(1, 0.5));
      if (st.txt.startsWith('ab ') || st.txt === 'Gesperrt' || st.txt === 'Später') {
        r.c.add(this.add.image(386 - (st.txt.length * 9 + 22), (rh - 6) / 2, 'ic_lock').setScale(0.4).setTint(0x9a90b8));
      }
    });

    // Vorschau
    const pv = this.preview();
    const key = JSON.stringify(pv.a);
    if (key !== this.previewKey) {
      this.previewKey = key;
      this.creature.build(pv.a);
      this.fitCreature();
    }
    const changed = c === 'klasse' ? pv.cls !== game.data.cls : this.opt !== game.data.parts[c];
    this.clsTitle.setText(CLASSES[pv.cls].name + (changed ? '  (Vorschau)' : ''));
    this.clsSub.setText(`Stufe ${classIndex(pv.cls) + 1} von ${CLASS_ORDER.length} · ${CLASSES[pv.cls].habitat === 'water' ? 'lebt im Wasser' : 'lebt an Land'}`);

    // Werte
    const cur = game.stats();
    const g = this.statG;
    g.clear();
    STAT_ROWS.forEach((r, i) => {
      const y = 508 + i * 32;
      const x = 196, w = 260;
      const a = cur[r.k], b = pv.s[r.k];
      g.fillStyle(0x000000, 0.45);
      g.fillRoundedRect(x, y + 2, w, 16, 7);
      const fa = clamp(a / r.max, 0, 1) * w, fb = clamp(b / r.max, 0, 1) * w;
      if (b > a) {
        g.fillStyle(0x4ae08a, 1);
        g.fillRoundedRect(x, y + 2, Math.max(fb, 6), 16, 7);
      }
      g.fillStyle(0x9a7aff, 1);
      if (fa > 0) g.fillRoundedRect(x, y + 2, Math.max(Math.min(fa, b < a ? fb : fa), 6), 16, 7);
      if (b < a) {
        g.fillStyle(0xe04a4a, 1);
        g.fillRect(x + fb, y + 2, fa - fb, 16);
      }
      const isJump = r.k === 'jump' && pv.cls === 'fish';
      const diff = b - a;
      this.statTexts[i].setText(isJump ? '–' : diff ? `${b} (${diff > 0 ? '+' : ''}${diff})` : `${b}`);
      this.statTexts[i].setColor(diff > 0 ? '#7affa8' : diff < 0 ? '#ff8a8a' : '#ffffff');
    });

    // Beschreibung & Knopf
    const st = this.status(c, this.opt);
    let d = '';
    if (c === 'klasse') d = CLASSES[CLASS_ORDER[this.opt]].desc;
    else d = PARTS[c].options[this.opt].desc;
    if (st.reason) d += `\n${st.reason}`;
    this.desc.setText(d);
    if (st.txt === 'Aktuell') {
      this.buyBtn.setLabel('Das hast du schon');
      this.buyBtn.setDisabled(true);
    } else {
      const cost = c === 'klasse' ? CLASSES[CLASS_ORDER[this.opt]].cost : game.costOf(c, this.opt);
      this.buyBtn.setLabel(cost ? `Entwickeln (${cost} EVO)` : 'Auswählen (gratis)');
      this.buyBtn.setDisabled(!st.ok);
    }
    this.evoText.setText(`${game.evo}`);
  }

  private fitCreature() {
    const v = this.creature;
    const L = v.L;
    const len = (L.sh.bw + L.hg.L + 46) * L.s;
    const sc = clamp(400 / len, 1.6, 3.4);
    v.setBaseScale(sc);
    v.setPosition(300, L.land ? 422 - L.footY * sc : 300);
  }

  private buy() {
    const c = CATS[this.cat];
    const st = this.status(c, this.opt);
    if (st.txt === 'Aktuell') return;
    if (!st.ok) {
      audio.sfx('fail');
      this.tweens.add({ targets: this.desc, x: { from: 846, to: 840 }, duration: 60, yoyo: true, repeat: 2 });
      if (st.reason === 'Nicht genug EVO-Punkte.') this.tweens.add({ targets: this.evoText, scale: { from: 1.3, to: 1 }, duration: 300 });
      return;
    }
    let res: BuyResult;
    let label: string;
    if (c === 'klasse') {
      const cls = CLASS_ORDER[this.opt];
      res = game.buyClass(cls);
      label = `Du bist jetzt: ${CLASSES[cls].name}!`;
    } else {
      res = game.buyPart(c, this.opt);
      label = `${optionName(c, this.opt, game.data.cls)}!`;
    }
    if (res !== 'ok') {
      audio.sfx('fail');
      return;
    }
    audio.sfx('evolve');
    this.cameras.main.flash(350, 220, 200, 255);
    const fx = this.add.particles(this.creature.x, this.creature.y, 'p_spark', {
      speed: { min: 80, max: 320 }, lifespan: 900, scale: { start: 1, end: 0 }, tint: [0xffffff, 0xd0a0ff, 0x8affff, 0xffe680], emitting: false,
    });
    fx.explode(40);
    this.time.delayedCall(1200, () => fx.destroy());
    const t = title(this, 310, 180, label, 34, '#ffe680').setOrigin(0.5);
    this.tweens.add({ targets: t, y: 150, alpha: { from: 1, to: 0 }, delay: 900, duration: 600, onComplete: () => t.destroy() });
    this.previewKey = '';
    this.selectCat(this.cat, false);
    this.tweens.add({ targets: this.creature, scaleY: { from: this.creature.scaleY * 1.2, to: this.creature.scaleY }, duration: 400, ease: 'Back.out' });
  }

  private close() {
    audio.sfx('back');
    audio.music(this.prevMusic);
    bus.emit('evo', game.evo);
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
