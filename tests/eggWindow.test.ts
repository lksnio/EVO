import {beforeEach,describe,expect,it,vi} from 'vitest';
import {game,type RoeEgg} from '../src/state/GameState';
vi.mock('phaser',()=>({default:{}}));
beforeEach(()=>{game.resetAll();game.newRun();});
const egg=(id:string,generation:number):RoeEgg=>({id,generation,traits:{ramGain:15},sex:1,seed:1,place:'riff',x:200,y:500});
describe('Nur aktuelle und nächste Eier',()=>{
 it('verwirft alte Eier beim Generationswechsel und lässt sie anschließend nicht mehr schlüpfen',()=>{
  const old=egg('oldone',1);game.run!.pool=[old];game.run!.next=[egg('nextone',2),egg('nexttwo',2)];
  expect(game.hatch('next',0)).toBe(true);expect(game.pool.map(e=>e.id)).toEqual(['nexttwo']);expect(game.poolGen).toBe(2);
  game.run!.pool.push(old);const before={...game.traits};expect(game.hatch('pool',1)).toBe(false);game.hatchRoe(old,1);
  expect(game.life.gen).toBe(2);expect(game.traits).toEqual(before);
 });
 it('übernimmt genau das gemeinsame Generationsfenster, auch wenn der eigene Fisch noch älter ist',()=>{
  game.syncShared(4,[egg('oldone',1),egg('current',4)],[egg('nextone',5),egg('future',6)]);
  expect(game.life.gen).toBe(1);expect(game.poolGen).toBe(4);expect(game.pool.map(e=>e.id)).toEqual(['current']);expect(game.roe.map(e=>e.id)).toEqual(['nextone']);
 });
 it('beendet den Wartezustand erst durch ein gültiges Ei',()=>{
  game.waitForEgg('Räuber');expect(game.run!.waiting).toBe(true);
  game.hatchRoe(egg('future',4),4);expect(game.run!.waiting).toBe(true);
  game.hatchRoe(egg('nextone',2),2);expect(game.run!.waiting).toBe(false);expect(game.life.gen).toBe(2);
 });
});

it('entfernt auch die lokale Kopie eines vom Server zugeteilten Eis vor dem nächsten Netzwerk-Update',()=>{
 const chosen=egg('claimed',2);game.run!.next=[chosen,egg('sibling',2)];
 game.hatchRoe({...chosen,traits:{...chosen.traits}},2);
 expect(game.pool.map(e=>e.id)).toEqual(['sibling']);
});

it('behält den Tod beim Neuladen bei und entfernt dabei gespeicherte Eier früherer Generationen',()=>{
 game.waitForEgg('Räuber');game.run!.coopGen=3;game.run!.pool=[egg('oldone',1),egg('current',3)];
 const data=JSON.stringify(game.data);vi.stubGlobal('localStorage',{getItem:()=>data,setItem:()=>{}});
 try{game.load();expect(game.run!.waiting).toBe(true);expect(game.run!.waitCause).toBe('Räuber');expect(game.pool.map(e=>e.id)).toEqual(['current']);}
 finally{vi.unstubAllGlobals();}
});
