/** Vite + playwright-core/Chromium. Real sprites, rigs, hitboxes, replicas, readable size ratios and spawn clearance. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=path.resolve(__dirname,'../art/EVO_real_sizes_v1/captures');fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[];const report={};
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await p.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=sizes');
  await p.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:60000});
  console.log('Size comparison ready');
  await p.screenshot({path:path.join(folder,'groessenvergleich.png')});
  await p.evaluate(()=>{const e=window.__evo;e.state.newRun(0);e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch:0});});
  await p.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player?.view,null,{timeout:60000});
  console.log('River ready');
  report.animals=await p.evaluate(async()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();e.game.loop.sleep();
   const {SPECIES}=await import('/src/data/species.ts');
   const {adultLengthCm,playLengthCm,worldLength,spriteReferenceSpan}=await import('/src/data/animalSize.ts');
   const {makeSpeciesTextures}=await import('/src/art/speciesArt.ts');
   const {GhostAnimal}=await import('/src/net/GhostAnimal.ts');
   const rows=[];
   for(const def of Object.values(SPECIES)){
    makeSpeciesTextures(s,def);
    const a=s.spawnAnimal(def.id,1500,300);a.sz=1;a.setSizeFactor();a.b.updateBounds();
    const reference=spriteReferenceSpan(def,a.width),expected=worldLength(def),width=reference*a.scaleX;
    const hp=a.hp,mh=a.maxHp,bw=a.b.width,base=a.bodyScale;
    if(Math.abs(width-expected)>.001)throw Error(def.id+' inconsistent body length');
    a.setSizeFactor(.55);if(Math.abs(reference*a.scaleX-expected*.55)>.001)throw Error('juvenile '+def.id);
    a.setSizeFactor(1.12,.91);a.setSizeFactor();if(Math.abs(a.scaleX-base)>.001)throw Error('pose reset '+def.id);
    if(a.hp!==hp||a.maxHp!==mh)throw Error('size changed health '+def.id);
    const row={id:999,sp:def.id,x:a.x,y:a.y,d:1,an:0,hp,mh,sz:.93,tn:0,al:100,at:false};
    const g=new GhostAnimal(s,def,row,1000);if(Math.abs(g.scaleX-base*.93)>.001)throw Error('replica '+def.id);
    g.destroy();
    rows.push({id:def.id,cm:adultLengthCm(def),playCm:playLengthCm(def),worldLength:expected,bodyPixels:width,bodyScale:base,collisionWidth:bw,collisionHeight:a.b.height,textureWidth:a.width,textureHeight:a.height});
    s.dropAnimal(a);a.destroy();
   }
   e.game.loop.wake();return rows;
  });
  assert.equal(report.animals.length,68);
  const smallest=report.animals.find(a=>a.id==='moythomasia'),largest=report.animals.find(a=>a.id==='mosasaurus');
  assert.ok(smallest.bodyPixels*.72*.86>=20);
  assert.ok(report.animals.every(a=>a.bodyPixels*.72*.86>=14));
  assert.ok(largest.bodyPixels>1500);
  assert.ok(largest.bodyPixels/smallest.bodyPixels<1500/6);
  assert.ok(report.animals.find(a=>a.id==='dunkleosteus').playCm===340);
  report.resources=await p.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level');const n=Object.keys(s.textures.list).length;
   const actors=s.animals.filter(a=>!a.kin);for(let f=0;f<80;f++)for(const a of actors){a.setSizeFactor(a.sz*1.04,a.sz*.96);a.setSizeFactor(a.sz);}
   return{sameTextures:Object.keys(s.textures.list).length===n,maxTextureDimension:Math.max(...Object.values(s.textures.list).map(t=>Math.max(t.getSourceImage()?.width||0,t.getSourceImage()?.height||0)))};
  });
  assert.ok(report.resources.sameTextures);
  report.river=await p.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),cam=s.cameras.main;
   s.tweens.killAll();cam.fadeEffect.reset();s.dbg?.setVisible(false);s.near.k=1;cam.stopFollow().setZoom(.72).centerOn(1600,360);
   const h=e.game.scene.getScene('Hud');h.scene.pause();h.children.list.filter(o=>o.type==='Text'&&o.style.fontSize==='46px').forEach(o=>o.setVisible(false));
   s.player.body.reset(1350,300);s.player.view.setPosition(1350,300).eyes(0);return {animals:s.animals.length};
  });
  await p.evaluate(()=>new Promise(r=>window.__evo.game.events.once('postrender',()=>r())));
  await p.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.cullAt=0;s.cullStep(s.time.now);s.waterSurface?.update(s.time.now);});
  await p.screenshot({path:path.join(folder,'laichfluss.png')});
  await p.evaluate(()=>{const e=window.__evo;e.game.scene.stop('Hud');e.game.scene.stop('Level');e.state.enterPlace('wand',{side:'top',frac:0});e.game.scene.start('Level',{epoch:0,place:'wand'});});
  await p.waitForFunction(()=>window.__evo.game.scene.getScene('Level').place.id==='wand'&&window.__evo.game.scene.getScene('Level').player?.view,null,{timeout:60000});
  report.valley=await p.evaluate(async()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();
   const {groundCurve}=await import('/src/level/terrain.ts');
   return s.animals.filter(a=>!a.def.crawl&&a.def.habitat==='water').map(a=>{
    a.b.updateBounds();const r=a.hitRect(),floor=groundCurve(s.L.terrain.hp,a.x);
    return{id:a.def.id,height:a.b.height,bodyBottom:r.y+r.h,floor,embedded:r.y+r.h>floor+2};
   });
  });
  assert.ok(report.valley.every(a=>!a.embedded));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');
  console.log(JSON.stringify({animals:report.animals.length,resources:report.resources,swimmersChecked:report.valley.length,embeddedSwimmers:report.valley.filter(a=>a.embedded).length,errors}));
 }finally{await b.close();}
})();
