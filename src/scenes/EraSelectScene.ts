import Phaser from 'phaser';
import { W, H } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { ERAS, type EraDef } from '../data/eras';
import { CLASSES, classIndex } from '../data/classes';
import { mapTexture } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { shade } from '../util/color';

const CW = 222, CH = 340, GAP = 20;

export class EraSelectScene extends Phaser.Scene {
  private cards: { c: Phaser.GameObjects.Container; era: EraDef; frame: Phaser.GameObjects.Graphics }[] = [];
  private sel = 0;
  private creature!: CreatureView;
  private evoText!: Phaser.GameObjects.Text;
  private clsText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('EraSelect');
  }

  create() {
    fadeIn(this);
    audio.music('map');
    this.cards = [];
    this.add.image(0, 0, 'title_bg').setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x04101e, 0.35).setOrigin(0);
    title(this, 40, 26, 'Wähle eine Karte', 44, '#ffe680');
    this.evoText = this.evoCounter(W - 330, 50);

    const total = ERAS.length * CW + (ERAS.length - 1) * GAP;
    const x0 = (W - total) / 2 + CW / 2;
    ERAS.forEach((era, i) => this.makeCard(era, x0 + i * (CW + GAP), 300, i));

    // Spielfigur unten
    panel(this, 40, 506, 560, 190);
    this.creature = new CreatureView(this, 150, 0, game.appearance(), 1.5);
    this.placeCreature();
    this.clsText = title(this, 270, 530, '', 28);
    this.hint = text(this, 270, 574, '', 19, '#cfe8ff', { wordWrap: { width: 320 } });
    this.updateInfo();

    new Button(this, 760, 560, 'Evolution', { w: 250, h: 62, icon: 'ic_dna', color: 0x8a4ad0, onClick: () => this.openEvolution() });
    new Button(this, 760, 640, 'Titelbild', { w: 250, h: 50, size: 20, icon: 'ic_home', color: 0x3a6ea8, onClick: () => fadeTo(this, 'Title') });
    new Button(this, 1070, 600, 'Spielen', { w: 260, h: 80, size: 30, icon: 'ic_play', color: 0xf08a24, onClick: () => this.choose(this.sel) });
    soundButton(this, W - 44, 50);

    // Startauswahl: die passende Ära
    const sug = ERAS.indexOf(game.suggestedEra());
    this.select(Math.max(0, sug), false);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.select(this.sel - 1));
    kb.on('keydown-RIGHT', () => this.select(this.sel + 1));
    kb.on('keydown-A', () => this.select(this.sel - 1));
    kb.on('keydown-D', () => this.select(this.sel + 1));
    kb.on('keydown-ENTER', () => this.choose(this.sel));
    kb.on('keydown-SPACE', () => this.choose(this.sel));
    kb.on('keydown-E', () => this.openEvolution());
    kb.on('keydown-ESC', () => fadeTo(this, 'Title'));

    const onEvolved = () => {
      this.creature.build(game.appearance());
      this.placeCreature();
      this.updateInfo();
      this.cards.forEach((_c, i) => this.refreshCard(i));
      this.select(this.sel, false);
    };
    bus.on('evolved', onEvolved);
    bus.on('evo', this.updateEvo, this);
    this.events.once('shutdown', () => {
      bus.off('evolved', onEvolved);
      bus.off('evo', this.updateEvo, this);
    });
    this.events.on('resume', () => this.updateEvo());
  }

  update(_t: number, dms: number) {
    this.creature.animate(dms / 1000, game.data.cls === 'fish' ? 'swim' : 'idle', 0.3);
  }

  private evoCounter(x: number, y: number) {
    panel(this, x, y - 26, 200, 52, 0.7, 0x0d2238, 26);
    this.add.image(x + 30, y, 'evo_gem').setScale(0.85);
    return title(this, x + 56, y, `${game.evo}`, 28, '#bff6ff').setOrigin(0, 0.5);
  }

  private updateEvo() {
    this.evoText.setText(`${game.evo}`);
  }

  private placeCreature() {
    const v = this.creature;
    v.setY(v.L.land ? 640 - v.L.footY * 1.5 : 600);
  }

  private updateInfo() {
    const cls = CLASSES[game.data.cls];
    this.clsText.setText(`Du bist: ${cls.name}`);
    const next = game.nextClass();
    let hint = cls.desc;
    if (next && game.classUnlocked(next)) {
      hint = game.evo >= CLASSES[next].cost
        ? `Neue Entwicklung möglich: ${CLASSES[next].name}! Öffne die Evolution.`
        : `Nächste Stufe: ${CLASSES[next].name} (${CLASSES[next].cost} EVO).`;
    }
    this.hint.setText(hint);
  }

  private makeCard(era: EraDef, x: number, y: number, i: number) {
    const c = this.add.container(x, y);
    const frame = this.add.graphics();
    c.add(frame);
    this.cards.push({ c, era, frame });
    this.refreshCard(i);
    c.setSize(CW, CH);
    c.setInteractive(new Phaser.Geom.Rectangle(-CW / 2, -CH / 2, CW, CH), Phaser.Geom.Rectangle.Contains);
    if (c.input) c.input.cursor = 'pointer';
    c.on('pointerdown', () => {
      if (this.sel === i) this.choose(i);
      else this.select(i);
    });
    c.on('pointerover', () => this.select(i, false));
  }

  private refreshCard(i: number) {
    const { c, era, frame } = this.cards[i];
    c.list.filter((o) => o !== frame).forEach((o) => o.destroy());
    const block = game.eraBlockReason(era);
    const unlocked = game.eraUnlocked(era);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-CW / 2 + 4, -CH / 2 + 6, CW, CH, 18);
    g.fillStyle(shade(era.color, -0.55), 0.95);
    g.fillRoundedRect(-CW / 2, -CH / 2, CW, CH, 18);
    c.add(g);
    c.sendToBack(g);
    const img = this.add.image(0, -CH / 2 + 74, mapTexture(this, era.id)).setDisplaySize(CW - 20, 124);
    if (!unlocked) img.setTint(0x303848);
    c.add(img);
    const nameT = title(this, 0, -CH / 2 + 146, era.name, 21, unlocked ? '#ffffff' : '#9aa6b8').setOrigin(0.5, 0).setWordWrapWidth(CW - 16).setAlign('center');
    c.add(nameT);
    c.add(text(this, 0, -CH / 2 + 150 + Math.max(58, nameT.height + 4), era.sub, 15, '#bcd8f0').setOrigin(0.5, 0));
    const req = era.maxClass ? `Nur für: ${CLASSES[era.minClass].name}` : `Ab: ${CLASSES[era.minClass].name}`;
    c.add(text(this, 0, -CH / 2 + 236, req, 17, '#ffe0a0').setOrigin(0.5, 0));
    const done = game.eraProgress(era);
    c.add(text(this, 0, -CH / 2 + 262, `${done} / ${era.nodes.length} Orte`, 18, '#ffffff').setOrigin(0.5, 0));
    if (game.data.bosses.includes(era.id)) {
      c.add(this.add.image(CW / 2 - 26, -CH / 2 + 26, 'ic_check').setTint(0x7aff8a).setScale(0.8));
    }
    if (!unlocked) {
      c.add(this.add.image(0, -CH / 2 + 74, 'ic_lock').setScale(1.3).setTint(0xcfd8e8));
    }
    c.add(text(this, 0, CH / 2 - 34, block ?? 'Bereit!', 16, block ? '#ff9a8a' : '#8aff9a', { align: 'center', wordWrap: { width: CW - 24 } }).setOrigin(0.5));
  }

  private select(i: number, sound = true) {
    i = Math.max(0, Math.min(this.cards.length - 1, i));
    if (sound && i !== this.sel) audio.sfx('click');
    this.sel = i;
    this.cards.forEach(({ c, frame }, k) => {
      const on = k === i;
      frame.clear();
      if (on) {
        frame.lineStyle(5, 0xffe680, 1);
        frame.strokeRoundedRect(-CW / 2 - 4, -CH / 2 - 4, CW + 8, CH + 8, 20);
      } else {
        frame.lineStyle(2, 0xffffff, 0.2);
        frame.strokeRoundedRect(-CW / 2, -CH / 2, CW, CH, 18);
      }
      c.setScale(on ? 1.04 : 0.97);
      c.setDepth(on ? 2 : 1);
    });
  }

  private choose(i: number) {
    const era = this.cards[i].era;
    const block = game.eraBlockReason(era);
    if (block) {
      audio.sfx('fail');
      const c = this.cards[i].c;
      this.tweens.add({ targets: c, x: c.x + 8, yoyo: true, repeat: 3, duration: 50 });
      this.toast(block + (classIndex(game.data.cls) < classIndex(era.minClass) ? ' (→ Evolution)' : ''));
      return;
    }
    audio.sfx('select');
    fadeTo(this, 'Map', { era: era.id });
  }

  private toast(msg: string) {
    const t = title(this, W / 2, 470, msg, 24, '#ffd0a0').setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 450, alpha: { from: 1, to: 0 }, delay: 1300, duration: 500, onComplete: () => t.destroy() });
  }

  private openEvolution() {
    audio.sfx('select');
    this.scene.launch('Evolution', { from: 'EraSelect' });
    this.scene.bringToTop('Evolution');
    this.scene.pause();
  }
}
