import Phaser from 'phaser';
import { DEPTH } from '../config';
import { COLLECTION_FOSSILS, COLLECTION_SHELLS, type CollectionId } from '../data/collection';
import { collectionFossilTexture, collectionShellTexture } from '../art/collectionArt';
import type { Rect } from '../util/math';

/** Personal, permanent discovery. Its moving hitbox follows the visible shell/plate while falling. */
export class CollectionPickup {
  readonly img: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private glint: Phaser.GameObjects.Image;
  taken=false;

  constructor(private scene:Phaser.Scene,readonly x:number,readonly y:number,readonly id:CollectionId,from?:number) {
    const [kind,key]=id.split(':');
    const fossil=kind==='fossil';
    const index=fossil?COLLECTION_FOSSILS.findIndex(f=>f.id===key):COLLECTION_SHELLS.findIndex(s=>s.id===key);
    const texture=fossil?collectionFossilTexture(scene,index,true):collectionShellTexture(scene,index,true);
    this.halo=scene.add.image(x,y-18,'glow').setTint(fossil?0xd6bc7e:0xc3e2dc).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.pickups-.1).setDisplaySize(96,70).setAlpha(.12);
    this.img=scene.add.image(x,y+4,texture).setOrigin(.5,1).setDepth(DEPTH.pickups).setDisplaySize(fossil?62:42,fossil?62:42).setName(`pickup-${id}`);
    this.glint=scene.add.image(x-4,y-26,'shell_glint').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.pickups+.1).setScale(0);
    scene.tweens.add({targets:this.halo,alpha:.06,yoyo:true,repeat:-1,duration:2600,ease:'Sine.inOut'});
    scene.tweens.add({targets:this.glint,scale:{from:0,to:.48},angle:{from:-20,to:25},duration:430,yoyo:true,repeat:-1,repeatDelay:3400,ease:'Sine.inOut'});
    if(from!==undefined&&from<y){
      const dy=y-from;
      for(const o of [this.img,this.halo,this.glint]){
        const dest=o.y;o.y-=dy;
        scene.tweens.add({targets:o,y:dest,duration:Math.min(2600,450+dy*1.4),ease:'Sine.out'});
      }
    }
  }
  get rect():Rect { return {x:this.img.x-25,y:this.img.y-this.img.displayHeight,w:50,h:this.img.displayHeight+8}; }
  take(){
    if(this.taken)return;this.taken=true;
    this.scene.tweens.killTweensOf([this.halo,this.glint,this.img]);this.glint.destroy();
    this.scene.tweens.add({targets:this.halo,alpha:0,duration:500,onComplete:()=>this.halo.destroy()});
    this.scene.tweens.add({targets:this.img,y:this.img.y-24,alpha:0,duration:600,ease:'Sine.out',onComplete:()=>this.img.destroy()});
  }
}
