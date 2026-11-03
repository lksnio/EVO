/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_attack_eyes.cjs.
 * Uses Chromium and an isolated save. Captures go to EVO_CAPTURE_DIR or /tmp/evo-attack-eyes.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=process.env.EVO_CAPTURE_DIR||'/tmp/evo-attack-eyes';
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
  await page.goto(base+'/?debug&offline&gallery=fish&speed=0&slot=attack-eyes');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
  report.poses=await page.evaluate(async()=>{
   const {CreatureView}=await import('/src/objects/CreatureView.ts');
   const {FaunaView}=await import('/src/objects/FaunaView.ts');
   const {WorldFishView}=await import('/src/objects/WorldFishView.ts');
   const {SPECIES}=await import('/src/data/species.ts');
   const {makeSpeciesTextures,speciesKey}=await import('/src/art/speciesArt.ts');
   const sc=window.__evo.game.scene.getScene('Gallery');sc.scene.pause();
   const m={cls:'fish',size:1,jaw:0.5,skull:0,stealth:0,diet:0,scars:0,belly:1,fierce:0,hue:1,seed:7};
   const v=new CreatureView(sc,-500,-500,m),rig=v.rig;
   const idle=rig.lid.commandBuffer.length;
   const textures=Object.keys(sc.textures.list).length;
   v.bite();v.animate(.08,'swim',0);
   const bite=rig.lid.commandBuffer.length;
   for(let i=0;i<50;i++)v.animate(.02,'swim',0);
   const relaxed=rig.lid.commandBuffer.length;
   v.squint(.8);const ram=rig.lid.commandBuffer.length;
   v.eyes(1);const sleeping=rig.lid.commandBuffer.slice();
   v.squint(0);const sleepWithoutAttack=rig.lid.commandBuffer.slice();
   v.eyes(0);const awake=rig.lid.commandBuffer.length;
   for(let i=0;i<30;i++){v.bite();for(let k=0;k<30;k++)v.animate(.02,'swim',0);}
   const stableTextures=Object.keys(sc.textures.list).length===textures;
   v.destroy();
   // Show the expression in the existing painted artwork, at a readable scale.
   sc.add.rectangle(0,0,1280,720,0x102629).setOrigin(0).setDepth(50);
   const label=(x,y,s)=>sc.add.text(x,y,s,{fontFamily:'Cinzel',fontSize:'18px',color:'#e6dcc4'}).setOrigin(.5).setDepth(52);
   label(330,26,'Ruhe');label(950,26,'Angriff');
   for(const [x,attack]of[[330,false],[950,true]]){
    const own=new CreatureView(sc,x,160,m,3.8).setDepth(51);
    if(attack)own.bite();own.animate(.08,'swim',0);
    const shark=new FaunaView(sc,SPECIES.cladoselache);sc.add.existing(shark);
    shark.setPosition(x,380).setScale(390/shark.naturalWidth).setDepth(51);shark.advance(.05,0,attack?1:0);
    const armor=new FaunaView(sc,SPECIES.dunkleosteus);sc.add.existing(armor);
    armor.setPosition(x,588).setScale(390/armor.naturalWidth).setDepth(51);armor.advance(.05,0,attack?1:0);
   }
   label(640,254,'Eigener Fisch');label(640,465,'Cladoselache');label(640,689,'Dunkleosteus');
   const npc=[];
   for(const id of ['cladoselache','dunkleosteus','moythomasia','bothriolepis']){
    const f=new FaunaView(sc,SPECIES[id]);const before=f.rig.lid.commandBuffer.length;
    // Closed-mouth defenders must also look angry while ramming.
    f.advance(.05,0,0,0,1);const angry=f.rig.lid.commandBuffer.length;
    const anchor=f.rig.lid.x===f.rig.eyeX&&f.rig.lid.y===f.rig.eyeY&&f.rig.lid.rotation===f.rig.eyeRot;
    for(let i=0;i<40;i++)f.advance(.05,0,0,0,0);
    npc.push({id,before,angry,relaxed:f.rig.lid.commandBuffer.length,anchor});f.destroy();
   }
   const def=SPECIES.moythomasia;makeSpeciesTextures(sc,def);
   const world=new WorldFishView(sc,def,sc.textures.get(speciesKey(def.id,0)).getSourceImage().width);
   world.root.setVisible(false);world.animate(.05,0,1);const worldAttack=world.rig.lid.commandBuffer.length;
   for(let i=0;i<60;i++)world.animate(.05,0,0);
   const worldRest=world.rig.lid.commandBuffer.length;world.destroy();
   return{idle,bite,relaxed,ram,awake,sleepPriority:JSON.stringify(sleeping)===JSON.stringify(sleepWithoutAttack),stableTextures,npc,worldAttack,worldRest};
  });
  const p=report.poses;
  assert.ok(p.bite>p.idle&&p.ram>p.idle);assert.ok(p.relaxed<=p.idle&&p.awake<=p.idle);
  assert.equal(p.sleepPriority,true);assert.equal(p.stableTextures,true);
  assert.ok(p.worldAttack>p.worldRest);
  for(const n of p.npc){assert.ok(n.angry>n.before,n.id);assert.ok(n.relaxed<=n.before,n.id);assert.equal(n.anchor,true);}
  await page.screenshot({path:path.join(folder,'ruhe-und-angriff.png')});
  await page.evaluate(()=>{
   const e=window.__evo;e.state.resetAll();e.state.newRun(0);e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch:0});
  });
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player?.view&&window.__evo.game.scene.isActive('Hud'),null,{timeout:120000});
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.player.body.reset(2000,400);s.player.view.eyes(0);s.player.biteReady=0;s.player.ramReady=0;});
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player.view.attackEye>.5);
  report.localBite=true;
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player.view.attackEye===0);
  await page.keyboard.down('KeyR');
  await page.waitForFunction(()=>{const p=window.__evo.game.scene.getScene('Level').player;return p.dash!=='none'&&p.view.attackEye>.5;});
  report.localRam=true;await page.keyboard.up('KeyR');
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player.view.attackEye===0);
  report.networkAndKin=await page.evaluate(async()=>{
   const {RemoteFish}=await import('/src/net/RemoteFish.ts');
   const {ANIM}=await import('/src/net/protocol.ts');
   const {Kin}=await import('/src/objects/Kin.ts');
   const {GhostAnimal}=await import('/src/net/GhostAnimal.ts');
   const {SPECIES}=await import('/src/data/species.ts');
   const sc=window.__evo.game.scene.getScene('Level');sc.scene.pause();
   const look=JSON.stringify(sc.player.morph());
   const row={name:'Test',x:2000,y:400,facing:1,anim:ANIM.bite,look,t:1000,away:false};
   const remote=new RemoteFish(sc,row,1000);remote.update(1000,.016);
   const bite=remote.view.attackEye>.5;
   remote.push({...row,anim:ANIM.ram,facing:-1,t:1020},1020);remote.update(1020,.016);
   const ram=remote.view.attackEye>.5&&remote.view.scaleX<0;
   remote.push({...row,anim:ANIM.swim,t:1040},1040);
   for(let i=0;i<60;i++)remote.update(1040+i*20,.02);
   const rest=remote.view.attackEye===0;remote.destroy();
   const kin=new Kin(sc,SPECIES.kieferlos,2000,400,sc.player.morph(),.8);
   kin.atk='wind';kin.syncView(.016);const kinWind=kin.view.attackEye>.5;
   kin.atk='';kin.attacking=false;kin.onStrike();kin.syncView(.016);const kinBite=kin.view.attackEye>.5;
   for(let i=0;i<60;i++)kin.syncView(.02);
   const kinRest=kin.view.attackEye===0;kin.destroy();
   const g=new GhostAnimal(sc,SPECIES.cladoselache,{id:999,sp:'cladoselache',x:2000,y:400,d:-1,an:0,hp:30,mh:30,sz:1,tn:0,al:100,at:true},performance.now());
   g.faunaView.follow(g,.05,g.width,1,g.attacking);const ghost=g.faunaView.rig.attackEye>.5;g.destroy();
   return{bite,ram,rest,kinWind,kinBite,kinRest,ghost};
  });
  for(const [name,ok]of Object.entries(report.networkAndKin))assert.equal(ok,true,name);
  // A separate load exercises the supported non-mesh player renderer.
  await page.goto(base+'/?debug&offline&oldfish&gallery=fish&speed=0&slot=attack-eyes-legacy');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
  report.legacy=await page.evaluate(()=>{
   const sc=window.__evo.game.scene.getScene('Gallery');sc.scene.pause();const v=sc.views[0];
   const before=v.lid.commandBuffer.length;v.bite();v.animate(.08,'swim',0);const attack=v.lid.commandBuffer.length;
   for(let i=0;i<60;i++)v.animate(.02,'swim',0);
   return{before,attack,after:v.lid.commandBuffer.length};
  });
  assert.ok(report.legacy.attack>report.legacy.before);assert.ok(report.legacy.after<=report.legacy.before);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');
  console.log(JSON.stringify({report,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
