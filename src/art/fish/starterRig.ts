import Phaser from 'phaser';
import type { Morph } from '../creatureArt';
import { drawEyeLids } from '../eyeLids';
import { clamp } from '../../util/math';
import { newCanvas } from '../../util/canvas';
import { Grid, type FishPose, type Box } from './rig';
import { starterGeometry } from './starterLayout';
import { starterBodyTexture, starterJawTexture, starterTexture, type StarterRegistration, starterSourceForm, starterFinForm } from './starterAssets';
import { starterPoint, type StarterMotionGeometry, type StarterMotionPose } from './starterMotion';
import { starterInkColor, starterInkPainting } from './starterAppearance';

interface CutArt { body:string; jaw:string; jawBox:Box }
const cuts = new WeakMap<Phaser.Textures.TextureManager, Map<number,CutArt>>();
const smooth = (a:number,b:number,v:number) => { const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k); };

/** Style each source once, then reuse its parts for every fin/weapon combination; masters stay unchanged. */
function painting(scene:Phaser.Scene,form:number):HTMLImageElement|HTMLCanvasElement {
  const texture=starterTexture(form);
  if(scene.textures.exists(texture))return starterInkPainting(scene.textures.get(texture).getSourceImage() as HTMLImageElement,starterGeometry(form).width);
  const cut=cuts.get(scene.textures)?.get(form);
  if(cut){
    const body=scene.textures.get(cut.body).getSourceImage() as HTMLCanvasElement;
    const jaw=scene.textures.get(cut.jaw).getSourceImage() as HTMLCanvasElement;
    const [canvas,c]=newCanvas(body.width,body.height,true);c.drawImage(body,0,0);
    c.drawImage(jaw,cut.jawBox.x0*body.width,cut.jawBox.y0*body.height);return canvas;
  }
  const head=painting(scene,starterSourceForm(form)),fin=painting(scene,starterFinForm(form));
  const [canvas,c]=newCanvas(head.width,head.height,true),[front,f]=newCanvas(head.width,head.height,true);
  c.drawImage(fin,0,0,canvas.width,canvas.height);f.drawImage(head,0,0);
  f.globalCompositeOperation='destination-in';
  const blend=f.createLinearGradient(canvas.width*.59,0,canvas.width*.66,0);blend.addColorStop(0,'rgba(0,0,0,0)');blend.addColorStop(1,'#000');
  f.fillStyle=blend;f.fillRect(0,0,canvas.width,canvas.height);
  // Erase the donor head so translucent fins never reveal a second face.
  c.save();c.globalCompositeOperation='destination-out';c.fillStyle=blend;c.fillRect(0,0,canvas.width,canvas.height);c.restore();
  c.globalCompositeOperation='lighter';c.drawImage(front,0,0);return canvas;
}

function colored(scene:Phaser.Scene,key:string,m:Morph,r:StarterRegistration,box?:Box) {
  const fin=Math.round(clamp(m.finColor??0,0,1)*20),shade=Math.round(clamp(m.scaleShade??0,0,1)*20);
  if(!fin&&!shade)return key;
  const target=key+`_f${fin}_s${shade}`;if(scene.textures.exists(target))return target;
  const source=scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const [canvas,c]=newCanvas(source.width,source.height,true);c.drawImage(source,0,0);
  const image=c.getImageData(0,0,canvas.width,canvas.height),d=image.data;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const i=(y*canvas.width+x)*4;if(d[i+3]<8)continue;
    const u=box?box.x0+(box.x1-box.x0)*x/canvas.width:x/canvas.width;
    const v=box?box.y0+(box.y1-box.y0)*y/canvas.height:y/canvas.height;
    const core=Math.pow((u-.55)/.29,2)+Math.pow((v-.53)/.145,2);
    const region=!box&&u<r.hinge[0]-.01&&((u<.29||core>1.15)&&(v<.45||v>.61||u<.29)||u>.55&&v>.54);
    // Warm ivory rays distinguish fins from the cool blue skin. Soft colour weights
    // avoid painting geometric rectangles into the body at the fin roots.
    const warmth=clamp((d[i]-d[i+2]+12)/28,0,1)*clamp((d[i+1]-d[i+2]+8)/20,0,1);
    const finMask=region?warmth:0;
    const eye=Math.hypot((u-r.eye[0]),(v-r.eye[1])*r.height/r.width)<r.eye[2]*1.35;
    const dark=eye?1:1-(shade/20)*.8*(1-finMask);
    const a=fin/20*.7*finMask,lum=d[i]*.3+d[i+1]*.59+d[i+2]*.11,rgb=[lum*.36,lum*.88,lum*.94];
    for(let k=0;k<3;k++)d[i+k]=(d[i+k]*(1-a)+rgb[k]*a)*dark;
  }
  c.putImageData(image,0,0);scene.textures.addCanvas(target,canvas);return target;
}

/** Runtime masks split the unchanged painting at its registered mouth; no duplicate jaw remains underneath. */
function cutArt(scene:Phaser.Scene,form:number,r:StarterRegistration):CutArt {
  let cache=cuts.get(scene.textures);
  if (!cache) { cache=new Map(); cuts.set(scene.textures,cache); }
  const hit=cache.get(form); if(hit) return hit;
  const image=painting(scene,form);
  const w=image.width,h=image.height;
  const [body,b]=newCanvas(w,h,true),[jaw,j]=newCanvas(w,h,true);
  const path=(ctx:CanvasRenderingContext2D) => {
    ctx.beginPath();r.mouth.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));
    ctx.lineTo(w,h);ctx.lineTo(r.hinge[0]*w,h);ctx.closePath();
  };
  b.drawImage(image,0,0);b.save();path(b);b.clip();b.clearRect(0,0,w,h);b.restore();
  j.save();path(j);j.clip();j.drawImage(image,0,0);j.restore();
  // Keep upper fangs on the head, lower fangs on the mandible, including their painted outlines.
  for (const tooth of r.teeth) {
    const keep=tooth.upper?b:j,remove=tooth.upper?j:b;
    for(const ctx of [keep,remove]){
      ctx.save();ctx.beginPath();
      tooth.polygon.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));
      ctx.closePath();ctx.clip();
      if(ctx===remove)ctx.clearRect(0,0,w,h);else ctx.drawImage(image,0,0);
      ctx.restore();
    }
  }
  const pixels=j.getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  if(x1<=x0||y1<=y0){x0=0;y0=0;x1=1;y1=1;}
  const [small,c]=newCanvas(x1-x0,y1-y0,true);c.drawImage(jaw,x0,y0,x1-x0,y1-y0,0,0,x1-x0,y1-y0);
  const bodyKey=starterBodyTexture(form),jawKey=starterJawTexture(form);
  scene.textures.addCanvas(bodyKey,body);scene.textures.addCanvas(jawKey,small);
  // Once split, release the full uploaded source texture. The two shared parts replace it.
  if(scene.textures.exists(starterTexture(form)))scene.textures.remove(starterTexture(form));
  jaw.width=jaw.height=image.width=image.height=1;
  const result={body:bodyKey,jaw:jawKey,jawBox:{x0:x0/w,x1:x1/w,y0:y0/h,y1:y1/h}};
  cache.set(form,result);return result;
}

/** Only the requested brightness is cached, shared by all fish of the same form. */
function lifted(scene:Phaser.Scene,key:string,step:number) {
  if(!step)return key;
  const target=key+'_light'+step;if(scene.textures.exists(target))return target;
  const source=scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const [canvas,c]=newCanvas(source.width,source.height,true);c.drawImage(source,0,0);
  const image=c.getImageData(0,0,canvas.width,canvas.height),d=image.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<8)continue;
    const lum=d[i]*.3+d[i+1]*.59+d[i+2]*.11;
    const f=step/8*.5*smooth(24,82,lum);
    for(let k=0;k<3;k++)d[i+k]+=(255-d[i+k])*f;
  }
  c.putImageData(image,0,0);scene.textures.addCanvas(target,canvas);return target;
}

/** A registered painted character with swimming deformation, articulated jaw and attached eyelids. */
export class StarterFishRig {
  readonly parts:Phaser.GameObjects.GameObject[]=[];
  readonly lid:Phaser.GameObjects.Graphics;
  private cavity:Phaser.GameObjects.Graphics;
  private body?:Grid;
  private finWeights?:Float32Array;
  private jaw?:Grid;
  private bodyImage?:Phaser.GameObjects.Image;
  private jawImage?:Phaser.GameObjects.Image;
  private art:CutArt;
  private r:StarterRegistration;
  private width:number;
  private phase=Math.random()*6;
  private speed=0;
  private finPhase=0;
  private kick=0;
  private closed=0;
  private attack=0;
  private liftStep=-1;
  private pitch=0;
  private bob=0;
  private lunge=0;
  private opening=0;
  private still=0;
  private geometry:StarterMotionGeometry;
  private motion:StarterMotionPose={phase:0,speed:0,still:0,pitch:0,bob:0,lunge:0,opening:0};
  constructor(private scene:Phaser.Scene,readonly morph:Morph) {
    const {r,width,height}=starterGeometry(morph.fishForm??0);this.r=r;this.width=width;
    this.geometry={width,height,hinge:r.hinge};
    const source=cutArt(scene,morph.fishForm??0,r);
    this.art={...source,body:colored(scene,source.body,morph,r),jaw:colored(scene,source.jaw,morph,r,source.jawBox)};
    this.cavity=new Phaser.GameObjects.Graphics(scene);this.lid=new Phaser.GameObjects.Graphics(scene);
    this.parts.push(this.cavity);
    if(scene.sys.game.renderer.type===Phaser.WEBGL){
      this.body=new Grid(scene,this.art.body,{x0:0,x1:1,y0:0,y1:1},32,18);
      // Read the original ivory fin rays once. Colour upgrades must not change which parts move.
      const canvas=scene.textures.get(source.body).getSourceImage() as HTMLCanvasElement;
      const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
      const radius=Math.max(2,Math.round(canvas.width*.009));
      this.finWeights=new Float32Array(this.body.vx.length);
      for(let k=0;k<this.finWeights.length;k++){
        const x=Math.round(this.body.vx[k]*(canvas.width-1)),y=Math.round(this.body.vy[k]*(canvas.height-1));
        let warmth=0;
        for(const dx of [-radius,0,radius])for(const dy of [-radius,0,radius]){
          const px=clamp(x+dx,0,canvas.width-1),py=clamp(y+dy,0,canvas.height-1),i=(py*canvas.width+px)*4;
          if(pixels[i+3]<64)continue;
          warmth=Math.max(warmth,clamp((pixels[i]-pixels[i+2]+12)/28,0,1)*clamp((pixels[i+1]-pixels[i+2]+8)/20,0,1));
        }
        this.finWeights[k]=smooth(.45,.85,warmth);
      }
      this.jaw=new Grid(scene,this.art.jaw,this.art.jawBox,12,6);
      this.body.mesh.setSize(width*morph.size,height*morph.size);
      this.jaw.mesh.setSize(width*morph.size,height*morph.size);
      this.parts.push(this.jaw.mesh,this.body.mesh);
    }else{
      this.bodyImage=new Phaser.GameObjects.Image(scene,0,0,this.art.body).setOrigin(.55,.54).setDisplaySize(width*morph.size,height*morph.size);
      const b=this.art.jawBox;
      this.jawImage=new Phaser.GameObjects.Image(scene,0,0,this.art.jaw)
        .setOrigin((r.hinge[0]-b.x0)/(b.x1-b.x0),(r.hinge[1]-b.y0)/(b.y1-b.y0))
        .setDisplaySize((b.x1-b.x0)*width*morph.size,(b.y1-b.y0)*height*morph.size);
      this.parts.push(this.jawImage,this.bodyImage);
    }
    this.parts.push(this.lid);
    this.pose({t:0,dt:0,speed01:0,mode:'idle',open:0,lunge:0,clench:0,grind:0,coil:0,dip:0,pitch:0,still:0,crawlPhase:0});
  }
  private map(u:number,v:number,jaw=false,finWeight=0) {
    const q=starterPoint(u,v,this.geometry,this.motion,jaw,finWeight);
    q.x*=this.morph.size;q.y*=this.morph.size;return q;
  }
  eyes(closed:number,attack:number){this.closed=clamp(closed,0,1);this.attack=clamp(attack,0,1);this.drawEyes();}
  private drawEyes(){
    const p=this.map(this.r.eye[0],this.r.eye[1]);
    this.lid.setPosition(p.x,p.y).setRotation(p.rot);
    drawEyeLids(this.lid,0,0,this.r.eye[2]*this.width*this.morph.size,starterInkColor(this.r.skin),0x06090c,this.closed,this.attack);
  }
  setLift(value:number){
    const step=Math.round(clamp(value,0,.5)*16);if(step===this.liftStep)return;
    const body=lifted(this.scene,this.art.body,step),jaw=lifted(this.scene,this.art.jaw,step);
    this.body?.mesh.setTexture(body);this.jaw?.mesh.setTexture(jaw);
    this.bodyImage?.setTexture(body);this.jawImage?.setTexture(jaw);this.liftStep=step;
  }
  pose(p:FishPose){
    const idle=p.mode==='idle',target=idle?0:clamp(p.speed01,0,1.5),accel=target-this.speed;
    this.speed+=accel*Math.min(1,p.dt*5);
    this.kick=Math.max(0,this.kick-p.dt*2.4,Math.min(.7,accel*1.6));
    this.phase+=p.dt*(idle?2.2:5+Math.min(1,this.speed)*8.5);
    this.finPhase+=p.dt*(idle?2.4:4.6+Math.min(1,this.speed)*3);
    this.still=p.still;this.pitch=p.pitch+Math.sin(this.phase*.5)*.005*(1-p.still)+p.dip*.04;
    this.bob=Math.sin(p.t*2.2)*.1*(1-p.still);
    this.lunge=p.lunge*2.5;
    this.opening=clamp(p.open,0,1)*(.42-.035*this.r.state[0]);
    this.motion.phase=this.phase;this.motion.speed=this.speed;this.motion.still=this.still;this.motion.pitch=this.pitch;
    this.motion.bob=this.bob;this.motion.lunge=this.lunge;this.motion.opening=this.opening;
    this.motion.finPhase=this.finPhase;this.motion.kick=this.kick;
    for(const [grid,jaw] of [[this.body,false],[this.jaw,true]] as const)if(grid){
      for(let j=0;j<=grid.rows;j++)for(let i=0;i<=grid.cols;i++){
        const k=j*(grid.cols+1)+i,q=this.map(grid.vx[k],grid.vy[k],jaw,jaw?0:this.finWeights?.[k]);grid.set(i,j,q.x,q.y);
      }
    }
    if(this.bodyImage){
      const s=this.morph.size;
      this.bodyImage.setPosition(this.lunge*s,this.bob*s).setRotation(this.pitch);
      const h=this.map(this.r.hinge[0],this.r.hinge[1]);
      this.jawImage!.setPosition(h.x,h.y).setRotation(this.pitch+this.opening);
    }
    this.cavity.clear();
    if(this.opening>.003){
      this.cavity.fillStyle(0x0b111b,1);this.cavity.beginPath();
      const line=this.r.mouth;
      // The terminal point extends the clipping mask beyond the lips, not the visible mouth interior.
      for(let i=0;i<line.length-1;i++){const q=this.map(line[i][0],line[i][1]);if(i)this.cavity.lineTo(q.x,q.y);else this.cavity.moveTo(q.x,q.y);}
      for(let i=line.length-2;i>=0;i--){const q=this.map(line[i][0],line[i][1],true);this.cavity.lineTo(q.x,q.y);}
      this.cavity.closePath();this.cavity.fillPath();
    }
    this.drawEyes();
  }
}
