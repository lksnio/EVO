import Phaser from 'phaser';
import {W,H,UI} from '../config';
import {game} from '../state/GameState';
import {Button,text,fadeTo} from '../ui/ui';
import type {LevelScene} from './LevelScene';

/** A dead player stays in the shared world and returns only by choosing a valid egg. */
export class WatchScene extends Phaser.Scene {
  private label!:Phaser.GameObjects.Text;
  private hint!:Phaser.GameObjects.Text;
  private eggs!:Button;
  constructor(){super('Watch');}
  create(){
    this.add.rectangle(W/2,55,600,86,0x051015,.9).setStrokeStyle(1,0x648184,.7);
    this.label=text(this,W/2,27,'Spectating',24,UI.bone).setOrigin(.5,0);
    this.hint=text(this,W/2,64,'Waiting for new eggs.',16,UI.boneDim).setOrigin(.5,0);
    this.eggs=new Button(this,W/2,H-65,'View eggs',{w:290,h:46,onClick:()=>this.level.openWatcherRoe()});
    new Button(this,95,55,'‹',{w:48,h:38,onClick:()=>this.level.cycleWatch(-1)});
    new Button(this,W-95,55,'›',{w:48,h:38,onClick:()=>this.level.cycleWatch(1)});
    new Button(this,W-130,H-36,'Title screen',{w:180,h:35,size:16,onClick:()=>{game.save();this.scene.stop('Level');fadeTo(this,'Title');}});
    this.input.keyboard?.on('keydown-E',()=>this.level.openWatcherRoe());
    this.input.keyboard?.on('keydown-ENTER',()=>this.level.openWatcherRoe());
    this.input.keyboard?.on('keydown-LEFT',()=>this.level.cycleWatch(-1));
    this.input.keyboard?.on('keydown-RIGHT',()=>this.level.cycleWatch(1));
    this.update();
  }
  private get level(){return this.scene.get('Level') as LevelScene;}
  update(){
    const count=game.pool.length+game.roe.length;
    this.label.setText(this.level.watchName?`You are watching ${this.level.watchName}`:'Spectating');
    this.hint.setText(count?`${count} ${count===1?'egg is':'eggs are'} available. Choose your next life.`:'You can rejoin as soon as your partner spawns.');
    this.eggs.setDisabled(!count);
  }
}
