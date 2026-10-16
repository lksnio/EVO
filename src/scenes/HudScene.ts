import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { EPOCHS, yearsAgo, type EpochDef } from '../data/epochs';
import { CLASSES } from '../data/classes';
import { touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, panel, soundButton, text, title } from '../ui/ui';

/** Erste Schritte: nur die Steuerung, nichts über das verborgene System. */
const HINTS: Record<string, [string, string]> = {
  ordovizium: [
    'Schwimmen: Pfeiltasten oder WASD  ·  Beißen und Fressen: J  ·  Sprinten: Shift',
    'Schwimmen: Steuerkreuz  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
  karbon: [
    'Springen: Leertaste  ·  Beißen und Fressen: J  ·  Sprinten: Shift',
    'Springen: Sprung  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
};

const TIPS: Record<string, string> = {
  ordovizium: 'Überlebe, bis das Zeitalter endet. Wie, ist dir überlassen.',
  karbon: 'Das Land ist fremd. Bleib wachsam.',
};

/**
 * Die Anzeige im Level: oben die Uhr des Zeitalters, sonst keine Zahlen und Balken.
 * Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand, am Herzschlag und am Tier.
 */
export class HudScene extends Phaser.Scene {
  private ep!: EpochDef;
  private hurtV!: Phaser.GameObjects.Image;
  private hungerV!: Phaser.GameObjects.Image;
  private hideV!: Phaser.GameObjects.Image;
  private clockText!: Phaser.GameObjects.Text;
  private fuse!: Phaser.GameObjects.Graphics;
  private storyText!: Phaser.GameObjects.Text;
  private hp = 1;
  private food = 1;
  private hidden = false;
  private hurtA = 0;
  private hungerA = 0;
  private hideA = 0;
  private pulse = 0;
  private beatAt = 0;
  private prog = 0;
  private pauseC?: Phaser.GameObjects.Container;
  private pauseNav?: MenuNav;
  private portrait?: CreatureView;
  private giveUp?: Button;
  private giveUpArmed = false;

  constructor() {
    super('Hud');
  }

  init(d: { epoch: number }) {
    this.ep = EPOCHS[d?.epoch ?? 0];
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    this.giveUpArmed = false;
    this.hp = 1;
    this.food = 1;
    this.hidden = false;
    this.hurtA = this.hungerA = this.hideA = this.pulse = 0;
    this.beatAt = 0;
    this.prog = 0;
  }

  create() {
    const ep = this.ep;

    // Bildränder: Hunger (dunkel), Verletzung (rot), Versteck (grünlich-dunkel)
    this.hungerV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0);
    this.hideV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x0c1a0a).setAlpha(0);
    this.hurtV = this.add.image(W / 2, H / 2, 'vignette_red').setDisplaySize(W, H).setAlpha(0);

    // Die Uhr des Zeitalters
    const g = this.add.graphics();
    g.fillStyle(0x050403, 0.55);
    g.fillRoundedRect(W / 2 - 200, 8, 400, 70, 12);
    title(this, W / 2, 26, ep.name.toUpperCase(), 18, UI.ochre).setOrigin(0.5).setLetterSpacing(3);
    this.clockText = text(this, W / 2, 50, yearsAgo(ep.from, (ep.from - ep.to) / ep.seconds / 10), 21, UI.bone).setOrigin(0.5);
    this.fuse = this.add.graphics();
    this.drawFuse();
    this.storyText = text(this, W / 2, 100, '', 20, UI.bone, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0).setAlpha(0);

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);

    // Zeitalter und Lebensraum einblenden
    const head = title(this, W / 2, H / 2 - 90, ep.place, 46).setOrigin(0.5).setAlpha(0);
    const sub = text(this, W / 2, H / 2 - 44, ep.desc, 20, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [head, sub], alpha: 1, duration: 900, hold: 2200, yoyo: true });

    const isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    const hint = HINTS[ep.id]?.[isTouch ? 1 : 0];
    if (hint) {
      const ht = text(this, W / 2, H - 70, hint, 21, UI.bone, { align: 'center', stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: ht, alpha: 1, duration: 700, delay: 1200, hold: 7000, yoyo: true });
    }
    const tip = TIPS[ep.id];
    if (tip) this.time.delayedCall(4200, () => this.story(tip));

    if (isTouch) this.touchControls(ep.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());

    const onVitals = (hp: number, food: number, hidden: boolean) => {
      this.hp = hp;
      this.food = food;
      this.hidden = hidden;
    };
    const onClock = (years: number, prog: number, step: number) => {
      this.clockText.setText(yearsAgo(years, step));
      this.prog = prog;
      this.drawFuse();
    };
    const onStory = (line: string) => this.story(line);
    const onApex = (name: string) => this.announce(name);
    bus.on('vitals', onVitals);
    bus.on('clock', onClock);
    bus.on('story', onStory);
    bus.on('apex', onApex);
    this.events.once('shutdown', () => {
      bus.off('vitals', onVitals);
      bus.off('clock', onClock);
      bus.off('story', onStory);
      bus.off('apex', onApex);
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
    });
  }

  /** Die Zündschnur: Wie viel vom Zeitalter noch vor dir liegt. */
  private drawFuse() {
    const g = this.fuse;
    const x0 = W / 2 - 170, w = 340, y = 70;
    g.clear();
    g.fillStyle(0x2a2420, 1);
    g.fillRect(x0, y, w, 3);
    g.fillStyle(0xc8913c, 0.9);
    g.fillRect(x0, y, w * this.prog, 3);
    g.fillStyle(0xffe0a0, 1);
    g.fillCircle(x0 + w * this.prog, y + 1.5, 3);
  }

  /** Eine Erzählzeile (Ereignisse) – kurz eingeblendet. */
  private story(line: string) {
    const t = this.storyText;
    this.tweens.killTweensOf(t);
    t.setText(line).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 700 });
    this.tweens.add({ targets: t, alpha: 0, delay: 5200, duration: 1200 });
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

    // Hunger: das Bild wird dunkler
    const hunger = this.food < 0.3 ? (0.3 - this.food) / 0.3 : 0;
    const starving = this.food <= 0.001 ? 0.12 + Math.sin(time / 600) * 0.08 : 0;
    this.hungerA = ease(this.hungerA, hunger * 0.65 + starving, 2);
    this.hungerV.setAlpha(Math.min(1, this.hungerA));

    // Versteckt im Dickicht
    this.hideA = ease(this.hideA, this.hidden ? 0.6 : 0, 5);
    this.hideV.setAlpha(this.hideA);

    this.portrait?.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.2);
  }

  /** Ein großer Räuber hat dich entdeckt. */
  private announce(name: string) {
    const c = this.add.container(W / 2, H / 2 - 110).setDepth(20);
    const t1 = title(this, 0, 0, name, 56, '#c8473a').setOrigin(0.5);
    const line = this.add.rectangle(0, 40, 420, 2, 0x8a2a20, 0.8);
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
    const b2 = new Button(this, bx, 356, 'Aufgeben', { w: 300, icon: 'ic_skull', onClick: () => this.abort() });
    this.giveUp = b2;
    this.giveUpArmed = false;
    c.add([b1, b2]);
    c.add(text(this, bx, 420, 'Wer aufgibt, lässt seine Linie aussterben.\nDas Spiel ist dann vorbei.', 17, UI.boneDim, { align: 'center' }).setOrigin(0.5, 0));
    c.add(text(this, bx, 500, 'M: Ton an/aus  ·  Esc: weiter', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.7));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, [b1, b2]);
  }

  private resumeGame() {
    if (!this.pauseC) return;
    this.pauseC.destroy();
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.pauseNav = undefined;
    this.scene.resume('Level');
  }

  /** Erst nachfragen – Aufgeben beendet das Spiel. */
  private abort() {
    if (!this.giveUpArmed) {
      this.giveUpArmed = true;
      this.giveUp?.setLabel('Wirklich?').setColor(0x5a2420);
      return;
    }
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
