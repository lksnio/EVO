import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { levelBackgrounds } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';

const LINES = [
  'Das Tor gibt den Weg frei. Vor dir liegt Eden.',
  'Unzählige Generationen haben gekämpft, gehungert, überlebt.',
  'Jede von ihnen hat dich ein Stück weit geformt.',
  'Das Leben geht weiter – und niemand weiß, wohin es dich noch führt.',
];

export class EndingScene extends Phaser.Scene {
  private hero!: CreatureView;
  private views: CreatureView[] = [];

  constructor() {
    super('Ending');
  }

  create() {
    fadeIn(this, 1400);
    audio.music('ending');
    this.views = [];
    game.data.finished = true;
    game.save();
    const [far, mid] = levelBackgrounds(this, 'eden', 'normal');
    this.add.image(0, 0, far).setOrigin(0);
    this.add.image(0, 0, mid).setOrigin(0);
    // Das Licht wird langsam heller
    const dark = this.add.rectangle(0, 0, W, H, 0x050403, 0.75).setOrigin(0);
    this.tweens.add({ targets: dark, alpha: 0.2, duration: 9000, ease: 'Sine.inOut' });
    const glow = this.add.image(W / 2, 260, 'glow').setScale(9).setTint(0xffe2a8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.45, duration: 6000, delay: 1000 });
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 5000, frequency: 90,
      scale: { start: 0.4, end: 0 }, alpha: { start: 0, end: 0.8, ease: 'Sine.inOut' }, speedY: { min: -20, max: -4 }, tint: [0xfff0c8, 0xffe0a0],
    });
    this.add.rectangle(0, 610, W, 110, 0x141a0c, 0.9).setOrigin(0);

    // Die Ahnen ziehen im Hintergrund mit – wie Erinnerungen
    const hist = game.data.history;
    const k = Math.min(6, hist.length);
    for (let i = 0; i < k; i++) {
      const a = hist[Math.round((i * (hist.length - 1)) / Math.max(1, k - 1))];
      const v = new CreatureView(this, 0, 0, game.morph({ cls: a.cls, traits: a.traits, fierce: 0 }), 0.8);
      const x = 120 + i * 120;
      v.setPosition(x, v.L.land ? 600 - v.L.footY * 0.8 : 540).setAlpha(0).setFacing(1);
      this.tweens.add({ targets: v, alpha: 0.18 + 0.08 * i, duration: 1600, delay: 7000 + i * 500 });
      this.views.push(v);
    }

    this.hero = new CreatureView(this, -140, 0, game.morph({ belly: 2 }), 1.9);
    this.hero.setY(this.hero.L.land ? 612 - this.hero.L.footY * 1.9 : 540);
    this.tweens.add({ targets: this.hero, x: W * 0.68, duration: 5200, ease: 'Sine.out' });

    const head = title(this, W / 2, 86, 'Eden', 72, '#f0e2c0').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 1, duration: 1600, delay: 800 });
    LINES.forEach((l, i) => {
      const t = text(this, W / 2, 168 + i * 44, l, 25, UI.bone, { stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 1200, delay: 2000 + i * 1900 });
    });
    const gens = game.data.generations, places = game.data.completed.length;
    const stats = text(this, W / 2, 360, `${gens} ${gens === 1 ? 'Generation' : 'Generationen'}  ·  ${places} ${places === 1 ? 'Ort' : 'Orte'} überlebt`, 20, UI.boneDim, { stroke: '#050403', strokeThickness: 4 })
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: stats, alpha: 1, duration: 1000, delay: 9800 });
    this.time.delayedCall(10400, () => {
      new Button(this, W / 2 - 170, 668, 'Weiterleben', { w: 300, color: UI.ochreN, onClick: () => fadeTo(this, 'EraSelect') });
      new Button(this, W / 2 + 170, 668, 'Titelbild', { w: 300, onClick: () => fadeTo(this, 'Title') });
    });
    this.time.delayedCall(1200, () => audio.sfx('victory'));
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    const moving = this.tweens.isTweening(this.hero);
    this.hero.animate(dt, this.hero.L.land ? (moving ? 'walk' : 'idle') : 'swim', moving ? 0.6 : 0);
    for (const v of this.views) v.animate(dt, v.L.land ? 'idle' : 'swim', 0.2);
  }
}
