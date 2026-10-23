import type Phaser from 'phaser';
import { DEPTH, TITLE_FONT } from '../config';
import { keyLabel, onKeysChanged, type Bind } from '../state/keymap';

/** Das kleine Zeichen über etwas, mit dem man gerade etwas tun kann: beten, laichen … – mit der Taste der Belegung. */
export class Prompt {
  private c: Phaser.GameObjects.Container;
  private a = 0;
  private t = 0;

  private offKeys?: () => void;

  constructor(scene: Phaser.Scene, touchMode: boolean, bind: Bind = 'talk') {
    const g = scene.add.graphics();
    const label = scene.add.text(19, 15, '', { fontFamily: TITLE_FONT, fontSize: '19px', color: '#e0a848', fontStyle: '700', resolution: 2 }).setOrigin(0.5);
    // die Tafel wächst mit dem Namen der Taste („E“, „Leertaste“ …)
    const draw = () => {
      const s = touchMode ? '···' : keyLabel(bind);
      label.setText(s).setFontSize(touchMode ? 20 : s.length > 2 ? 15 : 19);
      const w = Math.max(38, Math.ceil(label.width) + 18);
      this.w = w;
      label.setX(w / 2);
      g.clear();
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(2, 4, w, 30, 9);
      g.fillStyle(0x0d0c0b, 0.88);
      g.fillRoundedRect(0, 0, w, 30, 9);
      g.lineStyle(1.5, 0xc8913c, 0.7);
      g.strokeRoundedRect(0.75, 0.75, w - 1.5, 28.5, 9);
      g.fillStyle(0x0d0c0b, 0.88);
      g.fillTriangle(w / 2 - 7, 29, w / 2 + 7, 29, w / 2, 38);
    };
    draw();
    if (!touchMode) this.offKeys = onKeysChanged(draw);
    this.c = scene.add.container(0, 0, [g, label]).setDepth(DEPTH.text).setAlpha(0).setScale(1.3);
  }

  /** Breite der Tafel */
  private w = 38;

  update(dt: number, x: number, y: number, want: boolean) {
    this.t += dt;
    this.a += ((want ? 1 : 0) - this.a) * Math.min(1, dt * 6);
    this.c.setAlpha(this.a);
    this.c.setVisible(this.a > 0.02);
    this.c.setPosition(x - (this.w / 2) * 1.3, y - 88 + Math.sin(this.t * 3) * 3);
  }

  destroy() {
    this.offKeys?.();
    this.c.destroy();
  }
}
