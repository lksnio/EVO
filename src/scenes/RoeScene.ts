import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT, DEPTH } from '../config';
import { audio } from '../audio/Audio';
import { game, type RoeEgg, type RoeGroup } from '../state/GameState';
import { CreatureView } from '../objects/CreatureView';
import { Button, fadeIn, fadeTo, text } from '../ui/ui';
import { tex } from '../util/canvas';
import type { SuccessionData } from './LevelScene';

/**
 * Der Laich (Devon): Das eigene Tier ist gestorben – jetzt wählt man ein Ei, und das Tier daraus spielt man weiter.
 *   – Geschwister: Eier deiner Generation, die noch warten. Man bleibt in dieser Generation.
 *   – Nächste Generation: der Laich, den du und deine Geschwister gelegt habt. Wer daraus wählt, beginnt die nächste
 *     Generation – und kommt nie mehr zurück: Die übrigen Geschwister sind dann fort. Deshalb fragt die Szene noch einmal.
 * Jedes Ei zeigt, was in ihm steckt: das ausgewachsene Tier und seine Höchstwerte (Lebenskraft, Ausdauer, Gebiss, Stoß,
 * Tempo, Schuppen), daneben der Unterschied zu deinem Tier, das gerade gestorben ist.
 */
export interface RoeData {
  epoch: number;
  /** woran das Tier starb */
  cause: string;
  /** Weltzeit (Jahre vor heute) */
  years: number;
}

type StatKey = 'hp' | 'stam' | 'bite' | 'ram' | 'speed' | 'scales';
const STATS: [StatKey, string][] = [
  ['hp', 'Lebenskraft'],
  ['stam', 'Ausdauer'],
  ['bite', 'Gebiss'],
  ['ram', 'Stoß'],
  ['speed', 'Tempo'],
  ['scales', 'Schuppen'],
];
type Shown = Record<StatKey, number>;

/** so viele Eier je Reihe, höchstens zwei Reihen je Gruppe (der Rest steht als „+N“ da) */
const PER_ROW = 13;
const ROWS = 2;
const STEP = 50;

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
  private slots: Slot[] = [];
  private focus = -1;
  private gen = 0;
  /** dein Tier, das gerade gestorben ist (ausgewachsen) – daran messen sich die Eier */
  private mine!: Shown;
  /** die besten Werte je Gruppe (sie leuchten ocker – wenn die Eier sich darin überhaupt unterscheiden) */
  private best: Record<RoeGroup, Shown> = { pool: none(), next: none() };
  private low: Record<RoeGroup, Shown> = { pool: none(), next: none() };
  private card!: Phaser.GameObjects.Container;
  private portrait?: CreatureView;
  private confirm?: Phaser.GameObjects.Container;
  private confirmBtns: Button[] = [];
  private confirmIdx = 0;

  constructor() {
    super('Roe');
  }

  init(d: RoeData) {
    this.d = d;
    this.going = false;
    this.slots = [];
    this.focus = -1;
    this.confirm = undefined;
    this.confirmBtns = [];
    this.portrait = undefined;
  }

  create() {
    fadeIn(this, 900);
    this.cameras.main.setBackgroundColor('#04070a');
    audio.music('generation');
    const run = game.run;
    if (!run || (!game.pool.length && !game.roe.length)) {
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
    this.add.text(W / 2, 44, 'DER LAICH', { fontFamily: TITLE_FONT, fontSize: '30px', color: UI.bone, resolution: 2 }).setOrigin(0.5).setLetterSpacing(8);
    text(this, W / 2, 84, `${this.d.cause} – wähle ein Ei. Das Tier daraus spielst du weiter.`, 18, UI.boneDim).setOrigin(0.5);

    roeTexture(this);
    const pool = game.pool, roe = game.roe;
    for (const [g, list] of [['pool', pool], ['next', roe]] as [RoeGroup, RoeEgg[]][]) {
      const vs = list.map((e) => game.roeShown(e));
      this.best[g] = spanOf(vs, Math.max);
      this.low[g] = spanOf(vs, Math.min);
    }
    this.group('pool', 60, 128, pool,
      `GESCHWISTER · GENERATION ${this.gen}`,
      pool.length ? `${pool.length} ${pool.length === 1 ? 'Ei wartet' : 'Eier warten'} – du bleibst in Generation ${this.gen}` : this.gen <= 1 && !run.history.length ? 'Der Urfisch hat keine Geschwister.' : 'Keine Geschwister mehr.');
    this.group('next', 60, 388, roe,
      `NÄCHSTE GENERATION · GENERATION ${this.gen + 1}`,
      roe.length ? `${roe.length} ${roe.length === 1 ? 'Ei' : 'Eier'} aus eurem Laich – kein Weg zurück zu Generation ${this.gen}` : `Kein Laich – in Generation ${this.gen} hat noch niemand gelaicht.`);

    this.card = this.add.container(1010, 380);
    text(this, W / 2, H - 26, '← → ↑ ↓ wählen  ·  E, Eingabe oder Antippen: Das Ei schlüpft.', 16, UI.boneDim).setOrigin(0.5);

    const kb = this.input.keyboard!;
    const move = (dx: number, dy: number) => () => this.move(dx, dy);
    kb.on('keydown-LEFT', move(-1, 0));
    kb.on('keydown-A', move(-1, 0));
    kb.on('keydown-RIGHT', move(1, 0));
    kb.on('keydown-D', move(1, 0));
    kb.on('keydown-UP', move(0, -1));
    kb.on('keydown-W', move(0, -1));
    kb.on('keydown-DOWN', move(0, 1));
    kb.on('keydown-S', move(0, 1));
    const act = () => (this.confirm ? this.confirmBtns[this.confirmIdx]?.click() : this.pick());
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    kb.on('keydown-E', act);
    kb.on('keydown-ESC', () => this.closeConfirm());
    // zu Beginn: das stärkste Ei der Geschwister (sonst des Laichs)
    const start = this.slots.findIndex((s) => s.group === (pool.length ? 'pool' : 'next'));
    this.setFocus(Math.max(0, start));
  }

  /** Eine Gruppe: Überschrift, eine Zeile darunter, die Eier in bis zu zwei Reihen. */
  private group(g: RoeGroup, x: number, y: number, eggs: RoeEgg[], head: string, sub: string) {
    const next = g === 'next';
    this.add.rectangle(x - 16, y - 12, 720, 236, next ? 0x2a1a0c : 0x0e1a1e, next ? 0.55 : 0.5).setOrigin(0).setStrokeStyle(1, next ? 0x8a5a24 : 0x3a5058, 0.8);
    text(this, x, y, head, 17, next ? UI.ochre : UI.bone).setLetterSpacing(2);
    text(this, x, y + 26, sub, 15, eggs.length ? UI.boneDim : '#6c6454');
    const max = PER_ROW * ROWS;
    // die stärksten zuerst (gemessen an deinem Tier) – passen nicht alle ins Bild, fehlen die schwächsten
    const score = (v: Shown) => STATS.reduce((a, [k]) => a + v[k] / Math.max(1, this.mine[k]), 0);
    const order = eggs.map((egg, i) => ({ egg, i, v: game.roeShown(egg) })).sort((a, b) => score(b.v) - score(a.v));
    order.slice(0, max).forEach(({ egg, i, v }, pos) => {
      const ex = x + 22 + (pos % PER_ROW) * STEP;
      const ey = y + 90 + Math.floor(pos / PER_ROW) * 62;
      const ring = this.add.circle(ex, ey, 25, 0x000000, 0).setStrokeStyle(2, next ? 0xc8913c : 0x8aa0a8, 0);
      const img = this.add.image(ex, ey, 'roe_pick').setScale(0.62);
      if (next) img.setTint(0xffe2b0);
      const k = this.slots.length;
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => !this.confirm && this.setFocus(k));
      img.on('pointerdown', () => {
        if (this.confirm) return;
        this.setFocus(k);
        this.pick();
      });
      this.tweens.add({ targets: img, y: ey - 3, yoyo: true, repeat: -1, duration: 1500 + Math.random() * 900, delay: Math.random() * 800, ease: 'Sine.inOut' });
      this.slots.push({ group: g, i, pos, egg, img, ring, v });
    });
    if (eggs.length > max) text(this, x + 22 + PER_ROW * STEP - 30, y + 90 + 62 + 34, `+${eggs.length - max} schwächere`, 13, '#6c6454').setOrigin(1, 0.5);
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
    if (prev) {
      prev.ring.setStrokeStyle(2, prev.group === 'next' ? 0xc8913c : 0x8aa0a8, 0);
      prev.img.setScale(0.62);
    }
    this.focus = k;
    const s = this.slots[k];
    s.ring.setStrokeStyle(2, s.group === 'next' ? 0xc8913c : 0x8aa0a8, 1);
    s.img.setScale(0.76);
    this.showCard(s);
  }

  /** Die Karte rechts: das ausgewachsene Tier aus diesem Ei, seine Höchstwerte und was die Wahl bedeutet. */
  private showCard(s: Slot) {
    const c = this.card;
    c.removeAll(true);
    this.portrait = undefined;
    const next = s.group === 'next';
    const list = next ? game.roe : game.pool;
    const gen = next ? this.gen + 1 : this.gen;
    c.add(this.add.rectangle(0, 0, 400, 560, 0x0c0e0e, 0.88).setStrokeStyle(2, next ? 0xc8913c : 0x4a5a5e, 0.9));
    c.add(text(this, 0, -258, `${next ? 'NÄCHSTE GENERATION' : 'GESCHWISTER'} · EI ${s.pos + 1} VON ${list.length}`, 14, next ? UI.ochre : UI.boneDim).setOrigin(0.5).setLetterSpacing(2));
    c.add(text(this, 0, -234, `Generation ${gen}`, 20, UI.bone).setOrigin(0.5));
    // das Tier, das aus dem Ei schlüpft – ausgewachsen
    c.add(this.add.image(0, -112, 'glow').setDisplaySize(300, 150).setTint(next ? 0xf0c880 : 0x9ac0c8).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD));
    const v = new CreatureView(this, 0, -130, game.roeMorph(s.egg), 1.25);
    v.setDepth(DEPTH.player);
    c.add(v);
    this.portrait = v;
    c.add(text(this, -170, -60, 'ausgewachsen', 13, '#6c6454'));
    c.add(text(this, 170, -60, 'dein Tier', 13, '#6c6454').setOrigin(1, 0));
    STATS.forEach(([k, name], j) => {
      const y = -32 + j * 34;
      const val = s.v[k], diff = val - this.mine[k];
      const top = val === this.best[s.group][k] && val > this.low[s.group][k];
      c.add(text(this, -170, y, name, 17, top ? UI.ochre : UI.boneDim));
      c.add(text(this, 70, y, `${val}`, 19, top ? UI.ochre : UI.bone).setOrigin(1, 0));
      const dtxt = diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `−${-diff}`;
      c.add(text(this, 170, y, dtxt, 16, diff > 0 ? '#9cc488' : diff < 0 ? '#c87a6a' : '#6c6454').setOrigin(1, 0));
    });
    const note = next
      ? game.pool.length
        ? `Mit diesem Ei beginnt Generation ${gen}. Zu Generation ${this.gen} kommst du nie mehr zurück – ${game.pool.length === 1 ? 'das übrige Geschwister ist' : `die ${game.pool.length} übrigen Geschwister sind`} dann verloren.`
        : `Mit diesem Ei beginnt Generation ${gen}. Generation ${this.gen} ist zu Ende – es gibt kein Zurück.`
      : `Ein Geschwister: Du bleibst in Generation ${gen}${game.roe.length ? ' – euer Laich wartet weiter' : ''}.`;
    c.add(text(this, 0, 196, note, 15, next ? '#e0b070' : UI.boneDim, { wordWrap: { width: 350 }, align: 'center' }).setOrigin(0.5, 0));
  }

  update(_t: number, delta: number) {
    this.portrait?.animate(delta / 1000, 'swim', 0.45);
  }

  /** Das Ei schlüpfen lassen – wer in die nächste Generation geht, solange noch Geschwister warten, wird noch einmal gefragt. */
  private pick() {
    if (this.going) return;
    const s = this.slots[this.focus];
    if (!s) return;
    if (s.group === 'next' && game.pool.length) return this.openConfirm(s);
    this.hatch(s);
  }

  private openConfirm(s: Slot) {
    if (this.confirm) return;
    audio.sfx('click');
    const c = this.add.container(W / 2, H / 2).setDepth(50);
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setInteractive());
    c.add(this.add.rectangle(0, 0, 640, 300, 0x120c08, 0.96).setStrokeStyle(2, 0xa4322a, 0.9));
    c.add(this.add.text(0, -104, `GENERATION ${this.gen} VERLASSEN?`, { fontFamily: TITLE_FONT, fontSize: '24px', color: UI.bone, resolution: 2 }).setOrigin(0.5).setLetterSpacing(4));
    const n = game.pool.length;
    c.add(text(this, 0, -38, `Mit diesem Ei beginnt Generation ${this.gen + 1}. Du kommst nie mehr zu Generation ${this.gen} zurück – ${n === 1 ? 'das wartende Geschwister ist' : `die ${n} wartenden Geschwister sind`} dann für immer verloren.`, 17, '#e0b070', { wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    const yes = new Button(this, -130, 84, `Generation ${this.gen + 1} beginnen`, { w: 330, h: 50, size: 17, color: UI.bloodN, onClick: () => this.hatch(s) });
    const no = new Button(this, 175, 84, 'Zurück', { w: 190, h: 50, size: 17, onClick: () => this.closeConfirm() });
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

  private hatch(s: Slot) {
    if (this.going) return;
    this.going = true;
    const next = s.group === 'next';
    audio.sfx('laich');
    game.hatch(s.group, s.i);
    if (next) {
      // die nächste Generation beginnt: der Einschnitt (Dunkelheit, die Generation, die Zeit)
      const data: SuccessionData = { epoch: this.d.epoch, cause: this.d.cause, gen: game.life.gen, years: this.d.years };
      fadeTo(this, 'Generation', data, 1000);
    } else fadeTo(this, 'Level', { epoch: this.d.epoch }, 1000);
  }
}

const none = (): Shown => ({ hp: 0, stam: 0, bite: 0, ram: 0, speed: 0, scales: 0 });

/** Die höchsten (bzw. niedrigsten) Werte einer Gruppe. */
function spanOf(list: Shown[], f: (a: number, b: number) => number): Shown {
  const o = none();
  for (const [k] of STATS) o[k] = list.length ? list.map((v) => v[k]).reduce((a, b) => f(a, b)) : 0;
  return o;
}
