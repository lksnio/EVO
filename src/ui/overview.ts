import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { CLASSES } from '../data/classes';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { SPECIES } from '../data/species';
import { dietIcon, preyIcon } from '../art/speciesArt';
import { STAGE_NAME, stageOf } from '../sim/life';
import { BROOD } from '../data/karbon';
import { text, title } from './ui';
import { upLegend, upTrail } from './upTrail';

export interface OverviewData {
  morph: Morph;
  placeName: string;
  /** Artgenossen in der Nähe (ohne deine Gruppe) */
  kin: number;
  /** Lebenskraft gerade und höchstens */
  hp: number;
  hpMax: number;
  /** im Startgebiet (dort leben keine anderen Tiere): Die Beute zeigt alle Orte zusammen */
  overall?: boolean;
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

    // links der Bogen deines Tiers, rechts daneben eine schmale Spalte kleiner Karten – vorerst die Beute (was deine Linie an
    // diesem Ort gefressen hat)
    const x0 = 24, y0 = 14, w = 952, h = 692, mid = x0 + w / 2;
    const g = scene.add.graphics();
    frame(g, x0, y0, w, h);
    c.add(g);
    // die Bühne (dahinter kein Klick: Nur außerhalb schließt es)
    c.add(scene.add.zone(x0, y0, w, h).setOrigin(0).setInteractive());
    // rechts daneben eine Spalte kleiner Karten: die Beute, darunter die Muscheln
    const sx = x0 + w + 16, sw = W - 24 - sx;
    const ph = this.preyCard(scene, g, d, sx, y0, sw);
    this.shellCard(scene, g, sx, y0 + ph + 14, sw);

    const run = game.run;
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
    const big = [
      { label: 'LEBENSKRAFT', value: String(Math.max(0, Math.ceil(d.hp))), of: `/${d.hpMax}` },
      brood ? { label: 'SAUERSTOFF', value: String(v.oxy), of: ' s' } : { label: 'SICHT', value: String(v.sight) },
      { label: 'AUSDAUER', value: String(v.stam) },
    ];
    big.forEach((b, i) => {
      const cx = mid + (i - 1) * 260;
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
          { label: 'SCHWARM', value: v.swarm },
          { label: 'SCHUPPEN', value: v.scales },
        ];
    // daneben, wie viel sich jede vererbte Fähigkeit gegenüber der vorigen Generation verändert hat (ausgewachsen gemessen)
    const delta = game.inheritedDelta();
    const dkey: Record<string, 'bite' | 'skull' | 'scales' | 'legs' | 'grip' | undefined> = { GEBISS: 'bite', SCHÄDEL: 'skull', SCHUPPEN: 'scales', BEINE: 'legs', GRIFF: 'grip' };
    const step = (w - 180) / small.length;
    small.forEach((b, i) => {
      const cx = x0 + 90 + step * (i + 0.5);
      c.add(caps(cx, by + 14, b.label, 12, UI.boneDim));
      const val = title(scene, cx, by + 40, String(b.value), 26, UI.bone).setOrigin(0.5);
      c.add(val);
      const k = dkey[b.label];
      const dv = delta && k ? delta[k] ?? 0 : null;
      if (dv !== null) {
        const up = dv > 0, down = dv < 0;
        const tag = text(scene, cx + val.width / 2 + 8, by + 42, up ? `▲ ${dv}` : down ? `▼ ${-dv}` : '= 0', 13, up ? '#9cd07e' : down ? '#e08872' : '#6c6454', { fontStyle: '700' }).setOrigin(0, 0.5);
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
    if (delta) c.add(text(scene, mid, by + 74, 'gegenüber der vorigen Generation (ausgewachsen)', 11, '#6c6454', { fontStyle: 'italic' }).setOrigin(0.5));
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

    // ---- rechts: Leben, Nachwuchs, Funde (im Karbon: das Gelege)
    y = y0 + 334;
    if (brood) {
      head(colR, y, 'DAS GELEGE');
      row(colR, (y += 32), 'Generation', String(brood.gen));
      row(colR, (y += 28), 'Eier im Nest', nf(brood.eggs));
      row(colR, (y += 28), 'Abschnitt', brood.phase === 'young' ? 'Larve' : 'Vierfüßer');
      if (brood.phase === 'young') row(colR, (y += 28), 'Nahrung', `${nf(Math.floor(brood.food))} / ${nf(BROOD.food)}`);
      else row(colR, (y += 28), 'Neues Gelege in', `${Math.floor(brood.left / 60)}:${`${Math.ceil(brood.left) % 60}`.padStart(2, '0')}`);
      y += 40;
      head(colR, y, 'DIESE GENERATION');
      row(colR, (y += 32), 'Erlegte Beute', nf(Math.floor(brood.train.prey)));
      row(colR, (y += 28), 'An Land gelaufen', `${nf(Math.round(brood.train.land / 40))} Schritte`);
      row(colR, (y += 28), 'Geklettert', `${nf(Math.round(brood.train.climb / 40))} Schritte`);
      c.add(text(scene, x0 + w - 30, y0 + h - 30, 'C  ·  Esc', 14, UI.boneDim).setOrigin(1, 0.5).setAlpha(0.5));
      c.setAlpha(0).setY(6);
      scene.tweens.add({ targets: c, alpha: 1, y: 0, duration: 200, ease: 'Sine.out' });
      return;
    }
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
    // der Laich der ganzen Generation (auch von Geschwistern) und die Geschwister, die noch warten
    row(colR, (y += 28), 'Laich der Generation', nf(game.roe.length));
    if (game.pool.length > 0) row(colR, (y += 28), 'Geschwister', nf(game.pool.length));

    c.add(text(scene, x0 + w - 30, y0 + h - 30, 'C  ·  Esc', 14, UI.boneDim).setOrigin(1, 0.5).setAlpha(0.5));

    // sanft einblenden
    c.setAlpha(0).setY(6);
    scene.tweens.add({ targets: c, alpha: 1, y: 0, duration: 200, ease: 'Sine.out' });
  }

  /**
   * Die Beute – eine kleine Karte: oben, wie viel Grünzeug und wie viel Fleisch deine Linie an diesem Ort gefressen hat (links
   * ein Pflänzchen, rechts ein Stück Fleisch, dazwischen ein Balken: grün der Anteil der Pflanzen, rot der des Fleischs).
   * Darunter die Tiere, die sie hier am häufigsten gefressen hat – die drei häufigsten, je als kleines Sinnbild mit ihrem
   * Anteil an allen hier gefressenen Tieren (jedes Tier zählt einmal, gleich wie viele Brocken). An einem anderen Ort stehen
   * andere Zahlen; im Startgebiet (dort lebt sonst niemand) alle Orte zusammen („Gesamt“). Eine neue Linie beginnt leer.
   * Gibt die Höhe der Karte zurück.
   */
  private preyCard(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, d: OverviewData, x: number, y: number, w: number) {
    const c = this.c;
    const rowH = 46, top = y + 140, h = top - y + rowH * 3 + 14;
    frame(g, x, y, w, h);
    c.add(scene.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    const cx = x + w / 2;
    c.add(scene.add.text(cx, y + 38, 'BEUTE', { fontFamily: TITLE_FONT, fontSize: '15px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(5));
    // der Ort, an dem man ist – im Startgebiet (dort lebt sonst niemand) alle Orte zusammen
    const place = d.overall ? null : undefined;
    c.add(text(scene, cx, y + 60, d.overall ? 'Gesamt' : d.placeName, 13, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0.85));
    rule(g, x + 30, x + w - 30, y + 78, 0.3);

    // Grünzeug gegen Fleisch
    const diet = game.dietAt(place);
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
    const { top: best } = game.topPrey(place);
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

  /** Die Muscheln – eine kleine Karte: das Muschel-Symbol und wie viele du hast. Eine neu gefundene lässt die Zahl aufleuchten. */
  /**
   * Die Muscheln: oben, wie viele du gefunden hast; darunter die Segen deiner Linie als Punktfolge – in der Reihenfolge, in
   * der sie kamen (Lebenskraft rot, Ausdauer grau, Sicht schwarz, Sauerstoff blau; ein goldener Ring: aus einer goldenen
   * Geburt, nur für dieses Tier).
   */
  private shellCard(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number) {
    const c = this.c;
    const trail = game.upTrail;
    const rows = Math.max(1, Math.ceil(trail.length / 9));
    const h = 62 + 30 + rows * 24 + 44;
    frame(g, x, y, w, h);
    c.add(scene.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    const shells = game.shells;
    const n = title(scene, 0, y + 31, `× ${shells}`, 22, UI.bone).setOrigin(0, 0.5);
    const icon = scene.add.image(0, y + 31, 'shell').setOrigin(0, 0.5).setDisplaySize(22, 24);
    if (!shells) icon.setTint(0x000000).setAlpha(0.35);
    // Symbol und Zahl zusammen mittig
    const tw = 22 + 10 + n.width;
    icon.setX(x + w / 2 - tw / 2);
    n.setX(icon.x + 32);
    c.add([icon, n]);
    if (shells > game.seenShells) {
      n.setColor('#f0c878');
      scene.tweens.add({ targets: n, alpha: 0.55, yoyo: true, repeat: 2, duration: 520, ease: 'Sine.inOut', onComplete: () => n.active && n.setColor(UI.bone) });
      game.seenShells = shells;
    }
    // die Segen: eine Punktfolge
    const ty = y + 66;
    g.lineStyle(1, 0xc8913c, 0.22);
    g.lineBetween(x + 24, ty, x + w - 24, ty);
    const bought = game.upCount;
    c.add(scene.add.text(x + 24, ty + 16, 'SEGEN', { fontFamily: TITLE_FONT, fontSize: '11px', color: UI.ochre, fontStyle: '700', resolution: 2 }).setOrigin(0, 0.5).setLetterSpacing(3));
    c.add(text(scene, x + w - 24, ty + 16, `${game.shellsSpent} verteilt · ${game.shellsFree} frei`, 11, UI.boneDim).setOrigin(1, 0.5));
    const tr = upTrail(scene, x + w / 2, ty + 42, trail, { size: 16, step: 23, perRow: 9, empty: bought ? '' : 'noch kein Segen' });
    c.add(tr.c);
    c.add(upLegend(scene, x + w / 2, ty + 42 + tr.h + 20, game.upKeys, trail.some((d) => d.gold)));
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
