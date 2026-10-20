import Phaser from 'phaser';
import { DEPTH } from '../config';
import { tex } from '../util/canvas';
import { mulberry32 } from '../util/math';

// Das Gelege im Brutsumpf (Karbon): ein Hügel aus glasigen Eiern am Grund. Je weniger Eier noch da sind, desto kleiner wird
// er – Räuber, die daran fressen, lassen ihn wackeln und Eier davontreiben.

/** so viele Eier zeigt das volle Nest (das Bild steht für alle) */
const DRAWN = 42;
/** in so vielen Stufen schrumpft das Bild */
const STEPS = 10;

/** Ein Bild des Nests mit n gezeichneten Eiern (immer dieselben Plätze – es werden nur weniger). */
function nestTexture(scene: Phaser.Scene, step: number) {
  const key = `nest_${step}`;
  if (scene.textures.exists(key)) return key;
  const W = 150, H = 70;
  tex(scene, key, W, H, (ctx) => {
    const r = mulberry32(4711);
    const spots: [number, number, number][] = [];
    for (let i = 0; i < DRAWN; i++) {
      // ein flacher Hügel: unten breit, oben schmal
      const row = Math.floor(Math.sqrt(i * 1.6));
      const x = W / 2 + (r() - 0.5) * (W * 0.82 - row * 16);
      const y = H - 10 - row * 7 - r() * 4;
      spots.push([x, y, 5.2 + r() * 2.2]);
    }
    const n = Math.round((DRAWN * step) / STEPS);
    // Schleim, der die Eier zusammenhält
    if (n > 0) {
      ctx.fillStyle = 'rgba(160,190,120,0.18)';
      ctx.beginPath();
      ctx.ellipse(W / 2, H - 12, W * 0.42 * Math.sqrt(step / STEPS) + 6, 14 + 10 * (step / STEPS), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // von hinten nach vorn zeichnen (die oberen zuerst)
    const shown = spots.slice(0, n).sort((a, b) => a[1] - b[1]);
    for (const [x, y, rad] of shown) {
      const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad);
      g.addColorStop(0, 'rgba(250,244,210,0.95)');
      g.addColorStop(0.55, 'rgba(214,196,120,0.82)');
      g.addColorStop(1, 'rgba(120,110,60,0.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,36,18,0.55)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // der Keim: ein dunkler, gekrümmter Fleck
      ctx.fillStyle = 'rgba(30,26,16,0.85)';
      ctx.beginPath();
      ctx.arc(x + rad * 0.12, y + rad * 0.1, rad * 0.32, 0.4, Math.PI * 1.7);
      ctx.fill();
    }
  });
  return key;
}

export class Nest {
  readonly img: Phaser.GameObjects.Image;
  private step = -1;
  private glow: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number) {
    this.img = scene.add.image(x, y + 6, nestTexture(scene, STEPS)).setOrigin(0.5, 1).setDepth(DEPTH.plants + 1);
    // ein schwaches Leuchten, damit man das Nest auch im trüben Wasser findet
    this.glow = scene.add.image(x, y - 14, 'glow').setScale(1.6, 0.9).setTint(0xf0e0a0).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.plants);
    scene.tweens.add({ targets: this.glow, alpha: 0.1, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.inOut' });
  }

  /** Den Stand zeigen: so viele Eier liegen noch im Nest (von laid). */
  show(eggs: number, laid: number) {
    const step = eggs <= 0 ? 0 : Math.max(1, Math.ceil((eggs / Math.max(1, laid)) * STEPS));
    if (step === this.step) return;
    this.step = step;
    this.img.setTexture(nestTexture(this.scene, step));
    this.glow.setVisible(step > 0);
  }

  /** Ein Räuber frisst daran: Das Nest wackelt. */
  hit() {
    this.scene.tweens.add({ targets: this.img, scaleX: 1.12, scaleY: 0.86, duration: 70, yoyo: true, repeat: 1 });
  }
}
