import Phaser from 'phaser';
import { DEPTH } from '../config';
import { rgrad, tex, type Ctx } from '../util/canvas';
import { game } from '../state/GameState';
import { Prompt } from './Quest';

// ---------------------------------------------------------------------------
// Die große Muschel im Laichfluss: eine riesige Fächermuschel, aufrecht im Sand, davor eine Perle, die leise glüht. Wer genug
// Muscheln gesammelt hat (8, 16, 32, 64 …), betet hier – und sie segnet seine Linie mit mehr Ausdauer. Ist es so weit,
// ruft sie: Ringe aus Licht gehen von der Perle aus. Gebetet wird mit der Taste fürs Ansprechen (LevelScene.pray).
// ---------------------------------------------------------------------------

/** Maße der Muschel (Bildpunkte), Gelenk unten in der Mitte */
const S = { w: 240, h: 150, hx: 120, hy: 140, r: 124 };

function shellPath(ctx: Ctx, rr = 1) {
  const n = 15, a0 = Math.PI * 1.1, a1 = Math.PI * 1.9;
  ctx.beginPath();
  ctx.moveTo(S.hx, S.hy);
  for (let i = 0; i <= 240; i++) {
    const a = a0 + ((a1 - a0) * i) / 240;
    // der Rand ist gewellt: an jeder Rippe ein Bogen
    const k = Math.abs(Math.sin(((a - a0) / (a1 - a0)) * n * Math.PI));
    const r = S.r * rr * (0.95 + 0.05 * k);
    ctx.lineTo(S.hx + Math.cos(a) * r, S.hy + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Die Fächermuschel: perlmuttfarben, Rippen vom Gelenk zum gewellten Rand, Anwachsringe, ein Schimmer wie Perlmutt. */
function shrineTextures(scene: Phaser.Scene) {
  tex(scene, 'shrine_shell', S.w, S.h, (ctx) => {
    const n = 15, a0 = Math.PI * 1.1, a1 = Math.PI * 1.9;
    shellPath(ctx);
    ctx.fillStyle = rgrad(ctx, S.hx, S.hy, 0, S.r, [[0, '#fff6ea'], [0.45, '#f1d9c6'], [0.8, '#d8ab95'], [1, '#a9786a']]);
    ctx.fill();
    ctx.save();
    shellPath(ctx);
    ctx.clip();
    // Anwachsringe
    for (const rr of [0.28, 0.42, 0.56, 0.69, 0.8, 0.9]) {
      ctx.beginPath();
      ctx.arc(S.hx, S.hy, S.r * rr, a0, a1);
      ctx.strokeStyle = `rgba(110,62,48,${0.1 + rr * 0.06})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    // Rippen: eine dunkle Furche und daneben ein heller Grat
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      for (const [off, col, w] of [[0, 'rgba(100,54,44,0.42)', 2.4], [0.018, 'rgba(255,250,240,0.55)', 1.4]] as const) {
        ctx.beginPath();
        ctx.moveTo(S.hx + Math.cos(a + off) * 16, S.hy + Math.sin(a + off) * 16);
        ctx.lineTo(S.hx + Math.cos(a + off) * S.r, S.hy + Math.sin(a + off) * S.r);
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.stroke();
      }
    }
    // Perlmutt: ein kühler und ein warmer Schimmer
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgrad(ctx, S.hx - 50, S.hy - 100, 0, 90, [[0, 'rgba(150,230,225,0.32)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.fillStyle = rgrad(ctx, S.hx + 55, S.hy - 70, 0, 80, [[0, 'rgba(255,190,210,0.28)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.restore();
    // Rand
    shellPath(ctx);
    ctx.strokeStyle = 'rgba(96,52,40,0.8)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    shellPath(ctx, 0.975);
    ctx.strokeStyle = 'rgba(255,246,232,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // die Öhrchen am Gelenk
    ctx.fillStyle = '#c99c86';
    ctx.strokeStyle = 'rgba(96,52,40,0.8)';
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(S.hx, S.hy - 4);
      ctx.lineTo(S.hx + s * 34, S.hy - 16);
      ctx.lineTo(S.hx + s * 38, S.hy - 2);
      ctx.lineTo(S.hx, S.hy + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, 2);
  // die Perle: weiß, mit warmem Kern und einem Glanzpunkt
  tex(scene, 'shrine_pearl', 40, 40, (ctx) => {
    ctx.beginPath();
    ctx.arc(20, 20, 15, 0, Math.PI * 2);
    ctx.fillStyle = rgrad(ctx, 15, 14, 1, 19, [[0, '#ffffff'], [0.35, '#fff3dc'], [0.75, '#e8cfae'], [1, '#b8946e']]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, 13, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }, 2);
}

export class Shrine {
  private glow: Phaser.GameObjects.Image;
  private ray: Phaser.GameObjects.Image;
  private pearl: Phaser.GameObjects.Image;
  private prompt: Prompt;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** wann zuletzt ein Ring aus Licht von der Perle ausging (sie ruft, wenn ein Segen bereitliegt) */
  private callAt = 0;
  near = false;

  constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number, touchMode: boolean) {
    shrineTextures(scene);
    // Schatten, Lichtschacht von oben, die Muschel, davor die Perle mit ihrem Glühen
    scene.add.ellipse(x, y + 2, 230, 26, 0x000000, 0.28).setDepth(DEPTH.terrain + 0.4);
    this.ray = scene.add.image(x, y - 640, 'lightray').setOrigin(0.5, 0).setScale(1.6, 1.25).setTint(0xffe6c0)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDepth(DEPTH.plants - 0.3);
    // vor den Pflanzen (sie wachsen hinter ihr), auf dem Grund stehend
    scene.add.image(x, y + 4, 'shrine_shell').setOrigin(S.hx / S.w, S.hy / S.h).setScale(0.58).setDepth(DEPTH.terrain + 0.5);
    this.glow = scene.add.image(x, y - 12, 'glow').setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(150, 150).setAlpha(0.3).setDepth(DEPTH.pickups - 0.2);
    this.pearl = scene.add.image(x, y - 12, 'shrine_pearl').setScale(0.5).setDepth(DEPTH.pickups);
    scene.tweens.add({ targets: this.glow, alpha: 0.5, displayWidth: 180, displayHeight: 180, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: this.ray, alpha: 0.24, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Lichtfunken steigen von der Muschel auf
    this.motes = scene.add.particles(0, 0, 'p_dot', {
      x: { min: x - 70, max: x + 70 }, y: { min: y - 70, max: y - 10 }, lifespan: 5000, frequency: 260,
      speedY: { min: -18, max: -6 }, speedX: { min: -5, max: 5 }, scale: { min: 0.08, max: 0.2 },
      alpha: { start: 0, end: 0.7, ease: 'Sine.inOut' }, tint: 0xffe8c0, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.pickups + 0.1);
    this.prompt = new Prompt(scene, touchMode, 'talk');
  }

  /** Wo man steht, um zu beten (vor der Perle). */
  get at() {
    return { x: this.x, y: this.y - 60 };
  }

  update(dt: number, px: number, py: number, can: boolean, time: number) {
    this.near = can && Math.hypot(px - this.x, py - (this.y - 40)) < 150;
    // das Zeichen schwebt über der Muschel
    this.prompt.update(dt, this.x, this.y - 76, this.near);
    // ein Segen liegt bereit: Die Perle ruft – alle paar Sekunden geht ein Ring aus Licht von ihr aus
    if (game.canUp() && time - this.callAt > 2600) {
      this.callAt = time;
      const ring = this.scene.add.circle(this.x, this.y - 12, 14).setStrokeStyle(2, 0xffe2a8, 0.9).setDepth(DEPTH.pickups + 0.2);
      this.scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 1800, ease: 'Sine.out', onComplete: () => ring.destroy() });
    }
  }

  /** Beten: Licht strömt von der Perle in dein Tier (blessed: Die Muschel segnet; sonst schweigt sie nur kurz). */
  pray(tx: number, ty: number, blessed: boolean) {
    const sc = this.scene;
    sc.tweens.add({ targets: this.pearl, scale: blessed ? 0.85 : 0.6, duration: 500, yoyo: true, ease: 'Sine.inOut', repeat: blessed ? 2 : 0 });
    if (!blessed) return;
    sc.tweens.add({ targets: this.ray, alpha: 0.6, duration: 900, yoyo: true, hold: 1600, ease: 'Sine.inOut' });
    sc.tweens.add({ targets: this.glow, alpha: 1, duration: 700, yoyo: true, hold: 1800 });
    // ein Strom aus Lichtfunken von der Perle zum Tier
    const stream = sc.add.particles(this.x, this.y - 12, 'p_dot', {
      lifespan: 900, frequency: 18, speed: { min: 30, max: 90 }, scale: { start: 0.35, end: 0.05 }, alpha: { start: 1, end: 0 },
      tint: [0xffe8b0, 0xfff6dc, 0xe0a848], blendMode: Phaser.BlendModes.ADD,
      moveToX: tx, moveToY: ty,
    }).setDepth(DEPTH.fx);
    sc.time.delayedCall(2600, () => stream.stop());
    sc.time.delayedCall(3800, () => stream.destroy());
    for (let i = 0; i < 3; i++) {
      sc.time.delayedCall(400 + i * 700, () => {
        const ring = sc.add.circle(this.x, this.y - 12, 16).setStrokeStyle(3, 0xffe2a8, 1).setDepth(DEPTH.fx);
        sc.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 1500, ease: 'Sine.out', onComplete: () => ring.destroy() });
      });
    }
  }

  destroy() {
    this.prompt.destroy();
    this.motes.destroy();
  }
}
