import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { CLASSES } from '../data/classes';
import { yearsAgo } from '../data/epochs';
import { STAT_COUNT, type StatCtx } from '../data/tablet';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Tablet } from './tablet';
import { text, title } from './ui';

export interface TabletScreenData {
  ctx: StatCtx;
  morph: Morph;
  /** gelebte Sekunden im Zeitalter */
  elapsed: number;
  placeName: string;
  kin: number;
}

/**
 * Die Übersicht (Taste C), angelehnt an die Menüs alter Abenteuerspiele: links die vermooste Steintafel
 * mit allem, was man über sein Tier schon weiß, rechts das Tier selbst, die Zeit und die Muscheln.
 * Hunger und Zeit sieht man nirgends sonst im Spiel.
 */
export class TabletScreen {
  readonly c: Phaser.GameObjects.Container;
  private portrait: CreatureView;
  private tablet: Tablet;

  constructor(scene: Phaser.Scene, d: TabletScreenData, onClose: () => void) {
    const c = (this.c = scene.add.container(0, 0).setDepth(60));
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0).setInteractive().on('pointerdown', onClose));

    const unlocked = Math.min(STAT_COUNT, game.shells.length);
    const fresh = Math.max(0, unlocked - game.seenRows);
    this.tablet = new Tablet(scene, 52, 34, 560, 652, d.ctx, unlocked, { heading: game.currentName, fresh });
    c.add(this.tablet);
    audio.sfx('tablet');
    if (fresh) {
      this.tablet.reveal(650);
      game.seenRows = unlocked;
    }

    // ---- rechts: Tier, Zeit, Muscheln
    const rx = 640, rw = W - rx - 52;
    const cx = rx + rw / 2;
    // schlichte, flache Tafel: dunkel, mit einer dünnen Linie
    const bg = scene.add.graphics();
    bg.fillStyle(0x0d0c0b, 0.86);
    bg.fillRoundedRect(rx, 34, rw, 652, 10);
    bg.lineStyle(1.5, 0x6a5638, 0.5);
    bg.strokeRoundedRect(rx + 0.5, 34.5, rw - 1, 651, 10);
    c.add(bg);
    c.add(title(scene, cx, 78, d.placeName, 29).setOrigin(0.5));
    const run = game.run;
    const ep = game.epoch;
    c.add(text(scene, cx, 112, `${ep.name} · ${CLASSES[game.cls].name}`, 18, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));

    c.add(scene.add.image(cx, 296, 'shadow').setDisplaySize(260, 26).setAlpha(0.5));
    this.portrait = new CreatureView(scene, cx, 220, { ...d.morph, belly: 1 }, 1.7);
    this.portrait.setFacing(1);
    c.add(this.portrait);
    if (run) c.add(text(scene, cx, 318, `Generation ${run.history.length + 1} · ${run.sex === 1 ? 'Männchen' : 'Weibchen'}`, 17, UI.boneDim).setOrigin(0.5));

    const line = (y: number) => {
      const g = scene.add.graphics();
      g.lineStyle(1, 0x6a5638, 0.6);
      g.lineBetween(rx + 40, y, rx + rw - 40, y);
      c.add(g);
    };
    const label = (y: number, str: string) => c.add(title(scene, rx + 44, y, str, 17, UI.ochre).setOrigin(0, 0.5));

    // Zeit
    line(356);
    label(384, 'Zeit');
    const span = game.epochSpan();
    const frac = Math.max(0, Math.min(1, d.elapsed / ep.seconds));
    const years = span.from - (span.from - span.to) * frac;
    c.add(text(scene, rx + rw - 44, 384, yearsAgo(years, (span.from - span.to) / ep.seconds / 10), 22, UI.bone).setOrigin(1, 0.5));
    const g = scene.add.graphics();
    const bx = rx + 44, bw = rw - 88;
    g.fillStyle(0x2c261f, 1);
    g.fillRoundedRect(bx - 2, 410, bw + 4, 12, 4);
    g.fillStyle(0xc8913c, 1);
    g.fillRoundedRect(bx, 412, bw * frac, 8, 3);
    g.fillStyle(0xffe0a0, 1);
    g.fillCircle(bx + bw * frac, 416, 5);
    c.add(g);
    c.add(text(scene, cx, 440, frac >= 1 ? 'Das Zeitalter ist um.' : 'Wenn die Schnur verbrannt ist, endet das Zeitalter.', 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));

    // Muscheln
    line(472);
    label(500, 'Muscheln');
    c.add(text(scene, rx + rw - 44, 500, `${unlocked} von ${STAT_COUNT}`, 22, unlocked >= STAT_COUNT ? UI.ochre : UI.bone).setOrigin(1, 0.5));
    // zwei Reihen, egal wie viele Zeilen die Tafel hat
    const per = Math.ceil(STAT_COUNT / 2);
    for (let i = 0; i < STAT_COUNT; i++) {
      const col = i % per, row = Math.floor(i / per);
      const x = rx + 74 + col * ((rw - 148) / (per - 1));
      const y = 568 + row * 54;
      const has = i < unlocked;
      const sh = scene.add.image(x, y + 20, 'shell').setOrigin(0.5, 1).setDisplaySize(44, 48);
      if (!has) sh.setTint(0x000000).setAlpha(0.32);
      c.add(sh);
    }

    // Gruppe
    line(646);
    c.add(text(scene, rx + 44, 666, 'Artgenossen', 18, UI.boneDim).setOrigin(0, 0.5));
    c.add(text(scene, rx + rw - 44, 666, String(d.kin), 20, UI.bone).setOrigin(1, 0.5));
  }

  update(dt: number) {
    this.portrait.animate(dt, 'swim', 0.22);
  }

  destroy() {
    this.c.destroy();
  }
}
