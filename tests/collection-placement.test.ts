import { describe,expect,it } from 'vitest';
import { collectionSpot } from '../src/level/collectionPlacement';
import { loadLevel } from '../src/level/loadLevel';
import { EPOCHS } from '../src/data/epochs';
import { placeOf } from '../src/data/world';

describe('Erreichbare Sammelfunde',()=>{
  it('legt eine Fossilplatte neben einen Fels statt in seine Kollision',()=>{
    const L={width:600,height:500,terrain:{hp:Array(30).fill(420)}};
    const solid=(x:number,y:number)=>x>200&&x<400&&y>300;
    const p=collectionSpot(L,solid,300)!;
    expect(p).toBeDefined();expect(p.x).toBeGreaterThanOrEqual(420);
    for(const dx of [-20,0,20])for(const dy of [8,28,48])expect(solid(p.x+dx,p.y-dy)).toBe(false);
  });
  it('erfindet bei vollständig geschlossenem Boden keine unerreichbare Position',()=>{
    const L={width:600,height:500,terrain:{hp:Array(30).fill(420)}};
    expect(collectionSpot(L,()=>true,300)).toBeUndefined();
  });
  it('findet im realen Tiefental einen tiefen freien Muschelort und freie Ablageorte quer durch die Karte',()=>{
    const L=loadLevel(EPOCHS[0],1,placeOf('devon','wand'));
    const solid=(x:number,y:number)=>L.solids.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
    const deepest=collectionSpot(L,solid)!;
    expect(deepest).toBeDefined();expect(deepest.y).toBeGreaterThan(L.height*.75);
    for(let x=100;x<L.width-100;x+=200){
      const p=collectionSpot(L,solid,x)!;expect(p).toBeDefined();
      for(const dx of [-20,0,20])for(const dy of [8,28,48])expect(solid(p.x+dx,p.y-dy)).toBe(false);
    }
  });
});
