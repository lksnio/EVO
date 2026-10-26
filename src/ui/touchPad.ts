import Phaser from 'phaser';
import { UI } from '../config';
import { audio } from '../audio/Audio';
import { tapped, touch } from '../objects/Controls';
import { text } from './ui';

/**
 * Ein runder Bildschirm-Knopf (Handy, Tablet): Solange er gedrückt ist, gilt die Handlung key als gehalten (siehe
 * objects/Controls.ts). Gibt die Beschriftung zurück (sie lässt sich ändern, etwa „Biss“ → „Laich“).
 */
export function touchButton(scene: Phaser.Scene, x: number, y: number, r: number, label: string, key: keyof typeof touch, color = 0xe6dcc4) {
  const g = scene.add.graphics().setDepth(5);
  const draw = (down: boolean) => {
    g.clear();
    g.fillStyle(0x0b0a09, down ? 0.55 : 0.32);
    g.fillCircle(x, y, r);
    g.lineStyle(2.5, color, down ? 0.85 : 0.35);
    g.strokeCircle(x, y, r);
  };
  draw(false);
  const t = text(scene, x, y, label, r > 50 ? 21 : 18, UI.bone, { fontStyle: '700', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(6).setAlpha(0.85);
  const z = scene.add.zone(x, y, r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains).setDepth(7);
  const set = (v: boolean) => {
    touch[key] = v;
    // ein kurzes Tippen zählt, auch wenn der Finger vor dem nächsten Bild schon wieder oben ist
    if (v) tapped[key] = true;
    draw(v);
    if (v) audio.unlock();
  };
  z.on('pointerdown', () => set(true));
  z.on('pointerup', () => set(false));
  z.on('pointerout', () => set(false));
  return t;
}
