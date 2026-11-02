/** With Vite running: NODE_PATH=/tmp/evo-browser/node_modules node tools/check_wiki_dipterus.cjs. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=path.resolve(__dirname,'../art/EVO_wiki_dipterus_v1/captures');fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[],report={};let release;
 const gate=new Promise(resolve=>{release=resolve});let paintingRequests=0;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.route('**/dipterus.webp',async route=>{paintingRequests++;await gate;await route.continue();});
  await page.goto((process.env.EVO_BASE_URL||'http://127.0.0.1:8080')+'/?debug&offline&gallery=river');
  await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:60000});
  report.first=await page.evaluate(async()=>{
   const e=window.__evo,{SECTIONS}=await import('/src/data/aquapendium.ts');
   e.state.resetAll();e.game.scene.stop('Gallery');e.game.scene.start('Aquapendium',{epoch:0,page:1});
   return {id:SECTIONS[0].entries[0].id,latin:SECTIONS[0].entries[0].latin};
  });
  assert.equal(report.first.id,'dipterus');
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Aquapendium').pictures.get('dipterus')?.texture,null,{timeout:30000});
  report.unknown=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Aquapendium'),img=s.pictures.get('dipterus');s.cameras.main.fadeEffect.reset();return {texture:img.texture.key,customTexture:s.textures.exists('aqpimg_dipterus'),known:window.__evo.state.hasSeen('dipterus')};});
  assert.equal(report.unknown.known,false);assert.equal(report.unknown.customTexture,false);assert.notEqual(report.unknown.texture,'aqpimg_dipterus');assert.equal(paintingRequests,0);
  await page.screenshot({path:path.join(folder,'dipterus-unentdeckt.png')});
  console.log('Unknown entry remains a fish silhouette');
  await page.evaluate(()=>{const e=window.__evo;e.game.scene.stop('Aquapendium');e.state.markSeen('dipterus');e.game.scene.start('Aquapendium',{epoch:0,page:1});});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Aquapendium').pending.has('aqpimg_dipterus'),null,{timeout:30000});
  // Leave and return while the image is deliberately still loading. The current page must receive the result.
  await page.evaluate(()=>window.__evo.game.scene.getScene('Aquapendium').go(2));
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Aquapendium');return s.page===2&&!s.busy;});
  report.next=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Aquapendium');return [...s.pictures.entries()].map(([id,img])=>({id,texture:img.texture.key})).find(r=>r.id!=='dipterus');});
  await page.evaluate(()=>window.__evo.game.scene.getScene('Aquapendium').go(1));
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Aquapendium');return s.page===1&&!s.busy;});
  release();
  await page.waitForFunction(()=>{const s=window.__evo.game.scene.getScene('Aquapendium');return s.cur?.list.some(o=>o.name==='aqp-picture-dipterus'&&o.texture?.key==='aqpimg_dipterus');},null,{timeout:30000});
  report.known=await page.evaluate(()=>{
   const s=window.__evo.game.scene.getScene('Aquapendium'),img=s.pictures.get('dipterus');s.cameras.main.fadeEffect.reset();
   const bounds=img.getBounds();
   return {texture:img.texture.key,sourceWidth:img.width,sourceHeight:img.height,width:img.displayWidth,height:img.displayHeight,x:bounds.x,y:bounds.y,right:bounds.right,bottom:bounds.bottom,paintings:s.cur.list.filter(o=>o.name==='aqp-picture-dipterus').length,pending:s.pending.size};
  });
  assert.equal(report.known.texture,'aqpimg_dipterus');assert.equal(report.known.paintings,1);assert.equal(report.known.pending,0);
  assert.ok(report.known.x>=132+8&&report.known.right<=592-8);assert.ok(report.known.y>=122+8&&report.known.bottom<=492-8);
  assert.ok(Math.abs(report.known.width/report.known.height-report.known.sourceWidth/report.known.sourceHeight)<.0001);
  assert.equal(paintingRequests,1);
  await page.screenshot({path:path.join(folder,'dipterus-wiki.png')});
  // A cached visit reuses one image texture and has no leftover portrait or duplicate painting.
  const textureCount=await page.evaluate(()=>Object.keys(window.__evo.game.textures.list).length);
  await page.evaluate(()=>window.__evo.game.scene.getScene('Aquapendium').go(2));
  await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Aquapendium').busy);
  await page.evaluate(()=>window.__evo.game.scene.getScene('Aquapendium').go(1));
  await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Aquapendium').busy);
  report.revisit=await page.evaluate(n=>{const s=window.__evo.game.scene.getScene('Aquapendium');return {texture:s.pictures.get('dipterus').texture.key,sameTextures:Object.keys(s.textures.list).length===n,paintings:s.cur.list.filter(o=>o.name==='aqp-picture-dipterus').length};},textureCount);
  assert.equal(report.revisit.sameTextures,true);assert.equal(report.revisit.paintings,1);assert.equal(report.revisit.texture,'aqpimg_dipterus');assert.equal(paintingRequests,1);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,paintingRequests,errors},null,2)+'\n');console.log(JSON.stringify({report,paintingRequests,errors}));
 }finally{release();await browser.close();}
})();
