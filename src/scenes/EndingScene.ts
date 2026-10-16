import Phaser from 'phaser';
import { W, H } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { levelBackgrounds } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';

const LINES = [
  'Das Tor öffnet sich – vor dir liegt Eden.',
  'Vom winzigen Urfisch bis hierher war es ein langer Weg.',
  'Gaia lächelt: Die Evolution hat ihr Ziel gefunden.',
  'Doch das Leben geht weiter … und wer weiß, wohin es dich noch führt?',
];

export class EndingScene extends Phaser.Scene {
  private hero!: CreatureView;

  constructor() {
    super('Ending');
  }

  create() {
    fadeIn(this, 900);
    audio.music('ending');
    game.data.finished = true;
    game.save();
    const [far, mid] = levelBackgrounds(this, 'eden', 'normal');
    this.add.image(0, 0, far).setOrigin(0);
    this.add.image(0, 0, mid).setOrigin(0);
    const glow = this.add.image(W / 2, 300, 'glow').setScale(9).setTint(0xfff0b0).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.8, yoyo: true, repeat: -1, duration: 2200 });
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 4000, frequency: 60,
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 }, speedY: { min: -30, max: -5 }, tint: [0xfff6c0, 0xffffff, 0xffd0f0],
    });
    this.add.rectangle(0, 600, W, 120, 0x5aa040).setOrigin(0);
    this.hero = new CreatureView(this, -120, 0, game.appearance(), 1.8);
    this.hero.setY(600 - this.hero.L.footY * 1.8);
    this.tweens.add({ targets: this.hero, x: W / 2, duration: 4000, ease: 'Sine.out' });

    const head = title(this, W / 2, 90, 'Du hast Eden erreicht!', 58, '#ffe680').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 1, duration: 1200, delay: 500 });
    LINES.forEach((l, i) => {
      const t = text(this, W / 2, 180 + i * 46, l, 26, '#3a2a10', { fontStyle: '700', stroke: '#fff8e0', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 900, delay: 1600 + i * 1600 });
    });
    const stats = text(
      this, W / 2, 400,
      `Gesammelte EVO-Punkte: ${game.data.totalEvo}   ·   Orte geschafft: ${game.data.completed.length}   ·   Ohnmachten: ${game.data.deaths}`,
      20, '#1a3a10', { fontStyle: '700', stroke: '#ffffff', strokeThickness: 4 },
    ).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: stats, alpha: 1, duration: 900, delay: 8200 });
    this.time.delayedCall(8800, () => {
      new Button(this, W / 2 - 170, 660, 'Weiterspielen', { w: 300, color: 0xf08a24, onClick: () => fadeTo(this, 'EraSelect') });
      new Button(this, W / 2 + 170, 660, 'Titelbild', { w: 300, color: 0x3a6ea8, onClick: () => fadeTo(this, 'Title') });
    });
    audio.sfx('victory');
  }

  update(_t: number, dms: number) {
    const moving = this.tweens.isTweening(this.hero);
    this.hero.animate(dms / 1000, this.hero.L.land ? (moving ? 'walk' : 'idle') : 'swim', moving ? 0.6 : 0);
  }
}
