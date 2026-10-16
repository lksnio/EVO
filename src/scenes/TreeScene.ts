import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, speciesName, type TreeNode } from '../state/GameState';
import { EPOCHS, shortYears, yearsAgo } from '../data/epochs';
import { CLASSES, type ClassId } from '../data/classes';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';
import { startNewLife } from './flow';

type TreeData =
  | { mode: 'extinct'; leaf: string; morph: Morph; epoch: number; cause: string; years: number }
  | { mode: 'present'; node: string }
  | { mode?: 'view' };

const TOP = 112;
const ROW = 45;
const AX = 196; // linke Kante des Baums
const AW = 724; // Breite des Baumbereichs
const PANEL_X = 944;

const CLS_COLOR: Record<ClassId, number> = {
  fish: 0x6f9e98,
  amphibian: 0x86a060,
  reptile: 0xb08250,
  mammal: 0xd2aa72,
};

const rowY = (epoch: number) => TOP + (epoch + 1) * ROW;

interface Pos {
  n: TreeNode;
  x: number;
  y: number;
}

/**
 * Der Stammbaum des Lebens – außerhalb des Spiels. Jedes Spiel ist ein Pfad von der Wurzel
 * nach unten (= in der Zeit nach vorne). Linien, die sich gleichen, teilen sich einen Ast;
 * ausgestorbene Zweige enden mit einem Schädel. Zeitalter, die noch niemand erreicht hat,
 * bleiben Fragezeichen.
 */
export class TreeScene extends Phaser.Scene {
  private d!: TreeData;
  private pos = new Map<string, Pos>();
  private treeC!: Phaser.GameObjects.Container;
  private lines!: Phaser.GameObjects.Graphics;
  private path!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Container;
  private infoView?: CreatureView;
  private views: CreatureView[] = [];
  private lastPath: string[] = [];
  private panX = 0;
  private minPan = 0;
  private drag?: { x: number; pan: number };
  private overlay?: Phaser.GameObjects.Container;
  private nav?: MenuNav;
  private selected = '';

  constructor() {
    super('Tree');
  }

  init(d: TreeData) {
    this.d = d ?? { mode: 'view' };
    this.pos = new Map();
    this.views = [];
    this.infoView = undefined;
    this.overlay = undefined;
    this.panX = 0;
    this.drag = undefined;
    this.selected = '';
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    this.cameras.main.setBackgroundColor('#070605');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0b09, 0x0d0b09, 0x040303, 0x040303, 1);
    bg.fillRect(0, 0, W, H);

    this.layout();

    // Baum (verschiebbar, falls er breiter wird als der Platz)
    this.treeC = this.add.container(0, 0);
    this.lines = this.add.graphics();
    this.path = this.add.graphics();
    this.hover = this.add.graphics();
    this.treeC.add([this.lines, this.path, this.hover]);
    this.drawTree();

    // Zeitachse links (deckt den Baum ab, wenn man ihn verschiebt)
    const axis = this.add.graphics();
    axis.fillStyle(0x070605, 1);
    axis.fillRect(0, 0, AX - 14, H);
    axis.fillGradientStyle(0x070605, 0x070605, 0x070605, 0x070605, 1, 0, 1, 0);
    axis.fillRect(AX - 14, 0, 18, H);
    this.axisLabels();

    // Kopfzeile
    title(this, 30, 20, 'Stammbaum des Lebens', 32);
    text(this, 32, 62, 'Jedes Spiel ist ein Ast. Nach unten vergeht die Zeit.', 17, UI.boneDim, { fontStyle: 'italic' });

    // Infotafel rechts
    const pg = this.add.graphics();
    pg.fillStyle(0x070605, 1);
    pg.fillRect(PANEL_X - 14, 0, W - PANEL_X + 14, H);
    pg.fillStyle(0x121110, 0.92);
    pg.fillRoundedRect(PANEL_X, 96, W - PANEL_X - 18, 470, 14);
    pg.lineStyle(2, UI.panelEdge, 0.55);
    pg.strokeRoundedRect(PANEL_X + 1, 97, W - PANEL_X - 20, 468, 14);
    this.info = this.add.container(0, 0);

    const b1 = new Button(this, PANEL_X + (W - PANEL_X - 18) / 2, 608, 'Neues Leben', { w: 290, h: 54, icon: 'ic_play', color: UI.ochreN, onClick: () => this.newLife() });
    const b2 = new Button(this, PANEL_X + (W - PANEL_X - 18) / 2, 670, 'Titelbild', { w: 290, h: 46, size: 19, icon: 'ic_home', onClick: () => fadeTo(this, 'Title') });
    this.nav = new MenuNav(this, [b1, b2], 1, () => fadeTo(this, 'Title'));

    // Auswahl per Maus/Finger
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.overlay) return;
      if (this.drag && p.isDown) {
        this.panTo(this.drag.pan + (p.x - this.drag.x));
        return;
      }
      const n = this.pick(p.x, p.y);
      if (n) this.select(n.n.id);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.overlay) return this.closeOverlay();
      if (p.x > AX - 10 && p.x < PANEL_X - 10) {
        const n = this.pick(p.x, p.y);
        if (n) this.select(n.n.id);
        else this.drag = { x: p.x, pan: this.panX };
      }
    });
    this.input.on('pointerup', () => (this.drag = undefined));
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => this.panTo(this.panX - (dx || dy) * 0.6));

    const end = this.d.mode === 'extinct' ? this.d.leaf : this.d.mode === 'present' ? this.d.node : game.data.lastEnd;
    this.select(end && this.pos.has(end) ? end : 'root');
    // den eigenen Pfad ins Bild rücken
    const ep = end ? this.pos.get(end) : undefined;
    if (ep) this.panTo((AX + AW / 2) - ep.x);

    if (this.d.mode === 'extinct') this.extinctOverlay(this.d);
    else if (this.d.mode === 'present') this.presentOverlay();
    else this.revealPath(false);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    for (const v of this.views) v.animate(dt, v.L.land ? 'idle' : 'swim', 0.15);
    this.infoView?.animate(dt, this.infoView.L.land ? 'idle' : 'swim', 0.25);
  }

  // ---------------------------------------------------------------- Aufbau

  /** Blätter gleichmäßig verteilen, innere Knoten in die Mitte ihrer Kinder. */
  private layout() {
    const nodes = game.data.nodes;
    const order = (ids: string[]) => [...ids].sort((a, b) => (nodes[a]?.last ?? 0) - (nodes[b]?.last ?? 0) || a.localeCompare(b));
    const leaves: string[] = [];
    const walk = (id: string) => {
      const n = nodes[id];
      if (!n) return;
      const kids = order(n.children).filter((c) => nodes[c]);
      if (!kids.length) leaves.push(id);
      for (const c of kids) walk(c);
    };
    walk('root');
    const L = leaves.length;
    const gap = L <= 1 ? 0 : Math.max(16, Math.min(56, (AW - 80) / (L - 1)));
    const total = gap * Math.max(0, L - 1);
    const x0 = AX + AW / 2 - total / 2;
    leaves.forEach((id, i) => this.place(nodes[id], x0 + i * gap));
    const post = (id: string): number => {
      const n = nodes[id];
      const p = this.pos.get(id);
      if (p) return p.x;
      const xs = n.children.filter((c) => nodes[c]).map(post);
      const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : AX + AW / 2;
      this.place(n, x);
      return x;
    };
    post('root');
    this.minPan = Math.min(0, AW - 60 - total);
  }

  private place(n: TreeNode, x: number) {
    let y = rowY(n.epoch);
    if (n.dead) {
      const parent = n.parent ? game.data.nodes[n.parent] : undefined;
      const py = parent ? rowY(parent.epoch) : rowY(-1);
      y = py + Math.max(12, n.dead.frac * (rowY(n.epoch) - py));
    }
    this.pos.set(n.id, { n, x, y });
  }

  private drawTree() {
    const g = this.lines;
    g.clear();
    // Zeitbänder: jedes zweite Zeitalter etwas heller
    for (let i = 0; i < EPOCHS.length; i += 2) {
      g.fillStyle(0xffffff, 0.022);
      g.fillRect(AX - 400, rowY(i - 1), AW + 4400, ROW);
    }
    // Zeitlinien
    for (let i = -1; i <= EPOCHS.length; i++) {
      g.lineStyle(1, 0xffffff, i === -1 ? 0 : 0.035);
      g.lineBetween(AX - 400, rowY(i), AX + AW + 4000, rowY(i));
    }
    for (const p of this.pos.values()) {
      const n = p.n;
      if (!n.parent) continue;
      const pp = this.pos.get(n.parent);
      if (!pp) continue;
      const w = 1.6 + 1.5 * Math.log2(1 + n.runs);
      const col = CLS_COLOR[n.cls];
      this.curve(g, pp.x, pp.y, p.x, p.y, w, col, n.dead ? 0.5 : 0.85);
    }
    // bis heute überlebt
    for (const p of this.pos.values()) {
      if (!p.n.present) continue;
      const yy = rowY(EPOCHS.length);
      g.lineStyle(2 + p.n.present, 0xe6d2a0, 0.85);
      g.lineBetween(p.x, p.y, p.x, yy);
      const glow = this.add.image(p.x, yy, 'glow').setScale(0.6).setTint(0xffe2a8).setBlendMode(Phaser.BlendModes.ADD);
      this.treeC.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.5, yoyo: true, repeat: -1, duration: 1400 });
    }
    // Knoten und Aussterbe-Zeichen
    for (const p of this.pos.values()) {
      const n = p.n;
      if (n.id === 'root') {
        g.fillStyle(0xe6dcc4, 1);
        g.fillCircle(p.x, p.y, 6);
        continue;
      }
      if (n.dead) {
        const sk = this.add.image(p.x, p.y + 7, 'ic_skull').setScale(0.36).setTint(0xa8392c);
        this.treeC.add(sk);
        continue;
      }
      g.fillStyle(CLS_COLOR[n.cls], 1);
      g.fillCircle(p.x, p.y, 3.6 + Math.min(3, n.runs * 0.4));
      g.lineStyle(1, 0x000000, 0.6);
      g.strokeCircle(p.x, p.y, 3.6 + Math.min(3, n.runs * 0.4));
    }
  }

  private curve(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number) {
    const my = y0 + (y1 - y0) * 0.5;
    const c = new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(x0, my), new Phaser.Math.Vector2(x1, my), new Phaser.Math.Vector2(x1, y1));
    g.lineStyle(w, col, a);
    g.strokePoints(c.getPoints(22));
  }

  private axisLabels() {
    const deepest = game.data.deepest;
    text(this, 24, rowY(-1) - 9, 'Urahn', 16, UI.boneDim);
    EPOCHS.forEach((ep, i) => {
      const y = rowY(i);
      if (i <= deepest) {
        text(this, 24, y - 17, ep.name, 16, UI.bone);
        text(this, 24, y + 1, shortYears(ep.to), 13, UI.boneDim);
      } else title(this, 24, y - 12, '?', 18, '#5e554a');
    });
    const reachedNow = Object.values(game.data.nodes).some((n) => n.present);
    if (reachedNow) text(this, 24, rowY(EPOCHS.length) - 9, 'Heute', 16, UI.ochre);
    else title(this, 24, rowY(EPOCHS.length) - 12, '?', 18, '#5e554a');
  }

  // ---------------------------------------------------------------- Dein Weg

  /** Den Pfad des letzten Spiels hervorheben – auf Wunsch Stück für Stück. */
  private revealPath(animate: boolean) {
    const end = this.d.mode === 'extinct' ? this.d.leaf : this.d.mode === 'present' ? this.d.node : game.data.lastEnd;
    this.lastPath = game.pathTo(end ?? null).filter((id) => this.pos.has(id));
    const segs = this.lastPath.slice(1);
    const g = this.path;
    g.clear();
    const drawSeg = (i: number) => {
      const p = this.pos.get(segs[i])!;
      const pp = this.pos.get(this.lastPath[i])!;
      this.curve(g, pp.x, pp.y, p.x, p.y, 4.2, 0xf0dcae, 0.95);
      // kleine Porträts entlang des eigenen Weges
      if (!p.n.dead && this.views.length < 12) {
        const v = new CreatureView(this, p.x + 26, 0, this.morphOf(p.n), 0.34);
        v.setY(v.L.land ? p.y - v.L.footY * 0.34 + 4 : p.y - 2);
        this.treeC.add(v);
        this.views.push(v);
      }
    };
    if (!animate) {
      segs.forEach((_s, i) => drawSeg(i));
      return;
    }
    segs.forEach((_s, i) => this.time.delayedCall(250 + i * 280, () => {
      drawSeg(i);
      audio.sfx('step');
      if (i === segs.length - 1) {
        const last = this.pos.get(segs[i])!;
        const ring = this.add.circle(last.x, last.y, 10).setStrokeStyle(2, last.n.dead ? 0xc8473a : 0xffe2a8);
        this.treeC.add(ring);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 1200, repeat: 2 });
      }
    }));
  }

  private morphOf(n: TreeNode): Morph {
    return game.morph({ cls: n.cls, traits: n.traits, hue: n.hue, seed: n.seed, fierce: 0, sex: 0 });
  }

  // ---------------------------------------------------------------- Auswahl

  private pick(px: number, py: number): Pos | null {
    let best: Pos | null = null;
    let bd = 16;
    for (const p of this.pos.values()) {
      const d = Math.hypot(p.x + this.panX - px, p.y - py);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private select(id: string) {
    if (id === this.selected) return;
    this.selected = id;
    const p = this.pos.get(id);
    const h = this.hover;
    h.clear();
    if (!p) return;
    h.lineStyle(2, 0xffe2a8, 0.9);
    h.strokeCircle(p.x, p.y, 10);
    this.showInfo(p.n);
  }

  private showInfo(n: TreeNode) {
    const c = this.info;
    c.removeAll(true);
    this.infoView = undefined;
    const cx = PANEL_X + (W - PANEL_X - 18) / 2;
    const nodes = game.data.nodes;
    c.add(this.add.image(cx, 300, 'pedestal').setScale(0.9, 0.8).setAlpha(n.epoch < 0 ? 0.5 : 1));
    const v = new CreatureView(this, cx, 0, this.morphOf(n), 1.15);
    v.setY(v.L.land ? 296 - v.L.footY * 1.15 : 240);
    if (n.dead) v.setAlpha(0.55);
    c.add(v);
    this.infoView = v;
    c.add(title(this, cx, 116, speciesName(n), 19, UI.bone).setOrigin(0.5, 0).setWordWrapWidth(290).setAlign('center'));
    c.add(text(this, cx, 150, n.epoch < 0 ? 'Der Anfang aller Linien' : CLASSES[n.cls].name, 16, UI.boneDim).setOrigin(0.5, 0));
    const lines: string[] = [];
    if (n.epoch < 0) {
      lines.push(`${game.data.runs} ${game.data.runs === 1 ? 'Leben begann' : 'Leben begannen'} hier.`);
    } else if (n.dead) {
      const ep = EPOCHS[n.epoch];
      const years = ep.from - (ep.from - ep.to) * n.dead.frac;
      lines.push(`Ausgestorben im ${ep.name},`, `${yearsAgo(years, 1e4)}.`, `Ursache: ${n.dead.cause}`);
    } else {
      const ep = EPOCHS[n.epoch];
      lines.push(`Überlebte das ${ep.name}`, `(bis ${shortYears(ep.to)} vor heute).`);
      lines.push(`${n.runs} ${n.runs === 1 ? 'Linie zog' : 'Linien zogen'} hier durch.`);
      const deadKids = n.children.filter((k) => nodes[k]?.dead).length;
      if (deadKids) lines.push(`${deadKids} ${deadKids === 1 ? 'Zweig starb' : 'Zweige starben'} danach aus.`);
      if (n.present) lines.push('Diese Linie lebt bis heute.');
    }
    c.add(text(this, cx, 330, lines.join('\n'), 17, UI.bone, { align: 'center', lineSpacing: 4, wordWrap: { width: 290 } }).setOrigin(0.5, 0));
  }

  private panTo(x: number) {
    this.panX = Phaser.Math.Clamp(x, this.minPan, 0);
    this.treeC.x = this.panX;
  }

  // ---------------------------------------------------------------- Einblendungen

  /** "Deine Linie ist ausgestorben." */
  private extinctOverlay(d: Extract<TreeData, { mode: 'extinct' }>) {
    audio.sfx('extinct');
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x030202, 0.97).setOrigin(0));
    const ep = EPOCHS[d.epoch];
    const v = new CreatureView(this, W / 2, 330, { ...d.morph, belly: 0 }, 2);
    v.setAngle(180);
    v.flash(0x5a4e4a);
    v.setAlpha(0);
    c.add(v);
    this.tweens.add({ targets: v, alpha: 0.75, duration: 1400 });
    const t1 = title(this, W / 2, 150, 'Deine Linie ist ausgestorben.', 42, '#c8473a').setOrigin(0.5).setAlpha(0);
    const t2 = text(this, W / 2, 460, `${ep.name} · ${yearsAgo(d.years, 1e4)}`, 22, UI.bone).setOrigin(0.5).setAlpha(0);
    const t3 = text(this, W / 2, 496, `Ursache: ${d.cause}`, 19, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    const t4 = text(this, W / 2, 590, 'Doch dein Versuch bleibt – als Ast im Stammbaum des Lebens.', 20, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    c.add([t1, t2, t3, t4]);
    this.tweens.add({ targets: t1, alpha: 1, duration: 1200 });
    this.tweens.add({ targets: [t2, t3], alpha: 1, duration: 1000, delay: 1100 });
    this.tweens.add({ targets: t4, alpha: 1, duration: 1000, delay: 2600 });
    const hint = text(this, W / 2, H - 36, 'Weiter mit Klick oder Enter', 15, UI.boneDim).setOrigin(0.5).setAlpha(0);
    c.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.7, duration: 800, delay: 3600 });
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
    this.input.keyboard!.once('keydown', () => this.closeOverlay());
    this.time.delayedCall(9000, () => this.closeOverlay());
  }

  private presentOverlay() {
    audio.sfx('victory');
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x050403, 0.94).setOrigin(0));
    const glow = this.add.image(W / 2, H / 2 - 40, 'glow').setScale(7).setTint(0xffe2a8).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    c.add(glow);
    c.add(title(this, W / 2, H / 2 - 60, 'Deine Linie lebt bis heute.', 42, '#f0e2c0').setOrigin(0.5));
    c.add(text(this, W / 2, H / 2, 'Ein Ast, der bis in die Gegenwart reicht.', 21, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5));
    this.overlay = c;
    if (this.nav) this.nav.enabled = false;
    this.input.keyboard!.once('keydown', () => this.closeOverlay());
    this.time.delayedCall(5000, () => this.closeOverlay());
  }

  private closeOverlay() {
    const c = this.overlay;
    if (!c) return;
    this.overlay = undefined;
    this.tweens.add({
      targets: c,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        c.destroy();
        if (this.nav) this.nav.enabled = true;
      },
    });
    this.revealPath(true);
  }

  private newLife() {
    if (this.overlay) return;
    startNewLife(this);
  }
}
