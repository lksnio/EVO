/** Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_editor.cjs.
 * Real editor gestures, draft reload, export/import, epoch switch, collision preview and project-save -> main-game integration.
 * Restores the project registry after the save test. Use an isolated local development server.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.EVO_BASE_URL||'http://127.0.0.1:8080';
const registry=path.resolve(__dirname,'../src/data/maps/worlds.json');
const original=fs.readFileSync(registry,'utf8');
const output=path.resolve(__dirname,'../art/EVO_world_editor_v1/captures');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[];let wrote=false;
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const frames=async(n=2)=>{const f=await page.evaluate(()=>window.__evo.game.loop.frame);await page.waitForFunction(({f,n})=>window.__evo.game.loop.frame>f+n,{f,n},{timeout:90000});};
 try{
  if(process.argv.includes('--footpoints')){
   await page.goto(base+'/?offline&editor=devon:garten');await page.waitForSelector('[data-asset="reef_unit_ribbon"]',{timeout:90000});
   const before=await page.evaluate(()=>JSON.stringify(window.__evo.state.data));
   await page.locator('[data-asset="reef_unit_ribbon"]').click();
   await page.getByLabel('Bodenabstand',{exact:true}).fill('-40');await page.getByLabel('Bodenabstand',{exact:true}).press('Tab');
   await page.getByRole('button',{name:'Auf Boden setzen',exact:true}).click();
   const x=await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.at(-1).x);
   await page.getByLabel('X',{exact:true}).fill(String(x-230));await page.getByLabel('X',{exact:true}).press('Tab');
   await page.locator('.inspector select').first().selectOption('front');await frames();
   const foot=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('WorldEditor'),o=s.map.objects.at(-1),img=s.view.scenery.images.get(o.id);return {offset:o.y,x:o.x,y:img.y,grounded:o.grounded};});
   assert.equal(foot.offset,5);assert.equal(foot.grounded,true);assert.equal(foot.x,x-230);
   const cam=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('WorldEditor');s.cameras.main.scrollX+=200;return s.cameras.main.scrollX;});await frames();
   const after=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('WorldEditor'),o=s.map.objects.at(-1),img=s.view.scenery.images.get(o.id);return {x:img.x,y:img.y};});assert.equal(after.x,foot.x);assert.equal(after.y,foot.y);assert.ok(Number.isFinite(cam));
   await page.screenshot({path:path.join(output,'editor.png')});
   await page.getByRole('button',{name:'Menü',exact:true}).click();await page.waitForFunction(()=>window.__evo.game.scene.isActive('Title'),null,{timeout:90000});
   assert.equal(await page.locator('.evo-editor').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(window.__evo.state.data)),before);assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(output,'footpoint-check.json'),JSON.stringify({snapToGround:true,numericMovePreservedGroundOffset:true,cameraPreservedFeet:true,menuCleanup:true,unchangedRun:true,errors},null,2)+'\n');console.log('Footpoint and menu checks passed');return;
  }
  console.log('Open editor from menu');
  await page.goto(base+'/?offline');await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Title'),null,{timeout:90000});
  await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('Title');const entry=s.children.list.find(o=>o.list?.some(c=>c.text==='Weltbaukasten'));if(!entry)throw Error('Editor menu entry missing');entry.zone.emit('pointerdown');});
  await page.waitForSelector('[data-asset="reef_unit_ribbon"]',{timeout:90000});
  const runBefore=await page.evaluate(()=>JSON.stringify(window.__evo.state.data));
  const initial=await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.length);
  await page.locator('[data-asset="reef_unit_ribbon"]').click();
  await page.waitForFunction(n=>window.__evo.game.scene.getScene('WorldEditor').map.objects.length===n+1,initial);
  await page.getByLabel('Breite',{exact:true}).fill('180');await page.getByLabel('Breite',{exact:true}).press('Tab');
  await page.getByLabel('Drehung °',{exact:true}).fill('18');await page.getByLabel('Drehung °',{exact:true}).press('Tab');
  await page.locator('.inspector select').first().selectOption('front');
  const id=await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.at(-1).id);
  await frames();
  const beforeMove=await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.at(-1).x);
  console.log('Drag / transform / undo');
  const pos=await page.evaluate(()=>{const s=window.__evo.game.scene.getScene('WorldEditor'),o=s.map.objects.at(-1),cam=s.cameras.main;return {x:(o.x-cam.worldView.x)*cam.zoom,y:(s.view.scenery.images.get(o.id).y-o.height*.4-cam.worldView.y)*cam.zoom};});
  const canvas=await page.locator('canvas').first().boundingBox();
  const mx=canvas.x+pos.x/1280*canvas.width,my=canvas.y+pos.y/720*canvas.height;
  await page.mouse.move(mx,my);await page.mouse.down();await page.mouse.move(mx+75,my-35,{steps:5});await page.mouse.up();await frames();
  const moved=await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.at(-1));
  assert.notEqual(moved.x,beforeMove);assert.equal(moved.width,180);assert.equal(moved.angle,18);assert.equal(moved.layer,'front');
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+Shift+z');
  await page.getByRole('button',{name:'Duplizieren',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.length),initial+2);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.length),initial+1);
  await page.reload();await page.waitForSelector('.evo-editor .asset',{timeout:90000});
  const restored=await page.evaluate(id=>window.__evo.game.scene.getScene('WorldEditor').map.objects.find(o=>o.id===id),id);assert.equal(restored.width,180);assert.equal(restored.angle,18);
  console.log('Epoch palette and file round-trip');
  await page.getByLabel('Zeitalter',{exact:true}).selectOption('karbon');await page.waitForSelector('[data-asset="d2_fern"]');
  assert.equal(await page.locator('[data-asset="reef_unit_ribbon"]').count(),0);
  await page.getByLabel('Zeitalter',{exact:true}).selectOption('devon');await page.getByLabel('Ort',{exact:true}).selectOption('garten');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Datei exportieren',exact:true}).click();const download=await downloadEvent;
  const file=path.join(output,'roundtrip.evo-map.json');await download.saveAs(file);const exported=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(exported.place,'garten');assert.ok(exported.objects.find(o=>o.id===id));
  await page.locator('input[type=file]').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('.status').textContent.includes('importiert'));
  // Bad file must leave the valid draft intact.
  const validCount=exported.objects.length;
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
  await page.waitForFunction(()=>document.querySelector('.status').classList.contains('error'));
  assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').map.objects.length),validCount);
  await page.getByRole('button',{name:'Begehung',exact:true}).click();await frames(4);
  assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').preview),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('WorldEditor').preview),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__evo.state.data)),runBefore);
  await frames();await page.screenshot({path:path.join(output,'editor.png')});
  console.log('Save project -> actual main game');
  const denied=await page.request.post(base+'/__evo/maps',{headers:{origin:'https://elsewhere.invalid'},data:exported});assert.equal(denied.status(),403);
  const bad=await page.request.post(base+'/__evo/maps',{data:{version:99}});assert.equal(bad.status(),400);
  const response=await page.request.post(base+'/__evo/maps',{data:exported});assert.equal(response.status(),200);wrote=true;
  await page.reload();await page.waitForSelector('.evo-editor .asset',{timeout:90000});
  await page.evaluate(async()=>{const e=window.__evo,{EPOCHS}=await import('/src/data/epochs.ts');const epoch=EPOCHS.findIndex(e=>e.id==='devon');e.state.newRun(epoch);e.state.life.age=180;e.game.scene.stop('WorldEditor');e.game.scene.start('Level',{epoch,place:'garten'});});
  await page.waitForFunction(()=>window.__evo.game.scene.getScene('Level').mapScenery?.images.size>0,null,{timeout:90000});
  const main=await page.evaluate(id=>{const s=window.__evo.game.scene.getScene('Level');return {objects:s.L.authoredObjects.length,found:s.mapScenery.images.has(id),solids:s.L.solids.length,ground:s.L.terrain.hp,physics:s.solids.getLength()};},id);
  assert.equal(main.objects,exported.objects.length);assert.equal(main.found,true);assert.deepEqual(main.ground,exported.layout.terrain.hp);assert.ok(main.physics>=main.solids);
  assert.deepEqual(errors,[]);
  const report={menu:true,drag:true,transform:true,undoRedo:true,browserDraft:true,epochPalette:true,fileRoundTrip:true,invalidImportPreservedDraft:true,previewPreservedRun:true,projectSave:true,mainGameObjects:main.objects,mainGamePhysics:main.physics,errors};
  fs.writeFileSync(path.join(output,'browser-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }catch(e){try{await page.screenshot({path:path.join(output,'failure.png')});}catch{}throw e;}finally{await browser.close();if(wrote)fs.writeFileSync(registry,original);}
})().catch(e=>{console.error(e);process.exitCode=1;});
