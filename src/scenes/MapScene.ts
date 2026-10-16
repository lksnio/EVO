import Phaser from 'phaser';
import { W, H, DEPTH, UI } from '../config';
import { audio } from '../audio/Audio';
import { game } from '../state/GameState';
import { CLASSES } from '../data/classes';
import { eraById, neighbors, type EraDef, type EraId, type NodeDef } from '../data/eras';
import { mapTexture } from '../art/worldArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';

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
  glow: Phaser.GameObjects.Image;
  icon?: Phaser.GameObjects.GameObject;
  label: Phaser.GameObjects.Text;
}

const TOKEN_SCALE = 0.85;
const FOG_KEY = 'map_fog';

/**
 * Die Karte eines Zeitalters. Unbekannte Orte liegen im Nebel und tragen nur ein Fragezeichen –
 * erst wer einen Nachbarort überlebt, erfährt, was dort liegt.
 */
export class MapScene extends Phaser.Scene {
  private era!: EraDef;
  private dataIn!: MapData;
  private nodes: NodeView[] = [];
  private paths!: Phaser.GameObjects.Graphics;
  private fog!: Phaser.GameObjects.Image;
  private token!: CreatureView;
  private tokenShadow!: Phaser.GameObjects.Image;
  private cur = '';
  private walking = false;
  private walkSfx = 0;
  /** Orte, die gerade erst aufgedeckt werden (für die Animation noch verborgen) */
  private pending = new Set<string>();
  private info!: { name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; enter: Button };
  private overlay?: Phaser.GameObjects.Container;
  private overlayViews: CreatureView[] = [];
  private nav?: MenuNav;

  constructor() {
    super('Map');
  }

  init(d: MapData) {
    this.dataIn = d;
    this.era = eraById(d.era);
    this.nodes = [];
    this.walking = false;
    this.pending = new Set();
    this.overlay = undefined;
    this.overlayViews = [];
  }

  create() {
    fadeIn(this, 500);
    audio.music('map');
    const era = this.era;
    this.add.image(0, 0, mapTexture(this, era.id)).setOrigin(0);
    this.paths = this.add.graphics();

    this.cur = game.mapPos(era);
    const done = this.dataIn.completed;
    if (done && era.nodes.some((n) => n.id === done)) {
      this.cur = done;
      if (this.dataIn.first) for (const id of this.newlyOpened(done)) this.pending.add(id);
    }
    for (const n of era.nodes) this.makeNode(n);
    this.fog = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(3);
    this.drawFog();
    this.drawPaths();
    this.refreshNodes();

    const start = this.nodeById(this.cur);
    this.tokenShadow = this.add.image(start.x, start.y - 20, 'shadow').setScale(1.1, 0.8).setAlpha(0.8).setDepth(DEPTH.player - 1);
    this.token = new CreatureView(this, start.x, start.y, game.morph({ belly: 1 }), TOKEN_SCALE).setDepth(DEPTH.player);
    this.placeToken(start.x, start.y);

    // obere Leiste
    const bar = this.add.graphics().setDepth(DEPTH.text);
    bar.fillGradientStyle(0x050403, 0x050403, 0x050403, 0x050403, 0.9, 0.9, 0, 0);
    bar.fillRect(0, 0, W, 96);
    title(this, 26, 12, era.name, 32).setDepth(DEPTH.text);
    text(this, 28, 54, era.sub, 17, UI.boneDim).setDepth(DEPTH.text);
    new Button(this, 896, 40, 'Zeitalter', { w: 180, h: 48, size: 18, icon: 'ic_back', onClick: () => this.back() }).setDepth(DEPTH.text);
    new Button(this, 1090, 40, 'Dein Tier', { w: 180, h: 48, size: 18, icon: 'ic_eye', onClick: () => this.showCreature() }).setDepth(DEPTH.text);
    soundButton(this, W - 40, 40, 48).setDepth(DEPTH.text);

    // Info unten
    panel(this, 200, 588, 880, 120, 0.9).setDepth(DEPTH.text);
    const name = title(this, 228, 600, '', 28).setDepth(DEPTH.text);
    const status = text(this, 820, 608, '', 18, UI.ochre).setOrigin(1, 0).setDepth(DEPTH.text);
    const desc = text(this, 230, 644, '', 18, UI.bone, { wordWrap: { width: 590 } }).setDepth(DEPTH.text);
    const enter = new Button(this, 952, 648, 'Aufbrechen', { w: 210, h: 58, icon: 'ic_play', color: UI.ochreN, onClick: () => this.enter() }).setDepth(DEPTH.text);
    this.info = { name, desc, status, enter };
    text(this, W / 2, H - 4, 'Pfeiltasten: wandern  ·  Enter: aufbrechen  ·  T: dein Tier  ·  Esc: Zeitalter', 15, UI.boneDim)
      .setOrigin(0.5, 1).setAlpha(0.7).setDepth(DEPTH.text);
    this.updateInfo();

    const kb = this.input.keyboard!;
    for (const [k, dx, dy] of [['LEFT', -1, 0], ['RIGHT', 1, 0], ['UP', 0, -1], ['DOWN', 0, 1], ['A', -1, 0], ['D', 1, 0], ['W', 0, -1], ['S', 0, 1]] as const) {
      kb.on(`keydown-${k}`, () => !this.overlay && this.stepDir(dx, dy));
    }
    kb.on('keydown-ENTER', () => !this.overlay && this.enter());
    kb.on('keydown-SPACE', () => !this.overlay && this.enter());
    kb.on('keydown-T', () => (this.overlay ? this.closeOverlay() : this.showCreature()));
    kb.on('keydown-ESC', () => (this.overlay ? this.closeOverlay() : this.back()));

    if (done) this.celebrate(done);
    if (this.dataIn.message) this.toast(this.dataIn.message, 3000, 130);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    const land = this.token.L.land;
    this.token.animate(dt, this.walking ? (land ? 'walk' : 'swim') : land ? 'idle' : 'swim', this.walking ? 0.8 : 0.2);
    if (this.walking && performance.now() > this.walkSfx) {
      this.walkSfx = performance.now() + 300;
      audio.sfx(land ? 'step' : 'swim');
    }
    for (const v of this.overlayViews) v.animate(dt, v.L.land ? 'idle' : 'swim', 0.25);
  }

  // ---------------------------------------------------------------- Orte

  private nodeById(id: string) {
    return this.era.nodes.find((n) => n.id === id)!;
  }

  /** Offen und nicht mehr in der Aufdeck-Animation. */
  private isOpen(id: string) {
    return game.nodeOpen(this.era, id) && !this.pending.has(id);
  }

  /** Welche Nachbarn erst durch diesen Ort zugänglich wurden. */
  private newlyOpened(id: string) {
    return neighbors(this.era, id).filter((nb) => {
      const n = this.nodeById(nb);
      if (n.start || game.isCompleted(nb)) return false;
      return !neighbors(this.era, nb).some((m) => m !== id && game.isCompleted(m));
    });
  }

  private makeNode(n: NodeDef) {
    const c = this.add.container(n.x, n.y).setDepth(5);
    const glow = this.add.image(0, 0, 'glow').setScale(1.1).setTint(0xe0b070).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.add.graphics();
    const label = title(this, 0, 38, '', 17).setOrigin(0.5, 0);
    c.add([glow, g, label]);
    c.setSize(80, 80);
    c.setInteractive(new Phaser.Geom.Circle(40, 40, 36), Phaser.Geom.Circle.Contains);
    if (c.input) c.input.cursor = 'pointer';
    c.on('pointerdown', () => !this.overlay && this.clickNode(n.id));
    this.nodes.push({ n, c, g, glow, label });
  }

  private refreshNodes() {
    for (const v of this.nodes) {
      const { n, g, c, glow } = v;
      const open = this.isOpen(n.id);
      const done = game.isCompleted(n.id);
      const r = n.boss ? 30 : 25;
      g.clear();
      g.fillStyle(0x000000, 0.45);
      g.fillCircle(2, 5, r + 5);
      g.fillStyle(open ? 0x1c1916 : 0x0d0c0b, 1);
      g.fillCircle(0, 0, r + 3);
      g.lineStyle(open ? 3 : 2, done ? 0xc8913c : open ? (n.boss ? 0xa8392c : 0xe6dcc4) : 0x4a4238, open ? 0.9 : 0.6);
      g.strokeCircle(0, 0, r + 3);
      g.lineStyle(1, 0xffffff, 0.06);
      g.strokeCircle(0, 0, r - 3);
      v.icon?.destroy();
      let icon: Phaser.GameObjects.GameObject;
      if (!open) icon = title(this, 0, 1, '?', 28, '#6e6458').setOrigin(0.5);
      else if (done) icon = this.add.image(0, 0, 'ic_claw').setScale(0.62).setTint(0xc8913c);
      else if (n.boss) icon = this.add.image(0, 0, 'ic_skull').setScale(0.7).setTint(0xc8473a);
      else icon = this.add.image(0, 0, 'ic_footprint').setScale(0.55).setTint(0xe6dcc4);
      c.add(icon);
      v.icon = icon;
      v.label.setText(open ? n.name : '???').setColor(open ? UI.bone : '#6e6458');
      this.tweens.killTweensOf(glow);
      glow.setAlpha(0);
      if (open && !done) this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.42 }, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
    }
  }

  private drawPaths() {
    const g = this.paths;
    g.clear();
    for (const [a, b] of this.era.edges) {
      const na = this.nodeById(a), nb = this.nodeById(b);
      const oa = this.isOpen(a), ob = this.isOpen(b);
      const len = Math.hypot(nb.x - na.x, nb.y - na.y);
      const n = Math.floor(len / 18);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = na.x + (nb.x - na.x) * t, y = na.y + (nb.y - na.y) * t;
        // zum Unbekannten hin verblasst der Weg
        let alpha = 0.1;
        if (oa && ob) alpha = 0.75;
        else if (oa) alpha = 0.6 * (1 - t) + 0.05;
        else if (ob) alpha = 0.6 * t + 0.05;
        g.fillStyle(0x000000, alpha * 0.5);
        g.fillCircle(x + 1, y + 2, 4.5);
        g.fillStyle(0xd8c8a8, alpha);
        g.fillCircle(x, y, 3.6);
      }
    }
  }

  /** Nebel über allem, was man noch nicht kennt. */
  private drawFog() {
    let t = this.textures.exists(FOG_KEY) ? (this.textures.get(FOG_KEY) as Phaser.Textures.CanvasTexture) : null;
    if (!t) t = this.textures.createCanvas(FOG_KEY, W, H)!;
    const ctx = t.context;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(3,4,5,0.86)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    for (const n of this.era.nodes) {
      const open = this.isOpen(n.id);
      const near = !open && neighbors(this.era, n.id).some((id) => this.isOpen(id));
      if (!open && !near) continue;
      const r = open ? 200 : 95;
      const gr = ctx.createRadialGradient(n.x, n.y, r * 0.2, n.x, n.y, r);
      gr.addColorStop(0, `rgba(0,0,0,${open ? 1 : 0.5})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    t.refresh();
    this.fog.setTexture(FOG_KEY);
  }

  /** Die Figur steht (bzw. schwebt) über dem Ortspunkt. */
  private placeToken(x: number, y: number) {
    const v = this.token;
    const off = v.L.land ? -v.L.footY * TOKEN_SCALE - 22 : -46;
    v.setPosition(x, y + off);
    this.tokenShadow.setPosition(x, y - 20);
  }

  private updateInfo() {
    const n = this.nodeById(this.cur);
    const open = this.isOpen(n.id);
    const done = game.isCompleted(n.id);
    this.info.name.setText(open ? n.name : '???');
    this.info.desc.setText(open ? n.desc : 'Unbekanntes Gebiet. Niemand weiß, was dort lebt.');
    this.info.status.setText(done ? 'Überlebt' : !open ? 'Unerreichbar' : n.boss ? 'Ein Revier' : 'Unerforscht');
    this.info.status.setColor(done ? UI.ochre : !open ? UI.boneDim : n.boss ? '#c8473a' : UI.bone);
    this.info.enter.setDisabled(!open);
  }

  // ---------------------------------------------------------------- Wandern

  /** Weg zwischen zwei Orten über bereits offene Orte (Breitensuche). */
  private route(from: string, to: string): string[] | null {
    const prev = new Map<string, string>();
    const q = [from];
    const seen = new Set([from]);
    while (q.length) {
      const id = q.shift()!;
      if (id === to) break;
      for (const nb of neighbors(this.era, id)) {
        if (seen.has(nb) || !this.isOpen(nb)) continue;
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
      this.toast('Der Weg dorthin ist noch unbekannt.');
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
    if (!this.isOpen(best)) {
      audio.sfx('fail');
      this.toast('Dort ist noch alles im Dunkeln.');
      return;
    }
    this.walk([best]);
  }

  private walk(path: string[]) {
    if (!path.length) return;
    this.walking = true;
    const id = path[0];
    const n = this.nodeById(id);
    const from = { x: this.tokenShadow.x, y: this.tokenShadow.y + 20 };
    this.token.setFacing(n.x >= from.x ? 1 : -1);
    const dist = Math.hypot(n.x - from.x, n.y - from.y);
    const p = { t: 0 };
    this.tweens.add({
      targets: p,
      t: 1,
      duration: Math.max(260, dist * 3.4),
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
    if (!this.isOpen(this.cur)) {
      audio.sfx('fail');
      return;
    }
    audio.sfx('portal');
    game.setMapPos(this.era.id, this.cur);
    fadeTo(this, 'Level', { era: this.era.id, node: this.cur }, 700);
  }

  private back() {
    if (this.walking) return;
    audio.sfx('back');
    fadeTo(this, 'EraSelect');
  }

  // ---------------------------------------------------------------- Rückkehr

  private celebrate(id: string) {
    const n = this.nodeById(id);
    const dust = this.add.particles(n.x, n.y, 'p_dot', {
      speed: { min: 30, max: 140 }, lifespan: 1200, scale: { start: 0.6, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: [0xe0b070, 0xd8c8a8], emitting: false,
    }).setDepth(30);
    dust.explode(26);
    if (!this.pending.size) return;
    const ids = [...this.pending];
    this.time.delayedCall(900, () => {
      for (const nb of ids) {
        const v = this.nodes.find((x) => x.n.id === nb)!;
        this.tweens.add({ targets: v.c, scale: 0.2, duration: 220, ease: 'Sine.in', yoyo: true });
      }
      this.time.delayedCall(220, () => {
        this.pending.clear();
        this.refreshNodes();
        this.drawPaths();
        this.drawFog();
        audio.sfx('unlock');
        for (const nb of ids) {
          const v = this.nodes.find((x) => x.n.id === nb)!;
          const fx = this.add.particles(v.n.x, v.n.y, 'p_dot', {
            speed: { min: 20, max: 90 }, lifespan: 900, scale: { start: 0.5, end: 0 }, tint: 0xe6dcc4, emitting: false,
          }).setDepth(30);
          fx.explode(14);
        }
        this.toast(ids.length > 1 ? 'Neue Wege tun sich auf.' : 'Ein neuer Weg tut sich auf.');
      });
    });
  }

  private toast(msg: string, ms = 1600, y = 128) {
    const t = title(this, W / 2, y, msg, 24, UI.bone).setOrigin(0.5).setDepth(DEPTH.text + 5);
    t.setWordWrapWidth(900).setAlign('center');
    this.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, y: y - 16, delay: ms, duration: 600, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- Dein Tier

  /** Das eigene Tier und seine Ahnenreihe – nur Bilder, keine Werte. */
  private showCreature() {
    if (this.walking || this.overlay) return;
    audio.sfx('select');
    const c = this.add.container(0, 0).setDepth(DEPTH.text + 20);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0).setInteractive().on('pointerdown', () => this.closeOverlay()));
    c.add(panel(this, 120, 70, W - 240, H - 140, 0.94));
    c.add(title(this, W / 2, 110, 'Dein Tier', 40).setOrigin(0.5));

    const m = game.morph({ belly: 1 });
    const gy = 360;
    c.add(this.add.image(W / 2, gy + 6, 'pedestal').setScale(1.4, 0.9));
    const v = new CreatureView(this, W / 2, 0, m, 2.2);
    v.setY(v.L.land ? gy - v.L.footY * 2.2 : gy - 70);
    c.add(v);
    this.overlayViews.push(v);
    c.add(title(this, W / 2, gy + 40, CLASSES[m.cls].name, 26).setOrigin(0.5, 0));
    c.add(text(this, W / 2, gy + 78, `Generation ${game.data.generations}`, 18, UI.boneDim).setOrigin(0.5, 0));

    // Ahnenreihe: einige Vorfahren, vom ältesten zum jüngsten
    const hist = game.data.history;
    const y2 = 560;
    if (!hist.length) {
      c.add(text(this, W / 2, y2, 'Noch keine Ahnen – deine Reise beginnt gerade erst.', 19, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5));
    } else {
      c.add(text(this, W / 2, y2 - 78, 'Deine Ahnen', 18, UI.boneDim).setOrigin(0.5));
      const k = Math.min(7, hist.length);
      const picks: number[] = [];
      for (let i = 0; i < k; i++) picks.push(k === 1 ? hist.length - 1 : Math.round((i * (hist.length - 1)) / (k - 1)));
      const gap = Math.min(150, (W - 360) / k);
      picks.forEach((hi, i) => {
        const a = hist[hi];
        const x = W / 2 + (i - (k - 1) / 2) * gap;
        const av = new CreatureView(this, x, 0, game.morph({ cls: a.cls, traits: a.traits, fierce: 0 }), 0.75);
        av.setY(av.L.land ? y2 + 30 - av.L.footY * 0.75 : y2 + 4);
        av.setAlpha(0.45 + 0.55 * ((i + 1) / k));
        c.add(av);
        this.overlayViews.push(av);
      });
    }
    const back = new Button(this, W - 230, 116, 'Zurück', { w: 150, h: 46, size: 18, icon: 'ic_back', onClick: () => this.closeOverlay() });
    c.add(back);
    this.overlay = c;
    this.nav = new MenuNav(this, [back]);
  }

  private closeOverlay() {
    if (!this.overlay) return;
    this.overlay.destroy();
    this.overlay = undefined;
    this.overlayViews = [];
    if (this.nav) this.nav.enabled = false;
    this.nav = undefined;
  }
}
