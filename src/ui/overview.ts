import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { CLASSES } from '../data/classes';
import { game, type UpKey } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { SPECIES } from '../data/species';
import { dietIcon, preyIcon } from '../art/speciesArt';
import { phases, STAGE_NAME, stageOf } from '../sim/life';
import { BROOD } from '../data/karbon';
import { placeOf } from '../data/world';
import { clamp } from '../util/math';
import { text, title } from './ui';
import { upTrail } from './upTrail';

export interface OverviewData {
  morph: Morph;
  /** Lebenskraft gerade und höchstens */
  hp: number;
  hpMax: number;
}

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const length = (cm: number) => (cm >= 100 ? `${nf(cm / 100, 2)} m` : `${nf(cm)} cm`);
// Angezeigte Masse ×100; Körperbau, Vererbung und Schadensverhältnisse bleiben unverändert.
const weight = (g: number) => { const shown = g * 100; return shown >= 1000 ? `${nf(shown / 1000, 1)} kg` : `${nf(shown)} g`; };

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
 * Die Übersicht (Taste C) – wie der Charakterbogen alter Rollenspiele. Oben, wer dein Tier ist; darunter seine drei großen
 * Werte – Lebenskraft (gerade / höchstens), Sicht und Ausdauer, die die große Muschel segnet –, dann seine Waffen und sein
 * Schutz: Gebiss, Schädel, Flossen und Schuppen. Das Tempo steht hier nicht (es ergibt sich aus Größe und Körperbau). Unten
 * links das Tier und sein Körper, rechts sein Lebensweg und die Nachkommen (im Karbon: das Gelege); daneben Beute und
 * Muscheln. Nahrung und Kosten je Ei stehen am Laich.
 */
export class Overview {
  readonly c: Phaser.GameObjects.Container;
  private portrait: CreatureView;

  constructor(scene: Phaser.Scene, d: OverviewData, onClose: () => void) {
    const c = (this.c = scene.add.container(0, 0).setDepth(60));
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerdown', onClose));

    // Links der Charakterbogen mit Karte, rechts die Nahrung und Muscheln.
    const x0 = 24, y0 = 14, w = 952, h = 692, mid = x0 + w / 2;
    const g = scene.add.graphics();
    frame(g, x0, y0, w, h);
    c.add(g);
    // die Bühne (dahinter kein Klick: Nur außerhalb schließt es)
    c.add(scene.add.zone(x0, y0, w, h).setOrigin(0).setInteractive());
    // rechts daneben eine Spalte kleiner Karten: die Beute, darunter die Muscheln
    const sx = x0 + w + 16, sw = W - 24 - sx;
    const ph = this.preyCard(scene, g, sx, y0, sw);
    this.shellCard(scene, g, sx, y0 + ph + 14, sw);

    const life = game.life;
    const ep = game.epoch;
    // Kopf: der Name der Linie, darunter Körperform, Zeitalter und Ort
    c.add(title(scene, mid, y0 + 46, game.currentName, 30).setOrigin(0.5));
    c.add(text(scene, mid, y0 + 78, `${CLASSES[game.cls].name} · ${ep.name}`, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));
    rule(g, x0 + 70, x0 + w - 70, y0 + 102);

    const caps = (x: number, y: number, str: string, size = 13, col = UI.ochre) =>
      scene.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: col, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(4);

    // ---- die drei großen Werte (sie segnet die große Muschel)
    const v = game.shown();
    // im Karbon segnet die große Muschel Sauerstoff statt Sicht (Sekunden an Land)
    const brood = game.brood;
    const trail = game.upTrail;
    const big: { key: UpKey; label: string; value: string; of?: string }[] = [
      { key: 'hp', label: 'LEBENSKRAFT', value: String(Math.max(0, Math.ceil(d.hp))), of: `/${d.hpMax}` },
      brood ? { key: 'oxy', label: 'SAUERSTOFF', value: String(v.oxy), of: ' s' } : { key: 'sight', label: 'SICHT', value: String(v.sight) },
      { key: 'stam', label: 'AUSDAUER', value: String(v.stam) },
    ];
    big.forEach((b, i) => {
      const cx = mid + (i - 1) * 260;
      c.add(caps(cx, y0 + 128, b.label));
      const val = title(scene, cx, y0 + 163, b.value, 40, UI.bone).setOrigin(0.5);
      c.add(val);
      if (b.of) {
        const of = title(scene, 0, y0 + 169, b.of, 24, UI.boneDim).setOrigin(0, 0.5);
        // Zahl und „/höchstens“ zusammen mittig
        const tw = val.width + 4 + of.width;
        val.setX(cx - tw / 2 + val.width / 2);
        of.setX(val.x + val.width / 2 + 4);
        c.add(of);
      }
      c.add(upTrail(scene, cx, y0 + 195, trail.filter((d) => d.key === b.key), { size: 14, step: 20, perRow: 12 }).c);
      if (i > 0) diamond(g, mid + (i - 1.5) * 260, y0 + 152, 3.5, 0.55);
    });

    // ---- Waffen und Schutz: eine Reihe kleiner Tafeln
    const by = y0 + 214;
    g.fillStyle(0x000000, 0.25);
    g.fillRect(x0 + 90, by - 6, w - 180, 66);
    g.lineStyle(1, 0xc8913c, 0.28);
    g.lineBetween(x0 + 90, by - 6, x0 + w - 90, by - 6);
    g.lineBetween(x0 + 90, by + 60, x0 + w - 90, by + 60);
    // im Karbon: was das Verhalten der Generationen formt – Gebiss, Beine, Griff, Schuppen
    const small = brood
      ? [
          { label: 'GEBISS', value: v.bite },
          { label: 'BEINE', value: v.legs },
          { label: 'GRIFF', value: v.grip },
          { label: 'SCHUPPEN', value: v.scales },
        ]
      : [
          { label: 'GEBISS', value: v.bite },
          { label: 'SCHÄDEL', value: v.skull },
          { label: 'FLOSSEN', value: v.fins },
          { label: 'SCHUPPEN', value: v.scales },
        ];
    // daneben, wie viel sich jede vererbte Fähigkeit gegenüber der vorigen Generation verändert hat (ausgewachsen gemessen)
    const delta = game.inheritedDelta();
    const dkey: Record<string, 'bite' | 'skull' | 'fins' | 'scales' | 'legs' | 'grip' | undefined> = { GEBISS: 'bite', SCHÄDEL: 'skull', FLOSSEN: 'fins', SCHUPPEN: 'scales', BEINE: 'legs', GRIFF: 'grip' };
    const step = (w - 180) / small.length;
    small.forEach((b, i) => {
      const cx = x0 + 90 + step * (i + 0.5);
      c.add(caps(cx, by + 14, b.label, 12, UI.boneDim));
      const val = title(scene, cx, by + 40, String(b.value), 26, UI.bone).setOrigin(0.5);
      c.add(val);
      const k = dkey[b.label];
      const dv = delta && k ? delta[k] ?? 0 : null;
      if (dv !== null && dv !== 0) {
        const up = dv > 0, down = dv < 0;
        const tag = text(scene, cx + val.width / 2 + 8, by + 42, up ? `▲ ${dv}` : `▼ ${-dv}`, 13, up ? '#9cd07e' : '#e08872', { fontStyle: '700' }).setOrigin(0, 0.5);
        c.add(tag);
        if (up || down) {
          const glow = scene.add.image(tag.x + tag.width / 2, tag.y, 'glow').setTint(up ? 0x7cc860 : 0xe06a50).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(tag.width + 26, 22).setAlpha(0.14);
          c.addAt(glow, c.getIndex(tag));
        }
      }
      if (i > 0) {
        g.lineStyle(1, 0xc8913c, 0.18);
        g.lineBetween(cx - step / 2, by + 6, cx - step / 2, by + 48);
      }
    });
    rule(g, x0 + 70, x0 + w - 70, y0 + 300, 0.25);

    // zwischen den Spalten eine kaum sichtbare Linie
    g.lineStyle(1, 0xc8913c, 0.12);
    g.lineBetween(mid, y0 + 322, mid, y0 + h - 40);

    const colL = x0 + 52, colR = mid + 46, colW = w / 2 - 98;
    const head = (x: number, y: number, str: string) => {
      const t = scene.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: '14px', color: UI.ochre, fontStyle: '700', resolution: 2 })
        .setOrigin(0, 0.5).setLetterSpacing(4);
      c.add(t);
      g.lineStyle(1, 0xc8913c, 0.22);
      g.lineBetween(x + t.width + 14, y + 1, x + colW, y + 1);
    };
    const row = (x: number, y: number, label: string, value: string) => {
      c.add(text(scene, x, y, label, 18, UI.boneDim).setOrigin(0, 0.5));
      const val = text(scene, x + colW, y, value, 18, UI.bone, { fontStyle: '600' }).setOrigin(1, 0.5);
      c.add(val);
      return val;
    };

    // ---- links: das Tier selbst und sein Körper
    head(colL, y0 + 334, 'LEBEN');
    const stage = brood ? (brood.phase === 'young' ? 'Larve' : 'Vierfüßer') : STAGE_NAME[stageOf(life.age, life.gen)];
    c.add(text(scene, colL + colW / 2, y0 + 364, `Generation ${brood?.gen ?? life.gen} · ${stage}`, 17, UI.bone).setOrigin(0.5));
    // das Tier etwa gleich groß im Bild – ein Jungtier etwas näher, ein großes etwas ferner
    const px = colL + colW / 2, py = y0 + 422, scale = 1.45 * Math.min(2.4, Math.max(0.75, 1 / Math.max(0.1, d.morph.size)));
    c.add(scene.add.image(px, py + 46, 'shadow').setDisplaySize(230, 20).setAlpha(0.45));
    this.portrait = new CreatureView(scene, px, py, { ...d.morph, belly: 1 }, scale);
    if (this.portrait.L.land) this.portrait.setY(py + 56 - this.portrait.L.footY * scale);
    this.portrait.setFacing(1);
    c.add(this.portrait);

    const m = game.measure(game.cls, game.traits, game.lifeK, true);
    const t = game.traits;
    let y = y0 + 500;
    head(colL, y, 'KÖRPER');
    row(colL, (y += 32), 'Länge', length(m.cm));
    row(colL, (y += 28), 'Gewicht', weight(m.g));
    row(colL, (y += 28), 'Färbung', t.coat === 1 ? 'Grün' : t.coat === 2 ? 'Schwarz' : 'Natürlich');
    row(colL, (y += 28), 'Kost', t.diet < -0.3 ? 'Pflanzen' : t.diet > 0.3 ? 'Fleisch' : 'Alles');

    // ---- rechts: der Lebensweg und die Nachkommen (im Karbon: das Gelege) – die zweiten Überschriften auf einer Höhe mit „Körper“
    y = y0 + 334;
    if (brood) {
      head(colR, y, 'DAS GELEGE');
      this.broodline(scene, g, colR + 6, y + 48, colW - 12);
      row(colR, (y += 104), 'Eier im Nest', nf(brood.eggs));
      if (brood.phase === 'young') row(colR, (y += 28), 'Nahrung', `${nf(Math.floor(brood.food))} / ${nf(BROOD.food)}`);
      else row(colR, (y += 28), 'Neues Gelege in', `${Math.floor(brood.left / 60)}:${`${Math.ceil(brood.left) % 60}`.padStart(2, '0')}`);
      y = y0 + 500;
      head(colR, y, 'DIESE GENERATION');
      row(colR, (y += 32), 'Erlegte Beute', nf(Math.floor(brood.train.prey)));
      row(colR, (y += 28), 'An Land gelaufen', `${nf(Math.round(brood.train.land / 40))} Schritte`);
      row(colR, (y += 28), 'Geklettert', `${nf(Math.round(brood.train.climb / 40))} Schritte`);
    } else {
      head(colR, y, 'LEBENSWEG');
      this.lifeline(scene, g, colR + 6, y + 48, colW - 12);
      row(colR, (y += 104), 'Lebensabschnitt', STAGE_NAME[stageOf(life.age, life.gen)]);
      row(colR, (y += 28), 'Ort', placeOf(ep, game.prog.place).name);
      y = y0 + 500;
      head(colR, y, 'NACHKOMMEN');
      const eggs = game.roe.length, group = game.swarm?.members.length ?? 0;
      row(colR, (y += 32), 'Geschwister', nf(game.pool.length));
      row(colR, (y += 28), 'Nächste Generation', eggs ? `${nf(eggs)} ${eggs === 1 ? 'Ei' : 'Eier'}` : '—');
      row(colR, (y += 28), 'Deine Gruppe', group ? nf(group) : '—');
    }

    c.add(text(scene, x0 + w - 30, y0 + h - 30, 'C  ·  Esc', 14, UI.boneDim).setOrigin(1, 0.5).setAlpha(0.5));

    // sanft einblenden
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
      [0, 'Schlüpfen', f < m],
      [m, 'Laichzeit', f >= m && f < o],
      [o, 'Alter', f >= o],
      [1, 'Ende', false],
    ], game.roe.length > 0);
  }

  /** Karbon: die Brutlinie wie oben im Bild – die Jugend bis zur Metamorphose, dann die Gefahr bis zum neuen Gelege. */
  private broodline(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const b = game.brood!;
    const meta = 0.32, young = b.phase === 'young';
    const f = young ? meta * Math.min(1, b.food / BROOD.food) : meta + (1 - meta) * (1 - b.left / BROOD.danger);
    this.track(scene, g, x, y, w, f, [[meta, 0x6fa8a0], [0.9, 0xc8913c], [1, 0xa4503a]], [
      [0, 'Larve', young],
      [meta, 'Metamorphose', false],
      [1, 'Neues Gelege', !young],
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

  /** Beute und Nahrungsanteile des ganzen Zeitalters, unabhängig von Ort und Generation. */
  private preyCard(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const c = this.c;
    const rowH = 46, top = y + 140, h = top - y + rowH * 3 + 14;
    frame(g, x, y, w, h);
    c.add(scene.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    const cx = x + w / 2;
    c.add(scene.add.text(cx, y + 44, `BEUTE: ${nf(Math.floor(game.brood?.food ?? game.life.fed))}`, { fontFamily: TITLE_FONT, fontSize: '18px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(2));
    rule(g, x + 30, x + w - 30, y + 78, 0.3);

    // Grünzeug gegen Fleisch
    const diet = game.dietAt();
    const by = y + 100, bx0 = x + 54, bx1 = x + w - 54, bw = bx1 - bx0;
    c.add(scene.add.image(x + 33, by, dietIcon(scene, 'plant')).setDisplaySize(28, 28).setAlpha(diet ? 1 : 0.4));
    const meat = scene.add.image(x + w - 33, by, dietIcon(scene, 'meat')).setAlpha(diet ? 1 : 0.4);
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
    c.add(text(scene, bx0, by + 18, pct(diet?.plant), 13, '#a8c878').setOrigin(0, 0.5).setAlpha(diet ? 0.95 : 0.4));
    c.add(text(scene, bx1, by + 18, pct(diet?.meat), 13, '#e0806c').setOrigin(1, 0.5).setAlpha(diet ? 0.95 : 0.4));
    g.lineStyle(1, 0xc8913c, 0.16);
    g.lineBetween(x + 30, top - 4, x + w - 30, top - 4);

    // die drei häufigsten Tiere
    const { top: best } = game.topPrey();
    for (let i = 0; i < 3; i++) {
      const ry = top + rowH * i + rowH / 2;
      const e = best[i];
      const def = e ? SPECIES[e.id] : undefined;
      if (i > 0) {
        g.lineStyle(1, 0xc8913c, 0.1);
        g.lineBetween(x + 30, top + rowH * i, x + w - 30, top + rowH * i);
      }
      c.add(title(scene, x + 36, ry, String(i + 1), 18, def ? UI.ochre : UI.boneDim).setOrigin(0.5).setAlpha(def ? 0.9 : 0.35));
      if (!e || !def) {
        c.add(text(scene, x + 112, ry, '—', 18, UI.boneDim).setOrigin(0.5).setAlpha(0.3));
        continue;
      }
      c.add(scene.add.image(x + 112, ry, preyIcon(scene, def, 92, 36)).setScale(0.5));
      c.add(title(scene, x + w - 32, ry, `${Math.round(e.share * 100)} %`, 20, UI.bone).setOrigin(1, 0.5));
    }
    return h;
  }

  /** Nur die noch verfügbaren Muscheln. Eine neu gefundene lässt die Zahl aufleuchten. */
  private shellCard(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const c = this.c;
    const h = 62;
    frame(g, x, y, w, h);
    c.add(scene.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    const shells = game.shellsFree;
    const n = title(scene, 0, y + 31, `× ${shells}`, 22, UI.bone).setOrigin(0, 0.5);
    const icon = scene.add.image(0, y + 31, 'shell').setOrigin(0, 0.5).setDisplaySize(22, 24);
    if (!shells) icon.setTint(0x000000).setAlpha(0.35);
    // Symbol und Zahl zusammen mittig
    const tw = 22 + 10 + n.width;
    icon.setX(x + w / 2 - tw / 2);
    n.setX(icon.x + 32);
    c.add([icon, n]);
    if (game.shells > game.seenShells) {
      n.setColor('#f0c878');
      scene.tweens.add({ targets: n, alpha: 0.55, yoyo: true, repeat: 2, duration: 520, ease: 'Sine.inOut', onComplete: () => n.active && n.setColor(UI.bone) });
      game.seenShells = game.shells;
    }
  }

  update(dt: number) {
    this.portrait.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.22);
  }

  destroy() {
    const tw = this.c.scene?.tweens;
    if (tw) for (const o of [this.c, ...this.c.list]) tw.killTweensOf(o);
    this.c.destroy();
  }
}
