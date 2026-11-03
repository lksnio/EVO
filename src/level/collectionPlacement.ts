import { groundAt } from './terrain';

interface FloorMap { width:number; height:number; terrain:{hp:number[]} }
export interface CollectionSpot { x:number; y:number }

/** Keep the whole collectible above ground and outside rocks; use the same geometry as the running map. */
export function collectionSpot(L:FloorMap,solidAt:(x:number,y:number)=>boolean,preferredX?:number):CollectionSpot|undefined {
  const free=(x:number):CollectionSpot|undefined=>{
    if(x<70||x>L.width-70)return;
    const y=groundAt(L.terrain.hp,x)-3;
    if(!Number.isFinite(y)||y>=L.height-10)return;
    for(const dx of [-20,0,20])for(const dy of [8,28,48])if(solidAt(x+dx,y-dy))return;
    return {x,y};
  };
  if(preferredX!==undefined){
    const x=Math.max(70,Math.min(L.width-70,preferredX));
    for(let d=0;d<L.width;d+=20){
      const spot=free(x+d)??(d?free(x-d):undefined);
      if(spot)return spot;
    }
    return;
  }
  let deepest:CollectionSpot|undefined;
  for(let x=100;x<L.width-100;x+=20){
    const spot=free(x);
    if(spot&&(!deepest||spot.y>deepest.y))deepest=spot;
  }
  return deepest;
}
