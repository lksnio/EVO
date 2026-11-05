/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_lagoon.cjs.
 * Uses optional playwright-core and CHROMIUM_PATH. Captures the real WebGL scene; checks animation, caches and cleanup. */
const {chromium}=require('playwright-core');
const path=require('node:path');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
const folder=path.resolve(__dirname,'../art/EVO_nursery_lagoon_v1/captures');fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.goto(base+'/?debug&weather=clear');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Title'),null,{timeout:60000});
  await page.evaluate(()=>{const {game:g,state:s}=window.__evo;s.resetAll();s.newRun(0);s.data.seenIntro=true;g.scene.stop('Title');g.scene.start('Level',{epoch:0});});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').nurseryBackdrop,null,{timeout:60000});
  console.log('Painted nursery loaded');
  const report=await page.evaluate(()=>{
   const {game:g}=window.__evo,s=g.scene.getScene('Level'),n=s.nurseryBackdrop;
   s.physics.world.pause();s.controls.clear();s.player.invulnUntil=1e12;
   s.dbg?.setVisible(false);
   g.scene.stop('Hud');s.cameras.main.stopFollow();s.cameras.main.fadeEffect.reset();s.near.k=1;
   const x=s.L.cave.x+s.L.cave.w+380;s.player.body.reset(x,300);s.player.view.setPosition(x,300);
   s.cameras.main.setZoom(.94).setScroll(100,-190);s.cameras.main.preRender();
   s.__qaUpdate=s.update;
   s.update=function(time,delta){this.t+=Math.min(.05,delta/1000);this.environmentStep(time,Math.min(.05,delta/1000),this.player);this.waterSurface?.update(time,this.weather);};
   // Warm every visible pool once, then verify no per-frame textures or images are made.
   n.update(1000,{cloud:0,rain:0});
   const textures=s.textures.getTextureKeys().length,children=s.children.list.length;
   const geometry=JSON.stringify({solids:s.L.solids,cave:s.L.cave,roe:s.L.roe});
   const frond=n.fronds.find(f=>f.x>s.cameras.main.worldView.left&&f.x<s.cameras.main.worldView.right);
   const before=frond.view.points.map(p=>p.x);n.update(3200,{cloud:0,rain:0});const moved=frond.view.points.some((p,i)=>p.x!==before[i]);
   for(let i=0;i<120;i++)n.update(3200+i*16,{cloud:.4,rain:.1});
   const stableTextures=s.textures.getTextureKeys().length===textures,stableObjects=s.children.list.length===children;
   const sameGeometry=JSON.stringify({solids:s.L.solids,cave:s.L.cave,roe:s.L.roe})===geometry;
   const anchored=n.fronds.every(f=>Math.abs(f.view.points[16].x)<1e-9&&Math.abs(f.view.points[16].y)<1e-9);
   const layers={water:n.water.images.length,coast:n.coast.images.length,fronds:n.fronds.length,rays:n.rays.length};
   const currentOnly=s.bgFar.visible===false&&s.bgMid.visible===false;
   const bytes=['water','coast','crinoids'].reduce((sum,k)=>{const i=s.textures.get('lagoon_'+k).getSourceImage();return sum+i.width*i.height*4;},0);
   return {webgl:g.renderer.type===2,moved,stableTextures,stableObjects,layers,sameGeometry,anchored,currentOnly,paintedTextureMiB:Math.round(bytes/1048576*10)/10};
  });
  assert.equal(report.webgl,true);assert.equal(report.moved,true);assert.equal(report.stableTextures,true);assert.equal(report.stableObjects,true);assert.equal(report.sameGeometry,true);assert.equal(report.anchored,true);assert.equal(report.currentOnly,true);
  await page.waitForTimeout(500);await page.screenshot({path:folder+'/lagoon-overview.png'});console.log('Overview captured');
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.cameras.main.setZoom(1.22).setScroll(530,100);});
  await page.waitForTimeout(300);await page.screenshot({path:folder+'/lagoon-underwater.png'});
  const cleanup=await page.evaluate(()=>{
   const {game:g}=window.__evo,s=g.scene.getScene('Level'),n=s.nurseryBackdrop;
   const refs=[...n.water.images,...n.coast.images,...n.rays,...n.fronds.map(f=>f.view)];
   s.update=s.__qaUpdate;delete s.__qaUpdate;
   g.scene.stop('Level');g.scene.start('Title');
   return new Promise(resolve=>setTimeout(()=>resolve({released:refs.every(o=>!o.scene),count:refs.length}),200));
  });
  assert.equal(cleanup.released,true);
  await page.evaluate(()=>{const g=window.__evo.game;g.scene.stop('Title');g.scene.start('Level',{epoch:0,place:'garten'});});
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Level');return s.place?.id==='garten'&&s.player?.view&&!s.nurseryBackdrop&&s.bgFar.visible&&s.bgMid.visible;},null,{timeout:60000});
  const otherPlaceUntouched=true;
  await page.evaluate(()=>{window.__evo.game.scene.getScene('Level').scene.restart({epoch:0,place:'riff'});});
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Level');return s.place?.id==='riff'&&s.nurseryBackdrop&&s.player?.view;},null,{timeout:60000});
  const reentered=true;
  assert.deepEqual(errors,[]);
  fs.writeFileSync(folder+'/browser-check.json',JSON.stringify({report,cleanup,otherPlaceUntouched,reentered,errors},null,2)+'\n');console.log(JSON.stringify({report,cleanup,otherPlaceUntouched,reentered,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
