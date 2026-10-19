import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { PLATE_IDS, type PlateId } from '../state/GameState';
import { EPOCHS, yearsAgo } from '../data/epochs';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import type { SuccessionData } from './LevelScene';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';

type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Was die deutlichste Veränderung über den Körper erzählt – ohne Zahlen. */
const PLATE_TEXT: Record<PlateId, string> = {
  st: 'Ein härterer Schädel, größere Seitenflossen – deine Nachkommen stoßen zu und wenden blitzschnell.',
  bs: 'Ein tieferer Kiefer, mehr Zähne – deine Nachkommen beißen kräftiger zu, sind aber schwerfälliger.',
  vf: 'Länger, schlanker, mit kräftiger Schwanzflosse – deine Nachkommen holen mehr Beute ein.',
  sw: 'Silbriger, schlanker, mit dunklem Band an der Flanke – deine Nachkommen leben und jagen im Schwarm.',
};

/** Wie die Spielweise heißt, die eine Evolutionsplatte formt. */
const STYLE_NAME: Record<PlateId, string> = { st: 'Stoßen', bs: 'Beißen', vf: 'Verfolgen', sw: 'Im Schwarm' };

/** Sätze, wenn keine Richtung herausragt – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Generationen vergehen. Das Leben passt sich an.',
  'Langsam, kaum merklich, verändert sich deine Art.',
];

/**
 * Der Generationswechsel: Das eigene Tier ist gestorben (oder hat sein Leben weitergegeben) – aus seinem befruchteten Gelege
 * schlüpft die nächste Generation. Es gibt keine Wahl: Die Nachkommen sind an die Spielweise angepasst. Links das Tier, das
 * starb, rechts sein Nachkomme (ausgewachsen, daneben klein, wie er schlüpft), darunter, was sich verändert hat.
 */
export class GenerationScene extends Phaser.Scene {
  private d!: SuccessionData;
  private views: { v: CreatureView; mode: 'swim' | 'idle' }[] = [];
  private nav?: MenuNav;

  constructor() {
    super('Generation');
  }

  init(d: SuccessionData) {
    this.d = d;
    this.views = [];
    this.nav = undefined;
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const [far] = levelBackgrounds(this, ep.theme, 'normal');
    this.add.image(0, 0, far).setOrigin(0).setTint(0x8a8a8a);
    this.add.rectangle(0, 0, W, H, 0x050403, 0.55).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 6000, frequency: 160,
      speedY: { min: -12, max: -3 }, speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: 0xd8c8a0,
    });

    const handed = d.cause.startsWith('Lebensende');
    const head = title(this, W / 2, 62, 'Eine neue Generation', 42).setOrigin(0.5);
    const sub = text(this, W / 2, 110, handed ? 'Dein Fisch hat sein Leben an die Nachkommen weitergegeben.' : `Dein Fisch ist gestorben – ${d.cause}.`, 21, UI.boneDim).setOrigin(0.5);
    const when = text(this, W / 2, 140, `${ep.name} · ${yearsAgo(d.years, 1e3)}`, 17, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub, when], 0);

    const gy = 400;
    const changed = morphKey(d.parent) !== morphKey(d.child);
    const [left, lb] = this.creature(d.parent, W * 0.27, gy, 2);
    const [right, rb] = this.creature(d.child, W * 0.7, gy, 2);
    // so klein schlüpft er
    const [baby, bb] = this.creature(d.hatchling, W * 0.7 + 190, gy + 18, 2);
    const lt = text(this, W * 0.27, gy + 42, `Generation ${d.gen}`, 21, UI.boneDim).setOrigin(0.5);
    const rt = text(this, W * 0.7, gy + 42, `Generation ${d.gen + 1} · ${d.sex === 1 ? 'Männchen' : 'Weibchen'}`, 21, UI.bone).setOrigin(0.5);
    const bt = text(this, W * 0.7 + 190, gy + 42, 'schlüpft', 16, UI.boneDim).setOrigin(0.5);
    const arrow = title(this, W * 0.485, gy - 60, '›', 64, UI.ochre).setOrigin(0.5);
    this.fadeInAll([left, lb, lt], 500, 0.75);
    this.fadeInAll([right, rb, rt], 1400);
    this.fadeInAll([baby, bb, bt], 1900, 0.9);
    this.fadeInAll([arrow], 1100, 0.8, 600);
    const glow = this.add.image(W * 0.7, gy - 70, 'glow').setScale(3.6).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.45, duration: 700, delay: 1350, yoyo: true, hold: 300 });
    this.tweens.add({ targets: arrow, x: W * 0.485 + 10, yoyo: true, repeat: -1, duration: 900, delay: 1800, ease: 'Sine.inOut' });
    if (changed) this.time.delayedCall(1400, () => audio.sfx('evolve'));

    // was sich verändert hat: die deutlichste Richtung – und wie die Spielweise dazu beitrug
    const line = d.line ? PLATE_TEXT[d.line] : LINES[d.gen % LINES.length];
    const l1 = text(this, W / 2, 504, line, 21, UI.bone, { fontStyle: 'italic', align: 'center', wordWrap: { width: 980 } }).setOrigin(0.5);
    this.fadeInAll([l1], 2300);
    const style = this.styleRow(560);
    this.fadeInAll(style, 2700);

    this.time.delayedCall(2600, () => {
      const b = new Button(this, W / 2, H - 46, 'Schlüpfen', { w: 260, h: 52, icon: 'ic_play', color: UI.ochreN, onClick: () => this.next() });
      this.fadeInAll([b], 0, 1, 500);
      this.nav = new MenuNav(this, [b]);
    });
  }

  update(_t: number, dms: number) {
    for (const { v, mode } of this.views) v.animate(dms / 1000, mode, mode === 'swim' ? 0.35 : 0);
  }

  /**
   * „Deine Spielweise“: je Evolutionsplatte bis zu drei Punkte – so stark hat sie die Nachkommen geformt. (Den Schwarm nur,
   * wenn er überhaupt eine Rolle spielte.)
   */
  private styleRow(y: number): GO[] {
    const d = this.d;
    const ids = PLATE_IDS.filter((id) => id !== 'sw' || d.fit.sw > 0.02);
    const parts: GO[] = [text(this, W / 2, y, 'Deine Spielweise', 15, UI.ochre, { fontStyle: '700' }).setOrigin(0.5).setLetterSpacing(2)];
    const w = 210, x0 = W / 2 - ((ids.length - 1) * w) / 2;
    ids.forEach((id, i) => {
      const n = d.fit[id] > 0.6 ? 3 : d.fit[id] > 0.3 ? 2 : d.fit[id] > 0.08 ? 1 : 0;
      const dots = '●'.repeat(n) + '○'.repeat(3 - n);
      parts.push(text(this, x0 + i * w, y + 32, `${STYLE_NAME[id]}  ${dots}`, 18, n ? UI.bone : UI.boneDim).setOrigin(0.5));
    });
    return parts;
  }

  /** Ein Tier schwebend mit Schatten. */
  private creature(m: Morph, x: number, groundY: number, scale: number): [CreatureView, Phaser.GameObjects.Image] {
    const base = this.add.image(x, groundY - 10, 'shadow').setScale(scale * 1.1 * Math.max(0.35, m.size), 1).setAlpha(0.5);
    const v = new CreatureView(this, x, groundY - 70, m, scale);
    v.setFacing(1);
    this.views.push({ v, mode: 'swim' });
    return [v, base];
  }

  private fadeInAll(targets: GO[], delay: number, to = 1, ms = 900) {
    for (const o of targets) {
      const a = o instanceof Phaser.GameObjects.Image && o.texture.key === 'shadow' ? 0.5 * to : to;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: ms, delay });
    }
  }

  /** Die nächste Generation schlüpft im Laichfluss – dort, wo ihr Gelege liegt. */
  private next() {
    if (this.nav) this.nav.enabled = false;
    audio.sfx('select');
    fadeTo(this, 'Level', { epoch: this.d.epoch }, 900);
  }
}
