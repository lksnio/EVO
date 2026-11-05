import {beforeEach,describe,it,expect,vi} from 'vitest';
import {fishBirthGains,weightedFishDamage,finSpeed,appendFishMark} from '../src/sim/fishEvolution';
import {fishTree} from '../src/sim/fishTree';
import {game,newStyle} from '../src/state/GameState';
import {ADULT} from '../src/sim/life';
vi.mock('phaser',()=>({default:{}}));
beforeEach(()=>{game.resetAll();game.newRun();});
const plan=(meat:number,low=1)=>({eaten:{meat,plant:100-meat},effort:{minHealth:low}});
const rolls=(...values:number[])=>{let i=0;return ()=>values[i++]??.5;};
describe('Ernährung und feste Untergrenzen',()=>{
 it.each([[90,3, -1],[100,4,-2],[10,-1,3],[0,-2,4],[75,1,0],[89,2,0],[25,0,1],[11,0,2]])('Nahrung %s Prozent Fleisch', (meat,hp,stamina)=>{
  const high=hp===4||stamina===4||hp===2||stamina===2||hp===-2;
  const g=fishBirthGains(plan(meat),rolls(.5,high?.75:.25,high?.75:.25)).gains;
  expect(g.hp).toBe(hp);expect(g.stamina).toBe(stamina);
 });
 it.each([[.25,.25,-1,-1],[.25,.75,-1,1],[.75,.25,1,-1],[.75,.75,1,1]])('gemischte Kost, unabhängige Münzwürfe %s/%s',(a,b,hp,stamina)=>{
  const g=fishBirthGains(plan(50),rolls(.5,a,b)).gains;expect([g.hp,g.stamina]).toEqual([hp,stamina]);
 });
 it('begrenzt alle Werte auf die Startwerte und verändert den Elternfisch nicht',()=>{
  const before=game.roeShown();const h=game.inherit({meat:0,plant:100},newStyle());
  expect(game.roeShown(h).hp).toBe(before.hp);expect(game.roeShown(h).stam).toBeGreaterThan(before.stam);
  expect(game.roeShown()).toEqual(before);
  const second=game.inherit({meat:100,plant:0},{...newStyle(),minHealth:1});
  expect(game.roeShown(second).stam).toBe(before.stam);expect(game.roeShown(second).scales).toBe(10);
 });
 it('verdoppelte Lebenskraft skaliert die Länge mit der Kubikwurzel, nicht das Tempo oder die Waffen',()=>{
  const a=game.stats('fish',game.traits,ADULT),b=game.stats('fish',{...game.traits,vitality:a.maxHp},ADULT);
  expect(b.maxHp).toBe(a.maxHp*2);expect(b.size/a.size).toBeCloseTo(Math.cbrt(2));expect(b.speed).toBe(a.speed);expect(b.bite).toBe(a.bite);
 });
});
describe('Schaden, Schuppen und seltene Flossen',()=>{
 it('zählt tatsächlich verursachten Schaden ohne Nahrung oder Sieg, größer gewichtet, bis +4 je Waffe',()=>{
  expect(weightedFishDamage(20,400,100)).toBe(40);
  const g=fishBirthGains({eaten:{meat:0,plant:0},effort:{biteDamage:50,ramDamage:1000}},()=>.5).gains;
  expect(g.bite).toBe(2);expect(g.skull).toBe(4);expect(g.hp).toBe(0);expect(g.stamina).toBe(0);
  const h=game.inherit({meat:0,plant:0},{...newStyle(),biteDamage:100});expect(h.traits.biteGain).toBe(4);
 });
 it.each([[1,-1,0],[.75,-1,0],[.749,0,0],[.5,0,0],[.499,1,0],[.25,1,0],[.249,2,-1],[.1,2,-1],[.099,3,-1]])('Tiefststand %s ergibt %s Schuppen und %s Flossen',(low,scales,fins)=>{
  const g=fishBirthGains(plan(50,low),()=>.5).gains;expect(g.scales).toBe(scales);expect(g.fins).toBe(fins);
 });
 it('nur der 10-Prozent-Wurf ersetzt alle anderen Gewinne und Verluste',()=>{
  const rare=fishBirthGains({...plan(100,.01),effort:{minHealth:.01,biteDamage:100,ramDamage:100}},()=>.099);
  expect(rare).toEqual({mutation:true,gains:{hp:0,stamina:0,bite:0,skull:0,fins:5,scales:0}});
  expect(fishBirthGains(plan(100),()=>.1).mutation).toBe(false);
 });
 it('legt die Mutation pro Ei genau einmal fest und erhält sie beim Speichern und Schlüpfen',()=>{
  const spy=vi.spyOn(Math,'random').mockReturnValue(.05);
  const h=game.inherit({meat:100,plant:0},{...newStyle(),biteDamage:100,minHealth:.01});
  const c=game.addClutch({place:'riff',x:300,y:600,at:Date.now(),fert:true,role:'father',young:1});
  const [egg]=game.layEggs(c,h);spy.mockRestore();
  expect(egg.finMutation).toBe(true);expect(game.roeShown(egg).fins).toBe(15);expect(game.roeShown(egg).hp).toBe(game.roeShown().hp);
  expect(egg.traits.biteGain??0).toBe(0);expect(game.hatch('next',0)).toBe(true);expect(game.roeShown().fins).toBe(15);
 });
 it.each([[10,1],[20,1.5],[35,1.75],[50,2],[75,2.5],[100,3],[150,3]])('nur Flossen %s bestimmen Faktor %s',(fins,speed)=>expect(finSpeed(fins)).toBeCloseTo(speed));
 it('Ausdauer und Flossen sind vollständig unabhängig; alte Körperwerte verändern das Tempo nicht',()=>{
  const a=game.stats('fish',game.traits,ADULT),b=game.stats('fish',{...game.traits,staminaGain:30},ADULT);
  expect(b.endurance/a.endurance).toBe(2);expect(b.speed).toBe(a.speed);
  const c=game.stats('fish',{...game.traits,finGain:40,lengthGain:4,massGain:2,endGain:999,swift:1},ADULT);
  expect(c.speed/a.speed).toBe(2);expect(c.endurance).toBe(a.endurance);
 });
});
describe('Nur beobachtete Evolutionspfade',()=>{
 it('speichert Zahlenänderungen ohne neue Form nicht als zusätzlichen Knoten',()=>{
  expect(appendFishMark([{form:0,primary:0}],0,0)).toHaveLength(1);
 });
 it('vereinigt gemeinsame Abstammung, erhält getrennte Äste und übernimmt fremde Pfade exakt',()=>{
  const root={form:0,primary:0},bite={form:1,primary:1},skull={form:7,primary:3};
  const tree=fishTree([{id:'a',name:'A',trace:[root,bite],extinct:true},{id:'b',name:'B',trace:[root,skull]},{id:'c',name:'A',trace:[root,skull,{form:8,primary:3}]}]);
  expect(tree.nodes).toHaveLength(4);expect(tree.nodes[0].children).toHaveLength(2);expect(Math.max(...tree.nodes.map(n=>n.depth))).toBe(2);
 });
});

it('beim Übernehmen eines fremden Eis bleibt der bisherige Ast erhalten und der fremde Pfad wird fortgesetzt',()=>{
 const old=[{form:0,primary:0},{form:1,primary:1}];const peer=[{form:0,primary:0},{form:7,primary:3},{form:8,primary:3}];
 game.run!.fishTrace=old;game.run!.coopGen=4;game.data.fishBranches=[{id:`local-${game.run!.id}`,name:'Deine Linie',trace:old}];
 game.hatchRoe({id:'adoptpeer',traits:{fishForm:8,fishPrimary:3,ramGain:50},trace:peer,generation:4,seed:1,sex:1,place:'riff',x:200,y:500},4);
 expect(game.run!.fishTrace).toEqual(peer);expect(game.data.fishBranches!.some(b=>b.extinct&&b.trace[1].form===1)).toBe(true);
 const child=appendFishMark(game.run!.fishTrace,9,3);expect(child.slice(0,3)).toEqual(peer);
});

it('der seltene Flossenwurf verändert auch bei alten gemischten Spielständen keinen anderen Wert',()=>{
 Object.assign(game.traits,{biteGain:90,ramGain:40,vitality:30,staminaGain:20,scaleGain:15});
 const before=game.roeShown();const spy=vi.spyOn(Math,'random').mockReturnValue(.05);
 const h=game.inherit({meat:100,plant:0},{...newStyle(),biteDamage:100,ramDamage:100,minHealth:.01});
 const c=game.addClutch({place:'riff',x:200,y:500,at:Date.now(),fert:true,role:'father',young:1});
 const [egg]=game.layEggs(c,h);spy.mockRestore();
 const after=game.roeShown(egg);expect(after).toEqual({...before,fins:before.fins+5,speed:Math.round(before.speed*1.25)});
 expect(egg.traits.biteGain).toBe(90);expect(egg.traits.ramGain).toBe(40);
});
