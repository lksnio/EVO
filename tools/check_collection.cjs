/** Vite running: node tools/check_collection.cjs. Uses an isolated browser/profile, never a real player's save. */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const folder = process.env.EVO_CAPTURE_DIR || path.resolve(__dirname, '../art/EVO_collection_v1/captures');
fs.mkdirSync(folder, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const errors = [], report = {};
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.goto((process.env.EVO_BASE_URL || 'http://127.0.0.1:8080') + '/?debug&offline&gallery=river&slot=collectcheck');
    await page.waitForFunction(() => window.__evo?.game.scene.isActive('Gallery'), null, { timeout: 120000 });
    report.migration = await page.evaluate(() => {
      const e=window.__evo;e.state.resetAll();e.state.newRun(0);
      const old=JSON.parse(JSON.stringify(e.state.data));old.shells=1023;old.seenShells=100;
      old.run.ups={hp:8,stam:8,sight:4,oxy:4};old.run.gold={key:'hp',at:0};old.keptUps={karbon:{hp:8}};
      localStorage.setItem('evo-save-v3-collectcheck',JSON.stringify(old));e.state.load('collectcheck');
      const saved=JSON.parse(localStorage.getItem('evo-save-v3-collectcheck'));
      e.game.scene.stop('Gallery');e.game.scene.start('Level',{epoch:0});
      return {count:e.state.shells,oldCurrency:'shells' in saved,oldBonuses:'ups' in saved.run,gold:'gold' in saved.run};
    });
    assert.deepEqual(report.migration,{count:0,oldCurrency:false,oldBonuses:false,gold:false});
    const ready = async place => {
      await page.waitForFunction(id => {
        const e=window.__evo,s=e.game.scene.getScene('Level');return s.place?.id===id&&s.player?.view&&e.game.scene.isActive('Hud');
      },place,{timeout:120000});
    };
    await ready('riff');console.log('Migration und Laichfluss bereit');
    const present=()=>page.evaluate(()=>new Promise(resolve=>window.__evo.game.events.once('postrender',()=>resolve())));
    const capture=async name=>{
      await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Hud').overview||window.__evo.game.scene.getScene('Hud').overview.c.alpha===1);
      await present();await page.screenshot({path:path.join(folder,name+'.png')});
    };
    const clickDesign=async (x,y)=>{
      const b=await page.locator('canvas').first().boundingBox();
      await page.mouse.click(b.x+x*b.width/1280,b.y+y*b.height/720);
    };
    await page.keyboard.press('KeyC');
    await page.waitForFunction(()=>window.__evo.game.scene.getScene('Hud').overview);
    await capture('uebersicht');
    report.empty=await page.evaluate(()=>{
      const e=window.__evo,h=e.game.scene.getScene('Hud'),star=h.overview.c.getByName('collection-star');
      return {shells:e.state.shells,fossils:e.state.fossils,slots:star.list.length-1,levelPaused:e.game.scene.isPaused('Level')};
    });
    assert.deepEqual(report.empty,{shells:0,fossils:0,slots:14,levelPaused:true});
    report.overview=await page.evaluate(()=>{
      const c=window.__evo.game.scene.getScene('Hud').overview.c;
      const texts=c.list.filter(o=>o.type==='Text').map(o=>o.text);
      const stone=c.getByName('collection-star').list[0].getBounds();
      return {texts,stone:{x:stone.x,y:stone.y,width:stone.width,height:stone.height},buttons:c.list.filter(o=>o.type==='Container'&&o.label).length};
    });
    assert.equal(report.overview.buttons,0);
    for(const forbidden of ['KÖRPER','Länge','Gewicht','Färbung','Kost','NACHKOMMEN','Geschwister','Nächste Generation','Deine Gruppe','Lebensabschnitt','Heranwachsend','Ort','SPUREN DES LEBENS','Sammlung ansehen','Ende']) {
      assert.ok(!report.overview.texts.includes(forbidden),forbidden);
    }
    assert.ok(!report.overview.texts.some(t=>/\b[0-7]\s*\/\s*7\b/.test(t)));
    for(const expected of ['BEUTE','Laichzeit','Tod'])assert.ok(report.overview.texts.includes(expected),expected);
    assert.equal(report.overview.texts.filter(t=>t==='—').length,2,'Only the empty plant/meat shares remain');
    assert.ok(report.overview.stone.width>450);
    assert.ok(report.overview.stone.x+report.overview.stone.width<1240);
    await clickDesign(980,425);
    assert.equal(await page.evaluate(()=>!!window.__evo.game.scene.getScene('Hud').overview),true);
    await capture('stern-leer');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Hud').overview&&!window.__evo.game.scene.isPaused('Level'));
    assert.equal(await page.evaluate(()=>!window.__evo.game.scene.getScene('Hud').overview&&!window.__evo.game.scene.isPaused('Level')),true);
    const enter=async place=>{
      await page.evaluate(place=>{
        const e=window.__evo;e.game.scene.stop('Hud');e.game.scene.stop('Level');e.state.enterPlace(place,{side:'top',frac:0});e.game.scene.start('Level',{epoch:0,place});
      },place);await ready(place);
    };
    await enter('wand');console.log('Tiefental bereit');
    report.deep=await page.evaluate(()=>{
      const s=window.__evo.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();
      const sh=s.shells.find(s=>s.id==='shell:abyss');if(!sh)return {found:false,height:s.L.height,lowest:Math.max(...s.L.terrain.hp)};
      s.player.body.reset(sh.x-120,sh.y-70);s.player.view.setPosition(sh.x-120,sh.y-70);
      s.cameras.main.stopFollow();s.cameras.main.centerOn(sh.x,sh.y-90);s.cameras.main.fadeEffect.reset();s.dbg?.setVisible(false);
      return {found:true,x:sh.x,y:sh.y,height:s.L.height,free:!s.solidAt(sh.x,sh.y-28)};
    });
    assert.equal(report.deep.found,true);assert.equal(report.deep.free,true);assert.ok(report.deep.y>report.deep.height*.75);
    await capture('muschel-im-tiefental');
    await page.evaluate(()=>{const e=window.__evo,s=e.game.scene.getScene('Level'),sh=s.shells.find(s=>s.id==='shell:abyss');s.player.body.reset(sh.img.x,sh.img.y-20);s.shellStep(s.time.now);});
    assert.equal(await page.evaluate(()=>window.__evo.state.hasShell('abyss')),true);
    await enter('riff');await enter('wand');
    assert.equal(await page.evaluate(()=>window.__evo.game.scene.getScene('Level').shells.some(s=>s.id==='shell:abyss')),false);
    report.boss=await page.evaluate(()=>{
      const e=window.__evo,s=e.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();
      const a=s.spawnAnimal('dunkleosteus',s.L.width/2,700);a.hurt(1e8,s.player,'bite');
      const first=s.shells.filter(p=>p.id==='fossil:dunkleosteus').length;
      const again=s.spawnAnimal('dunkleosteus',s.L.width/2+400,700);again.hurt(1e8,s.player,'bite');
      return {dead:a.dead,first,afterSecond:s.shells.filter(p=>p.id==='fossil:dunkleosteus').length,pending:e.state.collection.pending.length,fossils:e.state.fossils};
    });
    console.log('Erster Bossdrop geprüft');
    assert.deepEqual(report.boss,{dead:true,first:1,afterSecond:1,pending:1,fossils:0});
    await enter('riff');await enter('wand');
    report.restored=await page.evaluate(()=>{
      const e=window.__evo,s=e.game.scene.getScene('Level');s.scene.pause();s.physics.world.pause();
      const p=s.shells.find(p=>p.id==='fossil:dunkleosteus');if(!p)return {found:false};
      s.player.body.reset(p.img.x,p.img.y-25);s.shellStep(s.time.now);
      return {found:true,owned:e.state.hasFossil('dunkleosteus'),pending:e.state.collection.pending.length};
    });
    assert.deepEqual(report.restored,{found:true,owned:true,pending:0});
    await enter('riff');
    report.wisdom=await page.evaluate(()=>{
      const e=window.__evo,h=e.game.scene.getScene('Hud');h.openShrine();
      return {text:h.shrineC.list.filter(o=>o.type==='Text').map(o=>o.text).find(t=>t.startsWith('...')),heard:e.state.collection.heard};
    });
    assert.equal(report.wisdom.heard,1);assert.match(report.wisdom.text,/zweiten Anfang/);
    await capture('weisheit');await page.keyboard.press('Escape');
    // The full plate is a controlled screenshot in this isolated profile, not a cheat shipped in the game.
    await page.evaluate(async()=>{
      const e=window.__evo,{COLLECTION_SHELLS,COLLECTION_FOSSILS}=await import('/src/data/collection.ts');
      COLLECTION_SHELLS.forEach(s=>e.state.collectShell(s.id));
      COLLECTION_FOSSILS.forEach(f=>{e.state.recordFossilDrop({id:f.id,epoch:'devon',place:'wand',x:600,y:900});e.state.collectFossil(f.id);});
    });
    await page.keyboard.press('KeyC');await page.waitForFunction(()=>window.__evo.game.scene.getScene('Hud').overview);
    await capture('stern-voll');console.log('Volle Sammlung aufgenommen');
    report.full=await page.evaluate(()=>{
      const e=window.__evo,star=e.game.scene.getScene('Hud').overview.c.getByName('collection-star');
      return {shells:e.state.shells,fossils:e.state.fossils,fresh:e.state.collectionFresh,found:star.list.filter(o=>o.texture?.key.endsWith('-found')).length};
    });
    assert.deepEqual(report.full,{shells:7,fossils:7,fresh:false,found:14});
    await present();
    const before=await page.evaluate(()=>Object.keys(window.__evo.game.textures.list));
    for(let i=0;i<12;i++){
      await page.evaluate(()=>{const h=window.__evo.game.scene.getScene('Hud');h.toggleOverview();h.toggleOverview();});
      await present();
    }
    const after=await page.evaluate(()=>Object.keys(window.__evo.game.textures.list));
    report.textureCounts={before:before.length,after:after.length,new:after.filter(k=>!before.includes(k))};
    report.stableTextures=after.filter(k=>k.startsWith('collection-')).length===before.filter(k=>k.startsWith('collection-')).length;
    assert.equal(report.stableTextures,true);
    assert.ok(after.length<=before.length+2,JSON.stringify(report.textureCounts));
    await page.setViewportSize({width:960,height:600});
    await capture('uebersicht-klein');
    await clickDesign(980,425);
    assert.equal(await page.evaluate(()=>!!window.__evo.game.scene.getScene('Hud').overview),true);
    await page.keyboard.press('KeyC');
    await page.waitForFunction(()=>!window.__evo.game.scene.getScene('Hud').overview&&!window.__evo.game.scene.isPaused('Level'));
    assert.equal(await page.evaluate(()=>!window.__evo.game.scene.getScene('Hud').overview&&!window.__evo.game.scene.isPaused('Level')),true);
    await page.reload();await page.waitForFunction(()=>window.__evo?.game.scene.isActive('Gallery'),null,{timeout:120000});
    report.reloaded=await page.evaluate(()=>({shells:window.__evo.state.shells,fossils:window.__evo.state.fossils,pending:window.__evo.state.collection.pending.length}));
    assert.deepEqual(report.reloaded,{shells:7,fossils:7,pending:0});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(folder,'browser-check.json'),JSON.stringify({report,errors},null,2)+'\n');
    console.log(JSON.stringify({report,errors},null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
