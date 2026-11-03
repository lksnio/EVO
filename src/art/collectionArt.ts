import type Phaser from 'phaser';
import { tex, type Ctx } from '../util/canvas';
import { COLLECTION_FOSSILS } from '../data/collection';

const TAU = Math.PI * 2;
export const starPoint = (i: number, radius: number, inner = false) => {
  const a = -Math.PI / 2 + (i + (inner ? 0.5 : 0)) * TAU / 7;
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
};

function path(ctx: Ctx, points: number[][], close = true) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  if (close) ctx.closePath();
}

/** Static stone, painted once and shared by the overview and the large collection panel. */
export function collectionStarTexture(scene: Phaser.Scene) {
  return tex(scene, 'collection-star-stone-v1', 1024, 1024, ctx => {
    ctx.translate(512, 512);
    const points = Array.from({ length: 14 }, (_, i) => {
      const p = starPoint(i / 2, i % 2 ? 211 : 457);
      return [p.x, p.y];
    });
    ctx.shadowColor = '#000'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14;
    path(ctx, points);
    const stone = ctx.createLinearGradient(-260, -440, 260, 440);
    stone.addColorStop(0, '#48443a'); stone.addColorStop(0.45, '#252c2b'); stone.addColorStop(1, '#111a1c');
    ctx.fillStyle = stone; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); ctx.clip();
    // Deterministic mineral grain and sediment seams; no texture generation during animation.
    let seed = 613;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 6500; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(228,213,170,0.035)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(rnd() * 1000 - 500, rnd() * 1000 - 500, 1 + rnd() * 4, 1 + rnd() * 2);
    }
    for (let i = -5; i < 7; i++) {
      ctx.beginPath(); ctx.moveTo(-490, i * 90);
      ctx.bezierCurveTo(-120, i * 90 - 70, 70, i * 90 + 100, 490, i * 90 + 30);
      ctx.strokeStyle = 'rgba(190,170,127,0.045)'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    path(ctx, points); ctx.lineWidth = 9; ctx.strokeStyle = '#090d0e'; ctx.stroke();
    path(ctx, points.map(([x,y]) => [x * 0.97, y * 0.97]));
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(223,192,125,0.4)'; ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const p = starPoint(i, 285);
      ctx.beginPath(); ctx.moveTo(p.x * 0.33, p.y * 0.33); ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(198,157,84,0.15)'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (const r of [79, 90]) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.strokeStyle = 'rgba(207,172,106,0.26)'; ctx.lineWidth = 2; ctx.stroke();
    }
    // A small spiral at the centre ties the two seven-part collections together.
    ctx.beginPath();
    for (let t = 0; t < 17; t += 0.08) {
      const r = 2.6 * t; const x = Math.cos(t) * r, y = Math.sin(t) * r;
      if (!t) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = '#b49b6a'; ctx.lineWidth = 4; ctx.stroke();
  });
}

/** Anatomically distinct relief emblems, rather than seven generic fish silhouettes. */
function fossilAnimal(ctx: Ctx, index: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const fill = (p: number[][]) => { path(ctx, p); ctx.fill(); ctx.stroke(); };
  const line = (p: number[][], width = 1.5) => { path(ctx, p, false); ctx.lineWidth = width; ctx.stroke(); };
  if (index === 0) {
    fill([[-51,-9],[-37,-19],[-8,-17],[5,-12],[22,-9],[43,-23],[38,-1],[50,14],[24,7],[8,9],[-12,17],[-39,13],[-50,5]]);
    ctx.strokeStyle = '#5c492e';
    line([[-30,-18],[-23,-4],[-30,13]], 2); line([[-47,2],[-23,4],[-12,0]], 2);
    line([[-8,-16],[-2,-32],[11,-11]]); line([[-15,13],[-5,28],[9,10]]);
    ctx.fillStyle = '#172124'; ctx.beginPath(); ctx.arc(-39,-7,2.6,0,TAU); ctx.fill();
  } else if (index === 4 || index === 5) {
    fill(index === 4
      ? [[-53,-10],[-31,-17],[-11,-9],[15,-12],[30,-4],[48,-3],[51,2],[28,7],[7,12],[-13,7],[-36,11],[-53,5]]
      : [[-54,-8],[-31,-14],[-13,-7],[11,-8],[33,-1],[48,-18],[44,0],[53,15],[32,7],[9,12],[-15,8],[-35,9],[-54,4]]);
    fill([[-9,-9],[-1,-29],[13,-13],[14,-6]]);
    fill([[-12,8],[1,31],[14,17],[7,8]]);
    fill([[16,-8],[27,-24],[30,-8]]); fill([[16,10],[30,27],[31,8]]);
    line([[-50,1],[-29,2],[-23,0]], 1.7);
    ctx.fillStyle = '#172124'; ctx.beginPath(); ctx.arc(-36,-5,2,0,TAU); ctx.fill();
  } else if (index === 1) {
    fill([[-50,-4],[-39,-15],[-24,-13],[-12,-5],[18,-7],[36,0],[54,9],[25,7],[9,11],[-15,8],[-37,12],[-51,7]]);
    fill([[-8,2],[-15,20],[-29,24],[-21,15],[-21,4]]);
    fill([[17,3],[29,21],[16,24],[19,15],[7,6]]);
    line([[-48,4],[-32,5]], 1.5);
    ctx.fillStyle = '#172124'; ctx.beginPath(); ctx.arc(-40,-5,2,0,TAU); ctx.fill();
  } else {
    const arch = index === 3, mammal = index === 6;
    fill([[-48,-15],[-35,-24],[-21,-21],[-13,-9],[7,-15],[24,-11],[35,-3],[53,3],[31,4],[19,7],[-3,5],[-20,0],[-43,-1],[-50,-6]]);
    fill([[-9,-1],[-9,20],[-19,29],[-7,29],[0,16],[4,3]]);
    fill([[22,-2],[31,11],[26,28],[37,28],[39,11],[32,-3]]);
    if (arch) { // tall hind limbs, small forelimbs and a plated back
      fill([[-19,-10],[-22,6],[-13,9],[-16,-6]]);
      for(let x=-9;x<27;x+=8) fill([[x,-13],[x+3,-20],[x+6,-14]]);
    }
    if (index === 2) fill([[-35,-2],[-29,15],[-27,-2]]); // gorgonopsian saber
    if (mammal) fill([[-22,-19],[-25,-30],[-15,-21]]);
    line([[-48,-6],[-31,-7],[-23,-5]], 1.5);
    ctx.fillStyle = '#172124'; ctx.beginPath(); ctx.arc(-37,-16,2,0,TAU); ctx.fill();
  }
}

export function collectionFossilTexture(scene: Phaser.Scene, index: number, owned: boolean) {
  return tex(scene, `collection-fossil-${COLLECTION_FOSSILS[index].id}-${owned ? 'found' : 'empty'}`, 192, 192, ctx => {
    ctx.translate(96,96);
    const slab = [[-52,-72],[43,-76],[70,-40],[74,41],[48,68],[-42,73],[-73,35],[-69,-36]];
    ctx.shadowColor = '#000'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 5;
    path(ctx, slab);
    const g = ctx.createLinearGradient(-60,-75,60,75);
    g.addColorStop(0, owned ? '#b29b70' : '#20292a'); g.addColorStop(1, owned ? '#615741' : '#0c1517');
    ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#060b0d'; ctx.lineWidth = 5; ctx.stroke();
    path(ctx, slab.map(([x,y])=>[x*.93,y*.93])); ctx.strokeStyle = owned ? '#d1b87d' : '#4a5149'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.globalAlpha = owned ? .28 : .12;
    for(let i=0;i<70;i++) { ctx.fillStyle = i%2 ? '#ead9ad' : '#070e10'; ctx.fillRect((i*31%130)-65,(i*53%130)-65,2,1); }
    ctx.globalAlpha = 1;
    if(owned) {
      ctx.translate(0,3); ctx.scale(1.09,1.09);
      ctx.fillStyle = '#d7c79f'; ctx.strokeStyle = '#2b2920'; ctx.lineWidth = 2;
      fossilAnimal(ctx,index);
      ctx.strokeStyle = 'rgba(29,29,23,.38)'; ctx.lineWidth=1;
      path(ctx,[[-62,37],[-34,30],[-8,34]],false);ctx.stroke();
    } else {
      ctx.strokeStyle = '#60635a'; ctx.lineWidth = 2;
      ctx.beginPath();ctx.arc(0,0,25,0,TAU);ctx.stroke();
      ctx.fillStyle='#6d6d5f';ctx.font='28px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,2);
    }
  });
}

export function collectionShellTexture(scene: Phaser.Scene, index: number, owned: boolean) {
  return tex(scene, `collection-shell-${index}-${owned ? 'found' : 'empty'}`, 100, 100, ctx => {
    ctx.translate(50,52);
    ctx.beginPath();ctx.arc(0,-4,40,0,TAU);
    ctx.fillStyle='#0b1719';ctx.fill();ctx.strokeStyle=owned?'#bfaa79':'#49514b';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-9,22);
    ctx.bezierCurveTo(-44,-6,-31,-31,-18,-27);
    ctx.bezierCurveTo(-13,-40,-3,-37,0,-32);
    ctx.bezierCurveTo(10,-39,19,-33,21,-26);
    ctx.bezierCurveTo(39,-27,42,-5,9,22);ctx.closePath();
    const hues=['#dfcab1','#b6d2c4','#cfc1a0','#dab78a','#b5bfd5','#e4d9bd','#d2b7c6'];
    ctx.fillStyle=owned?hues[index]:'#29383a';ctx.fill();ctx.strokeStyle=owned?'#181b19':'#536260';ctx.lineWidth=2.6;ctx.stroke();
    for(let i=0;i<7;i++){
      const a=-Math.PI+.3+i*(Math.PI-.6)/6;
      ctx.beginPath();ctx.moveTo(0,20);ctx.quadraticCurveTo(Math.cos(a)*23,-2,Math.cos(a)*31,Math.sin(a)*31-2);
      ctx.strokeStyle=owned?'rgba(65,51,37,.47)':'rgba(124,143,135,.2)';ctx.lineWidth=1.6;ctx.stroke();
    }
    ctx.beginPath();ctx.ellipse(0,23,11,4,0,0,TAU);ctx.fillStyle=owned?'#ac9872':'#334347';ctx.fill();
  });
}
