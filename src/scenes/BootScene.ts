import Phaser from 'phaser';
import { W, H, DEBUG } from '../config';
import { ENEMIES } from '../data/enemies';
import { makeEnemyTextures } from '../art/enemyArt';
import { commonTextures, decorTextures } from '../art/worldArt';
import { uiTextures } from '../art/uiArt';
import { text } from '../ui/ui';

/** Zeichnet beim Start alle Grafiken, die überall gebraucht werden. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08203c');
    text(this, W / 2, H / 2 - 20, 'EVO', 72, '#ffe680', { fontStyle: '700' }).setOrigin(0.5);
    text(this, W / 2, H / 2 + 50, 'Die Urzeit wird erschaffen …', 24, '#cfe8ff').setOrigin(0.5);
    // erst ein Bild anzeigen, dann die (kurze) Arbeit erledigen
    this.time.delayedCall(40, () => {
      commonTextures(this);
      uiTextures(this);
      decorTextures(this);
      for (const d of Object.values(ENEMIES)) makeEnemyTextures(this, d);
      const q = new URLSearchParams(location.search);
      this.scene.start(DEBUG && q.has('gallery') ? 'Gallery' : 'Title');
    });
  }
}
