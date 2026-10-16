import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { levelBackgrounds } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, text } from '../ui/ui';

const PAGES = [
  'Vor unvorstellbar langer Zeit war die Erde ein einziger Ozean.',
  'In seiner Tiefe kämpft alles Leben ums Überleben.\nFressen – oder gefressen werden.',
  'Du bist ein kleiner Urfisch.\nSchwach, unscheinbar … und hungrig.',
  'Was du tust, formt, was aus dir wird.\nUnd was aus deinen Nachkommen wird.',
];

export class IntroScene extends Phaser.Scene {
  private page = 0;
  private label!: Phaser.GameObjects.Text;
  private fish!: CreatureView;

  constructor() {
    super('Intro');
  }

  create() {
    fadeIn(this, 900);
    audio.music('ozean');
    this.page = 0;
    const [far, mid] = levelBackgrounds(this, 'ozean', 'dark');
    this.add.image(0, 0, far).setOrigin(0);
    this.add.image(0, 0, mid).setOrigin(0).setAlpha(0.8);
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W }, y: H + 10, speedY: { min: -20, max: -50 }, lifespan: 14000,
      scale: { min: 0.3, max: 0.9 }, alpha: { start: 0.5, end: 0 }, frequency: 260,
    });
    this.fish = new CreatureView(this, W / 2, 480, game.morph({ belly: 1 }), 2.2);
    this.tweens.add({ targets: this.fish, y: 466, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.inOut' });
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.85);
    this.label = text(this, W / 2, 220, '', 32, UI.bone, { align: 'center', lineSpacing: 12, stroke: '#030405', strokeThickness: 5 }).setOrigin(0.5);
    new Button(this, W - 150, H - 56, 'Weiter', { w: 200, color: UI.ochreN, onClick: () => this.next(), sound: 'select' });
    new Button(this, 130, H - 56, 'Überspringen', { w: 200, h: 48, size: 18, onClick: () => this.finish() });
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
    this.tweens.add({ targets: this.label, alpha: 1, duration: 900 });
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
    fadeTo(this, 'Map', { era: 'ozean' }, 900);
  }
}
