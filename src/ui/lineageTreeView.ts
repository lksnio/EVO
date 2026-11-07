import Phaser from 'phaser';
import { H, UI, W } from '../config';
import { game, ZERO_TRAITS } from '../state/GameState';
import { species } from '../net/Species';
import { CreatureView } from '../objects/CreatureView';
import { fishTreeBranches } from '../sim/fishTree';
import { evolutionNodeKey, lineageTree, type EvolutionNode, type EvolutionRoute } from '../sim/lineageTree';
import { lineageFormName, lineageSummary } from '../sim/lineageEvolution';
import { historyBranchName } from './historyText';
import { CURSOR } from './cursor';
import { Button, text, title } from './ui';

const AREA = { x: 28, y: 132, w: 890, h: 498 };
const PANEL = { x: 950, y: 126, w: 302, h: 508 };
const GOLD = 0xe4c18d, GREEN = 0x8ac6b8, GHOST = 0x71817d;
type Point = { x: number; y: number };

function routeName(route: EvolutionRoute) {
  return route.name + (route.extinct ? ' · extinct' : route.archived ? ' · earlier' : '');
}

/** The visible evolutionary choices: two habitats and two distinct weapons, with both players' paths preserved. */
export class LineageTreeView {
  readonly plot: Phaser.GameObjects.Container;
  readonly points = new Map<string, Point>();
  model = lineageTree([]);
  portrait?: CreatureView;
  selected = evolutionNodeKey(game.evolution);
  hovered?: string;
  detailKey = '';
  private readonly info: Phaser.GameObjects.Container;
  private readonly legend: Phaser.GameObjects.Container;
  private accent!: Phaser.GameObjects.Graphics;
  private views: CreatureView[] = [];
  private routes: EvolutionRoute[] = [];
  private colors = new Map<string, number>();
  private stamp = '';
  private fit = 1;
  private navigated = false;
  private drag?: { x: number; y: number; px: number; py: number; moved: boolean };

  constructor(private readonly scene: Phaser.Scene, close: () => void) {
    scene.add.rectangle(0, 0, W, H, 0x090e0e).setOrigin(0).setInteractive();
    scene.add.image(460, 380, 'glow').setDisplaySize(1120, 830).setTint(0xd8bc86).setAlpha(.045).setBlendMode(Phaser.BlendModes.ADD);
    title(scene, 32, 20, 'Tree of Life', 30);
    text(scene, 34, 65, `${game.epoch.name} · One beginning, your own paths.`, 17, UI.boneDim, { fontStyle: 'italic' });
    new Button(scene, W - 144, 48, 'Return to life', { w: 236, h: 43, size: 16, onClick: close });
    const lines = scene.add.graphics();
    lines.lineStyle(1, 0xc5b08b, .16).lineBetween(32, 114, W - 30, 114);
    lines.lineStyle(1, 0xc5b08b, .13).lineBetween(932, 138, 932, 626);
    lines.fillStyle(0x151b19, .7).fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 6);
    lines.lineStyle(1, 0xc5b08b, .16).lineBetween(32, 650, W - 30, 650);
    this.plot = scene.add.container(AREA.x, AREA.y).setName('lineage-tree-plot');
    this.info = scene.add.container(PANEL.x, PANEL.y).setName('lineage-tree-info');
    this.legend = scene.add.container(34, 98);
    new Button(scene, 51, 684, '−', { w: 37, h: 32, size: 20, onClick: () => this.zoom(1 / 1.25) });
    new Button(scene, 96, 684, '+', { w: 37, h: 32, size: 20, onClick: () => this.zoom(1.25) });
    new Button(scene, 204, 684, 'Whole tree', { w: 155, h: 32, size: 13, onClick: () => this.frame() });
    text(scene, 301, 675, 'Scroll: zoom · Drag: pan · ← →: browse', 14, UI.boneDim);
    text(scene, 301, 695, 'Hover over an animal: preview · Click: pin', 12, '#7e8981');
    text(scene, W - 33, 684, 'ESC · BACK', 12, UI.boneDim).setOrigin(1, .5).setLetterSpacing(2);
    // Only the tree is visible to this viewport, including its subsequently created animal meshes.
    const camera = scene.cameras.add(AREA.x, AREA.y, AREA.w, AREA.h).setScroll(AREA.x, AREA.y);
    camera.ignore(scene.children.list.filter(child => child !== this.plot));
    scene.cameras.main.ignore(this.plot);
    scene.input.keyboard?.on('keydown-ESC', close);
    scene.input.keyboard?.on('keydown-HOME', () => this.frame());
    scene.input.keyboard?.on('keydown-LEFT', () => this.step(-1));
    scene.input.keyboard?.on('keydown-RIGHT', () => this.step(1));
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (this.inside(p)) this.zoom(Math.exp(-dy * .0015), p);
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.inside(p)) this.drag = { x: p.x, y: p.y, px: this.plot.x, py: this.plot.y, moved: false };
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) {
        if (Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 5) this.drag.moved = true;
        if (this.drag.moved) {
          this.navigated = true; this.hovered = undefined;
          this.plot.setPosition(this.drag.px + p.x - this.drag.x, this.drag.py + p.y - this.drag.y); this.constrain();
          scene.game.canvas.style.cursor = CURSOR.grabbing; return;
        }
      }
      const node = this.pick(p); this.hovered = node?.id;
      this.show(node ?? this.selectedNode()); this.drawAccent();
      scene.game.canvas.style.cursor = this.inside(p) ? node ? CURSOR.inspect : CURSOR.grab : CURSOR.arrow;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const node = this.drag && !this.drag.moved ? this.pick(p) : undefined; this.drag = undefined;
      if (node) { this.selected = node.id; this.show(node); this.drawAccent(); }
      scene.game.canvas.style.cursor = this.inside(p) ? node ? CURSOR.inspect : CURSOR.grab : CURSOR.arrow;
    });
    scene.input.on('gameout', () => {
      this.drag = undefined; this.hovered = undefined; this.show(this.selectedNode()); this.drawAccent();
      scene.game.canvas.style.cursor = CURSOR.arrow;
    });
    scene.events.once('shutdown', () => { scene.game.canvas.style.cursor = CURSOR.arrow; });
    this.draw(true);
  }

  private ownId() { return `local-${game.run?.id}`; }
  private getRoutes(): EvolutionRoute[] {
    const own = { id: this.ownId(), name: 'Your lineage', trace: [{ form: 0, primary: 0 }],
      evolutionTrace: game.run?.evolutionTrace?.length ? game.run.evolutionTrace : [game.evolution] };
    return fishTreeBranches(game.data.fishBranches ?? [], own, species.peerBranches)
      .filter(branch => !!branch.evolutionTrace?.length)
      .map(branch => ({ ...branch, name: historyBranchName(branch), evolutionTrace: branch.evolutionTrace! }));
  }

  private draw(initial = false) {
    this.routes = this.getRoutes(); this.stamp = JSON.stringify(this.routes);
    this.model = lineageTree(this.routes); this.points.clear(); this.colors.clear();
    this.plot.removeAll(true); this.views = [];
    let peer = 0;
    for (const route of this.routes) this.colors.set(route.id, route.extinct || route.archived ? 0x8a7765 : route.id === this.ownId() ? GOLD : [GREEN, 0xafa5c7, 0xb7b99b][peer++ % 3]);
    for (const node of this.model.nodes) this.points.set(node.id, { x: node.x, y: node.y });
    const g = this.scene.add.graphics(); this.plot.add(g);
    for (const edge of this.model.edges) {
      const a = this.points.get(edge.from)!, b = this.points.get(edge.to)!;
      if (!a || !b) continue;
      const curve = (offset: number) => new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(a.x + offset, a.y + 10), new Phaser.Math.Vector2(a.x + offset, a.y - 35),
        new Phaser.Math.Vector2(b.x + offset, b.y + 42), new Phaser.Math.Vector2(b.x + offset, b.y + 10));
      g.lineStyle(edge.possible ? 1.1 : 5, edge.possible ? GHOST : 0x736650, edge.possible ? .22 : .24).strokePoints(curve(0).getPoints(24));
      edge.routes.forEach((id, i) => {
        const route = this.routes.find(r => r.id === id), quiet = route?.extinct || route?.archived;
        g.lineStyle(quiet ? 1.3 : 2.3, this.colors.get(id) ?? GOLD, quiet ? .4 : .9)
          .strokePoints(curve((i - (edge.routes.length - 1) / 2) * 3.5).getPoints(24));
      });
    }
    this.plot.add(text(this.scene, 220, 3, 'WATER', 10, '#8caca6').setOrigin(.5).setLetterSpacing(4));
    this.plot.add(text(this.scene, 650, 3, 'SHORE', 10, '#b8a886').setOrigin(.5).setLetterSpacing(4));
    for (const node of this.model.nodes) this.drawNode(g, node);
    this.accent = this.scene.add.graphics(); this.plot.add(this.accent);
    this.drawLegend(); this.detailKey = '';
    if (!this.model.nodes.some(n => n.id === this.selected)) this.selected = evolutionNodeKey(game.evolution);
    if (initial || !this.navigated) this.frame();
    this.show(this.selectedNode()); this.drawAccent();
  }

  private drawNode(g: Phaser.GameObjects.Graphics, node: EvolutionNode) {
    const route = this.routes.find(r => node.routes.includes(r.id) && !r.extinct && !r.archived);
    const color = node.possible ? GHOST : this.colors.get(route?.id ?? node.routes[0]) ?? GOLD;
    g.fillStyle(color, node.possible ? .35 : .9).fillPoints([
      new Phaser.Math.Vector2(node.x, node.y + 6), new Phaser.Math.Vector2(node.x + 3, node.y + 10),
      new Phaser.Math.Vector2(node.x, node.y + 14), new Phaser.Math.Vector2(node.x - 3, node.y + 10),
    ], true);
    const nursery = node.id.includes('-nursery-');
    if (!nursery) {
      const view = new CreatureView(this.scene, node.x, node.y - 9, this.morph(node), 1).setName(`lineage-form-${node.id}`);
      this.fitAnimal(view, 98, 40); view.setAlpha(node.possible ? .23 : route ? 1 : .48);
      this.plot.add(view); this.views.push(view);
    }
    const endpoints = node.endpoints.map(id => this.routes.find(r => r.id === id)).filter((r): r is EvolutionRoute => !!r);
    const label = nursery ? `${node.id.startsWith('water') ? 'Water' : 'Shore'} · ${Math.abs(node.evolution.habitatProgress)}/3`
      : lineageFormName(node.form);
    this.plot.add(text(this.scene, node.x, node.y + 24, label, nursery ? 11 : 12, node.possible ? '#79867e' : UI.boneDim,
      { align: 'center', wordWrap: { width: 168 } }).setOrigin(.5, 0).setAlpha(node.possible ? .65 : 1));
    if (endpoints.length) this.plot.add(text(this.scene, node.x, node.y - (nursery ? 17 : 39), endpoints.map(r => r.name).slice(0, 2).join(' · '), 10,
      endpoints.some(r => r.id === this.ownId()) ? '#e4c18d' : '#8ac6b8', { align: 'center', wordWrap: { width: 160 } }).setOrigin(.5, 1));
  }

  private fitAnimal(view: CreatureView, width: number, height: number) {
    view.animate(0, 'idle', 0);
    const bounds = view.getBounds(), x = view.x, y = view.y;
    view.setBaseScale(Math.min(width / Math.max(1, bounds.width), height / Math.max(1, bounds.height)));
    view.animate(0, 'idle', 0);
    const fitted = view.getBounds(); view.x += x - fitted.centerX; view.y += y - fitted.centerY;
  }
  private morph(node: EvolutionNode) {
    const own = node.id === evolutionNodeKey(game.evolution);
    return game.morph({ evolution: own ? game.evolution : node.evolution, traits: own ? game.traits : { ...ZERO_TRAITS } });
  }
  private drawLegend() {
    this.legend.removeAll(true); let x = 0;
    for (const route of this.routes.filter(r => !r.extinct && !r.archived).slice(0, 3)) {
      const line = this.scene.add.graphics().lineStyle(3, this.colors.get(route.id) ?? GOLD, .9).lineBetween(x, -4, x + 22, -4);
      const label = text(this.scene, x + 30, -13, route.name, 14, UI.boneDim);
      this.legend.add([line, label]); x += Math.min(200, label.width + 58);
    }
    this.legend.add([this.scene.add.graphics().lineStyle(1, GHOST, .55).lineBetween(x + 8, -4, x + 30, -4),
      text(this.scene, x + 39, -13, 'Possible paths', 14, '#7c8981')]);
  }

  private show(node: EvolutionNode) {
    if (this.detailKey === node.id) return;
    this.detailKey = node.id; this.info.removeAll(true); this.portrait = undefined;
    const s = node.id === evolutionNodeKey(game.evolution) ? game.evolution : node.evolution, cx = PANEL.w / 2;
    this.info.add(text(this.scene, cx, 21, node.possible ? 'POSSIBLE FORM' : 'LIVED FORM', 11, node.possible ? '#84948a' : UI.ochre).setOrigin(.5).setLetterSpacing(3));
    this.info.add(title(this.scene, cx, 48, lineageFormName(node.form), 23).setOrigin(.5, 0).setAlign('center').setWordWrapWidth(262));
    this.info.add(this.scene.add.image(cx, 173, 'glow').setDisplaySize(264, 138).setTint(s.habitat === 'water' ? 0x8ac6b8 : 0xe4c18d).setAlpha(.09).setBlendMode(Phaser.BlendModes.ADD));
    const view = new CreatureView(this.scene, cx, 171, this.morph(node), 1).setName('evolution-portrait');
    this.fitAnimal(view, 244, 112); this.info.add(view); this.portrait = view;
    const status = !s.habitatProgress ? 'The nursery you return to shapes your descendants.' : lineageSummary(s);
    this.info.add(text(this.scene, cx, 235, status, 15, UI.boneDim, { align: 'center', wordWrap: { width: 258 } }).setOrigin(.5, 0));
    const bars = this.scene.add.graphics(); this.info.add(bars);
    const traits = [{ name: 'Habitat', value: Math.abs(s.habitatProgress), total: 3 },
      { name: 'Jaws', value: s.primary === 'bite' ? s.tier : 0, total: 2 },
      { name: 'Head armour', value: s.primary === 'skull' ? s.tier : 0, total: 2 }];
    traits.forEach((trait, i) => {
      const y = 298 + i * 43;
      this.info.add(text(this.scene, 22, y, trait.name, 16, UI.boneDim));
      this.info.add(text(this.scene, PANEL.w - 24, y, trait.name === 'Habitat' || trait.value ? `${trait.value} / ${trait.total}` : 'Base', 13, trait.value ? UI.bone : '#77867d').setOrigin(1, 0));
      for (let j = 0; j < trait.total; j++) bars.fillStyle(j < trait.value ? GOLD : 0x39433c, j < trait.value ? .85 : .45)
        .fillRoundedRect(22 + j * (258 / trait.total), y + 25, 258 / trait.total - 6, 3, 1);
    });
    const route = this.routes.filter(r => node.routes.includes(r.id));
    const detail = route.length ? route.map(routeName).slice(0, 3).join('\n') : 'An unexplored path for a future descendant.';
    this.info.add(text(this.scene, cx, 442, detail, 14, node.possible ? '#84948a' : UI.boneDim,
      { align: 'center', wordWrap: { width: 258 } }).setOrigin(.5, 0));
    this.info.add(text(this.scene, cx, 279, s.tier ? `${s.primary === 'bite' ? 'Biting' : 'Ramming'} shapes this lineage.`
      : s.habitat ? 'The way you fight shapes what comes next.' : 'Three inherited nursery steps establish a body.', 12, '#84948a', { align: 'center' }).setOrigin(.5));
  }

  private selectedNode() { return this.model.nodes.find(node => node.id === this.selected) ?? this.model.nodes[0]; }
  private inside(p: Point) { return p.x >= AREA.x && p.x <= AREA.x + AREA.w && p.y >= AREA.y && p.y <= AREA.y + AREA.h; }
  private pick(p: Point) {
    if (!this.inside(p)) return;
    const x = (p.x - this.plot.x) / this.plot.scaleX, y = (p.y - this.plot.y) / this.plot.scaleY;
    let best: EvolutionNode | undefined, distance = Infinity;
    for (const node of this.model.nodes) {
      const d = ((x - node.x) / (node.id.includes('nursery') ? 33 : 62)) ** 2 + ((y - node.y) / 29) ** 2;
      if (d <= 1 && d < distance) { best = node; distance = d; }
    }
    return best;
  }
  private drawAccent() {
    this.accent.clear(); const node = this.model.nodes.find(n => n.id === (this.hovered ?? this.selected)); if (!node) return;
    this.accent.lineStyle(1.5, GOLD, .85).lineBetween(node.x - 22, node.y + 17, node.x + 22, node.y + 17);
    this.accent.fillStyle(GOLD, .9).fillRect(node.x - 2, node.y + 8, 4, 4);
  }
  private frame() {
    this.navigated = false;
    this.fit = Math.min((AREA.w - 18) / this.model.width, (AREA.h - 10) / this.model.height);
    this.plot.setScale(this.fit).setPosition(AREA.x + (AREA.w - this.model.width * this.fit) / 2, AREA.y + 5);
  }
  private zoom(factor: number, anchor: Point = { x: AREA.x + AREA.w / 2, y: AREA.y + AREA.h / 2 }) {
    this.navigated = true; const old = this.plot.scaleX, scale = Phaser.Math.Clamp(old * factor, this.fit * .8, this.fit * 2.8);
    this.plot.setPosition(anchor.x - (anchor.x - this.plot.x) * scale / old, anchor.y - (anchor.y - this.plot.y) * scale / old);
    this.plot.setScale(scale); this.constrain();
  }
  private constrain() {
    this.plot.x = Phaser.Math.Clamp(this.plot.x, AREA.x + 60 - this.model.width * this.plot.scaleX, AREA.x + AREA.w - 60);
    this.plot.y = Phaser.Math.Clamp(this.plot.y, AREA.y + 50 - this.model.height * this.plot.scaleY, AREA.y + AREA.h - 50);
  }
  private step(delta: number) {
    const i = this.model.nodes.findIndex(node => node.id === this.selected);
    const node = this.model.nodes[(i + delta + this.model.nodes.length) % this.model.nodes.length];
    this.selected = node.id; this.hovered = undefined; this.show(node); this.drawAccent();
    const at = { x: this.plot.x + node.x * this.plot.scaleX, y: this.plot.y + node.y * this.plot.scaleY };
    if (!this.inside(at)) { this.plot.x += AREA.x + AREA.w / 2 - at.x; this.plot.y += AREA.y + AREA.h / 2 - at.y; this.constrain(); }
  }
  update(ms: number) {
    if (JSON.stringify(this.getRoutes()) !== this.stamp) this.draw();
    const dt = Math.min(.05, ms / 1000);
    for (const view of this.views) view.animate(dt, 'idle', 0);
    this.portrait?.animate(dt, 'idle', 0);
  }
}
