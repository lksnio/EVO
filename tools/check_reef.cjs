/** Start Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_reef.cjs.
 * Real WebGL captures at the ordinary .72 zoom, geometry A/B, ink-preserving lift, cached animation and scenery lifecycle.
 * Optional external dependency: playwright-core. Chromium via CHROMIUM_PATH.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=path.resolve(__dirname,'../art/EVO_reef_direction_v1/captures');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],reports=[];
 try{
  for(const legacy of [true,false]){
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   console.log(legacy?'Checking previous scenery':'Checking painted reef');
   await page.goto(base+'/?gallery=fish&debug'+(legacy?'&oldreef':''));
   await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:90000});
   await page.evaluate(async()=>{
    const e=window.__evo,{EPOCHS}=await import('/src/data/epochs.ts');const epoch=EPOCHS.findIndex(e=>e.id==='devon');
    e.state.newRun(epoch);e.state.life.age=180;e.state.prog.seen=['garten'];
    e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch,place:'garten'});
   });
   await page.waitForFunction(()=>window.__evo?.game.scene.getScene('Level').player?.view,null,{timeout:90000});
   const result=await page.evaluate(async legacy=>{
    const e=window.__evo,s=e.game.scene.getScene('Level');
    const {liftKey}=await import('/src/art/fish/finish.ts');
    s.player.view.setLift(.25);s.cameras.main.stopFollow();
    const key=s.player.view.rig.T.keys.body;
    const pixels=k=>{const src=s.textures.get(k).getSourceImage(),cv=document.createElement('canvas');cv.width=src.width;cv.height=src.height;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(src,0,0);return cx.getImageData(0,0,cv.width,cv.height).data;};
    const a=pixels(key),b=pixels(liftKey(key,4));
    let dark=0,darkChanged=0,brightened=0,alphaChanged=0;
    for(let i=0;i<a.length;i+=4){
     if(a[i+3]!==b[i+3])alphaChanged++;
     if(a[i+3]<128)continue;
     const lum=a[i]*.3+a[i+1]*.59+a[i+2]*.11;
     if(lum<=24){dark++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])darkChanged++;}
     if(b[i]+b[i+1]+b[i+2]>a[i]+a[i+1]+a[i+2]+3)brightened++;
    }
    const before=Object.keys(s.textures.list).length;
    for(let i=0;i<40;i++){
     s.player.view.setLift(i%9/16);
     s.reefScenery?.update(i*16,.016,s.player);
     s.backSea?.update(i*16,.016,0);
    }
    const noFrameTextures=before===Object.keys(s.textures.list).length;
    let parallax=null,foreground=[];
    if(s.reefScenery){
     const n=s.reefScenery.near[0],cam=s.cameras.main;
     cam.centerOn(n.x,n.y-200);cam.preRender();s.reefScenery.update(0,.016,s.player);const x=n.img.x-cam.scrollX;
     const previous=cam.scrollX;cam.scrollX+=100;cam.preRender();s.reefScenery.update(16,.016,s.player);parallax=(x-(n.img.x-cam.scrollX))/(cam.scrollX-previous);if(Math.abs(parallax-1)>1e-6)throw Error('Grounded foreground footpoint moved relative to terrain');
     foreground=s.reefScenery.near.map(n=>({depth:n.img.depth,f:n.f}));
    }
    const c=s.L.crevices.at(-1),floor=c.y+c.h;
    s.cameras.main.stopFollow();s.cameras.main.setZoom(.72).centerOn(c.x+c.w/2,floor-300);s.cameras.main.fadeEffect.reset();
    s.player.body.reset(c.x+95,floor-190);s.player.refresh();s.player.shielded=true;
    s.dbg?.setVisible(false);const hud=e.game.scene.getScene('Hud');hud.dexC?.setVisible(false);hud.dexGlow?.setVisible(false);for(const o of hud.children.list)if(o.text?.toLowerCase()===s.place.name.toLowerCase())o.setVisible(false);
    // Keep real actors and their poses; stop combat and notices while making reproducible captures.
    s.physics.world.pause();
    s.update=function(time,dms){const dt=Math.min(.05,dms/1000);this.player.view.setPosition(this.player.x,this.player.y);this.player.view.animate(dt,'idle',0);this.reefScenery?.update(time,dt,this.player);this.backSea?.update(time,dt,0);this.waterAtmosphere?.update(time,dt);this.cullStep(time);};
    for(const scene of e.game.scene.getScenes(true))scene.cameras.main.fadeEffect.reset();
    return {legacy,solids:s.L.solids,ground:s.L.groundRects,crevices:s.L.crevices,deepCave:s.L.deepCave,
     roofCount:s.children.list.filter(o=>o.name==='reef-shelter-roof').length,
     lift:{dark,darkChanged,brightened,alphaChanged},noFrameTextures,parallax,foreground,
     schools:s.backSea.schools.length,backdropFish:s.backSea.schools.reduce((n,s)=>n+s.members.length,0),
     canvasTextures:Object.keys(s.textures.list).length,objects:s.children.length};
   },legacy);
   assert.ok(result.lift.dark>30);assert.equal(result.lift.darkChanged,0);assert.ok(result.lift.brightened>30);assert.equal(result.lift.alphaChanged,0);
   assert.equal(result.noFrameTextures,true);console.log(JSON.stringify({legacy,schools:result.schools,lift:result.lift,noFrameTextures:result.noFrameTextures,parallax:result.parallax}));
   if(!legacy){assert.equal(result.roofCount,result.crevices.length);assert.ok(Math.abs(result.parallax-1)<1e-6);assert.ok(result.foreground.every(n=>n.depth>20&&n.depth<50));}
   const frame=await page.evaluate(()=>{const g=window.__evo.game,s=g.scene.getScene('Level');s.cameras.main.setZoom(.72);s.cameras.main.preRender();return g.loop.frame;});
   await page.waitForFunction(f=>window.__evo.game.loop.frame>f+2,frame,{timeout:90000});
   await page.screenshot({path:path.join(folder,legacy?'shelter_before.png':'shelter_after.png')});
   if(!legacy){
    await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level'),n=s.reefScenery.near[1];s.cameras.main.centerOn(n.x+400,n.y-330);s.player.body.reset(n.x+400,n.y-230);s.player.view.setPosition(s.player.x,s.player.y);});
    const frame=await page.evaluate(()=>window.__evo.game.loop.frame);await page.waitForFunction(f=>window.__evo.game.loop.frame>f+3,frame,{timeout:90000});await page.screenshot({path:path.join(folder,'garden_foreground.png')});
    const lifecycle=await page.evaluate(()=>{const e=window.__evo,s=e.game.scene.getScene('Level'),reef=s.reefScenery;e.game.scene.stop('Hud');e.game.scene.stop('Level');return {images:reef.images.length,near:reef.near.length};});
    assert.deepEqual(lifecycle,{images:0,near:0});
   }
   reports.push(result);await page.close();
  }
  assert.deepEqual(reports[0].solids,reports[1].solids);assert.deepEqual(reports[0].ground,reports[1].ground);assert.deepEqual(reports[0].crevices,reports[1].crevices);assert.deepEqual(reports[0].deepCave,reports[1].deepCave);
  assert.ok(reports[1].schools<reports[0].schools);assert.deepEqual(errors,[]);
  const summary=reports.map(({solids,ground,crevices,deepCave,...r})=>r);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({reports:summary,errors},null,2)+'\n');console.log(JSON.stringify({reports:summary,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
