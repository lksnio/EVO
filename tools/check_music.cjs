/** Vite running: NODE_PATH=/tmp/evo-browser/node_modules node tools/check_music.cjs.
 * Renders real Web Audio, checks the instrument mix and lifecycle, and saves WAV previews outside the checkout.
 */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const folder=process.env.EVO_AUDIO_DIR||'/tmp/evo-music';
fs.mkdirSync(folder,{recursive:true});
function wav(pcm,sampleRate){
 const samples=Buffer.from(pcm,'base64'),b=Buffer.alloc(44+samples.length);
 b.write('RIFF',0);b.writeUInt32LE(36+samples.length,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sampleRate,24);
 b.writeUInt32LE(sampleRate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(samples.length,40);samples.copy(b,44);return b;
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const report=[],errors=[];
 try{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.EVO_BASE_URL||'http://127.0.0.1:8080');
  for(const name of (process.argv.includes('--live-only')?[]:['piano','deep','descent','danger','still','loss','stop','sea','seaoff','full'])){
   const result=await page.evaluate(async name=>{
    const {OceanScore}=await import('/src/audio/OceanScore.ts');
    const {OceanAmbience}=await import('/src/audio/OceanAmbience.ts');
    const sampleRate=22050,duration=['piano','deep','full'].includes(name)?72:36;
    const ctx=new OfflineAudioContext(2,sampleRate*duration,sampleRate);
    const master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
    const musicBus=ctx.createGain();musicBus.gain.value=.75;musicBus.connect(master);
    let seed=2917;const random=Math.random;
    Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    try{
     const notes=[],water=[],critters=[];
     const score=['sea','seaoff'].includes(name)?null:new OceanScore(ctx,musicBus,0);
     let musicBuffers=0;
     const createBufferSource=ctx.createBufferSource.bind(ctx);
     ctx.createBufferSource=()=>{musicBuffers++;return createBufferSource();};
     if(score){
      const piano=score.piano.bind(score);
      score.piano=(t,midi,velocity)=>{notes.push({t,midi:midi-(score.depth>.58?12:0)});piano(t,midi,velocity);};
      const deep=name==='deep'||name==='danger';score.depth=deep?1:0;score.set({depth:deep?1:0,threat:name==='danger'?1:0});
      if(name==='still')score.mode('still');
     }
     const ambience=['sea','seaoff','full'].includes(name)?new OceanAmbience(ctx,master,0):null;
     if(ambience){
      ambience.setLevel(.08);
      const a=ambience.water.bind(ambience),b=ambience.critter.bind(ambience);
      ambience.water=t=>{water.push(t);a(t);};ambience.critter=t=>{critters.push(t);b(t);};
     }
     let atStop;
     for(let t=0;t<duration;t+=.125){
      if(name==='descent'&&t===8)score.set({depth:1});
      if(name==='loss'&&t===12)score.loss(t);
      if(name==='stop'&&t===16){score.stop(t);atStop=notes.length;}
      if(name==='seaoff'&&t===16)ambience.setLevel(0,1,t);
      score?.tick(t);ambience?.tick(t);
     }
     const buffer=await ctx.startRendering();
     let peak=0,sum=0,tail=0;
     for(let ch=0;ch<2;ch++)for(let i=0;i<buffer.length;i++){
      const v=buffer.getChannelData(ch)[i];if(!Number.isFinite(v))throw Error('Nonfinite audio');peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>sampleRate*30)tail=Math.max(tail,Math.abs(v));
     }
     let seam=0;
     if(ambience){const n=ambience.noise;for(let ch=0;ch<2;ch++)seam=Math.max(seam,Math.abs(n.getChannelData(ch)[n.length-1]-n.getChannelData(ch)[n.sampleRate*2-1]));}
     const pcm=new Uint8Array(buffer.length*4),view=new DataView(pcm.buffer);
     for(let i=0;i<buffer.length;i++)for(let ch=0;ch<2;ch++)view.setInt16((i*2+ch)*2,Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]))*32767),true);
     let binary='';for(let i=0;i<pcm.length;i+=16384)binary+=String.fromCharCode(...pcm.subarray(i,i+16384));
     return{summary:{name,peak,rms:Math.sqrt(sum/(buffer.length*2)),tail,notes,musicBuffers,water,critters,seam,noEventsAfterStop:atStop===undefined||atStop===notes.length},sampleRate,pcm:btoa(binary)};
    }finally{Math.random=random;}
   },name);
   const s=result.summary;
   assert.ok(s.peak>.0002&&s.peak<.18,JSON.stringify(s));assert.ok(s.rms>.00001&&s.rms<.03,JSON.stringify(s));
   assert.equal(s.noEventsAfterStop,true);
   if(!['sea','seaoff','full'].includes(name))assert.equal(s.musicBuffers,0,'Music must contain only piano, without noise or drum buffers');
   if(!['sea','seaoff'].includes(name))assert.ok(s.notes.length>3);
   if(name==='piano'){
    const scale=new Set([0,2,4,5,7,9,10]);for(const n of s.notes)assert.ok(scale.has(n.midi%12));
    assert.ok(Math.max(...s.notes.slice(1).map((n,i)=>n.t-s.notes[i].t))>=5);
   }
   if(name==='deep')assert.ok(s.notes.every((n,i)=>n.midi===report[0].notes[i].midi-12));
   if(name==='descent')assert.ok(s.notes.filter(n=>n.t>15).every(n=>n.midi<=57));
   if(name==='stop'||name==='seaoff')assert.ok(s.tail<.000001);
   if(['sea','full'].includes(name)){assert.ok(s.water.length>0&&s.critters.length>0);assert.ok(s.seam<1e-7);}
   fs.writeFileSync(path.join(folder,name+'.wav'),wav(result.pcm,result.sampleRate));report.push(s);
   console.log(name+': passed');
  }
  const timing=await page.evaluate(async()=>{
   const {OceanScore}=await import('/src/audio/OceanScore.ts');
   const ctx=new OfflineAudioContext(1,22050*30,22050);let clock=0;
   const controlled=new Proxy(ctx,{get:(target,key)=>{if(key==='currentTime')return clock;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   const score=new OceanScore(controlled,ctx.destination,0),events=[];
   score.piano=(t,midi)=>events.push({t,midi,now:clock});
   score.tick(.9);clock=3.6;score.tick(4.5);score.tick(4.5);clock=7;score.tick(7.9);
   return{events,unique:new Set(events.map(e=>e.t)).size===events.length,noLate:events.every(e=>e.t>=e.now+.015),skipped:!events.some(e=>e.t===1.1||Math.abs(e.t-3.35)<.001)};
  });
  assert.equal(timing.unique,true);assert.equal(timing.noLate,true);assert.equal(timing.skipped,true);
  await page.mouse.click(5,5);
  const engine=await page.evaluate(async()=>{
   const {AudioEngine}=await import('/src/audio/Audio.ts');
   const a=new AudioEngine();a.sea(.08);a.unlock();await a.ctx.resume();
   const leads=[];
   try{
    a.music('ozean');const score=a.score,ambience=a.ambience,timer=a.ambienceTimer,play=score.piano.bind(score);
    score.piano=(t,...args)=>{leads.push(t-a.ctx.currentTime);return play(t,...args);};
    await new Promise(r=>setTimeout(r,350));
    const until=performance.now()+3500;while(performance.now()<until){} // deliberate stalled game frame
    await new Promise(r=>setTimeout(r,250));
    const skippedAfterStall=score.index>=3;
    a.mood({depth:1});a.sea(.08);a.music('generation');a.music('ending');
    const stable=a.score===score&&a.ambience===ambience&&a.ambienceTimer===timer;
    a.setMuted(true);await new Promise(r=>setTimeout(r,400));const muted=a.master.gain.value<.001;
    a.setMuted(false);a.sea(0,.3);a.music(null);await new Promise(r=>setTimeout(r,1200));
    const silentSea=a.ambience.out.gain.value<.000001;
    const result={stable,muted,silentSea,stopped:a.score===null,skippedAfterStall,leads,noLate:leads.length>0&&leads.every(t=>t>=.014)};
    clearInterval(a.ambienceTimer);await a.ctx.close();return result;
   }finally{if(a.ctx.state!=='closed')await a.ctx.close();}
  });
  for(const k of ['stable','muted','silentSea','stopped','skippedAfterStall','noLate'])assert.equal(engine[k],true,k);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({report,timing,engine,errors},null,2)+'\n');
  console.log(JSON.stringify({renders:report.map(s=>({name:s.name,peak:s.peak,rms:s.rms,notes:s.notes.length})),timing,engine,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
