import Phaser from 'phaser';
import { W, H, UI, TITLE_FONT } from '../config';
import { audio } from '../audio/Audio';
import { game, PLATE_NAME, type Offspring, type PlateId } from '../state/GameState';
import { CLASSES } from '../data/classes';
import { EPOCHS, spanWords, yearsAgo } from '../data/epochs';
import { STAT_COUNT } from '../data/tablet';
import { levelBackgrounds } from '../art/worldArt';
import { morphKey, type Morph } from '../art/creatureArt';
import { CreatureView } from '../objects/CreatureView';
import type { SurvivedData } from './LevelScene';
import { Tablet, carved, INK } from '../ui/tablet';
import { Button, MenuNav, fadeIn, fadeTo, text, title } from '../ui/ui';

type GO = Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown };

/** Was die gewählte Platte über den Körper erzählt – ohne Zahlen. */
const PLATE_TEXT: Record<PlateId, string> = {
  st: 'Ein harter Schädel mit Kopfplatte, große Seitenflossen – deine Nachkommen stoßen zu und wenden blitzschnell.',
  bs: 'Ein tiefer Kiefer voller Zähne – deine Nachkommen beißen kräftig zu, sind aber schwerfälliger.',
  vf: 'Lang, schlank, mit kräftiger Schwanzflosse – deine Nachkommen holen fast jede Beute ein.',
  sw: 'Silbrig, schlank, ein dunkles Band an der Flanke – deine Nachkommen leben und jagen im Schwarm.',
};

/** Was auf den Evolutionsplatten unter dem Tier steht: was sie bringen und was sie kosten. */
const PLATE_INFO: Record<PlateId, { pro: string; con: string }> = {
  st: { pro: '+ wendiger, Kopfplatte, kräftiger Stoß', con: '– etwas langsamer, ermüdet schneller' },
  bs: { pro: '+ mehr Kraft, starkes Gebiss, Reißzähne', con: '– langsamer, ermüdet schneller' },
  vf: { pro: '+ schneller, große Flossen, ausdauernd', con: '– weniger Lebenskraft, schwacher Stoß' },
  sw: { pro: '+ größerer, stärkerer Schwarm', con: '– allein verletzlicher, Beute wird geteilt' },
};

/** Maße der Evolutionsplatten (drei bzw. – mit dem Schwarmfisch – vier nebeneinander) und wo auf ihnen die Zeilen beginnen. */
const plateSize = (n: number) => (n > 3 ? { w: 300, h: 580, gap: 12, y: 92, rowsTop: 0.41, title: 20 } : { w: 392, h: 580, gap: 22, y: 92, rowsTop: 0.41, title: 24 });

/** Sätze zwischen den Zeitaltern – sie verraten nichts über das System dahinter. */
const LINES = [
  'Was du gelebt hast, tragen deine Nachkommen weiter.',
  'Die Zeit formt dich – Stück für Stück.',
  'Generationen vergehen. Das Leben passt sich an.',
  'Nur wer überlebt, gibt etwas weiter.',
  'Langsam, kaum merklich, verändert sich deine Art.',
];

/**
 * Ein Zeitalter ist überstanden. Zuerst wählt man eine der drei Evolutionsplatten – sie bestimmt, wohin sich die
 * nächste Generation entwickelt. Dann sieht man sein Tier "einst" und "heute", dazu die Artgenossen, die mit überlebt
 * haben. Dann vergehen Jahrmillionen – und manchmal nehmen die Nachfahren eine neue Form an (Fisch → Lurch → …).
 */
export class GenerationScene extends Phaser.Scene {
  private d!: SurvivedData;
  private views: { v: CreatureView; mode: 'swim' | 'idle' }[] = [];
  private group: GO[] = [];
  private nav?: MenuNav;
  /** die drei Evolutionsplatten (gewählt ist sel); dim: Schatten über den nicht gewählten */
  private plates: { c: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Image; dim: Phaser.GameObjects.Rectangle; v: CreatureView; y: number; hover: boolean; lift?: Phaser.Tweens.Tween }[] = [];
  private sel = 0;
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
    this.plates = [];
    this.sel = 0;
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

  /**
   * So sieht das Tier nach der Verwandlung aus. Verwandelt wird nur ein einziges Mal je Zeitalter: auf dem ersten Bild
   * ("Einst" → "Heute"). Danach bleibt die neue Gestalt, wie sie ist. Wechselt auch die Körperform (Fisch → Lurch), ist
   * das die Verwandlung – dann zeigt der erste Bildschirm noch die alte Gestalt.
   */
  private after() {
    const d = this.d;
    return d.transition ? d.traits : d.drifted ?? d.traits;
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

  // ---------------------------------------------------------------- Evolutionsplatten

  /**
   * Drei Steinplatten wie die Tafel (Taste C): oben der Nachkomme, wie er aussehen würde, darunter seine Werte. Was die
   * Muscheln schon freigelegt haben, steht da – mit einem Pfeil, ob es mehr oder weniger würde; der Rest liegt unter Moos,
   * nur die Pfeile schimmern durch. Wie stark sich die Platte ausprägt, zeigen die Fische bei „Ausprägung“ (die Spielweise).
   */
  private choose() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const offs = d.offspring!;
    this.choosing = true;
    const where = ep.habitat === 'water' ? 'die Meere' : 'das Land';
    const [h1, h2] = d.bossBeaten
      ? [`${d.boss} ist besiegt.`, 'Wohin entwickelt sich deine Linie in der neuen Zeit?']
      : d.repeat
        ? ['Eine Generation vergeht.', `${d.boss ?? 'Der Herrscher'} beherrscht noch ${where}. Wohin entwickelt sich deine Linie?`]
        : [`Das ${ep.name} endet.`, 'Du hast überlebt. Wohin entwickelt sich deine Linie?'];
    const head = title(this, W / 2, 36, h1, 36).setOrigin(0.5);
    const sub = text(this, W / 2, 72, h2, 19, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);
    this.group.push(head, sub);

    const n = offs.length;
    const PLATE = plateSize(n);
    const x0 = W / 2 - (n * PLATE.w + (n - 1) * PLATE.gap) / 2;
    const cls = d.transition?.to ?? d.cls;
    const unlocked = Math.min(STAT_COUNT, game.shells.length);
    // erst alle Tiere bauen, dann ein gemeinsamer Maßstab – so lassen sich Größe und Körperbau direkt vergleichen
    const views = offs.map((o) => new CreatureView(this, 0, 0, this.look({ cls, traits: o.traits, seed: o.seed, sex: o.sex }), 1));
    const maxW = Math.max(...views.map((v) => v.L.halfW * 3.9));
    const maxH = Math.max(...views.map((v) => v.L.footY - v.L.topY));
    const sc = Math.min(2.4, (PLATE.w - 90) / maxW, 96 / maxH);
    offs.forEach((o, i) => {
      const card = this.plate(o, views[i], sc, x0 + i * (PLATE.w + PLATE.gap), PLATE.y, i, unlocked, PLATE);
      this.fadeInAll([card], 250 + i * 160, 1, 650);
      this.group.push(card, this.plates[i].glow);
    });
    // vorgewählt ist die Platte, die am besten zur Spielweise passte
    this.select(Math.max(0, offs.findIndex((o) => o.plate === d.line)), true);
    const kb = this.input.keyboard!;
    const mv = (dx: number) => () => this.choosing && this.select((this.sel + dx + n) % n);
    kb.on('keydown-LEFT', mv(-1));
    kb.on('keydown-RIGHT', mv(1));
    kb.on('keydown-A', mv(-1));
    kb.on('keydown-D', mv(1));
    kb.on('keydown-ENTER', () => this.choosing && this.confirm());
    kb.on('keydown-SPACE', () => this.choosing && this.confirm());
    this.time.delayedCall(1100, () => {
      if (!this.choosing) return;
      const b = new Button(this, W / 2, H - 27, 'Wählen', { w: 240, h: 40, icon: 'ic_play', color: UI.ochreN, onClick: () => this.choosing && this.confirm() });
      this.fadeInAll([b], 0, 1, 500);
      this.group.push(b);
    });
  }

  /** Eine Evolutionsplatte: Name, Vor- und Nachteile, der Nachkomme, seine Ausprägung und darunter die Werte. */
  private plate(o: Offspring, v: CreatureView, sc: number, x: number, y: number, i: number, unlocked: number, PLATE: ReturnType<typeof plateSize>) {
    const d = this.d;
    const { w, h } = PLATE;
    const info = PLATE_INFO[o.plate];
    const glow = this.add.image(x + w / 2, y + h / 2, 'glow').setDisplaySize(w * 1.7, h * 1.35).setTint(0xe0a848).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const c = this.add.container(x, y);
    const tab = new Tablet(this, 0, 0, w, h, { cls: v.m.cls, traits: o.traits }, unlocked, {
      mini: true, rowsTop: PLATE.rowsTop, base: { cls: d.cls, traits: d.traits }, seed: 11 + i * 4,
    });
    c.add(tab);
    c.add(this.add.text(w / 2, 50, PLATE_NAME[o.plate], { fontFamily: TITLE_FONT, fontSize: `${PLATE.title}px`, color: INK, fontStyle: '700', shadow: { offsetX: 1, offsetY: 1, color: 'rgba(255,246,225,0.34)', blur: 0, fill: true }, resolution: 2 }).setOrigin(0.5));
    // der Nachkomme – schwebend über einem Schatten im Stein
    c.add(this.add.image(w / 2, 178, 'shadow').setDisplaySize(w * 0.5, 14).setAlpha(0.35));
    v.setPosition(w / 2, 130);
    v.setBaseScale(sc);
    v.setFacing(1);
    c.add(v);
    this.views.push({ v, mode: v.L.land ? 'idle' : 'swim' });
    const lx = w * 0.07 + 2;
    c.add(this.add.text(lx, 192, info.pro, carved(11.5)).setOrigin(0, 0.5));
    c.add(this.add.text(lx, 208, info.con, carved(11.5)).setOrigin(0, 0.5));
    // Ausprägung: Mit passender Spielweise wird die Platte deutlicher (ein Fisch: schwach … drei: stark)
    c.add(this.add.text(lx, 225, 'Ausprägung', carved(11.5)).setOrigin(0, 0.5));
    const strong = 1 + (o.fit >= 0.3 ? 1 : 0) + (o.fit >= 0.65 ? 1 : 0);
    const fw = 15, fh = fw * (24 / 36);
    for (let k = 0; k < 3; k++) c.add(this.add.image(w - lx - (2 - k) * (fw + 3) - fw / 2, 225, k < strong ? 'fish_on' : 'fish_off').setDisplaySize(fw, fh));
    // nicht gewählte Platten treten in den Schatten zurück
    const dim = this.add.rectangle(0, 0, w, h, 0x050403, 0).setOrigin(0);
    c.add(dim);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (!this.choosing) return;
      if (this.sel === i) this.confirm();
      else this.select(i);
    });
    zone.on('pointerover', () => {
      this.plates[i].hover = true;
      this.select(this.sel, true);
    });
    zone.on('pointerout', () => {
      this.plates[i].hover = false;
      this.select(this.sel, true);
    });
    this.zones.push(zone);
    this.plates.push({ c, glow, dim, v, y, hover: false });
    return c;
  }

  /** Die gewählte Platte leuchtet warm und hebt sich etwas; die anderen treten in den Schatten zurück. */
  private select(i: number, quiet = false) {
    const changed = this.sel !== i;
    this.sel = i;
    this.plates.forEach((p, k) => {
      const on = k === i;
      this.tweens.killTweensOf([p.glow, p.dim]);
      this.tweens.add({ targets: p.glow, alpha: on ? 0.3 : p.hover ? 0.1 : 0, duration: 260 });
      this.tweens.add({ targets: p.dim, alpha: on ? 0 : p.hover ? 0.12 : 0.3, duration: 260 });
      // nur das Anheben neu starten – das Einblenden der Platte läuft weiter
      p.lift?.stop();
      p.lift = this.tweens.add({ targets: p.c, y: p.y - (on ? 8 : 0), duration: 260, ease: 'Sine.out' });
    });
    if (changed && !quiet) audio.sfx('click');
  }

  /** Die Wahl steht: Dieser Nachkomme führt die Linie weiter. Dann zeigt sich, wie er sich vom Tier „einst“ unterscheidet. */
  private confirm() {
    const d = this.d;
    const o = d.offspring![this.sel];
    this.choosing = false;
    audio.sfx('select');
    this.zones.forEach((z) => z.destroy());
    this.zones = [];
    game.chooseOffspring(o);
    d.drifted = o.traits;
    d.line = o.plate;
    d.look = { ...d.look, seed: o.seed, sex: o.sex };
    const p = this.plates[this.sel];
    this.tweens.add({ targets: p.glow, alpha: 0.55, duration: 200, yoyo: true });
    const old = this.group;
    this.group = [];
    this.time.delayedCall(450, () => {
      this.tweens.add({
        targets: old,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          old.forEach((g) => g.destroy());
          this.plates = [];
          this.views = [];
          this.survived();
        },
      });
    });
  }

  // ---------------------------------------------------------------- Überlebt

  private survived() {
    const d = this.d;
    const ep = EPOCHS[d.epoch];
    const where = ep.habitat === 'water' ? 'die Meere' : 'das Land';
    const [h1, h2] = d.bossBeaten
      ? [`${d.boss} ist besiegt.`, `Ein letztes Mal im ${ep.name} – dann beginnt eine neue Zeit.`]
      : d.repeat
        ? ['Eine Generation vergeht.', `${d.boss ?? 'Der Herrscher'} beherrscht noch ${where}.`]
        : [`Das ${ep.name} endet.`, `Du hast überlebt – ${yearsAgo(d.years ?? ep.to, 1e4)}.`];
    const head = title(this, W / 2, 70, h1, 42).setOrigin(0.5);
    const sub = text(this, W / 2, 120, h2, 21, UI.boneDim).setOrigin(0.5);
    this.fadeInAll([head, sub], 0);

    const mBefore = this.look({ traits: d.before });
    const mNow = this.look({ traits: this.after() });
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
    const rt = text(this, W * 0.73, gy + 42, d.line ? `Heute · ${PLATE_NAME[d.line]}` : 'Heute', 22, UI.bone).setOrigin(0.5);
    const arrow = title(this, W / 2, gy - 60, '›', 64, UI.ochre).setOrigin(0.5);
    this.fadeInAll([left, lb, lt], 600, 0.75);
    this.fadeInAll(kinViews, 1300, 0.55);
    this.fadeInAll([right, rb, rt], 1500);
    this.fadeInAll([arrow], 1200, 0.8, 600);
    // die Verwandlung: ein warmes Aufleuchten hinter dem neuen Tier
    const glow = this.add.image(W * 0.73, gy - 70, 'glow').setScale(3.6).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    if (changed) this.tweens.add({ targets: glow, alpha: 0.45, duration: 700, delay: 1450, yoyo: true, hold: 300 });
    this.group.push(glow);
    this.tweens.add({ targets: arrow, x: W / 2 + 10, yoyo: true, repeat: -1, duration: 900, delay: 1800, ease: 'Sine.inOut' });

    const k = d.kinAlive;
    const kinLine = k === 0 ? '' : k === 1 ? 'Einer deiner Art hat mit dir überlebt.' : `${k} deiner Art haben mit dir überlebt.`;
    const line = d.line ? PLATE_TEXT[d.line] : changed ? LINES[(d.epoch * 3 + k) % LINES.length] : 'Das Leben geht weiter.';
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
    if (d.repeat) return this.generationPass();
    const ep = EPOCHS[d.epoch];
    const nx = EPOCHS[d.epoch + 1];
    const t0 = d.years ?? ep.to;
    const gap = t0 - nx.from;
    const head = title(this, W / 2, 150, `${spanWords(gap)} vergehen …`, 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(t0, 1e5), 26, UI.bone).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    audio.sfx('evolve');

    // dein Tier, während die Zeit vergeht – schon in der neuen Gestalt (die Verwandlung war auf dem Bild davor)
    const gy = 520, scale = 1.8;
    const [v1, b1] = this.creature(this.look({ traits: this.after() }), W / 2, gy, scale);
    const parts: GO[] = [v1, b1];
    this.fadeInAll([v1, b1], 200, 1, 700);

    const c = { y: t0 };
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

  /** Der Endgegner lebt noch: Die Linie bleibt im Zeitalter – eine Generation später geht es weiter. */
  private generationPass() {
    const d = this.d;
    const span = game.epochSpan(d.epoch);
    const head = title(this, W / 2, 150, 'Eine neue Generation …', 38).setOrigin(0.5);
    const clock = text(this, W / 2, 214, yearsAgo(span.from, 1e4), 26, UI.bone).setOrigin(0.5);
    this.fadeInAll([head, clock], 0, 1, 600);
    audio.sfx('evolve');
    const gy = 540, scale = 1.8;
    const [v1, b1] = this.creature(this.look({ traits: this.after() }), W / 2, gy, scale);
    const parts: GO[] = [head, clock, v1, b1];
    this.fadeInAll([v1, b1], 200, 1, 700);
    this.time.delayedCall(3400, () => {
      this.tweens.add({
        targets: parts,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          parts.forEach((o) => o.destroy());
          this.views = [];
          fadeTo(this, 'Level', { epoch: d.epoch }, 900);
        },
      });
    });
  }

  /**
   * Die Nachfahren nehmen eine neue Form an: Der Lebensraum wechselt (Wasser → Ufer …), das Tier
   * flackert zwischen alter und neuer Gestalt – immer schneller –, bis die neue bleibt.
   */
  private transform() {
    const d = this.d;
    const tr = d.transition!;
    const nx = EPOCHS[d.epoch + 1];
    const gy = 480, scale = 2.3;
    // neuer Lebensraum blendet sich langsam über den alten
    const [farNext] = levelBackgrounds(this, nx.theme, 'normal');
    const bgNext = this.add.image(0, 0, farNext).setOrigin(0).setTint(0x9a9a9a).setAlpha(0);
    this.children.sendToBack(bgNext);
    this.children.moveUp(bgNext);
    const head = title(this, W / 2, 86, 'Die Zeit vergeht …', 44).setOrigin(0.5);
    this.fadeInAll([head], 0);
    const [from, fb] = this.creature(this.look({ cls: tr.from, traits: d.traits }), W / 2 - 140, gy, scale);
    const [to, tb] = this.creature(this.look({ cls: tr.to, traits: d.drifted }), W / 2, gy, scale);
    to.setAlpha(0);
    tb.setAlpha(0);
    from.setAlpha(0);
    fb.setAlpha(0);
    this.tweens.add({ targets: [from], alpha: 1, duration: 800 });
    this.tweens.add({ targets: [fb], alpha: 0.5, duration: 800 });
    // das Tier zieht zur Mitte, während Wasser zu Ufer wird
    this.tweens.add({ targets: [from, fb], x: W / 2, duration: 2200, ease: 'Sine.inOut', delay: 300 });
    this.tweens.add({ targets: bgNext, alpha: 1, duration: 3800, delay: 600, ease: 'Sine.inOut' });
    audio.sfx('evolve');
    const glow = this.add.image(W / 2, gy - 90, 'glow').setScale(5).setTint(0xe6d0a0).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 2000, delay: 1600, ease: 'Sine.in' });
    // Funken, die zum Tier hin wirbeln
    const sparks = this.add.particles(W / 2, gy - 80, 'p_dot', {
      emitting: false, lifespan: 1100, speed: { min: 40, max: 140 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffe8b0, 0xe0a848, 0xfff4dc], blendMode: 'ADD', frequency: 40, quantity: 2,
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 150), quantity: 48 },
    });
    this.time.delayedCall(2200, () => sparks.start());
    // Flackern zwischen alter und neuer Gestalt, immer schneller
    let t = 2600;
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1);
      const dur = 420 - 330 * k;
      const showNew = i % 2 === 0;
      this.time.delayedCall(t, () => {
        from.setAlpha(showNew ? 0.15 + 0.25 * (1 - k) : 1);
        to.setAlpha(showNew ? 0.55 + 0.45 * k : 0.15 + 0.35 * k);
        to.setShade(showNew ? null : 0x3a3a3a);
        from.setShade(showNew ? 0x3a3a3a : null);
        if (i % 4 === 0) audio.sfx('click');
      });
      t += dur;
    }
    this.time.delayedCall(t, () => {
      sparks.stop();
      this.cameras.main.flash(900, 230, 214, 180);
      audio.sfx('evolve');
      from.destroy();
      fb.destroy();
      this.views = this.views.filter((x) => x.v !== from);
      to.setAlpha(1).setShade(null);
      this.tweens.add({ targets: tb, alpha: 1, duration: 600 });
      const burst = this.add.particles(W / 2, gy - 80, 'p_dot', {
        emitting: false, lifespan: 1400, speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 }, tint: [0xffe8b0, 0xe0a848], blendMode: 'ADD',
      });
      burst.explode(60);
      const s = { k: 0.88 };
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
