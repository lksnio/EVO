/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_lagoon.cjs.
 * Optional playwright-core and CHROMIUM_PATH. Checks real WebGL composition, water motion, caches and scene cleanup. */
const {chromium}=require('playwright-core');
const path=require('node:path');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
const folder=path.resolve(__dirname,'../art/EVO_nursery_cliff_v3/captures');fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.goto(base+'/?debug&weather=clear');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Title'),null,{timeout:60000});
  await page.evaluate(()=>{const {game:g,state:s}=window.__evo;s.resetAll();s.newRun(0);s.data.seenIntro=true;g.scene.stop('Title');g.scene.start('Level',{epoch:0});});
  await page.waitForFunction(()=>!!window.__evo.game.scene.getScene('Level').nurseryBackdrop,null,{timeout:60000});
  console.log('Revised nursery loaded');
  const report=await page.evaluate(()=>{
   const {game:g,state}=window.__evo,s=g.scene.getScene('Level'),n=s.nurseryBackdrop;
   s.physics.world.pause();s.controls.clear();s.player.invulnUntil=1e12;s.dbg?.setVisible(false);
   g.scene.stop('Hud');s.cameras.main.stopFollow();s.cameras.main.fadeEffect.reset();s.near.k=1;
   state.life.age=240;s.player.refresh(true);
   const x=s.L.cave.x+s.L.cave.w+200;s.player.body.reset(x,260);s.player.view.setPosition(x,260);
   s.cameras.main.setZoom(1.22).setScroll(0,-190);s.cameras.main.preRender();
   s.__qaUpdate=s.sys.sceneUpdate;
   s.sys.sceneUpdate=function(time,delta){this.t+=Math.min(.05,delta/1000);this.environmentStep(time,Math.min(.05,delta/1000),this.player);this.waterSurface?.update(time,this.weather);};
   n.update({cloud:0,rain:0});
   const textures=s.textures.getTextureKeys().length,children=s.children.list.length;
   const geometry=JSON.stringify({solids:s.L.solids,cave:s.L.cave,roe:s.L.roe});
   s.waterSurface.update(1000);const wave=s.waterSurface.bands[0].ropes.find(r=>r.visible),before=wave.points.map(p=>p.y);
   s.waterSurface.update(3200);const waterMoves=wave.points.some((p,i)=>p.y!==before[i]);
   for(let i=0;i<120;i++)n.update({cloud:.4,rain:.1});
   const stableTextures=s.textures.getTextureKeys().length===textures,stableObjects=s.children.list.length===children;
   const sameGeometry=JSON.stringify({solids:s.L.solids,cave:s.L.cave,roe:s.L.roe})===geometry;
   const layers={water:n.water.images.length,coast:1,cliff:2};
   const cliffRegistered=n.cliffAir.x===n.cliffWater.x&&n.cliffAir.y===n.cliffWater.y&&n.cliffAir.scaleX===n.cliffWater.scaleX&&n.cliffAir.scaleY===n.cliffWater.scaleY;
   const cliffCrossesSurface=n.cliffWater.y<s.L.surfaceY-200&&n.cliffWater.y+n.cliffWater.displayHeight>(s.L.cave.y+s.L.cave.h);
   const cliffX=n.cliffWater.x;s.cameras.main.scrollX+=320;s.cameras.main.preRender();n.update({cloud:0,rain:0});
   const landmarkFixed=n.cliffWater.x===cliffX&&n.cliffAir.x===cliffX;
   s.cameras.main.setScroll(0,-190);s.cameras.main.preRender();n.update({cloud:0,rain:0});
   const singleFarShore=!('images' in n.coast)&&n.coast.displayWidth>=s.cameras.main.worldView.width;
   const distantTrees=n.trees.length===4&&n.trees.every(t=>t.image.displayHeight<60);
   const noWaterStripe=n.farSea.y+n.farSea.height<=s.L.surfaceY+12;
   const world={width:s.L.width,height:s.L.height,cave:{x:s.L.cave.x,y:s.L.cave.y,w:s.L.cave.w,h:s.L.cave.h},coastWidth:n.coastWidth,cliffScale:n.cliffAir.scaleX};
   const quietFloor=s.reefScenery.images.every(i=>i.name!=='reef-coral')&&s.reefScenery.near.length===0;
   const noExtraEffects=!('fronds' in n)&&!('rays' in n)&&!s.textures.exists('lagoon_crinoids');
   const currentOnly=s.bgFar.visible===false&&s.bgMid.visible===false;
   const bytes=['water','coast','cliff','trees'].reduce((sum,k)=>{const i=s.textures.get('lagoon_'+k).getSourceImage();return sum+i.width*i.height*4;},0);
   return {webgl:g.renderer.type===2,waterMoves,stableTextures,stableObjects,layers,cliffRegistered,cliffCrossesSurface,landmarkFixed,singleFarShore,distantTrees,noWaterStripe,world,sameGeometry,quietFloor,noExtraEffects,currentOnly,paintedTextureMiB:Math.round(bytes/1048576*10)/10};
  });
  for(const key of ['webgl','waterMoves','stableTextures','stableObjects','sameGeometry','quietFloor','noExtraEffects','currentOnly','cliffRegistered','cliffCrossesSurface','landmarkFixed','singleFarShore','distantTrees','noWaterStripe'])assert.equal(report[key],true,key);
  await page.waitForTimeout(500);await page.screenshot({path:folder+'/lagoon-overview.png'});console.log('Overview captured');
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.body.reset(700,440);s.player.view.setPosition(700,440);s.cameras.main.setZoom(1.22).setScroll(0,180);s.cameras.main.preRender();s.environmentStep(s.time.now,0,s.player);s.waterSurface.update(s.time.now,s.weather);});
  await page.waitForTimeout(300);await page.screenshot({path:folder+'/lagoon-underwater.png'});
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.body.reset(2200,260);s.player.view.setPosition(2200,260);s.cameras.main.setScroll(1700,-190);s.cameras.main.preRender();s.environmentStep(s.time.now,0,s.player);s.waterSurface.update(s.time.now,s.weather);});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').waterSurface.shown,null,{timeout:10000});
  console.log('Away water state',await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return {shown:s.waterSurface.shown,sky:s.waterSurface.sky.visible,view:{x:s.cameras.main.worldView.x,y:s.cameras.main.worldView.y}};}));
  await page.waitForTimeout(300);await page.screenshot({path:folder+'/lagoon-away.png'});
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.body.reset(700,260);s.player.view.setPosition(700,260);s.cameras.main.setZoom(.85).setScroll(0,-280);s.cameras.main.preRender();s.environmentStep(s.time.now,0,s.player);s.waterSurface.update(s.time.now,s.weather);});
  await page.waitForTimeout(300);await page.screenshot({path:folder+'/lagoon-context.png'});
  const cleanup=await page.evaluate(()=>{
   const {game:g}=window.__evo,s=g.scene.getScene('Level'),n=s.nurseryBackdrop;
   const refs=[...n.water.images,n.coast,n.farSea,n.cliffAir,n.cliffWater,...n.trees.map(t=>t.image)];s.sys.sceneUpdate=s.__qaUpdate;delete s.__qaUpdate;
   g.scene.stop('Level');g.scene.start('Title');
   return new Promise(resolve=>setTimeout(()=>resolve({released:refs.every(o=>!o.scene),count:refs.length}),200));
  });
  assert.equal(cleanup.released,true);
  await page.evaluate(()=>{const g=window.__evo.game;g.scene.stop('Title');g.scene.start('Level',{epoch:0,place:'garten'});});
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Level');return s.place?.id==='garten'&&!!s.player?.view&&!s.nurseryBackdrop&&s.bgFar.visible&&s.bgMid.visible&&s.reefScenery.near.length>0;},null,{timeout:60000});
  const otherPlaceUntouched=true;
  await page.evaluate(()=>{window.__evo.game.scene.getScene('Level').scene.restart({epoch:0,place:'riff'});});
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Level');return s.place?.id==='riff'&&!!s.nurseryBackdrop&&!!s.player?.view;},null,{timeout:60000});
  const reentered=true;assert.deepEqual(errors,[]);
  fs.writeFileSync(folder+'/browser-check.json',JSON.stringify({report,cleanup,otherPlaceUntouched,reentered,errors},null,2)+'\n');console.log(JSON.stringify({report,cleanup,otherPlaceUntouched,reentered,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
