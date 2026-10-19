import Phaser from 'phaser';
import { FONT, TITLE_FONT, UI } from '../config';
import { audio, type Sfx } from '../audio/Audio';
import { tex, type Ctx } from '../util/canvas';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size = 22,
  color: string = UI.bone,
  opts: Phaser.Types.GameObjects.Text.TextStyle = {},
) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: '500',
    resolution: 2,
    ...opts,
  });
}

/** Überschrift wie in Stein gemeißelt. */
export function title(scene: Phaser.Scene, x: number, y: number, str: string, size = 40, color: string = UI.bone) {
  return scene.add.text(x, y, str, {
    fontFamily: TITLE_FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: '700',
    stroke: '#050403',
    strokeThickness: Math.max(3, size / 9),
    shadow: { offsetX: 0, offsetY: 3, color: 'rgba(0,0,0,.6)', blur: 6, fill: true, stroke: true },
    resolution: 2,
  });
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.82, color: number = UI.panel, radius = 14) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 3, y + 6, w, h, radius);
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, UI.panelEdge, 0.55);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, radius);
  g.lineStyle(1, 0xffffff, 0.05);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, radius - 3));
  return g;
}

/** Die Tasten des Spiels – für die Seite "Steuerung" (Titelbild und Rast). */
export const CONTROL_ROWS: [string, string][] = [
  ['← ↑ → ↓', 'Schwimmen'],
  ['E  (auch Q oder J)', 'Beißen und Fressen – zur Laichzeit: laichen'],
  ['W  (auch Shift)', 'Sprinten – kostet Kraft'],
  ['R', 'Stoß – Anlauf nehmen, dann den Schwung nutzen'],
  ['F  (auch Eingabe)', 'Ansprechen – und im Gespräch weiter'],
  ['S', 'Deine Gruppe rufen bzw. fortschicken'],
  ['Leertaste', 'Auftauchen'],
  ['(nichts tun)', 'Ausruhen – sich treiben lassen'],
  ['C', 'Übersicht über dein Tier'],
  ['Esc  oder  P', 'Rast (Pause)'],
  ['M', 'Ton an/aus'],
];

/** Zeichnet die Steuerung als Liste in einen Container. */
export function controlsList(scene: Phaser.Scene, c: Phaser.GameObjects.Container, cx: number, y0: number, size = 22, step = 36) {
  CONTROL_ROWS.forEach(([k, v], i) => {
    c.add(text(scene, cx - 330, y0 + i * step, k, size, UI.ochre, { fontStyle: '700' }));
    c.add(text(scene, cx - 20, y0 + i * step, v, size, UI.bone));
  });
}

export interface ButtonOpts {
  w?: number;
  h?: number;
  size?: number;
  color?: number;
  icon?: string;
  iconOnly?: boolean;
  sound?: Sfx | null;
  onClick: () => void;
}

/** Die Art eines Knopfes: Stein (gewöhnlich), Bernstein (die wichtigste Wahl) oder Blut (Vorsicht). */
type Plate = 'stone' | 'amber' | 'blood';
const plateOf = (c: number): Plate => (c === UI.ochreN ? 'amber' : c === UI.bloodN ? 'blood' : 'stone');

/** Maße der Knopf-Platten (in Bildpunkten der Textur, doppelt so fein gezeichnet wie dargestellt) */
const PLATE = { w: 72, h: 52, corner: 12, res: 2 };
const GLOW = { w: 120, h: 100, corner: 34 };

/** Ein Rechteck mit abgeschrägten Ecken – wie aus Stein geschlagen. */
function chamfer(ctx: Ctx, x: number, y: number, w: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * Die Platten der Knöpfe: dunkler Stein mit abgeschrägten Ecken, oben ein Hauch Licht, innen eine feine helle Linie, außen
 * ein Rand in Ocker – je Art eine ruhige und eine angewählte (hellere) Fassung. Dazu ein weiches Glühen und kleine Zierknöpfe.
 */
export function buttonTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('btn_stone')) return;
  const { w: W, h: H } = PLATE;
  const kinds: Record<Plate, [string, string, string][]> = {
    // [oben, unten, Rand] – ruhig und angewählt
    stone: [['#231e19', '#0e0c0a', 'rgba(198,150,82,0.42)'], ['#2f271e', '#14100c', 'rgba(236,190,112,0.95)']],
    amber: [['#6a461c', '#2c1a0a', 'rgba(226,176,96,0.8)'], ['#83582a', '#38220d', 'rgba(255,218,146,1)']],
    blood: [['#561a14', '#220907', 'rgba(210,110,90,0.7)'], ['#6e2219', '#2c0b08', 'rgba(242,146,120,1)']],
  };
  for (const [kind, looks] of Object.entries(kinds) as [Plate, [string, string, string][]][]) {
    looks.forEach(([top, bot, edge], lit) => {
      tex(scene, `btn_${kind}${lit ? '_hi' : ''}`, W, H, (ctx) => {
        chamfer(ctx, 1, 1, W - 2, H - 2, 8);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, top);
        g.addColorStop(0.55, bot);
        g.addColorStop(1, bot);
        ctx.fillStyle = g;
        ctx.fill();
        // oben fällt ein wenig Licht auf die Platte
        ctx.save();
        chamfer(ctx, 1, 1, W - 2, H - 2, 8);
        ctx.clip();
        const l = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        l.addColorStop(0, `rgba(255,236,200,${lit ? 0.14 : 0.08})`);
        l.addColorStop(1, 'rgba(255,236,200,0)');
        ctx.fillStyle = l;
        ctx.fillRect(0, 0, W, H * 0.5);
        ctx.restore();
        // innen eine feine helle Linie, außen der Rand
        chamfer(ctx, 4.5, 4.5, W - 9, H - 9, 5.5);
        ctx.strokeStyle = `rgba(255,236,200,${lit ? 0.16 : 0.07})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        chamfer(ctx, 1.5, 1.5, W - 3, H - 3, 8);
        ctx.strokeStyle = edge;
        ctx.lineWidth = lit ? 1.6 : 1.2;
        ctx.stroke();
      }, PLATE.res);
    });
  }
  // das Glühen um einen angewählten Knopf
  tex(scene, 'btn_glow', GLOW.w, GLOW.h, (ctx) => {
    ctx.filter = 'blur(7px)';
    chamfer(ctx, 26, 26, GLOW.w - 52, GLOW.h - 52, 9);
    ctx.strokeStyle = 'rgba(232,176,92,0.9)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }, PLATE.res);
  // ein kleiner Zierknopf (Raute) an den Seiten
  tex(scene, 'btn_stud', 12, 12, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 1);
    ctx.lineTo(11, 6);
    ctx.lineTo(6, 11);
    ctx.lineTo(1, 6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 1, 0, 11);
    g.addColorStop(0, '#f2d49a');
    g.addColorStop(1, '#8a5a24');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,12,4,0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }, PLATE.res);
}

/** Eine Platte (als Neunteiler) in Darstellungsgröße w × h. */
function plateImage(scene: Phaser.Scene, key: string, w: number, h: number, corner = PLATE.corner) {
  const r = PLATE.res;
  return scene.add.nineslice(0, 0, key, undefined, w * r, h * r, corner * r, corner * r, corner * r, corner * r).setScale(1 / r);
}

export class Button extends Phaser.GameObjects.Container {
  readonly bw: number;
  readonly bh: number;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  color: number;
  focused = false;
  disabled = false;
  private hover = false;
  private opts: ButtonOpts;
  private plate!: Phaser.GameObjects.NineSlice;
  private plateHi!: Phaser.GameObjects.NineSlice;
  private glow: Phaser.GameObjects.NineSlice;
  private shadow: Phaser.GameObjects.NineSlice;
  private studs: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, opts: ButtonOpts) {
    super(scene, x, y);
    buttonTextures(scene);
    this.opts = opts;
    this.bw = opts.w ?? 220;
    this.bh = opts.h ?? 54;
    this.color = opts.color ?? UI.stone;
    const w = this.bw, h = this.bh;
    // Schatten und Glühen liegen unter der Platte
    this.shadow = plateImage(scene, 'btn_glow', w + 40, h + 40, GLOW.corner).setTint(0x000000).setAlpha(0.55).setPosition(0, 4);
    this.glow = plateImage(scene, 'btn_glow', w + 40, h + 40, GLOW.corner).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.add([this.shadow, this.glow]);
    this.makePlates();
    const size = opts.size ?? 22;
    let tx = 0;
    if (opts.icon) {
      const isz = opts.iconOnly ? Math.min(this.bw, this.bh) * 0.54 : size * 1.15;
      this.icon = scene.add.image(opts.iconOnly ? 0 : -this.bw / 2 + 20 + isz / 2, 0, opts.icon).setDisplaySize(isz, isz).setTint(0xf0e4c8);
      this.add(this.icon);
      tx = opts.iconOnly ? 0 : isz / 2 + 4;
    }
    this.label = scene.add.text(tx, 0, opts.iconOnly ? '' : str, {
      fontFamily: TITLE_FONT,
      fontSize: `${size}px`,
      color: '#e9dfc6',
      fontStyle: '700',
      shadow: { offsetX: 0, offsetY: 2, color: 'rgba(0,0,0,.7)', blur: 4, fill: true },
      resolution: 2,
    }).setOrigin(0.5).setLetterSpacing(size >= 18 ? 2 : 1);
    this.add(this.label);
    // zwei kleine Zierknöpfe an den Seiten (nicht bei kleinen Symbol-Knöpfen)
    if (!opts.iconOnly && w >= 150) {
      for (const sx of [-1, 1]) {
        const st = scene.add.image(sx * (w / 2 - 0.5), 0, 'btn_stud').setScale(0.5).setAlpha(0.75);
        this.studs.push(st);
        this.add(st);
      }
    }
    this.setSize(this.bw, this.bh);
    // Trefferfläche: bei Containern liegt (0,0) oben links
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerover', () => {
      this.hover = true;
      if (!this.disabled) audio.sfx('hover');
      this.draw();
    });
    this.on('pointerout', () => {
      this.hover = false;
      this.draw();
    });
    this.on('pointerdown', () => this.click());
    scene.add.existing(this);
    this.draw(true);
  }

  /** Die Platten nach der Art des Knopfes (ruhig und angewählt übereinander). */
  private makePlates() {
    this.plate?.destroy();
    this.plateHi?.destroy();
    const kind = plateOf(this.color);
    this.plate = plateImage(this.scene, `btn_${kind}`, this.bw, this.bh);
    this.plateHi = plateImage(this.scene, `btn_${kind}_hi`, this.bw, this.bh).setAlpha(0);
    this.addAt([this.plate, this.plateHi], 2);
  }

  click() {
    if (this.disabled || !this.visible) {
      audio.sfx('fail');
      return;
    }
    if (this.opts.sound !== null) audio.sfx(this.opts.sound ?? (plateOf(this.color) === 'amber' ? 'confirm' : 'click'));
    this.scene.tweens.add({ targets: this, scale: { from: 0.95, to: 1 }, duration: 160, ease: 'Back.out' });
    // ein kurzes Aufleuchten
    this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.9, to: this.focused ? 0.5 : 0 }, duration: 380, ease: 'Sine.out' });
    this.opts.onClick();
  }

  setFocus(f: boolean) {
    this.focused = f;
    this.draw();
    return this;
  }

  setDisabled(d: boolean) {
    this.disabled = d;
    this.draw();
    return this;
  }

  setLabel(s: string) {
    this.label.setText(s);
    return this;
  }

  setIcon(key: string) {
    this.icon?.setTexture(key);
    return this;
  }

  setColor(c: number) {
    if (plateOf(c) !== plateOf(this.color)) {
      this.color = c;
      this.makePlates();
    }
    this.color = c;
    this.draw(true);
    return this;
  }

  private draw(now = false) {
    const lit = (this.hover || this.focused) && !this.disabled;
    const tw = this.scene.tweens;
    const set = (o: { setAlpha(a: number): unknown }, a: number, ms: number) => {
      tw.killTweensOf(o);
      if (now) o.setAlpha(a);
      else tw.add({ targets: o, alpha: a, duration: ms, ease: 'Sine.out' });
    };
    set(this.plateHi, lit ? 1 : 0, 140);
    set(this.glow, this.disabled ? 0 : this.focused ? 0.5 : this.hover ? 0.22 : 0, 220);
    this.plate.setAlpha(this.disabled ? 0.55 : 1);
    this.label.setColor(lit ? '#fff4dc' : '#e9dfc6').setAlpha(this.disabled ? 0.4 : 1);
    this.icon?.setAlpha(this.disabled ? 0.4 : 1).setTint(lit ? 0xfff4dc : 0xe6d8b8);
    for (const st of this.studs) st.setAlpha(this.disabled ? 0.3 : lit ? 1 : 0.7);
  }
}

/** Was sich mit der Tastatur anwählen lässt: Knöpfe, Menüzeilen … */
export interface NavItem {
  disabled: boolean;
  visible: boolean;
  click(): void;
  setFocus(f: boolean): unknown;
}

/** Tastatursteuerung für eine Liste von Knöpfen. */
export class MenuNav {
  idx = 0;
  enabled = true;
  constructor(
    scene: Phaser.Scene,
    public items: NavItem[],
    cols = 1,
    private onBack?: () => void,
  ) {
    const kb = scene.input.keyboard!;
    const move = (d: number) => () => this.enabled && this.move(d);
    kb.on('keydown-UP', move(-cols));
    kb.on('keydown-DOWN', move(cols));
    kb.on('keydown-W', move(-cols));
    kb.on('keydown-S', move(cols));
    kb.on('keydown-LEFT', move(-1));
    kb.on('keydown-RIGHT', move(1));
    kb.on('keydown-A', move(-1));
    kb.on('keydown-D', move(1));
    const act = () => this.enabled && this.items[this.idx]?.click();
    kb.on('keydown-ENTER', act);
    kb.on('keydown-SPACE', act);
    if (onBack) kb.on('keydown-ESC', () => this.enabled && this.onBack?.());
    this.focus(0);
  }

  focus(i: number) {
    this.idx = Math.max(0, Math.min(this.items.length - 1, i));
    this.items.forEach((b, k) => b.setFocus(k === this.idx));
  }

  private move(d: number) {
    if (!this.items.length) return;
    let i = this.idx;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + d + this.items.length) % this.items.length;
      if (!this.items[i].disabled && this.items[i].visible) break;
    }
    if (i !== this.idx) audio.sfx('click');
    this.focus(i);
  }
}

/** Kleiner Ton-an/aus-Knopf mit Symbol. */
export function soundButton(scene: Phaser.Scene, x: number, y: number, size = 50) {
  const b = new Button(scene, x, y, '', {
    w: size, h: size, icon: audio.muted ? 'ic_mute' : 'ic_sound', iconOnly: true, sound: null,
    onClick: () => toggleMute(),
  });
  const upd = () => b.setIcon(audio.muted ? 'ic_mute' : 'ic_sound');
  muteListeners.add(upd);
  b.once('destroy', () => muteListeners.delete(upd));
  return b;
}

/** Ton an/aus als schlichtes Symbol, ohne Knopf darum (für das Titelbild). */
export function soundIcon(scene: Phaser.Scene, x: number, y: number, size = 30) {
  const key = () => (audio.muted ? 'ic_mute' : 'ic_sound');
  const img = scene.add.image(x, y, key()).setDisplaySize(size, size).setAlpha(0.5).setInteractive({ useHandCursor: true });
  img.on('pointerover', () => img.setAlpha(0.95));
  img.on('pointerout', () => img.setAlpha(0.5));
  img.on('pointerdown', () => toggleMute());
  const upd = () => img.setTexture(key()).setDisplaySize(size, size);
  muteListeners.add(upd);
  img.once('destroy', () => muteListeners.delete(upd));
  return img;
}

const muteListeners = new Set<() => void>();
let onMuteChange: (m: boolean) => void = () => {};

export function setMuteHandler(fn: (m: boolean) => void) {
  onMuteChange = fn;
}

export function toggleMute() {
  audio.setMuted(!audio.muted);
  if (!audio.muted) audio.sfx('select');
  onMuteChange(audio.muted);
  muteListeners.forEach((f) => f());
}

/** Langsame Überblendung zur nächsten Szene. */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 420) {
  const cam = scene.cameras.main;
  if (!scene.input.enabled) return;
  scene.input.enabled = false;
  if (scene.input.keyboard) scene.input.keyboard.enabled = false;
  cam.fadeOut(ms, 2, 3, 4);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene, ms = 420) {
  scene.input.enabled = true;
  if (scene.input.keyboard) scene.input.keyboard.enabled = true;
  scene.cameras.main.fadeIn(ms, 2, 3, 4);
}
