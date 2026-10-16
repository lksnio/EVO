import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { ERAS, type EraDef, type EraId } from '../data/eras';
import { CLASSES } from '../data/classes';
import { mapTexture } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';

const CW = 220, CH = 340, GAP = 18;

type CardState = 'unknown' | 'play' | 'past' | 'blocked';

/**
 * Die Zeitalter als Steintafeln. Was noch nicht erreicht ist, bleibt ein Fragezeichen.
 */
export class EraSelectScene extends Phaser.Scene {
  private cards: { c: Phaser.GameObjects.Container; era: EraDef; frame: Phaser.GameObjects.Graphics }[] = [];
  private sel = 0;
  private creature!: CreatureView;
  private reveal?: EraId;
  /** Karte, die gerade aufgedeckt wird, zeigt bis dahin noch ein Fragezeichen */
  private hiding?: EraId;

  constructor() {
    super('EraSelect');
  }

  init(d: { reveal?: EraId }) {
    this.reveal = d?.reveal;
    this.hiding = d?.reveal;
    this.cards = [];
  }

  create() {
    fadeIn(this, 500);
    audio.music('map');
    this.add.image(0, 0, 'title_bg2').setOrigin(0).setTint(0x9a9a9a);
    this.add.rectangle(0, 0, W, H, 0x050403, 0.45).setOrigin(0);
    title(this, 40, 26, 'Zeitalter', 42);
    text(this, 42, 82, 'Wohin führt dein Weg?', 19, UI.boneDim);
    soundButton(this, W - 44, 50);

    const total = ERAS.length * CW + (ERAS.length - 1) * GAP;
    const x0 = (W - total) / 2 + CW / 2;
    ERAS.forEach((era, i) => this.makeCard(era, x0 + i * (CW + GAP), 316, i));

    // Das eigene Tier
    panel(this, 40, 520, 560, 180, 0.88);
    this.add.image(150, 650, 'pedestal').setScale(0.9, 0.8);
    this.creature = new CreatureView(this, 150, 0, game.morph({ belly: 1 }), 1.35);
    const v = this.creature;
    v.setY(v.L.land ? 646 - v.L.footY * 1.35 : 590);
    title(this, 270, 548, CLASSES[game.data.cls].name, 28);
    text(this, 272, 592, `Generation ${game.data.generations}`, 18, UI.boneDim);
    text(this, 272, 622, 'Was du tust, formt, was aus dir wird.', 18, UI.bone, { fontStyle: 'italic', wordWrap: { width: 310 } });

    new Button(this, 770, 610, 'Titelbild', { w: 220, h: 52, size: 19, icon: 'ic_home', onClick: () => fadeTo(this, 'Title') });
    new Button(this, 1060, 610, 'Aufbrechen', { w: 290, h: 74, size: 28, icon: 'ic_play', color: UI.ochreN, onClick: () => this.choose(this.sel) });

    const start = this.reveal ? ERAS.findIndex((e) => e.id === this.reveal) : ERAS.indexOf(game.suggestedEra());
    this.select(Math.max(0, start), false);

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.select(this.sel - 1));
    kb.on('keydown-RIGHT', () => this.select(this.sel + 1));
    kb.on('keydown-A', () => this.select(this.sel - 1));
    kb.on('keydown-D', () => this.select(this.sel + 1));
    kb.on('keydown-ENTER', () => this.choose(this.sel));
    kb.on('keydown-SPACE', () => this.choose(this.sel));
    kb.on('keydown-ESC', () => fadeTo(this, 'Title'));

    if (this.reveal) this.time.delayedCall(700, () => this.flip(this.reveal!));
  }

  update(_t: number, dms: number) {
    this.creature.animate(dms / 1000, this.creature.L.land ? 'idle' : 'swim', 0.3);
  }

  private state(era: EraDef): CardState {
    if (!game.eraReached(era) || era.id === this.hiding) return 'unknown';
    if (game.eraPlayable(era)) return 'play';
    if (game.data.eras.includes(era.id)) return 'past';
    return 'blocked';
  }

  private makeCard(era: EraDef, x: number, y: number, i: number) {
    const c = this.add.container(x, y);
    const frame = this.add.graphics();
    c.add(frame);
    this.cards.push({ c, era, frame });
    this.refreshCard(i);
    c.setSize(CW, CH);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, CW, CH), Phaser.Geom.Rectangle.Contains);
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
    const st = this.state(era);
    const tab = this.add.image(0, 0, 'tablet');
    c.add(tab);
    c.sendToBack(tab);
    if (st === 'unknown') {
      tab.setTint(0x8a8076);
      c.add(title(this, 0, -36, '?', 120, '#5e554a').setOrigin(0.5));
      c.add(title(this, 0, 76, '???', 22, '#6e6458').setOrigin(0.5));
      c.add(text(this, 0, 112, 'Diese Zeit liegt\nnoch im Dunkeln.', 16, '#6e6458', { align: 'center' }).setOrigin(0.5, 0));
      return;
    }
    const img = this.add.image(0, -CH / 2 + 82, mapTexture(this, era.id)).setDisplaySize(CW - 26, 132);
    if (st !== 'play') img.setTint(0x6a6460);
    c.add(img);
    const nameT = title(this, 0, -CH / 2 + 160, era.name, 20, st === 'play' ? UI.bone : UI.boneDim).setOrigin(0.5, 0).setWordWrapWidth(CW - 20).setAlign('center');
    c.add(nameT);
    c.add(text(this, 0, -CH / 2 + 166 + Math.max(28, nameT.height), era.sub, 15, UI.boneDim).setOrigin(0.5, 0));
    // überlebte Orte als Kratzspuren
    const n = era.nodes.length;
    const done = game.eraProgress(era);
    for (let k = 0; k < n; k++) {
      const dot = this.add.image((k - (n - 1) / 2) * 30, CH / 2 - 92, 'ic_claw').setScale(0.42);
      dot.setTint(k < done ? 0xc8913c : 0x3a332c);
      c.add(dot);
    }
    const msg = st === 'play' ? 'Hier kannst du leben.' : st === 'past' ? 'Hier lebten\ndeine Vorfahren.' : 'Dein Körper ist hierfür\nnicht gemacht.';
    c.add(text(this, 0, CH / 2 - 46, msg, 15, st === 'play' ? UI.ochre : UI.boneDim, { align: 'center' }).setOrigin(0.5));
  }

  private select(i: number, sound = true) {
    i = Math.max(0, Math.min(this.cards.length - 1, i));
    if (sound && i !== this.sel) audio.sfx('click');
    this.sel = i;
    this.cards.forEach(({ c, frame }, k) => {
      const on = k === i;
      frame.clear();
      if (on) {
        frame.lineStyle(3, 0xc8913c, 1);
        frame.strokeRoundedRect(-CW / 2 - 6, -CH / 2 - 6, CW + 12, CH + 12, 18);
      }
      c.setScale(on ? 1.04 : 0.97);
      c.setDepth(on ? 2 : 1);
    });
  }

  private choose(i: number) {
    const era = this.cards[i].era;
    const st = this.state(era);
    if (st !== 'play') {
      audio.sfx('fail');
      const c = this.cards[i].c;
      this.tweens.add({ targets: c, x: c.x + 6, yoyo: true, repeat: 3, duration: 50 });
      this.toast(st === 'unknown' ? 'Diese Zeit liegt noch im Dunkeln.' : st === 'past' ? 'Für dich gibt es kein Zurück.' : 'Dein Körper ist hierfür nicht gemacht.');
      return;
    }
    audio.sfx('select');
    fadeTo(this, 'Map', { era: era.id });
  }

  /** Ein neu erreichtes Zeitalter wird aufgedeckt. */
  private flip(id: EraId) {
    const i = this.cards.findIndex((x) => x.era.id === id);
    if (i < 0) return;
    const c = this.cards[i].c;
    this.select(i, false);
    this.tweens.add({
      targets: c,
      scaleX: 0,
      duration: 260,
      ease: 'Sine.in',
      onComplete: () => {
        this.hiding = undefined;
        this.refreshCard(i);
        audio.sfx('unlock');
        this.tweens.add({ targets: c, scaleX: 1.04, duration: 320, ease: 'Back.out' });
        this.toast('Eine neue Zeit bricht an.');
      },
    });
  }

  private toast(msg: string) {
    const t = title(this, W / 2, 504, msg, 21, UI.bone).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, y: 496, alpha: { from: 1, to: 0 }, delay: 1500, duration: 600, onComplete: () => t.destroy() });
  }
}
