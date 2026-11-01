/**
 * Optional visual/integration check. Run Vite first (npm run dev -- --strictPort).
 * Install playwright-core outside the checkout, then e.g.:
 * NODE_PATH=/tmp/evo-browser/node_modules node tools/check_fauna.cjs
 * Requires Chromium (CHROMIUM_PATH, default /usr/bin/chromium).
 * EVO_BASE_URL defaults to the local development server on port 8080.
 * Captures real WebGL screenshots and compares physics, bite geometry and rig lifecycle.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.EVO_BASE_URL || 'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const folder=path.resolve(__dirname, '../art/vorlagen/fisch/aufnahmen/fauna') + '/';
 require('node:fs').mkdirSync(folder,{recursive:true});
 const cases=[
 ['strahlenflosser','gallery=world&cols=4&zoom=1.3'],
 ['gruppen','gallery=fauna&ids=cheirolepis,moythomasia,cladoselache,stethacanthus,osteolepis,hyneria,dunkleosteus,rhizodus,bothriolepis,cephalaspis,orthoceras,pterygotus'],
 ['devon_weitere','gallery=fauna&ids=acanthodes,thelodus,kieferlos,cheiracanthus,drepanaspis,dipterus,pteraspis,pterichthyodes,climatius,conodont,trilobit,dalmanites'],
 ['biss','gallery=fauna&hold=1&ids=cladoselache,stethacanthus,rolfosteus,eusthenopteron,holoptychius,tiktaalik,dunkleosteus,hyneria,rhizodus,orthoceras,seeskorpion,megalograptus'],
 ...[45,70,90].map(px=>['klein_'+px+'px','gallery=fauna&px='+px+'&ids=cheirolepis,moythomasia,cladoselache,stethacanthus,bothriolepis,cephalaspis,dunkleosteus,hyneria,rhizodus,trilobit,qualle,pterygotus']),
 ['kopfpanzer_biss','gallery=fish&hold=1&set='+encodeURIComponent(JSON.stringify([['Panzer',{skull:1,spike:-1}],['Panzer + Gebiss',{skull:1,spike:-1,jaw:1,diet:1}]]))],
 ['kopfpanzer','gallery=fish&set='+encodeURIComponent(JSON.stringify([['ohne',{}],['mittel',{skull:.35,spike:-.3}],['maximal',{skull:1,spike:-1}],['Panzer + Gebiss',{skull:1,spike:-1,jaw:1,diet:1}],['kurz + Panzer',{skull:1,spike:-1,len:-1,girth:1}],['lang + Panzer',{skull:1,spike:-1,len:1,girth:-1}]]))],
 ];
 for(const [name,query] of (process.argv.includes('--quick') ? [['quick','gallery=fauna&ids=cladoselache']] : process.argv.includes('--merge') ? cases.filter(([name])=>['gruppen','strahlenflosser','kopfpanzer','kopfpanzer_biss'].includes(name)) : process.argv.includes('--sizes') ? cases.filter(([name])=>name.startsWith('klein_')||name==='kopfpanzer_biss') : cases)){
   await page.goto(base+'/?debug&'+query);
   await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:60000});
   await page.waitForTimeout(1200);
   await page.screenshot({path:folder+name+'.png'});
 }
 if(process.argv.includes('--sizes')||process.argv.includes('--merge')){await browser.close();assert.deepEqual(errors,[]);console.log('Visual captures passed');return;}
 // The real Level scene, with existing player, sight layer, physics and NPC lifecycle.
 await page.evaluate(async()=>{
   const e=window.__evo;
   const {EPOCHS}=await import('/src/data/epochs.ts');
   const epoch=EPOCHS.findIndex(e=>e.id==='devon');
   e.state.newRun(epoch);
   e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch});
 });
 await page.waitForFunction(()=>window.__evo?.game.scene.getScene('Level').player?.view,null,{timeout:60000});
 await page.waitForTimeout(1500);
 const result=await page.evaluate(async()=>{
   const {Animal}=await import('/src/objects/Animal.ts');
   const {GhostAnimal}=await import('/src/net/GhostAnimal.ts');
   const {SPECIES}=await import('/src/data/species.ts');
   const {makeSpeciesTextures}=await import('/src/art/speciesArt.ts');
   const sc=window.__evo.game.scene.getScene('Level');
   const snapshot=a=>({w:a.b.sourceWidth,h:a.b.sourceHeight,ox:a.b.offset.x,oy:a.b.offset.y,bite:a.biteRect()});
   const tests=[];
   for(const id of ['cheirolepis','moythomasia','gillicus','enchodus','protosphyraena','xiphactinus','cladoselache','dunkleosteus','bothriolepis','orthoceras','trilobit','pterygotus','qualle']){
     makeSpeciesTextures(sc,SPECIES[id]);
     history.replaceState(null,'','/?debug&oldfauna');
     const old=new Animal(sc,SPECIES[id],sc.player.x+200,sc.player.y);old.setScale(1);old.b.updateFromGameObject();old.dir=1;
     history.replaceState(null,'','/?debug');
     const a=new Animal(sc,SPECIES[id],old.x,old.y);a.setScale(1);a.b.updateFromGameObject();a.dir=1;
     const initial={old:snapshot(old),rig:snapshot(a)};
     old.showJaw(2);a.showJaw(2);
     const jaw={old:snapshot(old),rig:snapshot(a)};
     a.setFlipX(true).setAngle(17).setAlpha(.37).setTint(0xff7460);
     a.faunaView.follow(a,.016,a.width,1);
     const view=a.faunaView;
     const renderables=[];
     const collect=container=>{for(const child of container.list){if(child.list)collect(child);else if(typeof child.setTint==='function')renderables.push(child);}};
     collect(view);
     const sync={alpha:view.alpha,rotation:view.rotation,flipped:view.scaleX<0,tint:renderables.every(p=>(p.tintTopLeft ?? p.tint)===0xff7460&&p.tintMode===a.tintMode)};
     a.clearTint();view.follow(a,.016,a.width,0);
     const cleared=renderables.every(p=>!(typeof p.isTinted==='function' ? p.isTinted() : p.isTinted));
     a.destroy();old.destroy();
     tests.push({id,initial,jaw,sync,cleared,destroyed:view.scene===undefined||view.scene===null});
   }
   const def=SPECIES.cladoselache;
   const row={id:999,sp:def.id,x:sc.player.x+300,y:sc.player.y,d:-1,an:12,hp:30,mh:45,sz:1,tn:0xff7460,al:70,at:true};
   const ghost=new GhostAnimal(sc,def,row,performance.now());
   ghost.tick(0,.016);ghost.setAlpha(.42);ghost.faunaView.follow(ghost,.016,ghost.width,1);
   const ghostSync={bodyEnabled:ghost.b.enable,alpha:ghost.faunaView.alpha,flipped:ghost.faunaView.scaleX<0};
   ghost.destroy();
   return {tests,ghostSync,animals:sc.animals.length,rigged:sc.animals.filter(a=>!!a.faunaView).length};
 });
 for(const t of result.tests){assert.deepEqual(t.initial.old,t.initial.rig,t.id+' initial physics');assert.deepEqual(t.jaw.old,t.jaw.rig,t.id+' jaw physics');assert.equal(t.sync.alpha,.37);assert.equal(t.sync.tint,true);assert.equal(t.cleared,true);assert.equal(t.sync.flipped,true);assert.ok(Math.abs(t.sync.rotation-17*Math.PI/180)<1e-10);assert.equal(t.destroyed,true);}
 assert.equal(result.ghostSync.bodyEnabled,false);assert.equal(result.ghostSync.alpha,.42);assert.equal(result.ghostSync.flipped,true);
 // Finish the camera fade for the still capture; slow software WebGL can take much longer than wall-clock waits.
 await page.evaluate(()=>{for(const s of window.__evo.game.scene.getScenes(true))s.cameras.main.fadeEffect.reset();});
 await page.waitForTimeout(500);
 const levelState=await page.evaluate(()=>{const g=window.__evo.game,s=g.scene.getScene('Level');return {active:g.scene.getScenes(true).map(s=>s.sys.settings.key),ended:s.ended,dead:s.player.dead,children:s.children.length,fade:s.cameras.main.fadeEffect.progress};});
 console.log(JSON.stringify({levelState}));
 await page.screenshot({path:folder+'spiel.png'});
 console.log(JSON.stringify({checkedSpecies:result.tests.map(t=>t.id),physicsAndBites:'unchanged',visibilityTintLifecycle:'passed',ghostSync:result.ghostSync,animals:result.animals,rigged:result.rigged,errors}));assert.deepEqual(errors,[]);
 await browser.close();
})();
