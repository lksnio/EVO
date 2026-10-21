import Phaser from 'phaser';
import { W, H, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, rootId, rootNode, speciesName, type Run, type TreeNode } from '../state/GameState';
import { EPOCHS, ERAS, inEra, ofEra, type EpochDef } from '../data/epochs';
import { CLASSES, type ClassId } from '../data/classes';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { clamp, mulberry32 } from '../util/math';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';
import { continueLife, startNewLife } from './flow';

type TreeData =
  | { mode: 'extinct'; leaf: string; morph: Morph; epoch: number; cause: string; years: number; quiet?: boolean }
  | { mode: 'present'; node: string; epoch?: number }
  | { mode?: 'view'; epoch?: number };

// ---------------------------------------------------------------------------
// Der Stammbaum des Lebens – ein Baum für alle sieben Zeitalter, und er zeigt nur deine jetzige Linie.
// Von oben nach unten läuft die Zeit am Stamm entlang. An ihm setzt je Zeitalter ein Ast an, versetzt: das Devon ganz oben,
// jedes spätere ein Stück tiefer – und jeder Ast zeigt in einem anderen Winkel, wie die Stäbe eines Fächers: das Devon weit
// nach links, das Paläogen schon nach rechts unten. Dein Weg ist ein heller Strang auf seinem Ast, der mit jeder Generation
// länger wird; wo deine Linie eine neue Art wurde, sitzt ein Knoten. Was (noch) nicht gespielt ist, steht ausgegraut da: die
// Möglichkeit des Fächers. Zwischen den Ästen verzweigen sich leise die übrigen Linien des Lebens – alles ist ein Baum.
// Stirbt deine Linie aus, zerfällt ihr Strang zu Staub; übrig bleibt der Urahn, mit dem alles neu beginnt.
// Was ein Knoten bedeutet (Art, Generationen, Zeitalter), steht rechts, sobald man ihn berührt.
// ---------------------------------------------------------------------------

const PANEL_X = 944;
/** der Baumbereich (Ränder, über die nichts hinauswächst) */
const AREA = { x0: 8, x1: PANEL_X - 26, y0: 84, y1: H - 14 };

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
/** der Stamm: von oben (frühere Zeiten) in einem Bogen nach rechts unten (spätere Zeiten) */
const TRUNK = new Phaser.Curves.QuadraticBezier(V(420, 62), V(440, 430), V(760, 576));
/** wo am Stamm die Äste ansetzen (Anteil des Stammes) */
const U0 = 0.12, U1 = 0.9;
/** Winkel der Äste (Grad, 0 = senkrecht nach unten, negativ = nach links) und ihre Länge – vom ersten bis zum letzten Zeitalter */
const ANGLE: [number, number] = [-80, 40];
const LENGTH: [number, number] = [310, 196];
/** so viele Generationen füllen den halben Ast (der Strang wächst, wird aber nie länger als sein Ast) */
const HALF_GENS = 12;

const CLS_COLOR: Record<ClassId, number> = {
  fish: 0x6f9e98,
  amphibian: 0x86a060,
  reptile: 0xb08250,
  mammal: 0xd2aa72,
};
const STRAND = 0xf0dcae;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** ein Ast: wo er am Stamm ansetzt, wie er verläuft und wo er endete, wäre er ganz gespielt */
interface Branch {
  k: number;
  i: number;
  ep: EpochDef;
  /** Anteil des Stammes, an dem er ansetzt */
  u: number;
  o: Phaser.Math.Vector2;
  curve: Phaser.Curves.QuadraticBezier;
  end: Phaser.Math.Vector2;
  dir: Phaser.Math.Vector2;
  run: Run | null;
}

/** Was sich berühren lässt: der Ansatz (Urahn), ein Stück Strang (eine Art), das Ende deiner Linie, ein (noch) leerer Ast. */
interface Pick {
  x: number;
  y: number;
  r: number;
  kind: 'root' | 'node' | 'tip' | 'era';
  b: Branch;
  n?: TreeNode;
  /** Generationen dieses Abschnitts (von, bis) */
  gens?: [number, number];
}

/** Anteil des Astes, den so viele Generationen füllen */
const frac = (gens: number) => gens / (gens + HALF_GENS);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function branches(): Branch[] {
  const n = ERAS.length;
  return ERAS.map(({ i, ep }, k) => {
    const s = n > 1 ? k / (n - 1) : 0;
    const u = lerp(U0, U1, s);
    const o = TRUNK.getPoint(u);
    const tan = TRUNK.getTangent(u);
    const th = Phaser.Math.DegToRad(lerp(ANGLE[0], ANGLE[1], s));
    const L = lerp(LENGTH[0], LENGTH[1], s);
    const dir = V(Math.sin(th), Math.cos(th));
    const end = V(o.x + dir.x * L, o.y + dir.y * L);
    // der Ast löst sich in Richtung des Stammes und biegt dann in seine eigene Richtung
    const c = V(o.x + tan.x * L * 0.3, o.y + tan.y * L * 0.3);
    return { k, i, ep, u, o, curve: new Phaser.Curves.QuadraticBezier(o, c, end), end, dir, run: game.runIn(i) };
  });
}

export class TreeScene extends Phaser.Scene {
  private d!: TreeData;
  private br: Branch[] = [];
  private picks: Pick[] = [];
  private sel?: Pick;
  private ring!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Container;
  private infoView?: CreatureView;
  private views: CreatureView[] = [];
  private overlay?: Phaser.GameObjects.Container;
  private main!: Button;
  private home!: Button;
  private focusIdx = 0;

  constructor() {
    super('Tree');
  }

  init(d: TreeData) {
    this.d = d ?? { mode: 'view' };
    this.br = [];
    this.picks = [];
    this.sel = undefined;
    this.views = [];
    this.infoView = undefined;
    this.overlay = undefined;
    this.focusIdx = 0;
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    this.cameras.main.setBackgroundColor('#070605');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0b09, 0x0d0b09, 0x040303, 0x040303, 1);
    bg.fillRect(0, 0, W, H);
    // ein warmes Licht hinter dem Stamm
    this.add.image(470, 370, 'glow').setDisplaySize(1100, 900).setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05);

    title(this, 30, 16, 'Stammbaum des Lebens', 30);
    text(this, 32, 58, 'Ein Baum, sieben Zeitalter – dein Weg leuchtet.', 16, UI.boneDim, { fontStyle: 'italic' }).setAlpha(0.8);

    this.br = branches();
    this.drawTree();
    this.ring = this.add.graphics().setDepth(20);

    // Infotafel rechts
    const pg = this.add.graphics();
    pg.fillStyle(0x070605, 1);
    pg.fillRect(PANEL_X - 14, 0, W - PANEL_X + 14, H);
    pg.fillStyle(0x121110, 0.92);
    pg.fillRoundedRect(PANEL_X, 96, W - PANEL_X - 18, 470, 14);
    pg.lineStyle(2, UI.panelEdge, 0.55);
    pg.strokeRoundedRect(PANEL_X + 1, 97, W - PANEL_X - 20, 468, 14);
    this.info = this.add.container(0, 0);

    const cx = PANEL_X + (W - PANEL_X - 18) / 2;
    const run = game.runIn(game.chosenEpoch);
    this.main = new Button(this, cx, 608, run ? 'Weiterleben' : 'Leben beginnen', { w: 290, h: 54, icon: 'ic_play', color: UI.ochreN, sound: null, onClick: () => this.play() });
    this.home = new Button(this, cx, 670, 'Titelbild', { w: 290, h: 46, size: 19, icon: 'ic_home', sound: 'back', onClick: () => fadeTo(this, 'Title') });
    // Stammbaum zurücksetzen – mit Rückfrage (zweiter Klick innerhalb weniger Sekunden)
    let armed = 0;
    const reset: Button = new Button(this, cx, 48, 'Stammbaum zurücksetzen', {
      w: 290, h: 40, size: 15, onClick: () => {
        if (this.time.now - armed < 4000) {
          game.resetAll();
          this.scene.restart({ mode: 'view' });
          return;
        }
        armed = this.time.now;
        reset.setLabel('Wirklich alles löschen?');
        reset.setColor(UI.bloodN);
        this.time.delayedCall(4000, () => {
          if (!reset.active || this.time.now - armed < 3900) return;
          reset.setLabel('Stammbaum zurücksetzen');
          reset.setColor(UI.stone);
        });
      },
    });

    // Berühren zeigt rechts, was ein Knoten bedeutet
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.overlay) return;
      const hit = this.pick(p.x, p.y);
      if (hit) this.select(hit);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.overlay) return this.closeOverlay();
      const hit = this.pick(p.x, p.y);
      if (hit) this.select(hit);
    });

    // Tastatur: ← → von Knoten zu Knoten, ↑ ↓ die Knöpfe
    const kb = this.input.keyboard!;
    const busy = () => !!this.overlay || !this.input.enabled;
    kb.on('keydown-LEFT', () => !busy() && this.step(-1));
    kb.on('keydown-RIGHT', () => !busy() && this.step(1));
    kb.on('keydown-UP', () => !busy() && this.focusBtn(-1));
    kb.on('keydown-DOWN', () => !busy() && this.focusBtn(1));
    const act = () => !busy() && [this.main, this.home][this.focusIdx].click();
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-ESC', () => (this.overlay ? this.closeOverlay() : fadeTo(this, 'Title')));
    this.focusBtn(0);

    this.select(this.home0());
    // (quiet: Den Abschied gab es schon – im Koop, als die gemeinsame Art ausstarb: dann zerfällt der Strang gleich)
    if (this.d.mode === 'extinct') {
      if (this.d.quiet) this.crumble(this.d);
      else this.extinctOverlay(this.d);
    }
    else this.reveal();
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    for (const v of this.views) v.animate(dt, v.L.land ? 'idle' : 'swim', 0.15);
    this.infoView?.animate(dt, this.infoView.L.land ? 'idle' : 'swim', 0.25);
  }

  // ---------------------------------------------------------------- der Baum

  private drawTree() {
    const ghost = this.add.graphics();
    this.twigs(ghost);
    for (const b of this.br) this.ghostBranch(ghost, b);
    const trunk = this.add.graphics();
    this.drawTrunk(trunk);
    const live = this.add.graphics().setDepth(3);
    for (const b of this.br) {
      this.picks.push(...this.branchPicks(b));
      if (b.run) this.strand(live, b, b.run);
    }
    for (const b of this.br) this.labels(b);
  }

  /** die übrigen Linien des Lebens: feine Zweige vom Stamm und von den Ästen, die sich leise weiter verzweigen */
  private twigs(g: Phaser.GameObjects.Graphics) {
    const r = mulberry32(7);
    const inside = (x: number, y: number) => x > AREA.x0 && x < AREA.x1 && y > AREA.y0 && y < AREA.y1;
    const twig = (x: number, y: number, a: number, len: number, depth: number, alpha: number) => {
      const bend = (r() - 0.5) * 0.5;
      const ex = x + Math.cos(a + bend) * len, ey = y + Math.sin(a + bend) * len;
      if (!inside(ex, ey)) return;
      const cx = x + Math.cos(a) * len * 0.5, cy = y + Math.sin(a) * len * 0.5;
      const c = new Phaser.Curves.QuadraticBezier(V(x, y), V(cx, cy), V(ex, ey));
      g.lineStyle(Math.max(0.8, depth * 0.7), 0xe6dcc4, alpha);
      g.strokePoints(c.getPoints(10));
      if (depth > 0) {
        const n = r() < 0.3 ? 3 : 2;
        for (let j = 0; j < n; j++) twig(ex, ey, a + bend + (j - (n - 1) / 2) * (0.5 + r() * 0.35), len * (0.55 + r() * 0.15), depth - 1, alpha * 0.85);
      } else {
        g.fillStyle(0xe6dcc4, alpha * 1.6);
        g.fillCircle(ex, ey, 1.3);
      }
    };
    // vom Stamm aus auf die andere Seite: die vielen Linien, die nicht deine sind
    for (let u = 0.04; u < 0.98; u += 0.075) {
      const p = TRUNK.getPoint(u), t = TRUNK.getTangent(u);
      const a = Math.atan2(t.y, t.x) - 1.05 - r() * 0.35;
      twig(p.x, p.y, a, 70 + r() * 90, 3, 0.1);
    }
    // an jedem Ast zweigen andere Arten ab
    for (const b of this.br) {
      for (const t of [0.3, 0.5, 0.7, 0.9]) {
        const p = b.curve.getPointAt(t), tg = b.curve.getTangentAt(t);
        const side = r() < 0.5 ? -1 : 1;
        twig(p.x, p.y, Math.atan2(tg.y, tg.x) + side * (0.6 + r() * 0.4), 30 + r() * 34, 2, 0.085);
      }
    }
  }

  /** die Möglichkeit eines Astes: gepunktet bis an sein Ende, ein offener Ring dort */
  private ghostBranch(g: Phaser.GameObjects.Graphics, b: Branch) {
    const open = b.ep.playable;
    const n = Math.floor(b.curve.getLength() / 7);
    for (let j = 1; j <= n; j++) {
      const p = b.curve.getPointAt(j / n);
      g.fillStyle(0xe6dcc4, (open ? 0.45 : 0.27) * (1 - (j / n) * 0.35));
      g.fillCircle(p.x, p.y, open ? 1.6 : 1.3);
    }
    g.lineStyle(1.4, 0xe6dcc4, open ? 0.5 : 0.3);
    g.strokeCircle(b.end.x, b.end.y, 4);
  }

  /** der Stamm: kräftig, nach unten schmaler, mit hellem Glanz an einer Seite; davor und danach läuft er gestrichelt aus */
  private drawTrunk(g: Phaser.GameObjects.Graphics) {
    const N = 80;
    const seg = (u0: number, u1: number, w: number, col: number, a: number, off = 0) => {
      const p0 = TRUNK.getPoint(u0), p1 = TRUNK.getPoint(u1), t = TRUNK.getTangent(u0);
      g.lineStyle(w, col, a);
      g.lineBetween(p0.x - t.y * off, p0.y + t.x * off, p1.x - t.y * off, p1.y + t.x * off);
    };
    for (let j = 0; j < N; j++) {
      const u0 = j / N, u1 = (j + 1) / N;
      // vor dem ersten und nach dem letzten Zeitalter: nur angedeutet
      const fade = clamp(Math.min((u0 - 0.02) / (U0 - 0.02), (1 - u0) / (1 - U1)), 0, 1);
      if (fade <= 0.02) continue;
      if (fade < 1 && j % 2) continue;
      const w = lerp(11, 6, u0);
      seg(u0, u1, w + 2, 0x0a0806, 0.8 * fade);
      seg(u0, u1, w, 0x5e4c36, 0.9 * fade);
      seg(u0, u1, w * 0.45, 0x8f7a58, 0.7 * fade, w * 0.18);
      seg(u0, u1, 1.2, 0xe8d6ae, 0.32 * fade, w * 0.32);
    }
    // wo die Zeitalter ansetzen: eine kleine Raute am Stamm, daneben Nummer und Jahre
    for (const b of this.br) {
      const t = TRUNK.getTangent(b.u);
      const col = b.ep.playable ? 0xe0a848 : 0xb8ab90;
      g.fillStyle(0x0a0806, 1);
      g.fillPoints([V(b.o.x, b.o.y - 7), V(b.o.x + 6, b.o.y), V(b.o.x, b.o.y + 7), V(b.o.x - 6, b.o.y)], true);
      g.fillStyle(col, b.ep.playable ? 1 : 0.6);
      g.fillPoints([V(b.o.x, b.o.y - 5), V(b.o.x + 4, b.o.y), V(b.o.x, b.o.y + 5), V(b.o.x - 4, b.o.y)], true);
      // auf der anderen Seite des Stammes (dort, wo kein Ast ist): Nummer, Name und Zeitraum – der Stamm ist die Zeit
      const lx = b.o.x + t.y * 15, ly = b.o.y - t.x * 15;
      this.add.text(lx, ly - 7, `${ROMAN[b.k]} · ${b.ep.name.toUpperCase()}`, {
        fontFamily: TITLE_FONT, fontSize: '12px', color: b.ep.playable ? '#e0a848' : '#a89c84', fontStyle: '700', resolution: 2,
      }).setOrigin(0, 0.5).setLetterSpacing(2).setAlpha(b.ep.playable ? 1 : 0.75);
      text(this, lx, ly + 8, `vor ${b.ep.period[0]}–${b.ep.period[1]} Mio. Jahren`, 11, UI.boneDim).setOrigin(0, 0.5).setAlpha(0.6);
    }
  }

  /** dein Weg in diesem Zeitalter: ein heller Strang vom Ansatz bis zur jetzigen Generation, Knoten an jeder neuen Art */
  private strand(g: Phaser.GameObjects.Graphics, b: Branch, run: Run) {
    const path = this.pathOf(b, run);
    const tip = frac(run.life.gen);
    this.stroke(g, b.curve, 0, tip, 10, 6, 0xffd890, 0.08);
    this.stroke(g, b.curve, 0, tip, 5, 3.2, STRAND, 0.95);
    let lastView = -1;
    path.forEach((n, j) => {
      if (j === 0) return;
      const t = frac(n.gen ?? 0), p = b.curve.getPointAt(t);
      g.fillStyle(CLS_COLOR[n.cls], 1);
      g.fillCircle(p.x, p.y, 5);
      g.lineStyle(1.2, 0x000000, 0.7);
      g.strokeCircle(p.x, p.y, 5);
      // ein kleines Bild der Art neben ihrem Knoten (nicht zu dicht – auch nicht am Ende, dort sitzt dein Tier)
      if (this.views.length < 6 && (lastView < 0 || t - lastView > 0.08) && tip - t > 0.08) {
        this.portrait(b, t, n);
        lastView = t;
      }
    });
    // das Ende: Hier lebt deine Linie gerade – es leuchtet und wächst weiter
    const e = b.curve.getPointAt(tip);
    const glow = this.add.image(e.x, e.y, 'glow').setScale(0.5).setTint(0xffe2a8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(5);
    this.tweens.add({ targets: glow, alpha: 0.35, scale: 0.68, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
    g.fillStyle(0xfff0cc, 1);
    g.fillCircle(e.x, e.y, 5);
    this.portrait(b, tip, path[path.length - 1], true);
  }

  /** ein kleines Bild über dem Strang */
  private portrait(b: Branch, t: number, n: TreeNode, now = false) {
    const p = b.curve.getPointAt(t), tg = b.curve.getTangentAt(t);
    // die Seite „oben“ des Astes
    let nx = tg.y, ny = -tg.x;
    if (ny > 0) [nx, ny] = [-nx, -ny];
    const morph = now && b.run ? this.morphOfRun(b.run) : this.morphOf(n);
    const v = new CreatureView(this, p.x + nx * 26, p.y + ny * 26, morph, 0.4).setDepth(6);
    v.setFacing(b.dir.x < 0 ? -1 : 1);
    this.views.push(v);
  }

  /** am Ende jedes Astes leise seine Nummer */
  private labels(b: Branch) {
    const x = b.end.x + b.dir.x * 14, y = b.end.y + b.dir.y * 14;
    this.add.text(x, y, ROMAN[b.k], { fontFamily: TITLE_FONT, fontSize: '11px', color: '#a89c84', fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(1).setAlpha(b.ep.playable ? 0.8 : 0.45);
  }

  /** ein Stück Kurve als Strich, der von w0 auf w1 schmaler wird */
  private stroke(g: Phaser.GameObjects.Graphics, c: Phaser.Curves.Curve, t0: number, t1: number, w0: number, w1: number, col: number, a: number) {
    if (t1 <= t0) return;
    const n = Math.max(2, Math.ceil(((t1 - t0) * c.getLength()) / 6));
    let prev = c.getPointAt(t0);
    for (let j = 1; j <= n; j++) {
      const t = t0 + ((t1 - t0) * j) / n, p = c.getPointAt(t), w = lerp(w0, w1, j / n);
      g.lineStyle(w, col, a);
      g.lineBetween(prev.x, prev.y, p.x, p.y);
      g.fillStyle(col, a);
      g.fillCircle(p.x, p.y, w / 2);
      prev = p;
    }
  }

  /** die Arten deiner Linie in diesem Zeitalter, vom Urahn an */
  private pathOf(b: Branch, run: Run): TreeNode[] {
    const nodes = game.pathTo(run.node).map((id) => game.data.nodes[id]).filter((n) => n && n.epoch === b.i);
    return nodes.length ? nodes : [game.data.nodes[rootId(b.i)] ?? rootNode(b.i)];
  }

  private morphOf(n: TreeNode): Morph {
    return game.morph({ cls: n.cls, traits: n.traits, hue: n.hue, seed: n.seed, fierce: 0, sex: 0 });
  }

  /** dein Tier, wie es ausgewachsen aussieht */
  private morphOfRun(r: Run): Morph {
    return game.morph({ cls: r.cls, traits: r.traits, hue: r.hue, seed: r.seed, fierce: 0, sex: 0 });
  }

  // ---------------------------------------------------------------- berühren und anzeigen

  /** alles Berührbare eines Astes: der Ansatz (Urahn), die Arten deines Weges (auch zwischen den Knoten), das Ende, der leere Rest */
  private branchPicks(b: Branch): Pick[] {
    const out: Pick[] = [];
    const root = game.data.nodes[rootId(b.i)] ?? rootNode(b.i);
    const run = b.run;
    const tip = run ? frac(run.life.gen) : 0;
    if (run) {
      const path = this.pathOf(b, run);
      path.forEach((n, j) => {
        const last = j + 1 >= path.length;
        const g0 = Math.max(1, n.gen ?? 0), g1 = last ? run.life.gen : (path[j + 1].gen ?? 0) - 1;
        const t0 = frac(n.gen ?? 0), t1 = last ? tip : frac(path[j + 1].gen ?? 0);
        const gens: [number, number] = [g0, Math.max(g0, g1)];
        // der Abschnitt dieser Art: auf ganzer Länge berührbar
        for (let t = t0; t < t1; t += 0.02) {
          const p = b.curve.getPointAt(t);
          out.push({ x: p.x, y: p.y, r: 9, kind: j === 0 ? 'root' : 'node', b, n, gens });
        }
        const p = b.curve.getPointAt(t0);
        out.push({ x: p.x, y: p.y, r: 14, kind: j === 0 ? 'root' : 'node', b, n, gens });
      });
      const e = b.curve.getPointAt(tip);
      out.push({ x: e.x, y: e.y, r: 15, kind: 'tip', b, n: path[path.length - 1] });
    } else {
      out.push({ x: b.o.x, y: b.o.y, r: 14, kind: 'root', b, n: root });
    }
    // der noch leere Teil des Astes
    for (let t = Math.max(0.05, tip + 0.04); t < 1; t += 0.035) {
      const p = b.curve.getPointAt(t);
      out.push({ x: p.x, y: p.y, r: 9, kind: 'era', b });
    }
    out.push({ x: b.end.x, y: b.end.y, r: 14, kind: 'era', b });
    return out;
  }

  private pick(px: number, py: number): Pick | undefined {
    if (px > PANEL_X - 12) return undefined;
    let best: Pick | undefined, bd = Infinity;
    for (const p of this.picks) {
      const d = Math.hypot(p.x - px, p.y - py);
      // Knoten und Enden gehen vor einem Stück Strang
      const score = d - (p.r >= 14 ? 4 : 0);
      if (d < p.r && score < bd) {
        bd = score;
        best = p;
      }
    }
    return best;
  }

  /** wohin der Blick zuerst fällt: das Ende deiner Linie – sonst der Urahn des ersten spielbaren Zeitalters */
  private home0(): Pick {
    const b = this.br.find((x) => x.run && x.i === game.chosenEpoch) ?? this.br.find((x) => x.run);
    const tip = b ? this.picks.find((p) => p.kind === 'tip' && p.b === b) : undefined;
    return tip ?? this.rootPick(this.br.find((x) => x.ep.playable) ?? this.br[0]) ?? this.picks[0];
  }

  private rootPick(b: Branch) {
    return this.picks.find((p) => p.kind === 'root' && p.b === b && p.r === 14);
  }

  /** ← →: die Knoten der Reihe nach (je Ast: Urahn, Arten, Ende; leere Äste mit ihrem Ende) */
  private step(d: number) {
    const keys = this.picks.filter((p) => p.r >= 14);
    const i = keys.findIndex((p) => this.same(p, this.sel));
    const next = keys[clamp((i < 0 ? 0 : i) + d, 0, keys.length - 1)];
    if (next && !this.same(next, this.sel)) {
      audio.sfx('click');
      this.select(next);
    }
  }

  private same(a?: Pick, b?: Pick) {
    return !!a && !!b && a.b === b.b && a.kind === b.kind && a.n === b.n && a.gens?.[0] === b.gens?.[0];
  }

  private select(p: Pick) {
    if (this.same(p, this.sel)) return;
    this.sel = p;
    const g = this.ring;
    g.clear();
    // den berührten Knoten (bzw. den Anfang des berührten Abschnitts, das Ende eines leeren Astes) umringen
    const at = p.kind === 'era' ? p.b.end : p.kind === 'tip' ? V(p.x, p.y) : p.b.curve.getPointAt(frac(p.n?.gen ?? 0));
    g.lineStyle(2, 0xffe2a8, 0.9);
    g.strokeCircle(at.x, at.y, p.kind === 'era' ? 9 : 11);
    this.showInfo(p);
  }

  private showInfo(p: Pick) {
    const c = this.info;
    c.removeAll(true);
    this.infoView = undefined;
    const cx = PANEL_X + (W - PANEL_X - 18) / 2;
    const ep = p.b.ep, run = p.b.run;
    const root = p.kind === 'root' || p.kind === 'era';
    const n = p.n ?? game.data.nodes[rootId(p.b.i)] ?? rootNode(p.b.i);
    // oben das Zeitalter
    c.add(this.add.text(cx, 122, `${ROMAN[p.b.k]} · ${ep.name.toUpperCase()}`, { fontFamily: TITLE_FONT, fontSize: '13px', color: ep.playable ? '#e0a848' : '#a89c84', fontStyle: '700', resolution: 2 }).setOrigin(0.5).setLetterSpacing(4));
    c.add(this.add.image(cx, 318, 'pedestal').setScale(0.9, 0.8).setAlpha(root ? 0.5 : 1));
    const v = new CreatureView(this, cx, 0, p.kind === 'tip' && run ? this.morphOfRun(run) : this.morphOf(n), 1.1);
    v.setY(v.L.land ? 314 - v.L.footY * 1.1 : 262);
    if (!ep.playable) v.setShade(0x3a3630);
    c.add(v);
    this.infoView = v;
    let name: string, sub: string;
    const lines: string[] = [];
    const Era = inEra(ep).replace(/^./, (s) => s.toUpperCase());
    if (p.kind === 'tip' && run) {
      name = game.currentName;
      sub = CLASSES[n.cls].name;
      lines.push('Deine Linie lebt.', `${Era}: Generation ${run.life.gen}`);
      if (n.parent && (n.gen ?? 0) > 1) lines.push(`diese Art seit Generation ${n.gen}`);
    } else if (p.kind === 'node' && p.gens) {
      name = speciesName(n);
      sub = CLASSES[n.cls].name;
      const [g0, g1] = p.gens, k = g1 - g0 + 1;
      lines.push(g0 === g1 ? `Generation ${g0}` : `Generation ${g0} bis ${g1}`, `${k} ${k === 1 ? 'Generation' : 'Generationen'} ${inEra(ep)}`);
    } else if (p.kind === 'root' && run) {
      name = `Der Urahn ${ofEra(ep)}`;
      sub = 'Hier begann deine Linie';
      if (p.gens) {
        const [g0, g1] = p.gens, k = g1 - g0 + 1;
        lines.push(`Generation ${g0}${g1 > g0 ? ` bis ${g1}` : ''}: noch wie der Urahn`, `(${k} ${k === 1 ? 'Generation' : 'Generationen'})`);
      }
      lines.push('', `${Era} bisher:`, `${run.life.gen} ${run.life.gen === 1 ? 'Generation' : 'Generationen'}`);
    } else if (ep.playable) {
      name = `Der Urahn ${ofEra(ep)}`;
      sub = ep.tagline;
      lines.push(`vor ${ep.period[0]} bis ${ep.period[1]} Mio. Jahren`, '', 'Noch keine Linie –', 'hier beginnt dein erstes Leben.');
    } else {
      name = ep.name;
      sub = ep.tagline;
      lines.push(`vor ${ep.period[0]} bis ${ep.period[1]} Mio. Jahren`, '', 'Dieses Zeitalter ruht noch', 'im Gestein. Sein Ast wartet.');
    }
    c.add(title(this, cx, 144, name, 19, UI.bone).setOrigin(0.5, 0).setWordWrapWidth(290).setAlign('center'));
    c.add(text(this, cx, 176 + (name.length > 24 ? 22 : 0), sub, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5, 0));
    c.add(text(this, cx, 362, lines.join('\n'), 17, UI.bone, { align: 'center', lineSpacing: 4, wordWrap: { width: 290 } }).setOrigin(0.5, 0));
  }

  private focusBtn(d: number) {
    const items = [this.main, this.home];
    const i = d === 0 ? 0 : clamp(this.focusIdx + d, 0, 1);
    if (d && i !== this.focusIdx) audio.sfx('click');
    this.focusIdx = i;
    items.forEach((b, k) => b.setFocus(k === i));
  }

  // ---------------------------------------------------------------- Einblendungen

  /** Das Ende deiner Linie macht kurz auf sich aufmerksam. */
  private reveal() {
    const b = this.br.find((x) => x.run && x.i === game.chosenEpoch) ?? this.br.find((x) => x.run);
    if (!b?.run) return;
    const e = b.curve.getPointAt(frac(b.run.life.gen));
    const ring = this.add.circle(e.x, e.y, 10).setStrokeStyle(2, 0xffe2a8).setDepth(7);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 1200, repeat: 1, delay: 700, onComplete: () => ring.destroy() });
  }

  /** "Deine Linie ist ausgestorben." – danach zerfällt ihr Strang zu Staub, und nur der Urahn bleibt. */
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
    const leaf = game.data.nodes[d.leaf];
    const gens = leaf?.dead?.gens ?? leaf?.gen ?? 1;
    const t1 = title(this, W / 2, 150, 'Deine Linie ist ausgestorben.', 42, '#c8473a').setOrigin(0.5).setAlpha(0);
    const t2 = text(this, W / 2, 460, `${ep.name} · nach ${gens} ${gens === 1 ? 'Generation' : 'Generationen'}`, 22, UI.bone).setOrigin(0.5).setAlpha(0);
    const t3 = text(this, W / 2, 496, `Ursache: ${d.cause}`, 19, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    // die Linie endet, weil kein befruchtetes Gelege da war, aus dem die nächste Generation hätte schlüpfen können
    const t4 = text(this, W / 2, 532, 'Kein befruchtetes Gelege – niemand führt die Linie weiter.', 17, UI.boneDim).setOrigin(0.5).setAlpha(0);
    c.add([t1, t2, t3, t4]);
    this.tweens.add({ targets: t1, alpha: 1, duration: 1200 });
    this.tweens.add({ targets: [t2, t3], alpha: 1, duration: 1000, delay: 1100 });
    this.tweens.add({ targets: t4, alpha: 0.85, duration: 1000, delay: 1900 });
    this.overlay = c;
    this.input.keyboard!.once('keydown', () => this.closeOverlay());
    this.time.delayedCall(9000, () => this.closeOverlay());
  }

  private closeOverlay() {
    const c = this.overlay;
    if (!c) return;
    this.overlay = undefined;
    this.tweens.add({ targets: c, alpha: 0, duration: 900, onComplete: () => c.destroy() });
    if (this.d.mode === 'extinct') this.crumble(this.d);
  }

  /** Der Strang der ausgestorbenen Linie: kurz noch zu sehen, dann zerfällt er von seinem Ende her zu Staub. */
  private crumble(d: Extract<TreeData, { mode: 'extinct' }>) {
    const b = this.br.find((x) => x.i === d.epoch);
    const leaf = game.data.nodes[d.leaf];
    if (!b || !leaf) return;
    const tip = frac(Math.max(1, leaf.dead?.gens ?? leaf.gen ?? 1));
    const g = this.add.graphics().setDepth(4);
    this.stroke(g, b.curve, 0, tip, 5, 3.2, 0x9a7a66, 0.9);
    const e = b.curve.getPointAt(tip);
    const skull = this.add.image(e.x, e.y, 'ic_skull').setScale(0.4).setTint(0xa8392c).setDepth(5);
    g.setAlpha(0);
    skull.setAlpha(0);
    this.tweens.add({ targets: [g, skull], alpha: 1, duration: 700, delay: 600 });
    this.time.delayedCall(2400, () => {
      audio.sfx('tear');
      // Staub rieselt vom Strang, vom Ende zum Ansatz
      const n = 16;
      for (let j = 0; j <= n; j++) {
        const p = b.curve.getPointAt(tip * (1 - j / n));
        this.time.delayedCall(j * 60, () => {
          const dust = this.add.particles(p.x, p.y, 'p_dot', {
            lifespan: 1600, speedY: { min: 8, max: 34 }, speedX: { min: -14, max: 14 }, scale: { start: 0.22, end: 0 },
            alpha: { start: 0.7, end: 0 }, tint: 0xb8a48a, emitting: false,
          }).setDepth(6);
          dust.explode(5);
          this.time.delayedCall(1800, () => dust.destroy());
        });
      }
      this.tweens.add({ targets: [g, skull], alpha: 0, duration: 1300, ease: 'Sine.in', onComplete: () => {
        g.destroy();
        skull.destroy();
        // übrig bleibt der Urahn – mit ihm beginnt alles neu
        const ring = this.add.circle(b.o.x, b.o.y, 10).setStrokeStyle(2, 0xffe2a8).setDepth(7);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 1200, repeat: 1, onComplete: () => ring.destroy() });
        const root = this.rootPick(b);
        if (root) this.select(root);
      } });
    });
  }

  /** Weiterleben – oder (ohne Linie) ein neues Leben beginnen. */
  private play() {
    if (this.overlay) return;
    audio.sfx('confirm');
    const e = game.chosenEpoch;
    if (game.runIn(e)) continueLife(this, e);
    else startNewLife(this, EPOCHS[e]?.playable ? e : (ERAS.find((x) => x.ep.playable)?.i ?? 0));
  }
}
