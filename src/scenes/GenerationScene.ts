import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { audio } from '../audio/Audio';
import { BODY_NAME, game, skillName, type Offspring, type SkillKey } from '../state/GameState';
import { CLASSES } from '../data/classes';
import { EPOCHS, spanWords, yearsAgo } from '../data/epochs';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import type { SurvivedData } from './LevelScene';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';

type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Sätze zwischen den Zeitaltern – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Generationen vergehen. Das Leben passt sich an.',
  'Nur wer überlebt, gibt etwas weiter.',
  'Langsam, kaum merklich, verändert sich deine Art.',
];

/**
 * Ein Zeitalter ist überstanden. Man sieht sein Tier "einst" und "heute", dazu die
 * Artgenossen, die mit überlebt haben. Dann vergehen Jahrmillionen – und manchmal nehmen
 * die Nachfahren eine neue Form an (Fisch → Lurch → …).
 */
export class GenerationScene extends Phaser.Scene {
  private d!: SurvivedData;
  private views: { v: CreatureView; mode: 'swim' | 'idle' }[] = [];
  private group: GO[] = [];
  private nav?: MenuNav;
  /** gewählter Nachwuchs (Index in d.offspring) */
  private sel = 0;
  private cards: { g: Phaser.GameObjects.Graphics; x: number; y: number; w: number; h: number }[] = [];
  private choosing = false;
  private zones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super('Generation');
  }

  init(d: SurvivedData) {
    this.d = d;
    this.views = [];
    this.group = [];
    this.nav = undefined;
    this.sel = 0;
    this.cards = [];
    this.choosing = false;
    this.zones = [];
  }

  create() {
    fadeIn(this, 900);
    audio.music('generation');
    const ep = EPOCHS[this.d.epoch];
    const [far] = levelBackgrounds(this, ep.theme, 'normal');
    this.add.image(0, 0, far).setOrigin(0).setTint(0x8a8a8a);
    this.add.rectangle(0, 0, W, H, 0x050403, 0.55).setOrigin(0);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setAlpha(0.9);
    this.add.particles(0, 0, 'p_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 6000, frequency: 160,
      speedY: { min: -12, max: -3 }, speedX: { min: -6, max: 6 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0, end: 0.5, ease: 'Sine.inOut' }, tint: 0xd8c8a0,
    });
    if (this.d.offspring?.length) this.choose();
    else this.survived();
  }

  update(_t: number, dms: number) {
    for (const { v, mode } of this.views) v.animate(dms / 1000, mode, mode === 'swim' ? 0.35 : 0);
  }

  private look(o: { cls?: Morph['cls']; traits?: SurvivedData['traits']; seed?: number; sex?: number } = {}): Morph {
    const d = this.d;
    return game.morph({ cls: o.cls ?? d.cls, traits: o.traits ?? d.traits, hue: d.look.hue, seed: o.seed ?? d.look.seed, sex: o.sex ?? d.look.sex, fierce: 0 });
  }

  // ---------------------------------------------------------------- Nachwuchs wählen

  /**
   * Wer hat überlebt – und wer soll die Linie weiterführen? Jede Karte zeigt nur, was man sich
   * erspielt hat (dazu immer Größe und Tempo). Jeder Überlebende betont etwas anderes.
   */
  private choose() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const offs = d.offspring!;
    this.choosing = true;
    const head = title(this, W / 2, 34, `Das ${ep.name} endet.`, 38).setOrigin(0.5);
    const sub = text(this, W / 2, 76, `Du hast überlebt – ${yearsAgo(ep.to, 1e4)}. Welcher Nachkomme führt deine Linie weiter?`, 20, UI.boneDim).setOrigin(0.5);
    const e = d.eaten;
    const eat = e ? text(this, W / 2, 104, `Gefressen: ${Math.round(e.meat)} kcal Fleisch · ${Math.round(e.plant)} kcal Pflanzen  (nötig waren ${Math.round(e.need)})`, 16, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5) : null;
    this.fadeInAll([head, sub, ...(eat ? [eat] : [])], 0);
    this.group.push(head, sub, ...(eat ? [eat] : []));

    const n = offs.length;
    const cw = Math.min(196, Math.floor((W - 80 - (n - 1) * 14) / n)), gap = 14, ch = 420;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y0 = 126;
    const base = offs[0];
    offs.forEach((o, i) => {
      const x = x0 + i * (cw + gap);
      const parts = this.card(o, base, x, y0, cw, ch, i);
      this.fadeInAll(parts, 300 + i * 160, 1, 600);
      this.group.push(...parts);
    });
    this.select(0);
    // Je mehr gefressen wurde, desto weiter weichen die Nachkommen von der Hauptlinie ab
    const fed = e ? (e.meat + e.plant) / Math.max(1, e.need) : 1;
    const variety = fed < 1.4 ? 'gering' : fed < 2.2 ? 'mittel' : 'groß';
    const l1 = text(this, W / 2, y0 + ch + 18, `Vielfalt des Nachwuchses: ${variety} (je mehr du frisst, desto verschiedener)  ·  Pfeiltasten oder Klick`, 17, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([l1], 900);
    const tl = this.timeline(d.epoch, 612);
    this.fadeInAll(tl, 1000, 1, 700);
    this.group.push(l1, ...tl);
    const kb = this.input.keyboard!;
    const mv = (dx: number) => () => this.choosing && this.select((this.sel + dx + n) % n);
    kb.on('keydown-LEFT', mv(-1));
    kb.on('keydown-RIGHT', mv(1));
    kb.on('keydown-A', mv(-1));
    kb.on('keydown-D', mv(1));
    kb.on('keydown-ENTER', () => this.choosing && this.confirm());
    kb.on('keydown-SPACE', () => this.choosing && this.confirm());
    this.time.delayedCall(1200, () => {
      const b = new Button(this, W / 2, H - 34, 'Weiter', { w: 240, h: 48, icon: 'ic_play', color: UI.ochreN, onClick: () => this.choosing && this.confirm() });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
    });
  }

  /** Eine Karte: das Tier, wofür es steht, und seine erspielten Werte als Punkte. */
  private card(o: Offspring, base: Offspring, x: number, y: number, w: number, h: number, i: number): GO[] {
    const d = this.d;
    const out: GO[] = [];
    const g = this.add.graphics();
    out.push(g);
    this.cards.push({ g, x, y, w, h });
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (!this.choosing) return;
      if (this.sel === i) this.confirm();
      else this.select(i);
    });
    this.zones.push(zone);
    // das Tier selbst
    const m = this.look({ traits: o.traits, seed: o.seed, sex: o.sex });
    const v = new CreatureView(this, x + w / 2, 0, m, 1);
    const sc = Math.min(1.75, (w - 22) / (v.L.halfW * 2), 112 / Math.max(1, v.L.footY - v.L.topY));
    v.setBaseScale(sc);
    v.setY(v.L.land ? y + 130 - v.L.footY * sc : y + 72);
    this.views.push({ v, mode: v.L.land ? 'idle' : 'swim' });
    out.push(v);
    let ty = y + 140;
    const t1 = title(this, x + w / 2, ty, o.label, 19, o.main ? UI.bone : UI.ochre).setOrigin(0.5, 0);
    ty += 26;
    const extra = o.focus.body ? BODY_NAME[o.focus.body] : o.main ? 'wie bisher' : '';
    const t2 = text(this, x + w / 2, ty, `${o.sex === 1 ? 'Männchen' : 'Weibchen'}${extra ? ' · ' + extra : ''}`, 14, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5, 0);
    ty += 28;
    out.push(t1, t2);
    // Werte: immer Größe und Tempo, dazu nur Erspieltes
    const st = game.stats(d.transition?.to ?? d.cls, o.traits), st0 = game.stats(d.transition?.to ?? d.cls, base.traits);
    const sizeV = (s: number) => (s - 0.68) / 0.77;
    const cls = d.transition?.to ?? d.cls;
    const tempo = (sp: number) => Math.min(1, Math.max(0.05, 0.5 + (sp / CLASSES[cls].base.speed - 1) * 1.6));
    const rows: [string, number, number][] = [
      ['Größe', sizeV(st.size), sizeV(st0.size)],
      ['Tempo', tempo(st.speed), tempo(st0.speed)],
    ];
    for (const k of ['jaw', 'skull', 'stealth', 'green', 'sand'] as SkillKey[]) {
      if (o.traits[k] >= 0.03 || base.traits[k] >= 0.03) rows.push([skillName(k, o.traits), o.traits[k], base.traits[k]]);
    }
    for (const [label, val, ref] of rows.slice(0, 7)) {
      out.push(text(this, x + 12, ty, label, 15, UI.boneDim));
      out.push(this.pips(x + w - 12, ty + 9, val, val > ref + 0.04, val < ref - 0.04));
      ty += 24;
    }
    const meas = game.measure(d.transition?.to ?? d.cls, o.traits);
    const len = meas.cm >= 100 ? `${(meas.cm / 100).toFixed(2).replace('.', ',')} m` : `${Math.round(meas.cm)} cm`;
    const wt = meas.g >= 1000 ? `${(meas.g / 1000).toFixed(1).replace('.', ',')} kg` : `${Math.round(meas.g)} g`;
    const diet = o.traits.diet > 0.3 ? 'Fleischfresser' : o.traits.diet < -0.3 ? 'Pflanzenfresser' : 'Allesfresser';
    out.push(text(this, x + w / 2, y + h - 46, `${len} · ${wt}`, 15, UI.bone).setOrigin(0.5, 0));
    out.push(text(this, x + w / 2, y + h - 24, diet, 14, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5, 0));
    return out;
  }

  /** Fünf Punkte (auch halbe) für einen Wert; besser als beim eigenen Tier = ockerfarben, schwächer = gedämpft. */
  private pips(xr: number, y: number, v: number, better: boolean, worse: boolean) {
    const g = this.add.graphics();
    const halves = Math.max(v > 0.02 ? 1 : 0, Math.min(10, Math.round(v * 10)));
    const col = better ? 0xe0a848 : worse ? 0x8a7a64 : 0xe6dcc4;
    for (let i = 0; i < 5; i++) {
      const cx = xr - (4 - i) * 13 - 5;
      g.lineStyle(1.3, 0x6a5638, 0.9);
      g.strokeCircle(cx, y, 4.2);
      const fill = halves - i * 2;
      g.fillStyle(col, 1);
      if (fill >= 2) g.fillCircle(cx, y, 4.6);
      else if (fill === 1) {
        g.beginPath();
        g.arc(cx, y, 4.6, Math.PI / 2, Math.PI * 1.5);
        g.closePath();
        g.fillPath();
      }
    }
    return g;
  }

  private select(i: number) {
    this.sel = i;
    this.cards.forEach((c, k) => {
      const on = k === i;
      c.g.clear();
      c.g.fillStyle(on ? 0x2a2016 : 0x120e0a, on ? 0.92 : 0.8);
      c.g.fillRoundedRect(c.x, c.y, c.w, c.h, 12);
      c.g.lineStyle(on ? 3 : 1.5, on ? 0xe0a848 : 0x6a5638, on ? 1 : 0.6);
      c.g.strokeRoundedRect(c.x, c.y, c.w, c.h, 12);
    });
    if (this.cards.length) audio.sfx('click');
  }

  /** Die Wahl steht: Dieses Tier führt die Linie weiter. */
  private confirm() {
    const d = this.d;
    const o = d.offspring![this.sel];
    this.choosing = false;
    audio.sfx('select');
    this.zones.forEach((z) => z.destroy());
    this.zones = [];
    game.chooseOffspring(o);
    d.drifted = o.traits;
    d.look = { ...d.look, seed: o.seed, sex: o.sex };
    this.next();
  }

  /** Ein Tier auf einem Felssockel (an Land) bzw. schwebend mit Schatten (im Wasser). */
  private creature(m: Morph, x: number, groundY: number, scale: number): [CreatureView, Phaser.GameObjects.Image] {
    const land = m.cls !== 'fish';
    const base = land
      ? this.add.image(x, groundY + 6, 'pedestal').setScale(scale * 0.62, 0.8)
      : this.add.image(x, groundY - 10, 'shadow').setScale(scale * 1.1, 1).setAlpha(0.5);
    const v = new CreatureView(this, x, 0, m, scale);
    v.setY(land ? groundY - v.L.footY * scale : groundY - 70);
    this.views.push({ v, mode: land ? 'idle' : 'swim' });
    return [v, base];
  }

  private fadeInAll(targets: GO[], delay: number, to = 1, ms = 900) {
    for (const o of targets) {
      const a = o instanceof Phaser.GameObjects.Image && o.texture.key === 'shadow' ? 0.5 * to : to;
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: a, duration: ms, delay });
    }
  }

  // ---------------------------------------------------------------- Überlebt

  private survived() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const head = title(this, W / 2, 70, `Das ${ep.name} endet.`, 42).setOrigin(0.5);
    const sub = text(this, W / 2, 120, `Du hast überlebt – ${yearsAgo(ep.to, 1e4)}.`, 21, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);

    const mBefore = this.look({ traits: d.before });
    const mNow = this.look();
    const changed = morphKey(mBefore) !== morphKey(mNow);
    const gy = 430, scale = 2;
    const [left, lb] = this.creature(mBefore, W * 0.27, gy, scale);
    // deine Artgenossen stehen hinter dir
    const kinViews: GO[] = [];
    d.kinLooks.forEach((m, i) => {
      const x = W * 0.73 + (i % 2 ? 1 : -1) * (90 + Math.floor(i / 2) * 60);
      const kv = new CreatureView(this, x, 0, { ...m, fierce: 0 }, 1.15);
      kv.setY(kv.L.land ? gy - 30 - kv.L.footY * 1.15 : gy - 110 + i * 24);
      kv.setFacing(i % 2 ? -1 : 1);
      this.views.push({ v: kv, mode: kv.L.land ? 'idle' : 'swim' });
      kinViews.push(kv);
    });
    const [right, rb] = this.creature(mNow, W * 0.73, gy, scale);
    const lt = text(this, W * 0.27, gy + 42, 'Einst', 22, UI.boneDim).setOrigin(0.5);
    const rt = text(this, W * 0.73, gy + 42, 'Heute', 22, UI.bone).setOrigin(0.5);
    const arrow = title(this, W / 2, gy - 60, '›', 64, UI.ochre).setOrigin(0.5);
    this.fadeInAll([left, lb, lt], 600, 0.75);
    this.fadeInAll(kinViews, 1300, 0.55);
    this.fadeInAll([right, rb, rt], 1500);
    this.fadeInAll([arrow], 1200, 0.8, 600);
    this.tweens.add({ targets: arrow, x: W / 2 + 10, yoyo: true, repeat: -1, duration: 900, delay: 1800, ease: 'Sine.inOut' });

    const k = d.kinAlive;
    const kinLine = k === 0 ? 'Von deiner Art hat niemand außer dir überlebt.' : k === 1 ? 'Einer deiner Art hat mit dir überlebt.' : `${k} deiner Art haben mit dir überlebt.`;
    const line = changed ? LINES[(d.epoch * 3 + k) % LINES.length] : 'Das Leben geht weiter.';
    const l1 = text(this, W / 2, 520, kinLine, 21, UI.bone).setOrigin(0.5);
    const l2 = text(this, W / 2, 552, line, 21, UI.boneDim, { fontStyle: 'italic' }).setOrigin(0.5);
    this.fadeInAll([l1], 2100);
    this.fadeInAll([l2], 2500);
    if (changed) this.time.delayedCall(1500, () => audio.sfx('evolve'));
    const tl = this.timeline(d.epoch, 600);
    this.fadeInAll(tl, 2200, 1, 700);
    this.group.push(head, sub, left, lb, lt, right, rb, rt, arrow, l1, l2, ...kinViews, ...tl);

    this.time.delayedCall(2400, () => {
      const b = new Button(this, W / 2, H - 36, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => this.next() });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
      this.nav = new MenuNav(this, [b]);
    });
  }

  /** Zeitleiste: überlebte Zeitalter, das nächste – und dahinter nur Fragezeichen. */
  private timeline(done: number, y: number): GO[] {
    const out: GO[] = [];
    const n = EPOCHS.length;
    const x0 = W / 2 - 300, w = 600;
    const g = this.add.graphics();
    g.lineStyle(2, 0x3a332c, 1);
    g.lineBetween(x0, y, x0 + w, y);
    g.lineStyle(2, 0xc8913c, 0.9);
    g.lineBetween(x0, y, x0 + (w * done) / (n - 1), y);
    out.push(g);
    EPOCHS.forEach((ep, i) => {
      const x = x0 + (w * i) / (n - 1);
      const passed = i <= done;
      g.fillStyle(passed ? 0xc8913c : 0x2a2420, 1);
      g.fillCircle(x, y, passed ? 5 : 4);
      const known = i <= game.data.deepest;
      if (i === done) out.push(text(this, x, y + 10, ep.name, 13, UI.ochre).setOrigin(0.5, 0));
      else if (i === done + 1 && known) out.push(text(this, x, y + 10, ep.name, 13, UI.boneDim).setOrigin(0.5, 0));
      else if (i > done && !known) out.push(title(this, x, y + 10, '?', 13, '#5e554a').setOrigin(0.5, 0));
    });
    return out;
  }

  private next() {
    if (this.nav) this.nav.enabled = false;
    const d = this.d;
    if (d.finished) return fadeTo(this, 'Ending', { node: d.node, morph: this.look() }, 1000);
    const old = this.group;
    this.group = [];
    this.tweens.add({
      targets: old,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        old.forEach((o) => o.destroy());
        this.views = [];
        this.timeJump();
      },
    });
  }

  /**
   * Jahrmillionen vergehen – die Uhr rast bis zum nächsten Zeitalter. Was sich im Zeitalter
   * bewährt hat, setzt sich dabei fort: Je mehr Zeit vergeht, desto deutlicher verändert sich die Art.
   */
  private timeJump() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const nx = EPOCHS[d.epoch + 1];
    const gap = ep.to - nx.from;
    const head = title(this, W / 2, 150, `${spanWords(gap)} vergehen …`, 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(ep.to, 1e5), 26, UI.bone).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    audio.sfx('evolve');

    // dein Tier, während die Zeit vergeht
    const mNow = this.look({ traits: d.traits });
    const mLater = d.drifted ? this.look({ traits: d.drifted }) : mNow;
    const gy = 520, scale = 1.8;
    const [v1, b1] = this.creature(mNow, W / 2, gy, scale);
    const parts: GO[] = [v1, b1];
    this.fadeInAll([v1, b1], 200, 1, 700);
    if (morphKey(mLater) !== morphKey(mNow)) {
      const [v2] = this.creature(mLater, W / 2, gy, scale);
      v2.setAlpha(0);
      parts.push(v2);
      const glow = this.add.image(W / 2, gy - 70, 'glow').setScale(3.4).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      parts.push(glow);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 900, delay: 900, yoyo: true, hold: 600 });
      this.tweens.add({ targets: v1, alpha: 0, duration: 1100, delay: 1300 });
      this.tweens.add({ targets: v2, alpha: 1, duration: 1100, delay: 1300 });
    }

    const c = { y: ep.to };
    this.tweens.add({
      targets: c,
      y: nx.from,
      duration: 2600,
      ease: 'Sine.inOut',
      onUpdate: () => clock.setText(yearsAgo(c.y, Math.max(1, gap / 200))),
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: [head, clock, ...parts],
            alpha: 0,
            duration: 600,
            onComplete: () => {
              head.destroy();
              clock.destroy();
              parts.forEach((o) => o.destroy());
              this.views = [];
              if (d.transition) this.transform();
              else fadeTo(this, 'Level', { epoch: d.epoch + 1 }, 900);
            },
          });
        });
      },
    });
  }

  /** Die Nachfahren nehmen eine neue Form an. */
  private transform() {
    const d = this.d;
    const tr = d.transition!;
    const gy = 470, scale = 2.3;
    const [from, fb] = this.creature(this.look({ cls: tr.from, traits: d.drifted }), W / 2, gy, scale);
    this.fadeInAll([from, fb], 0, 1, 800);
    const head = title(this, W / 2, 86, 'Die Zeit vergeht …', 44).setOrigin(0.5);
    this.fadeInAll([head], 0);
    audio.sfx('evolve');
    const glow = this.add.image(W / 2, gy - 90, 'glow').setScale(5).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.55, duration: 1800, delay: 600, ease: 'Sine.in' });
    this.tweens.add({ targets: from, x: W / 2 + 3, yoyo: true, repeat: 18, duration: 60, delay: 1400 });
    this.time.delayedCall(2600, () => {
      this.cameras.main.flash(900, 230, 214, 180);
      from.destroy();
      fb.destroy();
      this.views = [];
      const [to] = this.creature(this.look({ cls: tr.to, traits: d.drifted }), W / 2, gy, scale);
      const s = { k: 0.9 };
      to.setBaseScale(scale * s.k);
      this.tweens.add({ targets: s, k: 1, duration: 900, ease: 'Back.out', onUpdate: () => to.setBaseScale(scale * s.k) });
      this.tweens.add({ targets: glow, alpha: 0.15, duration: 1600 });
      head.setText(CLASSES[tr.to].name);
      const dawn = text(this, W / 2, 140, CLASSES[tr.to].dawn, 23, UI.bone, { align: 'center', lineSpacing: 6 }).setOrigin(0.5, 0);
      this.fadeInAll([dawn], 400, 1, 1200);
      this.time.delayedCall(2200, () => {
        const b = new Button(this, W / 2, H - 36, 'Weiter', { w: 240, h: 50, icon: 'ic_play', color: UI.ochreN, onClick: () => fadeTo(this, 'Level', { epoch: d.epoch + 1 }, 900) });
        this.nav = new MenuNav(this, [b]);
      });
    });
  }
}
