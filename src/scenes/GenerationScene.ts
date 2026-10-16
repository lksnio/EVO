import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, type Traits } from '../state/GameState';
import { CLASSES, type ClassId } from '../data/classes';
import { ERAS, eraById, eraIndex, type EraId } from '../data/eras';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';

interface CompleteData {
  mode: 'complete';
  era: EraId;
  node: string;
  before: Traits;
  cls: ClassId;
  first?: boolean;
  transition?: { from: ClassId; to: ClassId; era: EraId };
  finished?: boolean;
}

interface DeathData {
  mode: 'death';
  era: EraId;
  node: string;
  morph: Morph;
}

type GenData = CompleteData | DeathData;
type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Sätze zwischen den Generationen – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Eine Generation vergeht. Das Leben passt sich an.',
  'Nur wer überlebt, gibt etwas weiter.',
  'Langsam, kaum merklich, verändert sich dein Geschlecht.',
];

/**
 * Zwischen zwei Leben: Nach einem überlebten Ort sieht man sein Tier "einst" und "heute"
 * nebeneinander. Nach dem Tod setzt ein Nachkomme die Reise fort.
 * Am Ende eines Zeitalters nehmen die Nachkommen eine neue Form an (Fisch → Lurch → …).
 */
export class GenerationScene extends Phaser.Scene {
  private d!: GenData;
  private views: { v: CreatureView; mode: 'swim' | 'idle' }[] = [];
  /** alles, was beim Formwandel ausgeblendet wird */
  private group: GO[] = [];
  private nav?: MenuNav;

  constructor() {
    super('Generation');
  }

  init(d: GenData) {
    this.d = d;
    this.views = [];
    this.group = [];
    this.nav = undefined;
  }

  create() {
    fadeIn(this, 900);
    const death = this.d.mode === 'death';
    audio.music(death ? null : 'generation');
    const era = eraById(this.d.era);
    const [far] = levelBackgrounds(this, era.id, 'normal');
    this.add.image(0, 0, far).setOrigin(0).setTint(death ? 0x5a3a36 : 0x8a8a8a);
    this.add.rectangle(0, 0, W, H, 0x050403, death ? 0.7 : 0.55).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 6000, frequency: 160,
      speedY: { min: -12, max: -3 }, speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' },
      tint: death ? 0xa04030 : 0xd8c8a0,
    });
    if (this.d.mode === 'death') this.death(this.d);
    else this.complete(this.d);
  }

  update(_t: number, dms: number) {
    for (const { v, mode } of this.views) v.animate(dms / 1000, mode, mode === 'swim' ? 0.35 : 0);
  }

  /** Ein Tier auf einem Felssockel (an Land) bzw. schwebend mit Schatten (im Wasser). */
  private creature(m: Morph, x: number, groundY: number, scale: number): [CreatureView, Phaser.GameObjects.Image] {
    // Sockel zuerst, damit er hinter dem Tier liegt (aber vor dem Hintergrund)
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

  private complete(d: CompleteData) {
    const era = eraById(d.era);
    const node = era.nodes.find((n) => n.id === d.node)!;
    const head = title(this, W / 2, 86, 'Du hast überlebt.', 46).setOrigin(0.5);
    const sub = text(this, W / 2, 140, node.name, 22, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);

    // gleiche Wildheit für beide Bilder – verglichen wird der Körper
    const fierce = game.fear();
    const mBefore = game.morph({ cls: d.cls, traits: d.before, fierce });
    const mNow = game.morph({ cls: d.cls, fierce });
    const changed = morphKey(mBefore) !== morphKey(mNow);
    const gy = 470, scale = 2.1;
    const [left, lb] = this.creature(mBefore, W * 0.28, gy, scale);
    const [right, rb] = this.creature(mNow, W * 0.72, gy, scale);
    const lt = text(this, W * 0.28, gy + 44, 'Einst', 22, UI.boneDim).setOrigin(0.5);
    const rt = text(this, W * 0.72, gy + 44, 'Heute', 22, UI.bone).setOrigin(0.5);
    const arrow = title(this, W / 2, gy - 60, '›', 64, UI.ochre).setOrigin(0.5);
    this.fadeInAll([left, lb, lt], 600, 0.75);
    this.fadeInAll([right, rb, rt], 1500);
    this.fadeInAll([arrow], 1200, 0.8, 600);
    this.tweens.add({ targets: arrow, x: W / 2 + 10, yoyo: true, repeat: -1, duration: 900, delay: 1800, ease: 'Sine.inOut' });

    const line = changed ? LINES[(game.data.generations + d.node.length) % LINES.length] : 'Das Leben geht weiter.';
    const l2 = text(this, W / 2, 600, line, 24, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5);
    const gen = text(this, W / 2, 636, `Generation ${game.data.generations}`, 17, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([l2], 2300);
    this.fadeInAll([gen], 2600, 0.8);
    if (changed) this.time.delayedCall(1500, () => audio.sfx('evolve'));
    this.group.push(head, sub, left, lb, lt, right, rb, rt, arrow, l2, gen);

    this.time.delayedCall(2400, () => {
      const b = new Button(this, W / 2, H - 34, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => this.afterComplete(d) });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
      this.nav = new MenuNav(this, [b]);
    });
  }

  private afterComplete(d: CompleteData) {
    if (this.nav) this.nav.enabled = false;
    if (d.transition) return this.transform(d.transition);
    if (d.finished) return fadeTo(this, 'Ending', {}, 900);
    const node = eraById(d.era).nodes.find((n) => n.id === d.node);
    const next = ERAS[eraIndex(d.era) + 1];
    if (node?.boss && next && d.first) return fadeTo(this, 'EraSelect', { reveal: next.id }, 700);
    fadeTo(this, 'Map', { era: d.era, completed: d.node, first: d.first }, 600);
  }

  /** Am Ende eines Zeitalters: Die Nachkommen nehmen eine neue Form an. */
  private transform(tr: { from: ClassId; to: ClassId; era: EraId }) {
    const old = this.group;
    this.group = [];
    this.tweens.add({
      targets: old,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        old.forEach((o) => o.destroy());
        this.views = [];
        this.morphSequence(tr);
      },
    });
  }

  private morphSequence(tr: { from: ClassId; to: ClassId; era: EraId }) {
    const fierce = game.fear();
    const gy = 470, scale = 2.3;
    const [from, fb] = this.creature(game.morph({ cls: tr.from, fierce }), W / 2, gy, scale);
    this.fadeInAll([from, fb], 0, 1, 800);
    const nextEra = eraById(tr.era);
    const head = title(this, W / 2, 86, 'Die Zeit vergeht …', 44).setOrigin(0.5);
    this.fadeInAll([head], 0);
    audio.sfx('evolve');
    const glow = this.add.image(W / 2, gy - 90, 'glow').setScale(5).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 1800, delay: 600, ease: 'Sine.in' });
    // das Tier zittert, bevor es sich wandelt
    this.tweens.add({ targets: from, x: W / 2 + 3, yoyo: true, repeat: 18, duration: 60, delay: 1400 });
    this.time.delayedCall(2600, () => {
      this.cameras.main.flash(900, 230, 214, 180);
      from.destroy();
      fb.destroy();
      this.views = [];
      const [to] = this.creature(game.morph({ cls: tr.to, fierce }), W / 2, gy, scale);
      to.setBaseScale(scale * 0.9);
      const s = { k: 0.9 };
      this.tweens.add({ targets: s, k: 1, duration: 900, ease: 'Back.out', onUpdate: () => to.setBaseScale(scale * s.k) });
      this.tweens.add({ targets: glow, alpha: 0.15, duration: 1600 });
      head.setText(CLASSES[tr.to].name);
      const dawn = text(this, W / 2, 140, CLASSES[tr.to].dawn, 23, UI.bone, { align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);
      const era = text(this, W / 2, 600, `${nextEra.name} · ${nextEra.sub}`, 20, UI.boneDim).setOrigin(0.5);
      this.fadeInAll([dawn], 400, 1, 1200);
      this.fadeInAll([era], 1400);
      this.time.delayedCall(2200, () => {
        const b = new Button(this, W / 2, H - 34, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => fadeTo(this, 'EraSelect', { reveal: tr.era }, 800) });
        this.nav = new MenuNav(this, [b]);
      });
    });
  }

  // ---------------------------------------------------------------- Tod

  private death(d: DeathData) {
    const head = title(this, W / 2, 96, 'Dein Leben endet hier.', 46, '#c8473a').setOrigin(0.5);
    this.fadeInAll([head], 0, 1, 1200);
    const gy = 430;
    const dead = new CreatureView(this, W / 2, 0, { ...d.morph, belly: 0 }, 2);
    dead.setY(dead.L.land ? gy - 40 : gy - 40);
    dead.setAngle(180);
    dead.flash(0x6a5a56);
    this.fadeInAll([dead], 0, 0.8, 1200);
    this.tweens.add({ targets: dead, alpha: 0, y: dead.y + 20, delay: 2600, duration: 1600, ease: 'Sine.in' });
    this.time.delayedCall(3400, () => {
      audio.music('generation');
      dead.destroy();
      head.setText('Doch dein Geschlecht lebt weiter.').setColor(UI.bone);
      const [heir, base] = this.creature(game.morph({ belly: 1 }), W / 2, gy + 40, 2);
      this.fadeInAll([heir, base], 0, 1, 1400);
      const t2 = text(this, W / 2, 560, 'Ein Nachkomme setzt die Reise fort.', 24, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5);
      const gen = text(this, W / 2, 596, `Generation ${game.data.generations}`, 17, UI.boneDim).setOrigin(0.5);
      this.fadeInAll([t2, gen], 800, 1, 1000);
      this.time.delayedCall(1600, () => {
        const b1 = new Button(this, W / 2 - 150, H - 46, 'Weiterleben', { w: 260, h: 54, icon: 'ic_play', color: UI.ochreN, onClick: () => fadeTo(this, 'Map', { era: d.era }, 600) });
        const b2 = new Button(this, W / 2 + 150, H - 46, 'Titelbild', { w: 260, h: 54, icon: 'ic_home', onClick: () => fadeTo(this, 'Title', {}, 600) });
        this.nav = new MenuNav(this, [b1, b2]);
      });
    });
  }
}
