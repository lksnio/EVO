import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { placesOf, type PlaceDef } from '../data/world';
import { STAT_COUNT } from '../data/tablet';
import { game } from '../state/GameState';
import { mapBase, mapPos, placeField } from '../art/mapArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, controlsList, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { TabletScreen } from '../ui/tabletScreen';
import { hashStr } from '../util/math';

interface NodeVis {
  def: PlaceDef;
  x: number;
  y: number;
  c: Phaser.GameObjects.Container;
  field: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  known: boolean;
}

/**
 * Die Karte des Zeitalters. Wer am Rand eines Ortes hinausschwimmt, landet hier und sucht sich den
 * nächsten Ort aus: ein dicht bewachsenes Gewässer mit viel Nahrung, eine trübe Bucht – oder die
 * Tiefe, wo die schlimmen Tiere warten. Orte, die man nicht kennt, bleiben im Dunkeln.
 */
export class MapScene extends Phaser.Scene {
  private ep!: EpochDef;
  private places: PlaceDef[] = [];
  private nodes = new Map<string, NodeVis>();
  private cur!: PlaceDef;
  private focus!: PlaceDef;
  private fish!: CreatureView;
  private moving = false;
  private infoName!: Phaser.GameObjects.Text;
  private infoBlurb!: Phaser.GameObjects.Text;
  private infoState!: Phaser.GameObjects.Text;
  private tablet?: TabletScreen;
  private rest?: Phaser.GameObjects.Container;
  private restNav?: MenuNav;
  private glow?: Phaser.GameObjects.Image;
  private leaving = false;

  constructor() {
    super('Map');
  }

  init(d: { epoch?: number }) {
    this.ep = EPOCHS[d?.epoch ?? game.epochIndex];
    this.places = placesOf(this.ep);
    this.nodes = new Map();
    this.moving = false;
    this.tablet = undefined;
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
    this.cur = this.places.find((p) => p.id === prog.place) ?? this.places[0];
    this.focus = this.cur;

    // Welche Orte kennt man? Besuchte und alle, die von dort aus zu erreichen sind.
    const known = new Set<string>();
    for (const id of prog.seen) {
      known.add(id);
      for (const l of this.places.find((p) => p.id === id)?.links ?? []) known.add(l);
    }

    const pos = (p: PlaceDef) => mapPos(p.x, p.y);
    const seed = hashStr(this.ep.id) + (game.run?.id ?? 0);
    this.add.image(0, 0, mapBase(this, `mapbase_${this.ep.id}_${seed % 97}`, seed, this.places.map(pos))).setOrigin(0);

    // Wege: Blasenspuren zwischen bekannten Orten
    const paths = this.add.graphics().setDepth(2);
    const drawn = new Set<string>();
    for (const p of this.places) {
      for (const lid of p.links) {
        const q = this.places.find((o) => o.id === lid);
        const k = [p.id, lid].sort().join('|');
        if (!q || drawn.has(k) || !known.has(p.id) || !known.has(lid)) continue;
        drawn.add(k);
        const [a, b] = [pos(p), pos(q)];
        const c = this.ctrl(a, b);
        const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 14);
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const pt = this.bez(a, c, b, t);
          paths.fillStyle(0xbfeee4, 0.1 + 0.28 * Math.sin(t * Math.PI));
          paths.fillCircle(pt.x, pt.y, 2.2 + 0.9 * Math.sin(t * 9));
        }
      }
    }

    // Orte
    this.places.forEach((p, i) => {
      const { x, y } = pos(p);
      const isKnown = known.has(p.id);
      const field = this.add.image(x, y, placeField(this, p.kind, seed + i)).setDepth(1).setScale(1.15).setAlpha(isKnown ? 0.95 : 0);
      const c = this.add.container(x, y).setDepth(5);
      const ring = this.add.graphics();
      c.add(ring);
      c.add(this.add.image(0, 0, `mapicon_${p.kind}`).setDisplaySize(32, 32).setAlpha(0.95));
      const visited = prog.seen.includes(p.id);
      const label = text(this, 0, 42, p.name, 17, visited ? UI.bone : UI.boneDim, { fontStyle: '700', stroke: '#050403', strokeThickness: 4 }).setOrigin(0.5);
      c.add(label);
      c.setVisible(isKnown);
      // Wer noch nie dort war: ein Funkeln über dem Ort
      if (isKnown && !visited) {
        const star = this.add.image(0, -34, 'glow').setTint(0xffe8b0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(46, 46).setAlpha(0.5);
        c.add(star);
        this.tweens.add({ targets: star, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 + i * 130, ease: 'Sine.inOut' });
      }
      const zone = this.add.zone(x, y, 120, 100).setDepth(6).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setFocus(p));
      zone.on('pointerout', () => this.setFocus(this.cur));
      zone.on('pointerdown', () => this.click(p));
      if (!isKnown) zone.disableInteractive();
      const vis: NodeVis = { def: p, x, y, c, field, ring, known: isKnown };
      this.nodes.set(p.id, vis);
      this.drawRing(vis);
    });

    // Das eigene Tier
    const here = this.nodes.get(this.cur.id)!;
    const m = { ...game.morph(), belly: 1 };
    this.fish = new CreatureView(this, here.x, here.y - 56, m, 0.6).setDepth(10);
    this.fish.setFacing(here.x > W / 2 ? -1 : 1);

    // Blasen, die aufsteigen
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W }, y: H + 10, lifespan: 9000, frequency: 260, speedY: { min: -40, max: -18 }, speedX: { min: -8, max: 8 },
      scale: { min: 0.25, max: 0.7 }, alpha: { start: 0.35, end: 0 },
    }).setDepth(3);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.6).setDepth(8);

    // Überschrift und Auskunft
    title(this, 86, 40, this.ep.name.toUpperCase(), 30, UI.ochre).setOrigin(0, 0.5).setLetterSpacing(3).setDepth(9);
    text(this, 88, 72, 'Wohin schwimmst du?', 18, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0, 0.5).setDepth(9);
    this.buildInfo();
    this.setFocus(this.cur);

    // Knöpfe oben rechts (wie im Level)
    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.toggleRest() }).setAlpha(0.8).setDepth(20);
    this.glow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0).setDepth(19);
    new Button(this, W - 156, 38, 'C', { w: 50, h: 50, onClick: () => this.toggleTablet() }).setAlpha(0.8).setDepth(20);
    soundButton(this, W - 40, 38, 50).setAlpha(0.8).setDepth(20);
    this.updateGlow();

    const kb = this.input.keyboard!;
    kb.on('keydown-LEFT', () => this.go(-1, 0));
    kb.on('keydown-RIGHT', () => this.go(1, 0));
    kb.on('keydown-UP', () => this.go(0, -1));
    kb.on('keydown-DOWN', () => this.go(0, 1));
    for (const k of ['ENTER', 'SPACE', 'E', 'Q', 'J']) kb.on(`keydown-${k}`, () => this.enter());
    kb.on('keydown-C', () => this.toggleTablet());
    kb.on('keydown-ESC', () => (this.tablet ? this.toggleTablet() : this.toggleRest()));
    kb.on('keydown-P', () => this.toggleRest());
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.fish.animate(dt, 'swim', this.moving ? 0.8 : 0.2);
    this.tablet?.update(dt);
    if (!this.moving) {
      const n = this.nodes.get(this.cur.id)!;
      this.fish.setPosition(n.x, n.y - 56 + Math.sin(this.time.now / 700) * 3);
    }
    // der Ring des gewählten Ortes pulsiert
    for (const n of this.nodes.values()) if (n.known) this.drawRing(n);
  }

  // ---------------------------------------------------------------- Zeichnen

  private drawRing(n: NodeVis) {
    const g = n.ring;
    const here = n.def.id === this.cur.id;
    const focus = n.def.id === this.focus.id;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 380);
    g.clear();
    g.fillStyle(0x0b100f, 0.88);
    g.fillCircle(0, 0, 29);
    g.lineStyle(here ? 3 : 2, here ? 0xe0a848 : focus ? 0xcdb88a : 0x7a6a4a, here ? 0.95 : 0.8);
    g.strokeCircle(0, 0, 29);
    if (focus || here) {
      g.lineStyle(2, 0xe0a848, 0.25 + 0.35 * pulse);
      g.strokeCircle(0, 0, 33 + 3 * pulse);
    }
  }

  private buildInfo() {
    const c = this.add.container(W / 2, H - 46).setDepth(12);
    c.add(panel(this, -360, -38, 720, 76, 0.88, UI.stone));
    this.infoName = title(this, -336, -14, '', 24, UI.bone).setOrigin(0, 0.5);
    this.infoBlurb = text(this, -336, 16, '', 18, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0, 0.5);
    this.infoState = text(this, 336, -14, '', 16, UI.ochre).setOrigin(1, 0.5);
    c.add([this.infoName, this.infoBlurb, this.infoState]);
  }

  private setFocus(p: PlaceDef) {
    this.focus = p;
    const seen = game.prog.seen.includes(p.id);
    this.infoName.setText(p.name);
    this.infoBlurb.setText(p.blurb);
    this.infoState.setText(p.id === this.cur.id ? 'Hier bist du' : seen ? 'Schon besucht' : 'Noch unbekannt');
  }

  private ctrl(a: { x: number; y: number }, b: { x: number; y: number }) {
    // leicht gebogen
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = 0.12 * len * (((a.x * 7 + b.y * 3) | 0) % 2 ? 1 : -1);
    return { x: mx - (dy / len) * k, y: my + (dx / len) * k };
  }

  private bez(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }

  // ---------------------------------------------------------------- Bewegen und betreten

  /** Mit den Pfeiltasten zum nächsten Ort in dieser Richtung schwimmen. */
  private go(dx: number, dy: number) {
    if (this.moving || this.tablet || this.rest || this.leaving) return;
    const from = this.nodes.get(this.cur.id)!;
    let best: PlaceDef | null = null;
    let bestScore = 0.4;
    for (const lid of this.cur.links) {
      const to = this.nodes.get(lid);
      if (!to?.known) continue;
      const vx = to.x - from.x, vy = to.y - from.y;
      const len = Math.hypot(vx, vy) || 1;
      const score = (vx * dx + vy * dy) / len;
      if (score > bestScore) {
        bestScore = score;
        best = to.def;
      }
    }
    if (best) this.swimTo(best);
    else audio.sfx('fail');
  }

  private click(p: PlaceDef) {
    if (this.moving || this.tablet || this.rest || this.leaving) return;
    if (p.id === this.cur.id) this.enter();
    else if (this.cur.links.includes(p.id)) this.swimTo(p);
    else audio.sfx('fail');
  }

  private swimTo(p: PlaceDef) {
    const a = this.nodes.get(this.cur.id)!, b = this.nodes.get(p.id)!;
    const c = this.ctrl(a, b);
    this.moving = true;
    this.fish.setFacing(b.x >= a.x ? 1 : -1);
    audio.sfx('travel');
    const k = { t: 0 };
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    this.tweens.add({
      targets: k,
      t: 1,
      duration: Math.max(600, dist * 2.6),
      ease: 'Sine.inOut',
      onUpdate: () => {
        const pt = this.bez({ x: a.x, y: a.y - 56 }, { x: c.x, y: c.y - 56 }, { x: b.x, y: b.y - 56 }, k.t);
        this.fish.setPosition(pt.x, pt.y);
      },
      onComplete: () => {
        this.cur = p;
        this.moving = false;
        this.setFocus(p);
        audio.sfx('click');
      },
    });
  }

  /** Den Ort betreten, an dem man gerade ist. */
  private enter() {
    if (this.moving || this.tablet || this.rest || this.leaving) return;
    this.leaving = true;
    game.enterPlace(this.cur.id);
    audio.sfx('travel');
    fadeTo(this, 'Level', { epoch: game.epochIndex, place: this.cur.id }, 900);
  }

  // ---------------------------------------------------------------- Steintafel und Rast

  private updateGlow() {
    const g = this.glow;
    if (!g) return;
    this.tweens.killTweensOf(g);
    if (Math.min(STAT_COUNT, game.shells.length) <= game.seenRows) return g.setAlpha(0);
    g.setAlpha(0.2);
    this.tweens.add({ targets: g, alpha: 0.7, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
  }

  private toggleTablet() {
    if (this.tablet) {
      this.tablet.destroy();
      this.tablet = undefined;
      this.updateGlow();
      return;
    }
    if (this.rest || this.leaving) return;
    audio.sfx('select');
    const prog = game.prog;
    this.tablet = new TabletScreen(
      this,
      {
        ctx: { cls: game.cls, traits: game.traits, hp: prog.hp, sat: prog.sat },
        morph: game.morph(),
        elapsed: prog.elapsed,
        placeName: this.cur.name,
        kin: prog.kin ?? game.run?.kin ?? 0,
      },
      () => this.toggleTablet(),
    );
  }

  private toggleRest() {
    if (this.rest) {
      this.closeRest();
      return;
    }
    if (this.tablet || this.leaving || this.moving) return;
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

  private showControls() {
    if (!this.rest) return;
    const c = this.add.container(0, 0).setDepth(55);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.88).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 420, 70, 840, 580, 0.97));
    c.add(title(this, W / 2, 124, 'Steuerung', 40).setOrigin(0.5));
    controlsList(this, c, W / 2 + 30, 180, 22, 38);
    const back = new Button(this, W / 2, 604, 'Zurück', { w: 240, h: 48, onClick: () => close() });
    c.add(back);
    if (this.restNav) this.restNav.enabled = false;
    const nav = new MenuNav(this, [back]);
    const close = () => {
      nav.enabled = false;
      c.destroy();
      if (this.restNav) this.restNav.enabled = true;
    };
  }

  private giveUp() {
    if (this.leaving) return;
    this.leaving = true;
    const prog = game.prog;
    const frac = Math.max(0, Math.min(1, prog.elapsed / this.ep.seconds));
    const span = game.epochSpan();
    const years = span.from - (span.from - span.to) * frac;
    const morph = game.morph();
    const leaf = game.extinct(frac, 'Aufgegeben');
    audio.music(null);
    this.closeRest();
    fadeTo(this, 'Tree', { mode: 'extinct', leaf, morph, epoch: this.ep ? EPOCHS.indexOf(this.ep) : 0, cause: 'Aufgegeben', years }, 1000);
  }
}
