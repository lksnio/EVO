import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { CLASSES } from '../data/classes';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { STAGE_NAME, stageOf } from '../sim/life';
import { STAMINA } from '../data/life';
import { text, title } from './ui';

export interface OverviewData {
  morph: Morph;
  placeName: string;
  /** Artgenossen in der Nähe (ohne deine Gruppe) */
  kin: number;
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

/**
 * Die Übersicht (Taste C) – wie der Charakterbogen alter Rollenspiele: wer dein Tier ist, wie groß und schwer, wie weit
 * im Leben, was es für seinen Nachwuchs gesammelt hat und was es gefunden hat. Kampfwerte stehen hier nicht – wie stark ein
 * Tier ist, merkt man beim Spielen.
 */
export class Overview {
  readonly c: Phaser.GameObjects.Container;
  private portrait: CreatureView;

  constructor(scene: Phaser.Scene, d: OverviewData, onClose: () => void) {
    const c = (this.c = scene.add.container(0, 0).setDepth(60));
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive().on('pointerdown', onClose));

    const x0 = 170, y0 = 74, w = W - 2 * x0, h = 572;
    const g = scene.add.graphics();
    frame(g, x0, y0, w, h);
    c.add(g);
    // die Bühne (dahinter kein Klick: Nur außerhalb schließt es)
    c.add(scene.add.zone(x0, y0, w, h).setOrigin(0).setInteractive());

    const run = game.run;
    const life = game.life;
    const ep = game.epoch;
    // Kopf: der Name der Linie, darunter Körperform, Zeitalter und Ort
    c.add(title(scene, W / 2, y0 + 50, game.currentName, 30).setOrigin(0.5));
    c.add(text(scene, W / 2, y0 + 84, `${CLASSES[game.cls].name} · ${ep.name} · ${d.placeName}`, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));
    g.lineStyle(1, 0xc8913c, 0.35);
    g.lineBetween(x0 + 70, y0 + 112, W / 2 - 14, y0 + 112);
    g.lineBetween(W / 2 + 14, y0 + 112, x0 + w - 70, y0 + 112);
    diamond(g, W / 2, y0 + 112, 4, 0.7);
    // zwischen den Spalten eine kaum sichtbare Linie
    g.lineStyle(1, 0xc8913c, 0.12);
    g.lineBetween(W / 2, y0 + 140, W / 2, y0 + h - 40);

    const colL = x0 + 52, colR = W / 2 + 46, colW = w / 2 - 98;
    const head = (x: number, y: number, str: string) => {
      const t = scene.add.text(x, y, str, { fontFamily: TITLE_FONT, fontSize: '14px', color: UI.ochre, fontStyle: '700', resolution: 2 })
        .setOrigin(0, 0.5).setLetterSpacing(4);
      c.add(t);
      g.lineStyle(1, 0xc8913c, 0.22);
      g.lineBetween(x + t.width + 14, y + 1, x + colW, y + 1);
    };
    const row = (x: number, y: number, label: string, value: string) => {
      c.add(text(scene, x, y, label, 19, UI.boneDim).setOrigin(0, 0.5));
      const v = text(scene, x + colW, y, value, 19, UI.bone, { fontStyle: '600' }).setOrigin(1, 0.5);
      c.add(v);
      return v;
    };

    // ---- links: das Tier selbst und sein Körper
    // das Tier etwa gleich groß im Bild – ein Jungtier etwas näher, ein großes etwas ferner
    const px = colL + colW / 2, py = y0 + 232, scale = 1.6 * Math.min(2.4, Math.max(0.75, 1 / Math.max(0.1, d.morph.size)));
    c.add(scene.add.image(px, py + 62, 'shadow').setDisplaySize(240, 22).setAlpha(0.45));
    this.portrait = new CreatureView(scene, px, py, { ...d.morph, belly: 1 }, scale);
    if (this.portrait.L.land) this.portrait.setY(py + 60 - this.portrait.L.footY * scale);
    this.portrait.setFacing(1);
    c.add(this.portrait);

    const m = game.measure(game.cls, game.traits, game.lifeK);
    const t = game.traits;
    let y = y0 + 352;
    head(colL, y, 'KÖRPER');
    row(colL, (y += 36), 'Länge', length(m.cm));
    row(colL, (y += 32), 'Gewicht', weight(m.g));
    row(colL, (y += 32), 'Färbung', t.coat === 1 ? 'Grün' : t.coat === 2 ? 'Schwarz' : 'Natürlich');
    row(colL, (y += 32), 'Kost', t.diet < -0.3 ? 'Pflanzen' : t.diet > 0.3 ? 'Fleisch' : 'Alles');
    // wie viel Ausdauer dein Tier hat: ein Kreis – und für jeden Segen der großen Muschel ein Stück mehr
    row(colL, (y += 32), 'Ausdauer', circles(game.staminaMax));

    // ---- rechts: Leben, Nachwuchs, Funde
    y = y0 + 152;
    head(colR, y, 'LEBEN');
    row(colR, (y += 36), 'Generation', String(life.gen));
    if (run) row(colR, (y += 32), 'Geschlecht', run.sex === 1 ? 'Männchen' : 'Weibchen');
    row(colR, (y += 32), 'Lebensabschnitt', STAGE_NAME[stageOf(life.age, life.gen)]);

    // was gefressen wurde, wird beim Laichen zu Nachwuchs (siehe SPAWN)
    y += 44;
    head(colR, y, 'NACHWUCHS');
    row(colR, (y += 36), 'Nahrung', nf(Math.floor(life.fed)));
    row(colR, (y += 32), 'Je Nachkomme', nf(game.broodBase));
    row(colR, (y += 32), 'Nachkommen', nf(game.young));
    const sib = run?.siblings?.n ?? 0;
    if (sib > 0) row(colR, (y += 32), 'Geschwister im Gelege', nf(sib));

    y += 44;
    head(colR, y, 'MUSCHELN');
    const shells = game.shells;
    // daneben, wann die große Muschel im Laichfluss wieder segnet (jeder Segen gibt mehr Ausdauer)
    const next = game.staminaMax >= STAMINA.max ? '' : game.canPray ? '   ·   Segen bereit' : `   ·   Segen bei ${nf(game.nextBlessing)}`;
    const sv = row(colR, (y += 36), 'Muscheln', `× ${shells}${next}`);
    const icon = scene.add.image(sv.x - sv.width - 8, y + 1, 'shell').setOrigin(1, 0.5).setDisplaySize(20, 22);
    if (!shells) icon.setTint(0x000000).setAlpha(0.35);
    c.add(icon);
    // neu gefunden: Die Zahl leuchtet einmal warm auf
    if (shells > game.seenRows) {
      sv.setColor('#f0c878');
      scene.tweens.add({ targets: sv, alpha: 0.55, yoyo: true, repeat: 2, duration: 520, ease: 'Sine.inOut', onComplete: () => sv.active && sv.setColor(UI.bone) });
      game.seenRows = shells;
    }
    const group = game.swarm?.members.length ?? 0;
    if (group > 0) row(colR, (y += 32), 'Deine Gruppe', nf(group));
    else if (d.kin > 0) row(colR, (y += 32), 'Artgenossen', nf(d.kin));

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

/** „1 Kreis“, „1½ Kreise“, „2 Kreise“ … */
function circles(n: number) {
  const whole = Math.floor(n + 1e-6), half = n - whole > 0.25;
  const s = `${whole || ''}${half ? '½' : ''}` || '0';
  return `${s} ${n === 1 ? 'Kreis' : 'Kreise'}`;
}
