import Phaser from 'phaser';
import { W, H, DEPTH } from '../config';
import { audio } from '../audio/Audio';
import { bus, game } from '../state/GameState';
import { eraById, neighbors, type EraDef, type EraId, type NodeDef } from '../data/eras';
import { mapTexture } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { shade } from '../util/color';

interface MapData {
  era: EraId;
  completed?: string;
  first?: boolean;
  message?: string;
}

interface NodeView {
  n: NodeDef;
  c: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  icon?: Phaser.GameObjects.GameObject;
  label: Phaser.GameObjects.Text;
}

const TOKEN_SCALE = 0.62;

export class MapScene extends Phaser.Scene {
  private era!: EraDef;
  private dataIn!: MapData;
  private nodes: NodeView[] = [];
  private paths!: Phaser.GameObjects.Graphics;
  private token!: CreatureView;
  private tokenShadow!: Phaser.GameObjects.Image;
  private cur = '';
  private walking = false;
  private walkSfx = 0;
  private info!: { name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; enter: Button };
  private evoText!: Phaser.GameObjects.Text;

  constructor() {
    super('Map');
  }

  init(d: MapData) {
    this.dataIn = d;
    this.era = eraById(d.era);
    this.nodes = [];
    this.walking = false;
  }

  create() {
    fadeIn(this);
    audio.music('map');
    const era = this.era;
    this.add.image(0, 0, mapTexture(this, era.id)).setOrigin(0);
    this.paths = this.add.graphics();
    for (const n of era.nodes) this.makeNode(n);
    this.cur = game.mapPos(era);
    if (this.dataIn.completed && era.nodes.some((n) => n.id === this.dataIn.completed)) this.cur = this.dataIn.completed;
    this.drawPaths();
    this.refreshNodes();

    const start = this.nodeById(this.cur);
    this.tokenShadow = this.add.image(start.x, start.y + 2, 'shadow').setScale(0.9, 0.8).setDepth(DEPTH.player - 1);
    this.token = new CreatureView(this, start.x, start.y, game.appearance(), TOKEN_SCALE).setDepth(DEPTH.player);
    this.placeToken(start.x, start.y);

    // obere Leiste
    const bar = this.add.graphics();
    bar.fillStyle(0x04101e, 0.65);
    bar.fillRect(0, 0, W, 78);
    title(this, 24, 10, era.name, 32);
    text(this, 26, 50, era.sub, 17, '#bfe0f8');
    panel(this, 640, 13, 180, 52, 0.7, 0x0d2238, 26);
    this.add.image(668, 39, 'evo_gem').setScale(0.8);
    this.evoText = title(this, 692, 39, `${game.evo}`, 26, '#bff6ff').setOrigin(0, 0.5);
    new Button(this, 920, 39, 'Karten', { w: 150, h: 50, size: 20, icon: 'ic_map', color: 0x3a6ea8, onClick: () => this.back() });
    new Button(this, 1104, 39, 'Evolution', { w: 190, h: 50, size: 20, icon: 'ic_dna', color: 0x8a4ad0, onClick: () => this.openEvolution() });
    soundButton(this, W - 40, 39, 50);

    // Info unten
    panel(this, 200, 592, 880, 116);
    const name = title(this, 228, 604, '', 28);
    const status = text(this, 1050 - 230, 612, '', 18, '#ffe680').setOrigin(1, 0);
    const desc = text(this, 230, 646, '', 18, '#d8ecff', { wordWrap: { width: 580 } });
    const enter = new Button(this, 950, 664, 'Betreten', { w: 210, h: 58, icon: 'ic_play', color: 0xf08a24, onClick: () => this.enter() });
    this.info = { name, desc, status, enter };
    text(this, W / 2, H - 6, 'Pfeiltasten: laufen · Enter: betreten · E: Evolution · Esc: Kartenwahl', 15, '#cfe2f2').setOrigin(0.5, 1).setAlpha(0.85);
    this.updateInfo();

    const kb = this.input.keyboard!;
    for (const [k, dx, dy] of [['LEFT', -1, 0], ['RIGHT', 1, 0], ['UP', 0, -1], ['DOWN', 0, 1], ['A', -1, 0], ['D', 1, 0], ['W', 0, -1], ['S', 0, 1]] as const) {
      kb.on(`keydown-${k}`, () => this.stepDir(dx, dy));
    }
    kb.on('keydown-ENTER', () => this.enter());
    kb.on('keydown-SPACE', () => this.enter());
    kb.on('keydown-E', () => this.openEvolution());
    kb.on('keydown-ESC', () => this.back());

    const onEvolved = () => {
      this.token.build(game.appearance());
      this.placeToken(this.token.x, this.tokenShadow.y - 2);
    };
    bus.on('evolved', onEvolved);
    bus.on('evo', this.updateEvo, this);
    this.events.once('shutdown', () => {
      bus.off('evolved', onEvolved);
      bus.off('evo', this.updateEvo, this);
    });
    this.events.on('resume', () => this.updateEvo());

    if (this.dataIn.completed) this.celebrate(this.dataIn.completed, !!this.dataIn.first);
    if (this.dataIn.message) this.toast(this.dataIn.message, 3200, 170);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    const land = this.token.L.land;
    this.token.animate(dt, this.walking ? (land ? 'walk' : 'swim') : land ? 'idle' : 'swim', this.walking ? 0.8 : 0.2);
    if (this.walking && performance.now() > this.walkSfx) {
      this.walkSfx = performance.now() + 260;
      audio.sfx(land ? 'step' : 'swim');
    }
  }

  // ----------------------------------------------------------------------

  private nodeById(id: string) {
    return this.era.nodes.find((n) => n.id === id)!;
  }

  private makeNode(n: NodeDef) {
    const c = this.add.container(n.x, n.y).setDepth(5);
    const g = this.add.graphics();
    c.add(g);
    const label = title(this, 0, 40, n.name, 18).setOrigin(0.5, 0);
    c.add(label);
    c.setSize(80, 80);
    c.setInteractive(new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains);
    if (c.input) c.input.cursor = 'pointer';
    c.on('pointerdown', () => this.clickNode(n.id));
    this.nodes.push({ n, c, g, label });
  }

  private refreshNodes() {
    for (const v of this.nodes) {
      const { n, g, c } = v;
      const open = game.nodeOpen(this.era, n.id);
      const done = game.isCompleted(n.id);
      const r = n.boss ? 32 : 26;
      g.clear();
      g.fillStyle(0x000000, 0.35);
      g.fillCircle(2, 5, r + 4);
      const fill = done ? 0xf2b628 : !open ? 0x3a4250 : n.boss ? 0xc8323a : shade(this.era.color, 0.15);
      g.fillStyle(0xffffff, open ? 1 : 0.5);
      g.fillCircle(0, 0, r + 4);
      g.fillStyle(fill, 1);
      g.fillCircle(0, 0, r);
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(-r * 0.25, -r * 0.4, r * 1.1, r * 0.6);
      v.icon?.destroy();
      let icon: Phaser.GameObjects.GameObject;
      if (!open) icon = this.add.image(0, 0, 'ic_lock').setScale(0.7).setTint(0xb8c0cc);
      else if (done) icon = this.add.image(0, 0, 'ic_check').setScale(0.75);
      else if (n.boss) icon = this.add.image(0, 0, 'ic_skull').setScale(0.8);
      else icon = title(this, 0, 0, `${this.era.nodes.indexOf(n) + 1}`, 26).setOrigin(0.5);
      c.add(icon);
      v.icon = icon;
      v.label.setColor(open ? '#ffffff' : '#a8b4c4');
      this.tweens.killTweensOf(c);
      c.setScale(1);
      if (open && !done) this.tweens.add({ targets: c, scale: 1.08, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    }
  }

  private drawPaths() {
    const g = this.paths;
    g.clear();
    for (const [a, b] of this.era.edges) {
      const na = this.nodeById(a), nb = this.nodeById(b);
      const open = game.nodeOpen(this.era, a) && game.nodeOpen(this.era, b);
      const len = Math.hypot(nb.x - na.x, nb.y - na.y);
      const n = Math.floor(len / 18);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = na.x + (nb.x - na.x) * t, y = na.y + (nb.y - na.y) * t;
        g.fillStyle(0x000000, 0.3);
        g.fillCircle(x + 1, y + 2, 5);
        g.fillStyle(open ? 0xfff2c0 : 0x5a6474, open ? 0.95 : 0.7);
        g.fillCircle(x, y, 4.5);
      }
    }
  }

  private placeToken(x: number, y: number) {
    const v = this.token;
    const off = v.L.land ? -v.L.footY * TOKEN_SCALE : -10;
    v.setPosition(x, y + off - 6);
    this.tokenShadow.setPosition(x, y + 2);
  }

  private updateInfo() {
    const n = this.nodeById(this.cur);
    const open = game.nodeOpen(this.era, n.id);
    const done = game.isCompleted(n.id);
    this.info.name.setText(n.name);
    this.info.desc.setText(n.desc);
    this.info.status.setText(done ? 'Geschafft!' : n.boss ? 'Endgegner!' : open ? 'Neu' : 'Gesperrt');
    this.info.status.setColor(done ? '#8aff9a' : n.boss ? '#ff8a7a' : '#ffe680');
    this.info.enter.setDisabled(!open);
  }

  private updateEvo() {
    this.evoText.setText(`${game.evo}`);
  }

  /** Weg zwischen zwei Orten über bereits offene Orte (Breitensuche). */
  private route(from: string, to: string): string[] | null {
    const prev = new Map<string, string>();
    const q = [from];
    const seen = new Set([from]);
    while (q.length) {
      const id = q.shift()!;
      if (id === to) break;
      for (const nb of neighbors(this.era, id)) {
        if (seen.has(nb) || !game.nodeOpen(this.era, nb)) continue;
        seen.add(nb);
        prev.set(nb, id);
        q.push(nb);
      }
    }
    if (!seen.has(to)) return null;
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0])!);
    return path.slice(1);
  }

  private clickNode(id: string) {
    if (this.walking) return;
    if (id === this.cur) {
      this.enter();
      return;
    }
    const path = this.route(this.cur, id);
    if (!path) {
      audio.sfx('fail');
      this.toast('Dieser Ort ist noch nicht erreichbar.');
      return;
    }
    this.walk(path);
  }

  private stepDir(dx: number, dy: number) {
    if (this.walking) return;
    const here = this.nodeById(this.cur);
    let best: string | null = null;
    let bestScore = 0.35;
    for (const id of neighbors(this.era, this.cur)) {
      const n = this.nodeById(id);
      const vx = n.x - here.x, vy = n.y - here.y;
      const len = Math.hypot(vx, vy) || 1;
      const score = (vx / len) * dx + (vy / len) * dy;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    if (!best) return;
    if (!game.nodeOpen(this.era, best)) {
      audio.sfx('fail');
      this.toast('Gesperrt – schaffe zuerst einen Ort davor.');
      return;
    }
    this.walk([best]);
  }

  private walk(path: string[]) {
    if (!path.length) return;
    this.walking = true;
    const id = path[0];
    const n = this.nodeById(id);
    const from = { x: this.tokenShadow.x, y: this.tokenShadow.y - 2 };
    this.token.setFacing(n.x >= from.x ? 1 : -1);
    const dist = Math.hypot(n.x - from.x, n.y - from.y);
    const p = { t: 0 };
    this.tweens.add({
      targets: p,
      t: 1,
      duration: Math.max(250, dist * 3.2),
      onUpdate: () => this.placeToken(from.x + (n.x - from.x) * p.t, from.y + (n.y - from.y) * p.t),
      onComplete: () => {
        this.cur = id;
        game.setMapPos(this.era.id, id);
        this.updateInfo();
        if (path.length > 1) this.walk(path.slice(1));
        else this.walking = false;
      },
    });
  }

  private enter() {
    if (this.walking) return;
    if (!game.nodeOpen(this.era, this.cur)) {
      audio.sfx('fail');
      return;
    }
    audio.sfx('portal');
    game.setMapPos(this.era.id, this.cur);
    fadeTo(this, 'Level', { era: this.era.id, node: this.cur });
  }

  private back() {
    if (this.walking) return;
    fadeTo(this, 'EraSelect');
  }

  private openEvolution() {
    if (this.walking) return;
    audio.sfx('select');
    this.scene.launch('Evolution', { from: 'Map' });
    this.scene.bringToTop('Evolution');
    this.scene.pause();
  }

  private celebrate(id: string, first: boolean) {
    const n = this.nodeById(id);
    const burst = this.add.particles(n.x, n.y, 'p_spark', {
      speed: { min: 80, max: 260 }, lifespan: 900, scale: { start: 0.9, end: 0 }, tint: [0xffe680, 0xffffff, 0x8affff],
      emitting: false,
    }).setDepth(30);
    burst.explode(30);
    if (!first) return;
    const opened = neighbors(this.era, id).filter((nb) => !game.isCompleted(nb));
    if (opened.length) {
      this.time.delayedCall(500, () => {
        audio.sfx('unlock');
        for (const nb of opened) {
          const v = this.nodes.find((x) => x.n.id === nb)!;
          const fx = this.add.particles(v.n.x, v.n.y, 'p_spark', { speed: { min: 40, max: 160 }, lifespan: 700, scale: { start: 0.7, end: 0 }, emitting: false }).setDepth(30);
          fx.explode(16);
        }
        this.toast('Neuer Ort freigeschaltet!');
      });
    }
  }

  private toast(msg: string, ms = 1600, y = 120) {
    const t = title(this, W / 2, y, msg, 26, '#ffe8b0').setOrigin(0.5).setDepth(60);
    t.setWordWrapWidth(900).setAlign('center');
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: y - 20, delay: ms, duration: 500, onComplete: () => t.destroy() });
  }
}
