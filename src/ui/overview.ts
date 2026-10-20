import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { CLASSES } from '../data/classes';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { STAGE_NAME, stageOf } from '../sim/life';
import { text, title } from './ui';

export interface OverviewData {
  morph: Morph;
  placeName: string;
  /** Artgenossen in der Nähe (ohne deine Gruppe) */
  kin: number;
  /** Lebenskraft gerade und höchstens */
  hp: number;
  hpMax: number;
}

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const length = (cm: number) => (cm >= 100 ? `${nf(cm / 100, 2)} m` : `${nf(cm)} cm`);
const weight = (g: number) => (g >= 1000 ? `${nf(g / 1000, 1)} kg` : g < 10 ? `${nf(g, 1)} g` : `${nf(g)} g`);

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
 * Schutz: Gebiss, Schädel, Schwarm und Schuppen. Das Tempo steht hier nicht (es ergibt sich aus Größe und Körperbau). Unten
 * der Körper, das Leben, der Nachwuchs und die Muscheln.
 */
export class Overview {
  readonly c: Phaser.GameObjects.Container;
  private portrait: CreatureView;

  constructor(scene: Phaser.Scene, d: OverviewData, onClose: () => void) {
    const c = (this.c = scene.add.container(0, 0).setDepth(60));
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerdown', onClose));

    const x0 = 170, y0 = 14, w = W - 2 * x0, h = 692;
    const g = scene.add.graphics();
    frame(g, x0, y0, w, h);
    c.add(g);
    // die Bühne (dahinter kein Klick: Nur außerhalb schließt es)
    c.add(scene.add.zone(x0, y0, w, h).setOrigin(0).setInteractive());

    const run = game.run;
    const life = game.life;
    const ep = game.epoch;
    // Kopf: der Name der Linie, darunter Körperform, Zeitalter und Ort
    c.add(title(scene, W / 2, y0 + 46, game.currentName, 30).setOrigin(0.5));
    c.add(text(scene, W / 2, y0 + 78, `${CLASSES[game.cls].name} · ${ep.name} · ${d.placeName}`, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));
    rule(g, x0 + 70, x0 + w - 70, y0 + 102);

    const caps = (x: number, y: number, str: string, size = 13, col = UI.ochre) =>
      scene.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: col, fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(4);

    // ---- die drei großen Werte (sie segnet die große Muschel)
    const v = game.shown();
    const big = [
      { label: 'LEBENSKRAFT', value: String(Math.max(0, Math.ceil(d.hp))), of: `/${d.hpMax}` },
      { label: 'SICHT', value: String(v.sight) },
      { label: 'AUSDAUER', value: String(v.stam) },
    ];
    big.forEach((b, i) => {
      const cx = W / 2 + (i - 1) * 270;
      c.add(caps(cx, y0 + 128, b.label));
      const val = title(scene, cx, y0 + 168, b.value, 40, UI.bone).setOrigin(0.5);
      c.add(val);
      if (b.of) {
        const of = title(scene, 0, y0 + 174, b.of, 24, UI.boneDim).setOrigin(0, 0.5);
        // Zahl und „/höchstens“ zusammen mittig
        const tw = val.width + 4 + of.width;
        val.setX(cx - tw / 2 + val.width / 2);
        of.setX(val.x + val.width / 2 + 4);
        c.add(of);
      }
      if (i > 0) diamond(g, W / 2 + (i - 1.5) * 270, y0 + 152, 3.5, 0.55);
    });

    // ---- Waffen und Schutz: eine Reihe kleiner Tafeln
    const by = y0 + 214;
    g.fillStyle(0x000000, 0.25);
    g.fillRect(x0 + 90, by - 6, w - 180, 66);
    g.lineStyle(1, 0xc8913c, 0.28);
    g.lineBetween(x0 + 90, by - 6, x0 + w - 90, by - 6);
    g.lineBetween(x0 + 90, by + 60, x0 + w - 90, by + 60);
    const small = [
      { label: 'GEBISS', value: v.bite },
      { label: 'SCHÄDEL', value: v.skull },
      { label: 'SCHWARM', value: v.swarm },
      { label: 'SCHUPPEN', value: v.scales },
    ];
    const step = (w - 180) / small.length;
    small.forEach((b, i) => {
      const cx = x0 + 90 + step * (i + 0.5);
      c.add(caps(cx, by + 14, b.label, 12, UI.boneDim));
      c.add(title(scene, cx, by + 40, String(b.value), 26, UI.bone).setOrigin(0.5));
      if (i > 0) {
        g.lineStyle(1, 0xc8913c, 0.18);
        g.lineBetween(cx - step / 2, by + 6, cx - step / 2, by + 48);
      }
    });
    rule(g, x0 + 70, x0 + w - 70, y0 + 300, 0.25);

    // zwischen den Spalten eine kaum sichtbare Linie
    g.lineStyle(1, 0xc8913c, 0.12);
    g.lineBetween(W / 2, y0 + 322, W / 2, y0 + h - 40);

    const colL = x0 + 52, colR = W / 2 + 46, colW = w / 2 - 98;
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
    // das Tier etwa gleich groß im Bild – ein Jungtier etwas näher, ein großes etwas ferner
    const px = colL + colW / 2, py = y0 + 400, scale = 1.45 * Math.min(2.4, Math.max(0.75, 1 / Math.max(0.1, d.morph.size)));
    c.add(scene.add.image(px, py + 58, 'shadow').setDisplaySize(230, 20).setAlpha(0.45));
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

    // ---- rechts: Leben, Nachwuchs, Funde
    y = y0 + 334;
    head(colR, y, 'LEBEN');
    row(colR, (y += 32), 'Generation', String(life.gen));
    if (run) row(colR, (y += 28), 'Geschlecht', run.sex === 1 ? 'Männchen' : 'Weibchen');
    row(colR, (y += 28), 'Lebensabschnitt', STAGE_NAME[stageOf(life.age, life.gen)]);
    const group = game.swarm?.members.length ?? 0;
    if (group > 0) row(colR, (y += 28), 'Deine Gruppe', nf(group));
    else if (d.kin > 0) row(colR, (y += 28), 'Artgenossen', nf(d.kin));

    // was gefressen wurde, wird beim Laichen zu Nachwuchs (siehe SPAWN)
    y += 40;
    head(colR, y, 'NACHWUCHS');
    row(colR, (y += 32), 'Nahrung', nf(Math.floor(life.fed)));
    row(colR, (y += 28), 'Je Nachkomme', nf(game.broodBase));
    row(colR, (y += 28), 'Nachkommen', nf(game.young));
    const sib = run?.siblings?.n ?? 0;
    if (sib > 0) row(colR, (y += 28), 'Geschwister im Gelege', nf(sib));

    y += 40;
    head(colR, y, 'MUSCHELN');
    const shells = game.shells;
    // daneben, wie viele noch frei sind (verteilt werden sie an der großen Muschel im Laichfluss)
    const free = game.shellsFree;
    const sv = row(colR, (y += 32), 'Muscheln', `× ${shells}   ·   ${free} frei${game.canUp() ? ' – Segen bereit' : ''}`);
    const icon = scene.add.image(sv.x - sv.width - 8, y + 1, 'shell').setOrigin(1, 0.5).setDisplaySize(18, 20);
    if (!shells) icon.setTint(0x000000).setAlpha(0.35);
    c.add(icon);
    // neu gefunden: Die Zahl leuchtet einmal warm auf
    if (shells > game.seenShells) {
      sv.setColor('#f0c878');
      scene.tweens.add({ targets: sv, alpha: 0.55, yoyo: true, repeat: 2, duration: 520, ease: 'Sine.inOut', onComplete: () => sv.active && sv.setColor(UI.bone) });
      game.seenShells = shells;
    }

    c.add(text(scene, x0 + w - 30, y0 + h - 30, 'C  ·  Esc', 14, UI.boneDim).setOrigin(1, 0.5).setAlpha(0.5));

    // sanft einblenden
    c.setAlpha(0).setY(6);
    scene.tweens.add({ targets: c, alpha: 1, y: 0, duration: 200, ease: 'Sine.out' });
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
