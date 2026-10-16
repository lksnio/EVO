import Phaser from 'phaser';
import { W, H } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { eraById, type EraId } from '../data/eras';
import { CLASSES } from '../data/classes';
import { touch } from '../objects/Controls';
import { Button, MenuNav, panel, soundButton, text, title } from '../ui/ui';

const HINTS: Record<string, [string, string]> = {
  o1: [
    'Schwimmen: Pfeiltasten · Beißen: J oder X\nFriss das Fleisch besiegter Gegner für EVO-Punkte!',
    'Schwimmen: Steuerkreuz · Beißen: Biss-Knopf\nFriss das Fleisch besiegter Gegner für EVO-Punkte!',
  ],
  s1: [
    'Springen: Leertaste · Beißen: J oder X\nHast du ein Horn? Hornstoß mit K oder C!',
    'Springen: Sprung-Knopf · Beißen: Biss-Knopf\nMit einem Horn erscheint der Horn-Knopf.',
  ],
};

export class HudScene extends Phaser.Scene {
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private evoText!: Phaser.GameObjects.Text;
  private bossC!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private pauseC?: Phaser.GameObjects.Container;
  private pauseNav?: MenuNav;
  private era!: EraId;
  private nodeId = '';
  private hp = 1;
  private hpMax = 1;
  private shownHp = 1;

  constructor() {
    super('Hud');
  }

  init(d: { era: EraId; node: string }) {
    this.era = d.era;
    this.nodeId = d.node;
    this.pauseC = undefined;
  }

  create() {
    const era = eraById(this.era);
    const node = era.nodes.find((n) => n.id === this.nodeId)!;
    panel(this, 14, 12, 372, 96, 0.6);
    this.add.image(44, 42, 'heart_red').setScale(0.9);
    this.hpBar = this.add.graphics();
    this.hpText = text(this, 214, 42, '', 17, '#ffffff', { fontStyle: '700', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.add.image(44, 82, 'evo_gem').setScale(0.75);
    this.evoText = title(this, 68, 82, `${game.evo}`, 24, '#bff6ff').setOrigin(0, 0.5);
    text(this, 372, 82, `${CLASSES[game.data.cls].name} · ${node.name}`, 16, '#cfe2f2').setOrigin(1, 0.5);

    new Button(this, W - 104, 44, '', { w: 56, h: 56, icon: 'ic_pause', iconOnly: true, color: 0x3a6ea8, onClick: () => this.togglePause() });
    soundButton(this, W - 40, 44, 56);

    // Bossanzeige
    this.bossC = this.add.container(W / 2, H - 46).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(-330, -30, 660, 62, 16);
    this.bossBar = this.add.graphics();
    this.bossName = title(this, 0, -16, '', 20, '#ffd0c0').setOrigin(0.5);
    this.bossC.add([bg, this.bossBar, this.bossName]);

    // Ortsname einblenden
    const intro = title(this, W / 2, 150, node.name, 46).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: intro, alpha: 1, y: 140, duration: 500, hold: 1600, yoyo: true });
    const isTouch = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    const hint = HINTS[node.id]?.[isTouch ? 1 : 0];
    if (hint) {
      const ht = text(this, W / 2, 210, hint, 22, '#ffffff', { align: 'center', stroke: '#06121e', strokeThickness: 5, fontStyle: '700' }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: ht, alpha: 1, duration: 500, delay: 800, hold: 6000, yoyo: true });
    }

    if (isTouch) this.touchControls(era.habitat === 'water');

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());

    const onHp = (hp: number, max: number) => {
      this.hp = hp;
      this.hpMax = max;
    };
    const onEvo = (v: number) => {
      this.evoText.setText(`${v ?? game.evo}`);
      this.tweens.add({ targets: this.evoText, scale: { from: 1.3, to: 1 }, duration: 250 });
    };
    const onBossShow = (name: string, hp: number, max: number) => {
      this.bossC.setVisible(true);
      this.bossName.setText(name);
      this.drawBoss(hp, max);
      this.banner(name, 'Der Kampf beginnt!');
    };
    const onBossHp = (hp: number, max: number) => this.drawBoss(hp, max);
    const onBossHide = () => this.bossC.setVisible(false);
    const onBanner = (a: string, b: string) => this.banner(a, b);
    bus.on('hp', onHp);
    bus.on('evo', onEvo);
    bus.on('bossShow', onBossShow);
    bus.on('bossHp', onBossHp);
    bus.on('bossHide', onBossHide);
    bus.on('banner', onBanner);
    this.events.once('shutdown', () => {
      bus.off('hp', onHp);
      bus.off('evo', onEvo);
      bus.off('bossShow', onBossShow);
      bus.off('bossHp', onBossHp);
      bus.off('bossHide', onBossHide);
      bus.off('banner', onBanner);
      for (const k of Object.keys(touch) as (keyof typeof touch)[]) touch[k] = false;
    });
    this.events.on('resume', () => {
      this.evoText.setText(`${game.evo}`);
      this.pauseNav && (this.pauseNav.enabled = true);
    });
    const lvl = this.scene.get('Level') as unknown as { player?: { hp: number; stats: { hp: number } } };
    if (lvl.player) onHp(lvl.player.hp, lvl.player.stats.hp);
    this.shownHp = this.hp;
  }

  update(_t: number, dms: number) {
    this.shownHp += (this.hp - this.shownHp) * Math.min(1, (dms / 1000) * 8);
    const g = this.hpBar;
    const x = 70, y = 31, w = 300, h = 22;
    const f = Math.max(0, Math.min(1, this.shownHp / this.hpMax));
    g.clear();
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x, y, w, h, 10);
    const col = f > 0.5 ? 0x5ad05a : f > 0.25 ? 0xf0c030 : 0xf04a3a;
    if (f > 0.01) {
      g.fillStyle(col, 1);
      g.fillRoundedRect(x + 2, y + 2, Math.max(8, (w - 4) * f), h - 4, 8);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(x + 4, y + 3, Math.max(4, (w - 8) * f), 6, 3);
    }
    this.hpText.setText(`${Math.ceil(this.hp)} / ${this.hpMax}`);
  }

  private drawBoss(hp: number, max: number) {
    const g = this.bossBar;
    g.clear();
    g.fillStyle(0x2a0a0a, 1);
    g.fillRoundedRect(-310, 2, 620, 20, 8);
    g.fillStyle(0xe03a3a, 1);
    g.fillRoundedRect(-308, 4, Math.max(0, 616 * (hp / max)), 16, 7);
  }

  private banner(a: string, b: string) {
    const c = this.add.container(W / 2, H / 2 - 60).setDepth(20);
    const t1 = title(this, 0, 0, a, 58, '#ffe680').setOrigin(0.5);
    const t2 = title(this, 0, 56, b, 26, '#ffffff').setOrigin(0.5);
    c.add([t1, t2]);
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 350, ease: 'Back.out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 500, onComplete: () => c.destroy() });
  }

  // ---------------------------------------------------------------- Pause

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
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 220, 150, 440, 420));
    c.add(title(this, W / 2, 200, 'Pause', 50).setOrigin(0.5));
    const b1 = new Button(this, W / 2, 290, 'Weiter', { w: 300, color: 0xf08a24, icon: 'ic_play', onClick: () => this.resumeGame() });
    const b2 = new Button(this, W / 2, 370, 'Evolution', { w: 300, color: 0x8a4ad0, icon: 'ic_dna', onClick: () => this.openEvolution() });
    const b3 = new Button(this, W / 2, 450, 'Zur Karte', { w: 300, color: 0x3a6ea8, icon: 'ic_map', onClick: () => this.abort() });
    c.add([b1, b2, b3]);
    c.add(text(this, W / 2, 525, 'Beim Verlassen bleibt alles Gesammelte erhalten.', 17, '#cfe2f2').setOrigin(0.5));
    this.pauseC = c;
    this.pauseNav = new MenuNav(this, [b1, b2, b3]);
  }

  private resumeGame() {
    if (!this.pauseC) return;
    this.pauseC.destroy();
    this.pauseC = undefined;
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.pauseNav = undefined;
    this.scene.resume('Level');
  }

  private openEvolution() {
    if (this.pauseNav) this.pauseNav.enabled = false;
    this.scene.launch('Evolution', { from: 'Hud', inLevel: true });
    this.scene.bringToTop('Evolution');
    this.scene.pause();
  }

  private abort() {
    this.resumeGame();
    bus.emit('abortLevel');
  }

  // ---------------------------------------------------------------- Touch

  private touchControls(water: boolean) {
    this.input.addPointer(3);
    const btn = (x: number, y: number, r: number, label: string, key: keyof typeof touch, color = 0xffffff) => {
      const g = this.add.graphics().setDepth(5);
      const draw = (down: boolean) => {
        g.clear();
        g.fillStyle(color, down ? 0.45 : 0.22);
        g.fillCircle(x, y, r);
        g.lineStyle(3, 0xffffff, down ? 0.9 : 0.5);
        g.strokeCircle(x, y, r);
      };
      draw(false);
      text(this, x, y, label, r > 50 ? 22 : 18, '#ffffff', { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
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
    btn(1190, 600, 60, 'Biss', 'bite', 0xff8a6a);
    btn(1060, 650, 50, water ? 'Hoch' : 'Sprung', 'jump', 0x6ad0ff);
    if (game.stats().horn > 0) btn(1075, 520, 42, 'Horn', 'horn', 0xffe080);
  }
}
