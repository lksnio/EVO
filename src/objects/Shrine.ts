import Phaser from 'phaser';
import { DEPTH } from '../config';
import { game } from '../state/GameState';
import { Prompt } from '../ui/InteractionPrompt';

// ---------------------------------------------------------------------------
// Die große Muschel im Laichfluss: eine riesige Fächermuschel (gezeichnetes Bild, assets/shrine/muschel.webp), aufrecht im
// Sand, in ihr eine Perle, die leise glüht. Wer genug Muscheln gesammelt hat (8, 16, 32, 64 …), betet hier – und sie segnet
// seine Linie mit mehr Ausdauer. Ist es so weit, ruft sie: Ringe aus Licht gehen von der Perle aus. Gebetet wird mit der
// Interaktionstaste (LevelScene.shrineStep).
// ---------------------------------------------------------------------------

/** Bildgröße der Datei und Lage der Perle darin (Anteil von Breite und Höhe) */
const IMG = { w: 560, h: 357, pearlX: 0.497, pearlY: 0.7 };
/** so breit steht die Muschel in der Welt (Bildpunkte) – etwas kleiner als die gemalte von früher (139) */
const WIDTH = 118;
const SCALE = WIDTH / IMG.w;
const HEIGHT = IMG.h * SCALE;
/** wie tief die Muschel im Sand steckt */
const SINK = 6;

export class Shrine {
  private glow: Phaser.GameObjects.Image;
  private ray: Phaser.GameObjects.Image;
  private pearl: Phaser.GameObjects.Image;
  /** die Perle in der Welt (hier gehen Licht und Ringe aus) */
  private px: number;
  private py: number;
  private prompt: Prompt;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** wann zuletzt ein Ring aus Licht von der Perle ausging (sie ruft, wenn ein Segen bereitliegt) */
  private callAt = 0;
  near = false;

  /** Das Bild der Muschel laden (in preload() der Szene). */
  static preload(scene: Phaser.Scene) {
    if (!scene.textures.exists('shrine_shell')) scene.load.image('shrine_shell', new URL('../assets/shrine/muschel.webp', import.meta.url).href);
  }

  constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number, touchMode: boolean) {
    this.px = x + (IMG.pearlX - 0.5) * WIDTH;
    this.py = y + SINK - (1 - IMG.pearlY) * HEIGHT;
    // Schatten, Lichtschacht von oben, die Muschel, in ihr die Perle mit ihrem Glühen
    scene.add.ellipse(x, y + 2, WIDTH * 0.95, 20, 0x000000, 0.3).setDepth(DEPTH.terrain + 0.4);
    this.ray = scene.add.image(x, y - 640, 'lightray').setOrigin(0.5, 0).setScale(1.6, 1.25).setTint(0xffe6c0)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDepth(DEPTH.plants - 0.3);
    // vor den Pflanzen (sie wachsen hinter ihr), auf dem Grund stehend
    scene.add.image(x, y + SINK, 'shrine_shell').setOrigin(0.5, 1).setScale(SCALE).setDepth(DEPTH.terrain + 0.5);
    this.glow = scene.add.image(this.px, this.py, 'glow').setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(120, 120).setAlpha(0.3).setDepth(DEPTH.pickups - 0.2);
    this.pearl = scene.add.image(this.px, this.py, 'glow').setTint(0xfff4e0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(34, 34).setAlpha(0.45).setDepth(DEPTH.pickups);
    scene.tweens.add({ targets: this.glow, alpha: 0.5, displayWidth: 150, displayHeight: 150, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: this.ray, alpha: 0.24, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Lichtfunken steigen von der Muschel auf
    this.motes = scene.add.particles(0, 0, 'p_dot', {
      x: { min: x - 50, max: x + 50 }, y: { min: y - 60, max: y - 10 }, lifespan: 5000, frequency: 260,
      speedY: { min: -18, max: -6 }, speedX: { min: -5, max: 5 }, scale: { min: 0.08, max: 0.2 },
      alpha: { start: 0, end: 0.7, ease: 'Sine.inOut' }, tint: 0xffe8c0, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.pickups + 0.1);
    this.prompt = new Prompt(scene, touchMode, 'talk');
  }

  /** Wo man steht, um zu beten (vor der Perle). */
  get at() {
    return { x: this.x, y: this.y - 50 };
  }

  update(dt: number, px: number, py: number, can: boolean, time: number) {
    this.near = can && Math.hypot(px - this.x, py - (this.y - 40)) < 150;
    // das Zeichen schwebt über der Muschel
    this.prompt.update(dt, this.x, this.y + SINK - HEIGHT - 14, this.near);
    // ein Segen liegt bereit: Die Perle ruft – alle paar Sekunden geht ein Ring aus Licht von ihr aus
    if (game.canUp() && time - this.callAt > 2600) {
      this.callAt = time;
      const ring = this.scene.add.circle(this.px, this.py, 12).setStrokeStyle(2, 0xffe2a8, 0.9).setDepth(DEPTH.pickups + 0.2);
      this.scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 1800, ease: 'Sine.out', onComplete: () => ring.destroy() });
    }
  }

  /** Beten: Licht strömt von der Perle in dein Tier (blessed: Die Muschel segnet; sonst schweigt sie nur kurz). */
  pray(tx: number, ty: number, blessed: boolean) {
    const sc = this.scene;
    sc.tweens.add({ targets: this.pearl, scale: blessed ? 2.2 : 1.5, duration: 500, yoyo: true, ease: 'Sine.inOut', repeat: blessed ? 2 : 0 });
    if (!blessed) return;
    sc.tweens.add({ targets: this.ray, alpha: 0.6, duration: 900, yoyo: true, hold: 1600, ease: 'Sine.inOut' });
    sc.tweens.add({ targets: this.glow, alpha: 1, duration: 700, yoyo: true, hold: 1800 });
    // ein Strom aus Lichtfunken von der Perle zum Tier
    const stream = sc.add.particles(this.px, this.py, 'p_dot', {
      lifespan: 900, frequency: 18, speed: { min: 30, max: 90 }, scale: { start: 0.35, end: 0.05 }, alpha: { start: 1, end: 0 },
      tint: [0xffe8b0, 0xfff6dc, 0xe0a848], blendMode: Phaser.BlendModes.ADD,
      moveToX: tx, moveToY: ty,
    }).setDepth(DEPTH.fx);
    sc.time.delayedCall(2600, () => stream.stop());
    sc.time.delayedCall(3800, () => stream.destroy());
    for (let i = 0; i < 3; i++) {
      sc.time.delayedCall(400 + i * 700, () => {
        const ring = sc.add.circle(this.px, this.py, 14).setStrokeStyle(3, 0xffe2a8, 1).setDepth(DEPTH.fx);
        sc.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 1500, ease: 'Sine.out', onComplete: () => ring.destroy() });
      });
    }
  }

  destroy() {
    this.prompt.destroy();
    this.motes.destroy();
  }
}
