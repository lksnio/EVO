import Phaser from 'phaser';
import { W, H, DEBUG, TITLE_FONT, UI } from '../config';
import { commonTextures, decorTextures } from '../art/worldArt';
import { lifeTextures } from '../art/lifeArt';
import { uiTextures } from '../art/uiArt';
import { tabletTextures } from '../art/tabletArt';
import { mapTextures } from '../art/mapArt';


/** Zeichnet beim Start die Grafiken, die überall gebraucht werden. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.cameras.main.setBackgroundColor('#030405');
    // schlicht wie im Titelbild: EVO, darunter Living World
    this.add.text(W / 2, H / 2 - 18, 'EVO', { fontFamily: TITLE_FONT, fontSize: '72px', color: UI.bone, fontStyle: '400', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(14).setAlpha(0.85);
    this.add.text(W / 2, H / 2 + 42, 'LIVING WORLD', { fontFamily: TITLE_FONT, fontSize: '15px', color: UI.ochre, fontStyle: '700', resolution: 2 })
      .setOrigin(0.5).setLetterSpacing(9).setAlpha(0.85);
    // erst ein Bild anzeigen, dann die (kurze) Arbeit erledigen
    this.time.delayedCall(40, () => {
      commonTextures(this);
      uiTextures(this);
      tabletTextures(this);
      mapTextures(this);
      decorTextures(this);
      lifeTextures(this);
      const q = new URLSearchParams(location.search);
      this.scene.start(DEBUG && q.has('gallery') ? 'Gallery' : 'Title');
    });
  }
}
