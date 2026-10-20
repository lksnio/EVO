import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { PALEO } from '../data/paleo';
import { linkKey, placesOf, type PlaceDef } from '../data/world';
import { game } from '../state/GameState';
import { worldYears } from '../sim/life';
import { MAP_BOX, mapPos } from '../art/mapArt';
import { FogMap, mapFrame, MAP_LABELS, routePoints } from '../art/paleoArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { openKeys } from '../ui/keysPanel';
import { capture, keyLabel, matches, onKeysChanged } from '../state/keymap';
import { Overview } from '../ui/overview';

/** Halbmesser des Punktes eines Ortes (die Karte ist weit herausgezoomt: alles ist klein) */
const DOT = 6.5;
/** Das eigene Tier auf der Karte: klein, knapp über dem Punkt */
const FISH_SCALE = 0.32;
const FISH_LIFT = 17;
/** so lange wartet die Karte auf eine eigene Wahl, bevor das Tier von selbst in den neuen Ort schwimmt (ms) */
const AUTO_GO = 3400;

type Edge = { side: 'left' | 'right'; frac: number };

interface NodeVis {
  def: PlaceDef;
  x: number;
  y: number;
  c: Phaser.GameObjects.Container;
  dot: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

/**
 * Die Karte des Zeitalters. Wer über den Rand eines Ortes hinausschwimmt, kommt hierher: Der Weg in den Nachbarort erscheint
 * (und der Ort selbst, wenn er neu ist), dann schwimmt das Tier hin – es sei denn, man wählt ein anderes Ziel: jeden
 * bekannten Ort, zu dem bekannte Wege führen, auch zurück. Orte und Wege, die man nicht kennt, sind gar nicht zu sehen.
 * Die Orte sind schlichte Punkte mit ihrem Namen.
 */
export class MapScene extends Phaser.Scene {
  private ep!: EpochDef;
  private places: PlaceDef[] = [];
  private nodes = new Map<string, NodeVis>();
  /** der Ort, den man gerade verlassen hat */
  private cur!: PlaceDef;
  private focus!: PlaceDef;
  private fish!: CreatureView;
  private moving = false;
  private overview?: Overview;
  private rest?: Phaser.GameObjects.Container;
  private restNav?: MenuNav;
  /** die Seite „Steuerung“ (über der Rast) */
  private keys?: Phaser.GameObjects.Container;
  private glow?: Phaser.GameObjects.Image;
  private leaving = false;
  private toId?: string;
  private edge?: Edge;
  /** der Nachbarort bzw. der Weg dorthin ist neu: Er erscheint erst */
  private newPlace = false;
  private newLink = false;
  private fog!: FogMap;
  private trails = new Map<string, Phaser.GameObjects.Graphics>();
  /** bekannte Wege (linkKey) */
  private links = new Set<string>();
  /** wohin man über bekannte Wege kommt (auch zurück) – erst nach dem Erscheinen des neuen Ortes */
  private reach: PlaceDef[] = [];
  private auto?: Phaser.Time.TimerEvent;
  private nameT!: Phaser.GameObjects.Text;
  private hintT!: Phaser.GameObjects.Text;

  constructor() {
    super('Map');
  }

  init(d: { epoch?: number; from?: string; to?: string; edge?: Edge; newPlace?: boolean; newLink?: boolean }) {
    this.ep = EPOCHS[d?.epoch ?? game.epochIndex];
    this.places = placesOf(this.ep);
    this.cur = this.places.find((p) => p.id === (d?.from ?? game.prog.place)) ?? this.places[0];
    this.toId = d?.to;
    this.edge = d?.edge;
    this.newPlace = !!d?.newPlace;
    this.newLink = !!d?.newLink;
    this.nodes = new Map();
    this.trails = new Map();
    this.reach = [];
    this.auto = undefined;
    this.moving = false;
    this.overview = undefined;
    this.rest = undefined;
    this.restNav = undefined;
    this.leaving = false;
  }

  create() {
    fadeIn(this, 900);
    audio.music(this.ep.music);
    audio.sea(0.12, 1.5);
    this.events.once('shutdown', () => audio.sea(0, 0.8));
    const prog = game.prog;
    const known = new Set<string>(prog.known);
    known.add(this.cur.id);
    this.links = new Set(prog.links ?? []);
    const target = this.places.find((p) => p.id === this.toId);
    this.focus = target ?? this.cur;
    const fresh = (id: string) => this.newPlace && id === this.toId;
    const freshKey = target && this.newLink ? linkKey(this.cur.id, target.id) : '';

    const pos = (p: PlaceDef) => mapPos(p.x, p.y);
    // Die Urzeit-Erde: dunkel, nur um bekannte Orte und geschwommene Wege hell
    const mine = this.places.map((p) => ({ id: p.id, kind: p.kind, ...pos(p) }));
    this.fog = new FogMap(this, this.ep.id, mine, [...known].filter((id) => !fresh(id)));
    this.add.image(0, 0, this.fog.key).setOrigin(0);
    const mid = Math.round((this.ep.from + this.ep.to) / 2e6);
    this.add.image(0, 0, mapFrame(this, this.ep.id, `ERDE VOR ${mid} MIO. JAHREN`)).setOrigin(0).setDepth(1);

    // Wege: Blasenspuren – nur die, die man selbst geschwommen ist (der neue erscheint gleich)
    for (const k of this.links) {
      const [a, b] = k.split('|');
      if (k === freshKey || !known.has(a) || !known.has(b)) continue;
      const pts = this.route(a, b);
      this.trailTo(k, pts, 1);
      this.fog.showRoute(k, pts, 1);
    }
    this.fog.refresh();

    // Orte: schlichte Punkte mit Namen
    const spots = this.labelSpots(pos);
    for (const p of this.places) {
      if (!known.has(p.id)) continue;
      const { x, y } = pos(p);
      const c = this.add.container(x, y).setDepth(5);
      const dot = this.add.graphics();
      const sp = spots.get(p.id)!;
      const label = text(this, sp.x, sp.y, p.name, 13, prog.seen.includes(p.id) ? UI.bone : UI.boneDim, { fontStyle: '700', stroke: '#050403', strokeThickness: 3 })
        .setOrigin(sp.ox, 0.5);
      c.add([dot, label]);
      c.setVisible(!fresh(p.id));
      // antippen bzw. mit der Maus: wählen und losschwimmen
      const hit = this.add.zone(0, 0, 34, 34).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.choose(p));
      hit.on('pointerdown', () => {
        this.choose(p);
        if (this.focus === p) this.go(p);
      });
      c.add(hit);
      this.nodes.set(p.id, { def: p, x, y, c, dot, label });
    }

    // Das eigene Tier – über dem Ort, den es gerade verlassen hat
    const here = this.nodes.get(this.cur.id)!;
    const m = { ...game.morph(), belly: 1 };
    this.fish = new CreatureView(this, here.x, here.y - FISH_LIFT, m, FISH_SCALE).setDepth(10);
    this.fish.setFacing(target ? (pos(target).x >= here.x ? 1 : -1) : here.x > W / 2 ? -1 : 1);

    // Blasen, die aufsteigen
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W }, y: H + 10, lifespan: 9000, frequency: 260, speedY: { min: -40, max: -18 }, speedX: { min: -8, max: 8 },
      scale: { min: 0.25, max: 0.7 }, alpha: { start: 0.35, end: 0 },
    }).setDepth(3);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.6).setDepth(8);

    // Überschrift; unten der gewählte Ort und leise, wie man wählt
    title(this, 86, 40, this.ep.name.toUpperCase(), 30, UI.ochre).setOrigin(0, 0.5).setLetterSpacing(3).setDepth(9);
    this.nameT = title(this, W / 2, H - 58, '', 24, UI.bone).setOrigin(0.5).setDepth(12);
    this.hintT = text(this, W / 2, H - 28, '', 14, UI.boneDim).setOrigin(0.5).setDepth(12).setAlpha(0);
    this.showFocus();

    // Knöpfe oben rechts (wie im Level)
    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.toggleRest() }).setAlpha(0.8).setDepth(20);
    this.glow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0).setDepth(19);
    const ovB = new Button(this, W - 156, 38, keyLabel('overview'), { w: 50, h: 50, size: keyLabel('overview').length > 2 ? 14 : 22, onClick: () => this.toggleOverview() }).setAlpha(0.8).setDepth(20);
    const offKeys = onKeysChanged(() => ovB.setLabel(keyLabel('overview')));
    this.events.once('shutdown', offKeys);
    soundButton(this, W - 40, 38, 50).setAlpha(0.8).setDepth(20);
    this.updateGlow();

    const kb = this.input.keyboard!;
    // wählen mit den Pfeiltasten (oder den Schwimmtasten der Belegung), losschwimmen mit Eingabe, Leertaste, Beißen oder Ansprechen
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.keys || capture.on) return;
      const k = e.keyCode;
      if (k === 13 || k === 32 || matches('bite', e) || matches('talk', e)) {
        if (!this.blocked()) this.go(this.focus);
      } else if (k === 37 || matches('left', e)) this.pick(-1, 0);
      else if (k === 39 || matches('right', e)) this.pick(1, 0);
      else if (k === 38 || matches('up', e)) this.pick(0, -1);
      else if (k === 40 || matches('down', e)) this.pick(0, 1);
      else if (matches('overview', e)) this.toggleOverview();
      else if (matches('pause', e)) this.toggleRest();
    });
    kb.on('keydown-ESC', () => !capture.on && !this.keys && (this.overview ? this.toggleOverview() : this.toggleRest()));
    this.time.delayedCall(700, () => this.reveal());
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.fish.animate(dt, 'swim', this.moving ? 0.8 : 0.2);
    this.overview?.update(dt);
    if (!this.moving) {
      const n = this.nodes.get(this.cur.id)!;
      this.fish.setPosition(n.x, n.y - FISH_LIFT + Math.sin(this.time.now / 700) * 1.5);
    }
    for (const n of this.nodes.values()) this.drawDot(n);
  }

  // ---------------------------------------------------------------- Zeichnen

  /** Ein Ort: ein dicker Punkt. Hier warst du gerade (ocker); das gewählte Ziel bekommt einen leise pulsierenden Ring. */
  private drawDot(n: NodeVis) {
    const g = n.dot;
    const here = n.def.id === this.cur.id;
    const focus = n.def.id === this.focus.id;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 380);
    g.clear();
    g.fillStyle(0x040706, 0.8);
    g.fillCircle(0, 0, DOT + 2.2);
    g.fillStyle(here ? 0xe0a848 : focus ? 0xf4e4bc : game.prog.seen.includes(n.def.id) ? 0xcdbf9a : 0x9c9078, 1);
    g.fillCircle(0, 0, DOT);
    if (focus && this.reach.length > 1) {
      g.lineStyle(1.4, 0xf0d9a6, 0.3 + 0.4 * pulse);
      g.strokeCircle(0, 0, DOT + 4 + 2 * pulse);
    }
  }

  /** Unten: der Name des gewählten Ortes – und, sobald man wählen kann, leise wie. */
  private showFocus() {
    this.nameT.setText(this.focus.name);
    for (const n of this.nodes.values()) n.label.setColor(n.def === this.focus ? '#f4e4bc' : game.prog.seen.includes(n.def.id) ? UI.bone : UI.boneDim);
  }

  /** Wohin die Namen kommen: meist unter den Punkt, sonst daneben, wenn dort ein anderer Ort im Weg wäre. */
  private labelSpots(pos: (p: PlaceDef) => { x: number; y: number }) {
    type Box = [number, number, number, number];
    const hit = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const rings = new Map(this.places.map((p) => [p.id, pos(p)]));
    // Die Namen von Land und Meeren bleiben nach Möglichkeit frei (sind aber nur Hintergrund)
    const geoBoxes: Box[] = [];
    const geo = PALEO[this.ep.id];
    for (const c of geo.continents) {
      if (!MAP_LABELS.has(c.name)) continue;
      const q = mapPos(c.label[0], c.label[1]), w = c.name.length * 12;
      geoBoxes.push([q.x - w / 2, q.y - 8, q.x + w / 2, q.y + 8]);
    }
    for (const o of geo.oceans) {
      const q = mapPos(o.x, o.y), w = o.name.length * 7.4;
      geoBoxes.push([q.x - w / 2, q.y - 8, q.x + w / 2, q.y + 8]);
    }
    const placed: Box[] = [];
    const out = new Map<string, { x: number; y: number; ox: number }>();
    for (const p of this.places) {
      const { x, y } = rings.get(p.id)!;
      const w = p.name.length * 6.8 + 8, r = DOT;
      const cands = [
        { x: 0, y: r + 9, ox: 0.5, box: [x - w / 2, y + r + 2, x + w / 2, y + r + 17] as Box },
        { x: r + 6, y: 0, ox: 0, box: [x + r + 3, y - 8, x + r + 9 + w, y + 8] as Box },
        { x: -r - 6, y: 0, ox: 1, box: [x - r - 9 - w, y - 8, x - r - 3, y + 8] as Box },
        { x: 0, y: -r - 9, ox: 0.5, box: [x - w / 2, y - r - 17, x + w / 2, y - r - 2] as Box },
      ];
      // über dem eigenen Ort schwimmt das Tier: dort kommt kein Name hin
      if (p.id === this.cur?.id) cands.pop();
      const free = (c: (typeof cands)[number]) =>
        !placed.some((b) => hit(b, c.box)) &&
        ![...rings].some(([id, q]) => id !== p.id && hit([q.x - DOT - 2, q.y - DOT - 2, q.x + DOT + 2, q.y + DOT + 2], c.box)) &&
        c.box[0] > MAP_BOX.x && c.box[2] < MAP_BOX.x + MAP_BOX.w && c.box[3] < MAP_BOX.y + MAP_BOX.h;
      const c = cands.find((k) => free(k) && !geoBoxes.some((b) => hit(b, k.box))) ?? cands.find(free) ?? cands[0];
      placed.push(c.box);
      out.set(p.id, c);
    }
    return out;
  }

  /** Der Schwimmweg von Ort a nach Ort b in Bildpunkten (immer im Wasser). */
  private route(a: string, b: string) {
    const [lo, hi] = [a, b].sort();
    const pa = this.places.find((p) => p.id === lo)!, pb = this.places.find((p) => p.id === hi)!;
    const pts = routePoints(this.ep.id, [pa.x, pa.y], [pb.x, pb.y]);
    return a === lo ? pts : pts.slice().reverse();
  }

  /** Eine Spur aus Blasen entlang des Weges (bis zum Anteil upto). */
  private trailTo(key: string, pts: { x: number; y: number }[], upto: number) {
    let g = this.trails.get(key);
    if (!g) {
      g = this.add.graphics().setDepth(2);
      this.trails.set(key, g);
    }
    g.clear();
    const n = Math.ceil(pts.length / 2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (t > upto) break;
      const pt = pts[Math.min(pts.length - 1, i * 2)];
      g.fillStyle(0xbfeee4, 0.12 + 0.3 * Math.sin(t * Math.PI));
      g.fillCircle(pt.x, pt.y, 2.2 + 0.9 * Math.sin(t * 9));
    }
  }

  // ---------------------------------------------------------------- Erscheinen, Wählen, Schwimmen

  /** Der neue Weg zeichnet sich ab (die Karte hellt sich entlang der Strecke auf), dann erscheint der neue Ort. */
  private reveal() {
    const to = this.places.find((p) => p.id === this.toId);
    if (!to) return this.arm();
    const n = this.nodes.get(to.id);
    const showPlace = () => {
      if (!this.newPlace || !n) return this.arm();
      n.c.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: n.c, alpha: { from: 0, to: 1 }, duration: 900 });
      const k = { d: 0 };
      this.tweens.add({
        targets: k, d: 1, duration: 1100, ease: 'Sine.out',
        onUpdate: () => {
          this.fog.reveal(to.id, k.d);
          this.fog.refresh();
        },
        onComplete: () => this.arm(),
      });
      audio.sfx('shell');
      const sp = this.add.particles(n.x, n.y, 'p_dot', {
        emitting: false, lifespan: 1200, speed: { min: 30, max: 120 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0xffe8b0, 0xe0a848, 0xfff4dc], blendMode: 'ADD',
      }).setDepth(7);
      sp.explode(30);
    };
    if (!this.newLink) return showPlace();
    const key = linkKey(this.cur.id, to.id);
    const pts = this.route(this.cur.id, to.id);
    const k = { p: 0 };
    this.tweens.add({
      targets: k, p: 1, duration: Math.min(1500, 500 + pts.length * 9), ease: 'Sine.inOut',
      onUpdate: () => {
        this.trailTo(key, pts, k.p);
        this.fog.showRoute(key, pts, k.p);
        this.fog.refresh();
      },
      onComplete: showPlace,
    });
  }

  /** Jetzt kann gewählt werden: alle bekannten Orte, zu denen bekannte Wege führen. Ohne eigene Wahl geht es bald von selbst los. */
  private arm() {
    const ids = new Set<string>([this.cur.id]);
    const q = [this.cur.id];
    while (q.length) {
      const x = q.shift()!;
      for (const y of this.neighbors(x)) if (!ids.has(y) && this.nodes.has(y)) {
        ids.add(y);
        q.push(y);
      }
    }
    this.reach = this.places.filter((p) => ids.has(p.id));
    if (this.reach.length > 1) {
      this.hintT.setText('Anderes Ziel: Pfeiltasten oder antippen  ·  Eingabe: losschwimmen');
      this.tweens.add({ targets: this.hintT, alpha: 0.7, duration: 600 });
    }
    // man kam über den Rand: Ohne eigene Wahl schwimmt das Tier bald in den Nachbarort (sind Übersicht oder Rast offen, danach)
    const auto = () => {
      if (this.blocked()) this.auto = this.time.delayedCall(500, auto);
      else this.go(this.focus);
    };
    if (this.toId) this.auto = this.time.delayedCall(AUTO_GO, auto);
  }

  private neighbors(id: string) {
    const out: string[] = [];
    for (const k of this.links) {
      const [a, b] = k.split('|');
      if (a === id) out.push(b);
      else if (b === id) out.push(a);
    }
    return out;
  }

  private blocked() {
    return this.moving || this.leaving || !!this.overview || !!this.rest;
  }

  /** Ein Ziel wählen (nur erreichbare); die eigene Wahl hält das Tier zurück, bis man losschwimmt. */
  private choose(p: PlaceDef) {
    if (this.blocked() || !this.reach.includes(p) || p === this.focus) return;
    this.auto?.remove();
    this.auto = undefined;
    this.focus = p;
    this.showFocus();
    audio.sfx('click');
  }

  /** Mit den Pfeiltasten: der nächste erreichbare Ort in dieser Richtung (sonst der nächste der Reihe nach). */
  private pick(dx: number, dy: number) {
    if (this.blocked() || this.reach.length < 2) return;
    const f = this.nodes.get(this.focus.id)!;
    let best: PlaceDef | undefined;
    let bestScore = Infinity;
    for (const p of this.reach) {
      if (p === this.focus) continue;
      const n = this.nodes.get(p.id)!;
      const vx = n.x - f.x, vy = n.y - f.y, d = Math.hypot(vx, vy) || 1;
      const cos = (vx * dx + vy * dy) / d;
      if (cos < 0.35) continue;
      const score = d * (2 - cos);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) {
      const order = this.reach.slice().sort((a, b) => (dx ? a.x - b.x : a.y - b.y));
      const i = order.indexOf(this.focus);
      best = order[(i + (dx + dy > 0 ? 1 : -1) + order.length) % order.length];
    }
    this.choose(best);
  }

  /** Der kürzeste bekannte Weg von a nach b (Orte der Reihe nach). */
  private path(a: string, b: string): string[] {
    const prev = new Map<string, string>([[a, a]]);
    const q = [a];
    while (q.length && !prev.has(b)) {
      const x = q.shift()!;
      for (const y of this.neighbors(x)) if (!prev.has(y)) {
        prev.set(y, x);
        q.push(y);
      }
    }
    if (!prev.has(b)) return [a];
    const out = [b];
    for (let x = b; x !== a; x = prev.get(x)!) out.unshift(prev.get(x)!);
    return out;
  }

  /** Losschwimmen: über die bekannten Wege zum Ziel (oder zurück in den Ort, aus dem man kam). */
  private go(dest: PlaceDef) {
    if (this.blocked() || !this.reach.includes(dest)) return;
    this.auto?.remove();
    this.auto = undefined;
    this.tweens.add({ targets: this.hintT, alpha: 0, duration: 300 });
    const path = this.path(this.cur.id, dest.id);
    const edge = this.arrival(path);
    if (path.length < 2) {
      this.enter(dest, edge, 1);
      return;
    }
    this.moving = true;
    audio.sfx('travel');
    const hop = (i: number) => {
      if (i >= path.length - 1) {
        // angekommen: kurz über dem Punkt schweben, dann eintauchen (das Tier bleibt dort, bis die Karte ausblendet)
        audio.sfx('click');
        this.time.delayedCall(450, () => this.enter(dest, edge, path.length - 1));
        return;
      }
      this.swim(path[i], path[i + 1], () => hop(i + 1));
    };
    hop(0);
  }

  /**
   * Wo man im Zielort ankommt: am Gegenrand dessen, über den man den letzten Ort verlassen hat. Wer in den Ort zurückkehrt,
   * aus dem er kam, taucht am selben Rand wieder auf.
   */
  private arrival(path: string[]): Edge {
    const frac = this.edge?.frac ?? 0.5;
    if (path.length < 2) return { side: this.edge?.side === 'left' ? 'right' : 'left', frac };
    const a = path[path.length - 2], b = path[path.length - 1];
    if (a === this.cur.id && b === this.toId && this.edge) return this.edge;
    const pa = this.places.find((p) => p.id === a)!, pb = this.places.find((p) => p.id === b)!;
    return { side: pb.x >= pa.x ? 'right' : 'left', frac: 0.5 };
  }

  /** Das Tier schwimmt den Weg von a nach b entlang. */
  private swim(a: string, b: string, done: () => void) {
    const pts = this.route(a, b);
    const k = { t: 0 };
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let facing = pts[pts.length - 1].x >= pts[0].x ? 1 : -1;
    this.fish.setFacing(facing);
    this.tweens.add({
      targets: k,
      t: 1,
      duration: Math.max(1100, len * 6.5),
      ease: 'Sine.inOut',
      onUpdate: () => {
        const f = k.t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
        const x = pts[i].x + (pts[i + 1].x - pts[i].x) * u, y = pts[i].y + (pts[i + 1].y - pts[i].y) * u;
        // in Schwimmrichtung blicken (mit Trägheit, damit das Tier nicht flackert)
        const ahead = pts[Math.min(pts.length - 1, i + 6)], back = pts[Math.max(0, i - 6)];
        const dx = ahead.x - back.x;
        if (Math.abs(dx) > 14 && Math.sign(dx) !== facing) {
          facing = Math.sign(dx);
          this.fish.setFacing(facing);
        }
        // über dem Weg schwimmen, nur an den Orten über dem Punkt schweben
        const e = Math.min(1, Math.min(k.t, 1 - k.t) * 8);
        this.fish.setPosition(x, y - (FISH_LIFT * 0.4 + FISH_LIFT * 0.6 * (1 - e)));
      },
      onComplete: done,
    });
  }

  /** Den Zielort betreten. */
  private enter(dest: PlaceDef, edge: Edge, hops: number) {
    if (this.leaving) return;
    this.leaving = true;
    game.enterPlace(dest.id, edge, hops);
    audio.sfx('travel');
    fadeTo(this, 'Level', { epoch: game.epochIndex, place: dest.id }, 900);
  }

  // ---------------------------------------------------------------- Übersicht und Rast

  private updateGlow() {
    const g = this.glow;
    if (!g) return;
    this.tweens.killTweensOf(g);
    if (game.shells.length <= game.seenRows) return g.setAlpha(0);
    g.setAlpha(0.06);
    this.tweens.add({ targets: g, alpha: 0.22, yoyo: true, repeat: -1, duration: 1600, ease: 'Sine.inOut' });
  }

  private toggleOverview() {
    if (this.overview) {
      this.overview.destroy();
      this.overview = undefined;
      this.updateGlow();
      return;
    }
    if (this.rest || this.leaving) return;
    audio.sfx('select');
    this.overview = new Overview(this, { morph: game.morph(), placeName: this.cur.name, kin: game.prog.kin ?? game.run?.kin ?? 0 }, () => this.toggleOverview());
  }

  private toggleRest() {
    if (this.rest) {
      this.closeRest();
      return;
    }
    if (this.overview || this.leaving) return;
    audio.sfx('select');
    const c = this.add.container(0, 0).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.66).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 300, 150, 600, 420, 0.94));
    c.add(title(this, W / 2, 204, 'Rast', 46).setOrigin(0.5));
    let armed = false;
    const b1 = new Button(this, W / 2, 292, 'Weiter', { w: 320, icon: 'ic_play', color: UI.ochreN, onClick: () => this.closeRest() });
    const b2 = new Button(this, W / 2, 362, 'Steuerung', { w: 320, onClick: () => this.showControls() });
    const b3 = new Button(this, W / 2, 432, 'Aufgeben', {
      w: 320,
      icon: 'ic_skull',
      onClick: () => {
        if (!armed) {
          armed = true;
          b3.setLabel('Wirklich?').setColor(0x5a2420);
          return;
        }
        this.giveUp();
      },
    });
    c.add([b1, b2, b3]);
    c.add(text(this, W / 2, 492, 'Wer aufgibt, lässt seine Linie aussterben.', 17, UI.boneDim).setOrigin(0.5));
    this.rest = c;
    this.restNav = new MenuNav(this, [b1, b2, b3]);
  }

  private closeRest() {
    this.rest?.destroy();
    this.rest = undefined;
    if (this.restNav) this.restNav.enabled = false;
    this.restNav = undefined;
  }

  /** Die Seite "Steuerung" in der Rast: Tasten ansehen und neu belegen. */
  private showControls() {
    if (!this.rest || this.keys) return;
    if (this.restNav) this.restNav.enabled = false;
    this.keys = openKeys(this, 55, () => {
      this.keys = undefined;
      if (this.restNav) this.restNav.enabled = true;
    });
  }

  private giveUp() {
    if (this.leaving) return;
    this.leaving = true;
    const ep = this.ep ?? EPOCHS[0];
    const years = worldYears(ep.from, ep.to);
    const frac = Math.max(0, Math.min(1, (ep.from - years) / (ep.from - ep.to)));
    const morph = game.morph();
    const leaf = game.extinct(frac, 'Aufgegeben');
    audio.music(null);
    this.closeRest();
    fadeTo(this, 'Tree', { mode: 'extinct', leaf, morph, epoch: this.ep ? EPOCHS.indexOf(this.ep) : 0, cause: 'Aufgegeben', years }, 1000);
  }
}
