import { CURSOR } from '../ui/cursor';
import Phaser from 'phaser';
import { historyCause } from '../ui/historyText';
import { W, H, UI, TITLE_FONT, DEPTH } from '../config';
import { audio } from '../audio/Audio';
import { bus, game, type RoeEgg, type RoeGroup } from '../state/GameState';
import { CreatureView } from '../objects/CreatureView';
import { species } from '../net/Species';
import { Button, fadeIn, fadeTo, text } from '../ui/ui';
import { tex } from '../util/canvas';
import type { LevelScene, SuccessionData } from './LevelScene';
import { speciesEnd } from './ExtinctScene';
import { orderRoe } from '../sim/roe';
import { lineageForm, lineageFormName, lineageSummary, readLineageEvolution } from '../sim/lineageEvolution';

/**
 * Der Laich (Devon): Nach dem Tod oder beim Besuch am dauerhaften Laich wählt man sein nächstes Leben.
 * Ein Besuch lässt sich ohne Folgen verlassen; neue Eier werden ausdrücklich befruchtet. Jeder Wechsel wird bestätigt.
 *   – Geschwister: Eier deiner Generation, die noch warten. Man bleibt in dieser Generation.
 *   – Nächste Generation: der Laich, den du und deine Geschwister gelegt habt. Wer daraus wählt, beginnt die nächste
 *     Generation. Der übrige Laich und die anderen Linien bleiben erhalten.
 * Jedes Ei zeigt, was in ihm steckt: das ausgewachsene Tier und seine Erbgutwerte (Lebenskraft, Ausdauer, Gebiss, Stoß,
 * Flossen, Schuppen), daneben der Unterschied zu deinem Tier, das gerade gestorben ist. Sammelfunde
 * verändern die sichtbaren oder späteren Erbgutwerte nicht.
 *
 * Im Koop ist der Laich der gemeinsame (net/Species.ts): Die Liste ändert sich, wenn ein Artgenosse ein Ei nimmt; ein Ei
 * schlüpft erst, wenn der Server es zuteilt. Ein Generationswechsel verwirft ältere Eier für alle.
 * Ohne Laich wartet ein Zuschauer auf lebende Mitspieler; erst ohne lebende Spieler und Eier endet die Art.
 */
export interface RoeData {
  watching?:boolean;
  /** Besuch am Laich: ansehen und zurückkehren oder das lebende Tier bewusst ablösen. */
  living?: boolean;
  epoch: number;
  /** woran das Tier starb */
  cause: string;
  /** Weltzeit (Jahre vor heute) */
  years: number;
}

type StatKey = 'hp' | 'stam' | 'bite' | 'ram' | 'fins' | 'scales';
const STATS: [StatKey, string][] = [
  ['hp', 'Vitality'],
  ['stam', 'Stamina'],
  ['bite', 'Jaws'],
  ['ram', 'Skull'],
  ['fins', 'Fins'],
  ['scales', 'Scales'],
];
type Shown = Record<StatKey, number>;

/** so viele Eier je Reihe, höchstens zwei Reihen je Gruppe (der Rest steht als „+N“ da) */
const PER_ROW = 13;
const ROWS = 2;
const STEP = 50;
const ROW_STEP = 64;

/** Ein Ei als kleines Bild: glasig, mit Dotter und eingerolltem Keim. */
function roeTexture(scene: Phaser.Scene) {
  return tex(scene, 'roe_pick', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(24, 22, 3, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,252,236,0.98)');
    g.addColorStop(0.55, 'rgba(232,222,182,0.9)');
    g.addColorStop(1, 'rgba(150,140,100,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,36,24,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,34,22,0.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(33, 34, 11, -0.6, Math.PI * 1.25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(40,34,22,0.95)';
    ctx.beginPath();
    ctx.arc(41, 26, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(21, 19, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

interface Slot {
  group: RoeGroup;
  /** Stelle in der Liste der Gruppe (game.pool bzw. game.roe) */
  i: number;
  /** Stelle im Bild: Die stärksten Eier stehen vorn */
  pos: number;
  egg: RoeEgg;
  img: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Arc;
  v: Shown;
}

export class RoeScene extends Phaser.Scene {
  private d!: RoeData;
  private going = false;
  private ending=false;
  private slots: Slot[] = [];
  private focus = -1;
  /** die Generation deines Tiers, das gerade gestorben ist */
  private gen = 0;
  /** dein Tier, das gerade gestorben ist (ausgewachsen) – daran messen sich die Eier */
  private mine!: Shown;
  private layer?: Phaser.GameObjects.Container;
  private peerLayer?: Phaser.GameObjects.Container;
  private nursery?: Phaser.GameObjects.Container;
  private card!: Phaser.GameObjects.Container;
  private portrait?: CreatureView;
  private confirm?: Phaser.GameObjects.Container;
  private confirmBtns: Button[] = [];
  private confirmIdx = 0;
  /** eine kurze Meldung über der Karte (ein Artgenosse war schneller …) */
  private flashMsg?: Phaser.GameObjects.Text;

  constructor() {
    super('Roe');
  }

  init(d: RoeData) {
    this.d = d;
    this.going = false;this.ending=false;
    this.slots = [];
    this.focus = -1;
    this.confirm = undefined;
    this.confirmBtns = [];
    this.portrait = undefined;
    this.layer = undefined;
    this.flashMsg = undefined;
    this.peerLayer = undefined;
    this.nursery = undefined;
  }

  create() {
    fadeIn(this, 900);
    this.cameras.main.setBackgroundColor('#04070a');
    audio.music('generation');
    const run = game.run;
    if (!run) {
      fadeTo(this, 'Title', {}, 600);
      return;
    }
    this.gen = run.life.gen;
    this.mine = game.roeShown();
    // dunkles Wasser, Schwebeteilchen
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0c1a22, 0x0c1a22, 0x020405, 0x020405, 1);
    bg.fillRect(0, 0, W, H);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 7000, frequency: 140,
      scale: { start: 0.3, end: 0 }, alpha: { start: 0, end: 0.4, ease: 'Sine.inOut' }, speedY: { min: -12, max: -3 }, tint: [0xd8e8f0, 0xf0e0b0],
    });
    this.add.text(W / 2, 44, 'THE EGGS', { fontFamily: TITLE_FONT, fontSize: '30px', color: UI.bone, resolution: 2 }).setOrigin(0.5).setLetterSpacing(8);
    const others = species.active ? species.others : [];
    const shared = others.length ? `  ·  shared eggs with ${others.join(', ')}` : '';
    text(this, W / 2, 84, this.d.living ? `Your eggs · Inspect, fertilise and pass on life.${shared}` : `${historyCause(this.d.cause)} — choose your next life.${shared}`, 16, UI.boneDim).setOrigin(0.5);
    roeTexture(this);
    this.card = this.add.container(1010, 380);
    text(this, W / 2, H - 20, this.d.living ? '← → ↑ ↓ choose · E / Enter: inspect and confirm · B: fertilise · Esc: back' : '← → ↑ ↓ choose · E / Enter or tap: choose an egg and confirm', 14, UI.boneDim).setOrigin(0.5);

    const kb = this.input.keyboard!;
    // Phaser can replay earlier DOM events from the same frame's queue when another key arrives.
    // A fast direction + Enter must confirm once, rather than toggle back and reopen the dialog.
    const handled = new WeakSet<KeyboardEvent>();
    const onceKey = (action: () => void) => (event: KeyboardEvent) => {
      if (handled.has(event)) return;
      handled.add(event); action();
    };
    const move = (dx: number, dy: number) => onceKey(() => this.move(dx, dy));
    kb.on('keydown-LEFT', move(-1, 0));
    kb.on('keydown-A', move(-1, 0));
    kb.on('keydown-RIGHT', move(1, 0));
    kb.on('keydown-D', move(1, 0));
    kb.on('keydown-UP', move(0, -1));
    kb.on('keydown-W', move(0, -1));
    kb.on('keydown-DOWN', move(0, 1));
    kb.on('keydown-S', move(0, 1));
    const act = onceKey(() => (this.confirm ? this.confirmBtns[this.confirmIdx]?.click() : this.pick()));
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-E', act);
    kb.on('keydown-ESC', onceKey(() => this.confirm ? this.closeConfirm() : this.closeVisit()));
    kb.on('keydown-B', onceKey(() => this.d.living && !this.confirm && this.fertilize()));

    // im Koop: Der gemeinsame Laich ändert sich (ein Artgenosse nimmt ein Ei, laicht, beginnt die nächste Generation)
    const onChange = () => {
      if (this.going) return;
      if (this.confirm) { this.closeConfirm(); this.say('The eggs have changed. Please choose your egg again.', '#e0b070'); }
      this.build();
    };
    const onSelection = () => !this.going && this.drawSelections();
    const onOver = (name: unknown) => this.extinct(String(name ?? ''));
    bus.on('species', onChange);
    bus.on('speciesOver', onOver);
    bus.on('speciesSelection', onSelection);
    this.events.once('shutdown', () => {
      bus.off('species', onChange);
      bus.off('speciesOver', onOver);
      bus.off('speciesSelection', onSelection);
      species.mark(null);
      if(this.d.watching&&!this.going&&this.scene.isPaused('Level'))(this.scene.get('Level') as LevelScene).resumeWatching();
      if (this.d.living && !this.going && this.scene.isPaused('Level')) (this.scene.get('Level') as LevelScene).resumeRoeVisit();
    });
    this.build();
  }

  /** Die beiden Gruppen (neu) aufbauen – der Fokus bleibt beim selben Ei, wenn es noch da ist. */
  private build() {
    const keep = this.slots[this.focus]?.egg.id;
    this.layer?.destroy();
    this.layer = this.add.container(0, 0);
    this.slots = [];
    this.focus = -1;
    const pool = game.pool, roe = game.roe;
    if(this.d.watching&&!pool.length&&!roe.length){this.closeVisit();return;}
    if (!this.d.living && !pool.length && !roe.length) {
      // nichts mehr da: im Koop ist die Art ausgestorben, allein endet die Linie
      if (species.active) {
        species.extinct(this.d.cause);
        return this.extinct('');
      }
      return fadeTo(this, 'Title', {}, 600);
    }
    const plural=(n:number)=>`${n} ${n===1?'egg':'eggs'}`;
    const sibs=pool.length>0;
    if(sibs)this.group('pool',60,120,pool,'CURRENT GENERATION',`${plural(pool.length)} of the current generation`,false);
    this.group('next',60,sibs?340:190,roe,'DESCENDANTS',roe.length?`${plural(roe.length)} from your brood — changing generations ends the old one.`:'No eggs yet.',false);
    const again = keep ? this.slots.findIndex((s) => s.egg.id === keep) : -1;
    const start = again >= 0 ? again : this.slots.findIndex((s) => s.group === (pool.length ? 'pool' : 'next'));
    if (this.slots.length) this.setFocus(Math.max(0, start));
    else {
      species.mark(null);
      this.card.removeAll(true);
      this.portrait = undefined;
      this.card.add(this.add.rectangle(0, 0, 400, 560, 0x0c0e0e, 0.88).setStrokeStyle(1, 0x4a5a5e, 0.7));
      this.card.add(text(this, 0, -40, 'A new life\nbegins with an egg.', 26, UI.bone, { align: 'center' }).setOrigin(0.5));
      this.card.add(text(this, 0, 44, game.isLineageEvolution
        ? 'Water nursery to the left.\nShore nursery to the right.\nChoose descendants to continue the adaptation.'
        : 'Gather food and fertilise\nyour eggs once you are fully grown.', 17, UI.boneDim,
        { align: 'center', wordWrap: { width: 350 } }).setOrigin(0.5));
    }
    this.drawSelections();
    this.drawNursery();
  }

  /** Eine Gruppe: Überschrift, eine Zeile darunter, die Eier in bis zu zwei Reihen. */
  private group(g: RoeGroup, x: number, y: number, eggs: RoeEgg[], head: string, sub: string, warn: boolean) {
    const L = this.layer!;
    const next = g === 'next';
    L.add(this.add.rectangle(x - 16, y - 12, 720, 210, next ? 0x2a1a0c : 0x0e1a1e, next ? 0.55 : 0.5).setOrigin(0).setStrokeStyle(1, next ? 0x8a5a24 : warn ? 0x8a5a24 : 0x3a5058, 0.8));
    L.add(text(this, x, y, head, 17, next || warn ? UI.ochre : UI.bone).setLetterSpacing(2));
    L.add(text(this, x, y + 26, sub, 15, eggs.length ? (warn ? '#e0b070' : UI.boneDim) : '#6c6454'));
    const max = PER_ROW * ROWS;
    // Gemeinsame Reihenfolge: kein Bezug zu den persönlichen Werten des betrachtenden Spielers.
    const order = orderRoe(eggs, (egg) => game.roeShown(egg));
    order.slice(0, max).forEach(({ egg, i, v }, pos) => {
      const ex = x + 22 + (pos % PER_ROW) * STEP;
      const ey = y + 82 + Math.floor(pos / PER_ROW) * ROW_STEP;
      const ring = this.add.circle(ex, ey, 25, 0x000000, 0).setStrokeStyle(2, next ? 0xc8913c : 0x8aa0a8, 0);
      const img = this.add.image(ex, ey, 'roe_pick').setScale(0.62);

      L.add([ring, img]);
      const k = this.slots.length;
      img.setInteractive({ cursor: CURSOR.pointer });
      img.on('pointerover', () => !this.confirm && this.setFocus(k));
      img.on('pointerdown', () => {
        if (this.confirm) return;
        this.setFocus(k);
        this.pick();
      });
      this.tweens.add({ targets: img, y: ey - 3, yoyo: true, repeat: -1, duration: 1500 + Math.random() * 900, delay: Math.random() * 800, ease: 'Sine.inOut' });
      this.slots.push({ group: g, i, pos, egg, img, ring, v });
    });
    if (eggs.length > max) L.add(text(this, x + 22 + PER_ROW * STEP - 30, y + 190, `+${eggs.length - max} weaker`, 13, '#6c6454').setOrigin(1, 0.5));
  }

  private drawNursery() {
    this.nursery?.destroy();
    const c = (this.nursery = this.add.container(0, 0));
    c.add(this.add.rectangle(44, 550, 720, 76, 0x10191c, 0.95).setOrigin(0).setStrokeStyle(1, 0x4a5a5e, 0.6));
    const summary = [
      ['FOOD REMAINING', String(Math.floor(game.life.fed))],
      ['FOOD PER EGG', String(game.broodBase)],
      ['YOUR OFFSPRING', `${game.young} ${game.young === 1 ? 'egg' : 'eggs'}`],
    ];
    summary.forEach(([label, value], i) => {
      const x = 164 + i * 240;
      c.add(text(this, x, 566, label, 12, UI.ochre).setOrigin(0.5).setLetterSpacing(1));
      c.add(text(this, x, 601, value, 30, UI.bone, { fontStyle: '600' }).setOrigin(0.5));
      if (i) c.add(this.add.rectangle(x - 120, 588, 1, 46, 0x4a5a5e, 0.45));
    });
    if(this.d.watching){c.add(new Button(this,404,645,'Keep watching',{w:310,h:42,onClick:()=>this.closeVisit()}));return;}
    if (!this.d.living) return;
    const spawning = (this.scene.get('Level') as LevelScene).spawning!;
    const offer = spawning.offer;
    const action = offer.count ? `Fertilise ${offer.count} ${offer.count === 1 ? 'egg' : 'eggs'}` : 'Fertilise eggs';
    const label = game.isLineageEvolution ? `${spawning.breedingSite === 'water' ? 'Water' : 'Shore'} · ${action}` : action;
    const b = new Button(this, 266, 645, label, { w: 344, h: 42, size: 17, color: UI.ochreN, onClick: () => !this.confirm && this.fertilize() });
    b.setDisabled(!offer.count || this.going);
    c.add(b);
    c.add(new Button(this, 642, 645, game.isLineageEvolution ? 'Return to life' : 'Keep swimming', { w: 280, h: 42, size: 16, onClick: () => !this.confirm && this.closeVisit() }));
    c.add(text(this, 404, 675, offer.count ? game.isLineageEvolution
      ? 'This nursery shapes the descendants you choose. Extra clutches do not add generations.'
      : 'Fertilising converts food into eggs.' : offer.reason, 14, UI.boneDim,
      { align: 'center', wordWrap: { width: 730 } }).setOrigin(0.5));
  }

  private fertilize() {
    if (this.going || this.confirm) return;
    const n = (this.scene.get('Level') as LevelScene).spawning?.fertilize() ?? 0;
    if (!n) return;
    this.build();
    this.say(`${n} ${n === 1 ? 'new egg' : 'new eggs'} · total ${game.young} fertilised`, UI.ochre);
  }

  private closeVisit() {
    if(this.d.watching&&!this.going){this.scene.stop();(this.scene.get('Level') as LevelScene).resumeWatching();return;}
    if (!this.d.living || this.going) return;
    (this.scene.get('Level') as LevelScene).resumeRoeVisit();
    this.scene.stop();
  }

  private drawSelections() {
    this.peerLayer?.destroy();
    const layer = (this.peerLayer = this.add.container(0, 0));
    for (const s of this.slots) {
      const peers = species.selections.filter((p) => p.egg === s.egg.id);
      if (!peers.length) continue;
      layer.add(this.add.circle(s.ring.x, s.ring.y, 29).setFillStyle(0x000000, 0).setStrokeStyle(1.5, 0x88c8d8, 0.9));
      const names = peers.map((p) => p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name).join(', ');
      layer.add(text(this, s.ring.x, s.ring.y + 32, names, 11, '#a4dce8').setOrigin(0.5));
    }
  }

  /** Mit den Pfeilen: links/rechts in der Gruppe, hoch/runter in die andere Gruppe (an ähnlicher Stelle). */
  private move(dx: number, dy: number) {
    if (this.confirm) {
      if (dx || dy) {
        this.confirmIdx = (this.confirmIdx + 1) % this.confirmBtns.length;
        this.confirmBtns.forEach((b, i) => b.setFocus(i === this.confirmIdx));
        audio.sfx('click');
      }
      return;
    }
    const cur = this.slots[this.focus];
    if (!cur) return;
    const same = this.slots.filter((s) => s.group === cur.group);
    let to: Slot | undefined;
    if (dx) to = same[Math.min(same.length - 1, Math.max(0, same.indexOf(cur) + dx))];
    else {
      const row = Math.floor(cur.pos / PER_ROW), col = cur.pos % PER_ROW;
      const inRow = same.filter((s) => Math.floor(s.pos / PER_ROW) === row + dy);
      if (inRow.length) to = inRow[Math.min(col, inRow.length - 1)];
      else {
        // in die andere Gruppe
        const other = this.slots.filter((s) => s.group !== cur.group);
        const want = dy > 0 ? cur.group === 'pool' : cur.group === 'next';
        if (want && other.length) {
          const r = dy > 0 ? 0 : Math.floor(other[other.length - 1].pos / PER_ROW);
          const cand = other.filter((s) => Math.floor(s.pos / PER_ROW) === r);
          to = cand[Math.min(col, cand.length - 1)];
        }
      }
    }
    if (to && to !== cur) {
      audio.sfx('click');
      this.setFocus(this.slots.indexOf(to));
    }
  }

  private setFocus(k: number) {
    if (k === this.focus || !this.slots[k]) return;
    const prev = this.slots[this.focus];
    if (prev?.img.active) {
      prev.ring.setStrokeStyle(2, prev.group === 'next' ? 0xc8913c : 0x8aa0a8, 0);
      prev.img.setScale(0.62);
    }
    this.focus = k;
    const s = this.slots[k];
    s.ring.setStrokeStyle(2, s.group === 'next' ? 0xc8913c : 0x8aa0a8, 1);
    s.img.setScale(0.76);
    this.showCard(s);
    species.mark(s.egg.id ?? null);
  }

  /** Die Karte rechts: das ausgewachsene Tier aus diesem Ei, seine Höchstwerte und was die Wahl bedeutet. */
  private showCard(s: Slot) {
    const c = this.card;
    c.removeAll(true);
    this.portrait = undefined;
    const next = s.group === 'next';
    const list = next ? game.roe : game.pool;
    const pg = game.poolGen;
    const gen = s.egg.generation ?? (next ? pg + 1 : pg);
    c.add(this.add.rectangle(0, 0, 400, 560, 0x0c0e0e, 0.88).setStrokeStyle(2, next ? 0xc8913c : 0x4a5a5e, 0.9));
    c.add(text(this, 0, -258, `${next ? 'NEXT GENERATION' : pg > this.gen ? 'GENERATION ' + pg : 'SIBLINGS'} · EGG ${s.pos + 1} OF ${list.length}`, 14, next ? UI.ochre : UI.boneDim).setOrigin(0.5).setLetterSpacing(2));
    c.add(text(this, 0, -234, `Generation ${gen}`, 20, UI.bone).setOrigin(0.5));
    if (game.isLineageEvolution) { this.showLineageCard(s, gen, next); return; }
    // das Tier, das aus dem Ei schlüpft – ausgewachsen
    c.add(this.add.image(0, -112, 'glow').setDisplaySize(300, 150).setTint(next ? 0xf0c880 : 0x9ac0c8).setAlpha(.16).setBlendMode(Phaser.BlendModes.ADD));
    const v = new CreatureView(this, 0, -130, game.roeMorph(s.egg), 1.25);
    v.setDepth(DEPTH.player);
    c.add(v);
    this.portrait = v;
    c.add(text(this, -170, -60, 'Genes · fully grown', 13, '#6c6454'));
    c.add(text(this, 170, -60, 'your genes', 13, '#6c6454').setOrigin(1, 0));
    STATS.forEach(([k, name], j) => {
      const y = -32 + j * 32;
      const val = s.v[k], diff = val - this.mine[k];
      const top = k==='fins' && s.egg.finMutation===true;
      const col = top ? UI.ochre : undefined;
      c.add(text(this, -170, y, name, 17, col ?? UI.boneDim));
      c.add(text(this, 70, y, `${val}`, 19, col ?? UI.bone).setOrigin(1, 0));
      if (diff !== 0) c.add(text(this, 170, y, diff > 0 ? `+${diff}` : `−${-diff}`, 16, top ? UI.ochre : UI.boneDim).setOrigin(1, 0));
    });
    c.add(text(this, 0, 204, 'This egg\'s genes determine its traits.', 13, UI.boneDim, { wordWrap: { width: 350 }, align: 'center' }).setOrigin(0.5));
    const note=next?`This egg begins your life in generation ${gen}. Eggs from the previous generation are lost.`:'';
    if(note)c.add(text(this,0,224,note,15,UI.boneDim,{wordWrap:{width:350},align:'center'}).setOrigin(.5,0));
  }

  /** The egg already owns its inherited path; browsing it never advances the parent's lineage. */
  private showLineageCard(s: Slot, gen: number, next: boolean) {
    const c = this.card, evolution = readLineageEvolution(s.egg.evolution);
    const color = s.egg.breedingSite === 'water' ? '#8ac6c3' : s.egg.breedingSite === 'shore' ? '#e4c18d' : UI.boneDim;
    c.add(text(this, 0, -207, lineageFormName(lineageForm(evolution)), 17, UI.bone,
      { align: 'center', wordWrap: { width: 350 } }).setOrigin(.5));
    c.add(this.add.image(0, -136, 'glow').setDisplaySize(320, 122)
      .setTint(s.egg.breedingSite === 'water' ? 0x8ac6c3 : 0xe4c18d).setAlpha(.12).setBlendMode(Phaser.BlendModes.ADD));
    const view = new CreatureView(this, 0, -138, game.roeMorph(s.egg), 1.25).setName('roe-lineage-portrait');
    view.animate(0, 'idle', 0);
    const bounds = view.getBounds();
    view.setBaseScale(1.25 * Math.min(325 / Math.max(1, bounds.width), 88 / Math.max(1, bounds.height)));
    view.animate(0, 'idle', 0);
    const fitted = view.getBounds(); view.x -= fitted.centerX; view.y += -138 - fitted.centerY;
    c.add(view); this.portrait = view;
    const nursery = s.egg.breedingSite === 'water' ? 'WATER NURSERY' : s.egg.breedingSite === 'shore' ? 'SHORE NURSERY' : 'INHERITED LINEAGE';
    c.add(text(this, 0, -90, nursery, 11, color).setOrigin(.5).setLetterSpacing(2).setName('roe-nursery'));
    c.add(text(this, 0, -61, lineageSummary(evolution), 14, UI.boneDim,
      { align: 'center', wordWrap: { width: 346 } }).setOrigin(.5).setName('roe-evolution-progress'));
    const bars = this.add.graphics(); c.add(bars);
    const progress = evolution.habitat ? 3 : Math.abs(evolution.habitatProgress);
    for (let i = 0; i < 3; i++) bars.fillStyle(i < progress ? s.egg.breedingSite === 'water' ? 0x8ac6c3 : 0xe4c18d : 0x39433c, i < progress ? .85 : .45)
      .fillRoundedRect(-161 + i * 110, -31, 102, 3, 1);
    c.add(text(this, -170, -7, 'Inherited values · fully grown', 12, '#82918a'));
    c.add(text(this, 170, -7, 'change', 12, '#82918a').setOrigin(1, 0));
    const rows = STATS.filter(([key]) => key !== 'fins');
    rows.forEach(([key, name], i) => {
      const y = 18 + i * 28, value = s.v[key], delta = value - this.mine[key];
      c.add(text(this, -170, y, key === 'ram' ? 'Head armour' : name, 17, UI.boneDim));
      c.add(text(this, 70, y, String(value), 19, UI.bone).setOrigin(1, 0));
      if (delta) c.add(text(this, 170, y, delta > 0 ? `+${delta}` : `−${-delta}`, 16,
        delta > 0 ? '#9dc4ae' : '#c1947f').setOrigin(1, 0));
    });
    const hint = !evolution.habitat ? 'Three inherited nursery steps establish a body. Choosing an egg carries its own path forward.'
      : !evolution.tier ? 'The body is established. Inherited biting and ramming experience shape its next form.'
      : evolution.tier === 1 ? `Continued ${evolution.primary === 'bite' ? 'biting' : 'ramming'} refines this specialisation.`
      : 'Fully specialised. Both basic actions remain available.';
    c.add(text(this, 0, 174, hint, 13, UI.boneDim,
      { align: 'center', wordWrap: { width: 350 } }).setOrigin(.5));
    if (next) c.add(text(this, 0, 224, `Begin life in generation ${gen}. Eggs from the previous generation are lost.`, 14, UI.boneDim,
      { align: 'center', wordWrap: { width: 350 } }).setOrigin(.5, 0));
  }

  update(_t: number, delta: number) {
    this.portrait?.animate(delta / 1000, game.isLineageEvolution ? 'idle' : 'swim', game.isLineageEvolution ? 0 : .45);
  }

  /** Vor jedem Wechsel bestätigen, auch innerhalb derselben Generation. */
  private pick() {
    if (this.going) return;
    const s = this.slots[this.focus];
    if (!s) return;
    this.openConfirm(s);
  }

  private openConfirm(s: Slot) {
    if (this.confirm) return;
    audio.sfx('click');
    const pg = game.poolGen;
    const c = this.add.container(W / 2, H / 2).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setInteractive());
    c.add(this.add.rectangle(0, 0, 640, 300, 0x120c08, 0.96).setStrokeStyle(2, 0xa4322a, 0.9));
    const next = s.group === 'next';
    const heading = this.d.living ? 'END THIS LIFE?' : 'BEGIN YOUR NEXT LIFE?';
    c.add(this.add.text(0, -104, heading, { fontFamily: TITLE_FONT, fontSize: '24px', color: UI.bone, resolution: 2 }).setOrigin(0.5).setLetterSpacing(4));
    const gen = s.egg.generation ?? (next ? pg + 1 : pg);
    const ending = this.d.living ? 'Your current animal will not return. ' : '';
    const message=`${ending}You hatch in generation ${gen}. Changing generations discards the old generation's eggs for everyone.`;
    c.add(text(this, 0, -30, message, 17, '#d4c4a4', { wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    const yes = new Button(this, -130, 84, next ? `Begin generation ${gen}` : 'Hatch as a sibling', { w: 330, h: 50, size: 17, color: UI.ochreN, onClick: () => void this.hatch(s) });
    const no = new Button(this, 175, 84, 'Back', { w: 190, h: 50, size: 17, onClick: () => this.closeConfirm() });
    c.add([yes, no]);
    this.confirm = c;
    this.confirmBtns = [no, yes];
    this.confirmIdx = 0;
    no.setFocus(true);
    yes.setFocus(false);
  }

  private closeConfirm() {
    if (!this.confirm) return;
    this.confirm.destroy();
    this.confirm = undefined;
    this.confirmBtns = [];
  }

  /**
   * Das Ei schlüpft. Allein sofort; im Koop erst, wenn der Server es zuteilt (ein Artgenosse könnte es gerade genommen
   * haben). Beginnt damit für dich eine neue Generation, kommt der Einschnitt.
   */
  private async hatch(s: Slot) {
    if (this.going) return;
    this.going = true;
    this.closeConfirm();
    const before = game.life.gen;
    if (species.active && s.egg.id) {
      this.say('…', UI.boneDim);
      const r = await species.pick(s.egg.id);
      if (!this.scene.isActive()||this.ending||!game.run) return;
      if (!r) {
        this.going = false;
        this.build();
        this.say('Another player just took this egg.', '#e0b070');
        return;
      }
      if (this.d.living||this.d.watching) (this.scene.get('Level') as LevelScene).finishRoeVisit();
      game.hatchRoe(r.egg, r.gen);
    } else {
      const list = s.group === 'next' ? game.roe : game.pool;
      const index = s.egg.id ? list.findIndex((e) => e.id === s.egg.id) : list.indexOf(s.egg);
      if (index < 0) { this.going = false; this.build(); return; }
      if (this.d.living||this.d.watching) (this.scene.get('Level') as LevelScene).finishRoeVisit();
      if (!game.hatch(s.group, index)) { this.going = false; return; }
    }
    audio.sfx('laich');
    if (game.life.gen > before) {
      // die nächste Generation beginnt: der Einschnitt (Dunkelheit, die Generation, die Zeit)
      const data: SuccessionData = { epoch: this.d.epoch, cause: this.d.cause, gen: game.life.gen, years: this.d.years };
      fadeTo(this, 'Generation', data, 1000);
    } else fadeTo(this, 'Level', { epoch: this.d.epoch }, 1000);
  }

  /** Eine kurze Meldung über der Karte. */
  private say(msg: string, color: string) {
    this.flashMsg?.destroy();
    const t = text(this, 1010, 674, msg, 14, color,
      { align: 'center', wordWrap: { width: 356 } }).setOrigin(0.5);
    this.flashMsg = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 800, onComplete: () => t.destroy() });
  }

  /** Die gemeinsame Art ist ausgestorben (by: wer zuletzt starb – leer: du). */
  private extinct(by: string) {
    if (this.ending || !game.run) return;
    this.ending=true;this.going = true;
    if (this.d.living||this.d.watching) (this.scene.get('Level') as LevelScene).finishRoeVisit();
    const others = species.others;
    const data = speciesEnd(this.d.epoch, this.d.years, by, others, game.morph());
    fadeTo(this, 'Extinct', data, 1200);
  }
}
