import Phaser from 'phaser';
import { W, H, DEBUG, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, ZERO_TRAITS } from '../state/GameState';
import { SPECIES } from '../data/species';
import { makeSpeciesTextures, speciesKey } from '../art/speciesArt';
import { CreatureView } from '../objects/CreatureView';
import { EPOCHS } from '../data/epochs';
import { Button, MenuNav, controlsList, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { continueLife, startNewLife } from './flow';

/**
 * Titelbild: Tiefsee, ein kleines Tier im Dunkeln – und ab und zu zieht ein riesiger Schatten vorbei.
 */
export class TitleScene extends Phaser.Scene {
  private hero!: CreatureView;
  private nav?: MenuNav;
  private overlay?: Phaser.GameObjects.Container;
  private overlayNav?: MenuNav;

  constructor() {
    super('Title');
  }

  create() {
    fadeIn(this, 900);
    audio.music('title');
    this.overlay = undefined;
    this.add.image(0, 0, 'title_bg2').setOrigin(0);
    // Meeresschnee
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: -20, max: H }, lifespan: 12000, frequency: 90,
      speedY: { min: 4, max: 16 }, speedX: { min: -5, max: 5 },
      scale: { min: 0.08, max: 0.3 }, alpha: { start: 0, end: 0.55, ease: 'Sine.inOut' }, tint: 0xd8e0d8,
    });

    // Ein riesiger Schatten zieht durch die Tiefe
    const big = SPECIES.dunkleosteus;
    makeSpeciesTextures(this, big);
    const shadow = this.add.image(-400, 420, speciesKey(big.id, 0)).setTint(0x020405).setAlpha(0.5).setScale(3.2);
    const pass = () => {
      const ltr = Math.random() < 0.5;
      shadow.setFlipX(!ltr);
      shadow.setPosition(ltr ? -500 : W + 500, 250 + Math.random() * 260);
      this.tweens.add({ targets: shadow, x: ltr ? W + 500 : -500, y: shadow.y + (Math.random() - 0.5) * 80, duration: 16000, ease: 'Sine.inOut', onComplete: () => this.time.delayedCall(5000 + Math.random() * 7000, pass) });
    };
    this.time.delayedCall(2500, pass);

    // Licht von oben, Titel
    const glow = this.add.image(W / 2, 120, 'glow').setScale(8, 3).setTint(0x8ab0a8).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 4000, ease: 'Sine.inOut' });
    const t = title(this, W / 2, 128, 'EVO', 150, UI.bone).setOrigin(0.5);
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0.1, '#f0e6cc');
    grad.addColorStop(0.6, '#c8a46a');
    grad.addColorStop(1, '#7a4a22');
    t.setFill(grad);
    title(this, W / 2, 232, 'Die Suche nach Eden', 30, UI.boneDim).setOrigin(0.5);

    // Das eigene Tier (oder ein frisch geschlüpfter Urfisch)
    const run = game.run;
    const m = run ? game.morph({ belly: 1 }) : game.morph({ cls: 'fish', traits: { ...ZERO_TRAITS }, fierce: 0, hue: 0, seed: 7, sex: 0 });
    this.hero = new CreatureView(this, 250, 0, m, 1.7);
    const land = this.hero.L.land;
    this.hero.setY(land ? 640 - this.hero.L.footY * 1.7 : 560);
    if (land) this.add.image(250, 646, 'pedestal').setScale(1.1, 0.9).setDepth(-1);
    else this.tweens.add({ targets: this.hero, y: 548, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.inOut' });
    if (run) {
      text(this, 250, 676, `Deine Linie lebt – ${EPOCHS[run.epoch].name}`, 16, UI.boneDim).setOrigin(0.5).setAlpha(0.8);
    }

    // Knöpfe
    const items: Button[] = [];
    let y = 330;
    if (run) {
      items.push(new Button(this, W / 2, y, 'Weiterleben', { w: 300, color: UI.ochreN, onClick: () => this.continueGame() }));
      y += 68;
    }
    items.push(new Button(this, W / 2, y, 'Neues Leben', { w: 300, color: run ? UI.stone : UI.ochreN, onClick: () => this.newGame() }));
    y += 68;
    if (game.hasTree()) {
      items.push(new Button(this, W / 2, y, 'Stammbaum', { w: 300, onClick: () => !this.overlay && fadeTo(this, 'Tree', { mode: 'view' }, 600) }));
      y += 68;
    }
    items.push(new Button(this, W / 2, y, 'Aquapendium', { w: 300, onClick: () => !this.overlay && fadeTo(this, 'Aquapendium', { page: 0 }, 600) }));
    y += 68;
    items.push(new Button(this, W / 2, y, 'Steuerung', { w: 300, onClick: () => this.showHelp() }));
    this.nav = new MenuNav(this, items);
    soundButton(this, W - 44, 40);
    text(this, 16, H - 28, DEBUG ? 'Debug-Modus aktiv' : 'Ein Fan-Projekt · Bilder und Töne entstehen im Browser', 15, UI.boneDim).setAlpha(0.7);

    this.input.keyboard!.on('keydown-ESC', () => this.closeOverlay());
  }

  update(_t: number, dms: number) {
    this.hero.animate(dms / 1000, this.hero.L.land ? 'idle' : 'swim', 0.25);
  }

  private continueGame() {
    if (this.overlay) return;
    continueLife(this);
  }

  private newGame() {
    if (this.overlay) return;
    if (game.hasRun()) {
      this.confirm('Ein neues Leben beginnen?\nDeine jetzige Linie endet dann.', () => startNewLife(this));
      return;
    }
    startNewLife(this);
  }

  private confirm(msg: string, yes: () => void) {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 300, H / 2 - 130, 600, 260, 0.95));
    c.add(text(this, W / 2, H / 2 - 50, msg, 26, UI.bone, { align: 'center' }).setOrigin(0.5));
    const b1 = new Button(this, W / 2 - 130, H / 2 + 60, 'Ja', { w: 200, color: 0x5a2420, onClick: () => yes() });
    const b2 = new Button(this, W / 2 + 130, H / 2 + 60, 'Abbrechen', { w: 200, onClick: () => this.closeOverlay() });
    c.add([b1, b2]);
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
    this.overlayNav = new MenuNav(this, [b2, b1]);
  }

  private showHelp() {
    this.closeOverlay();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive().on('pointerdown', () => this.closeOverlay()));
    c.add(panel(this, W / 2 - 420, 70, 840, 580, 0.95));
    c.add(title(this, W / 2, 124, 'Steuerung', 38).setOrigin(0.5));
    controlsList(this, c, W / 2 + 30, 172, 21, 32);
    c.add(text(this, W / 2, 604, 'Auf dem Handy erscheinen Knöpfe auf dem Bildschirm.', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
  }

  private closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy();
    this.overlay = undefined;
    if (this.overlayNav) this.overlayNav.enabled = false;
    this.overlayNav = undefined;
    if (this.nav) this.nav.enabled = true;
  }
}
