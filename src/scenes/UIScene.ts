import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/** HUD, läuft als eigene Szene über dem Spiel (bewegt sich nicht mit der Kamera). */
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' };
    const scoreText = this.add.text(16, 16, 'Münzen: 0', style);
    this.add.text(GAME_WIDTH - 16, 16, '←/→ bzw. A/D laufen · Leertaste springen', {
      ...style,
      fontSize: '14px',
    }).setOrigin(1, 0);

    const game = this.scene.get('Game');
    game.events.on('score', (s: number) => scoreText.setText(`Münzen: ${s}`), this);
    game.events.on('win', (s: number) => {
      this.add
        .text(GAME_WIDTH / 2, 200, `Geschafft! ${s} Münzen`, { ...style, fontSize: '40px' })
        .setOrigin(0.5);
    }, this);
    this.events.once('shutdown', () => {
      game.events.off('score', undefined, this);
      game.events.off('win', undefined, this);
    });
  }
}
