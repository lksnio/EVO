import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { game, ZERO_TRAITS } from '../state/GameState';
import { CreatureView } from '../objects/CreatureView';
import { STARTER_FORMS } from '../sim/starterFish';
import { fishMarkKey } from '../sim/fishEvolution';
import { fishTree, fishTreeBranches, type FishBranch, type FishTreeNode } from '../sim/fishTree';
import { species } from '../net/Species';
import { CURSOR } from '../ui/cursor';
import { Button, text, title } from '../ui/ui';

const AREA = { x: 30, y: 132, w: 890, h: 498 };
const PANEL = { x: 954, y: 118, w: 300, h: 516 };
const GOLD = 0xe4c18d, GREEN = 0x8ac6b8, GHOST = 0x71817d;
const ROMAN = ['—', 'I', 'II', 'III'];
const TRAITS = ['Gebiss', 'Flossen', 'Schädel'];
const ROW = 68;
type Point = { x: number; y: number };

function formName(node: FishTreeNode) {
  const [g, f, k] = STARTER_FORMS[node.mark.form];
  if (!(g || f || k)) return 'Urfisch';
  if (node.mark.primary === 1 || g > k) return `Beißfisch ${ROMAN[g]}`;
  if (node.mark.primary === 3 || k) return `Stoßfisch ${ROMAN[k]}`;
  return `Flossenfisch ${ROMAN[f]}`;
}

/** The shell opens a living fan of exact shared ancestry, with legal, subdued paths beside the played routes. */
export class EvolutionScene extends Phaser.Scene {
  private plot!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Container;
  private accent!: Phaser.GameObjects.Graphics;
  private legend!: Phaser.GameObjects.Container;
  private views: CreatureView[] = [];
  private portrait?: CreatureView;
  private model = fishTree([]);
  private points = new Map<string, Point>();
  private colors = new Map<string, number>();
  private stamp = '';
  private selected?: string;
  private hovered?: string;
  private detailKey = '';
  private fit = 1;
  private treeHeight = 0;
  private treeWidth = 0;
  private navigated = false;
  private drag?: { x: number; y: number; px: number; py: number; moved: boolean };

  constructor() { super('Evolution'); }

  create() {
    this.views = []; this.points.clear(); this.selected = undefined; this.hovered = undefined;
    this.drag = undefined; this.detailKey = ''; this.stamp = ''; this.navigated = false;
    this.add.rectangle(0, 0, W, H, 0x090e0e).setOrigin(0).setInteractive();
    this.add.image(457, 386, 'glow').setDisplaySize(1120, 830).setTint(0xd8bc86)
      .setAlpha(.045).setBlendMode(Phaser.BlendModes.ADD);
    title(this, 32, 20, 'Stammbaum des Lebens', 30);
    text(this, 34, 65, 'Devon · Aus einem Anfang werden eure eigenen Wege.', 17, UI.boneDim, { fontStyle: 'italic' });
    new Button(this, W - 145, 48, 'Weiterschwimmen', { w: 236, h: 43, size: 16, onClick: () => this.close() });
    const lines = this.add.graphics();
    lines.lineStyle(1, 0xc5b08b, .16).lineBetween(32, 114, W - 30, 114);
    lines.lineStyle(1, 0xc5b08b, .13).lineBetween(PANEL.x - 18, 136, PANEL.x - 18, 625);
    lines.fillStyle(0x151b19, .7).fillRoundedRect(PANEL.x, PANEL.y + 8, PANEL.w, PANEL.h, 6);
    lines.lineStyle(1, 0xc5b08b, .16).lineBetween(32, 650, W - 30, 650);
    this.legend = this.add.container(34, 98);
    this.plot = this.add.container();
    this.info = this.add.container(PANEL.x, PANEL.y);
    new Button(this, 51, 684, '−', { w: 37, h: 32, size: 20, onClick: () => this.zoom(1 / 1.25) });
    new Button(this, 96, 684, '+', { w: 37, h: 32, size: 20, onClick: () => this.zoom(1.25) });
    new Button(this, 204, 684, 'Ganzer Baum', { w: 155, h: 32, size: 13, onClick: () => this.frame() });
    text(this, 301, 675, 'Mausrad: vergrößern · Ziehen: verschieben', 14, UI.boneDim);
    text(this, 301, 695, 'Tier berühren: Form ansehen · Anklicken: festhalten', 12, '#7e8981');
    text(this, W - 33, 684, 'ESC · ZURÜCK', 12, UI.boneDim).setOrigin(1, .5).setLetterSpacing(2);
    // A camera viewport clips both ink graphics and fish meshes, including while zooming and dragging.
    const treeCamera = this.cameras.add(AREA.x, AREA.y, AREA.w, AREA.h).setScroll(AREA.x, AREA.y);
    treeCamera.ignore(this.children.list.filter(child => child !== this.plot));
    this.cameras.main.ignore(this.plot);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-HOME', () => this.frame());
    this.input.keyboard?.on('keydown-LEFT', () => this.step(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.step(1));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.inside(p)) this.zoom(Math.exp(-dy * .0015), p);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.inside(p)) this.drag = { x: p.x, y: p.y, px: this.plot.x, py: this.plot.y, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) {
        if (Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 5) this.drag.moved = true;
        if (this.drag.moved) {
          this.navigated = true;
          this.plot.setPosition(this.drag.px + p.x - this.drag.x, this.drag.py + p.y - this.drag.y);
          this.constrain(); this.hovered = undefined;
          this.game.canvas.style.cursor = CURSOR.grabbing;
          return;
        }
      }
      const node = this.pick(p);
      this.hovered = node?.id;
      if (node) this.show(node); else this.showSelected();
      if (this.inside(p)) this.game.canvas.style.cursor = node ? CURSOR.inspect : CURSOR.grab;
      else if (p.y > AREA.y && p.y < AREA.y + AREA.h) this.game.canvas.style.cursor = CURSOR.arrow;
      this.drawAccent();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const node = this.drag && !this.drag.moved ? this.pick(p) : undefined;
      this.drag = undefined;
      if (node) { this.selected = node.id; this.show(node); this.drawAccent(); }
      if (this.inside(p)) this.game.canvas.style.cursor = node ? CURSOR.inspect : CURSOR.grab;
    });
    this.input.on('gameout', () => {
      this.drag = undefined; this.hovered = undefined; this.showSelected(); this.drawAccent();
      this.game.canvas.style.cursor = CURSOR.arrow;
    });
    this.events.once('shutdown', () => {
      this.game.canvas.style.cursor = CURSOR.arrow;
    });
    this.draw(true);
  }

  private close() { this.scene.resume('Hud'); this.scene.resume('Level'); this.scene.stop(); }
  private inside(p: Point) { return p.x >= AREA.x && p.x <= AREA.x + AREA.w && p.y >= AREA.y && p.y <= AREA.y + AREA.h; }

  private branches(): FishBranch[] {
    const id = `local-${game.run?.id}`;
    const own = { id, name: 'Deine Linie', trace: game.run?.fishTrace ?? [{ form: 0, primary: 0 }] };
    return fishTreeBranches(game.data.fishBranches ?? [], own, species.peerBranches);
  }

  private draw(initial = false) {
    const branches = this.branches();
    this.stamp = JSON.stringify(branches);
    this.plot.removeAll(true); this.views = []; this.points.clear(); this.colors.clear();
    this.model = fishTree(branches, true);
    const ownId = `local-${game.run?.id}`;
    let peer = 0;
    for (const b of branches) this.colors.set(b.id, b.extinct || b.archived ? 0x8a7765 : b.id === ownId ? GOLD : [GREEN, 0xafa5c7, 0xb7b99b][peer++ % 3]);
    const maxDepth = Math.max(3, ...this.model.nodes.map(n => n.depth));
    this.treeHeight = maxDepth * ROW + 58;
    const rootX = this.model.roots[0]?.x ?? this.model.width / 2;
    for (const n of this.model.nodes) this.points.set(n.id, {
      x: rootX + (n.x - rootX) * (.42 + .58 * n.depth / maxDepth),
      y: 28 + (maxDepth - n.depth) * ROW,
    });
    const xs = [...this.points.values()].map(p => p.x), left = Math.min(...xs) - 56;
    this.treeWidth = Math.max(...xs) - left + 56;
    for (const p of this.points.values()) p.x -= left;
    const g = this.add.graphics(); this.plot.add(g);
    for (const root of this.model.roots) {
      const p = this.points.get(root.id)!;
      g.lineStyle(7, 0x6c604b, .32).lineBetween(p.x, p.y + 18, p.x + 4, p.y + 38);
      g.lineStyle(2, GOLD, .35).lineBetween(p.x - 1, p.y + 18, p.x + 3, p.y + 38);
    }
    for (const parent of this.model.nodes) for (const child of parent.children) this.edge(g, parent, child);
    for (const node of this.model.nodes) this.drawNode(g, node);
    this.accent = this.add.graphics(); this.plot.add(this.accent);
    this.drawLegend(branches);
    const current = fishMarkKey(game.run?.fishTrace ?? [{ form: 0, primary: 0 }]);
    if (!this.selected || !this.model.nodes.some(n => n.id === this.selected)) this.selected = current;
    if (initial || !this.navigated) this.frame();
    this.detailKey = '';
    const hovered = this.model.nodes.find(n => n.id === this.hovered);
    if (hovered) this.show(hovered); else { this.hovered = undefined; this.showSelected(); }
    this.drawAccent();
  }

  private curve(from: Point, to: Point, offset = 0) {
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    return new Phaser.Curves.CubicBezier(V(from.x + offset, from.y + 12),
      V(from.x + offset, from.y - 30), V(to.x + offset, to.y + 42), V(to.x + offset, to.y + 12));
  }

  private edge(g: Phaser.GameObjects.Graphics, parent: FishTreeNode, child: FishTreeNode) {
    const a = this.points.get(parent.id)!, b = this.points.get(child.id)!;
    const curve = this.curve(a, b);
    g.lineStyle(child.possible ? 1.1 : 5, child.possible ? GHOST : 0x736650, child.possible ? .24 : .22).strokePoints(curve.getPoints(26));
    if (child.possible) return;
    const routes = child.routes;
    routes.forEach((branch, i) => {
      const c = this.colors.get(branch.id) ?? GOLD;
      const path = this.curve(a, b, (i - (routes.length - 1) / 2) * 3.5);
      g.lineStyle(branch.extinct || branch.archived ? 1.3 : 2.3, c, branch.extinct || branch.archived ? .42 : .9).strokePoints(path.getPoints(26));
    });
  }

  private drawNode(g: Phaser.GameObjects.Graphics, node: FishTreeNode) {
    const p = this.points.get(node.id)!;
    const color = node.possible ? GHOST : this.colors.get(node.routes.find(b => !b.extinct && !b.archived)?.id ?? '') ?? 0x8a7765;
    const d = node.possible ? 2.5 : 3.3;
    g.fillStyle(color, node.possible ? .45 : .95).fillPoints([
      new Phaser.Math.Vector2(p.x, p.y + 12 - d), new Phaser.Math.Vector2(p.x + d, p.y + 12),
      new Phaser.Math.Vector2(p.x, p.y + 12 + d), new Phaser.Math.Vector2(p.x - d, p.y + 12),
    ], true);
    if (!node.possible) {
      const view = new CreatureView(this, p.x, p.y - 9, this.morph(node), .85);
      view.setAlpha(node.routes.every(b => b.extinct || b.archived) ? .5 : 1);
      this.plot.add(view); this.views.push(view);
    }
    const parent = node.id.includes('/') ? this.model.nodes.find(n => n.children.includes(node)) : undefined;
    const axis = parent ? STARTER_FORMS[node.mark.form].findIndex((v, i) => v > STARTER_FORMS[parent.mark.form][i]) : -1;
    const endpoints = node.branches.some(b => !b.archived) ? node.branches.filter(b => !b.archived) : node.branches;
    const label = endpoints.length ? [...new Set(endpoints.map(b => b.name + (b.extinct ? ' ×' : b.archived ? ' · früher' : '')))].slice(0, 2).join(' · ')
      : axis < 0 ? 'Urfisch' : `${TRAITS[axis]} ${ROMAN[STARTER_FORMS[node.mark.form][axis]]}`;
    const t = text(this, p.x, p.y + 24, label, node.branches.length ? 12 : 11,
      node.possible ? '#7c8981' : node.branches.length ? UI.bone : UI.boneDim, { align: 'center', wordWrap: { width: 116 } }).setOrigin(.5, 0);
    t.setAlpha(node.possible ? .65 : .95); this.plot.add(t);
  }

  private drawLegend(branches: FishBranch[]) {
    this.legend.removeAll(true);
    let x = 0;
    const live = branches.filter(b => !b.extinct && !b.archived).sort((a, b) => Number(b.id.startsWith('local-')) - Number(a.id.startsWith('local-')));
    for (const b of live.slice(0, 3)) {
      const g = this.add.graphics().lineStyle(3, this.colors.get(b.id) ?? GOLD, .9).lineBetween(x, -4, x + 22, -4);
      const label = text(this, x + 30, -13, b.name, 14, UI.boneDim);
      this.legend.add([g, label]); x += Math.min(200, label.width + 58);
    }
    const g = this.add.graphics().lineStyle(1, GHOST, .55).lineBetween(x + 8, -4, x + 30, -4);
    this.legend.add([g, text(this, x + 39, -13, 'Mögliche Wege', 14, '#7c8981')]);
  }

  private morph(node: FishTreeNode) {
    const own = fishMarkKey(game.run?.fishTrace ?? []) === node.id;
    const [g, f, k] = STARTER_FORMS[node.mark.form];
    const traits = own ? game.traits : { ...ZERO_TRAITS, fishForm: node.mark.form, fishPrimary: node.mark.primary,
      biteGain: [10, 25, 60, 125][g] - 10, finGain: [10, 20, 50, 100][f] - 10, ramGain: [10, 25, 60, 125][k] - 10 };
    return game.morph({ traits });
  }

  private show(node: FishTreeNode) {
    if (this.detailKey === node.id) return;
    this.detailKey = node.id; this.info.removeAll(true); this.portrait = undefined;
    const cx = PANEL.w / 2;
    this.info.add(text(this, cx, 27, node.possible ? 'MÖGLICHE FORM' : 'GELEBTE FORM', 11, node.possible ? '#84948a' : UI.ochre).setOrigin(.5).setLetterSpacing(3));
    this.info.add(title(this, cx, 55, formName(node), 26).setOrigin(.5, 0));
    const m = this.morph(node);
    const view = new CreatureView(this, cx, 174, m, Math.min(2.8, 220 / Math.max(60, m.size * 80)));
    view.setName('evolution-portrait'); this.info.add(view); this.portrait = view;
    const bars = this.add.graphics(); this.info.add(bars);
    const stages = STARTER_FORMS[node.mark.form];
    TRAITS.forEach((name, i) => {
      const y = 267 + i * 51;
      this.info.add(text(this, 24, y, name, 17, UI.boneDim));
      this.info.add(text(this, PANEL.w - 23, y + 1, stages[i] ? `Stufe ${ROMAN[stages[i]]}` : 'Grundform', 14, stages[i] ? UI.bone : '#77867d').setOrigin(1, 0));
      for (let tier = 0; tier < 3; tier++) bars.fillStyle(tier < stages[i] ? [GOLD, GREEN, 0xafa5c7][i] : 0x39433c, tier < stages[i] ? .85 : .4)
        .fillRoundedRect(24 + tier * 85, y + 29, 79, 3, 1);
    });
    const routes = node.routes.some(b => !b.extinct && !b.archived) ? node.routes.filter(b => !b.extinct && !b.archived) : node.routes;
    const names = [...new Set(routes.map(b => b.name + (b.extinct ? ' · ausgestorben' : b.archived ? ' · früherer Verlauf' : '')))].slice(0, 3);
    const note = node.possible ? 'Ein unbeschrittener Weg. Diese Form kann in einer nächsten Generation entstehen.'
      : names.length ? names.join('\n') : 'Euer gemeinsamer Anfang.';
    this.info.add(text(this, cx, 443, note, 15, node.possible ? '#84948a' : UI.boneDim, { align: 'center', wordWrap: { width: 248 } }).setOrigin(.5, 0));
    this.info.add(text(this, cx, 226, node.mark.primary === 1 ? 'Gebiss als Hauptmerkmal' : node.mark.primary === 3 ? 'Schädel als Hauptmerkmal' : 'Der Anfang ist noch offen.', 13, '#84948a').setOrigin(.5));
  }

  private showSelected() { const n = this.model.nodes.find(n => n.id === this.selected) ?? this.model.roots[0]; if (n) this.show(n); }
  private drawAccent() {
    if (!this.accent) return;
    this.accent.clear();
    const id = this.hovered ?? this.selected;
    if (!id) return;
    const p = this.points.get(id); if (!p) return;
    // A short underline and a lit branch mark replace the former ring around every fish.
    this.accent.lineStyle(1.5, GOLD, .85).lineBetween(p.x - 17, p.y + 18, p.x + 17, p.y + 18);
    this.accent.fillStyle(GOLD, .9).fillRect(p.x - 2, p.y + 10, 4, 4);
  }

  private pick(p: Point) {
    if (!this.inside(p)) return;
    const x = (p.x - this.plot.x) / this.plot.scaleX, y = (p.y - this.plot.y) / this.plot.scaleY;
    let best: FishTreeNode | undefined, distance = Infinity;
    for (const n of this.model.nodes) {
      const at = this.points.get(n.id)!, dx = (x - at.x) / (n.possible ? 26 : 43), dy = (y - at.y) / (n.possible ? 25 : 29);
      const d = dx * dx + dy * dy;
      if (d <= 1 && d < distance) { distance = d; best = n; }
    }
    return best;
  }

  private frame() {
    this.navigated = false;
    this.fit = Math.min(1.2, (AREA.w - 38) / this.treeWidth, (AREA.h - 48) / this.treeHeight);
    this.plot.setScale(this.fit);
    this.plot.setPosition(AREA.x + (AREA.w - this.treeWidth * this.fit) / 2, AREA.y + (AREA.h - this.treeHeight * this.fit) / 2);
  }
  private zoom(factor: number, anchor: Point = { x: AREA.x + AREA.w / 2, y: AREA.y + AREA.h / 2 }) {
    this.navigated = true;
    const old = this.plot.scaleX, scale = Phaser.Math.Clamp(old * factor, this.fit * .8, Math.max(2, this.fit * 2.8));
    this.plot.setPosition(anchor.x - (anchor.x - this.plot.x) * scale / old, anchor.y - (anchor.y - this.plot.y) * scale / old);
    this.plot.setScale(scale); this.constrain();
  }
  private constrain() {
    const s = this.plot.scaleX;
    this.plot.x = Phaser.Math.Clamp(this.plot.x, AREA.x + 60 - this.treeWidth * s, AREA.x + AREA.w - 60);
    this.plot.y = Phaser.Math.Clamp(this.plot.y, AREA.y + 50 - this.treeHeight * s, AREA.y + AREA.h - 50);
  }
  private step(delta: number) {
    const i = this.model.nodes.findIndex(n => n.id === this.selected);
    const node = this.model.nodes[(i + delta + this.model.nodes.length) % this.model.nodes.length];
    this.selected = node.id; this.hovered = undefined; this.show(node); this.drawAccent();
    const p = this.points.get(node.id)!, x = this.plot.x + p.x * this.plot.scaleX, y = this.plot.y + p.y * this.plot.scaleY;
    if (!this.inside({ x, y })) { this.plot.x += AREA.x + AREA.w / 2 - x; this.plot.y += AREA.y + AREA.h / 2 - y; this.constrain(); }
  }

  update(_t: number, ms: number) {
    if (JSON.stringify(this.branches()) !== this.stamp) this.draw();
    const dt = Math.min(.05, ms / 1000);
    for (const view of this.views) view.animate(dt, 'idle', 0);
    this.portrait?.animate(dt, 'idle', 0);
  }
}
