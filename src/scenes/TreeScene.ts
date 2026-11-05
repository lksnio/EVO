import Phaser from 'phaser';
import { historyCause, historySiteName } from '../ui/historyText';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, speciesName, ZERO_TRAITS, type Traits } from '../state/GameState';
import { EPOCHS, ERAS, spanWords, yearsAgo } from '../data/epochs';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { clamp } from '../util/math';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';
import { continueLife, startNewLife } from './flow';
import { focusTime, markKey, TIME_WORLD, timeAt, timeFraction, timeWindow, zoomTime,
  type LineageForm, type LineageRun, type LineageSegment, type TimeWindow } from '../sim/lineage';

type TreeData =
  | { mode: 'extinct'; leaf: string; morph: Morph; epoch: number; cause: string; years: number; quiet?: boolean }
  | { mode: 'present'; node: string; epoch?: number }
  | { mode?: 'view'; epoch?: number };
type Pick = { run: LineageRun; segment: LineageSegment; kind: 'birth' | 'tip'; x: number; y: number };
const PANEL = 950;
const PLOT = { x: 218, right: 918, y: 144, bottom: 599 };
const HEIGHT = PLOT.bottom - PLOT.y;
const PER_PAGE = 3;
const STRAND = 0xe9d4a8;
const INK = 0x080706;
const ERA_COLORS = [0x243b39, 0x303c29, 0x433629, 0x45302b, 0x303b34, 0x283c41, 0x3e3628];
const minutes = (seconds: number) => `${Math.round(seconds / 60)} min played`;

/** A personal record of played lives. Vertical position is geological time; there are no hypothetical branches. */
export class TreeScene extends Phaser.Scene {
  private d!: TreeData;
  private runs: LineageRun[] = [];
  private page = 0;
  private window: TimeWindow = { ...TIME_WORLD };
  private picks: Pick[] = [];
  private selected?: Pick;
  private plot!: Phaser.GameObjects.Container;
  private mini!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Container;
  private infoView?: CreatureView;
  private ring!: Phaser.GameObjects.Graphics;
  private rangeText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private main!: Button;
  private home!: Button;
  private mark?: Button;
  private drag?: { y: number; x: number; window: TimeWindow; moved: boolean };
  private dirty = false;
  private focus = 0;

  constructor() { super('Tree'); }
  init(d: TreeData) {
    this.d = d ?? { mode: 'view' };
    this.runs = [...game.data.lineage.runs].sort((a, b) => a.id - b.id);
    this.page = 0; this.selected = undefined; this.infoView = undefined; this.mark = undefined;
    this.picks = []; this.drag = undefined; this.dirty = false; this.focus = 0;
  }

  create() {
    fadeIn(this, 650);
    audio.music('generation');
    this.cameras.main.setBackgroundColor('#070605');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x15120e, 0x0d0c09, 0x050505, 0x080706, 1).fillRect(0, 0, W, H);
    this.add.image(490, 330, 'glow').setDisplaySize(1100, 950).setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.035);
    title(this, 28, 17, 'Tree of Life', 30);
    text(this, 30, 59, 'Your lineages. World time flows from top to bottom.', 17, UI.boneDim, { fontStyle: 'italic' });
    this.rangeText = text(this, 220, 112, '', 14, UI.boneDim).setName('lineage-range');
    this.pageText = text(this, 815, 112, '', 13, UI.boneDim).setOrigin(1, 0);
    new Button(this, 291, 93, 'All eras', { w: 145, h: 31, size: 15, onClick: () => this.setWindow(TIME_WORLD) }).setName('lineage-world');
    new Button(this, 451, 93, 'Your history', { w: 145, h: 31, size: 15, onClick: () => this.focusRun() }).setName('lineage-fit');
    new Button(this, 569, 93, '−', { w: 55, h: 31, size: 21, onClick: () => this.zoom(1.7) });
    new Button(this, 633, 93, '+', { w: 55, h: 31, size: 21, onClick: () => this.zoom(1 / 1.7) });
    new Button(this, 844, 93, '‹', { w: 39, h: 31, size: 25, onClick: () => this.changePage(-1) });
    new Button(this, 890, 93, '›', { w: 39, h: 31, size: 25, onClick: () => this.changePage(1) });
    this.mini = this.add.container(0, 0);
    this.plot = this.add.container(0, 0);
    const clip = this.make.graphics({ x: 0, y: 0 }).fillStyle(0xffffff).fillRect(113, PLOT.y - 1, PANEL - 130, HEIGHT + 3);
    this.plot.setMask(clip.createGeometryMask());
    this.events.once('shutdown', () => { this.plot.clearMask(true); this.ring.clearMask(true); clip.destroy(); });
    this.ring = this.add.graphics().setDepth(10).setMask(clip.createGeometryMask());
    this.info = this.add.container(0, 0).setDepth(20);
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(INK, 1).fillRect(PANEL - 15, 0, W - PANEL + 15, H);
    panel.fillStyle(0x14120f, .94).fillRoundedRect(PANEL, 97, W - PANEL - 18, 493, 13);
    panel.lineStyle(2, UI.panelEdge, .6).strokeRoundedRect(PANEL + 1, 98, W - PANEL - 20, 491, 13);
    const cx = PANEL + (W - PANEL - 18) / 2;
    this.main = new Button(this, cx, 624, game.hasRun() ? 'Continue life' : 'Begin life',
      { w: 290, h: 51, icon: 'ic_play', color: UI.ochreN, sound: null, onClick: () => this.play() }).setDepth(25).setName('lineage-play');
    this.home = new Button(this, cx, 680, 'Title screen',
      { w: 290, h: 42, size: 19, icon: 'ic_home', onClick: () => fadeTo(this, 'Title') }).setDepth(25);
    text(this, 29, 624, '●  Spawning site     │  Generation     ×  End of a lineage', 16, UI.boneDim);
    text(this, 29, 653, 'Scroll: zoom through time · Drag: pan · Click a node: inspect', 15, UI.boneDim);
    text(this, 29, 679, '↑ ↓ nodes · ← → pages · + − zoom · G all eras · L your history', 13, '#766c5b');

    const leafRun = this.d.mode === 'extinct' ? game.data.nodes[this.d.leaf]?.dead?.run : undefined;
    const marked = game.data.lineage.marked;
    const preferred = this.runs.find(r => r.id === leafRun) ?? this.runs.find(r => r.segments.some(s => markKey(r, s) === marked))
      ?? this.runs.find(r => r.id === game.run?.id) ?? this.runs.at(-1);
    this.page = preferred ? Math.floor(this.runs.indexOf(preferred) / PER_PAGE) : 0;
    this.window = preferred ? focusTime([preferred]) : { ...TIME_WORLD };
    this.draw();
    const markedPick = this.picks.find(p => p.kind === 'birth' && markKey(p.run, p.segment) === marked);
    const initial = leafRun ? this.picks.find(p => p.kind === 'tip' && p.run.id === leafRun)
      : markedPick ?? this.picks.find(p => p.kind === 'tip' && p.run === preferred);
    if (initial) this.select(initial);
    else this.showEmpty();
    this.bindInput();
  }

  update(_time: number, dms: number) {
    if (this.dirty) { this.dirty = false; this.draw(); }
    this.infoView?.animate(Math.min(.05, dms / 1000), this.infoView.L.land ? 'idle' : 'swim', .18);
  }
  private visibleRuns() { return this.runs.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE); }
  private y(years: number) { return PLOT.y + timeFraction(years, this.window) * HEIGHT; }
  private stationX(run: LineageRun, segment: LineageSegment) {
    const index = this.visibleRuns().indexOf(run), count = Math.max(1, this.visibleRuns().length);
    const center = PLOT.x + (index + .5) * (PLOT.right - PLOT.x) / count;
    // A stable, small lateral separation makes returns to the same station recognisable. X has no time meaning.
    let hash = 0;
    for (const c of segment.site.key) hash = (hash * 31 + c.charCodeAt(0)) | 0;
    return center + ((hash >>> 0) % 7 - 3) * 9;
  }
  private setWindow(w: TimeWindow) {
    this.window = { ...w }; this.draw();
  }
  private zoom(factor: number, anchor = .5) { this.setWindow(zoomTime(this.window, factor, clamp(anchor, 0, 1))); }
  private focusRun() {
    const run = this.selected?.run ?? this.visibleRuns().at(-1);
    this.setWindow(focusTime(run ? [run] : []));
  }
  private changePage(delta: number) {
    const next = clamp(this.page + delta, 0, Math.max(0, Math.ceil(this.runs.length / PER_PAGE) - 1));
    if (next === this.page) return;
    this.page = next; this.selected = undefined;
    this.window = focusTime(this.visibleRuns()); this.draw();
    const p = this.picks.find(p => p.kind === 'tip'); if (p) this.select(p);
  }

  private draw() {
    this.plot.removeAll(true); this.mini.removeAll(true); this.picks = [];
    const g = this.add.graphics(); this.plot.add(g);
    this.drawEras(g); this.drawTicks(g);
    const visible = this.visibleRuns();
    for (const run of visible) this.drawRun(g, run);
    if (!visible.length) {
      this.plot.add(text(this, 566, 319, 'Your story begins here.', 28, UI.bone).setOrigin(.5));
      this.plot.add(text(this, 566, 365, 'Play your first animal. Its path will be preserved here.', 17, UI.boneDim).setOrigin(.5));
    }
    const digits = Math.max(0, Math.min(6, 7 - Math.floor(Math.log10(this.window.from - this.window.to))));
    const date = (years: number) => (years / 1e6).toLocaleString('en-GB', { maximumFractionDigits: digits });
    this.rangeText.setText(`${date(this.window.from)} → ${date(this.window.to)} million years ago`);
    this.pageText.setText(this.runs.length ? `${this.page * PER_PAGE + 1}–${Math.min((this.page + 1) * PER_PAGE, this.runs.length)} / ${this.runs.length} runs` : 'No runs yet');
    if (this.selected) {
      const old = this.selected;
      this.selected = this.picks.find(p => p.run === old.run && p.segment === old.segment && p.kind === old.kind);
    }
    this.drawSelection();
  }

  private drawEras(g: Phaser.GameObjects.Graphics) {
    const mini = this.add.graphics(); this.mini.add(mini);
    this.mini.add(text(this, 28, 112, 'ERAS', 12, UI.boneDim));
    ERAS.forEach(({ ep }, i) => {
      const from = ep.period[0] * 1e6, to = ep.period[1] * 1e6;
      const top = PLOT.y + timeFraction(from, TIME_WORLD) * HEIGHT, bottom = PLOT.y + timeFraction(to, TIME_WORLD) * HEIGHT;
      mini.fillStyle(ERA_COLORS[i], .48).fillRect(26, top, 83, bottom - top - 1);
      mini.lineStyle(1, 0x8e7956, .25).lineBetween(26, top, 109, top);
      this.mini.add(text(this, 67, (top + bottom) / 2, ep.name, 13, UI.boneDim).setOrigin(.5));
      const y0 = clamp(this.y(from), PLOT.y, PLOT.bottom), y1 = clamp(this.y(to), PLOT.y, PLOT.bottom);
      if (y1 > y0) {
        g.fillStyle(ERA_COLORS[i], .19).fillRect(PLOT.x - 4, y0, PLOT.right - PLOT.x + 8, y1 - y0);
        g.lineStyle(1, 0xb8a47d, .18).lineBetween(PLOT.x - 4, y0, PLOT.right + 4, y0);
      }
    });
    const top = PLOT.y + timeFraction(this.window.from, TIME_WORLD) * HEIGHT;
    const bottom = PLOT.y + timeFraction(this.window.to, TIME_WORLD) * HEIGHT;
    mini.lineStyle(2, STRAND, .9).strokeRect(23, top, 89, Math.max(3, bottom - top));
    mini.lineStyle(1, STRAND, .45).lineBetween(118, PLOT.y, 118, PLOT.bottom);
  }

  private drawTicks(g: Phaser.GameObjects.Graphics) {
    const span = this.window.from - this.window.to, rough = span / 6;
    const power = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= rough)!;
    const precision = Math.max(0, Math.min(6, 6 - Math.floor(Math.log10(step))));
    for (let years = Math.floor(this.window.from / step) * step; years >= this.window.to; years -= step) {
      const y = this.y(years);
      g.lineStyle(1, 0xd8c39b, .075).lineBetween(PLOT.x - 4, y, PLOT.right + 4, y);
      g.lineStyle(1, STRAND, .5).lineBetween(123, y, PLOT.x - 16, y);
      const label = `${(years / 1e6).toLocaleString('en-GB', { maximumFractionDigits: precision })}`;
      this.plot.add(text(this, PLOT.x - 23, y - 5, label, 12, UI.boneDim).setOrigin(1, 1));
    }
    this.mini.add(text(this, 137, 127, 'million years', 11, UI.boneDim));
  }

  private drawRun(g: Phaser.GameObjects.Graphics, run: LineageRun) {
    const active = game.runIn(run.epoch)?.id === run.id;
    const color = run.status === 'extinct' ? 0xa8866a : active ? STRAND : 0xa7b6a0;
    run.segments.forEach((s, i) => {
      const next = run.segments[i + 1], x = this.stationX(run, s), x1 = next ? this.stationX(run, next) : x;
      const y0 = this.y(s.from), y1 = this.y(s.to);
      const curve = new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(x, y0),
        new Phaser.Math.Vector2(x - 10, y0 + (y1 - y0) / 3), new Phaser.Math.Vector2(x1 + 9, y0 + (y1 - y0) * 2 / 3), new Phaser.Math.Vector2(x1, y1));
      // Clip before tessellation: even a century-wide zoom on a 400-million-year trace stays cheap.
      const span = Math.max(1e-9, y1 - y0), a = clamp((PLOT.y - y0) / span, 0, 1), b = clamp((PLOT.bottom - y0) / span, 0, 1);
      if (y1 >= PLOT.y && y0 <= PLOT.bottom && b >= a) {
        const points = Array.from({ length: 31 }, (_, j) => curve.getPoint(a + (b - a) * j / 30));
        g.lineStyle(11, color, .06).strokePoints(points);
        g.lineStyle(4.5, color, .9).strokePoints(points);
        g.lineStyle(1, 0xffebbc, .3).strokePoints(points);
      }
      // Only subsequent births get small ticks; a generation never becomes a speciation node.
      let lastY = -Infinity;
      for (const birth of s.births.slice(1)) {
        const y = this.y(birth.years);
        if (y < PLOT.y || y > PLOT.bottom || y - lastY < 7) continue;
        const p = curve.getPoint(clamp((s.from - birth.years) / Math.max(1, s.from - s.to), 0, 1));
        g.lineStyle(1.3, color, .7).lineBetween(p.x - 5, y, p.x + 5, y);
        lastY = y;
      }
      this.picks.push({ run, segment: s, kind: 'birth', x, y: y0 });
      if (y0 >= PLOT.y && y0 <= PLOT.bottom) {
        g.fillStyle(INK).fillCircle(x, y0, 9);
        g.lineStyle(2, color, .95).strokeCircle(x, y0, i ? 6 : 7.5);
        g.fillStyle(color, .85).fillCircle(x, y0, i ? 2.6 : 4);
        if (game.data.lineage.marked === markKey(run, s)) {
          this.plot.add(text(this, x + 12, y0 - 13, '✦', 18, '#e6b65e'));
        }
      }
      if (!next) {
        this.picks.push({ run, segment: s, kind: 'tip', x: x1, y: y1 });
        if (y1 >= PLOT.y && y1 <= PLOT.bottom) {
          g.fillStyle(INK).fillCircle(x1, y1, 6);
          if (run.status === 'extinct') {
            g.lineStyle(2.2, 0xbb7664, 1).lineBetween(x1 - 5, y1 - 5, x1 + 5, y1 + 5).lineBetween(x1 - 5, y1 + 5, x1 + 5, y1 - 5);
          } else {
            g.fillStyle(color, 1).fillCircle(x1, y1, 4.4);
          }
        }
      }
    });
    const x = this.stationX(run, run.segments[0]), firstY = this.y(run.segments[0].from);
    const y = clamp(firstY - 22, PLOT.y + 14, PLOT.bottom - 18);
    this.plot.add(text(this, x + 20, y, `Lineage ${run.id}`, 16, active ? UI.bone : UI.boneDim));
  }

  private drawSelection() {
    this.ring.clear();
    if (this.selected) this.ring.lineStyle(2, 0xffe3ac, 1).strokeCircle(this.selected.x, this.selected.y, 12);
  }
  private select(p: Pick) {
    this.selected = p; this.drawSelection(); this.showInfo(p);
  }
  private formView(form: LineageForm, x: number, y: number) {
    const traits = { ...ZERO_TRAITS, ...form.traits } as Traits;
    const v = new CreatureView(this, x, y, game.morph({ ...form, traits, fierce: 0 }), 1);
    const scale = Math.min(1.05, 230 / (v.L.halfW * 2), 105 / Math.max(20, v.L.footY - v.L.topY));
    v.setBaseScale(scale);
    if (v.L.land) v.y = 298 - v.L.footY * scale;
    return v;
  }
  private showInfo(p: Pick) {
    this.info.removeAll(true); this.infoView = undefined; this.mark = undefined;
    const { run, segment: s } = p, cx = PANEL + (W - PANEL - 18) / 2;
    const first = s.births[0], last = s.births.at(-1)!;
    const form = p.kind === 'tip' ? s.last : s.first;
    const traits = { ...ZERO_TRAITS, ...form.traits } as Traits;
    const shownGen = p.kind === 'tip' ? last.gen : first.gen;
    const name = shownGen === 1 && !run.legacy ? 'The ancestor' : speciesName({ cls: form.cls, traits, epoch: s.epoch, parent: 'played' });
    const ep = EPOCHS[s.epoch];
    this.info.add(title(this, cx, 117, ep?.name.toUpperCase() ?? 'WORLD TIME', 13, UI.ochre).setOrigin(.5));
    const heading = p.kind === 'tip' ? run.status === 'extinct' ? 'The lineage ended here' : 'The last descendant'
      : s === run.segments[0] ? run.legacy ? 'Recorded history' : 'Your lineage began here' : 'A new spawning site';
    this.info.add(title(this, cx, 142, heading, 19, UI.bone).setOrigin(.5));
    this.info.add(text(this, cx, 174, historySiteName(s), 20, UI.bone, { align: 'center', wordWrap: { width: 275 } }).setOrigin(.5, 0).setName('lineage-site'));
    this.info.add(this.add.image(cx, 302, 'pedestal').setScale(.82, .6).setAlpha(.6));
    this.infoView = this.formView(form, cx, 260); this.info.add(this.infoView);
    this.info.add(text(this, cx, 326, name, 17, UI.boneDim, { fontStyle: 'italic', align: 'center', wordWrap: { width: 275 } }).setOrigin(.5, 0));
    const at = p.kind === 'tip' ? s.to : s.from;
    const gens = first.gen === last.gen ? `Generation ${first.gen}` : `Generations ${first.gen}–${last.gen}`;
    const duration = Math.max(0, s.from - s.to);
    const lines = [`Lineage ${run.id} · ${yearsAgo(at, 1)}`, gens,
      `${s.births.length} ${s.births.length === 1 ? 'animal chosen' : 'animals chosen'} · ${minutes(s.seconds)}`,
      `${spanWords(duration)} at this spawning site`];
    if (p.kind === 'tip' && run.status === 'extinct') lines.push(`End: ${historyCause(run.cause ?? 'Unknown')}`);
    else if (game.runIn(run.epoch)?.id === run.id) lines.push('This lineage lives on.');
    else if (run.status === 'alive') lines.push('An earlier personal history.');
    if (run.legacy) lines.push('Older save: earlier time records are unavailable.');
    const details = text(this, cx, 374, lines.join('\n'), 15, UI.boneDim,
      { align: 'center', lineSpacing: 5, wordWrap: { width: 278 } }).setOrigin(.5, 0).setName('lineage-details');
    if (details.height > 167) details.setScale(167 / details.height);
    this.info.add(details);
    const key = markKey(run, s), marked = game.data.lineage.marked === key;
    this.mark = new Button(this, cx, 563, marked ? 'Remove marker' : 'Mark spawning site', {
      w: 267, h: 33, size: 15, color: marked ? UI.ochreN : UI.stone, onClick: () => {
        game.markLineage(game.data.lineage.marked === key ? undefined : key); this.draw(); this.showInfo(p);
      },
    }).setName('lineage-mark');
    this.info.add(this.mark);
    const target = game.runIn(run.epoch);
    this.main.setLabel(target?.id === run.id ? 'Continue lineage' : game.hasRun() ? 'Continue life' : 'Begin life');
  }
  private showEmpty() {
    const cx = PANEL + (W - PANEL - 18) / 2;
    this.info.add(title(this, cx, 157, 'Your first ancestor', 23, UI.bone).setOrigin(.5));
    this.info.add(text(this, cx, 224, 'Each descendant you choose continues\nyour own path.\n\nA different spawning site becomes\na new node.\n\nHeight shows when it happened\nin the world.', 19, UI.boneDim, { align: 'center', lineSpacing: 7 }).setOrigin(.5, 0));
  }

  private hit(x: number, y: number) {
    if (x < PLOT.x - 10 || x > PLOT.right + 10 || y < PLOT.y || y > PLOT.bottom) return;
    let best: Pick | undefined, distance = 20;
    for (const p of this.picks) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < distance) { best = p; distance = d; }
    }
    return best;
  }
  private bindInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x >= 23 && p.x <= 112 && p.y >= PLOT.y && p.y <= PLOT.bottom) {
        const years = timeAt((p.y - PLOT.y) / HEIGHT, TIME_WORLD);
        const era = ERAS.find(({ ep }) => years <= ep.period[0] * 1e6 && years >= ep.period[1] * 1e6);
        if (era) this.setWindow({ from: era.ep.period[0] * 1e6, to: era.ep.period[1] * 1e6 });
      } else if (p.x >= PLOT.x && p.x <= PLOT.right && p.y >= PLOT.y && p.y <= PLOT.bottom) {
        this.drag = { x: p.x, y: p.y, window: { ...this.window }, moved: false };
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (Math.hypot(p.x - d.x, p.y - d.y) > 5) d.moved = true;
      if (!d.moved) return;
      const shift = (p.y - d.y) / HEIGHT * (d.window.from - d.window.to);
      this.window = timeWindow(d.window.from + shift, d.window.to + shift); this.dirty = true;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag; this.drag = undefined;
      if (d && !d.moved) { const hit = this.hit(p.x, p.y); if (hit) { audio.sfx('click'); this.select(hit); } }
    });
    this.input.on('gameout', () => { this.drag = undefined; });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _g: unknown, _dx: number, dy: number) => {
      if (p.x < 113 || p.x > PLOT.right || p.y < PLOT.y || p.y > PLOT.bottom) return;
      this.zoom(Math.exp(clamp(dy, -200, 200) * .0025), (p.y - PLOT.y) / HEIGHT);
    });
    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => this.step(-1)); kb.on('keydown-DOWN', () => this.step(1));
    kb.on('keydown-LEFT', () => this.changePage(-1)); kb.on('keydown-RIGHT', () => this.changePage(1));
    kb.on('keydown-G', () => this.setWindow(TIME_WORLD)); kb.on('keydown-L', () => this.focusRun());
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') this.zoom(1 / 1.7);
      if (e.key === '-') this.zoom(1.7);
      if (e.key === 'Tab') { e.preventDefault(); this.focus = (this.focus + 1) % 3; this.drawFocus(); }
    });
    const act = () => [this.main, this.home, this.mark][this.focus]?.click();
    kb.on('keydown-ENTER', act); kb.on('keydown-SPACE', act);
    kb.on('keydown-ESC', () => fadeTo(this, 'Title'));
    this.drawFocus();
  }
  private drawFocus() {
    [this.main, this.home, this.mark].forEach((b, i) => b?.setFocus(i === this.focus));
  }
  private step(delta: number) {
    const keys = this.picks;
    if (!keys.length) return;
    const i = keys.findIndex(p => p.run === this.selected?.run && p.segment === this.selected.segment && p.kind === this.selected.kind);
    const p = keys[clamp(i + delta, 0, keys.length - 1)]; this.select(p);
    if (p.y < PLOT.y + 15 || p.y > PLOT.bottom - 15) {
      const span = this.window.from - this.window.to, at = p.kind === 'tip' ? p.segment.to : p.segment.from;
      this.setWindow(timeWindow(at + span / 2, at - span / 2));
    }
  }
  private play() {
    audio.sfx('confirm');
    const r = this.selected?.run, saved = r && game.runIn(r.epoch);
    if (r && saved?.id === r.id) continueLife(this, r.epoch);
    else if (game.hasRun()) continueLife(this);
    else startNewLife(this);
  }
}
