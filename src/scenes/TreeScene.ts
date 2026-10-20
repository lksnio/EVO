import Phaser from 'phaser';
import { W, H, TITLE_FONT, UI } from '../config';
import { audio } from '../audio/Audio';
import { game, rootId, rootNode, speciesName, type TreeNode } from '../state/GameState';
import { EPOCHS, ERAS, inEra, ofEra, yearsAgo } from '../data/epochs';
import { CLASSES, type ClassId } from '../data/classes';
import type { Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import { clamp } from '../util/math';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';
import { continueLife, startNewLife } from './flow';

type TreeData =
  | { mode: 'extinct'; leaf: string; morph: Morph; epoch: number; cause: string; years: number }
  | { mode: 'present'; node: string; epoch?: number }
  | { mode?: 'view'; epoch?: number };

// ---------------------------------------------------------------------------
// Der Stammbaum des Lebens – außerhalb des Spiels. Jedes Zeitalter hat seinen eigenen Baum: Alle Linien beginnen dort mit
// demselben Urahn und wachsen nach unten, Generation für Generation. Wo sich eine Linie zu einer neuen Art entwickelt, teilt
// sich der Ast; Linien, die sich gleichen, teilen ihn sich. Ausgestorbene Zweige enden mit einem Schädel, die lebende Linie
// leuchtet. Oben läuft der Zeitstrom der Erdgeschichte: Jeder Baum ist ein Ausschnitt daraus – davor und danach geht das
// Leben weiter, nur spielt man es (noch) nicht.
// ---------------------------------------------------------------------------

/** Der Baumbereich */
const AX = 196, AW = 724, TOP = 196, BOT = 660;
const PANEL_X = 944;
/** der Zeitstrom: von vor 424 bis vor 18 Millionen Jahren – die sieben Zeitalter liegen lückenlos darin */
const STREAM = { y: 96, from: 424, to: 18 };

const CLS_COLOR: Record<ClassId, number> = {
  fish: 0x6f9e98,
  amphibian: 0x86a060,
  reptile: 0xb08250,
  mammal: 0xd2aa72,
};

interface Pos {
  n: TreeNode;
  x: number;
  y: number;
  /** die lebende Linie (ihr Astende wächst noch) */
  alive?: boolean;
}

const streamX = (ma: number) => AX + ((STREAM.from - ma) / (STREAM.from - STREAM.to)) * AW;
const LIVING = 'living';

export class TreeScene extends Phaser.Scene {
  private d!: TreeData;
  /** das Zeitalter, dessen Baum gerade zu sehen ist (Nummer) */
  private era = 0;
  private pos = new Map<string, Pos>();
  private treeC!: Phaser.GameObjects.Container;
  private lines!: Phaser.GameObjects.Graphics;
  private path!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Container;
  private axis!: Phaser.GameObjects.Container;
  private stream!: Phaser.GameObjects.Container;
  private infoView?: CreatureView;
  private views: CreatureView[] = [];
  private panX = 0;
  private minPan = 0;
  private gmax = 6;
  private drag?: { x: number; pan: number };
  private overlay?: Phaser.GameObjects.Container;
  private selected = '';
  private main!: Button;
  private home!: Button;
  private focusIdx = 0;
  private switching = false;

  constructor() {
    super('Tree');
  }

  init(d: TreeData) {
    this.d = d ?? { mode: 'view' };
    const want = this.d.mode === 'extinct' ? this.d.epoch : this.d.epoch ?? game.chosenEpoch;
    this.era = ERAS.some((e) => e.i === want) ? want! : ERAS[0].i;
    this.pos = new Map();
    this.views = [];
    this.infoView = undefined;
    this.overlay = undefined;
    this.panX = 0;
    this.drag = undefined;
    this.selected = '';
    this.focusIdx = 0;
    this.switching = false;
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    this.cameras.main.setBackgroundColor('#070605');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0b09, 0x0d0b09, 0x040303, 0x040303, 1);
    bg.fillRect(0, 0, W, H);

    // Baum (verschiebbar, falls er breiter wird als der Platz)
    this.treeC = this.add.container(0, 0);
    this.lines = this.add.graphics();
    this.path = this.add.graphics();
    this.hover = this.add.graphics();
    this.treeC.add([this.lines, this.path, this.hover]);

    // links: die Generationen (deckt den Baum ab, wenn man ihn verschiebt)
    const axisBg = this.add.graphics();
    axisBg.fillStyle(0x070605, 1);
    axisBg.fillRect(0, TOP - 40, AX - 14, H);
    axisBg.fillGradientStyle(0x070605, 0x070605, 0x070605, 0x070605, 1, 0, 1, 0);
    axisBg.fillRect(AX - 14, TOP - 40, 18, H);
    this.axis = this.add.container(0, 0);

    // Kopfzeile und Zeitstrom
    title(this, 30, 16, 'Stammbaum des Lebens', 30);
    this.stream = this.add.container(0, 0);

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
    this.main = new Button(this, cx, 608, 'Leben beginnen', { w: 290, h: 54, icon: 'ic_play', color: UI.ochreN, sound: null, onClick: () => this.play() });
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
      if (p.x > AX - 10 && p.x < PANEL_X - 10 && p.y > TOP - 40) {
        const n = this.pick(p.x, p.y);
        if (n) this.select(n.n.id);
        else this.drag = { x: p.x, pan: this.panX };
      }
    });
    this.input.on('pointerup', () => (this.drag = undefined));
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => this.panTo(this.panX - (dx || dy) * 0.6));

    // Tastatur: ← → das Zeitalter, ↑ ↓ die Knöpfe
    const kb = this.input.keyboard!;
    const busy = () => !!this.overlay || !this.input.enabled;
    kb.on('keydown-LEFT', () => !busy() && this.stepEra(-1));
    kb.on('keydown-RIGHT', () => !busy() && this.stepEra(1));
    kb.on('keydown-UP', () => !busy() && this.focusBtn(-1));
    kb.on('keydown-DOWN', () => !busy() && this.focusBtn(1));
    const act = () => !busy() && [this.main, this.home][this.focusIdx].click();
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-ESC', () => (this.overlay ? this.closeOverlay() : fadeTo(this, 'Title')));

    this.build(false);
    if (this.d.mode === 'extinct') this.extinctOverlay(this.d);
    else this.revealPath(false);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    for (const v of this.views) v.animate(dt, v.L.land ? 'idle' : 'swim', 0.15);
    this.infoView?.animate(dt, this.infoView.L.land ? 'idle' : 'swim', 0.25);
  }

  // ---------------------------------------------------------------- ein Zeitalter zeigen

  /** Baum, Achse, Zeitstrom und Knöpfe für das gewählte Zeitalter (neu) aufbauen. */
  private build(animate: boolean) {
    for (const v of this.views) v.destroy();
    this.views = [];
    this.treeC.each((o: Phaser.GameObjects.GameObject) => {
      if (o !== this.lines && o !== this.path && o !== this.hover) o.destroy();
    });
    this.pos = new Map();
    this.selected = '';
    this.panX = 0;
    this.treeC.x = 0;
    this.layout();
    this.drawTree();
    this.axisLabels();
    this.drawStream();
    const ep = EPOCHS[this.era];
    const run = game.runIn(this.era);
    this.main.setLabel(!ep.playable ? 'Noch im Gestein' : run ? 'Weiterleben' : 'Leben beginnen').setDisabled(!ep.playable);
    this.focusBtn(0);
    const end = this.d.mode === 'extinct' && this.d.epoch === this.era ? this.d.leaf : run ? LIVING : this.lastEndHere();
    this.select(end && this.pos.has(end) ? end : rootId(this.era));
    const ep2 = end ? this.pos.get(end) : undefined;
    if (ep2) this.panTo(AX + AW / 2 - ep2.x);
    if (animate) {
      this.revealPath(false);
      for (const o of [this.treeC, this.axis]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: 420, ease: 'Sine.out' });
      }
    }
  }

  /** Das zuletzt beendete Leben – wenn es zu diesem Zeitalter gehört. */
  private lastEndHere() {
    const id = game.data.lastEnd;
    return id && game.data.nodes[id]?.epoch === this.era ? id : null;
  }

  private stepEra(d: number) {
    const k = ERAS.findIndex((e) => e.i === this.era);
    const next = ERAS[clamp(k + d, 0, ERAS.length - 1)].i;
    this.showEra(next);
  }

  private showEra(i: number) {
    if (i === this.era || this.switching) return;
    this.switching = true;
    audio.sfx('tab');
    this.tweens.add({
      targets: [this.treeC, this.axis], alpha: 0, duration: 180, ease: 'Sine.in',
      onComplete: () => {
        this.era = i;
        this.build(true);
        this.switching = false;
      },
    });
  }

  private focusBtn(d: number) {
    const items = [this.main, this.home];
    let i = d === 0 ? (this.main.disabled ? 1 : 0) : this.focusIdx + d;
    i = clamp(i, 0, 1);
    if (items[i].disabled) i = 1;
    if (d && i !== this.focusIdx) audio.sfx('click');
    this.focusIdx = i;
    items.forEach((b, k) => b.setFocus(k === i));
  }

  // ---------------------------------------------------------------- Aufbau

  /** Die Knoten dieses Zeitalters: Blätter gleichmäßig verteilt, innere Knoten über ihren Kindern; senkrecht die Generation. */
  private layout() {
    const e = this.era;
    const nodes = game.data.nodes;
    const root = nodes[rootId(e)] ?? rootNode(e);
    const run = game.runIn(e);
    // die lebende Linie: ein Astende, das noch wächst (hängt an der Art, zu der sie gerade gehört)
    const living: TreeNode | undefined = run
      ? { id: LIVING, parent: run.node, epoch: e, gen: run.life.gen, cls: run.cls, traits: run.traits, hue: run.hue, seed: run.seed, sig: '', children: [], runs: 1, last: run.id }
      : undefined;
    const kids = (n: TreeNode): TreeNode[] => {
      const out = n.children.map((c) => nodes[c]).filter((c): c is TreeNode => !!c && c.epoch === e);
      if (living && living.parent === n.id) out.push(living);
      return out.sort((a, b) => a.last - b.last || a.id.localeCompare(b.id));
    };
    const leaves: TreeNode[] = [];
    let gmax = 6;
    const walk = (n: TreeNode) => {
      gmax = Math.max(gmax, n.gen ?? 0);
      const ks = kids(n);
      if (!ks.length && n !== root) leaves.push(n);
      for (const k of ks) walk(k);
    };
    walk(root);
    this.gmax = gmax;
    const L = leaves.length;
    const gap = L <= 1 ? 0 : Math.max(18, Math.min(64, (AW - 80) / (L - 1)));
    const total = gap * Math.max(0, L - 1);
    const x0 = AX + AW / 2 - total / 2;
    leaves.forEach((n, i) => this.place(n, x0 + i * gap));
    const post = (n: TreeNode): number => {
      const p = this.pos.get(n.id);
      if (p) return p.x;
      const xs = kids(n).map(post);
      const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : AX + AW / 2;
      this.place(n, x);
      return x;
    };
    post(root);
    this.minPan = Math.min(0, AW - 60 - total);
  }

  private genY(gen: number) {
    return TOP + (Math.max(0, gen) / this.gmax) * (BOT - TOP);
  }

  private place(n: TreeNode, x: number) {
    this.pos.set(n.id, { n, x, y: this.genY(n.gen ?? 0), alive: n.id === LIVING });
  }

  private drawTree() {
    const g = this.lines;
    g.clear();
    // Zeitbänder: jede zweite Spanne von Generationen etwas heller
    const step = this.genStep();
    for (let gen = 0, k = 0; gen < this.gmax; gen += step, k++) {
      if (k % 2) continue;
      g.fillStyle(0xffffff, 0.018);
      g.fillRect(AX - 400, this.genY(gen), AW + 4400, this.genY(Math.min(this.gmax, gen + step)) - this.genY(gen));
    }
    const rootP = this.pos.get(rootId(this.era))!;
    // der Stamm kommt von oben (aus früheren Zeiten) – und die lebende Linie geht unten weiter
    this.dashed(g, rootP.x, TOP - 46, rootP.x, rootP.y - 8, 0xe6dcc4, 0.35);
    for (const p of this.pos.values()) {
      const n = p.n;
      if (!n.parent) continue;
      const pp = this.pos.get(n.parent);
      if (!pp) continue;
      const w = 1.6 + 1.5 * Math.log2(1 + n.runs);
      const col = p.alive ? 0xe8cf96 : CLS_COLOR[n.cls];
      this.curve(g, pp.x, pp.y, p.x, p.y, w, col, n.dead ? 0.5 : 0.85);
    }
    for (const p of this.pos.values()) {
      const n = p.n;
      if (!n.parent) {
        g.fillStyle(0xe6dcc4, 1);
        g.fillCircle(p.x, p.y, 6.5);
        g.lineStyle(1.5, 0x000000, 0.6);
        g.strokeCircle(p.x, p.y, 6.5);
        continue;
      }
      if (n.dead) {
        const sk = this.add.image(p.x, p.y + 7, 'ic_skull').setScale(0.36).setTint(0xa8392c);
        this.treeC.add(sk);
        continue;
      }
      if (p.alive) {
        // die lebende Linie: ein leuchtendes Ende, und es geht weiter
        this.dashed(g, p.x, p.y + 10, p.x, p.y + 42, 0xe8cf96, 0.45);
        const glow = this.add.image(p.x, p.y, 'glow').setScale(0.5).setTint(0xffe2a8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
        this.treeC.add(glow);
        this.tweens.add({ targets: glow, alpha: 0.35, scale: 0.65, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
        g.fillStyle(0xffe6b4, 1);
        g.fillCircle(p.x, p.y, 5);
        continue;
      }
      g.fillStyle(CLS_COLOR[n.cls], 1);
      g.fillCircle(p.x, p.y, 3.6 + Math.min(3, n.runs * 0.4));
      g.lineStyle(1, 0x000000, 0.6);
      g.strokeCircle(p.x, p.y, 3.6 + Math.min(3, n.runs * 0.4));
    }
    if (!EPOCHS[this.era].playable || this.pos.size === 1) {
      // ein leerer Baum: Noch hat hier niemand gelebt
      const locked = !EPOCHS[this.era].playable;
      const msg = locked ? 'Dieses Zeitalter ruht noch im Gestein.' : 'Noch hat hier keine Linie gelebt.';
      const sub = locked ? 'Sein Urahn wartet – bald bricht der Fels auf.' : 'Jede Linie beginnt mit dem Urahn dieses Zeitalters.';
      this.treeC.add(text(this, rootP.x, rootP.y + 120, msg, 20, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0.8));
      this.treeC.add(text(this, rootP.x, rootP.y + 150, sub, 16, UI.boneDim).setOrigin(0.5).setAlpha(0.8));
    }
  }

  private dashed(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, col: number, a: number) {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(len / 9));
    g.lineStyle(2, col, a);
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n, t1 = Math.min(1, (i + 1) / n);
      g.lineBetween(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
    }
  }

  private curve(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number) {
    const my = y0 + (y1 - y0) * 0.5;
    const c = new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(x0, my), new Phaser.Math.Vector2(x1, my), new Phaser.Math.Vector2(x1, y1));
    g.lineStyle(w, col, a);
    g.strokePoints(c.getPoints(22));
  }

  /** Abstand der Generationen-Marken an der Achse (1, 2, 5, 10, 20 …). */
  private genStep() {
    const raw = this.gmax / 6;
    for (const s of [1, 2, 5, 10, 20, 50, 100, 200]) if (s >= raw) return s;
    return 500;
  }

  private axisLabels() {
    const c = this.axis;
    c.removeAll(true);
    c.add(text(this, 24, this.genY(0) - 10, 'Urahn', 16, UI.bone));
    const step = this.genStep();
    for (let gen = step; gen <= this.gmax; gen += step) {
      const y = this.genY(gen);
      c.add(text(this, 24, y - 9, `Generation ${gen}`, 14, UI.boneDim));
      const g = this.add.graphics();
      g.lineStyle(1, 0xffffff, 0.05);
      g.lineBetween(AX - 30, y, AX - 16, y);
      c.add(g);
    }
  }

  // ---------------------------------------------------------------- der Zeitstrom

  /**
   * Der Zeitstrom: die Erdgeschichte vom Devon bis ins Paläogen als feine Linie, darin die sieben Zeitalter als Fenster
   * (anwählbar) – hell die spielbaren, leise die, die noch im Gestein ruhen. Vom gewählten Fenster führen zwei Linien
   * hinunter zum Baum: Er ist ein Ausschnitt aus dem einen großen Baum des Lebens.
   */
  private drawStream() {
    const c = this.stream;
    c.removeAll(true);
    const g = this.add.graphics();
    c.add(g);
    const y = STREAM.y;
    // die Linie: zwischen den Fenstern nur gepunktet
    g.fillStyle(0xe6dcc4, 0.22);
    for (let x = AX; x <= AX + AW; x += 6) g.fillCircle(x, y, 1);
    for (const { i, ep } of ERAS) {
      const [a, b] = ep.period;
      const x0 = streamX(a), x1 = streamX(b), on = i === this.era;
      g.fillStyle(on ? 0xd9a24c : 0xe6dcc4, on ? 0.95 : ep.playable ? 0.45 : 0.22);
      g.fillRoundedRect(x0 + 2, y - 4, x1 - x0 - 4, 8, 4);
      if (on) {
        // vom Fenster hinunter zum Baum
        g.lineStyle(1, 0xd9a24c, 0.22);
        g.lineBetween(x0, y + 4, AX - 6, TOP - 52);
        g.lineBetween(x1, y + 4, AX + AW + 6, TOP - 52);
        g.lineStyle(1, 0xd9a24c, 0.3);
        g.lineBetween(AX - 6, TOP - 52, AX + AW + 6, TOP - 52);
      }
      const label = this.add.text((x0 + x1) / 2, y - 22, ep.name.toUpperCase(), {
        fontFamily: TITLE_FONT, fontSize: '11px', color: on ? '#e6b25a' : ep.playable ? UI.bone : UI.boneDim, fontStyle: '700', resolution: 2,
      }).setOrigin(0.5).setLetterSpacing(1.5).setAlpha(on ? 1 : 0.7);
      c.add(label);
      if (on) {
        const tag = text(this, (x0 + x1) / 2, y + 30, `${ep.tagline}${ep.playable ? '' : ' · noch im Gestein'}`, 14, UI.bone, { fontStyle: 'italic' }).setOrigin(0.5, 0).setAlpha(0.8);
        // nicht über den Rand des Baumes hinaus
        tag.setX(clamp(tag.x, AX + tag.width / 2, AX + AW - tag.width / 2));
        c.add(tag);
      }
      // anwählbar: Fenster und Name
      const zone = this.add.zone(x0, y - 34, x1 - x0, 46).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (!on) {
          label.setAlpha(1).setColor('#f2e4c4');
          audio.sfx('hover');
        }
      });
      zone.on('pointerout', () => label.setAlpha(on ? 1 : 0.7).setColor(on ? '#e6b25a' : ep.playable ? UI.bone : UI.boneDim));
      zone.on('pointerdown', () => !this.overlay && this.showEra(i));
      c.add(zone);
    }
  }

  // ---------------------------------------------------------------- Dein Weg

  /** Den eigenen Weg hervorheben (die lebende Linie bzw. das zuletzt beendete Leben) – auf Wunsch Stück für Stück. */
  private revealPath(animate: boolean) {
    const g = this.path;
    g.clear();
    const run = game.runIn(this.era);
    const end = this.d.mode === 'extinct' && this.d.epoch === this.era ? this.d.leaf : run ? LIVING : this.lastEndHere();
    if (!end) return;
    const chain: string[] = [];
    for (let id: string | null = end; id; id = this.pos.get(id)?.n.parent ?? null) {
      if (!this.pos.has(id)) break;
      chain.unshift(id);
    }
    const segs = chain.slice(1);
    const drawSeg = (i: number) => {
      const p = this.pos.get(segs[i])!;
      const pp = this.pos.get(chain[i])!;
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
    this.showInfo(p);
  }

  private showInfo(p: Pos) {
    const n = p.n;
    const c = this.info;
    c.removeAll(true);
    this.infoView = undefined;
    const cx = PANEL_X + (W - PANEL_X - 18) / 2;
    const ep = EPOCHS[n.epoch] ?? EPOCHS[this.era];
    const root = !n.parent;
    c.add(this.add.image(cx, 300, 'pedestal').setScale(0.9, 0.8).setAlpha(root ? 0.5 : 1));
    const v = new CreatureView(this, cx, 0, this.morphOf(n), 1.15);
    v.setY(v.L.land ? 296 - v.L.footY * 1.15 : 240);
    if (n.dead) v.setAlpha(0.55);
    if (root && !ep.playable) v.setShade(0x3a3630);
    c.add(v);
    this.infoView = v;
    const name = root ? `Der Urahn ${ofEra(ep)}` : p.alive ? game.currentName : speciesName(n);
    c.add(title(this, cx, 116, name, 19, UI.bone).setOrigin(0.5, 0).setWordWrapWidth(290).setAlign('center'));
    c.add(text(this, cx, 150 + (name.length > 24 ? 22 : 0), root ? 'Der Anfang aller Linien' : CLASSES[n.cls].name, 16, UI.boneDim).setOrigin(0.5, 0));
    const lines: string[] = [];
    const nodes = game.data.nodes;
    if (root) {
      if (!ep.playable) lines.push('Dieses Zeitalter ruht noch', 'im Gestein.');
      else if (n.runs) lines.push(`${n.runs} ${n.runs === 1 ? 'Linie begann' : 'Linien begannen'} hier.`);
      else lines.push('Noch hat hier keine Linie begonnen.');
    } else if (p.alive) {
      lines.push('Deine Linie lebt.', `Generation ${n.gen}`);
    } else if (n.dead) {
      lines.push(`Ausgestorben ${inEra(ep)}`);
      if (n.dead.frac > 0) lines.push(`${yearsAgo(ep.from - (ep.from - ep.to) * n.dead.frac, 1e4)}.`);
      lines.push(`Ursache: ${n.dead.cause}`);
      if (n.dead.gens && n.dead.gens > 1) lines.push(`nach ${n.dead.gens} Generationen`);
    } else {
      lines.push(`Eine Art, die ab Generation ${n.gen ?? 1}`, 'entstand.');
      lines.push(`${n.runs} ${n.runs === 1 ? 'Linie zog' : 'Linien zogen'} hier durch.`);
      const deadKids = n.children.filter((k) => nodes[k]?.dead).length;
      if (deadKids) lines.push(`${deadKids} ${deadKids === 1 ? 'Zweig starb' : 'Zweige starben'} danach aus.`);
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
    this.revealPath(true);
  }

  /** Leben im gezeigten Zeitalter: weiter, oder (ohne Linie) ein neues beginnen. */
  private play() {
    if (this.overlay || !EPOCHS[this.era].playable) return;
    audio.sfx('confirm');
    if (game.runIn(this.era)) continueLife(this, this.era);
    else startNewLife(this, this.era);
  }
}
