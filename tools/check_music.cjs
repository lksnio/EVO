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
  for(const name of ['shallow','deep','descent','danger','still','loss','stop']){
   const result=await page.evaluate(async name=>{
    const {OceanScore}=await import('/src/audio/OceanScore.ts');
    const sampleRate=22050,duration=36,ctx=new OfflineAudioContext(2,sampleRate*duration,sampleRate);
    let seed=2917;const random=Math.random;
    Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    try{
     const score=new OceanScore(ctx,ctx.destination,0),events=[];
     const play=score.play.bind(score);
     score.play=(buffer,t,...rest)=>{
      const drum=[...score.drums].find(([,b])=>b===buffer);
      if(rest[0]>=.0001)events.push({kind:drum?drum[0]:'piano',t});play(buffer,t,...rest);
     };
     const deep=name==='deep'||name==='danger';score.depth=deep?1:0;score.set({depth:deep?1:0,threat:name==='danger'?1:0});
     if(name==='still')score.mode('still');
     let atStop;
     for(let t=0;t<duration;t+=.125){
      if(name==='descent'&&t===8)score.set({depth:1});
      if(name==='loss'&&t===12)score.loss(t);
      if(name==='stop'&&t===16){score.stop(t);atStop=events.length;}
      score.tick(t);
     }
     const buffer=await ctx.startRendering();
     let peak=0,sum=0,tail=0;
     for(let ch=0;ch<buffer.numberOfChannels;ch++){
      const data=buffer.getChannelData(ch);
      for(let i=0;i<data.length;i++){const v=data[i];if(!Number.isFinite(v))throw Error('Nonfinite audio');peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>sampleRate*30)tail=Math.max(tail,Math.abs(v));}
     }
     const pcm=new Uint8Array(buffer.length*4),view=new DataView(pcm.buffer);
     for(let i=0;i<buffer.length;i++)for(let ch=0;ch<2;ch++)view.setInt16((i*2+ch)*2,Math.round(Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]))*32767),true);
     let binary='';for(let i=0;i<pcm.length;i+=16384)binary+=String.fromCharCode(...pcm.subarray(i,i+16384));
     return{summary:{name,peak,rms:Math.sqrt(sum/(buffer.length*2)),tail,counts:Object.fromEntries(['piano','kick','rim','hat','tom'].map(k=>[k,events.filter(e=>e.kind===k).length])),lastPiano:Math.max(-1,...events.filter(e=>e.kind==='piano').map(e=>e.t)),noEventsAfterStop:atStop===undefined||atStop===events.length,pianoBus:score.pianoBus.gain.value},sampleRate,pcm:btoa(binary)};
    }finally{Math.random=random;}
   },name);
   const s=result.summary;
   assert.ok(s.peak>.002&&s.peak<.16,JSON.stringify(s));assert.ok(s.rms>.0001&&s.rms<.025,JSON.stringify(s));
   assert.ok(s.counts.kick>0&&s.counts.rim>0);assert.equal(s.noEventsAfterStop,true);
   if(name==='deep'||name==='danger'){assert.equal(s.counts.piano,0);assert.ok(s.pianoBus<.0001);}
   else assert.ok(s.counts.piano>0);
   if(name==='descent')assert.ok(s.lastPiano<13);
   if(name==='stop')assert.ok(s.tail<.000001);
   fs.writeFileSync(path.join(folder,name+'.wav'),wav(result.pcm,result.sampleRate));report.push(s);
  }
  const count=s=>Object.values(s.counts).reduce((a,b)=>a+b,0);
  assert.ok(count(report.find(s=>s.name==='deep'))<count(report.find(s=>s.name==='shallow'))*.65);
  // Exercise the real engine's mode changes and the existing mute control after a user gesture.
  await page.mouse.click(5,5);
  const engine=await page.evaluate(async()=>{
   const {audio}=await import('/src/audio/Audio.ts');audio.unlock();await audio.ctx.resume();audio.music('ozean');
   audio.mood({depth:1});const mood=audio.score.depthTo===1;const same=audio.score;audio.music('generation');const reused=audio.score===same;audio.music('ending');const ending=audio.score===same;
   audio.setMuted(true);const muted=audio.muted;audio.setMuted(false);audio.music(null);
   return{running:audio.ctx.state,mood,reused,ending,muted,stopped:audio.score===null};
  });
  assert.deepEqual(engine,{running:'running',mood:true,reused:true,ending:true,muted:true,stopped:true});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({report,engine,errors},null,2)+'\n');
  console.log(JSON.stringify({report,engine,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
