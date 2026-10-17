import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { FONT, TITLE_FONT } from '../config';
import { mossPatch, slabTexture, tabletLayout } from '../art/tabletArt';
import { STATS, STAT_COUNT, type StatCtx } from '../data/tablet';
import { mulberry32 } from '../util/math';

export interface TabletOpts {
  /** klein: für die Karten bei der Wahl des Nachwuchses */
  mini?: boolean;
  /** Überschrift (nur groß) */
  heading?: string;
  /** so viele der zuletzt freigelegten Zeilen erscheinen neu (das Moos fällt ab) */
  fresh?: number;
}

/** Eingemeißelte Schrift: dunkel, mit heller Kante unten rechts. */
const INK = '#15120d';
const carved = (size: number, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color: INK,
  fontStyle: '700',
  shadow: { offsetX: 1, offsetY: 1, color: 'rgba(255,246,225,0.34)', blur: 0, fill: true },
  resolution: 2,
  ...extra,
});

/**
 * Kleine Zeichen vor den Zeilen – wenige Striche, eingemeißelt. Jedes steht für einen Wert.
 */
function glyph(g: Phaser.GameObjects.Graphics, id: string, x: number, y: number, s: number) {
  const draw = (ox: number, oy: number, col: number, a: number) => {
    g.lineStyle(1.8, col, a);
    const X = x + ox, Y = y + oy;
    g.beginPath();
    switch (id) {
      case 'need': // Tropfen
        g.moveTo(X, Y - s); g.lineTo(X + s * 0.7, Y + s * 0.2); g.lineTo(X, Y + s); g.lineTo(X - s * 0.7, Y + s * 0.2); g.closePath();
        break;
      case 'weight': // Gewichtsstein
        g.moveTo(X - s, Y + s * 0.8); g.lineTo(X - s * 0.55, Y - s * 0.5); g.lineTo(X + s * 0.55, Y - s * 0.5); g.lineTo(X + s, Y + s * 0.8); g.closePath();
        break;
      case 'temp': // Thermometer
        g.moveTo(X, Y - s); g.lineTo(X, Y + s * 0.3); g.moveTo(X + s * 0.55, Y + s * 0.55);
        g.arc(X, Y + s * 0.55, s * 0.55, 0, Math.PI * 2);
        break;
      case 'coat': // Tropfen mit Querstrichen (Färbung)
        g.moveTo(X, Y - s); g.lineTo(X + s * 0.8, Y + s * 0.4); g.lineTo(X, Y + s); g.lineTo(X - s * 0.8, Y + s * 0.4); g.closePath(); g.moveTo(X - s * 0.5, Y + s * 0.3); g.lineTo(X + s * 0.5, Y + s * 0.3);
        break;
      case 'jaw': // Zähne
        g.moveTo(X - s, Y - s * 0.4); g.lineTo(X - s * 0.5, Y + s * 0.6); g.lineTo(X, Y - s * 0.4); g.lineTo(X + s * 0.5, Y + s * 0.6); g.lineTo(X + s, Y - s * 0.4);
        break;
      case 'length': // Doppelpfeil
        g.moveTo(X - s, Y); g.lineTo(X + s, Y); g.moveTo(X - s * 0.5, Y - s * 0.5); g.lineTo(X - s, Y); g.lineTo(X - s * 0.5, Y + s * 0.5);
        g.moveTo(X + s * 0.5, Y - s * 0.5); g.lineTo(X + s, Y); g.lineTo(X + s * 0.5, Y + s * 0.5);
        break;
      case 'hp': // Kreuz
        g.moveTo(X, Y - s); g.lineTo(X, Y + s); g.moveTo(X - s, Y); g.lineTo(X + s, Y);
        break;
      case 'skull': // Schild
        g.moveTo(X - s * 0.8, Y - s * 0.8); g.lineTo(X + s * 0.8, Y - s * 0.8); g.lineTo(X + s * 0.8, Y + s * 0.1); g.lineTo(X, Y + s); g.lineTo(X - s * 0.8, Y + s * 0.1); g.closePath();
        break;
      case 'diet': // Blatt
        g.moveTo(X - s * 0.8, Y + s * 0.8); g.lineTo(X - s * 0.7, Y - s * 0.3); g.lineTo(X + s * 0.3, Y - s * 0.8); g.lineTo(X + s * 0.8, Y - s * 0.7); g.lineTo(X + s * 0.6, Y + s * 0.4); g.lineTo(X - s * 0.3, Y + s * 0.8); g.closePath();
        break;
      case 'stealth': // Auge
        g.moveTo(X - s, Y); g.lineTo(X, Y - s * 0.65); g.lineTo(X + s, Y); g.lineTo(X, Y + s * 0.65); g.closePath(); g.moveTo(X + s * 0.25, Y); g.arc(X, Y, s * 0.25, 0, Math.PI * 2);
        break;
      case 'growth': // Pfeile nach oben
        g.moveTo(X - s * 0.7, Y + s * 0.1); g.lineTo(X, Y - s * 0.6); g.lineTo(X + s * 0.7, Y + s * 0.1); g.moveTo(X - s * 0.7, Y + s * 0.8); g.lineTo(X, Y + s * 0.1); g.lineTo(X + s * 0.7, Y + s * 0.8);
        break;
      case 'swift': // zwei Pfeilspitzen nach rechts
        g.moveTo(X - s * 0.9, Y - s * 0.7); g.lineTo(X - s * 0.1, Y); g.lineTo(X - s * 0.9, Y + s * 0.7); g.moveTo(X + s * 0.1, Y - s * 0.7); g.lineTo(X + s * 0.9, Y); g.lineTo(X + s * 0.1, Y + s * 0.7);
        break;
      case 'limb': // Boden mit zwei Stützen
        g.moveTo(X - s, Y + s * 0.8); g.lineTo(X + s, Y + s * 0.8); g.moveTo(X - s * 0.6, Y + s * 0.8); g.lineTo(X - s * 0.2, Y - s * 0.4); g.moveTo(X + s * 0.6, Y + s * 0.8); g.lineTo(X + s * 0.2, Y - s * 0.4);
        break;
      case 'pack': // drei verbundene Punkte
        g.moveTo(X - s * 0.7, Y + s * 0.6); g.lineTo(X, Y - s * 0.7); g.lineTo(X + s * 0.7, Y + s * 0.6); g.closePath();
        break;
      default: // Blitz (Nerven)
        g.moveTo(X + s * 0.3, Y - s); g.lineTo(X - s * 0.5, Y + s * 0.1); g.lineTo(X + s * 0.3, Y + s * 0.1); g.lineTo(X - s * 0.3, Y + s);
    }
    g.strokePath();
  };
  draw(1, 1, 0xfff6e1, 0.28);
  draw(0, 0, 0x120f0b, 0.8);
}

interface RowBox {
  x0: number;
  x1: number;
  yT: number;
  yB: number;
  /** leichte Schräge der Ober- und Unterkante (links, rechts) */
  tilt: [number, number];
  cut: number;
}

/**
 * Die Steintafel: Eine Zeile je Wert auf einer eigenen, leicht versetzten Platte im Stein, anfangs
 * unter Moos. Wie viele Zeilen frei sind, bestimmen die Muscheln. Fähigkeiten werden in bis zu drei
 * Fischen gewertet.
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
    const k = w / 560;
    const seed = mini ? 3 : 5;
    this.add(scene.add.image(0, 0, slabTexture(scene, w, h, seed)).setOrigin(0, 0));

    const lay = tabletLayout(w, h, mini);
    const { top, rowH, padX } = lay;
    const rnd = mulberry32(seed * 7 + 1);
    const fs = mini ? 11.5 : 20;

    if (o.heading && !mini) {
      this.add(scene.add.text(w / 2, h * 0.2, o.heading, { fontFamily: TITLE_FONT, fontSize: '24px', color: INK, fontStyle: '700', shadow: { offsetX: 1, offsetY: 1, color: 'rgba(255,246,225,0.34)', blur: 0, fill: true }, resolution: 2 }).setOrigin(0.5));
    }

    // Die Platten der Zeilen: jede etwas anders breit und leicht schief – wie von Hand gehauen
    const boxes: RowBox[] = [];
    for (let i = 0; i < STAT_COUNT; i++) {
      const j = (n: number) => (rnd() - 0.5) * n;
      boxes.push({
        x0: padX + j(mini ? 3 : 14) * (rnd() < 0.5 ? 1 : 0.4),
        x1: w - padX + j(mini ? 3 : 16) * (rnd() < 0.5 ? 1 : 0.4),
        yT: top + rowH * i + rowH * 0.06,
        yB: top + rowH * (i + 1) - rowH * 0.06,
        tilt: [j(mini ? 1 : 2.2), j(mini ? 1 : 2.2)],
        cut: (mini ? 2 : 6) * (0.5 + rnd()),
      });
    }
    const plates = scene.add.graphics();
    this.add(plates);
    boxes.forEach((b, i) => {
      const pts = [
        [b.x0 + b.cut, b.yT + b.tilt[0]], [b.x1, b.yT + b.tilt[1]], [b.x1, b.yB + b.tilt[1] - b.cut], [b.x1 - b.cut, b.yB + b.tilt[1]],
        [b.x0, b.yB + b.tilt[0]], [b.x0, b.yT + b.tilt[0] + b.cut],
      ];
      const path = (dx = 0, dy = 0) => {
        plates.beginPath();
        pts.forEach(([px, py], n) => (n ? plates.lineTo(px + dx, py + dy) : plates.moveTo(px + dx, py + dy)));
        plates.closePath();
      };
      path();
      plates.fillStyle(i < unlocked ? 0xe6dfc6 : 0x000000, i < unlocked ? 0.1 : 0.2);
      plates.fillPath();
      // eingetieft: oben dunkel, unten hell
      plates.lineStyle(mini ? 1 : 1.6, 0x0f0d0a, 0.55);
      plates.beginPath();
      plates.moveTo(pts[5][0], pts[5][1]);
      plates.lineTo(pts[0][0], pts[0][1]);
      plates.lineTo(pts[1][0], pts[1][1]);
      plates.strokePath();
      plates.lineStyle(mini ? 1 : 1.4, 0xfff6e1, 0.2);
      plates.beginPath();
      plates.moveTo(pts[2][0], pts[2][1] + 1);
      plates.lineTo(pts[3][0], pts[3][1] + 1);
      plates.lineTo(pts[4][0], pts[4][1] + 1);
      plates.strokePath();
    });

    const label = (str: string, lx: number, ly: number, size = fs) => scene.add.text(lx, ly, str, carved(size)).setOrigin(0, 0.5);
    const marks = scene.add.graphics();
    this.add(marks);

    STATS.forEach((st, i) => {
      if (i >= unlocked || !ctx) return;
      const b = boxes[i];
      const cy = (b.yT + b.yB) / 2 + (b.tilt[0] + b.tilt[1]) / 4;
      const left = b.x0 + (mini ? 5 : 12);
      if (!mini) glyph(marks, st.id, left + 8, cy, 7);
      this.add(label(st.label(ctx), left + (mini ? 0 : 26), cy));
      const v = st.value(ctx);
      const right = b.x1 - (mini ? 5 : 12);
      if (v.t === 'fish') {
        const fw = mini ? 14 : 26, fh = fw * (24 / 36), gap = mini ? 2 : 4;
        for (let n = 0; n < 3; n++) this.add(scene.add.image(right - (2 - n) * (fw + gap) - fw / 2, cy, n < v.n ? 'fish_on' : 'fish_off').setDisplaySize(fw, fh));
      } else if (v.t === 'text') {
        this.add(label(v.v, right, cy).setOrigin(1, 0.5));
      } else {
        const t = label(v.v, right, cy).setOrigin(1, 0.5);
        this.add(t);
        if (v.f !== undefined) {
          const bw = mini ? 40 : 110, bh = mini ? 5 : 9;
          const bx = right - t.width - (mini ? 8 : 16) - bw;
          marks.fillStyle(0x0f0d0a, 0.6);
          marks.fillRect(bx - 2, cy - bh / 2 - 2, bw + 4, bh + 4);
          const f = Math.max(0, Math.min(1, v.f));
          marks.fillStyle(v.low ? 0xa5402a : 0xc9a04a, 1);
          marks.fillRect(bx, cy - bh / 2, bw * f, bh);
          marks.lineStyle(1, 0xfff6e1, 0.2);
          marks.strokeRect(bx - 2, cy - bh / 2 - 2, bw + 4, bh + 4);
        }
      }
    });

    // Moos über allen Zeilen, die noch nicht frei sind (die neu freigelegten fallen gleich ab)
    const fresh = Math.max(0, Math.min(o.fresh ?? 0, unlocked));
    for (let i = unlocked - fresh; i < STAT_COUNT; i++) {
      const b = boxes[i];
      // Das Moos wächst von den Seiten her: mal von links, mal von rechts, nicht immer bis zum Ende
      const full = b.x1 - b.x0 + (mini ? 4 : 8);
      const li = rnd() < 0.5 ? rnd() * full * 0.18 : 0, ri = rnd() < 0.5 ? rnd() * full * 0.18 : 0;
      const mw = full - li - ri, mh = b.yB - b.yT;
      const m = mossPatch(scene, mw, mh, i * 3 + 1);
      const img = scene.add.image(b.x0 - (mini ? 2 : 4) + li - m.padX, b.yT - m.padTop, m.key).setOrigin(0, 0).setDisplaySize(m.cw, m.ch);
      this.add(img);
      this.moss.push({ img, fresh: i < unlocked });
    }
    void k;
    scene.add.existing(this);
  }

  /** Das Moos der neuen Zeilen löst sich, eine Zeile nach der anderen. */
  reveal(delay = 500) {
    const fresh = this.moss.filter((m) => m.fresh);
    fresh.forEach((m, n) => {
      this.scene.time.delayedCall(delay + n * 650, () => {
        if (!this.scene || !this.active) return;
        audio.sfx('moss');
        const y0 = m.img.y;
        this.scene.tweens.add({ targets: m.img, y: y0 + 8, alpha: 0, scaleY: m.img.scaleY * 0.4, duration: 900, ease: 'Sine.in', onComplete: () => m.img.destroy() });
        // ein paar Moosflocken fallen herab
        const wx = this.x + this.tw / 2, wy = this.y + m.img.y;
        const em = this.scene.add.particles(0, 0, 'p_dot', {
          x: { min: wx - this.tw * 0.38, max: wx + this.tw * 0.38 }, y: wy, lifespan: 900, speedY: { min: 20, max: 90 }, speedX: { min: -16, max: 16 },
          scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.9, end: 0 }, tint: [0x3d562a, 0x62833a, 0x25361d], emitting: false,
        }).setDepth(200);
        em.explode(12);
        this.scene.time.delayedCall(1200, () => em.destroy());
      });
    });
    return fresh.length * 650 + delay + 900;
  }
}
