import Phaser from 'phaser';
import { W, H, UI } from '../config';
import { COLLECTION_FOSSILS, COLLECTION_SHELLS } from '../data/collection';
import { collectionFossilTexture, collectionShellTexture, collectionStarTexture, starPoint } from '../art/collectionArt';
import type { CollectionState } from '../sim/collection';
import { Button, panel, text, title } from './ui';

/** One renderer for the compact in-game overview and the large, inspectable star. */
export function collectionStar(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, c: CollectionState, x: number, y: number, radius: number,
  inspect?: (kind: 'shell' | 'fossil', index: number) => void) {
  const star = scene.add.container(x, y).setName('collection-star');
  parent.add(star);
  star.add(scene.add.image(0, 0, collectionStarTexture(scene)).setDisplaySize(radius * 2.22, radius * 2.22));
  for (let i = 0; i < 7; i++) {
    const f = COLLECTION_FOSSILS[i], s = COLLECTION_SHELLS[i];
    const fp = starPoint(i, radius * .8), sp = starPoint(i, radius * .48, true);
    const fossil = scene.add.image(fp.x, fp.y, collectionFossilTexture(scene,i,c.fossils.includes(f.id)))
      .setDisplaySize(radius * .37, radius * .37).setName(`collection-fossil-${f.id}`);
    const shell = scene.add.image(sp.x, sp.y, collectionShellTexture(scene,i,c.shells.includes(s.id)))
      .setDisplaySize(radius * .19, radius * .19).setName(`collection-shell-${s.id}`);
    star.add([fossil,shell]);
    if (inspect) for (const [img,kind] of [[fossil,'fossil'],[shell,'shell']] as const) {
      img.setInteractive({useHandCursor:true});
      img.on('pointerover',()=>inspect(kind,i)).on('pointerdown',()=>inspect(kind,i));
    }
  }
  return star;
}

/** Opened in the running game; never replaces the title screen or changes a save for previewing. */
export class CollectionPanel {
  readonly c: Phaser.GameObjects.Container;
  private details: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, readonly state: CollectionState, onClose: () => void) {
    const c=this.c=scene.add.container(0,0).setDepth(80).setName('collection-panel');
    c.add(scene.add.rectangle(0,0,W,H,0x03090b,.78).setOrigin(0).setInteractive().on('pointerdown',onClose));
    c.add(panel(scene,66,24,W-132,H-48,.98));
    c.add(scene.add.zone(66,24,W-132,H-48).setOrigin(0).setInteractive());
    c.add(title(scene,W/2,65,'Spuren des Lebens',33,UI.bone).setOrigin(.5));
    c.add(text(scene,W/2,101,'Was bleibt, wenn ein Leben vergeht.',17,UI.boneDim,{fontStyle:'italic'}).setOrigin(.5));
    const rules=scene.add.graphics(); rules.lineStyle(1,0xc8913c,.24);
    rules.lineBetween(138,127,W-138,127);rules.lineBetween(797,161,797,599);c.add(rules);
    collectionStar(scene,c,state,452,377,235,(kind,i)=>this.inspect(kind,i));
    this.details=scene.add.container(0,0);c.add(this.details);this.intro();
    c.add(text(scene,452,644,`${state.fossils.length} / 7 Fossilien     ·     ${state.shells.length} / 7 Muscheln`,18,UI.bone).setOrigin(.5));
    c.add(new Button(scene,996,635,'Zurück',{w:204,h:42,size:18,onClick:onClose}).setName('collection-close'));
    c.add(text(scene,996,677,'C oder Esc schließen',12,UI.boneDim).setOrigin(.5));
  }

  private intro() {
    const sc=this.scene,c=this.details;
    c.removeAll(true);
    c.add(title(sc,991,211,'Ein Stern aus Spuren',22,UI.ochre).setOrigin(.5));
    c.add(text(sc,991,264,'Sieben große Steine.\nSieben kleine Muscheln.',21,UI.bone,{align:'center',lineSpacing:8}).setOrigin(.5));
    c.add(text(sc,991,357,'An den Spitzen ruhen die Fossilien\ngroßer Tiere. In den inneren\nWinkeln finden die Muscheln\nihren Platz.',18,UI.boneDim,{align:'center',lineSpacing:8}).setOrigin(.5));
    c.add(text(sc,991,476,'Deine Funde bleiben über\nGenerationen und neue Leben\nhinweg erhalten.',17,UI.boneDim,{align:'center',lineSpacing:7}).setOrigin(.5));
    c.add(text(sc,991,561,'Berühre eine Spur.',14,UI.ochre,{fontStyle:'italic'}).setOrigin(.5));
  }

  private inspect(kind:'shell'|'fossil',i:number) {
    const sc=this.scene,c=this.details,s=this.state;
    c.removeAll(true);
    const f=COLLECTION_FOSSILS[i],m=COLLECTION_SHELLS[i];
    const owned=kind==='fossil'?s.fossils.includes(f.id):s.shells.includes(m.id);
    const key=kind==='fossil'?collectionFossilTexture(sc,i,owned):collectionShellTexture(sc,i,owned);
    c.add(sc.add.image(991,258,key).setDisplaySize(144,144));
    c.add(text(sc,991,179,kind==='fossil'?'FOSSILPLATTE':'MUSCHEL',13,UI.ochre,{fontStyle:'700'}).setOrigin(.5).setLetterSpacing(3));
    c.add(title(sc,991,370,owned?(kind==='fossil'?f.name:m.name):'Eine unbekannte Spur',21,UI.bone).setOrigin(.5).setWordWrapWidth(290).setAlign('center'));
    c.add(text(sc,991,414,kind==='fossil'?f.epoch:'Ein stiller Fund',17,UI.ochre).setOrigin(.5));
    c.add(text(sc,991,489,owned?'Gefunden.\nDiese Spur bleibt dir erhalten.':'Dieser Platz ist noch leer.\nEin anderes Leben führt vielleicht\nan ihm vorbei.',18,UI.boneDim,{align:'center',lineSpacing:7}).setOrigin(.5));
  }

  destroy() { this.c.destroy(); }
}
