import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { EPOCHS, type EpochDef } from '../data/epochs';
import { PALEO } from '../data/paleo';
import { placesOf, type PlaceDef } from '../data/world';
import { STAT_COUNT } from '../data/tablet';
import { game } from '../state/GameState';
import { STAGE_NAME, stageOf, worldYears } from '../sim/life';
import { MAP_BOX, mapPos } from '../art/mapArt';
import { FogMap, mapFrame, routePoints } from '../art/paleoArt';
import { CreatureView } from '../objects/CreatureView';
import { Button, MenuNav, controlsList, fadeIn, fadeTo, panel, soundButton, text, title } from '../ui/ui';
import { TabletScreen } from '../ui/tabletScreen';

/** Halbmesser des Punktes eines Ortes (die Karte ist weit herausgezoomt: alles ist klein) */
const DOT = 6;
/** Das eigene Tier auf der Karte: klein, knapp über dem Punkt */
const FISH_SCALE = 0.32;
const FISH_LIFT = 17;

interface NodeVis {
  def: PlaceDef;
  x: number;
  y: number;
  c: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  known: boolean;
}

/**
 * Die Karte des Zeitalters. Wer durch einen Durchgang schwimmt, sieht hier, wohin es geht – ein neuer Ort wird
 * dabei freigeschaltet und erscheint auf der Karte. Orte, die man nicht entdeckt hat, sind gar nicht zu sehen.
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
  private infoState!: Phaser.GameObjects.Text;
  private tablet?: TabletScreen;
  private rest?: Phaser.GameObjects.Container;
  private restNav?: MenuNav;
  private glow?: Phaser.GameObjects.Image;
  private leaving = false;
  private fromId?: string;
  private toId?: string;
  private edge?: { side: 'left' | 'right'; frac: number };
  private isNew = false;
  private fog!: FogMap;
  private trails = new Map<string, Phaser.GameObjects.Graphics>();

  constructor() {
    super('Map');
  }

  init(d: { epoch?: number; from?: string; to?: string; edge?: { side: 'left' | 'right'; frac: number } }) {
    this.ep = EPOCHS[d?.epoch ?? game.epochIndex];
    this.fromId = d?.from;
    this.toId = d?.to;
    this.edge = d?.edge;
    this.places = placesOf(this.ep);
    this.nodes = new Map();
    this.trails = new Map();
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

    // Welche Orte kennt man? Nur die, durch deren Durchgang man schon geschwommen ist.
    const known = new Set<string>(prog.known);
    if (this.fromId) {
      const f = this.places.find((p) => p.id === this.fromId);
      if (f) this.cur = f;
    }
    known.add(this.cur.id);
    this.isNew = !!this.toId && !known.has(this.toId);
    const target = this.places.find((p) => p.id === this.toId);
    this.focus = target ?? this.cur;

    const pos = (p: PlaceDef) => mapPos(p.x, p.y);
    // Die Urzeit-Erde: dunkel, nur um bekannte Orte und geschwommene Wege hell
    const mine = this.places.map((p) => ({ id: p.id, kind: p.kind, ...pos(p) }));
    this.fog = new FogMap(this, this.ep.id, mine, [...known]);
    this.add.image(0, 0, this.fog.key).setOrigin(0);
    const mid = Math.round((this.ep.from + this.ep.to) / 2e6);
    this.add.image(0, 0, mapFrame(this, this.ep.id, `ERDE VOR ${mid} MIO. JAHREN`)).setOrigin(0).setDepth(1);

    // Wege: Blasenspuren zwischen bekannten Orten, um das Land herum
    const drawn = new Set<string>();
    for (const p of this.places) {
      for (const lid of p.links) {
        const q = this.places.find((o) => o.id === lid);
        const k = this.linkKey(p.id, lid);
        if (!q || drawn.has(k) || !known.has(p.id) || !known.has(lid)) continue;
        drawn.add(k);
        const pts = this.route(p.id, lid);
        this.trailTo(k, pts, 1);
        this.fog.showRoute(k, pts, 1);
      }
    }
    this.fog.refresh();

    // Orte
    const spots = this.labelSpots(pos);
    this.places.forEach((p, i) => {
      const { x, y } = pos(p);
      const isKnown = known.has(p.id);
      const isTarget = p.id === this.toId;
      if (!isKnown && !isTarget) return;
      const c = this.add.container(x, y).setDepth(5);
      const ring = this.add.graphics();
      c.add(ring);
      c.add(this.add.image(0, 0, `mapicon_${p.kind}`).setDisplaySize(DOT * 1.7, DOT * 1.7).setAlpha(0.95));
      const visited = prog.seen.includes(p.id);
      const sp = spots.get(p.id)!;
      const label = text(this, sp.x, sp.y, p.name, 13, visited ? UI.bone : UI.boneDim, { fontStyle: '700', stroke: '#050403', strokeThickness: 3 }).setOrigin(sp.ox, 0.5);
      c.add(label);
      c.setVisible(isKnown);
      // Wer noch nie dort war: ein Funkeln über dem Ort
      if (isKnown && !visited) {
        const star = this.add.image(0, 0, 'glow').setTint(0xffe8b0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(30, 30).setAlpha(0.5);
        c.add(star);
        this.tweens.add({ targets: star, alpha: 0.12, yoyo: true, repeat: -1, duration: 900 + i * 130, ease: 'Sine.inOut' });
      }
      const vis: NodeVis = { def: p, x, y, c, ring, known: isKnown };
      this.nodes.set(p.id, vis);
      this.drawRing(vis);
    });

    // Das eigene Tier
    const here = this.nodes.get(this.cur.id)!;
    const m = { ...game.morph(), belly: 1 };
    this.fish = new CreatureView(this, here.x, here.y - FISH_LIFT, m, FISH_SCALE).setDepth(10);
    this.fish.setFacing(here.x > W / 2 ? -1 : 1);

    // Blasen, die aufsteigen
    this.add.particles(0, 0, 'p_bubble', {
      x: { min: 0, max: W }, y: H + 10, lifespan: 9000, frequency: 260, speedY: { min: -40, max: -18 }, speedX: { min: -8, max: 8 },
      scale: { min: 0.25, max: 0.7 }, alpha: { start: 0.35, end: 0 },
    }).setDepth(3);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.6).setDepth(8);

    // Überschrift und Auskunft
    title(this, 86, 40, this.ep.name.toUpperCase(), 30, UI.ochre).setOrigin(0, 0.5).setLetterSpacing(3).setDepth(9);
    this.buildInfo();
    this.setFocus(this.focus);

    // Knöpfe oben rechts (wie im Level)
    new Button(this, W - 98, 38, '', { w: 50, h: 50, icon: 'ic_pause', iconOnly: true, onClick: () => this.toggleRest() }).setAlpha(0.8).setDepth(20);
    this.glow = this.add.image(W - 156, 38, 'glow').setTint(0xffe4a8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0).setDepth(19);
    new Button(this, W - 156, 38, 'C', { w: 50, h: 50, onClick: () => this.toggleTablet() }).setAlpha(0.8).setDepth(20);
    soundButton(this, W - 40, 38, 50).setAlpha(0.8).setDepth(20);
    this.updateGlow();

    const kb = this.input.keyboard!;
    for (const k of ['ENTER', 'SPACE', 'E', 'Q', 'J']) kb.on(`keydown-${k}`, () => this.skip());
    kb.on('keydown-C', () => this.toggleTablet());
    kb.on('keydown-ESC', () => (this.tablet ? this.toggleTablet() : this.toggleRest()));
    kb.on('keydown-P', () => this.toggleRest());
    if (this.toId) this.time.delayedCall(1100, () => this.travel());
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.fish.animate(dt, 'swim', this.moving ? 0.8 : 0.2);
    this.tablet?.update(dt);
    if (!this.moving) {
      const n = this.nodes.get(this.cur.id)!;
      this.fish.setPosition(n.x, n.y - FISH_LIFT + Math.sin(this.time.now / 700) * 1.5);
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
    g.fillStyle(0x0b100f, 0.9);
    g.fillCircle(0, 0, DOT);
    g.lineStyle(here ? 1.8 : 1.3, here ? 0xe0a848 : focus ? 0xcdb88a : 0x7a6a4a, here ? 0.95 : 0.8);
    g.strokeCircle(0, 0, DOT);
    if (focus || here) {
      g.lineStyle(1.2, 0xe0a848, 0.25 + 0.35 * pulse);
      g.strokeCircle(0, 0, DOT + 3 + 1.5 * pulse);
    }
  }

  private buildInfo() {
    const c = this.add.container(W / 2, H - 46).setDepth(12);
    c.add(panel(this, -360, -26, 720, 52, 0.88, UI.stone));
    this.infoName = title(this, -336, 0, '', 24, UI.bone).setOrigin(0, 0.5);
    this.infoState = text(this, 336, 0, '', 16, UI.ochre).setOrigin(1, 0.5);
    c.add([this.infoName, this.infoState]);
  }

  private setFocus(p: PlaceDef) {
    this.focus = p;
    const seen = game.prog.seen.includes(p.id);
    this.infoName.setText(p.name);
    this.infoState.setText(p.id === this.cur.id && !this.toId ? 'Hier bist du' : this.isNew ? 'Neu entdeckt' : seen ? 'Schon besucht' : '');
  }

  /** Wohin die Namen kommen: meist unter das Zeichen, sonst daneben, wenn dort ein anderer Ort im Weg wäre. */
  private labelSpots(pos: (p: PlaceDef) => { x: number; y: number }) {
    type Box = [number, number, number, number];
    const hit = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const rings = new Map(this.places.map((p) => [p.id, pos(p)]));
    // Die Namen von Kontinenten und Meeren bleiben nach Möglichkeit frei (sind aber nur Hintergrund)
    const geoBoxes: Box[] = [];
    const geo = PALEO[this.ep.id];
    for (const c of [...geo.continents, ...(geo.far ?? [])]) {
      if (!c.name) continue;
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

  private linkKey(a: string, b: string) {
    return [a, b].sort().join('|');
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

  // ---------------------------------------------------------------- Bewegen und betreten

  /** Das Ziel erscheint (falls neu), dann schwimmt das Tier hin und taucht dort auf. */
  private travel() {
    if (this.moving || this.leaving || this.tablet || this.rest) return;
    const to = this.places.find((p) => p.id === this.toId);
    if (!to) return;
    const n = this.nodes.get(to.id);
    if (!n) return;
    const go = () => {
      if (!this.leaving) this.swimTo(to);
    };
    if (this.isNew && !n.known) {
      n.known = true;
      // erst der Weg dorthin (die Karte hellt sich entlang der Strecke auf) …
      const key = this.linkKey(this.cur.id, to.id);
      const pts = this.route(this.cur.id, to.id);
      const k = { p: 0, d: 0 };
      this.tweens.add({
        targets: k, p: 1, duration: Math.min(1500, 500 + pts.length * 9), ease: 'Sine.inOut',
        onUpdate: () => {
          this.trailTo(key, pts, k.p);
          this.fog.showRoute(key, pts, k.p);
          this.fog.refresh();
        },
        onComplete: () => {
          // … dann zeigt sich der neue Ort
          n.c.setVisible(true).setAlpha(0);
          this.tweens.add({ targets: n.c, alpha: { from: 0, to: 1 }, duration: 900 });
          this.tweens.add({
            targets: k, d: 1, duration: 1100, ease: 'Sine.out',
            onUpdate: () => {
              this.fog.reveal(to.id, k.d);
              this.fog.refresh();
            },
            onComplete: () => go(),
          });
          audio.sfx('shell');
          const sp = this.add.particles(n.x, n.y, 'p_dot', {
            emitting: false, lifespan: 1200, speed: { min: 30, max: 120 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 },
            tint: [0xffe8b0, 0xe0a848, 0xfff4dc], blendMode: 'ADD',
          }).setDepth(7);
          sp.explode(30);
        },
      });
    } else go();
  }

  private swimTo(p: PlaceDef) {
    const a = this.nodes.get(this.cur.id)!, b = this.nodes.get(p.id)!;
    const pts = this.route(this.cur.id, p.id);
    this.moving = true;
    this.fish.setFacing(b.x >= a.x ? 1 : -1);
    audio.sfx('travel');
    const k = { t: 0 };
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let facing = b.x >= a.x ? 1 : -1;
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
        // über dem Weg schwimmen, nur an den Orten über dem Zeichen schweben
        const e = Math.min(1, Math.min(k.t, 1 - k.t) * 8);
        this.fish.setPosition(x, y - (FISH_LIFT * 0.4 + FISH_LIFT * 0.6 * (1 - e)));
      },
      onComplete: () => {
        this.cur = p;
        this.moving = false;
        this.setFocus(p);
        audio.sfx('click');
        this.time.delayedCall(700, () => this.enter());
      },
    });
  }

  /** Mit Enter geht es sofort weiter. */
  private skip() {
    if (this.tablet || this.rest || this.leaving) return;
    this.enter();
  }

  /** Den Zielort betreten (bzw. den eigenen, wenn man nur die Karte ansieht). */
  private enter() {
    if (this.leaving || this.tablet || this.rest) return;
    this.leaving = true;
    const dest = this.places.find((p) => p.id === this.toId) ?? this.cur;
    game.enterPlace(dest.id, dest.id === this.toId ? this.fromId : undefined, dest.id === this.toId ? this.edge : undefined);
    audio.sfx('travel');
    fadeTo(this, 'Level', { epoch: game.epochIndex, place: dest.id }, 900);
  }

  // ---------------------------------------------------------------- Steintafel und Rast

  private updateGlow() {
    const g = this.glow;
    if (!g) return;
    this.tweens.killTweensOf(g);
    if (Math.min(STAT_COUNT, game.shells.length) <= game.seenRows) return g.setAlpha(0);
    g.setAlpha(0.1);
    this.tweens.add({ targets: g, alpha: 0.32, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.inOut' });
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
        ctx: { cls: game.cls, traits: game.traits, hp: prog.hp, sat: prog.sat, life: game.lifeK },
        morph: game.morph(),
        placeName: this.cur.name,
        life: { stage: STAGE_NAME[stageOf(game.life.age)], spawn: game.heir() ? 'Ein befruchtetes Gelege wartet im Laichfluss' : 'Gelaicht wird im Laichfluss' },
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
    if (this.tablet || this.leaving) return;
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
    controlsList(this, c, W / 2 + 30, 172, 21, 31);
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
