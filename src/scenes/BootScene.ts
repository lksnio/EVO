import Phaser from 'phaser';
import { W, H, DEBUG, UI } from '../config';
import { commonTextures, decorTextures } from '../art/worldArt';
import { uiTextures } from '../art/uiArt';
import { text, title } from '../ui/ui';

/** Zeichnet beim Start die Grafiken, die überall gebraucht werden. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.cameras.main.setBackgroundColor('#030405');
    title(this, W / 2, H / 2 - 20, 'EVO', 72, UI.bone).setOrigin(0.5);
    text(this, W / 2, H / 2 + 50, 'Die Urzeit erwacht …', 22, UI.boneDim).setOrigin(0.5);
    // erst ein Bild anzeigen, dann die (kurze) Arbeit erledigen
    this.time.delayedCall(40, () => {
      commonTextures(this);
      uiTextures(this);
      decorTextures(this);
      const q = new URLSearchParams(location.search);
      this.scene.start(DEBUG && q.has('gallery') ? 'Gallery' : 'Title');
    });
  }
}
