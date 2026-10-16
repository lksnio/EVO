import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { CLASSES } from '../data/classes';
import { EPOCHS, spanWords, yearsAgo } from '../data/epochs';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import type { SurvivedData } from './LevelScene';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';

type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Sätze zwischen den Zeitaltern – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Generationen vergehen. Das Leben passt sich an.',
  'Nur wer überlebt, gibt etwas weiter.',
  'Langsam, kaum merklich, verändert sich deine Art.',
];

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

  constructor() {
    super('Generation');
  }

  init(d: SurvivedData) {
    this.d = d;
    this.views = [];
    this.group = [];
    this.nav = undefined;
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
    this.survived();
  }

  update(_t: number, dms: number) {
    for (const { v, mode } of this.views) v.animate(dms / 1000, mode, mode === 'swim' ? 0.35 : 0);
  }

  private look(o: { cls?: Morph['cls']; traits?: SurvivedData['traits'] } = {}): Morph {
    const d = this.d;
    return game.morph({ cls: o.cls ?? d.cls, traits: o.traits ?? d.traits, hue: d.look.hue, seed: d.look.seed, sex: d.look.sex, fierce: 0 });
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
    const sub = text(this, W / 2, 120, `Du hast überlebt – ${yearsAgo(ep.to, 1e4)}.`, 21, UI.boneDim).setOrigin(0.5);
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
    const ep = EPOCHS[d.epoch];
    const nx = EPOCHS[d.epoch + 1];
    const gap = ep.to - nx.from;
    const head = title(this, W / 2, 150, `${spanWords(gap)} vergehen …`, 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(ep.to, 1e5), 26, UI.bone).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    audio.sfx('evolve');

    // dein Tier, während die Zeit vergeht
    const mNow = this.look();
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

    const c = { y: ep.to };
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

  /** Die Nachfahren nehmen eine neue Form an. */
  private transform() {
    const d = this.d;
    const tr = d.transition!;
    const gy = 470, scale = 2.3;
    const [from, fb] = this.creature(this.look({ cls: tr.from, traits: d.drifted }), W / 2, gy, scale);
    this.fadeInAll([from, fb], 0, 1, 800);
    const head = title(this, W / 2, 86, 'Die Zeit vergeht …', 44).setOrigin(0.5);
    this.fadeInAll([head], 0);
    audio.sfx('evolve');
    const glow = this.add.image(W / 2, gy - 90, 'glow').setScale(5).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 1800, delay: 600, ease: 'Sine.in' });
    this.tweens.add({ targets: from, x: W / 2 + 3, yoyo: true, repeat: 18, duration: 60, delay: 1400 });
    this.time.delayedCall(2600, () => {
      this.cameras.main.flash(900, 230, 214, 180);
      from.destroy();
      fb.destroy();
      this.views = [];
      const [to] = this.creature(this.look({ cls: tr.to, traits: d.drifted }), W / 2, gy, scale);
      const s = { k: 0.9 };
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
