import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { bus, game, skillName, type SkillKey } from '../state/GameState';
import type { LevelScene } from './LevelScene';
import type { Kin } from '../objects/Kin';
import { EPOCHS, yearsAgo, type EpochDef } from '../data/epochs';
import { CLASSES } from '../data/classes';
import { touch } from '../objects/Controls';
import { CreatureView } from '../objects/CreatureView';
import type { Morph } from '../art/creatureArt';
import { Button, MenuNav, panel, soundButton, text, title } from '../ui/ui';

/** Erste Schritte: nur die Steuerung, nichts über das verborgene System. */
const HINTS: Record<string, [string, string]> = {
  ordovizium: [
    'Schwimmen: Pfeiltasten oder WASD  ·  Beißen und Fressen: J  ·  Sprinten: Shift  ·  Werte: C',
    'Schwimmen: Steuerkreuz  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
  karbon: [
    'Springen: Leertaste  ·  Beißen und Fressen: J  ·  Sprinten: Shift  ·  Werte: C',
    'Springen: Sprung  ·  Beißen und Fressen: Biss  ·  Sprinten: Sprint halten',
  ],
};

const TIPS: Record<string, string> = {
  ordovizium: 'Überlebe, bis das Zeitalter endet – und bleib bei Kräften. Links und rechts warten andere Gewässer.',
  karbon: 'Das Land ist fremd. Bleib wachsam.',
};

/**
 * Die Anzeige im Level: oben die Uhr des Zeitalters, sonst keine Zahlen und Balken.
 * Verletzung, Hunger und Verstecktsein zeigen sich am Bildrand, am Herzschlag und am Tier.
 */
export class HudScene extends Phaser.Scene {
  private ep!: EpochDef;
  private hurtV!: Phaser.GameObjects.Image;
  private edgeV!: Phaser.GameObjects.Image;
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
  private isTouch = false;
  private ramBtn = false;
  private foodG!: Phaser.GameObjects.Graphics;
  private foodText!: Phaser.GameObjects.Text;
  private foodV = { meat: 0, plant: 0, need: 1 };
  private zoneText!: Phaser.GameObjects.Text;
  private bossC!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossShown = false;
  private statsC?: Phaser.GameObjects.Container;

  constructor() {
    super('Hud');
  }

  init(d: { epoch: number }) {
    this.ep = EPOCHS[d?.epoch ?? 0];
    this.pauseC = undefined;
    this.portrait = undefined;
    this.giveUp = undefined;
    this.giveUpArmed = false;
    this.ramBtn = false;
    this.statsC = undefined;
    this.bossShown = false;
    this.foodV = { meat: 0, plant: 0, need: 1 };
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
    this.edgeV = this.add.image(W / 2, H / 2, 'edge_red').setDisplaySize(W, H).setAlpha(0);

    // Die Uhr des Zeitalters
    const g = this.add.graphics();
    g.fillStyle(0x050403, 0.55);
    g.fillRoundedRect(W / 2 - 200, 8, 400, 70, 12);
    title(this, W / 2, 26, ep.name.toUpperCase(), 18, UI.ochre).setOrigin(0.5).setLetterSpacing(3);
    const span = game.epochSpan();
    this.clockText = text(this, W / 2, 50, yearsAgo(span.from, (span.from - span.to) / ep.seconds / 10), 21, UI.bone).setOrigin(0.5);
    this.fuse = this.add.graphics();
    this.drawFuse();
    this.storyText = text(this, W / 2, 124, '', 20, UI.bone, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0).setAlpha(0);

    // Hunger: startet etwa halb voll, sinkt mit der Zeit (schneller, wenn man viel schwimmt)
    const fg = this.add.graphics();
    fg.fillStyle(0x050403, 0.55);
    fg.fillRoundedRect(W / 2 - 170, 84, 340, 22, 8);
    this.foodG = this.add.graphics();
    this.foodText = text(this, W / 2 - 160, 95, 'Hunger', 14, UI.boneDim).setOrigin(0, 0.5);
    this.drawFood();
    // Lebensbalken des Endgegners (unten)
    this.bossC = this.add.container(W / 2, H - 46).setAlpha(0).setDepth(8);
    this.bossName = title(this, 0, -18, '', 22, '#d8b070').setOrigin(0.5);
    this.bossBar = this.add.graphics();
    this.bossC.add([this.bossBar, this.bossName]);
    // Gebiet, in dem man gerade ist
    this.zoneText = text(this, 22, 18, ep.place, 17, UI.boneDim, { fontStyle: 'italic', stroke: '#050403', strokeThickness: 3 });

    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.togglePause() }).setAlpha(0.75);
    new Button(this, W - 156, 38, 'C', { w: 50, h: 50, onClick: () => this.toggleStats() }).setAlpha(0.75);
    soundButton(this, W - 40, 38, 50).setAlpha(0.75);

    // Zeitalter und Lebensraum einblenden
    const head = title(this, W / 2, H / 2 - 90, ep.place, 46).setOrigin(0.5).setAlpha(0);
    const round = game.run?.round ?? 0;
    const desc = round ? `Die ${round + 1}. Generation – der Herrscher dieser Zeit lebt noch.` : ep.desc;
    const sub = text(this, W / 2, H / 2 - 44, desc, 20, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [head, sub], alpha: 1, duration: 900, hold: 2200, yoyo: true });

    const isTouch = (this.isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch'));
    let hint = HINTS[ep.id]?.[isTouch ? 1 : 0];
    if (game.canRam && hint) hint += isTouch ? '\nStoß (betäubt kurz): Stoß-Knopf' : '\nStoß (betäubt kurz): R';
    if (hint) {
      const ht = text(this, W / 2, H - 70, hint, 21, UI.bone, { align: 'center', stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: ht, alpha: 1, duration: 700, delay: 1200, hold: 7000, yoyo: true });
    }
    const tip = TIPS[ep.id];
    if (tip) this.time.delayedCall(4200, () => this.story(tip));
    const run = game.run;
    if (run?.ramNew) {
      run.ramNew = false;
      this.time.delayedCall(5200, () => this.ramUnlocked());
    }

    if (isTouch) this.touchControls(ep.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.statsC ? this.toggleStats() : this.togglePause()));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-C', () => this.toggleStats());

    const onVitals = (hp: number, food: number, hidden: boolean) => {
      this.hp = hp;
      this.food = food;
      this.hidden = hidden;
      this.drawFood();
    };
    const onClock = (years: number, prog: number, step: number) => {
      this.clockText.setText(yearsAgo(years, step));
      this.prog = prog;
      this.drawFuse();
    };
    const onStory = (line: string) => this.story(line);
    const onApex = (name: string) => this.announce(name);
    const onRam = () => this.ramUnlocked();
    const onFood = (meat: number, plant: number, need: number) => {
      this.foodV = { meat, plant, need: Math.max(1, need) };
      this.drawFood();
    };
    const onZone = (name: string) => this.zoneText.setText(name);
    const onBoss = (name: string, f: number) => this.drawBoss(name, f);
    bus.on('boss', onBoss);
    bus.on('food', onFood);
    bus.on('zone', onZone);
    bus.on('vitals', onVitals);
    bus.on('clock', onClock);
    bus.on('story', onStory);
    bus.on('apex', onApex);
    bus.on('ramUnlocked', onRam);
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
      bus.off('clock', onClock);
      bus.off('story', onStory);
      bus.off('apex', onApex);
      bus.off('ramUnlocked', onRam);
      bus.off('food', onFood);
      bus.off('zone', onZone);
      bus.off('boss', onBoss);
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

  /** Die Hungerleiste: wie voll der Magen ist (das Maximum hängt von der Größe ab). */
  private drawFood() {
    const g = this.foodG;
    const x0 = W / 2 - 100, w = 250, y = 92;
    const f = Math.max(0, Math.min(1, this.food));
    g.clear();
    g.fillStyle(0x2a2420, 1);
    g.fillRect(x0, y, w, 6);
    const low = f < 0.2;
    g.fillStyle(low ? 0xb03a24 : f < 0.4 ? 0xb07a2c : 0xc8a050, 1);
    g.fillRect(x0, y, w * f, 6);
    g.lineStyle(1.2, 0x6a5638, 0.7);
    g.strokeRect(x0 - 1, y - 1, w + 2, 8);
    this.foodText.setColor(low ? '#d06048' : UI.boneDim);
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

  // ---------------------------------------------------------------- Werte (wie im Charakterbildschirm von Gothic)

  toggleStats() {
    if (this.statsC) {
      this.statsC.destroy();
      this.statsC = undefined;
      if (!this.pauseC) this.scene.resume('Level');
      return;
    }
    const lvl = this.scene.get('Level') as unknown as LevelScene;
    if (this.pauseC || !lvl || lvl.ended || !game.run) return;
    audio.sfx('select');
    this.scene.pause('Level');
    this.statsC = this.statsScreen(lvl);
  }

  private statsScreen(L: LevelScene): Phaser.GameObjects.Container {
    const run = game.run!;
    const t = run.traits;
    const p = L.player;
    const st = p.stats;
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.45).setOrigin(0).setInteractive().on('pointerdown', () => this.toggleStats()));
    const box = (x: number, w: number) => {
      const g = this.add.graphics();
      g.fillStyle(0x140f0a, 0.9);
      g.fillRect(x, 60, w, 600);
      g.lineStyle(2, 0x6a5638, 0.8);
      g.strokeRect(x, 60, w, 600);
      g.lineStyle(1, 0x6a5638, 0.35);
      g.strokeRect(x + 6, 66, w - 12, 588);
      c.add(g);
    };
    box(60, 560);
    box(660, 560);
    let y = 0;
    const head = (x: number, str: string) => {
      y += 14;
      c.add(title(this, x, y, str, 19, UI.ochre));
      const g = this.add.graphics();
      g.lineStyle(1, 0x6a5638, 0.6);
      g.lineBetween(x, y + 28, x + 500, y + 28);
      c.add(g);
      y += 36;
    };
    const row = (x: number, label: string, value: string, hi = false) => {
      c.add(text(this, x, y, label, 18, UI.boneDim));
      c.add(text(this, x + 500, y, value, 18, hi ? UI.ochre : UI.bone).setOrigin(1, 0));
      y += 26;
    };

    // ---- links: wer du bist
    const lx = 90;
    y = 80;
    c.add(title(this, W / 2 - 300, y, game.currentName, 24, UI.bone).setOrigin(0.5, 0));
    y += 34;
    c.add(text(this, W / 2 - 300, y, `${CLASSES[run.cls].name} · ${run.sex === 1 ? 'Männchen' : 'Weibchen'}`, 17, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5, 0));
    y += 26;
    head(lx, 'Linie');
    row(lx, 'Generation', String(run.history.length + 1));
    row(lx, 'Zeitalter', this.ep.name);
    row(lx, 'Gebiet', L.zoneAt(p.x).def.name);
    const ext = game.extinctCount(game.currentName);
    row(lx, 'Diese Art ausgestorben', ext ? `${ext}-mal` : 'noch nie', ext > 0);
    head(lx, 'Körper');
    const m = game.measure();
    row(lx, 'Länge', m.cm >= 100 ? `${(m.cm / 100).toFixed(2).replace('.', ',')} m` : `${Math.round(m.cm)} cm`);
    row(lx, 'Gewicht', m.g >= 1000 ? `${(m.g / 1000).toFixed(1).replace('.', ',')} kg` : `${Math.round(m.g)} g`);
    row(lx, 'Lebenskraft', `${Math.max(0, Math.round(p.hp))} / ${st.maxHp}`);
    // Was du in diesem Zeitalter getan hast – es formt, was aus deiner Art wird
    head(lx, 'Gelebt in diesem Zeitalter');
    const often = (v: number) => (v < 1 ? 'kaum' : v < 4 ? 'ab und zu' : v < 10 ? 'oft' : 'sehr oft');
    const tr = L.train;
    row(lx, 'Beute gepackt', often(tr.hunt), tr.hunt >= 10);
    row(lx, L.water ? 'Am Grund entlang' : 'Gelaufen', often(tr.ground), tr.ground >= 10);
    row(lx, 'Gerammt', often(tr.ram), tr.ram >= 10);
    row(lx, L.water ? 'Geschwommen' : 'Gerannt', often(tr.swim), tr.swim >= 10);

    // ---- rechts: was man von außen sieht – vieles andere bleibt verborgen
    const rx = 690;
    y = 80;
    head(rx, 'Fähigkeiten');
    const level = (v: number) => (v < 0.15 ? 'Anfänger' : v < 0.35 ? 'Geübt' : v < 0.6 ? 'Erfahren' : 'Meister');
    const skills = (['jaw', 'skull', 'stealth'] as SkillKey[]).filter((k) => t[k] >= 0.05);
    if (!skills.length) row(rx, 'Noch keine', '–');
    for (const k of skills) row(rx, skillName(k, t), level(t[k]));
    head(rx, 'Nahrung');
    const fv = this.foodV;
    row(rx, 'Gefressen', `${Math.round(fv.meat + fv.plant)} kcal`);
    row(rx, 'Magen', this.food < 0.2 ? 'fast leer' : this.food < 0.45 ? 'hungrig' : this.food < 0.8 ? 'satt' : 'voll', this.food < 0.2);
    head(rx, 'Gruppe');
    const kin = L.animals.filter((a) => a.kin && !a.dead) as unknown as Kin[];
    row(rx, 'Artgenossen', String(kin.length));
    const pk = t.pack ?? 0;
    row(rx, 'Zusammenhalt', pk < 0.12 ? 'Einzelgänger' : pk < 0.35 ? 'gesellig' : 'Rudeltier', pk >= 0.35);
    y += 20;
    c.add(text(this, rx + 250, y, 'Vieles an deinem Tier bleibt verborgen –\nes zeigt sich nur in dem, was es tut.', 17, UI.boneDim, { fontStyle: 'italic', align: 'center' }).setOrigin(0.5, 0));
    c.add(text(this, W / 2, 672, 'C oder Esc: zurück', 15, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
    return c;
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

  /** Der Schädel ist hart genug: Ab jetzt kann man gezielt rammen. */
  private ramUnlocked() {
    audio.sfx('evolve');
    const c = this.add.container(W / 2, H / 2 + 150).setDepth(20);
    const t1 = title(this, 0, 0, 'Harter Schädel', 34, UI.ochre).setOrigin(0.5);
    const t2 = text(this, 0, 40, this.isTouch ? 'Neu: Rammen – mit dem Knopf „Ramm“' : 'Neu: Rammen – Taste R', 22, UI.bone, { stroke: '#050403', strokeThickness: 5 }).setOrigin(0.5);
    c.add([t1, t2]);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 700 });
    this.tweens.add({ targets: c, alpha: 0, delay: 5200, duration: 1200, onComplete: () => c.destroy() });
    if (this.isTouch) this.ramButton();
  }

  // ---------------------------------------------------------------- Rast (Pause)

  togglePause() {
    const lvl = this.scene.get('Level') as unknown as { ended?: boolean };
    if (this.statsC) this.toggleStats();
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
    c.add(text(this, bx, 500, (game.canRam ? 'R: Stoß  ·  ' : '') + 'C: Werte  ·  M: Ton  ·  Esc: weiter', 16, UI.boneDim).setOrigin(0.5).setAlpha(0.7));
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
