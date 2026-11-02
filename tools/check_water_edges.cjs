/** Vite + optional playwright-core/Chromium. Exercises actual surface culling, cave spawning and travel in both directions. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const folder=path.resolve(__dirname,'../art/EVO_water_edges_v1/captures');
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message);});
  await page.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=river');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:60000});
  await page.evaluate(()=>{const e=window.__evo;e.state.newRun(0);e.state.run.sex=1;e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch:0});});
  await page.waitForFunction(()=>window.__evo?.game.scene.getScene('Level').player?.view,null,{timeout:60000});
  console.log('Game ready');
  const present=()=>page.evaluate(()=>new Promise(resolve=>window.__evo.game.events.once('postrender',()=>resolve())));
  const frame=async(name,x,y)=>{
   console.log('Capture',name);
   await page.evaluate(({x,y})=>{
    const e=window.__evo,s=e.game.scene.getScene('Level'),cam=s.cameras.main;
    s.scene.pause();s.physics.world.pause();s.tweens.killAll();s.near.k=1;s.player.body.reset(x,y);s.player.refresh();s.player.view.setPosition(x,y);s.player.view.eyes(0);
    cam.stopFollow();cam.setZoom(.72).centerOn(x,y);cam.fadeEffect.reset();s.dbg?.setVisible(false);
    const hud=e.game.scene.getScene('Hud');hud.scene.pause();hud.children.list.filter(o=>o.type==='Text'&&o.style.fontSize==='46px').forEach(o=>o.setVisible(false));
   },{x,y});
   await present();
   await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.cullAt=0;s.cullStep(s.time.now);s.waterSurface?.update(s.time.now);s.reefScenery?.update(s.time.now,0,s.player);s.mapScenery?.update(s.player);});
   await present();await page.screenshot({path:path.join(folder,name+'.png')});
  };
  const cave=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return{c:s.L.cave,roe:s.L.roe.find(r=>r.own),start:s.L.start,scenes:Object.keys(s.scene.manager.keys)};});
  assert.ok(cave.roe.x>cave.c.x&&cave.roe.x<cave.c.x+cave.c.w);
  assert.ok(!cave.scenes.some(k=>/duel/i.test(k)));
  await frame('laichhoehle',cave.start.x+220,cave.start.y-20);
  report.mate=await page.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),heap=s.L.roe.find(r=>r.own),fromX=1800;
   e.game.loop.sleep();
   const y=Math.min(heap.y-40,s.spawning.groundY(fromX)-80),k=s.spawnKinAt(1,fromX,y);
   let arrived=false,steps=0;
   k.task={x:heap.x,y:heap.y-40,via:s.spawning.mateRoute(fromX),stay:.1,t:0,done:()=>{arrived=true;}};
   s.physics.world.resume();
   for(;steps<2500&&!arrived;steps++){k.taskStep(.05);s.physics.world.update(steps*50,50);s.physics.world.postUpdate();}
   const result={arrived,steps,x:k.x,y:k.y};k.destroy();s.physics.world.pause();e.game.loop.wake();return result;
  });
  assert.equal(report.mate.arrived,true);
  report.nursery=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level'),r=s.L.roe.find(r=>r.own);s.player.body.reset(r.x,r.y-40);s.spawning.update(s.time.now,0);return {grounds:s.spawning.grounds,canVisit:s.spawning.visit()};});
  assert.equal(report.nursery.grounds,true);assert.equal(report.nursery.canVisit,true);
  // Visiting opens a scene; close it before continuing the controlled captures.
  await page.waitForFunction(()=>window.__evo.game.scene.isActive('Roe'));
  await page.evaluate(()=>{const e=window.__evo;e.game.scene.stop('Roe');});
  await frame('laichfluss-oberflaeche',1350,115);
  report.surface=await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Level'),w=s.waterSurface,n=Object.keys(s.textures.list).length;
   w.update(0);const a=w.waves.map(v=>[v.y,v.tilePositionX]);for(let i=1;i<=90;i++)w.update(i*17);
   const b=w.waves.map(v=>[v.y,v.tilePositionX]);return{objects:w.objects.length,animated:JSON.stringify(a)!==JSON.stringify(b),sameTextures:n===Object.keys(s.textures.list).length,sky:s.L.surfaceY-s.cameras.main.getBounds().top};
  });
  assert.deepEqual(report.surface,{objects:5,animated:true,sameTextures:true,sky:270});
  const enter=async(place,edge)=>{
   await page.evaluate(({place,edge})=>{const e=window.__evo;e.game.scene.stop('Roe');e.game.scene.stop('Hud');e.game.scene.stop('Level');e.state.enterPlace(place,edge);e.game.scene.start('Level',{epoch:0,place});},{place,edge});
   await page.waitForFunction(id=>window.__evo.game.scene.getScene('Level').place.id===id&&window.__evo.game.scene.getScene('Level').player?.view,place,{timeout:60000});
  };
  await enter('garten',{side:'right',frac:.15});
  let reef=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return{mid:(s.L.chasm.x0+s.L.chasm.x1)/2,exit:s.L.chasm.exitY,height:s.L.height,sky:s.L.surfaceY-s.cameras.main.getBounds().top};});
  assert.equal(reef.sky,46);assert.ok(reef.exit>reef.height);
  await frame('korallengarten-oberflaeche',1500,100);
  await frame('offener-tiefenzugang',reef.mid,reef.exit-250);
  report.channel=await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Level'),ch=s.L.chasm,mid=(ch.x0+ch.x1)/2;
   s.waterSurface.update(s.time.now);
   return {exit:ch.exitY,height:s.L.height,noFloor:!s.L.groundRects.some(r=>r.x<mid+100&&r.x+r.w>mid-100),surfaceCulled:s.waterSurface.objects.every(o=>!o.visible),bottomOpen:!s.physics.world.checkCollision.down};
  });
  assert.ok(report.channel.noFloor&&report.channel.surfaceCulled&&report.channel.bottomOpen);
  // Start above the old trigger: it must stay in the reef, then actually swim through the bottom border.
  await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Level');s.player.body.reset((s.L.chasm.x0+s.L.chasm.x1)/2,s.L.chasm.exitY-20);s.player.body.setVelocity(0,130);s.travelReadyAt=0;
   s.controls.update=function(){this.held={down:true};this.pressed={};};s.cameras.main.startFollow(s.player.rect,true,.1,.1);s.scene.resume();s.physics.world.resume();
  });
  try { await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').place.id==='wand',null,{timeout:60000}); }
  catch(e) { console.error('Dive state',await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return{place:s.place.id,y:s.player.y,v:s.player.body.velocity,active:s.scene.isActive(),paused:s.scene.isPaused(),ended:s.ended,dead:s.player.dead,ch:s.L.chasm,time:s.time.now,ready:s.travelReadyAt};}));throw e; }
  console.log('Reached deep');
  await page.waitForFunction(()=>!window.__evo.game.textures.exists('__water_travel'),null,{timeout:30000});
  report.deep=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return{place:s.place.id,surface:!!s.waterSurface,velocity:s.player.body.velocity.y};});
  assert.equal(report.deep.surface,false);
  await frame('tiefental-ankunft',reef.mid,650);
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.body.reset(s.L.width/2,s.L.surfaceY+80);s.player.body.setVelocity(0,-120);s.travelReadyAt=0;s.controls.update=function(){this.held={up:true};this.pressed={};};s.scene.resume();s.physics.world.resume();});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').place.id==='garten',null,{timeout:30000});
  await page.waitForFunction(()=>!window.__evo.game.textures.exists('__water_travel'),null,{timeout:30000});
  report.returned=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');return {place:s.place.id,inChannel:Math.abs(s.player.x-(s.L.chasm.x0+s.L.chasm.x1)/2)<100,y:s.player.y};});
  assert.ok(report.returned.inChannel);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');
  console.log(JSON.stringify({report,errors}));
 }finally{await browser.close();}
})();
