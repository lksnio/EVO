/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_starter_motion.cjs.
 * Real WebGL checks for all starter forms, the revised jaw, C overview and a short movement capture. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
const folder=path.resolve(__dirname,'../art/EVO_startfish_bite_tier1_v2/captures');
const videoDir='/tmp/evo-starter-motion-video';fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(videoDir,{recursive:true});
const recordVideo=process.env.EVO_RECORD_VIDEO==='1';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},...(recordVideo?{recordVideo:{dir:videoDir,size:{width:1280,height:720}}}:{})});
  const video=page.video();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/?debug&offline&slot=starter-motion&gallery=starter&forms=0,1,2,3&cols=2&zoom=4&mode=idle&speed=0');
  await page.waitForFunction(()=>window.__evo?.game.scene.getScene('Gallery').views?.length===4,null,{timeout:90000});
  console.log('Starter gallery ready');
  report.forms=await page.evaluate(async()=>{
   const {CreatureView}=await import('/src/objects/CreatureView.ts');
   const {STARTER_FORMS}=await import('/src/sim/starterFish.ts');
   const sc=window.__evo.game.scene.getScene('Gallery');sc.scene.pause();
   const common={cls:'fish',size:1,jaw:0,skull:0,stealth:0,diet:0,scars:0,belly:1,fierce:0,hue:1,seed:7};
   const views=STARTER_FORMS.map((_,i)=>new CreatureView(sc,-1000,-1000,{...common,fishForm:i}));
   const tex=sc.textures.getTextureKeys().length;
   const at=(g,i,j)=>{const k=(j*(g.cols+1)+i)*4;return {x:g.v[k],y:g.v[k+1]};};
   const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   let error=0,tailMoves=0,finMoves=0,eyesAttached=true,finite=true;
   for(const view of views){
    const r=view.rig,g=r.body;let previousTail,previousFin;let tailMovement=0,finMovement=0;
    const finIndex=Array.from(r.finWeights).findIndex((v,k)=>v>.7&&g.vy[k]<.25&&g.vx[k]>.38&&g.vx[k]<.65);
    const expected=(25-15)/g.cols*r.width;
    for(let frame=0;frame<45;frame++){
     r.pose({t:frame/30,dt:1/30,speed01:frame%3*.7,mode:frame<15?'idle':'swim',open:frame>30?.8:0,lunge:Math.sin(frame)*.8,clench:0,grind:0,coil:0,dip:0,pitch:Math.sin(frame*.1)*.1,still:0,crawlPhase:0});
     error=Math.max(error,Math.abs(dist(at(g,15,9),at(g,25,9))-expected));
     const tail=at(g,3,9);if(previousTail)tailMovement=Math.max(tailMovement,dist(tail,previousTail));previousTail=tail;
     if(finIndex>=0){const fin={x:g.v[finIndex*4],y:g.v[finIndex*4+1]};if(previousFin)finMovement=Math.max(finMovement,dist(fin,previousFin));previousFin=fin;}
     const eye=r.map(r.r.eye[0],r.r.eye[1]);eyesAttached&&=Math.hypot(eye.x-r.lid.x,eye.y-r.lid.y)<1e-6;
     finite&&=g.v.every(Number.isFinite)&&r.jaw.v.every(Number.isFinite);
    }
    if(tailMovement>.02)tailMoves++;if(finMovement>.001)finMoves++;
   }
   const stableTextures=sc.textures.getTextureKeys().length===tex;
   const coloured=new CreatureView(sc,-1000,-1000,{...common,fishForm:1,finColor:1,scaleShade:.5});
   const sameFinMask=Array.from(coloured.rig.finWeights).every((v,i)=>v===views[1].rig.finWeights[i]);coloured.destroy();
   views.forEach(v=>v.destroy());
   for(const view of sc.views){view.rig.phase=0;view.rig.pose({t:0,dt:0,speed01:0,mode:'idle',open:0,lunge:0,clench:0,grind:0,coil:0,dip:0,pitch:0,still:0,crawlPhase:0});}
   return {count:views.length,maxCoreLengthError:error,tailMoves,finMoves,eyesAttached,finite,stableTextures,sameFinMask};
  });
  assert.equal(report.forms.count,48);assert.ok(report.forms.maxCoreLengthError<1e-5);assert.equal(report.forms.tailMoves,48);assert.ok(report.forms.finMoves>=40);for(const key of ['eyesAttached','finite','stableTextures','sameFinMask'])assert.equal(report.forms[key],true,key);
  await page.screenshot({path:path.join(folder,'gebiss-stufen.png')});
  await page.evaluate(()=>{const sc=window.__evo.game.scene.getScene('Gallery');sc.views.forEach((v,i)=>v.setVisible(i===1));const v=sc.views[1];v.setPosition(640,350);v.setBaseScale(5);v.holdOpen=1;v.squint(.8);v.animate(.03,'idle',0);sc.children.list.filter(o=>o.type==='Text').forEach(o=>o.setVisible(false));});
  await page.screenshot({path:path.join(folder,'gebiss-1-geoeffnet.png')});
  console.log('All forms and articulated jaw checked');
  await page.evaluate(()=>{const {game:g,state:s}=window.__evo;s.resetAll();s.newRun(0);s.traits.biteGain=15;s.traits.fishForm=1;s.traits.fishPrimary=1;s.life.age=240;s.data.seenIntro=true;g.scene.stop('Gallery');g.scene.start('Level',{epoch:0});});
  await page.waitForFunction(()=>window.__evo.game.scene.isActive('Hud')&&!!window.__evo.game.scene.getScene('Level').player?.view,null,{timeout:90000});
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.invulnUntil=1e12;s.dbg?.setVisible(false);s.player.body.reset(1100,300);});
  await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player.view.rig.speed>.1,null,{timeout:15000});await page.keyboard.up('ArrowRight');
  report.inGameSwim=true;
  await page.keyboard.press('KeyC');
  await page.waitForFunction(()=>!!window.__evo.game.scene.getScene('Hud').overview,null,{timeout:15000});
  report.overview=await page.evaluate(()=>new Promise(resolve=>{
   const sc=window.__evo.game.scene.getScene('Hud'),v=sc.overview.portrait,r=v.rig,g=r.body;
   const original=r.pose,modes=new Set();r.pose=function(p){modes.add(p.mode+':'+p.speed01);return original.call(this,p);};
   const pos=(i,j)=>{const k=(j*(g.cols+1)+i)*4;return {x:g.v[k],y:g.v[k+1]};};
   const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   const core=distance(pos(15,9),pos(25,9)),firstTail=pos(3,9);let count=0,coreError=0,movement=0;
   const step=()=>{count++;coreError=Math.max(coreError,Math.abs(distance(pos(15,9),pos(25,9))-core));movement=Math.max(movement,distance(pos(3,9),firstTail));if(count>=50){sc.events.off('postupdate',step);r.pose=original;resolve({frames:count,modes:[...modes],maxCoreLengthError:coreError,tailMovement:movement,form:v.m.fishForm});}};
   sc.events.on('postupdate',step);
  }));
  assert.deepEqual(report.overview.modes,['idle:0']);assert.equal(report.overview.form,1);assert.ok(report.overview.maxCoreLengthError<1e-5);assert.ok(report.overview.tailMovement>.1);
  await page.screenshot({path:path.join(folder,'c-ansicht.png')});
  await page.waitForTimeout(4500);assert.deepEqual(errors,[]);
  report.errors=errors;fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  await page.close();
  if(video){const raw=await video.path();execFileSync('ffmpeg',['-v','error','-y','-sseof','-4','-i',raw,'-t','3.5','-an','-c:v','libvpx-vp9','-b:v','0','-crf','35',path.join(folder,'c-bewegung.webm')]);}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
