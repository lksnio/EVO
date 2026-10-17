import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, type Offspring } from '../state/GameState';
import { CLASSES } from '../data/classes';
import { EPOCHS, spanWords, yearsAgo } from '../data/epochs';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import type { SurvivedData } from './LevelScene';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';
import { mulberry32 } from '../util/math';

type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Sätze zwischen den Zeitaltern – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Generationen vergehen. Das Leben passt sich an.',
  'Nur wer überlebt, gibt etwas weiter.',
  'Langsam, kaum merklich, verändert sich deine Art.',
];

/** Farben der Karten im Auswahlbildschirm, je Lebensraum. */
const CARD_PAL: Record<string, { top: string; mid: string; bot: string; floor: string; floor2: string; hill: string; hill2: string; weed: string }> = {
  ozean: { top: '#3d7f7a', mid: '#163f45', bot: '#091c20', floor: '#5e5642', floor2: '#26221a', hill: '#000', hill2: '#000', weed: 'rgba(40,90,60,0.7)' },
  sumpf: { top: '#66643e', mid: '#2e2e1c', bot: '#14140c', floor: '#3e3622', floor2: '#1a160c', hill: 'rgba(30,34,20,0.75)', hill2: 'rgba(22,24,14,0.9)', weed: 'rgba(70,84,40,0.85)' },
  reptil: { top: '#86603a', mid: '#3e2a1a', bot: '#1a120c', floor: '#4e3a26', floor2: '#20160e', hill: 'rgba(52,34,22,0.75)', hill2: 'rgba(36,24,16,0.9)', weed: 'rgba(84,90,44,0.8)' },
  eden: { top: '#677a4e', mid: '#2c3822', bot: '#121810', floor: '#444226', floor2: '#1c1c10', hill: 'rgba(34,46,28,0.75)', hill2: 'rgba(24,32,20,0.9)', weed: 'rgba(96,110,52,0.85)' },
  eis: { top: '#93a9b2', mid: '#4b606a', bot: '#1e2a30', floor: '#cfd8db', floor2: '#76868c', hill: 'rgba(120,140,150,0.6)', hill2: 'rgba(90,108,118,0.8)', weed: 'rgba(120,120,96,0.7)' },
};

/**
 * Ein Zeitalter ist überstanden. Man sieht sein Tier "einst" und "heute", dazu die
 * Artgenossen, die mit überlebt haben. Dann vergehen Jahrmillionen – und manchmal nehmen
 * die Nachfahren eine neue Form an (Fisch → Lurch → …).
 */
export class GenerationScene extends Phaser.Scene {
  private d!: SurvivedData;
  private views: { v: CreatureView; mode: 'swim' | 'idle' }[] = [];
  private group: GO[] = [];
  private nav?: MenuNav;
  /** gewählter Nachwuchs (Index in d.offspring) */
  private sel = 0;
  private cards: {
    g: Phaser.GameObjects.Graphics;
    glow: Phaser.GameObjects.Image;
    beam: Phaser.GameObjects.Image;
    v: CreatureView;
    sc: number;
    x: number;
    y: number;
    w: number;
    h: number;
    hover: boolean;
  }[] = [];
  private choosing = false;
  private zones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super('Generation');
  }

  init(d: SurvivedData) {
    this.d = d;
    this.views = [];
    this.group = [];
    this.nav = undefined;
    this.sel = 0;
    this.cards = [];
    this.choosing = false;
    this.zones = [];
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    const ep = EPOCHS[this.d.epoch];
    const [far] = levelBackgrounds(this, ep.theme, 'normal');
    this.add.image(0, 0, far).setOrigin(0).setTint(0x8a8a8a);
    this.add.rectangle(0, 0, W, H, 0x050403, 0.55).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 6000, frequency: 160,
      speedY: { min: -12, max: -3 }, speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: 0xd8c8a0,
    });
    if (this.d.offspring?.length) this.choose();
    else this.survived();
  }

  update(_t: number, dms: number) {
    for (const { v, mode } of this.views) v.animate(dms / 1000, mode, mode === 'swim' ? 0.35 : 0);
  }

  private look(o: { cls?: Morph['cls']; traits?: SurvivedData['traits']; seed?: number; sex?: number } = {}): Morph {
    const d = this.d;
    return game.morph({ cls: o.cls ?? d.cls, traits: o.traits ?? d.traits, hue: d.look.hue, seed: o.seed ?? d.look.seed, sex: o.sex ?? d.look.sex, fierce: 0 });
  }

  // ---------------------------------------------------------------- Nachwuchs wählen

  /**
   * Wer soll die Linie weiterführen? Man sieht nur die Tiere selbst – keine Werte. Alle stehen im
   * selben Maßstab, damit man Größe, Körperbau und Färbung direkt vergleichen kann.
   */
  private choose() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const offs = d.offspring!;
    this.choosing = true;
    const where = ep.habitat === 'water' ? 'die Meere' : 'das Land';
    const [h1, h2] = d.bossBeaten
      ? [`${d.boss} ist besiegt.`, `Ein letztes Mal im ${ep.name}: Wer führt deine Linie in eine neue Zeit?`]
      : d.repeat
        ? [`Eine Generation vergeht.`, `${d.boss ?? 'Der Herrscher'} beherrscht noch ${where}. Wer führt deine Linie weiter?`]
        : [`Das ${ep.name} endet.`, `Du hast überlebt. Wer führt deine Linie weiter?`];
    const head = title(this, W / 2, 38, h1, 38).setOrigin(0.5);
    const sub = text(this, W / 2, 82, h2, 20, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);
    this.group.push(head, sub);

    const n = offs.length;
    const gap = 16;
    const cw = Math.min(226, Math.floor((W - 56 - (n - 1) * gap) / n)), ch = 410;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y0 = 118;
    const bg = this.cardTex(ep, cw, ch);
    // erst alle Tiere bauen, dann einen gemeinsamen Maßstab finden
    const views = offs.map((o) => new CreatureView(this, 0, 0, this.look({ traits: o.traits, seed: o.seed, sex: o.sex }), 1));
    // L.halfW ist nur der Rumpf – mit Kopf und Schwanz ist ein Tier gut viermal so lang
    const SPAN: Record<string, number> = { fish: 3.9, amphibian: 4.4, reptile: 4.6, mammal: 3.6 };
    const maxW = Math.max(...views.map((v) => v.L.halfW * (SPAN[v.m.cls] ?? 4.4)));
    const maxH = Math.max(...views.map((v) => v.L.footY - v.L.topY));
    const sc = Math.min(2.6, (cw - 30) / maxW, (ch * 0.42) / maxH);
    offs.forEach((o, i) => {
      const parts = this.card(o, views[i], sc, bg, x0 + i * (cw + gap), y0, cw, ch, i);
      this.fadeInAll(parts.filter((p) => !(p instanceof Phaser.GameObjects.Image && p.texture.key === 'glow')), 250 + i * 140, 1, 650);
      this.group.push(...parts);
    });
    this.select(0, true);
    const hint = text(this, W / 2, y0 + ch + 20, '← →  oder Klick  ·  Enter bestätigt', 15, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([hint], 1100, 0.8);
    const tl = this.timeline(d.epoch, 606);
    this.fadeInAll(tl, 1000, 1, 700);
    this.group.push(hint, ...tl);
    const kb = this.input.keyboard!;
    const mv = (dx: number) => () => this.choosing && this.select((this.sel + dx + n) % n);
    kb.on('keydown-LEFT', mv(-1));
    kb.on('keydown-RIGHT', mv(1));
    kb.on('keydown-A', mv(-1));
    kb.on('keydown-D', mv(1));
    kb.on('keydown-ENTER', () => this.choosing && this.confirm());
    kb.on('keydown-SPACE', () => this.choosing && this.confirm());
    this.time.delayedCall(1200, () => {
      const b = new Button(this, W / 2, H - 34, 'Weiter', { w: 240, h: 48, icon: 'ic_play', color: UI.ochreN, onClick: () => this.choosing && this.confirm() });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
    });
  }

  /** Eine Karte: ein kleines Stück Lebensraum mit dem Tier darin – sonst nichts. */
  private card(o: Offspring, v: CreatureView, sc: number, bg: string, x: number, y: number, w: number, h: number, i: number): GO[] {
    const glow = this.add.image(x + w / 2, y + h / 2, 'glow').setDisplaySize(w * 1.9, h * 1.5).setTint(0xe0a848).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const img = this.add.image(x, y, bg).setOrigin(0);
    const land = v.L.land;
    const floorY = y + h * (land ? 0.72 : 0.78);
    const cx = x + w / 2;
    const foot = land
      ? this.add.image(cx, floorY + 10, 'shadow').setDisplaySize(v.L.halfW * 2 * sc * 0.9, 16).setAlpha(0.55)
      : this.add.image(cx, floorY + 2, 'shadow').setDisplaySize(v.L.halfW * 2 * sc * 0.75, 12).setAlpha(0.35);
    v.setPosition(cx, land ? floorY + 8 - v.L.footY * sc : y + h * 0.44);
    v.setBaseScale(sc);
    this.views.push({ v, mode: land ? 'idle' : 'swim' });
    // Licht von oben auf das gewählte Tier
    const beam = this.add.image(cx, v.y + ((v.L.topY + v.L.footY) / 2) * sc, 'glow').setDisplaySize(w * 0.9, h * 0.9).setTint(0xffe8c0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.children.bringToTop(v);
    const frame = this.add.graphics();
    const out: GO[] = [glow, img, foot, beam, v, frame];
    this.cards.push({ g: frame, glow, beam, v, sc, x, y, w, h, hover: false });
    if (o.main) {
      const mark = text(this, cx, y + h - 30, 'Hauptlinie', 15, UI.ochre, { fontStyle: 'italic' }).setOrigin(0.5);
      out.push(mark);
    }
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (!this.choosing) return;
      if (this.sel === i) this.confirm();
      else this.select(i);
    });
    zone.on('pointerover', () => {
      this.cards[i].hover = true;
      this.select(this.sel, true);
    });
    zone.on('pointerout', () => {
      this.cards[i].hover = false;
      this.select(this.sel, true);
    });
    this.zones.push(zone);
    return out;
  }

  /** Hintergrund einer Karte: Wasser mit Lichtstrahlen und Grund bzw. Himmel, Hügel und Boden. */
  private cardTex(ep: (typeof EPOCHS)[number], w: number, h: number) {
    const key = `gcard_${ep.theme}_${ep.habitat}_${w}x${h}`;
    if (this.textures.exists(key)) return key;
    const P = CARD_PAL[ep.theme] ?? CARD_PAL.ozean;
    const water = ep.habitat === 'water';
    const ct = this.textures.createCanvas(key, w, h)!;
    const ctx = ct.getContext();
    const rnd = mulberry32(w * 7 + h + ep.theme.length * 31);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.top);
    g.addColorStop(0.55, P.mid);
    g.addColorStop(1, P.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const fy = h * (water ? 0.78 : 0.72);
    if (!water) {
      // ferne Hügel im Dunst
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        const base = fy - 40 + k * 22;
        for (let xx = 0; xx <= w; xx += 8) ctx.lineTo(xx, base - Math.sin(xx * 0.02 + k * 2 + rnd()) * 14 - Math.sin(xx * 0.055 + k) * 6);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = k ? P.hill2 : P.hill;
        ctx.fill();
      }
    }
    // Licht von oben
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const x = w * (0.12 + 0.26 * k) + (rnd() - 0.5) * 20;
      const sw = 10 + rnd() * 22;
      const lg = ctx.createLinearGradient(0, 0, 0, fy);
      lg.addColorStop(0, `rgba(255,238,205,${water ? 0.15 : 0.08})`);
      lg.addColorStop(1, 'rgba(255,238,205,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x - sw / 2, 0);
      ctx.lineTo(x + sw / 2, 0);
      ctx.lineTo(x + sw * 1.6 - w * 0.16, fy);
      ctx.lineTo(x - sw * 1.2 - w * 0.16, fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Boden
    ctx.beginPath();
    ctx.moveTo(0, fy + 8);
    ctx.bezierCurveTo(w * 0.3, fy - 8, w * 0.65, fy + 6, w, fy - 4);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, fy - 8, 0, h);
    fg.addColorStop(0, P.floor);
    fg.addColorStop(1, P.floor2);
    ctx.fillStyle = fg;
    ctx.fill();
    for (let k = 0; k < 26; k++) {
      const px = rnd() * w, py = fy + 6 + rnd() * (h - fy - 6);
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,210'},${0.08 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(px, py, 1.5 + rnd() * 4, 1 + rnd() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Halme bzw. Tang am Rand
    ctx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const px = k < 5 ? rnd() * w * 0.22 : w - rnd() * w * 0.22;
      const len = 14 + rnd() * (water ? 46 : 26);
      ctx.strokeStyle = P.weed;
      ctx.lineWidth = 1.5 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(px, fy + 6);
      ctx.quadraticCurveTo(px + (rnd() - 0.5) * 16, fy - len * 0.5, px + (rnd() - 0.5) * 12, fy - len);
      ctx.stroke();
    }
    // weicher Lichtfleck in der Mitte, dunkle Ränder
    const rg = ctx.createRadialGradient(w / 2, h * 0.5, 4, w / 2, h * 0.5, w * 0.6);
    rg.addColorStop(0, 'rgba(255,236,200,0.12)');
    rg.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ct.refresh();
    return key;
  }

  private select(i: number, quiet = false) {
    const changed = this.sel !== i;
    this.sel = i;
    this.cards.forEach((c, k) => {
      const on = k === i;
      c.g.clear();
      c.g.lineStyle(on ? 3 : c.hover ? 2 : 1.5, on ? 0xe0a848 : c.hover ? 0xb08a58 : 0x5a4a34, on ? 1 : 0.7);
      c.g.strokeRoundedRect(c.x, c.y, c.w, c.h, 14);
      if (!on) {
        c.g.fillStyle(0x050403, c.hover ? 0.05 : 0.12);
        c.g.fillRoundedRect(c.x, c.y, c.w, c.h, 14);
      }
      c.v.setShade(on || c.hover ? null : 0xcacaca);
      this.tweens.killTweensOf([c.glow, c.beam]);
      this.tweens.add({ targets: c.glow, alpha: on ? 0.22 : 0, duration: 260 });
      this.tweens.add({ targets: c.beam, alpha: on ? 0.16 : 0, duration: 260 });
      const s = { k: c.v.scaleY / c.sc };
      this.tweens.add({ targets: s, k: on ? 1.07 : 1, duration: 260, ease: 'Sine.out', onUpdate: () => c.v.setBaseScale(c.sc * s.k) });
    });
    if (changed && !quiet) audio.sfx('click');
  }

  /** Die Wahl steht: Dieses Tier führt die Linie weiter. */
  private confirm() {
    const d = this.d;
    const o = d.offspring![this.sel];
    this.choosing = false;
    audio.sfx('select');
    this.zones.forEach((z) => z.destroy());
    this.zones = [];
    game.chooseOffspring(o);
    d.drifted = o.traits;
    d.look = { ...d.look, seed: o.seed, sex: o.sex };
    const c = this.cards[this.sel];
    this.tweens.add({ targets: c.glow, alpha: 0.5, duration: 200, yoyo: true });
    this.time.delayedCall(350, () => this.next());
  }

  /** Ein Tier auf einem Felssockel (an Land) bzw. schwebend mit Schatten (im Wasser). */
  private creature(m: Morph, x: number, groundY: number, scale: number): [CreatureView, Phaser.GameObjects.Image] {
    const land = m.cls !== 'fish';
    const base = land
      ? this.add.image(x, groundY + 6, 'pedestal').setScale(scale * 0.62, 0.8)
      : this.add.image(x, groundY - 10, 'shadow').setScale(scale * 1.1, 1).setAlpha(0.5);
    const v = new CreatureView(this, x, 0, m, scale);
    v.setY(land ? groundY - v.L.footY * scale : groundY - 70);
    this.views.push({ v, mode: land ? 'idle' : 'swim' });
    return [v, base];
  }

  private fadeInAll(targets: GO[], delay: number, to = 1, ms = 900) {
    for (const o of targets) {
      const a = o instanceof Phaser.GameObjects.Image && o.texture.key === 'shadow' ? 0.5 * to : to;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: ms, delay });
    }
  }

  // ---------------------------------------------------------------- Überlebt

  private survived() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const head = title(this, W / 2, 70, `Das ${ep.name} endet.`, 42).setOrigin(0.5);
    const sub = text(this, W / 2, 120, `Du hast überlebt – ${yearsAgo(d.years ?? ep.to, 1e4)}.`, 21, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);

    const mBefore = this.look({ traits: d.before });
    const mNow = this.look();
    const changed = morphKey(mBefore) !== morphKey(mNow);
    const gy = 430, scale = 2;
    const [left, lb] = this.creature(mBefore, W * 0.27, gy, scale);
    // deine Artgenossen stehen hinter dir
    const kinViews: GO[] = [];
    d.kinLooks.forEach((m, i) => {
      const x = W * 0.73 + (i % 2 ? 1 : -1) * (90 + Math.floor(i / 2) * 60);
      const kv = new CreatureView(this, x, 0, { ...m, fierce: 0 }, 1.15);
      kv.setY(kv.L.land ? gy - 30 - kv.L.footY * 1.15 : gy - 110 + i * 24);
      kv.setFacing(i % 2 ? -1 : 1);
      this.views.push({ v: kv, mode: kv.L.land ? 'idle' : 'swim' });
      kinViews.push(kv);
    });
    const [right, rb] = this.creature(mNow, W * 0.73, gy, scale);
    const lt = text(this, W * 0.27, gy + 42, 'Einst', 22, UI.boneDim).setOrigin(0.5);
    const rt = text(this, W * 0.73, gy + 42, 'Heute', 22, UI.bone).setOrigin(0.5);
    const arrow = title(this, W / 2, gy - 60, '›', 64, UI.ochre).setOrigin(0.5);
    this.fadeInAll([left, lb, lt], 600, 0.75);
    this.fadeInAll(kinViews, 1300, 0.55);
    this.fadeInAll([right, rb, rt], 1500);
    this.fadeInAll([arrow], 1200, 0.8, 600);
    this.tweens.add({ targets: arrow, x: W / 2 + 10, yoyo: true, repeat: -1, duration: 900, delay: 1800, ease: 'Sine.inOut' });

    const k = d.kinAlive;
    const kinLine = k === 0 ? 'Von deiner Art hat niemand außer dir überlebt.' : k === 1 ? 'Einer deiner Art hat mit dir überlebt.' : `${k} deiner Art haben mit dir überlebt.`;
    const line = changed ? LINES[(d.epoch * 3 + k) % LINES.length] : 'Das Leben geht weiter.';
    const l1 = text(this, W / 2, 520, kinLine, 21, UI.bone).setOrigin(0.5);
    const l2 = text(this, W / 2, 552, line, 21, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5);
    this.fadeInAll([l1], 2100);
    this.fadeInAll([l2], 2500);
    if (changed) this.time.delayedCall(1500, () => audio.sfx('evolve'));
    const tl = this.timeline(d.epoch, 600);
    this.fadeInAll(tl, 2200, 1, 700);
    this.group.push(head, sub, left, lb, lt, right, rb, rt, arrow, l1, l2, ...kinViews, ...tl);

    this.time.delayedCall(2400, () => {
      const b = new Button(this, W / 2, H - 36, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => this.next() });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
      this.nav = new MenuNav(this, [b]);
    });
  }

  /** Zeitleiste: überlebte Zeitalter, das nächste – und dahinter nur Fragezeichen. */
  private timeline(done: number, y: number): GO[] {
    const out: GO[] = [];
    const n = EPOCHS.length;
    const x0 = W / 2 - 300, w = 600;
    const g = this.add.graphics();
    g.lineStyle(2, 0x3a332c, 1);
    g.lineBetween(x0, y, x0 + w, y);
    g.lineStyle(2, 0xc8913c, 0.9);
    g.lineBetween(x0, y, x0 + (w * done) / (n - 1), y);
    out.push(g);
    EPOCHS.forEach((ep, i) => {
      const x = x0 + (w * i) / (n - 1);
      const passed = i <= done;
      g.fillStyle(passed ? 0xc8913c : 0x2a2420, 1);
      g.fillCircle(x, y, passed ? 5 : 4);
      const known = i <= game.data.deepest;
      if (i === done) out.push(text(this, x, y + 10, ep.name, 13, UI.ochre).setOrigin(0.5, 0));
      else if (i === done + 1 && known) out.push(text(this, x, y + 10, ep.name, 13, UI.boneDim).setOrigin(0.5, 0));
      else if (i > done && !known) out.push(title(this, x, y + 10, '?', 13, '#5e554a').setOrigin(0.5, 0));
    });
    return out;
  }

  private next() {
    if (this.nav) this.nav.enabled = false;
    const d = this.d;
    if (d.finished) return fadeTo(this, 'Ending', { node: d.node, morph: this.look() }, 1000);
    const old = this.group;
    this.group = [];
    this.tweens.add({
      targets: old,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        old.forEach((o) => o.destroy());
        this.views = [];
        this.timeJump();
      },
    });
  }

  /**
   * Jahrmillionen vergehen – die Uhr rast bis zum nächsten Zeitalter. Was sich im Zeitalter
   * bewährt hat, setzt sich dabei fort: Je mehr Zeit vergeht, desto deutlicher verändert sich die Art.
   */
  private timeJump() {
    const d = this.d;
    if (d.repeat) return this.generationPass();
    const ep = EPOCHS[d.epoch];
    const nx = EPOCHS[d.epoch + 1];
    const t0 = d.years ?? ep.to;
    const gap = t0 - nx.from;
    const head = title(this, W / 2, 150, `${spanWords(gap)} vergehen …`, 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(t0, 1e5), 26, UI.bone).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    audio.sfx('evolve');

    // dein Tier, während die Zeit vergeht
    const mNow = this.look({ traits: d.traits });
    const mLater = d.drifted ? this.look({ traits: d.drifted }) : mNow;
    const gy = 520, scale = 1.8;
    const [v1, b1] = this.creature(mNow, W / 2, gy, scale);
    const parts: GO[] = [v1, b1];
    this.fadeInAll([v1, b1], 200, 1, 700);
    if (morphKey(mLater) !== morphKey(mNow)) {
      const [v2] = this.creature(mLater, W / 2, gy, scale);
      v2.setAlpha(0);
      parts.push(v2);
      const glow = this.add.image(W / 2, gy - 70, 'glow').setScale(3.4).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 900, delay: 900, yoyo: true, hold: 600 });
      this.tweens.add({ targets: v1, alpha: 0, duration: 1100, delay: 1300 });
      this.tweens.add({ targets: v2, alpha: 1, duration: 1100, delay: 1300 });
    }

    const c = { y: t0 };
    this.tweens.add({
      targets: c,
      y: nx.from,
      duration: 2600,
      ease: 'Sine.inOut',
      onUpdate: () => clock.setText(yearsAgo(c.y, Math.max(1, gap / 200))),
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: [head, clock, ...parts],
            alpha: 0,
            duration: 600,
            onComplete: () => {
              head.destroy();
              clock.destroy();
              parts.forEach((o) => o.destroy());
              this.views = [];
              if (d.transition) this.transform();
              else fadeTo(this, 'Level', { epoch: d.epoch + 1 }, 900);
            },
          });
        });
      },
    });
  }

  /** Der Endgegner lebt noch: Die Linie bleibt im Zeitalter – eine Generation später geht es weiter. */
  private generationPass() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const span = game.epochSpan(d.epoch);
    const head = title(this, W / 2, 150, 'Eine neue Generation …', 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(span.from, 1e4), 26, UI.bone).setOrigin(0.5);
    const line = text(this, W / 2, 252, `Noch immer ${ep.name}. ${d.boss ?? 'Der Herrscher dieser Zeit'} lebt – werde stark genug.`, 20, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    this.fadeInAll([line], 500, 1, 700);
    audio.sfx('evolve');
    const mNow = this.look({ traits: d.traits });
    const mLater = d.drifted ? this.look({ traits: d.drifted }) : mNow;
    const gy = 540, scale = 1.8;
    const [v1, b1] = this.creature(mNow, W / 2, gy, scale);
    const parts: GO[] = [head, clock, line, v1, b1];
    this.fadeInAll([v1, b1], 200, 1, 700);
    if (morphKey(mLater) !== morphKey(mNow)) {
      const [v2] = this.creature(mLater, W / 2, gy, scale);
      v2.setAlpha(0);
      parts.push(v2);
      this.tweens.add({ targets: v1, alpha: 0, duration: 1000, delay: 1100 });
      this.tweens.add({ targets: v2, alpha: 1, duration: 1000, delay: 1100 });
    }
    this.time.delayedCall(3400, () => {
      this.tweens.add({
        targets: parts,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          parts.forEach((o) => o.destroy());
          this.views = [];
          fadeTo(this, 'Level', { epoch: d.epoch }, 900);
        },
      });
    });
  }

  /**
   * Die Nachfahren nehmen eine neue Form an: Der Lebensraum wechselt (Wasser → Ufer …), das Tier
   * flackert zwischen alter und neuer Gestalt – immer schneller –, bis die neue bleibt.
   */
  private transform() {
    const d = this.d;
    const tr = d.transition!;
    const nx = EPOCHS[d.epoch + 1];
    const gy = 480, scale = 2.3;
    // neuer Lebensraum blendet sich langsam über den alten
    const [farNext] = levelBackgrounds(this, nx.theme, 'normal');
    const bgNext = this.add.image(0, 0, farNext).setOrigin(0).setTint(0x9a9a9a).setAlpha(0);
    this.children.sendToBack(bgNext);
    this.children.moveUp(bgNext);
    const head = title(this, W / 2, 86, 'Die Zeit vergeht …', 44).setOrigin(0.5);
    this.fadeInAll([head], 0);
    const [from, fb] = this.creature(this.look({ cls: tr.from, traits: d.drifted }), W / 2 - 140, gy, scale);
    const [to, tb] = this.creature(this.look({ cls: tr.to, traits: d.drifted }), W / 2, gy, scale);
    to.setAlpha(0);
    tb.setAlpha(0);
    from.setAlpha(0);
    fb.setAlpha(0);
    this.tweens.add({ targets: [from], alpha: 1, duration: 800 });
    this.tweens.add({ targets: [fb], alpha: 0.5, duration: 800 });
    // das Tier zieht zur Mitte, während Wasser zu Ufer wird
    this.tweens.add({ targets: [from, fb], x: W / 2, duration: 2200, ease: 'Sine.inOut', delay: 300 });
    this.tweens.add({ targets: bgNext, alpha: 1, duration: 3800, delay: 600, ease: 'Sine.inOut' });
    audio.sfx('evolve');
    const glow = this.add.image(W / 2, gy - 90, 'glow').setScale(5).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 2000, delay: 1600, ease: 'Sine.in' });
    // Funken, die zum Tier hin wirbeln
    const sparks = this.add.particles(W / 2, gy - 80, 'p_dot', {
      emitting: false, lifespan: 1100, speed: { min: 40, max: 140 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffe8b0, 0xe0a848, 0xfff4dc], blendMode: 'ADD', frequency: 40, quantity: 2,
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 150), quantity: 48 },
    });
    this.time.delayedCall(2200, () => sparks.start());
    // Flackern zwischen alter und neuer Gestalt, immer schneller
    let t = 2600;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1);
      const dur = 420 - 330 * k;
      const showNew = i % 2 === 0;
      this.time.delayedCall(t, () => {
        from.setAlpha(showNew ? 0.15 + 0.25 * (1 - k) : 1);
        to.setAlpha(showNew ? 0.55 + 0.45 * k : 0.15 + 0.35 * k);
        to.setShade(showNew ? null : 0x3a3a3a);
        from.setShade(showNew ? 0x3a3a3a : null);
        if (i % 4 === 0) audio.sfx('click');
      });
      t += dur;
    }
    this.time.delayedCall(t, () => {
      sparks.stop();
      this.cameras.main.flash(900, 230, 214, 180);
      audio.sfx('evolve');
      from.destroy();
      fb.destroy();
      this.views = this.views.filter((x) => x.v !== from);
      to.setAlpha(1).setShade(null);
      this.tweens.add({ targets: tb, alpha: 1, duration: 600 });
      const burst = this.add.particles(W / 2, gy - 80, 'p_dot', {
        emitting: false, lifespan: 1400, speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 }, tint: [0xffe8b0, 0xe0a848], blendMode: 'ADD',
      });
      burst.explode(60);
      const s = { k: 0.88 };
      to.setBaseScale(scale * s.k);
      this.tweens.add({ targets: s, k: 1, duration: 900, ease: 'Back.out', onUpdate: () => to.setBaseScale(scale * s.k) });
      this.tweens.add({ targets: glow, alpha: 0.15, duration: 1600 });
      head.setText(CLASSES[tr.to].name);
      const dawn = text(this, W / 2, 140, CLASSES[tr.to].dawn, 23, UI.bone, { align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);
      this.fadeInAll([dawn], 400, 1, 1200);
      this.time.delayedCall(2200, () => {
        const b = new Button(this, W / 2, H - 36, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => fadeTo(this, 'Level', { epoch: d.epoch + 1 }, 900) });
        this.nav = new MenuNav(this, [b]);
      });
    });
  }
}
