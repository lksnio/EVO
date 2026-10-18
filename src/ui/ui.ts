import Phaser from 'phaser';
import { FONT, TITLE_FONT, UI } from '../config';
import { audio, type Sfx } from '../audio/Audio';

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
  ['E  (auch Q oder J)', 'Beißen und Fressen'],
  ['W  (auch Shift)', 'Sprinten – kostet Kraft'],
  ['R', 'Stoß – Anlauf nehmen, dann den Schwung nutzen'],
  ['F  (auch Eingabe)', 'Ansprechen – und im Gespräch weiter'],
  ['Leertaste', 'Auftauchen'],
  ['(nichts tun)', 'Ausruhen – sich treiben lassen'],
  ['C', 'Steintafel mit Werten und Hunger'],
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

export class Button extends Phaser.GameObjects.Container {
  readonly bw: number;
  readonly bh: number;
  private bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  color: number;
  focused = false;
  disabled = false;
  private hover = false;
  private opts: ButtonOpts;

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.bw = opts.w ?? 220;
    this.bh = opts.h ?? 54;
    this.color = opts.color ?? UI.stone;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    const size = opts.size ?? 22;
    let tx = 0;
    if (opts.icon) {
      const isz = opts.iconOnly ? Math.min(this.bw, this.bh) * 0.58 : size * 1.2;
      this.icon = scene.add.image(opts.iconOnly ? 0 : -this.bw / 2 + 18 + isz / 2, 0, opts.icon).setDisplaySize(isz, isz);
      this.add(this.icon);
      tx = opts.iconOnly ? 0 : isz / 2 + 4;
    }
    this.label = scene.add.text(tx, 0, opts.iconOnly ? '' : str, {
      fontFamily: TITLE_FONT,
      fontSize: `${size}px`,
      color: UI.bone,
      fontStyle: '700',
      stroke: '#050403',
      strokeThickness: 3,
      resolution: 2,
    }).setOrigin(0.5);
    this.add(this.label);
    this.setSize(this.bw, this.bh);
    // Trefferfläche: bei Containern liegt (0,0) oben links
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerover', () => {
      this.hover = true;
      this.draw();
    });
    this.on('pointerout', () => {
      this.hover = false;
      this.draw();
    });
    this.on('pointerdown', () => this.click());
    scene.add.existing(this);
    this.draw();
  }

  click() {
    if (this.disabled || !this.visible) {
      audio.sfx('fail');
      return;
    }
    if (this.opts.sound !== null) audio.sfx(this.opts.sound ?? 'click');
    this.scene.tweens.add({ targets: this, scale: { from: 0.94, to: 1 }, duration: 140, ease: 'Back.out' });
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
    this.color = c;
    this.draw();
    return this;
  }

  private draw() {
    const g = this.bg;
    const w = this.bw, h = this.bh, r = Math.min(10, h / 2);
    const c = this.disabled ? 0x1c1a18 : this.color;
    const lit = this.hover || this.focused;
    const col = Phaser.Display.Color.IntegerToColor(c);
    const lighten = (k: number) => Phaser.Display.Color.GetColor(Math.min(255, col.red * k), Math.min(255, col.green * k), Math.min(255, col.blue * k));
    g.clear();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
    g.fillStyle(lighten(0.6), 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 2, w, h, r);
    g.fillStyle(lit ? lighten(1.35) : c, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 2, r);
    g.fillStyle(0xffffff, lit ? 0.08 : 0.04);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.38, { tl: r - 2, tr: r - 2, bl: 3, br: 3 });
    g.lineStyle(this.focused ? 3 : 1.5, this.focused ? 0xc8913c : 0x8a7454, this.focused ? 1 : 0.55);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h - 2, r);
    this.label.setAlpha(this.disabled ? 0.4 : 1);
    this.icon?.setAlpha(this.disabled ? 0.4 : 1);
  }
}

/** Tastatursteuerung für eine Liste von Knöpfen. */
export class MenuNav {
  idx = 0;
  enabled = true;
  constructor(
    scene: Phaser.Scene,
    public items: Button[],
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
