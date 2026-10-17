import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { FONT, TITLE_FONT } from '../config';
import { mossPatch, slabTexture } from '../art/tabletArt';
import { STATS, STAT_COUNT, type StatCtx } from '../data/tablet';

export interface TabletOpts {
  /** klein: für die Karten bei der Wahl des Nachwuchses */
  mini?: boolean;
  /** Überschrift (nur groß) */
  heading?: string;
  /** so viele der zuletzt freigelegten Zeilen erscheinen neu (das Moos fällt ab) */
  fresh?: number;
}

const GOLD = '#ecdca8';
const INK = '#16130e';

/**
 * Die Steintafel: Eine Zeile je Wert, anfangs unter Moos. Wie viele Zeilen frei sind, bestimmen die
 * Muscheln. Fähigkeiten werden in bis zu drei Fischen gewertet.
 */
export class Tablet extends Phaser.GameObjects.Container {
  readonly tw: number;
  readonly th: number;
  private moss: { img: Phaser.GameObjects.Image; fresh: boolean }[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, ctx: StatCtx | null, unlocked: number, o: TabletOpts = {}) {
    super(scene, x, y);
    this.tw = w;
    this.th = h;
    const mini = !!o.mini;
    const key = slabTexture(scene, w, h, mini ? 3 : 5);
    this.add(scene.add.image(0, 0, key).setOrigin(0, 0));

    // Aufteilung: oben die Überschrift (nur groß), dann eine Zeile je Wert
    const padX = mini ? 13 : 38;
    const top = mini ? 11 : o.heading ? 96 : 52;
    const bottom = mini ? 11 : 40;
    const rowH = (h - top - bottom) / STAT_COUNT;
    const fs = mini ? 11.5 : 21;

    if (o.heading && !mini) {
      const t = scene.add.text(w / 2, 52, o.heading, {
        fontFamily: TITLE_FONT, fontSize: '26px', color: GOLD, fontStyle: '700', stroke: INK, strokeThickness: 4, resolution: 2,
      }).setOrigin(0.5);
      this.add(t);
      const g = scene.add.graphics();
      g.lineStyle(2, 0x0a0908, 0.8);
      g.lineBetween(padX, 84, w - padX, 84);
      g.lineStyle(1.5, 0xfff8e1, 0.16);
      g.lineBetween(padX, 86, w - padX, 86);
      this.add(g);
    }

    const rows = scene.add.graphics();
    this.add(rows);
    const label = (str: string, lx: number, ly: number) =>
      scene.add.text(lx, ly, str, { fontFamily: FONT, fontSize: `${fs}px`, color: GOLD, fontStyle: '700', stroke: INK, strokeThickness: mini ? 2 : 3.2, resolution: 2 }).setOrigin(0, 0.5);

    STATS.forEach((st, i) => {
      const cy = top + rowH * (i + 0.5);
      // Trennlinie (eingeritzt)
      if (i) {
        rows.lineStyle(1, 0x0a0908, 0.55);
        rows.lineBetween(padX, top + rowH * i, w - padX, top + rowH * i);
        rows.lineStyle(1, 0xfff8e1, 0.1);
        rows.lineBetween(padX, top + rowH * i + 1, w - padX, top + rowH * i + 1);
      }
      if (i >= unlocked || !ctx) return;
      this.add(label(st.label(ctx), padX, cy));
      const v = st.value(ctx);
      const right = w - padX;
      if (v.t === 'fish') {
        const fw = mini ? 14 : 26, fh = fw * (24 / 36), gap = mini ? 2 : 4;
        for (let k = 0; k < 3; k++) {
          const img = scene.add.image(right - (2 - k) * (fw + gap) - fw / 2, cy, k < v.n ? 'fish_on' : 'fish_off').setDisplaySize(fw, fh);
          this.add(img);
        }
      } else if (v.t === 'text') {
        this.add(label(v.v, right, cy).setOrigin(1, 0.5));
      } else {
        const t = label(v.v, right, cy).setOrigin(1, 0.5);
        this.add(t);
        if (v.f !== undefined) {
          const bw = mini ? 40 : 120, bh = mini ? 5 : 10;
          const bx = right - t.width - (mini ? 8 : 16) - bw;
          rows.fillStyle(0x0a0908, 0.75);
          rows.fillRoundedRect(bx - 2, cy - bh / 2 - 2, bw + 4, bh + 4, 3);
          const f = Math.max(0, Math.min(1, v.f));
          rows.fillStyle(v.low ? 0xb03a24 : f < 0.45 ? 0xc08a30 : 0xd9b867, 1);
          rows.fillRoundedRect(bx, cy - bh / 2, bw * f, bh, 2);
          rows.fillStyle(0xffffff, 0.2);
          rows.fillRect(bx, cy - bh / 2, bw * f, Math.max(1, bh * 0.3));
        }
      }
    });

    // Moos über allen Zeilen, die noch nicht frei sind (die neu freigelegten fallen gleich ab)
    const fresh = Math.max(0, Math.min(o.fresh ?? 0, unlocked));
    for (let i = unlocked - fresh; i < STAT_COUNT; i++) {
      const cy = top + rowH * (i + 0.5);
      const m = mossPatch(scene, w - padX * 2 + (mini ? 8 : 14), rowH + (mini ? 1 : 2), i + 1);
      const img = scene.add.image(w / 2, cy, m.key).setDisplaySize(w - padX * 2 + (mini ? 8 : 14) + m.pad * 2, rowH + (mini ? 1 : 2) + m.pad * 2);
      this.add(img);
      this.moss.push({ img, fresh: i < unlocked });
    }
    scene.add.existing(this);
  }

  /** Das Moos der neuen Zeilen löst sich, eine Zeile nach der anderen. */
  reveal(delay = 500) {
    const fresh = this.moss.filter((m) => m.fresh);
    fresh.forEach((m, k) => {
      this.scene.time.delayedCall(delay + k * 650, () => {
        if (!this.scene || !this.active) return;
        audio.sfx('moss');
        const y0 = m.img.y;
        this.scene.tweens.add({ targets: m.img, y: y0 - 10, alpha: 0, scaleY: m.img.scaleY * 0.5, duration: 900, ease: 'Sine.in', onComplete: () => m.img.destroy() });
        // Moosflocken fallen herab
        const wx = this.x + this.tw / 2, wy = this.y + m.img.y;
        const em = this.scene.add.particles(0, 0, 'p_dot', {
          x: { min: wx - this.tw * 0.4, max: wx + this.tw * 0.4 }, y: wy, lifespan: 900, speedY: { min: 20, max: 90 }, speedX: { min: -20, max: 20 },
          scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 }, tint: [0x4a6a2a, 0x6f8f3c, 0x2c4020], emitting: false,
        }).setDepth(200);
        em.explode(18);
        this.scene.time.delayedCall(1200, () => em.destroy());
      });
    });
    return fresh.length * 650 + delay + 900;
  }
}
