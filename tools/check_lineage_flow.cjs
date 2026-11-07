/** Real browser regression check. Run Vite, then NODE_PATH=/tmp/evo-browser/node_modules node tools/check_lineage_flow.cjs. */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.EVO_BASE_URL || 'http://127.0.0.1:5185';
const folder = process.env.EVO_ARTIFACTS || '/workspace/artifacts/lineage-core';
const report = { errors: [] };
fs.mkdirSync(folder, { recursive: true });
const forms = ['transition', 'water', 'water-bite-1', 'water-bite-2', 'water-skull-1', 'water-skull-2',
  'shore', 'shore-bite-1', 'shore-bite-2', 'shore-skull-1', 'shore-skull-2'];
let browser;
function captureErrors(page, name) {
  page.on('pageerror', e => { report.errors.push(`${name}: ${e.message}`); console.log('PAGEERROR', name, e.message); });
  page.on('console', m => { if (m.type() === 'error') { report.errors.push(`${name}: ${m.text()}`); console.log('CONSOLEERROR', name, m.text()); } });
}
async function awake(page) {
  await page.bringToFront();
  await page.evaluate(() => { window.__evo.game.resume(); window.__evo.game.loop.wake(); });
}
async function press(page, key) {
  // Phaser processes DOM events immediately but clears its shared queue at frame end.
  // Wait between synthetic keys so software WebGL's long frames cannot replay an earlier menu action.
  await page.waitForFunction(() => window.__evo.game.input.keyboard.queue.length === 0);
  await page.keyboard.press(key, { delay: 80 });
  await page.waitForFunction(() => window.__evo.game.input.keyboard.queue.length === 0);
}
async function start(page, name, offline = true) {
  console.log(`Starting ${name} (${offline ? 'offline' : 'network'})`);
  captureErrors(page, name);
  await page.goto(`${base}/?debug&${offline ? 'offline&' : ''}slot=lineage-${name}&name=${name}`);
  await page.waitForFunction(() => window.__evo?.game.scene.isActive('Title'), null, { timeout: 90000 });
  await page.evaluate(() => {
    const { game: g, state: s } = window.__evo;
    s.resetAll(); s.newRun(2); s.data.seenIntro = true;
    g.scene.stop('Title'); g.scene.start('Level', { epoch: 2 });
  });
  await levelReady(page);
  console.log(`${name}: level ready`);
}
async function levelReady(page) {
  await page.waitForFunction(() => {
    const { game: g, state: s } = window.__evo;
    const l = g.scene.getScene('Level');
    return g.scene.isActive('Level') && g.scene.isActive('Hud') && !g.scene.isActive('Roe')
      && !g.scene.isActive('Generation') && l.player?.view?.rig && !l.player.dead && !s.run.waiting;
  }, null, { timeout: 90000 });
  await page.evaluate(() => {
    const l = window.__evo.game.scene.getScene('Level');
    l.player.invulnUntil = 1e12; l.dbg?.setVisible(false);
  });
}
async function shot(page, name) {
  await page.waitForFunction(() => window.__evo.game.scene.scenes.filter(s => s.sys.isActive()).every(s => s.cameras.cameras.every(c => !c.fadeEffect.isRunning)), null, { timeout: 15000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(folder, name + '.png') });
}
async function hatchRoeUi(page, expectedGeneration) {
  await page.evaluate(() => {
    const r = window.__evo.game.scene.getScene('Roe'); window.__roeInputTrace = [];
    for (const name of r.__qaTraced ? [] : ['move', 'pick', 'openConfirm', 'closeConfirm', 'hatch']) {
      const original = r[name]; r[name] = function (...args) {
        window.__roeInputTrace.push({ name, args: name === 'move' ? args : [], index: this.confirmIdx, confirm: !!this.confirm, going: this.going,
          life: window.__evo.state.life.gen, eggs: window.__evo.state.roe.length, time: performance.now() });
        return original.apply(this, args);
      };
    }
    r.__qaTraced = true;
    if (!r.slots[r.focus]) r.setFocus(0); r.pick();
  });
  await page.waitForFunction(() => !!window.__evo.game.scene.getScene('Roe').confirm);
  // Intentionally fast: modal handlers must consume each native key event once, even on a long frame.
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__evo.game.scene.getScene('Roe').confirmIdx === 1, null, { timeout: 5000 });
  await page.keyboard.press('Enter', { delay: 80 });
  await page.waitForFunction(gen => window.__evo.state.life.gen === gen, expectedGeneration, { timeout: 30000 });
  await page.waitForFunction(() => window.__evo.game.scene.isActive('Generation'), null, { timeout: 30000 });
  await page.evaluate(() => { const s = window.__evo.game.scene.getScene('Generation'); s.time.timeScale = 8; s.tweens.timeScale = 8; s.cameras.main.fadeEffect.duration = 100; });
  await levelReady(page);
}
async function prepareNursery(page, site, weapon) {
  return page.evaluate(async ({ site, weapon }) => {
    const { state: s, game: g } = window.__evo, l = g.scene.getScene('Level');
    const { phases } = await import('/src/sim/life.ts');
    const at = l.L.breedingSites.find(n => n.id === site);
    s.life.age = phases(s.life.gen).mature * 1.05; s.life.fed = l.spawning.base;
    s.prog.train.biteDamage = weapon === 'bite' ? 100 : 0; s.prog.train.ramDamage = weapon === 'skull' ? 100 : 0;
    l.train.biteDamage = weapon === 'bite' ? 100 : 0; l.train.ramDamage = weapon === 'skull' ? 100 : 0;
    l.player.refresh(true); l.player.body.reset(at.x, at.y - 35); l.player.body.setVelocity(0, 0);
    l.player.invulnUntil = 1e12;
    return { parent: structuredClone(s.evolution), generation: s.life.gen, site: at };
  }, { site, weapon });
}
async function actualNursery(page, site, weapon, screenshot = false) {
  const before = await prepareNursery(page, site, weapon);
  console.log(`Nursery ${site}: generation ${before.generation}, births ${before.parent.births}`);
  await page.waitForFunction(() => window.__evo.game.scene.getScene('Level').spawning.offer.count > 0, null, { timeout: 30000 });
  await press(page, 'KeyE');
  await page.waitForFunction(() => window.__evo.game.scene.isActive('Roe'), null, { timeout: 30000 });
  await press(page, 'KeyB');
  await page.waitForFunction(() => window.__evo.game.scene.getScene('Roe').slots.some(e => e.group === 'next'), null, { timeout: 30000 });
  const egg = await page.evaluate(() => {
    const { state: s, game: g } = window.__evo, r = g.scene.getScene('Roe');
    const slot = r.slots.find(e => e.group === 'next'); r.setFocus(r.slots.indexOf(slot));
    return { parent: structuredClone(s.evolution), state: slot.egg.evolution, form: r.portrait.m.lineageForm,
      nursery: r.card.getByName('roe-nursery')?.text, progress: r.card.getByName('roe-evolution-progress')?.text };
  });
  assert.deepEqual(egg.parent, before.parent, 'Fertilising does not advance the current animal');
  assert.equal(egg.state.births, before.parent.births + 1);
  assert.equal(egg.nursery, site.toUpperCase() + ' NURSERY'); assert.ok(egg.progress);
  if (screenshot) await shot(page, 'egg-card-' + site);
  await hatchRoeUi(page, before.generation + 1);
  console.log(`Hatched generation ${before.generation + 1}`);
  const after = await page.evaluate(() => ({ state: structuredClone(window.__evo.state.evolution), form: window.__evo.state.morph().lineageForm }));
  assert.deepEqual(after.state, egg.state, 'The selected animal adopts precisely its egg state');
  return after;
}
async function checkGallery(page) {
  report.rigs = await page.evaluate(async forms => {
    const { CreatureView } = await import('/src/objects/CreatureView.ts');
    const { lineageHasLegs } = await import('/src/art/lineage/forms.ts');
    const sc = window.__evo.game.scene.getScene('Gallery'); sc.scene.pause(); sc.children.removeAll(true);
    sc.cameras.main.setBackgroundColor('#163b44');
    const common = { cls: 'fish', size: 1, jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 1, fierce: 0, hue: 1, seed: 7 };
    const views = forms.map((id, i) => {
      const x = 216 + i % 3 * 424, y = 78 + Math.floor(i / 3) * 175;
      const view = new CreatureView(sc, x, y, { ...common, lineageForm: id }, 2.6);
      sc.add.text(x, y + 55, id, { fontFamily: 'Alegreya Sans', fontSize: '17px', color: '#d7cfb8' }).setOrigin(.5);
      return view;
    });
    window.__lineageGallery = views;
    const textureCount = sc.textures.getTextureKeys().length;
    return views.map(view => {
      const r = view.rig, g = r.body;
      const at = (i, j) => { const k = (j * (g.cols + 1) + i) * 4; return { x: g.v[k], y: g.v[k + 1] }; };
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const baseline = dist(at(28, 15), at(40, 15)), previous = new Map();
      const motion = { tail: 0, limb: 0, fin: 0 }; let coreError = 0, jawMovement = 0, eyeError = 0, firstJaw;
      let finite = true;
      for (let frame = 0; frame < 90; frame++) {
        r.pose({ t: frame / 30, dt: 1 / 30, speed01: 1, mode: lineageHasLegs(view.m.lineageForm) ? 'walk' : 'swim',
          open: frame > 40 ? 1 : 0, lunge: 0, clench: 0, grind: 0, coil: 0, dip: 0, pitch: Math.sin(frame * .1) * .1, still: 0, crawlPhase: 0 });
        coreError = Math.max(coreError, Math.abs(dist(at(28, 15), at(40, 15)) - baseline));
        const eye = r.map(r.r.eye[0], r.r.eye[1]); eyeError = Math.max(eyeError, Math.hypot(eye.x - r.lid.x, eye.y - r.lid.y));
        for (const kind of ['tail', 'limb', 'fin']) {
          const index = r.bindings.findIndex(b => b.kind === kind && b.weight > .8);
          if (index < 0) continue;
          const p = { x: g.v[index * 4], y: g.v[index * 4 + 1] };
          if (previous.has(kind)) motion[kind] = Math.max(motion[kind], dist(p, previous.get(kind)));
          previous.set(kind, p);
        }
        const jaw = r.map(.98, .75, undefined, true); firstJaw ??= jaw; jawMovement = Math.max(jawMovement, dist(jaw, firstJaw));
        finite &&= g.v.every(Number.isFinite) && r.jaw.v.every(Number.isFinite);
      }
      r.pose({ t: 0, dt: 0, speed01: 0, mode: 'idle', open: 0, lunge: 0, clench: 0, grind: 0, coil: 0, dip: 0, pitch: 0, still: 0, crawlPhase: 0 });
      return { form: view.m.lineageForm, webgl: !!g, coreError, eyeError, jawMovement, motion, finite,
        stableTextures: sc.textures.getTextureKeys().length === textureCount };
    });
  }, forms);
  for (const rig of report.rigs) {
    assert.ok(rig.webgl && rig.finite && rig.stableTextures, rig.form);
    assert.ok(rig.coreError < 1e-5, rig.form + ' rigid trunk'); assert.ok(rig.eyeError < 1e-5, rig.form + ' eyes follow head');
    assert.ok(rig.jawMovement > 1, rig.form + ' articulated jaw'); assert.ok(rig.motion.tail > .001, rig.form + ' tail');
    if (rig.form === 'transition' || rig.form.startsWith('shore')) assert.ok(rig.motion.limb > .001, rig.form + ' moving legs');
  }
  await shot(page, 'all-eleven-resting');
  await page.evaluate(() => window.__lineageGallery.forEach(v => { v.holdOpen = 1; v.squint(.8); v.animate(.03, 'idle', 0); }));
  await shot(page, 'all-eleven-charged');
}
async function inspectTree(page, expectedBoth = false) {
  await page.evaluate(() => { window.__evo.game.scene.getScene('Hud').openShrine(); });
  await page.waitForFunction(() => window.__evo.game.scene.getScene('Evolution').coreTree?.model.nodes.length === 15);
  const tree = await page.evaluate(() => {
    const t = window.__evo.game.scene.getScene('Evolution').coreTree;
    return { nodes: t.model.nodes.length, played: t.model.nodes.filter(n => !n.possible).map(n => n.id),
      alternatives: t.model.nodes.filter(n => n.possible).length, routes: t.routes.map(r => r.name),
      cursor: window.__evo.game.canvas.style.cursor };
  });
  assert.equal(tree.nodes, 15); assert.ok(tree.alternatives > 0);
  if (expectedBoth) { assert.ok(tree.played.includes('water')); assert.ok(tree.played.includes('shore')); }
  const target = await page.evaluate(() => {
    const t = window.__evo.game.scene.getScene('Evolution').coreTree, p = t.points.get('shore-bite-2');
    const canvas = window.__evo.game.canvas.getBoundingClientRect();
    return { x: canvas.left + (t.plot.x + p.x * t.plot.scaleX) * canvas.width / 1280,
      y: canvas.top + (t.plot.y + p.y * t.plot.scaleY) * canvas.height / 720 };
  });
  await page.mouse.move(target.x, target.y);
  await page.waitForFunction(() => window.__evo.game.scene.getScene('Evolution').coreTree.detailKey === 'shore-bite-2');
  tree.hover = await page.evaluate(() => ({ detail: window.__evo.game.scene.getScene('Evolution').coreTree.detailKey,
    form: window.__evo.game.scene.getScene('Evolution').coreTree.portrait.m.lineageForm, cursor: window.__evo.game.canvas.style.cursor }));
  assert.equal(tree.hover.form, 'shore-bite-2'); assert.ok(tree.hover.cursor.includes('url('));
  await shot(page, expectedBoth ? 'tree-two-player-paths' : 'tree-hover');
  await press(page, 'Escape');
  await page.waitForFunction(() => !window.__evo.game.scene.isActive('Evolution') && window.__evo.game.scene.isActive('Level'));
  return tree;
}
async function networkLay(page, site, weapon) {
  await awake(page);
  return page.evaluate(({ site, weapon }) => {
    const { state: s } = window.__evo;
    const clutch = s.addClutch({ place: 'riff', breedingSite: site, x: site === 'water' ? 1160 : 3000, y: 400,
      at: Date.now(), fert: true, role: 'father', young: 1 });
    const style = { ...s.prog.train, biteDamage: weapon === 'bite' ? 100 : 0, ramDamage: weapon === 'skull' ? 100 : 0 };
    return s.layEggs(clutch, s.inherit({ meat: 0, plant: 0 }, style))[0].id;
  }, { site, weapon });
}
async function networkChoose(page, id, generation) {
  await awake(page);
  const answer = await page.evaluate(async id => {
    const { state: s, species, game: g } = window.__evo, reply = await species.pick(id);
    if (!reply) return null;
    s.hatchRoe(reply.egg, reply.gen); g.scene.getScene('Level').player.refresh(true);
    return { gen: s.life.gen, state: structuredClone(s.evolution), form: s.morph().lineageForm };
  }, id);
  assert.ok(answer, 'Server assigned the selected egg'); assert.equal(answer.gen, generation);
  return answer;
}
async function checkCoop() {
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 1280, height: 720 } }), browser.newContext({ viewport: { width: 1280, height: 720 } })]);
  const [a, b] = await Promise.all(contexts.map(c => c.newPage()));
  await start(a, 'Anna', false); await start(b, 'Ben', false);
  for (const p of [a, b]) await p.waitForFunction(() => window.__evo.species.active && window.__evo.species.livingPeers.length === 1, null, { timeout: 45000 });
  const rounds = [];
  for (let i = 1; i <= 3; i++) {
    const aid = await networkLay(a, 'water', 'bite'), bid = await networkLay(b, 'shore', 'skull');
    for (const p of [a, b]) await p.waitForFunction(ids => ids.every(id => window.__evo.state.roe.some(e => e.id === id)), [aid, bid]);
    const aa = await networkChoose(a, aid, i + 1), bb = await networkChoose(b, bid, i + 1);
    assert.equal(aa.state.habitatProgress, -i); assert.equal(bb.state.habitatProgress, i);
    rounds.push({ a: aa, b: bb });
  }
  await a.waitForFunction(() => window.__evo.species.peerBranches.some(p => p.evolutionTrace?.at(-1)?.habitat === 'shore'));
  await awake(a); report.coop = { rounds, tree: await inspectTree(a, true) };
  // The old generation is gone. A dead player has to watch a living peer until a real new egg is laid.
  await a.evaluate(() => window.__evo.game.scene.getScene('Level').player.expire('Browser regression'));
  await a.waitForFunction(() => window.__evo.game.scene.isActive('Watch'), null, { timeout: 30000 });
  const watching = await a.evaluate(() => ({ waiting: window.__evo.state.run.waiting,
    eggs: window.__evo.state.pool.length + window.__evo.state.roe.length,
    hidden: !window.__evo.game.scene.getScene('Level').player.view.visible }));
  assert.ok(watching.waiting && watching.hidden); assert.equal(watching.eggs, 0);
  await shot(a, 'coop-watching');
  const bid = await networkLay(b, 'shore', 'skull');
  await awake(a);
  await a.waitForFunction(() => window.__evo.game.scene.isActive('Roe') && window.__evo.game.scene.getScene('Roe').slots.length > 0, null, { timeout: 45000 });
  const newEgg = await a.evaluate(id => window.__evo.game.scene.getScene('Roe').slots.find(s => s.egg.id === id)?.egg.evolution, bid);
  assert.equal(newEgg.habitat, 'shore'); assert.equal(newEgg.tier, 1);
  await hatchRoeUi(a, 5);
  const respawn = await a.evaluate(() => ({ waiting: window.__evo.state.run.waiting, evolution: structuredClone(window.__evo.state.evolution),
    form: window.__evo.state.morph().lineageForm, watching: window.__evo.game.scene.isActive('Watch') }));
  assert.deepEqual(respawn.evolution, newEgg); assert.equal(respawn.form, 'shore-skull-1'); assert.equal(respawn.waiting, false); assert.equal(respawn.watching, false);
  report.coop.watching = watching; report.coop.respawn = respawn;
  await shot(a, 'coop-adopted-shore-lineage');
  await Promise.all(contexts.map(c => c.close()));
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (process.env.EVO_SKIP_GALLERY !== '1') {
      const page = await context.newPage(); captureErrors(page, 'gallery');
      await page.goto(base + '/?debug&offline&slot=lineage-gallery&gallery=fish');
      await page.waitForFunction(() => window.__evo?.game.scene.isActive('Gallery'), null, { timeout: 90000 });
      await checkGallery(page); console.log('All eleven real WebGL rigs checked.'); await page.close();
    }
    if (process.env.EVO_ONLY_GALLERY === '1') { await context.close(); return; }
    const p = await context.newPage(); await start(p, 'offline');
    report.world = await p.evaluate(async () => {
      const { placesOf } = await import('/src/data/world.ts'), { EPOCHS } = await import('/src/data/epochs.ts');
      const l = window.__evo.game.scene.getScene('Level');
      return { places: placesOf(EPOCHS[2]).map(p => p.id), sites: l.L.breedingSites,
        start: l.L.start, heaps: l.spawning.heaps.map(h => ({ x: h.x, y: h.y, site: h.site })),
        form: l.player.view.m.lineageForm };
    });
    assert.deepEqual(report.world.places, ['riff', 'garten', 'wand', 'ufer', 'hochland']);
    assert.equal(report.world.form, 'transition'); assert.equal(report.world.sites.length, 2);
    assert.ok(report.world.sites[0].x < report.world.start.x && report.world.start.x < report.world.sites[1].x);
    await p.waitForTimeout(4000); await shot(p, 'start-between-nurseries');
    await press(p, 'KeyC'); await p.waitForFunction(() => !!window.__evo.game.scene.getScene('Hud').overview);
    report.overview = await p.evaluate(() => {
      const c = window.__evo.game.scene.getScene('Hud').overview;
      return { form: c.portrait.m.lineageForm, progress: c.c.getByName('overview-evolution-progress')?.text };
    });
    assert.equal(report.overview.form, 'transition'); assert.ok(report.overview.progress); await shot(p, 'c-overview');
    await press(p, 'KeyC'); await p.waitForFunction(() => !window.__evo.game.scene.getScene('Hud').overview);
    report.offlineGenerations = [];
    for (let i = 0; i < 5; i++) report.offlineGenerations.push(await actualNursery(p, 'water', 'bite', i === 0 || i === 4));
    assert.deepEqual(report.offlineGenerations.map(s => s.form), ['transition', 'transition', 'water', 'water-bite-1', 'water-bite-2']);
    report.tree = await inspectTree(p); await context.close();
    console.log('Actual five-generation nursery/Roe/confirmation/hatching flow checked.');
    if (process.env.EVO_SKIP_COOP !== '1') { await checkCoop(); console.log('Two independent network paths and spectator adoption checked.'); }
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.failure = error.stack || String(error); console.error(report.failure);
    for (const [i, c] of browser.contexts().entries()) for (const [j, p] of c.pages().entries()) {
      await shot(p, `failure-${i}-${j}`).catch(() => {});
      console.log('DIAGNOSTIC', await p.evaluate(() => {
        const x = window.__evo; if (!x) return { url: location.href };
        const l = x.game.scene.getScene('Level');
        return { scenes: x.game.scene.scenes.map(s => [s.sys.settings.key, s.sys.settings.status]), gen: x.state.run?.life.gen,
          evolution: x.state.run?.evolution, roe: x.state.roe, waiting: x.state.run?.waiting,
          player: l.player && { x: l.player.x, y: l.player.y, dead: l.player.dead, water: l.player.inWater }, offer: l.spawning?.offer,
          inputTrace: window.__roeInputTrace,
          roeScene: x.game.scene.getScene('Roe').sys.settings.status === 5 ? { focus: x.game.scene.getScene('Roe').focus,
            confirm: !!x.game.scene.getScene('Roe').confirm, confirmIdx: x.game.scene.getScene('Roe').confirmIdx,
            input: x.game.scene.getScene('Roe').input.enabled, keyboard: x.game.scene.getScene('Roe').input.keyboard.enabled,
            going: x.game.scene.getScene('Roe').going } : undefined };
      }).catch(String));
    }
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(folder, 'browser-check.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report)); await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
