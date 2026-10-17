import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import type { LevelScene } from './LevelScene';
import type { Kin } from '../objects/Kin';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { CLASSES } from '../data/classes';
import { STAT_COUNT } from '../data/tablet';
import { touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, controlsList, panel, soundButton, text, title } from '../ui/ui';
import { TabletScreen } from '../ui/tabletScreen';

/**
 * Die Anzeige im Level: kaum etwas. Hunger und Zeit stehen nur auf der Steintafel (Taste C).
 * Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand, am Herzschlag und am Tier.
 */
export class HudScene extends Phaser.Scene {
  private ep!: EpochDef;
  private placeName = '';
  private blurb = '';
  private tutorial = false;
  private hungerNoted = false;
  private weakNoted = false;
  private hurtV!: Phaser.GameObjects.Image;
  private edgeV!: Phaser.GameObjects.Image;
  private hungerV!: Phaser.GameObjects.Image;
  private hideV!: Phaser.GameObjects.Image;
  private storyText!: Phaser.GameObjects.Text;
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
  private giveUp?: Button;
  private giveUpArmed = false;
  private isTouch = false;
  private ramBtn = false;
  private zoneText!: Phaser.GameObjects.Text;
  private bossC!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossShown = false;
  private tabletView?: TabletScreen;
  private tabletGlow?: Phaser.GameObjects.Image;

  constructor() {
    super('Hud');
  }

  init(d: { epoch: number; place?: string; blurb?: string; tutorial?: boolean }) {
    this.ep = EPOCHS[d?.epoch ?? 0];
    this.placeName = d?.place ?? this.ep.place;
    this.blurb = d?.blurb ?? '';
    this.tutorial = !!d?.tutorial;
    this.hungerNoted = this.weakNoted = false;
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    this.giveUpArmed = false;
    this.ramBtn = false;
    this.tabletView = undefined;
    this.tabletGlow = undefined;
    this.bossShown = false;
    this.hp = 1;
    this.food = 1;
    this.hidden = false;
    this.hurtA = this.hungerA = this.hideA = this.pulse = 0;
    this.beatAt = 0;
  }

  create() {
    const ep = this.ep;

    // Bildränder: Hunger (dunkel), Verletzung (rot), Versteck (grünlich-dunkel)
    this.hungerV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0);
    this.hideV = this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setTint(0x0c1a0a).setAlpha(0);
    this.hurtV = this.add.image(W / 2, H / 2, 'vignette_red').setDisplaySize(W, H).setAlpha(0);
    this.edgeV = this.add.image(W / 2, H / 2, 'edge_red').setDisplaySize(W, H).setAlpha(0);

    this.storyText = text(this, W / 2, 96, '', 20, UI.bone, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0).setAlpha(0);

    // Lebensbalken des Endgegners (unten)
    this.bossC = this.add.container(W / 2, H - 46).setAlpha(0).setDepth(8);
    this.bossName = title(this, 0, -18, '', 22, '#d8b070').setOrigin(0.5);
    this.bossBar = this.add.graphics();
    this.bossC.add([this.bossBar, this.bossName]);
    // Ort, an dem man gerade ist
    this.zoneText = text(this, 22, 18, this.placeName, 17, UI.boneDim, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 3 });

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    // Die Steintafel: Hunger und Zeit stehen nur dort. Leuchtet, wenn sie etwas Neues zeigt.
    this.tabletGlow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0);
    new Button(this, W - 156, 38, 'C', { w: 50, h: 50, onClick: () => this.toggleTablet() }).setAlpha(0.75);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);
    this.updateGlow();

    // Ort einblenden
    const first = !this.blurb;
    const head = title(this, W / 2, H / 2 - 90, this.placeName, 46).setOrigin(0.5).setAlpha(0);
    const round = game.run?.round ?? 0;
    const blurb = first ? (round ? `Die ${round + 1}. Generation – der Herrscher dieser Zeit lebt noch.` : ep.desc) : this.blurb;
    const sub = text(this, W / 2, H / 2 - 44, blurb, 20, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [head, sub], alpha: 1, duration: 900, hold: 2200, yoyo: true });

    // Allererster Start: Hinweis auf das, was vor einem schimmert
    if (this.tutorial) this.time.delayedCall(3600, () => game.shells.length === 0 && this.story('Vor dir schimmert etwas im Sand.'));
    const run = game.run;
    if (run?.ramNew) {
      run.ramNew = false;
      this.time.delayedCall(5200, () => this.ramUnlocked());
    }

    const isTouch = (this.isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch'));
    if (isTouch) this.touchControls(ep.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.tabletView ? this.toggleTablet() : this.togglePause()));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-C', () => this.toggleTablet());

    const onVitals = (hp: number, food: number, hidden: boolean) => {
      this.hp = hp;
      this.food = food;
      this.hidden = hidden;
    };
    const onStory = (line: string) => this.story(line);
    const onApex = (name: string) => this.announce(name);
    const onRam = () => this.ramUnlocked();
    const onZone = (name: string) => this.zoneText.setText(name);
    const onBoss = (name: string, f: number) => this.drawBoss(name, f);
    const onShell = (n: number) => {
      this.updateGlow();
      this.story(n === 1 ? 'Eine Muschel! Auf der Steintafel wird etwas sichtbar. (C)' : n >= STAT_COUNT ? 'Die letzte Muschel – die Steintafel ist ganz frei.' : 'Die Steintafel zeigt dir etwas Neues. (C)');
    };
    bus.on('boss', onBoss);
    bus.on('zone', onZone);
    bus.on('vitals', onVitals);
    bus.on('story', onStory);
    bus.on('apex', onApex);
    bus.on('ramUnlocked', onRam);
    bus.on('shell', onShell);
    // Kino-Moment: schwarze Balken oben und unten
    const barH = 64;
    const bars = [this.add.rectangle(0, -barH, W, barH, 0x000000, 1).setOrigin(0).setDepth(50), this.add.rectangle(0, H, W, barH, 0x000000, 1).setOrigin(0).setDepth(50)];
    const onCine = (on: boolean) => {
      this.tweens.add({ targets: bars[0], y: on ? 0 : -barH, duration: 900, ease: 'Sine.inOut' });
      this.tweens.add({ targets: bars[1], y: on ? H - barH : H, duration: 900, ease: 'Sine.inOut' });
    };
    bus.on('cine', onCine);
    this.events.once('shutdown', () => {
      bus.off('cine', onCine);
      bus.off('vitals', onVitals);
      bus.off('story', onStory);
      bus.off('apex', onApex);
      bus.off('ramUnlocked', onRam);
      bus.off('zone', onZone);
      bus.off('boss', onBoss);
      bus.off('shell', onShell);
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
    });
  }

  /** Der Knopf der Steintafel leuchtet, solange es dort etwas Neues zu sehen gibt. */
  private updateGlow() {
    const g = this.tabletGlow;
    if (!g) return;
    const fresh = Math.min(STAT_COUNT, game.shells.length) > game.seenRows;
    this.tweens.killTweensOf(g);
    if (!fresh) {
      g.setAlpha(0);
      return;
    }
    g.setAlpha(0.2);
    this.tweens.add({ targets: g, alpha: 0.7, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
  }

  /** Lebensbalken des Endgegners. */
  private drawBoss(name: string, f: number) {
    if (!this.bossShown && f > 0) {
      this.bossShown = true;
      this.tweens.add({ targets: this.bossC, alpha: 1, duration: 800 });
    }
    this.bossName.setText(name.toUpperCase());
    const g = this.bossBar;
    const w = 520;
    g.clear();
    g.fillStyle(0x050403, 0.7);
    g.fillRoundedRect(-w / 2 - 8, -4, w + 16, 22, 6);
    g.fillStyle(0x3a1410, 1);
    g.fillRect(-w / 2, 2, w, 10);
    g.fillStyle(0xb8321e, 1);
    g.fillRect(-w / 2, 2, w * f, 10);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(-w / 2, 2, w * f, 3);
    g.lineStyle(1.5, 0x8a6a40, 0.9);
    g.strokeRect(-w / 2 - 1, 1, w + 2, 12);
    if (f <= 0 && this.bossShown) this.tweens.add({ targets: this.bossC, alpha: 0, duration: 1200, delay: 1500 });
  }

  // ---------------------------------------------------------------- Steintafel (Taste C)

  toggleTablet() {
    if (this.tabletView) {
      this.tabletView.destroy();
      this.tabletView = undefined;
      this.updateGlow();
      if (!this.pauseC) this.scene.resume('Level');
      return;
    }
    const lvl = this.scene.get('Level') as unknown as LevelScene;
    if (this.pauseC || !lvl || lvl.ended || !game.run) return;
    audio.sfx('select');
    this.scene.pause('Level');
    const p = lvl.player;
    const kin = lvl.animals.filter((a) => a.kin && !a.dead) as unknown as Kin[];
    this.tabletView = new TabletScreen(
      this,
      {
        ctx: { cls: game.cls, traits: game.traits, hp: p.hp, sat: p.satiety },
        morph: p.morph(),
        elapsed: lvl.elapsed,
        placeName: this.placeName,
        kin: kin.length,
      },
      () => this.toggleTablet(),
    );
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

    // Verletzung: alle vier Bildränder färben sich rot, ab einem gewissen Punkt schlägt das Herz hörbar
    const hurt = this.hp < 0.6 ? Math.pow((0.6 - this.hp) / 0.6, 0.8) : 0;
    this.hurtA = ease(this.hurtA, hurt, 4);
    if (this.hp < 0.33 && this.hp > 0 && time > this.beatAt && !this.pauseC) {
      this.beatAt = time + 520 + this.hp * 1800;
      this.pulse = 1;
      audio.sfx('heart');
    }
    this.pulse = Math.max(0, this.pulse - dt * 2.4);
    const beat = this.pulse * (hurt > 0 ? 1 : 0);
    this.hurtV.setAlpha(Math.min(1, this.hurtA * 0.45 + beat * 0.2));
    this.edgeV.setAlpha(Math.min(1, this.hurtA * 0.7 + beat * 0.25));

    // Hunger: Es gibt keinen Balken – der Magen knurrt, das Bild wird dunkler
    if (this.food < 0.3 && !this.hungerNoted) {
      this.hungerNoted = true;
      this.story('Dein Magen knurrt.');
    } else if (this.food > 0.5) this.hungerNoted = false;
    if (this.food < 0.12 && !this.weakNoted) {
      this.weakNoted = true;
      this.story('Der Hunger macht dich schwach.');
    } else if (this.food > 0.3) this.weakNoted = false;
    const hunger = this.food < 0.3 ? (0.3 - this.food) / 0.3 : 0;
    const starving = this.food <= 0.02 ? 0.12 + Math.sin(time / 600) * 0.08 : 0;
    this.hungerA = ease(this.hungerA, hunger * 0.65 + starving, 2);
    this.hungerV.setAlpha(Math.min(1, this.hungerA));

    // Versteckt im Dickicht
    this.hideA = ease(this.hideA, this.hidden ? 0.6 : 0, 5);
    this.hideV.setAlpha(this.hideA);

    this.portrait?.animate(dt, this.portrait.L.land ? 'idle' : 'swim', 0.2);
    this.tabletView?.update(dt);
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

  /** Der Schädel ist hart genug: Ab jetzt kann man gezielt rammen. */
  private ramUnlocked() {
    audio.sfx('evolve');
    const c = this.add.container(W / 2, H / 2 + 150).setDepth(20);
    const t1 = title(this, 0, 0, 'Harter Schädel', 34, UI.ochre).setOrigin(0.5);
    const t2 = text(this, 0, 40, this.isTouch ? 'Neu: Rammen – mit dem Knopf „Stoß“' : 'Neu: Stoßen – Taste R', 22, UI.bone, { stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5);
    c.add([t1, t2]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 700 });
    this.tweens.add({ targets: c, alpha: 0, delay: 5200, duration: 1200, onComplete: () => c.destroy() });
    if (this.isTouch) this.ramButton();
  }

  // ---------------------------------------------------------------- Rast (Pause)

  togglePause() {
    const lvl = this.scene.get('Level') as unknown as { ended?: boolean };
    if (this.tabletView) this.toggleTablet();
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
    c.add(this.add.image(W / 2 - 190, 470, 'shadow').setDisplaySize(240, 24).setAlpha(0.5));
    const v = new CreatureView(this, W / 2 - 190, 0, m, 1.6);
    v.setY(v.L.land ? 466 - v.L.footY * 1.6 : 400);
    c.add(v);
    this.portrait = v;
    c.add(text(this, W / 2 - 190, 518, CLASSES[m.cls].name, 20, UI.boneDim).setOrigin(0.5));

    const bx = W / 2 + 170;
    const b1 = new Button(this, bx, 270, 'Weiter', { w: 300, icon: 'ic_play', color: UI.ochreN, onClick: () => this.resumeGame() });
    const b3 = new Button(this, bx, 340, 'Steuerung', { w: 300, onClick: () => this.showControls() });
    const b2 = new Button(this, bx, 410, 'Aufgeben', { w: 300, icon: 'ic_skull', onClick: () => this.abort() });
    this.giveUp = b2;
    this.giveUpArmed = false;
    c.add([b1, b3, b2]);
    c.add(text(this, bx, 462, 'Wer aufgibt, lässt seine Linie aussterben.\nDas Spiel ist dann vorbei.', 17, UI.boneDim, { align: 'center' }).setOrigin(0.5, 0));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, [b1, b3, b2]);
  }

  /** Die Seite "Steuerung" in der Rast. */
  private showControls() {
    if (!this.pauseC) return;
    const c = this.add.container(0, 0).setDepth(55);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.88).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 420, 70, 840, 580, 0.97));
    c.add(title(this, W / 2, 124, 'Steuerung', 40).setOrigin(0.5));
    controlsList(this, c, W / 2 + 30, 180, 22, 38);
    c.add(text(this, W / 2, 548, 'Auf dem Handy erscheinen Knöpfe auf dem Bildschirm.', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
    const back = new Button(this, W / 2, 604, 'Zurück', { w: 240, h: 48, onClick: () => close() });
    c.add(back);
    if (this.pauseNav) this.pauseNav.enabled = false;
    const nav = new MenuNav(this, [back]);
    const close = () => {
      nav.enabled = false;
      c.destroy();
      this.input.keyboard!.off('keydown-ESC', onEsc);
      if (this.pauseNav) this.pauseNav.enabled = true;
    };
    const onEsc = () => close();
    this.input.keyboard!.on('keydown-ESC', onEsc);
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
    this.touchBtn(80, 610, 46, '◀', 'left');
    this.touchBtn(220, 610, 46, '▶', 'right');
    this.touchBtn(150, 540, 40, '▲', 'up');
    this.touchBtn(150, 680, 36, '▼', 'down');
    this.touchBtn(1190, 600, 60, 'Biss', 'bite', 0xc8473a);
    this.touchBtn(1060, 650, 50, water ? 'Hoch' : 'Sprung', 'jump', 0x9ab8b0);
    this.touchBtn(1070, 520, 44, 'Sprint', 'sprint', 0xc8913c);
    if (game.canRam) this.ramButton();
  }

  /** Der Stoß-Knopf. */
  private ramButton() {
    if (this.ramBtn) return;
    this.ramBtn = true;
    this.touchBtn(1195, 460, 44, 'Stoß', 'ram', 0xb89a70);
  }

  private touchBtn(x: number, y: number, r: number, label: string, key: keyof typeof touch, color = 0xe6dcc4) {
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
  }
}
