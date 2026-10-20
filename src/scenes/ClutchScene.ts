import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { GENES, type Egg, type Gene } from '../sim/brood';
import { MenuNav, fadeIn, fadeTo, text } from '../ui/ui';
import { tex } from '../util/canvas';

/**
 * Das Gelege (Karbon): Nach dem Tod wählt man ein Ei – es schlüpft, und man spielt als dieses Tier weiter. Ist die Gefahr
 * überstanden, liegt ein neues Gelege da: die nächste Generation, und wieder wählt man ein Ei. Jedes Ei trägt das Erbgut
 * seiner Generation, ein wenig verschieden (die Start-Eier sind alle gleich).
 */
export interface ClutchData {
  epoch: number;
  /** death: nach dem Tod; gen: ein neues Gelege (die nächste Generation) */
  mode: 'death' | 'gen';
  cause?: string;
}

const GENE_NAME: Record<Gene, string> = { jaw: 'Gebiss', limb: 'Beine', grip: 'Griff', armor: 'Schuppen' };

/** Ein Ei als Bild: glasige Hülle, gelblicher Dotter, darin der eingerollte Keim. */
function eggTexture(scene: Phaser.Scene) {
  return tex(scene, 'clutch_egg', 120, 120, (ctx) => {
    const g = ctx.createRadialGradient(46, 42, 6, 60, 60, 56);
    g.addColorStop(0, 'rgba(250,246,220,0.95)');
    g.addColorStop(0.5, 'rgba(206,196,128,0.85)');
    g.addColorStop(1, 'rgba(90,96,52,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(60, 60, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,20,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // der Keim: ein eingerolltes Larvchen
    ctx.strokeStyle = 'rgba(36,32,20,0.9)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(62, 64, 20, -0.6, Math.PI * 1.25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(36,32,20,0.95)';
    ctx.beginPath();
    ctx.arc(76, 50, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,230,0.85)';
    ctx.beginPath();
    ctx.arc(42, 36, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

class EggCard extends Phaser.GameObjects.Container {
  disabled = false;
  private ring: Phaser.GameObjects.Rectangle;
  private egg: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, e: Egg, best: Record<Gene, number>, private onPick: () => void) {
    super(scene, x, y);
    this.ring = scene.add.rectangle(0, 40, 250, 330, 0x1a2014, 0.82).setStrokeStyle(2, 0x6a5638, 0.9);
    this.egg = scene.add.image(0, -60, eggTexture(scene)).setScale(0.9);
    this.add([this.ring, this.egg]);
    // wie die Übersicht: der erste Pederpes hat überall 10
    const vals = game.eggShown(e);
    GENES.forEach((g, i) => {
      const shown = vals[g];
      const y0 = 30 + i * 46;
      const top = best[g] > 10 && shown === best[g];
      this.add(text(scene, -104, y0 - 12, GENE_NAME[g], 17, top ? UI.ochre : UI.boneDim));
      this.add(text(scene, 104, y0 - 12, `${shown}`, 18, top ? UI.ochre : UI.bone).setOrigin(1, 0));
      this.add(scene.add.rectangle(-104, y0 + 14, 208, 6, 0x0b0c0d, 0.9).setOrigin(0, 0.5));
      this.add(scene.add.rectangle(-104, y0 + 14, 208 * Math.min(1, (shown - 10) / 20 + 0.04), 6, top ? 0xc8913c : 0x8a9a6a, 1).setOrigin(0, 0.5));
    });
    this.setSize(250, 330);
    this.ring.setInteractive({ useHandCursor: true });
    this.ring.on('pointerover', () => this.setFocus(true));
    this.ring.on('pointerdown', () => this.click());
    scene.add.existing(this);
    scene.tweens.add({ targets: this.egg, y: -66, yoyo: true, repeat: -1, duration: 1600 + Math.random() * 600, ease: 'Sine.inOut' });
  }

  setFocus(on: boolean) {
    this.ring.setStrokeStyle(on ? 3 : 2, on ? 0xc8913c : 0x6a5638, on ? 1 : 0.9);
    this.egg.setScale(on ? 1 : 0.9);
    return this;
  }

  click() {
    this.onPick();
  }
}

export class ClutchScene extends Phaser.Scene {
  private d!: ClutchData;
  private going = false;

  constructor() {
    super('Clutch');
  }

  init(d: ClutchData) {
    this.d = d;
    this.going = false;
  }

  create() {
    fadeIn(this, 900);
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    this.cameras.main.setBackgroundColor('#070a06');
    audio.music('generation');
    const b = game.brood;
    if (!b) {
      fadeTo(this, 'Level', { epoch: this.d.epoch }, 600);
      return;
    }
    // trübes Sumpfwasser
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e2c1a, 0x1e2c1a, 0x050705, 0x050705, 1);
    bg.fillRect(0, 0, W, H);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 6000, frequency: 120,
      scale: { start: 0.35, end: 0 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, speedY: { min: -14, max: -3 }, tint: [0xd8e8b0, 0xf0e0a0],
    });
    const gen = this.d.mode === 'gen';
    const head = gen ? `Generation ${b.gen}` : 'Das Gelege';
    this.add.text(W / 2, 64, head.toUpperCase(), { fontFamily: TITLE_FONT, fontSize: '30px', color: UI.bone, resolution: 2 }).setOrigin(0.5).setLetterSpacing(8);
    const sub = gen
      ? `Die Gefahr ist überstanden – ein neues Gelege mit ${b.eggs} Eiern.`
      : `${this.d.cause ?? 'Gestorben'} – noch ${b.eggs} ${b.eggs === 1 ? 'Ei' : 'Eier'} im Nest.`;
    text(this, W / 2, 112, sub, 19, UI.boneDim).setOrigin(0.5);
    const eggs = game.eggOffer();
    const best = { jaw: 0, limb: 0, grip: 0, armor: 0 } as Record<Gene, number>;
    for (const e of eggs) {
      const v = game.eggShown(e);
      for (const g of GENES) best[g] = Math.max(best[g], v[g]);
    }
    const same = eggs.every((e) => GENES.every((g) => e.genes[g] === eggs[0].genes[g]));
    // die Start-Eier sind alle gleich: dann gibt es nichts zu wählen
    const list = same ? eggs.slice(0, 1) : eggs;
    const pick = (e: Egg) => () => this.hatch(e);
    const cards = list.map((e, i) => new EggCard(this, W / 2 + (i - (list.length - 1) / 2) * 290, 330, e, same ? { jaw: 0, limb: 0, grip: 0, armor: 0 } : best, pick(e)));
    text(this, W / 2, H - 58, same ? 'E, Eingabe oder Antippen: Das Ei schlüpft.' : '← → wählen  ·  E, Eingabe oder Antippen: Das Ei schlüpft.', 17, UI.boneDim).setOrigin(0.5);
    const nav = new MenuNav(this, cards, cards.length);
    this.input.keyboard?.on('keydown-E', () => cards[nav.idx]?.click());
  }

  private hatch(e: Egg) {
    if (this.going) return;
    this.going = true;
    audio.sfx('laich');
    game.hatchEgg(e);
    fadeTo(this, 'Level', { epoch: this.d.epoch }, 1000);
  }
}
