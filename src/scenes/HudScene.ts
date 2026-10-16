import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { eraById, type EraId } from '../data/eras';
import { CLASSES } from '../data/classes';
import { touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, panel, soundButton, text, title } from '../ui/ui';

/** Erste Schritte: nur die Steuerung, nichts über das verborgene System. */
const HINTS: Record<string, [string, string]> = {
  o1: [
    'Schwimmen: Pfeiltasten oder WASD  ·  Beißen und Fressen: J  ·  Sprinten: Shift',
    'Schwimmen: Steuerkreuz  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
  s1: [
    'Springen: Leertaste  ·  Beißen und Fressen: J  ·  Sprinten: Shift',
    'Springen: Sprung  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
};

const TIPS: Record<string, string> = {
  o1: 'Friss, um zu überleben. Im Dickicht sieht man dich kaum.',
  s1: 'Das Land ist fremd. Bleib wachsam.',
};

/**
 * Die Anzeige im Level – ohne Zahlen und Balken.
 * Verletzung, Hunger und Verstecktsein zeigen sich nur am Bildrand, am Herzschlag
 * und am Tier selbst.
 */
export class HudScene extends Phaser.Scene {
  private era!: EraId;
  private nodeId = '';
  private hurtV!: Phaser.GameObjects.Image;
  private hungerV!: Phaser.GameObjects.Image;
  private hideV!: Phaser.GameObjects.Image;
  private hp = 1;
  private food = 1;
  private hidden = false;
  private hurtA = 0;
  private hungerA = 0;
  private hideA = 0;
  private pulse = 0;
  private beatAt = 0;
  private pauseC?: Phaser.GameObjects.Container;
  private pauseNav?: MenuNav;
  private portrait?: CreatureView;

  constructor() {
    super('Hud');
  }

  init(d: { era: EraId; node: string }) {
    this.era = d.era;
    this.nodeId = d.node;
    this.pauseC = undefined;
    this.portrait = undefined;
    this.hp = 1;
    this.food = 1;
    this.hidden = false;
    this.hurtA = this.hungerA = this.hideA = this.pulse = 0;
    this.beatAt = 0;
  }

  create() {
    const era = eraById(this.era);
    const node = era.nodes.find((n) => n.id === this.nodeId)!;

    // Bildränder: Hunger (dunkel), Verletzung (rot), Versteck (grünlich-dunkel)
    this.hungerV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0);
    this.hideV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x0c1a0a).setAlpha(0);
    this.hurtV = this.add.image(W / 2, H / 2, 'vignette_red').setDisplaySize(W, H).setAlpha(0);

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);

    // Ortsname
    const head = title(this, W / 2, 118, node.name, 44).setOrigin(0.5).setAlpha(0);
    const sub = text(this, W / 2, 162, era.name, 20, UI.boneDim).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [head, sub], alpha: 1, duration: 900, hold: 1800, yoyo: true });

    const isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    const hint = HINTS[node.id]?.[isTouch ? 1 : 0];
    if (hint) {
      const ht = text(this, W / 2, H - 70, hint, 21, UI.bone, { align: 'center', stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: ht, alpha: 1, duration: 700, delay: 1200, hold: 7000, yoyo: true });
    }
    const tip = TIPS[node.id];
    if (tip) {
      const tt = text(this, W / 2, 210, tip, 22, UI.boneDim, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: tt, alpha: 1, duration: 900, delay: 3600, hold: 4200, yoyo: true });
    }

    if (isTouch) this.touchControls(era.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());

    const onVitals = (hp: number, food: number, hidden: boolean) => {
      this.hp = hp;
      this.food = food;
      if (hidden !== this.hidden) this.hidden = hidden;
    };
    const onApex = (name: string) => this.announce(name);
    bus.on('vitals', onVitals);
    bus.on('apex', onApex);
    this.events.once('shutdown', () => {
      bus.off('vitals', onVitals);
      bus.off('apex', onApex);
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
    });
  }

  update(time: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    const ease = (cur: number, to: number, k: number) => cur + (to - cur) * Math.min(1, dt * k);

    // Verletzung: Rand färbt sich rot, ab einem gewissen Punkt schlägt das Herz hörbar
    const hurt = this.hp < 0.6 ? Math.pow((0.6 - this.hp) / 0.6, 0.8) : 0;
    this.hurtA = ease(this.hurtA, hurt * 0.75, 4);
    if (this.hp < 0.33 && this.hp > 0 && time > this.beatAt && !this.pauseC) {
      this.beatAt = time + 520 + this.hp * 1800;
      this.pulse = 1;
      audio.sfx('heart');
    }
    this.pulse = Math.max(0, this.pulse - dt * 2.4);
    this.hurtV.setAlpha(Math.min(1, this.hurtA + this.pulse * 0.28 * (hurt > 0 ? 1 : 0)));

    // Hunger: das Bild wird enger und dunkler
    const hunger = this.food < 0.3 ? (0.3 - this.food) / 0.3 : 0;
    const starving = this.food <= 0.001 ? 0.12 + Math.sin(time / 600) * 0.08 : 0;
    this.hungerA = ease(this.hungerA, hunger * 0.65 + starving, 2);
    this.hungerV.setAlpha(Math.min(1, this.hungerA));

    // Versteckt im Dickicht
    this.hideA = ease(this.hideA, this.hidden ? 0.6 : 0, 5);
    this.hideV.setAlpha(this.hideA);

    this.portrait?.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.2);
  }

  /** Ein Spitzenräuber hat dich entdeckt. */
  private announce(name: string) {
    const c = this.add.container(W / 2, H / 2 - 110).setDepth(20);
    const t1 = title(this, 0, 0, name, 60, '#c8473a').setOrigin(0.5);
    const line = this.add.rectangle(0, 42, 420, 2, 0x8a2a20, 0.8);
    c.add([t1, line]);
    c.setAlpha(0).setScale(1.12);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 600, ease: 'Sine.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 900, onComplete: () => c.destroy() });
  }

  // ---------------------------------------------------------------- Rast (Pause)

  togglePause() {
    const lvl = this.scene.get('Level') as unknown as { ended?: boolean };
    if (this.pauseC) {
      this.resumeGame();
      return;
    }
    if (lvl.ended) return;
    audio.sfx('select');
    this.scene.pause('Level');
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.66).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 380, 130, 760, 460, 0.92));
    c.add(title(this, W / 2, 182, 'Rast', 48).setOrigin(0.5));

    // Das eigene Tier – so, wie es gerade aussieht
    const lv = this.scene.get('Level') as unknown as { player?: { morph(): Morph } };
    const m = lv.player?.morph() ?? game.morph();
    c.add(this.add.image(W / 2 - 190, 470, 'pedestal').setScale(1.15, 1));
    const v = new CreatureView(this, W / 2 - 190, 0, m, 1.6);
    v.setY(v.L.land ? 466 - v.L.footY * 1.6 : 400);
    c.add(v);
    this.portrait = v;
    c.add(text(this, W / 2 - 190, 518, CLASSES[m.cls].name, 20, UI.boneDim).setOrigin(0.5));

    const bx = W / 2 + 170;
    const b1 = new Button(this, bx, 280, 'Weiter', { w: 300, icon: 'ic_play', color: UI.ochreN, onClick: () => this.resumeGame() });
    const b2 = new Button(this, bx, 356, 'Aufgeben', { w: 300, icon: 'ic_map', onClick: () => this.abort() });
    c.add([b1, b2]);
    c.add(text(this, bx, 420, 'Wer aufgibt, kehrt zur Karte zurück –\nund verliert, was er unterwegs geworden ist.', 17, UI.boneDim, { align: 'center' }).setOrigin(0.5, 0));
    c.add(text(this, bx, 500, 'M: Ton an/aus  ·  Esc: weiter', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.7));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, [b1, b2]);
  }

  private resumeGame() {
    if (!this.pauseC) return;
    this.pauseC.destroy();
    this.pauseC = undefined;
    this.portrait = undefined;
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.pauseNav = undefined;
    this.scene.resume('Level');
  }

  private abort() {
    this.resumeGame();
    bus.emit('abortLevel');
  }

  // ---------------------------------------------------------------- Touch

  private touchControls(water: boolean) {
    this.input.addPointer(3);
    const btn = (x: number, y: number, r: number, label: string, key: keyof typeof touch, color = 0xe6dcc4) => {
      const g = this.add.graphics().setDepth(5);
      const draw = (down: boolean) => {
        g.clear();
        g.fillStyle(0x0b0a09, down ? 0.55 : 0.32);
        g.fillCircle(x, y, r);
        g.lineStyle(2.5, color, down ? 0.85 : 0.35);
        g.strokeCircle(x, y, r);
      };
      draw(false);
      text(this, x, y, label, r > 50 ? 21 : 18, UI.bone, { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(6).setAlpha(0.85);
      const z = this.add.zone(x, y, r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains).setDepth(7);
      const set = (v: boolean) => {
        touch[key] = v;
        draw(v);
        if (v) audio.unlock();
      };
      z.on('pointerdown', () => set(true));
      z.on('pointerup', () => set(false));
      z.on('pointerout', () => set(false));
    };
    btn(80, 610, 46, '◀', 'left');
    btn(220, 610, 46, '▶', 'right');
    btn(150, 540, 40, '▲', 'up');
    btn(150, 680, 36, '▼', 'down');
    btn(1190, 600, 60, 'Biss', 'bite', 0xc8473a);
    btn(1060, 650, 50, water ? 'Hoch' : 'Sprung', 'jump', 0x9ab8b0);
    btn(1070, 520, 44, 'Sprint', 'sprint', 0xc8913c);
  }
}
