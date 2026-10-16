import Phaser from 'phaser';
import { W, H } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { levelBackgrounds } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, text } from '../ui/ui';

const PAGES = [
  'Vor langer, langer Zeit war die Erde ein Ozean.\nIn seinen Tiefen regte sich das erste Leben.',
  'Gaia, die Seele der Erde, wacht über alle Geschöpfe.\nSie träumt von einem Ort namens Eden.',
  'Du bist ein kleiner Urfisch.\nFriss, wachse – und entwickle dich weiter!',
  'Sammle EVO-Punkte, verändere deinen Körper\nund finde den Weg: vom Meer ans Land … bis nach Eden.',
];

export class IntroScene extends Phaser.Scene {
  private page = 0;
  private label!: Phaser.GameObjects.Text;
  private fish!: CreatureView;

  constructor() {
    super('Intro');
  }

  create() {
    fadeIn(this, 600);
    audio.music('ozean');
    this.page = 0;
    const [far, mid] = levelBackgrounds(this, 'ozean', 'normal');
    this.add.image(0, 0, far).setOrigin(0);
    this.add.image(0, 0, mid).setOrigin(0).setAlpha(0.8);
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W }, y: H + 10, speedY: { min: -30, max: -70 }, lifespan: 12000,
      scale: { min: 0.3, max: 1 }, alpha: { start: 0.7, end: 0 }, frequency: 200,
    });
    this.fish = new CreatureView(this, W / 2, 470, game.appearance(), 2.2);
    this.tweens.add({ targets: this.fish, y: 455, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' });
    this.add.rectangle(0, 120, W, 190, 0x041828, 0.55).setOrigin(0);
    this.label = text(this, W / 2, 215, '', 32, '#ffffff', { align: 'center', lineSpacing: 10, stroke: '#041828', strokeThickness: 4 }).setOrigin(0.5);
    new Button(this, W - 150, H - 60, 'Weiter', { w: 200, color: 0xf08a24, onClick: () => this.next(), sound: 'select' });
    new Button(this, 130, H - 60, 'Überspringen', { w: 200, h: 48, size: 20, color: 0x3a6ea8, onClick: () => this.finish() });
    this.input.keyboard!.on('keydown-ENTER', () => this.next());
    this.input.keyboard!.on('keydown-SPACE', () => this.next());
    this.input.keyboard!.on('keydown-ESC', () => this.finish());
    this.show();
  }

  update(_t: number, dms: number) {
    this.fish.animate(dms / 1000, 'swim', 0.3);
  }

  private show() {
    this.label.setText(PAGES[this.page]).setAlpha(0);
    this.tweens.add({ targets: this.label, alpha: 1, duration: 500 });
  }

  private next() {
    this.page++;
    if (this.page >= PAGES.length) this.finish();
    else {
      audio.sfx('click');
      this.show();
    }
  }

  private finish() {
    if (!this.scene.isActive()) return;
    game.data.seenIntro = true;
    game.save();
    fadeTo(this, 'EraSelect');
  }
}
