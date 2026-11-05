import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { CLASSES } from '../data/classes';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { dietIcon } from '../art/speciesArt';
import { phases } from '../sim/life';
import { BROOD } from '../data/karbon';
import { clamp } from '../util/math';
import { text, title } from './ui';
import { collectionStar } from './collectionPanel';

export interface OverviewData {
  morph: Morph;
  /** Lebenskraft gerade und höchstens */
  hp: number;
  hpMax: number;
}

const nf = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });

/** Der Rahmen: dunkel und warm, doppelte feine Linie, kleine Rauten in den Ecken. */
function frame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(x + 4, y + 8, w, h, 8);
  g.fillGradientStyle(0x1b1712, 0x1b1712, 0x0b0a08, 0x0b0a08, 0.96);
  g.fillRect(x, y, w, h);
  g.lineStyle(1.5, 0xc8913c, 0.5);
  g.strokeRect(x + 9.5, y + 9.5, w - 19, h - 19);
  g.lineStyle(1, 0xc8913c, 0.2);
  g.strokeRect(x + 15.5, y + 15.5, w - 31, h - 31);
  for (const [cx, cy] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) diamond(g, cx, cy, 5);
}

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, a = 0.85) {
  const rhomb = (s: number) => {
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s, y);
    g.lineTo(x, y + s);
    g.lineTo(x - s, y);
    g.closePath();
    g.fillPath();
  };
  g.fillStyle(0x0d0b09, 1);
  rhomb(r + 1.5);
  g.fillStyle(0xc8913c, a);
  rhomb(r);
}

/** Eine feine Trennlinie über die ganze Breite, in der Mitte eine kleine Raute. */
function rule(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, a = 0.35) {
  const cx = (x0 + x1) / 2;
  g.lineStyle(1, 0xc8913c, a);
  g.lineBetween(x0, y, cx - 14, y);
  g.lineBetween(cx + 14, y, x1, y);
  diamond(g, cx, y, 4, 0.7);
}

/**
 * Die Übersicht (Taste C): Name und Lebensweg, darunter die Fähigkeiten und das Tier. Rechts bleibt Raum für den
 * Sammlungsstern selbst. Körperbau sieht man am Tier, Nachwuchs am Laich; Beute zeigt nur Nahrung und ihre Anteile.
 */
export class Overview {
  readonly c: Phaser.GameObjects.Container;
  private portrait: CreatureView;

  constructor(scene: Phaser.Scene, d: OverviewData, onClose: () => void) {
    const c = (this.c = scene.add.container(0, 0).setDepth(60).setName('overview'));
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerdown', onClose));

    const x0 = 24, y0 = 18, w = W - 48, h = H - 36;
    const g = scene.add.graphics();
    frame(g, x0, y0, w, h);
    c.add(g);
    // Nur außerhalb der gemeinsamen Fläche schließt ein Klick die Übersicht.
    c.add(scene.add.zone(x0, y0, w, h).setOrigin(0).setInteractive());

    const life = game.life, brood = game.brood;
    c.add(text(scene, W / 2, 44, `${CLASSES[game.cls].name} · ${game.epoch.name} · Generation ${brood?.gen ?? life.gen}`, 15, UI.boneDim).setOrigin(0.5));
    const name = title(scene, W / 2, 79, game.currentName, 32).setOrigin(0.5).setName('overview-name');
    name.setScale(Math.min(1, (w - 120) / name.width));
    c.add(name);
    // Der Lebensweg gehört direkt zum Namen, ohne zweite Zustandsbeschreibung.
    if (brood) this.broodline(scene, g, 100, 129, W - 200);
    else this.lifeline(scene, g, 100, 129, W - 200);
    rule(g, 72, W - 72, 181, 0.25);

    const caps = (x: number, y: number, str: string, size = 13, col = UI.ochre) =>
      scene.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: col, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(3);

    // Links: die drei Hauptwerte, darunter Waffen und Schutz.
    const left = 76, leftW = 608, mid = left + leftW / 2;
    const v = game.shown();
    const big: { label: string; value: string; of?: string }[] = [
      { label: 'VITALITY', value: String(Math.max(0, Math.ceil(d.hp))), of: `/${d.hpMax}` },
      brood ? { label: 'OXYGEN', value: String(v.oxy), of: ' s' } : { label: 'VISION', value: String(v.sight) },
      { label: 'STAMINA', value: String(v.stam) },
    ];
    big.forEach((b, i) => {
      const cx = left + leftW / 3 * (i + 0.5);
      c.add(caps(cx, 214, b.label, 12));
      const val = title(scene, cx, 250, b.value, 40).setOrigin(0.5);
      c.add(val);
      if (b.of) {
        const of = title(scene, 0, 256, b.of, 23, UI.boneDim).setOrigin(0, 0.5);
        const tw = val.width + 4 + of.width;
        val.setX(cx - tw / 2 + val.width / 2);
        of.setX(val.x + val.width / 2 + 4);
        c.add(of);
      }
      if (i > 0) diamond(g, left + leftW / 3 * i, 244, 3, 0.35);
    });

    const by = 294;
    g.fillStyle(0x000000, 0.25);
    g.fillRect(left + 12, by - 6, leftW - 24, 66);
    g.lineStyle(1, 0xc8913c, 0.28);
    g.lineBetween(left + 12, by - 6, left + leftW - 12, by - 6);
    g.lineBetween(left + 12, by + 60, left + leftW - 12, by + 60);
    // Im Karbon formen sich Beine und Griff statt Schädel und Flossen.
    const small = brood
      ? [
          { label: 'JAWS', key: 'bite', value: v.bite },
          { label: 'LEGS', key: 'legs', value: v.legs },
          { label: 'GRIP', key: 'grip', value: v.grip },
          { label: 'SCALES', key: 'scales', value: v.scales },
        ] as const
      : [
          { label: 'JAWS', key: 'bite', value: v.bite },
          { label: 'SKULL', key: 'skull', value: v.skull },
          { label: 'FINS', key: 'fins', value: v.fins },
          { label: 'SCALES', key: 'scales', value: v.scales },
        ] as const;
    const delta = game.inheritedDelta(), step = (leftW - 24) / small.length;
    small.forEach((b, i) => {
      const cx = left + 12 + step * (i + 0.5);
      c.add(caps(cx, by + 14, b.label, 11, UI.boneDim));
      const val = title(scene, cx, by + 40, String(b.value), 26).setOrigin(0.5);
      c.add(val);
      const dv = delta ? delta[b.key] ?? 0 : 0;
      if (dv !== 0) {
        const up = dv > 0;
        const tag = text(scene, cx + val.width / 2 + 8, by + 42, up ? `▲ ${dv}` : `▼ ${-dv}`, 13, up ? '#9cd07e' : '#e08872', { fontStyle: '700' }).setOrigin(0, 0.5);
        c.add(tag);
        const glow = scene.add.image(tag.x + tag.width / 2, tag.y, 'glow').setTint(up ? 0x7cc860 : 0xe06a50).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(tag.width + 26, 22).setAlpha(0.14);
        c.addAt(glow, c.getIndex(tag));
      }
      if (i > 0) {
        g.lineStyle(1, 0xc8913c, 0.18);
        g.lineBetween(cx - step / 2, by + 6, cx - step / 2, by + 48);
      }
    });

    // Das Tier spricht für seinen Körperbau und seine Färbung.
    const py = 450, scale = 3 * clamp(1 / Math.max(0.1, d.morph.size), 0.6, 2.8);
    c.add(scene.add.image(mid, py + 77, 'shadow').setDisplaySize(350, 22).setAlpha(0.35));
    this.portrait = new CreatureView(scene, mid, py, { ...d.morph, belly: 1 }, scale).setName('overview-portrait');
    this.portrait.setFacing(1);
    // Auch lange Fische und Vierfüßer passen in dieselbe freie Bühne zwischen Werten und Beute.
    this.update(0);
    const bounds = this.portrait.getBounds();
    const fit = Math.min(1, (leftW - 64) / Math.max(1, bounds.width), 176 / Math.max(1, bounds.height));
    this.portrait.setBaseScale(scale * fit);
    const fitted = this.portrait.getBounds();
    this.portrait.x += mid - fitted.centerX;
    this.portrait.y += py + 4 - fitted.centerY;
    c.add(this.portrait);

    rule(g, left + 12, left + leftW - 12, 566, 0.2);
    this.prey(scene, g, left + 24, 594, leftW - 48);
    g.lineStyle(1, 0xc8913c, 0.12);
    g.lineBetween(724, 212, 724, 656);
    collectionStar(scene, c, game.collection, 980, 425, 216);

    c.add(text(scene, x0 + w - 30, y0 + h - 30, 'C  ·  Esc', 14, UI.boneDim).setOrigin(1, 0.5).setAlpha(0.5));
    c.setAlpha(0).setY(6);
    scene.tweens.add({ targets: c, alpha: 1, y: 0, duration: 200, ease: 'Sine.out' });
  }

  /**
   * Der Lebensweg: dieselbe Linie wie oben im Bild, nur größer und beschriftet – Jugend (kühl), Laichzeit (Ocker) und Alter
   * (rostrot); ein Lichtpunkt zeigt, wo das Tier gerade steht. Liegt schon Laich seiner Generation, leuchtet er warm.
   */
  private lifeline(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const life = game.life;
    const P = phases(life.gen);
    const m = P.mature / P.span, o = P.old / P.span, f = clamp(life.age / P.span, 0, 1);
    this.track(scene, g, x, y, w, f, [[m, 0x6fa8a0], [o, 0xc8913c], [1, 0xa4503a]], [
      [0, 'Hatching', f < m],
      [m, 'Spawning time', f >= m && f < o],
      [o, 'Age', f >= o],
      [1, 'Death', false],
    ], game.roe.length > 0);
  }

  /** Karbon: die Brutlinie wie oben im Bild – die Jugend bis zur Metamorphose, dann die Gefahr bis zum neuen Gelege. */
  private broodline(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const b = game.brood!;
    const meta = 0.32, young = b.phase === 'young';
    const f = young ? meta * Math.min(1, b.food / BROOD.food) : meta + (1 - meta) * (1 - b.left / BROOD.danger);
    this.track(scene, g, x, y, w, f, [[meta, 0x6fa8a0], [0.9, 0xc8913c], [1, 0xa4503a]], [
      [0, 'Larva', young],
      [meta, 'Metamorphosis', false],
      [1, 'New clutch', !young],
    ], false);
  }

  /**
   * Eine beschriftete Linie: Abschnitte (bis wohin, Farbe) – matt, so weit schon vergangen kräftig –, Marken an den Grenzen,
   * darunter die Namen (der gerade gültige heller) und ein Lichtpunkt bei f (0 … 1); glow: er leuchtet warm.
   */
  private track(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, f: number,
    parts: [number, number][], labels: [number, string, boolean][], glow: boolean) {
    const c = this.c;
    const h = 6;
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x - 2, y - h / 2 - 2, w + 4, h + 4, 5);
    let a = 0;
    for (const [b, col] of parts) {
      g.fillStyle(col, 0.3);
      g.fillRect(x + w * a, y - h / 2, w * (b - a), h);
      const e = Math.min(b, f);
      if (e > a) {
        g.fillStyle(col, 0.95);
        g.fillRect(x + w * a, y - h / 2, w * (e - a), h);
        // ein Hauch Licht oben auf der Linie
        g.fillStyle(0xffffff, 0.16);
        g.fillRect(x + w * a, y - h / 2, w * (e - a), 1.5);
      }
      a = b;
    }
    for (const [k] of labels) {
      if (k <= 0 || k >= 1) continue;
      g.fillStyle(0xe6dcc4, 0.6);
      g.fillRect(x + w * k - 0.5, y - 9, 1, 18);
    }
    diamond(g, x - 2, y, 3.5, 0.6);
    diamond(g, x + w + 2, y, 3.5, 0.6);
    for (const [k, str, on] of labels) {
      c.add(text(scene, x + w * k, y + 22, str, 13, on ? UI.bone : UI.boneDim).setOrigin(k <= 0 ? 0 : k >= 1 ? 1 : 0.5, 0.5).setAlpha(on ? 0.9 : 0.6));
    }
    // wo das Tier gerade steht
    const px = x + w * clamp(f, 0, 1);
    if (glow) c.add(scene.add.image(px, y, 'glow').setTint(0xffe2a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(46, 30).setAlpha(0.55));
    g.fillStyle(0x0d0b09, 1);
    g.fillCircle(px, y, 7);
    g.fillStyle(glow ? 0xfff0c0 : 0xffe0a0, 1);
    g.fillCircle(px, y, 4.5);
  }

  /** Beute und Pflanzen-/Fleischanteil, ohne Rangliste einzelner Arten. */
  private prey(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const c = this.c;
    c.add(text(scene, x, y, 'PREY', 13, UI.ochre, { fontStyle: '700' }).setLetterSpacing(3));
    c.add(title(scene, x, y + 34, nf(Math.floor(game.brood?.food ?? game.life.fed)), 34).setOrigin(0, 0.5));

    // Grünzeug gegen Fleisch
    const diet = game.dietAt();
    const by = y + 18, bx0 = x + 222, bx1 = x + w - 30, bw = bx1 - bx0;
    c.add(scene.add.image(bx0 - 30, by, dietIcon(scene, 'plant')).setDisplaySize(28, 28).setAlpha(diet ? 1 : 0.4));
    const meat = scene.add.image(bx1 + 30, by, dietIcon(scene, 'meat')).setAlpha(diet ? 1 : 0.4);
    meat.setScale(Math.min(32 / meat.width, 26 / meat.height));
    c.add(meat);
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(bx0 - 1, by - 4.5, bw + 2, 9, 4.5);
    if (diet) {
      const split = bx0 + bw * diet.plant;
      if (diet.plant > 0.005) {
        g.fillStyle(0x6f9a48, 1);
        g.fillRoundedRect(bx0, by - 3.5, Math.max(7, split - bx0), 7, { tl: 3.5, bl: 3.5, tr: diet.meat > 0.005 ? 0 : 3.5, br: diet.meat > 0.005 ? 0 : 3.5 });
      }
      if (diet.meat > 0.005) {
        g.fillStyle(0xa8402e, 1);
        g.fillRoundedRect(split, by - 3.5, Math.max(7, bx1 - split), 7, { tl: diet.plant > 0.005 ? 0 : 3.5, bl: diet.plant > 0.005 ? 0 : 3.5, tr: 3.5, br: 3.5 });
      }
      // ein Hauch Licht oben auf dem Balken
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(bx0 + 3, by - 3, bw - 6, 2);
    }
    const pct = (f: number | undefined) => (f === undefined ? '—' : `${Math.round(f * 100)} %`);
    c.add(text(scene, bx0, by + 20, pct(diet?.plant), 14, '#a8c878').setOrigin(0, 0.5).setAlpha(diet ? 0.95 : 0.4));
    c.add(text(scene, bx1, by + 20, pct(diet?.meat), 14, '#e0806c').setOrigin(1, 0.5).setAlpha(diet ? 0.95 : 0.4));
  }

  update(dt: number) {
    this.portrait.animate(dt, 'idle', 0);
  }

  destroy() {
    const tw = this.c.scene?.tweens;
    if (tw) for (const o of [this.c, ...this.c.list]) tw.killTweensOf(o);
    this.c.destroy();
  }
}
