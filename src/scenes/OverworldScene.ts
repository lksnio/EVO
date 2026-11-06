import Phaser from 'phaser';
import { W, H, UI, DEBUG } from '../config';
import { audio } from '../audio/Audio';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { SPECIES } from '../data/species';
import { linkKey, mapNeighbors, placeOf, placesOf, type PlaceDef } from '../data/world';
import { game } from '../state/GameState';
import { capture } from '../state/keymap';
import { CreatureView } from '../objects/CreatureView';
import { mapPos, MAP_RECT, overworldTexture } from '../art/overworldArt';
import { Button, fadeIn, fadeTo, text, title } from '../ui/ui';

// ---------------------------------------------------------------------------
// Die Weltkarte (Zeitalter mit EpochDef.overworld, zuerst das Perm): Wer einen Ort links oder rechts verlässt, landet hier
// und wählt, wohin es weitergeht – aber nur in einen Nachbarort (mapNeighbors). Die Tiefe liegt unter der Lagune und ist
// nur durch deren Schlucht zu erreichen; das Hochland betritt nur, wer Beine hat. Esc kehrt an denselben Rand zurück.
// ---------------------------------------------------------------------------

export interface OverworldData {
  epoch: number;
  /** der Ort, den man gerade verlassen hat */
  from: string;
  /** an welchem Rand */
  side: 'left' | 'right';
  /** Höhe beim Verlassen: 0 an der Oberfläche … 1 am Grund */
  frac: number;
}

type NodeState = 'here' | 'open' | 'locked' | 'far';

interface MapNode {
  place: PlaceDef;
  x: number;
  y: number;
  state: NodeState;
  /** warum man (noch) nicht hin kann */
  reason?: string;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

/** Ab wie viel Bodenkontakt (Merkmal limb) eine Linie als „mit Beinen“ gilt */
const LEGS = 0.5;

const STATE_RING: Record<NodeState, { fill: number; edge: number; alpha: number }> = {
  here: { fill: 0xc8913c, edge: 0xffe2a8, alpha: 1 },
  open: { fill: 0x1a1a14, edge: 0xe6dcc4, alpha: 1 },
  locked: { fill: 0x1a1210, edge: 0x7a5a4a, alpha: 0.85 },
  far: { fill: 0x141414, edge: 0x6a6252, alpha: 0.7 },
};

export class OverworldScene extends Phaser.Scene {
  private d!: OverworldData;
  private ep!: EpochDef;
  private from!: PlaceDef;
  private nodes: MapNode[] = [];
  private choices: MapNode[] = [];
  private focusIdx = 0;
  private walker?: CreatureView;
  private walkerScale = 1;
  private leaving = false;
  private t = 0;
  private info!: { name: Phaser.GameObjects.Text; blurb: Phaser.GameObjects.Text; tier: Phaser.GameObjects.Text; fauna: Phaser.GameObjects.Text };
  private go!: Button;
  private glow!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Overworld');
  }

  init(d: OverworldData) {
    this.d = d;
    this.ep = EPOCHS[d.epoch];
    this.from = placeOf(this.ep, d.from);
    this.nodes = [];
    this.choices = [];
    this.focusIdx = 0;
    this.walker = undefined;
    this.leaving = false;
    this.t = 0;
  }

  create() {
    fadeIn(this, 520);
    this.add.image(0, 0, overworldTexture(this, this.ep.id)).setOrigin(0);
    this.frame();
    title(this, W / 2, 30, this.ep.place.toUpperCase(), 30).setOrigin(0.5, 0);
    text(this, W / 2, 68, `${this.ep.name} · choose where your line goes next`, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5, 0);

    this.links();
    this.glow = this.add.graphics().setDepth(4);
    const prog = game.prog;
    const run = game.run;
    const legs = !run || run.cls !== 'fish' || (run.traits.limb ?? 0) >= LEGS;
    const neighbors = new Set(mapNeighbors(this.ep, this.from).map((p) => p.id));
    for (const place of placesOf(this.ep)) {
      const [x, y] = mapPos(place.map ?? [place.x, place.y]);
      let state: NodeState = place.id === this.from.id ? 'here' : neighbors.has(place.id) || (DEBUG && !place.below) ? 'open' : 'far';
      let reason: string | undefined;
      if (place.below && place.id !== this.from.id) reason = 'Reached only through the chasm in ' + placeOf(this.ep, place.below).name.replace(/^The /, 'the ') + '.';
      if (state === 'open' && place.needsLegs && !legs && !DEBUG) {
        state = 'locked';
        reason = 'Only animals with legs can live up here – your line still swims.';
      }
      if (DEBUG && place.below && place.id !== this.from.id) state = 'open';
      const ring = this.add.graphics().setDepth(5);
      const seen = prog.seen.includes(place.id);
      const label = text(this, x, y + 22, place.name.replace(/^The /, ''), 17, state === 'far' ? UI.boneDim : UI.bone, {
        stroke: '#050403', strokeThickness: 4,
      }).setOrigin(0.5, 0).setDepth(6);
      if (!seen && state !== 'here') label.setText(label.text + '  ·  new');
      const node: MapNode = { place, x, y, state, reason, ring, label };
      this.drawNode(node, false);
      this.nodes.push(node);
      // Maus: Darüberfahren wählt an, Klicken reist
      const hit = this.add.zone(x, y + 10, 150, 70).setInteractive({ useHandCursor: state === 'open' }).setDepth(7);
      hit.on('pointerover', () => this.hover(node));
      hit.on('pointerdown', () => (state === 'open' ? this.travel(node) : this.hover(node)));
    }
    // wählbar: erst die Nachbarn (von links nach rechts), dann – nur zum Ausprobieren (?debug) – alle übrigen
    this.choices = this.nodes.filter((n) => n.state === 'open' || n.state === 'locked').sort((a, b) => a.x - b.x || a.y - b.y);
    this.walk();
    this.panel();
    // Vorauswahl: der Nachbar in Richtung des Randes, an dem man hinausgeschwommen ist
    const ahead = this.choices.filter((n) => n.state === 'open').sort((a, b) => (this.d.side === 'right' ? b.x - a.x : a.x - b.x));
    const start = ahead.length ? this.choices.indexOf(ahead[ahead.length - 1]) : 0;
    this.focus(Math.max(0, start));

    const kb = this.input.keyboard!;
    const step = (d: number) => () => !capture.on && !this.leaving && this.step(d);
    for (const k of ['RIGHT', 'D', 'DOWN', 'S']) kb.on(`keydown-${k}`, step(1));
    for (const k of ['LEFT', 'A', 'UP', 'W']) kb.on(`keydown-${k}`, step(-1));
    const act = () => !capture.on && this.choices[this.focusIdx] && this.travel(this.choices[this.focusIdx]);
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-ESC', () => !capture.on && this.back());
  }

  /** Rahmen um das Kartenfeld: doppelte feine Linie in Ocker, kleine Rauten in den Ecken. */
  private frame() {
    const g = this.add.graphics().setDepth(2);
    const { x, y, w, h } = MAP_RECT;
    const pad = 18;
    g.lineStyle(1.5, 0xc8913c, 0.5);
    g.strokeRect(x - pad + 0.5, y - pad + 0.5, w + pad * 2, h + pad * 2);
    g.lineStyle(1, 0xc8913c, 0.2);
    g.strokeRect(x - pad + 6.5, y - pad + 6.5, w + pad * 2 - 12, h + pad * 2 - 12);
    for (const [cx, cy] of [[x - pad, y - pad], [x + w + pad, y - pad], [x - pad, y + h + pad], [x + w + pad, y + h + pad]]) {
      const rhomb = (r: number) => {
        g.beginPath();
        g.moveTo(cx, cy - r);
        g.lineTo(cx + r, cy);
        g.lineTo(cx, cy + r);
        g.lineTo(cx - r, cy);
        g.closePath();
        g.fillPath();
      };
      g.fillStyle(0x0d0b09, 1);
      rhomb(7);
      g.fillStyle(0xc8913c, 0.85);
      rhomb(5);
    }
  }

  /** Die Wege: bekannte hell, unbekannte als feine Punkte; der Weg in die Tiefe führt durch die Schlucht (gestrichelt, blau). */
  private links() {
    const g = this.add.graphics().setDepth(3);
    const known = new Set(game.prog.links ?? []);
    const done = new Set<string>();
    for (const a of placesOf(this.ep)) {
      for (const id of a.links) {
        const b = placeOf(this.ep, id);
        const k = linkKey(a.id, b.id);
        if (b.id === a.id || done.has(k)) continue;
        done.add(k);
        const [x0, y0] = mapPos(a.map ?? [a.x, a.y]);
        const [x1, y1] = mapPos(b.map ?? [b.x, b.y]);
        const chasm = a.below === b.id || b.below === a.id;
        // leicht gebogen, wie von Hand gezogen
        const mx = (x0 + x1) / 2 + (y1 - y0) * 0.12, my = (y0 + y1) / 2 - (x1 - x0) * 0.12;
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(x1, y1));
        const pts = curve.getSpacedPoints(Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / (chasm ? 12 : 9))));
        const lit = known.has(k) || a.id === this.from.id || b.id === this.from.id;
        pts.forEach((p, i) => {
          if (i === 0 || i === pts.length - 1) return;
          if (chasm) {
            if (i % 2) return;
            g.lineStyle(2, 0x6ab4d0, 0.55);
            const q = pts[i + 1] ?? p;
            g.lineBetween(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
          } else {
            g.fillStyle(0x050403, 0.7);
            g.fillCircle(p.x, p.y + 1, lit ? 3.4 : 2.6);
            g.fillStyle(lit ? 0xe6c88c : 0x9a8a6a, lit ? 0.9 : 0.5);
            g.fillCircle(p.x, p.y, lit ? 2.4 : 1.7);
          }
        });
        if (chasm) {
          const m = curve.getPoint(0.5);
          text(this, m.x + 10, m.y - 8, 'chasm', 13, '#8cc4d8', { fontStyle: 'italic', stroke: '#050403', strokeThickness: 3 }).setDepth(3).setAlpha(0.85);
        }
      }
    }
  }

  private drawNode(n: MapNode, focused: boolean) {
    const g = n.ring.clear();
    const s = STATE_RING[n.state];
    const r = n.state === 'here' ? 13 : n.place.boss ? 12 : 10;
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(n.x + 1, n.y + 3, r + 4);
    g.fillStyle(s.fill, s.alpha);
    g.fillCircle(n.x, n.y, r);
    g.lineStyle(focused ? 3 : 2, focused ? 0xffe2a8 : s.edge, s.alpha);
    g.strokeCircle(n.x, n.y, r);
    if (n.place.boss) {
      // ein Spitzenräuber lebt hier: ein Zahn
      g.fillStyle(n.state === 'far' ? 0x8a7a64 : 0xe6dcc4, 0.95);
      g.fillTriangle(n.x - 4, n.y - 5, n.x + 4, n.y - 5, n.x, n.y + 6);
    }
    if (n.state === 'locked') {
      g.lineStyle(2, 0xa4322a, 0.9);
      g.lineBetween(n.x - 6, n.y - 6, n.x + 6, n.y + 6);
    }
  }

  /** das eigene Tier am Ort, den man verlassen hat */
  private walk() {
    const here = this.nodes.find((n) => n.state === 'here');
    if (!here || !game.run) return;
    const v = new CreatureView(this, here.x, here.y - 30, game.morph({ belly: 1 }), 1).setDepth(8);
    v.setFacing(this.d.side === 'left' ? -1 : 1);
    v.animate(0, 'idle', 0);
    const b = v.getBounds();
    this.walkerScale = Math.min(1, 74 / Math.max(1, b.width), 34 / Math.max(1, b.height));
    v.setBaseScale(this.walkerScale);
    this.walker = v;
  }

  /** Die Auskunft über den angewählten Ort, darunter Reisen und Zurück. */
  private panel() {
    const y = MAP_RECT.y + MAP_RECT.h + 30;
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x0b0a08, 0.86);
    g.fillRect(40, y, W - 80, H - y - 14);
    g.lineStyle(1, 0xc8913c, 0.35);
    g.strokeRect(40.5, y + 0.5, W - 81, H - y - 15);
    this.info = {
      name: title(this, 64, y + 12, '', 24).setDepth(10),
      tier: text(this, 64, y + 48, '', 15, UI.ochre).setDepth(10),
      blurb: text(this, 64, y + 72, '', 16, UI.boneDim, { fontStyle: 'italic', wordWrap: { width: 560 } }).setDepth(10),
      fauna: text(this, 660, y + 16, '', 15, UI.bone, { wordWrap: { width: 300 }, lineSpacing: 3 }).setDepth(10),
    };
    this.go = new Button(this, W - 150, y + 36, 'Travel', { w: 190, h: 46, size: 20, color: UI.ochreN, sound: null, onClick: () => this.choices[this.focusIdx] && this.travel(this.choices[this.focusIdx]) }).setDepth(10);
    new Button(this, W - 150, y + 92, 'Back (Esc)', { w: 190, h: 40, size: 16, sound: null, onClick: () => this.back() }).setDepth(10);
  }

  private hover(n: MapNode) {
    const i = this.choices.indexOf(n);
    if (i >= 0) this.focus(i);
    else this.show(n);
  }

  private step(d: number) {
    if (!this.choices.length) return;
    audio.sfx('click');
    this.focus((this.focusIdx + d + this.choices.length) % this.choices.length);
  }

  private focus(i: number) {
    this.focusIdx = i;
    const n = this.choices[i];
    for (const m of this.nodes) this.drawNode(m, m === n);
    if (n) this.show(n);
    else this.show(this.nodes.find((m) => m.state === 'here')!);
    const off = !n || n.state !== 'open';
    this.go.setDisabled(off).setFocus(!off);
  }

  /** Name, Schwierigkeit, ein Satz und – wo man schon war – wer dort lebt. */
  private show(n: MapNode) {
    const { place } = n;
    const seen = game.prog.seen.includes(place.id);
    const tier = place.tier ?? 1;
    this.info.name.setText(place.name);
    const stars = '◆'.repeat(tier) + '◇'.repeat(3 - tier);
    this.info.tier.setText(`${stars}   ${['', 'Easy', 'Medium', 'Hard'][tier]}${n.state === 'here' ? '   ·   you are here' : seen ? '' : '   ·   unexplored'}`);
    this.info.blurb.setText([place.blurb ?? '', n.reason ?? ''].filter(Boolean).join('\n'));
    const boss = place.boss ? SPECIES[place.boss] : undefined;
    const names = (place.fauna ?? []).map(([id]) => SPECIES[id]?.name).filter(Boolean) as string[];
    const lines = seen || DEBUG
      ? ['Living here:', names.join(', ')]
      : ['Living here:', 'unknown – go and see'];
    if (boss) lines.push(seen || DEBUG ? `Ruled by ${boss.name}.` : 'Something big rules here.');
    this.info.fauna.setText(lines.join('\n'));
  }

  /** In den gewählten Ort: Das Tier zieht den Weg entlang, dann geht es dort am passenden Rand weiter. */
  private travel(n: MapNode) {
    if (this.leaving) return;
    if (n.state !== 'open') {
      audio.sfx('stone');
      this.cameras.main.shake(120, 0.002);
      return;
    }
    this.leaving = true;
    audio.sfx('travel');
    const from = this.from;
    const fx = (from.map ?? [from.x, from.y])[0], tx = (n.place.map ?? [n.place.x, n.place.y])[0];
    // Wer nach rechts (Osten) reist, kommt am linken Rand des neuen Ortes an – und umgekehrt
    const side: 'left' | 'right' = tx >= fx ? 'right' : 'left';
    const go = () => {
      game.discoverLink(from.id, n.place.id);
      game.enterPlace(n.place.id, { side, frac: this.d.frac });
      fadeTo(this, 'Level', { epoch: this.d.epoch, place: n.place.id }, 520);
    };
    if (!this.walker) return go();
    this.walker.setFacing(n.x >= this.walker.x ? 1 : -1);
    this.tweens.add({ targets: this.walker, x: n.x, y: n.y - 30, duration: 1100, ease: 'Sine.inOut', onComplete: go });
  }

  /** Nichts gewählt: zurück an denselben Rand des Ortes, den man verlassen hat. */
  private back() {
    if (this.leaving) return;
    this.leaving = true;
    audio.sfx('back');
    game.enterPlace(this.from.id, { side: this.d.side === 'right' ? 'left' : 'right', frac: this.d.frac });
    fadeTo(this, 'Level', { epoch: this.d.epoch, place: this.from.id }, 420);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    this.walker?.animate(dt, this.leaving ? 'swim' : 'idle', this.leaving ? 0.7 : 0);
    // der angewählte Ort pulsiert sacht
    const n = this.choices[this.focusIdx];
    this.glow.clear();
    if (n) {
      const k = 0.5 + 0.5 * Math.sin(this.t * 4);
      this.glow.lineStyle(2, n.state === 'open' ? 0xffe2a8 : 0xa4322a, 0.25 + 0.35 * k);
      this.glow.strokeCircle(n.x, n.y, 18 + 5 * k);
    }
  }
}
