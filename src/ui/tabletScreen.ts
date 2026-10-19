import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { CLASSES } from '../data/classes';
import { STAT_COUNT, type StatCtx } from '../data/tablet';
import { game } from '../state/GameState';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Tablet } from './tablet';
import { text, title } from './ui';

export interface TabletScreenData {
  ctx: StatCtx;
  morph: Morph;
  placeName: string;
  /** Lebensabschnitt und was es mit dem Laichen auf sich hat (zwei kurze Zeilen) */
  life?: { stage: string; spawn: string; brood: string };
  kin: number;
  /** so viele zählt deine Gruppe (game.swarm) – sie steht dann statt der Artgenossen hier */
  group?: number;
}

/**
 * Die Übersicht (Taste C), angelehnt an die Menüs alter Abenteuerspiele: links die vermooste Steintafel
 * mit allem, was man über sein Tier schon weiß, rechts das Tier selbst und die Muscheln.
 * Der Hunger steht nur hier; die Zeit läuft oben im Bild.
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
    if (run) c.add(text(scene, cx, 308, `Generation ${game.life.gen} · ${run.sex === 1 ? 'Männchen' : 'Weibchen'}${d.life ? ` · ${d.life.stage}` : ''}`, 17, UI.boneDim).setOrigin(0.5));
    if (d.life) {
      c.add(text(scene, cx, 332, d.life.spawn, 16, UI.ochre).setOrigin(0.5));
      // Nachkommen: was gefressen wurde, wird zur Brut
      c.add(text(scene, cx, 355, d.life.brood, 15, UI.boneDim).setOrigin(0.5));
    }

    const line = (y: number) => {
      const g = scene.add.graphics();
      g.lineStyle(1, 0x6a5638, 0.6);
      g.lineBetween(rx + 40, y, rx + rw - 40, y);
      c.add(g);
    };
    const label = (y: number, str: string) => c.add(title(scene, rx + 44, y, str, 17, UI.ochre).setOrigin(0, 0.5));

    // Muscheln (die Zeit steht oben im Bild, nicht hier)
    line(372);
    label(402, 'Muscheln');
    c.add(text(scene, rx + rw - 44, 402, `${unlocked} von ${STAT_COUNT}`, 22, unlocked >= STAT_COUNT ? UI.ochre : UI.bone).setOrigin(1, 0.5));
    // zwei Reihen, egal wie viele Zeilen die Tafel hat
    const per = Math.ceil(STAT_COUNT / 2);
    for (let i = 0; i < STAT_COUNT; i++) {
      const col = i % per, row = Math.floor(i / per);
      const x = rx + 74 + col * ((rw - 148) / (per - 1));
      const y = 476 + row * 58;
      const has = i < unlocked;
      const sh = scene.add.image(x, y + 20, 'shell').setOrigin(0.5, 1).setDisplaySize(44, 48);
      if (!has) sh.setTint(0x000000).setAlpha(0.32);
      c.add(sh);
    }

    // Gruppe (Artgenossen sind selten – ohne sie bleibt die Zeile weg)
    const group = d.group ?? 0;
    if (group > 0 || d.kin > 0) {
      line(600);
      c.add(text(scene, rx + 44, 630, group > 0 ? 'Deine Gruppe' : 'Artgenossen', 18, UI.boneDim).setOrigin(0, 0.5));
      c.add(text(scene, rx + rw - 44, 630, String(group > 0 ? group : d.kin), 20, UI.bone).setOrigin(1, 0.5));
    }
  }

  update(dt: number) {
    this.portrait.animate(dt, 'swim', 0.22);
  }

  destroy() {
    this.c.destroy();
  }
}
