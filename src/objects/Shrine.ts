import Phaser from 'phaser';
import { DEPTH } from '../config';
import { game } from '../state/GameState';
import { Prompt } from '../ui/InteractionPrompt';

// ---------------------------------------------------------------------------
// Die große Muschel im Laichfluss: eine riesige Fächermuschel (gezeichnetes Bild, assets/shrine/muschel.webp), aufrecht im
// Sand, in ihr eine Perle, die leise glüht. Jede neue Sammelmuschel eröffnet eine kurze Weisheit. Ist eine neue Weisheit bereit, ruft sie: Ringe aus Licht gehen von der Perle aus. Gebetet wird mit der
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
  /** die Perle in der Welt (hier gehen Licht und Ringe aus) */
  private px: number;
  private py: number;
  private prompt: Prompt;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** wann zuletzt ein Ring aus Licht von der Perle ausging (sie ruft, wenn eine neue Weisheit bereitliegt) */
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
    scene.add.image(this.px, this.py, 'glow').setTint(0xfff4e0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(34, 34).setAlpha(0.45).setDepth(DEPTH.pickups);
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

  /** Wo man steht, um zu lauschen (vor der Perle). */
  get at() {
    return { x: this.x, y: this.y - 50 };
  }

  update(dt: number, px: number, py: number, can: boolean, time: number) {
    this.near = can && Math.hypot(px - this.x, py - (this.y - 40)) < 150;
    // das Zeichen schwebt über der Muschel
    this.prompt.update(dt, this.x, this.y + SINK - HEIGHT - 14, this.near);
    // Eine neue Weisheit liegt bereit: Die Perle ruft – alle paar Sekunden geht ein Ring aus Licht von ihr aus
    if (game.unheardWisdom && time - this.callAt > 2600) {
      this.callAt = time;
      const ring = this.scene.add.circle(this.px, this.py, 12).setStrokeStyle(2, 0xffe2a8, 0.9).setDepth(DEPTH.pickups + 0.2);
      this.scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 1800, ease: 'Sine.out', onComplete: () => ring.destroy() });
    }
  }

  destroy() {
    this.prompt.destroy();
    this.motes.destroy();
  }
}
