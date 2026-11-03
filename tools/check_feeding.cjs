/** Vite running: node tools/check_feeding.cjs. Isolated save and real Phaser actors. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=path.resolve(__dirname,'../art/EVO_feeding_v1/captures');
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=river&slot=feedcheck');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
  await page.evaluate(()=>{const e=window.__evo;e.state.resetAll();e.state.newRun(0);e.state.enterPlace('garten',{side:'left',frac:.3});e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch:0,place:'garten'});});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').player?.view&&window.__evo.game.scene.isActive('Hud'),null,{timeout:120000});
  console.log('Korallengarten bereit');
  await page.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();
   for(const a of [...s.animals]){s.dropAnimal(a);a.destroy();}
   s.player.body.reset(1500,600);s.player.facing=1;s.player.refresh();s.player.view.setPosition(1500,600);
   s.cameras.main.stopFollow();s.cameras.main.centerOn(1500,600);s.cameras.main.fadeEffect.reset();s.dbg?.setVisible(false);
   const original=s.floatNum.bind(s);s.testFoodLabels=[];s.floatNum=(x,y,n,kind)=>{s.testFoodLabels.push({x,y,n,kind});original(x,y,n,kind);};
  });
  report.whole=await page.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),p=s.player,r=p.biteRect();
   const a=s.spawnAnimal('moythomasia',r.x+r.w/2,r.y+r.h/2);p.stats.bite=a.maxHp*2;p.stats.digestMeat=2;
   const food=e.state.life.fed;s.playerBite(r);
   return {dead:a.dead,food:e.state.life.fed-food,meat:s.meats.length,labels:s.testFoodLabels.map(v=>v.n),species:e.state.topPrey().top.find(r=>r.id==='moythomasia')?.count};
  });
  assert.deepEqual(report.whole,{dead:true,food:1,meat:0,labels:[1],species:1});
  report.wounded=await page.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),p=s.player,r=p.biteRect();
   const a=s.spawnAnimal('coccosteus',r.x+r.w/2,r.y+r.h/2);a.hp=1;p.stats.bite=2;
   const food=e.state.life.fed;s.playerBite(r);
   return {dead:a.dead,food:e.state.life.fed-food,meat:s.meats.length,fullHealth:a.maxHp};
  });
  assert.equal(report.wounded.dead,true);assert.equal(report.wounded.food,0);assert.ok(report.wounded.meat>0);assert.ok(report.wounded.fullHealth>2);
  // Let death flashes finish before capturing the separate food labels.
  const before=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.scene.resume();return s.time.now;});
  await page.waitForFunction(start=>window.__evo.game.scene.getScene('Level').time.now>start+1500,before,{timeout:120000});
  await page.evaluate(()=>window.__evo.game.scene.getScene('Level').scene.pause());
  report.multiple=await page.evaluate(async()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),p=s.player,r=p.biteRect();
   for(const m of s.meats)m.remove();s.meats=[];s.testFoodLabels=[];
   const {Kill,Meat}=await import('/src/objects/Food.ts'),kill=new Kill(true,'coccosteus','mouth-test');
   const x=r.x+r.w/2,y=r.y+r.h/2;
   const a=new Meat(s,s,x-5,y,5,s.time.now,kill),b=new Meat(s,s,x+5,y,5,s.time.now,kill),far=new Meat(s,s,x+600,y,5,s.time.now,kill);
   s.meats.push(a,b,far);p.stats.digestMeat=1.6;
   const food=e.state.life.fed;s.playerBite(r);
   return {food:e.state.life.fed-food,eaten:[a.gone,b.gone],far:far.value,labels:s.testFoodLabels.map(l=>l.n),positions:s.testFoodLabels.map(l=>l.x),species:e.state.topPrey().top.find(r=>r.id==='coccosteus')?.count};
  });
  assert.equal(report.multiple.food,16);assert.deepEqual(report.multiple.eaten,[true,true]);assert.equal(report.multiple.far,5);
  assert.deepEqual(report.multiple.labels,[8,8]);assert.notEqual(...report.multiple.positions);assert.equal(report.multiple.species,1);
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Level');s.scene.resume();s.physics.world.pause();});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').children.list.filter(c=>c.name==='food-gain'&&c.text==='+8'&&c.alpha>.4).length===2,null,{timeout:120000});
  await page.evaluate(()=>window.__evo.game.scene.getScene('Level').scene.pause());
  await page.screenshot({path:path.join(folder,'zwei-happen.png')});
  report.strong=await page.evaluate(()=>{
   const e=window.__evo,s=e.game.scene.getScene('Level'),p=s.player,r=p.biteRect();
   const a=s.spawnAnimal('coccosteus',r.x+r.w/2,r.y+r.h/2);p.stats.bite=a.maxHp*2;p.stats.digestMeat=3;
   const food=e.state.life.fed,meat=s.meats.filter(m=>!m.gone).length;s.playerBite(r);
   return {food:e.state.life.fed-food,newMeat:s.meats.filter(m=>!m.gone).length-meat,dead:a.dead};
  });assert.deepEqual(report.strong,{food:1,newMeat:0,dead:true});
  report.swimming=await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Level'),a=s.spawnAnimal('cladoselache',2200,600);
   a.wanderX=2700;a.wanderY=600;a.wanderAt=Infinity;
   const speeds=[];
   for(let i=0;i<1200;i++){a.t=i/20;a.wander(s.time.now);if(i>30)speeds.push(Math.hypot(a.b.velocity.x,a.b.velocity.y));}
   return {min:Math.min(...speeds),max:Math.max(...speeds),base:a.def.speed,fastFraction:speeds.filter(v=>v>a.def.speed).length/speeds.length};
  });
  assert.ok(report.swimming.max/report.swimming.min>1.3);assert.ok(report.swimming.fastFraction>.35);
  report.flank=await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Level'),p=s.player,a=s.animals.find(a=>a.def.id==='cladoselache'&&!a.dead);
   a.setPosition(p.x+200,p.y);a.b.setVelocity(0,0);a.startBite(p);const start=a.y,health=p.hp;
   const end=a.plan.wind*.75;
   for(let t=0;t<end;t+=1/60){a.attackStep(s.time.now,1/60);a.setPosition(a.x+a.b.velocity.x/60,a.y+a.b.velocity.y/60);}
   const side=Math.abs(a.y-start),phase=a.atk;
   a.atk='recover';a.atkT=0;a.b.setVelocity(0,0);a.attackStep(s.time.now,1/60);
   return {side,phase,damage:health-p.hp,recoverySpeed:Math.hypot(a.b.velocity.x,a.b.velocity.y)};
  });
  assert.ok(report.flank.side>2);assert.equal(report.flank.phase,'wind');assert.equal(report.flank.damage,0);assert.ok(report.flank.recoverySpeed>0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');console.log(JSON.stringify({report,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
