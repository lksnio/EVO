import Phaser from 'phaser';
import { W,H,UI } from '../config';
import { game,ZERO_TRAITS } from '../state/GameState';
import { CreatureView } from '../objects/CreatureView';
import { STARTER_FORMS } from '../sim/starterFish';
import { fishMarkKey } from '../sim/fishEvolution';
import { fishTree,type FishTreeNode } from '../sim/fishTree';
import { Button,text,title } from '../ui/ui';

/** The shell shows only the played branches, with a maximum of seven form transitions. */
export class EvolutionScene extends Phaser.Scene {
  private plot!:Phaser.GameObjects.Container;
  private views:CreatureView[]=[];
  private pan=0;
  private width=0;
  private stamp='';
  private selected?:string;
  private detail?:Phaser.GameObjects.Text;
  private selection?:Phaser.GameObjects.Graphics;
  private drag?:{x:number;pan:number};
  constructor(){super('Evolution');}
  create(){
    this.pan=0;this.selected=undefined;this.stamp='';this.drag=undefined;
    this.add.rectangle(0,0,W,H,0x031014,.96).setOrigin(0).setInteractive();
    title(this,40,22,'Evolution',32);
    text(this,42,65,'Die Muschel bewahrt eure Wege.',17,UI.boneDim);
    new Button(this,W-130,48,'Weiterschwimmen',{w:225,h:42,size:17,onClick:()=>this.close()});
    this.plot=this.add.container(80,115);
    const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(18,100,W-36,H-175);
    this.plot.setMask(mask.createGeometryMask());
    this.events.once('shutdown',()=>{this.plot.clearMask(true);mask.destroy();});
    this.detail=text(this,40,H-65,'Klicke auf ein Tier, um seine Entwicklung anzusehen.',16,UI.boneDim);
    text(this,40,H-35,'Ziehen oder Mausrad: Äste verschieben · Esc: zurück ins Wasser',13,UI.boneDim);
    this.input.keyboard?.on('keydown-ESC',()=>this.close());
    this.input.on('wheel',(_p:unknown,_o:unknown,dx:number,dy:number)=>{this.pan-=Math.abs(dx)>Math.abs(dy)?dx:dy;this.position();});
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(p.y>100&&p.y<H-75)this.drag={x:p.x,pan:this.pan};});
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(this.drag&&p.isDown){this.pan=this.drag.pan+p.x-this.drag.x;this.position();}});
    this.input.on('pointerup',()=>this.drag=undefined);
    this.draw(true);
  }
  private close(){this.scene.resume('Hud');this.scene.resume('Level');this.scene.stop();}
  private position(){if(this.width<=W-160){this.pan=0;this.plot.x=(W-this.width+156)/2;}else{this.pan=Phaser.Math.Clamp(this.pan,W-160-this.width,0);this.plot.x=80+this.pan;}}
  private draw(focus=false){
    const branches=game.data.fishBranches??[];
    this.stamp=JSON.stringify(branches);this.plot.removeAll(true);this.views=[];
    const model=fishTree(branches);this.width=model.width;
    const g=this.add.graphics();this.plot.add(g);
    const current=fishMarkKey(game.run?.fishTrace??[{form:0,primary:0}]);
    const active=model.nodes.find(n=>n.id===current);
    for(const node of model.nodes)for(const child of node.children){
      g.lineStyle(2,0x6e9595,.65);g.beginPath();g.moveTo(node.x,node.depth*70);g.lineTo(node.x,(node.depth+.5)*70);g.lineTo(child.x,(node.depth+.5)*70);g.lineTo(child.x,child.depth*70);g.strokePath();
    }
    for(const node of model.nodes){
      const x=node.x,y=node.depth*70,own=node.id===current;
      g.fillStyle(own?0x25494c:0x10272b,.95).fillEllipse(x,y,100,52);
      g.lineStyle(own?2:1,own?0xa8d7cb:0x48666b,.9).strokeEllipse(x,y,100,52);
      const [jaw,fins,skull]=STARTER_FORMS[node.mark.form];
      const traits=own?game.traits:{...ZERO_TRAITS,fishForm:node.mark.form,fishPrimary:node.mark.primary,biteGain:[10,25,60,125][jaw]-10,finGain:[10,20,50,100][fins]-10,ramGain:[10,25,60,125][skull]-10};
      const view=new CreatureView(this,x,y,game.morph({traits}),.73);this.views.push(view);this.plot.add(view);
      const hit=this.add.zone(x,y,112,58).setInteractive({useHandCursor:true});
      hit.on('pointerup',()=>this.select(node));this.plot.add(hit);
      if(node.branches.length){
        const names=[...new Set(node.branches.map(b=>b.name+(b.extinct?' ×':'')))].join(' · ');
        this.plot.add(text(this,x,y+27,names.length>28?names.slice(0,27)+'…':names,11,own?UI.bone:UI.boneDim,{wordWrap:{width:140}}).setOrigin(.5,0));
      }
    }
    this.selection=this.add.graphics();this.plot.add(this.selection);
    if(focus&&active)this.pan=(W-160)/2-active.x;
    this.position();
    if(this.selected){const node=model.nodes.find(n=>n.id===this.selected);if(node)this.select(node);}
    else if(active)this.select(active);
  }
  private select(node:FishTreeNode){
    this.selected=node.id;
    this.selection?.clear().lineStyle(2,0xd7bc81,.9).strokeEllipse(node.x,node.depth*70,106,58);
    const [g,f,k]=STARTER_FORMS[node.mark.form];
    this.detail?.setText(`Gebiss · Stufe ${g}     Flossen · Stufe ${f}     Schädel · Stufe ${k}${node.mark.primary===1?'     Primär: Gebiss':node.mark.primary===3?'     Primär: Schädel':''}`);
  }
  update(_t:number,ms:number){
    if(JSON.stringify(game.data.fishBranches??[])!==this.stamp)this.draw();
    for(const view of this.views)view.animate(Math.min(.05,ms/1000),'swim',.18);
  }
}
