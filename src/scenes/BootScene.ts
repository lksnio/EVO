import Phaser from 'phaser';
import { TILE } from '../config';

/**
 * Lädt Assets. Solange es noch keine Grafiken gibt, werden einfache
 * Platzhalter-Texturen erzeugt. Echte Assets einfach in public/assets/
 * ablegen und hier mit this.load.image(...) / this.load.spritesheet(...) laden.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Beispiel: this.load.image('player', 'assets/player.png');
  }

  create(): void {
    this.makeRect('player', 24, 32, 0xe74c3c);
    this.makeRect('ground', TILE, TILE, 0x8b5a2b, 0x3e8e41);
    this.makeRect('coin', 14, 14, 0xf1c40f);
    this.makeRect('goal', 16, 96, 0xffffff);
    this.scene.start('Game');
  }

  private makeRect(key: string, w: number, h: number, color: number, topColor?: number): void {
    const g = this.add.graphics();
    g.fillStyle(color).fillRect(0, 0, w, h);
    if (topColor !== undefined) g.fillStyle(topColor).fillRect(0, 0, w, 6);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
