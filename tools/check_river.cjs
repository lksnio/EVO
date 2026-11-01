/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_river.cjs.
 * Optional external dependency: playwright-core; Chromium via CHROMIUM_PATH.
 * Saves real WebGL captures and validates existing gameplay, caches and scene cleanup.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
const folder=path.resolve(__dirname,'../art/vorlagen/fluss/aufnahmen');
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],reports=[];
 try{
  for(const legacy of [true,false]){
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
   await page.goto(base+'/?debug&gallery=river'+(legacy?'&oldprops&oldwater':''));
   await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:60000});
   if(!legacy)await page.screenshot({path:path.join(folder,'werkstatt.png')});
   await page.evaluate(async()=>{
    const e=window.__evo,{EPOCHS}=await import('/src/data/epochs.ts');
    const epoch=EPOCHS.findIndex(e=>e.id==='devon');e.state.newRun(epoch);
    e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch});
   });
   await page.waitForFunction(()=>window.__evo?.game.scene.getScene('Level').player?.view,null,{timeout:60000});
   const result=await page.evaluate(async legacy=>{
    const e=window.__evo,s=e.game.scene.getScene('Level'),c=s.L.cave;
    const {Roe}=await import('/src/objects/Food.ts');
    const {DuelCave}=await import('/src/objects/DuelCave.ts');
    const {paintedRiver,riverRoeTexture,riverCave}=await import('/src/art/riverProps.ts');
    const r=new Roe(s,1000,600,'moythomasia',1,4,false),rect={...r.rect};
    const initial=r.img.texture.key;r.take();const after=r.img.texture.key;
    const remaining=r.units;r.take();r.take();r.take();const exhausted=!r.take();
    const h=new Roe(s,1100,600,'moythomasia',1,4,false);h.vanish();
    const hatched=h.hatched&&h.units===0;
    const n=Object.keys(s.textures.list).length;
    for(let i=0;i<32;i++)s.waterAtmosphere?.update(i*16,.016);
    if(!legacy)for(let i=0;i<5;i++)riverRoeTexture(s,3,4);
    const noFrameTextures=Object.keys(s.textures.list).length===n;
    s.player.body.reset(c.x+c.w*.65,c.y+c.h-45);
    const events=[];
    const fake={inCave:false,players:()=>[{x:s.player.x,y:s.player.y,dead:false,view:s.player.view,name:'Test partner',cave:false}],caveLogin(value){this.inCave=value;events.push(value);}};
    const controller=new DuelCave(s,fake);controller.update(.016);
    const canEnter=controller.act();s.player.body.reset(c.x+c.w+80,c.y+c.h-45);controller.update(.016);controller.destroy();
    if(!legacy){const a=riverCave(s,c),b=riverCave(s,c);if(a.back.x!==a.front.x||a.back.y!==a.front.y||a.back.displayWidth!==a.front.displayWidth)throw Error('Cave layer registration');a.back.destroy();a.front.destroy();b.back.destroy();b.front.destroy();}
    const frames=s.children.list.filter(o=>o.name==='river-cave_front');
    const report={legacy,initial,after,remaining,exhausted,hatched,rect,noFrameTextures,canEnter,events,
      solids:s.L.solids,ground:s.L.groundRects,cave:s.L.cave,animals:s.animals.length,
      painted:paintedRiver(s),frames:frames.length,waterSurfaces:s.waterAtmosphere?.surfaces.length||0,
      particles:s.drift?.motes.length||0};
    s.player.body.reset(c.x+c.w*.7,c.y+c.h-48);s.player.refresh();
    s.cameras.main.stopFollow();s.cameras.main.setZoom(.9).setScroll(0,220);s.cameras.main.fadeEffect.reset();
    return report;
   },legacy);
   assert.equal(result.remaining,3);assert.equal(result.exhausted,true);assert.equal(result.hatched,true);
   assert.equal(result.noFrameTextures,true);assert.equal(result.canEnter,true);assert.deepEqual(result.events,[true,false]);
   assert.deepEqual(result.rect,{x:968,y:562,w:64,h:42});
   if(!legacy){assert.equal(result.frames,1);assert.ok(result.initial.startsWith('river_roe_'));assert.ok(result.waterSurfaces>0);assert.ok(result.particles<=48);}
   await page.waitForTimeout(300);
   await page.screenshot({path:path.join(folder,legacy?'hoehle_vorher.png':'hoehle_nachher.png')});
   // The ordinary spawning area and shell at the existing play zoom, without enlarging the props themselves.
   await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');const r=s.roes.find(r=>r.own)||s.roes[0];s.player.body.reset(r.x+65,r.y-32);s.cameras.main.setZoom(.72).setScroll(Math.max(0,r.x-700),Math.max(0,r.y-450));s.cameras.main.fadeEffect.reset();});
   await page.waitForTimeout(300);
   await page.screenshot({path:path.join(folder,legacy?'laich_wasser_vorher.png':'laich_wasser_nachher.png')});
   // Same scene, actor count and viewport: CPU submission timings under software WebGL, not a physical GPU benchmark.
   const timing=await page.evaluate(()=>new Promise(resolve=>{
    const g=window.__evo.game,s=g.scene.getScene('Level'),samples=[];
    s.physics.world.pause();
    s.update=function(time,dms){const dt=dms/1000;this.waterAtmosphere?.update(time,dt);this.drift?.update(time,dt);for(const c of this.caustics)c.s.tilePositionX+=dt*c.v;};
    let start=0;
    const before=()=>{start=performance.now();};
    const after=()=>{samples.push(performance.now()-start);if(samples.length===12){g.events.off('prerender',before);g.events.off('postrender',after);resolve({frames:samples.length,medianMs:samples.sort((a,b)=>a-b)[6]});}};
    g.events.on('prerender',before);g.events.on('postrender',after);
   }));
   // Scene teardown and rebuilding must also release the geometry masks and non-display-list mask shapes.
   await page.evaluate(()=>{const g=window.__evo.game,s=g.scene.getScene('Level');g.scene.stop('Hud');g.scene.stop('Level');g.scene.start('Gallery');});
   await page.waitForFunction(()=>window.__evo.game.scene.isActive('Gallery'));
   reports.push({...result,timing});await page.close();
  }
  assert.deepEqual(reports[0].solids,reports[1].solids);assert.deepEqual(reports[0].ground,reports[1].ground);assert.deepEqual(reports[0].cave,reports[1].cave);
  assert.deepEqual(errors,[]);
  const summary=reports.map(({solids,ground,cave,...r})=>r);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({reports:summary,errors},null,2)+'\n');
  console.log(JSON.stringify({reports:summary,errors}));
 }finally{await browser.close();}
})();
