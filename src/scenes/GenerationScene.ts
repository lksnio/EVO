import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { yearsAgo } from '../data/epochs';
import type { SuccessionData } from './LevelScene';
import { fadeTo, text } from '../ui/ui';

/**
 * Der Einschnitt zwischen zwei Generationen: Dunkelheit, die neue Generation, die Zeit – dann wacht das Tier aus dem
 * gewählten Ei im Laichfluss auf (siehe RoeScene).
 */
export class GenerationScene extends Phaser.Scene {
  private d!: SuccessionData;
  private going = false;

  constructor() {
    super('Generation');
  }

  init(d: SuccessionData) {
    this.d = d;
    this.going = false;
  }

  create() {
    const d = this.d;
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    this.cameras.main.setBackgroundColor('#000000');
    audio.music('generation');
    const gen = d.gen;
    const head = this.add.text(W / 2, H / 2 - 16, `Generation ${gen}`.toUpperCase(), {
      fontFamily: TITLE_FONT, fontSize: '30px', color: UI.bone, fontStyle: '400', resolution: 2,
    }).setOrigin(0.5).setLetterSpacing(8).setAlpha(0);
    const line = this.add.rectangle(W / 2, H / 2 + 20, 120, 1, 0xc8913c, 1).setAlpha(0);
    const when = text(this, W / 2, H / 2 + 46, yearsAgo(d.years, 1), 16, UI.boneDim).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 0.92, duration: 1400, delay: 700, ease: 'Sine.inOut' });
    this.tweens.add({ targets: line, alpha: 0.5, scaleX: { from: 0.2, to: 1 }, duration: 1400, delay: 1000, ease: 'Sine.out' });
    this.tweens.add({ targets: when, alpha: 0.75, duration: 1200, delay: 1300 });
    this.time.delayedCall(5200, () => this.next());
    // wer nicht warten mag: eine Taste oder ein Tippen (nicht gleich zu Beginn – sonst verschluckt man den Einschnitt)
    this.time.delayedCall(1200, () => {
      this.input.keyboard?.once('keydown', () => this.next());
      this.input.once('pointerdown', () => this.next());
    });
  }

  /** Das nächste Tier wacht im Laichfluss auf – dort, wo sein Gelege liegt. */
  private next() {
    if (this.going) return;
    this.going = true;
    fadeTo(this, 'Level', { epoch: this.d.epoch }, 1100);
  }
}
