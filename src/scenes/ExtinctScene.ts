import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { EPOCHS, yearsAgo } from '../data/epochs';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { fadeIn, fadeTo, text } from '../ui/ui';
import { clamp } from '../util/math';
import { tex } from '../util/canvas';

/**
 * Koop: Die gemeinsame Art ist ausgestorben – jemand starb, und es lag kein Laich mehr da. Das erfahren alle Spieler der Art
 * zugleich, auch wer noch lebte. Ein ruhiger, dunkler Abschied: der letzte Laich als leere Hüllen, das eigene Tier sinkt
 * hinab, Schnee fällt durchs Wasser. Danach der Stammbaum (dort zerfällt der Strang der Linie).
 */
export interface ExtinctData {
  epoch: number;
  years: number;
  cause: string;
  /** die Generation, in der die Art endete */
  gen: number;
  /** wer zuletzt starb (leer: du selbst) */
  by: string;
  /** die Artgenossen, mit denen man lebte */
  names: string[];
  leaf: string;
  morph: Morph;
}

/** Die Linie endet mit der Art: im Stammbaum ein Astende – und die Daten für den Abschied. */
export function speciesEnd(epoch: number, years: number, by: string, names: string[], morph: Morph): ExtinctData {
  const ep = EPOCHS[epoch];
  const frac = clamp((ep.from - years) / (ep.from - ep.to), 0, 1);
  const gen = game.poolGen;
  const cause = 'Zu wenige Artgenossen';
  const leaf = game.extinct(frac, cause);
  return { epoch, years, cause, gen, by, names, leaf, morph };
}

/** Eine leere Eihülle: ein dünner, gebrochener Ring, innen nichts mehr. */
function shellTexture(scene: Phaser.Scene) {
  return tex(scene, 'roe_empty', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(26, 24, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(200,196,180,0.10)');
    g.addColorStop(1, 'rgba(60,58,52,0.25)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,184,166,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(32, 32, 27, -0.4, Math.PI * 1.55);
    ctx.stroke();
    // der Riss
    ctx.beginPath();
    ctx.moveTo(52, 17);
    ctx.lineTo(45, 24);
    ctx.lineTo(49, 28);
    ctx.lineTo(41, 33);
    ctx.stroke();
  });
}

export class ExtinctScene extends Phaser.Scene {
  private d!: ExtinctData;
  private going = false;
  private fish?: CreatureView;

  constructor() {
    super('Extinct');
  }

  init(d: ExtinctData) {
    this.d = d;
    this.going = false;
  }

  create() {
    const d = this.d;
    fadeIn(this, 1400);
    this.cameras.main.setBackgroundColor('#020304');
    audio.music(null);
    audio.sfx('extinct');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1418, 0x0a1418, 0x010102, 0x010102, 1);
    bg.fillRect(0, 0, W, H);
    // Meeresschnee: Er fällt langsam, nichts steigt mehr auf
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: -10, lifespan: 14000, frequency: 90,
      scale: { min: 0.1, max: 0.35 }, alpha: { start: 0.45, end: 0 }, speedY: { min: 18, max: 46 }, speedX: { min: -6, max: 6 }, tint: [0xc8d0d0, 0x9aa4a4],
    });

    // der letzte Laich: leere Hüllen, eine nach der anderen erlischt
    shellTexture(this);
    const spots: [number, number][] = [[0, 0], [-34, 8], [34, 6], [-17, -24], [17, -26], [-50, -16], [50, -18]];
    spots.forEach(([dx, dy], i) => {
      const img = this.add.image(W / 2 + dx, 286 + dy, 'roe_empty').setScale(0.6).setAlpha(0);
      const glow = this.add.image(img.x, img.y, 'glow').setTint(0xf0e0b0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(60, 60).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 0.9, duration: 700, delay: 600 + i * 140 });
      this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0 }, duration: 1600, delay: 900 + i * 260, ease: 'Sine.in' });
    });

    // dein Tier, entfärbt, auf dem Rücken – es sinkt (etwa gleich groß im Bild, ob Jungtier oder Riese)
    const scale = 1.5 * Math.min(2.6, Math.max(0.8, 1 / Math.max(0.1, d.morph.size)));
    const v = new CreatureView(this, W / 2, 150, { ...d.morph, belly: 0 }, scale);
    v.setAngle(180).setAlpha(0);
    v.flash(0x7a7068);
    this.fish = v;
    this.tweens.add({ targets: v, alpha: 0.85, duration: 1600 });
    this.tweens.add({ targets: v, y: 196, duration: 12000, ease: 'Sine.inOut' });
    // ein schwaches, rötliches Glimmen hinter der Schrift
    this.add.image(W / 2, 410, 'glow').setTint(0x7a1e16).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(900, 200).setAlpha(0.18);

    const ep = EPOCHS[d.epoch];
    const head = this.add.text(W / 2, 400, 'DIE ART IST AUSGESTORBEN', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#c8473a', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(10).setAlpha(0);
    const line = this.add.rectangle(W / 2, 440, 340, 1, 0xa4322a, 1).setAlpha(0);
    const why = text(this, W / 2, 470, 'Zu wenige Artgenossen.', 24, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    const who = d.by ? `${d.by} starb` : 'Du starbst';
    const body = text(this, W / 2, 512, `${who} – und es lag kein Laich mehr da, aus dem ein Nachkomme hätte schlüpfen können.`, 18, UI.boneDim, { align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5).setAlpha(0);
    const all = [...new Set([...(d.names ?? [])])].filter(Boolean);
    const last = text(this, W / 2, 566, all.length ? `Die Letzten ihrer Art: Du · ${all.join(' · ')}` : 'Du warst der Letzte deiner Art.', 16, '#8c826e').setOrigin(0.5).setAlpha(0);
    const when = text(this, W / 2, 600, `${ep.name} · Generation ${d.gen} · ${yearsAgo(d.years, 1)}`, 15, '#6c6454').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: head, alpha: 1, duration: 1600, delay: 1200 });
    this.tweens.add({ targets: line, alpha: 0.6, scaleX: { from: 0.1, to: 1 }, duration: 1600, delay: 1500, ease: 'Sine.out' });
    this.tweens.add({ targets: why, alpha: 1, duration: 1200, delay: 2300 });
    this.tweens.add({ targets: body, alpha: 0.9, duration: 1200, delay: 3000 });
    this.tweens.add({ targets: [last, when], alpha: 1, duration: 1200, delay: 3700 });
    const hint = text(this, W / 2, H - 34, 'Eine Taste – weiter zum Stammbaum', 14, '#6c6454').setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.8, duration: 900, delay: 5200 });
    this.time.delayedCall(4200, () => {
      this.input.keyboard?.once('keydown', () => this.next());
      this.input.once('pointerdown', () => this.next());
    });
    this.time.delayedCall(16000, () => this.next());
  }

  update(_t: number, delta: number) {
    this.fish?.animate(delta / 1000, 'idle', 0.05);
  }

  private next() {
    if (this.going) return;
    this.going = true;
    const d = this.d;
    fadeTo(this, 'Tree', { mode: 'extinct', leaf: d.leaf, morph: d.morph, epoch: d.epoch, cause: d.cause, years: d.years, quiet: true }, 1400);
  }
}
