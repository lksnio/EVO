import Phaser from 'phaser';
import { W, H, DEBUG } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import type { Appearance } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';

const PARADE: { a: Appearance; x: number; y: number; mode: 'swim' | 'walk' | 'idle' }[] = [
  { a: { cls: 'fish', kiefer: 2, horn: 1, koerper: 1, haut: 1, schwanz: 2, beine: 0, farbe: 0 }, x: 190, y: 635, mode: 'swim' },
  { a: { cls: 'amphibian', kiefer: 3, horn: 0, koerper: 1, haut: 0, schwanz: 2, beine: 2, farbe: 2 }, x: 480, y: 0, mode: 'idle' },
  { a: { cls: 'reptile', kiefer: 4, horn: 4, koerper: 2, haut: 4, schwanz: 3, beine: 3, farbe: 1 }, x: 790, y: 0, mode: 'idle' },
  { a: { cls: 'mammal', kiefer: 5, horn: 0, koerper: 2, haut: 5, schwanz: 4, beine: 4, farbe: 3 }, x: 1100, y: 0, mode: 'idle' },
];

export class TitleScene extends Phaser.Scene {
  private views: { v: CreatureView; mode: 'swim' | 'walk' | 'idle' }[] = [];
  private nav?: MenuNav;
  private overlay?: Phaser.GameObjects.Container;

  constructor() {
    super('Title');
  }

  create() {
    fadeIn(this);
    audio.music('title');
    this.views = [];
    this.overlay = undefined;
    this.add.image(0, 0, 'title_bg').setOrigin(0);
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W },
      y: H + 10,
      speedY: { min: -25, max: -60 },
      speedX: { min: -8, max: 8 },
      lifespan: 14000,
      scale: { min: 0.4, max: 1.1 },
      alpha: { start: 0.6, end: 0 },
      frequency: 260,
    });

    const t = title(this, W / 2, 112, 'EVO', 150, '#ffe680').setOrigin(0.5);
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0.15, '#fff6c0');
    grad.addColorStop(0.55, '#ffc23a');
    grad.addColorStop(1, '#ff7a2a');
    t.setFill(grad);
    this.tweens.add({ targets: t, scale: { from: 1, to: 1.04 }, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.inOut' });
    title(this, W / 2, 212, 'Auf der Suche nach Eden', 36, '#bff0ff').setOrigin(0.5);

    // Evolutionsreihe
    for (const p of PARADE) {
      const v = new CreatureView(this, p.x, 0, p.a, 1.55);
      const y = p.y || 600 - v.L.footY * 1.55;
      v.setY(y);
      this.views.push({ v, mode: p.mode });
      if (p.mode !== 'swim') this.add.image(p.x, 602, 'shadow').setScale(1.4, 1).setAlpha(0.7).setDepth(-1);
    }
    for (let i = 0; i < 3; i++) {
      const x = (PARADE[i].x + PARADE[i + 1].x) / 2;
      const a = title(this, x, 560, '›', 54, '#ffe680').setOrigin(0.5);
      this.tweens.add({ targets: a, x: x + 10, alpha: 0.5, yoyo: true, repeat: -1, duration: 700, delay: i * 200 });
    }

    // Knöpfe
    const items: Button[] = [];
    let y = 300;
    if (game.hasProgress()) {
      items.push(new Button(this, W / 2, y, 'Weiterspielen', { w: 300, color: 0xf08a24, onClick: () => this.continueGame() }));
      y += 72;
    }
    items.push(new Button(this, W / 2, y, 'Neues Spiel', { w: 300, color: game.hasProgress() ? 0x2f8f6f : 0xf08a24, onClick: () => this.newGame() }));
    y += 72;
    items.push(new Button(this, W / 2, y, 'Steuerung', { w: 300, color: 0x3a6ea8, onClick: () => this.showHelp() }));
    this.nav = new MenuNav(this, items);
    soundButton(this, W - 44, 40);
    text(this, 16, H - 26, DEBUG ? 'Debug-Modus aktiv' : 'Ein Fan-Projekt · Grafik & Ton werden im Browser erzeugt', 15, '#9ac8e8');

    this.input.keyboard!.on('keydown-ESC', () => this.closeOverlay());
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    for (const { v, mode } of this.views) v.animate(dt, mode, mode === 'swim' ? 0.5 : 0);
  }

  private continueGame() {
    audio.sfx('select');
    fadeTo(this, 'EraSelect');
  }

  private newGame() {
    if (game.hasProgress()) {
      this.confirm('Neues Spiel starten?\nDein bisheriger Fortschritt geht verloren.', () => {
        game.reset();
        fadeTo(this, 'Intro');
      });
      return;
    }
    game.reset();
    fadeTo(this, 'Intro');
  }

  private confirm(msg: string, yes: () => void) {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    c.add(dim);
    c.add(panel(this, W / 2 - 300, H / 2 - 130, 600, 260));
    c.add(text(this, W / 2, H / 2 - 50, msg, 26, '#ffffff', { align: 'center' }).setOrigin(0.5));
    const b1 = new Button(this, W / 2 - 130, H / 2 + 60, 'Ja, neu', { w: 200, color: 0xd04a3a, onClick: () => yes() });
    const b2 = new Button(this, W / 2 + 130, H / 2 + 60, 'Abbrechen', { w: 200, color: 0x3a6ea8, onClick: () => this.closeOverlay() });
    c.add([b1, b2]);
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
    const nav = new MenuNav(this, [b2, b1]);
    c.once('destroy', () => (nav.enabled = false));
  }

  private showHelp() {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive().on('pointerdown', () => this.closeOverlay()));
    c.add(panel(this, W / 2 - 360, 90, 720, 540));
    c.add(title(this, W / 2, 140, 'Steuerung', 40).setOrigin(0.5));
    const rows: [string, string][] = [
      ['← → / A D', 'Laufen bzw. schwimmen'],
      ['↑ ↓ / W S', 'Im Wasser hoch und runter'],
      ['Leertaste / ↑', 'Springen (an Land)'],
      ['J oder X', 'Beißen'],
      ['K oder C', 'Hornstoß (braucht ein Horn)'],
      ['E', 'Evolution (auf der Karte)'],
      ['Esc / P', 'Pause'],
      ['M', 'Ton an/aus'],
    ];
    rows.forEach(([k, v], i) => {
      c.add(text(this, W / 2 - 300, 200 + i * 44, k, 24, '#ffe680', { fontStyle: '700' }));
      c.add(text(this, W / 2 - 40, 200 + i * 44, v, 24, '#ffffff'));
    });
    c.add(text(this, W / 2, 570, 'Besiegte Gegner hinterlassen Fleisch: Friss es für EVO-Punkte!\nAuf dem Handy erscheinen Bildschirm-Knöpfe.', 19, '#bfe6ff', { align: 'center' }).setOrigin(0.5));
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
  }

  private closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy();
    this.overlay = undefined;
    if (this.nav) this.nav.enabled = true;
  }
}
