import Phaser from 'phaser';
import { FONT } from '../config';
import { audio, type Sfx } from '../audio/Audio';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size = 24,
  color = '#ffffff',
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

/** Text mit dunklem Rand – gut lesbar auf jedem Hintergrund. */
export function title(scene: Phaser.Scene, x: number, y: number, str: string, size = 40, color = '#ffffff') {
  return text(scene, x, y, str, size, color, {
    fontStyle: '700',
    stroke: '#0b1a2e',
    strokeThickness: Math.max(4, size / 7),
    shadow: { offsetX: 0, offsetY: 3, color: 'rgba(0,0,0,.35)', blur: 4, fill: true, stroke: true },
  });
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.72, color = 0x0d2238, radius = 18) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(x + 3, y + 5, w, h, radius);
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, 0xffffff, 0.18);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, radius);
  return g;
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
    this.bh = opts.h ?? 56;
    this.color = opts.color ?? 0xf08a24;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    const size = opts.size ?? 24;
    let tx = 0;
    if (opts.icon) {
      const isz = opts.iconOnly ? Math.min(this.bw, this.bh) * 0.62 : size * 1.25;
      this.icon = scene.add.image(opts.iconOnly ? 0 : -this.bw / 2 + 18 + isz / 2, 0, opts.icon).setDisplaySize(isz, isz);
      this.add(this.icon);
      tx = opts.iconOnly ? 0 : isz / 2 + 4;
    }
    this.label = text(scene, tx, 0, opts.iconOnly ? '' : str, size, '#ffffff', {
      fontStyle: '700',
      stroke: 'rgba(0,0,0,.35)',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add(this.label);
    this.setSize(this.bw, this.bh);
    this.setInteractive(new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);
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
    this.scene.tweens.add({ targets: this, scale: { from: 0.92, to: 1 }, duration: 140, ease: 'Back.out' });
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
    const w = this.bw, h = this.bh, r = Math.min(16, h / 2);
    const c = this.disabled ? 0x5a6470 : this.color;
    const lit = this.hover || this.focused;
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, r);
    const col = Phaser.Display.Color.IntegerToColor(c);
    const dark = Phaser.Display.Color.GetColor(col.red * 0.7, col.green * 0.7, col.blue * 0.7);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, r);
    const top = lit ? Phaser.Display.Color.GetColor(Math.min(255, col.red + 35), Math.min(255, col.green + 35), Math.min(255, col.blue + 35)) : c;
    g.fillStyle(top, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 3, r);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.38, { tl: r - 3, tr: r - 3, bl: 4, br: 4 });
    if (this.focused) {
      g.lineStyle(4, 0xffffff, 0.95);
      g.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, r + 2);
    }
    this.label.setAlpha(this.disabled ? 0.6 : 1);
    this.icon?.setAlpha(this.disabled ? 0.6 : 1);
  }
}

/** Tastatursteuerung für eine Liste von Knöpfen. */
export class MenuNav {
  idx = 0;
  enabled = true;
  constructor(
    private scene: Phaser.Scene,
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
    void this.scene;
  }
}

/** Kleiner Ton-an/aus-Knopf mit Symbol. */
export function soundButton(scene: Phaser.Scene, x: number, y: number, size = 52) {
  const b = new Button(scene, x, y, '', {
    w: size, h: size, icon: audio.muted ? 'ic_mute' : 'ic_sound', iconOnly: true, color: 0x2f6f9f, sound: null,
    onClick: () => {
      toggleMute();
    },
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

/** Weiche Überblendung zur nächsten Szene. */
export function fadeTo(scene: Phaser.Scene, key: string, data?: object, ms = 280) {
  const cam = scene.cameras.main;
  if (!scene.input.enabled) return;
  scene.input.enabled = false;
  if (scene.input.keyboard) scene.input.keyboard.enabled = false;
  cam.fadeOut(ms, 5, 12, 22);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene, ms = 280) {
  scene.input.enabled = true;
  if (scene.input.keyboard) scene.input.keyboard.enabled = true;
  scene.cameras.main.fadeIn(ms, 5, 12, 22);
}
