/** Vite on :8080; isolated personal save. node tools/check_lineage.cjs */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=path.resolve(__dirname,'../art/EVO_lineage_time_v1/captures');
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=river&slot=treecheck');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
  await page.evaluate(()=>{const e=window.__evo;e.state.resetAll();e.game.scene.stop('Gallery');e.game.scene.start('Tree',{mode:'view'});});
  await page.waitForFunction(()=>window.__evo.game.scene.isActive('Tree'));
  const capture=async name=>{
   await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Tree').cameras.main.fadeEffect.isRunning,null,{timeout:30000});
   await page.evaluate(()=>new Promise(resolve=>window.__evo.game.events.once('postrender',()=>resolve())));
   await page.screenshot({path:path.join(folder,name+'.png')});
  };
  const click=async(x,y)=>{const b=await page.locator('canvas').first().boundingBox();await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720);};
  report.empty=await page.evaluate(()=>{const e=window.__evo,s=e.game.scene.getScene('Tree');return{runs:s.runs.length,picks:s.picks.length,eras:s.mini.list.filter(c=>c.type==='Text').map(c=>c.text),outsideLevel:!e.game.scene.isActive('Level')};});
  assert.equal(report.empty.runs,0);assert.equal(report.empty.picks,0);assert.equal(report.empty.outsideLevel,true);assert.ok(report.empty.eras.includes('Paläogen'));
  await capture('leer');console.log('Leerer Stammbaum bereit');
  report.played=await page.evaluate(async()=>{
   const e=window.__evo,{WORLD}=await import('/src/data/life.ts');
   const realNow=Date.now;let clock=realNow();const at=years=>{clock=WORLD.start+(383e6-years)/WORLD.yearsPerSecond*1000;};
   Date.now=()=>clock;
   try{
   at(377450000);e.state.newRun(0);
   const egg=(place,seed)=>({place,x:200,y:500,sex:1,seed,traits:{bs:.4,cb:.3,armor:.1}});
   at(377447000);e.state.ageBy(600);e.state.hatchRoe(egg('riff',11),2);
   e.state.enterPlace('garten',{side:'left',frac:.5});
   const before=e.state.data.lineage.runs[0].segments.length;
   at(377444000);e.state.ageBy(600);e.state.hatchRoe(egg('garten',12),3);
   at(377441000);e.state.ageBy(600);e.state.hatchRoe(egg('wand',13),4);
   at(377438000);e.state.ageBy(600);e.state.save();
   e.game.scene.getScene('Tree').scene.restart({mode:'view'});
   return {before,sites:e.state.data.lineage.runs[0].segments.map(s=>s.site.name),births:e.state.data.lineage.runs[0].segments.map(s=>s.births.length),years:e.state.data.lineage.runs[0].segments[0].from-e.state.data.lineage.runs[0].segments.at(-1).to};
   }finally{Date.now=realNow;}
  });
  assert.equal(report.played.before,1);assert.ok(report.played.years>10000);assert.deepEqual(report.played.births,[2,1,1]);
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').picks.length===4);
  await capture('persoenlicher-verlauf');console.log('Eigene Nachkommen bereit');
  const target=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Tree');const p=s.picks.find(p=>p.kind==='birth'&&p.segment.site.place==='garten');return{x:p.x,y:p.y};});
  await click(target.x,target.y);
  report.selection=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Tree');return{place:s.selected.segment.site.place,text:s.info.getByName('lineage-site').text};});
  assert.equal(report.selection.place,'garten');
  await click(1106,563);
  report.mark=await page.evaluate(()=>window.__evo.state.data.lineage.marked);assert.equal(report.mark,'1/s2');
  await capture('laichplatz-markiert');
  await page.keyboard.press('g');
  const full=await page.evaluate(()=>window.__evo.game.scene.getScene('Tree').window);assert.deepEqual(full,{from:419e6,to:23e6});
  await page.keyboard.press('l');
  const before=await page.evaluate(()=>window.__evo.game.scene.getScene('Tree').window);
  const box=await page.locator('canvas').first().boundingBox();await page.mouse.move(box.x+600*box.width/1280,box.y+350*box.height/720);await page.mouse.wheel(0,-120);
  await page.waitForFunction(span=>{const w=window.__evo.game.scene.getScene('Tree').window;return w.from-w.to<span;},before.from-before.to);
  report.zoom=await page.evaluate(()=>window.__evo.game.scene.getScene('Tree').window);
  const panBefore=report.zoom.from;await page.mouse.down();await page.mouse.move(box.x+600*box.width/1280,box.y+410*box.height/720,{steps:6});await page.mouse.up();
  await page.waitForFunction(v=>window.__evo.game.scene.getScene('Tree').window.from>v,panBefore);
  report.pan=true;
  await page.evaluate(()=>{const e=window.__evo;e.state.load('treecheck');e.game.scene.getScene('Tree').scene.restart({mode:'view'});});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').selected?.segment.id==='s2');
  report.reload=await page.evaluate(()=>({marked:window.__evo.state.data.lineage.marked,runs:window.__evo.state.data.lineage.runs.length}));assert.equal(report.reload.marked,'1/s2');
  // Same chosen egg in another player's slot must not copy a personal tree or its mark.
  const peer=await browser.newPage();await peer.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=river&slot=treepeer');
  await peer.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
  report.personal=await peer.evaluate(()=>{const e=window.__evo;e.state.resetAll();e.state.newRun(0);e.state.hatchRoe({place:'riff',x:200,y:500,sex:1,seed:12,traits:{bs:.4,cb:.3,armor:.1}},3);return{sites:e.state.data.lineage.runs[0].segments.length,marked:e.state.data.lineage.marked??null};});
  assert.deepEqual(report.personal,{sites:1,marked:null});await peer.close();await page.bringToFront();
  // Isolated future preview, not gameplay unlocks or published save data.
  await page.evaluate(async()=>{
   const e=window.__evo,{newLineage,recordBirth,observeLineage}=await import('/src/sim/lineage.ts');
   const a=newLineage(),names=['Laichfluss','Küstenlagune','Trockenes Ufer','Waldsee','Felsküste','Hochlandfluss','Bergwald'];
   const cls=['fish','fish','amphibian','reptile','reptile','mammal','mammal'];
   const dates=[383,350,285,230,179,110,51];
   dates.forEach((date,i)=>{
    const r=recordBirth(a,1,i,date*1e6,i*8+1,{key:'preview:'+i,place:'preview',name:names[i],x:0,y:0},
     {cls:cls[i],traits:{jaw:.08*i,cb:.1*i,limb:i>1?.5:0},hue:i%4,seed:i+9,sex:1});
    observeLineage(r,(date-9)*1e6,4800);
   });
   e.state.data.lineage=a;e.game.scene.getScene('Tree').scene.restart({mode:'view'});
  });
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').picks.length===8);
  await page.keyboard.press('g');
  report.preview=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Tree');return{knots:s.picks.filter(p=>p.kind==='birth').length,monotonic:s.picks.every((p,i,a)=>i===0||p.y>=a[i-1].y)};});
  assert.equal(report.preview.knots,7);assert.equal(report.preview.monotonic,true);
  await capture('sieben-epochen-vorschau');
  // Check keyboard navigation after each actual event; rapid queued key events are not a cache test.
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Tree');s.select(s.picks[5]);});
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(()=>{const p=window.__evo.game.scene.getScene('Tree').selected;return p.segment.id==='s7'&&p.kind==='birth';});
  await page.keyboard.up('ArrowDown');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').selected.segment.id==='s6');
  await page.keyboard.up('ArrowUp');
  report.keyboard=true;
  // Warm both inspected forms and wait for their canvas textures to be presented.
  const inspect=async n=>{
   await page.evaluate(n=>{const s=window.__evo.game.scene.getScene('Tree'),points=s.picks.slice(-2);for(let i=0;i<n;i++)s.select(points[i%2]);},n);
   await page.evaluate(()=>new Promise(resolve=>window.__evo.game.events.once('postrender',()=>resolve())));
   return page.evaluate(()=>Object.keys(window.__evo.game.textures.list));
  };
  const warmedKeys=await inspect(4),finalKeys=await inspect(28);
  report.textures={before:warmedKeys.length,after:finalKeys.length,newKeys:finalKeys.filter(k=>!warmedKeys.includes(k))};
  console.log('Texturen',JSON.stringify(report.textures));assert.equal(report.textures.after,report.textures.before);
  // Extinction is kept in the archive and the next run gets its own trace.
  report.extinct=await page.evaluate(()=>{
   const e=window.__evo;e.state.resetAll();e.state.newRun(0);e.state.ageBy(60);e.state.extinct(.3,'Test');e.state.newRun(0);
   for(let i=0;i<3;i++){e.state.extinct(.4,'Test');e.state.newRun(0);}
   e.game.scene.getScene('Tree').scene.restart({mode:'view'});
   return e.state.data.lineage.runs.map(r=>r.status);
  });
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').page===1);
  assert.equal(report.extinct.filter(s=>s==='extinct').length,4);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Tree').page===0);
  assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('Tree').page),0);
  report.paging=true;
  await capture('mehrere-laeufe');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__evo.game.scene.isActive('Title'));
  report.title=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Title');return s.children.list.some(c=>c.list?.some(t=>t.text==='Stammbaum'));});
  assert.equal(report.title,true);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');console.log(JSON.stringify({report,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
