import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {fishBirthGains,weightedFishDamage,finSpeed,appendFishMark} from '../src/sim/fishEvolution';
import {fishTree,fishSuccessors,fishTreeBranches} from '../src/sim/fishTree';
import {STARTER_FORMS,starterFormIndex} from '../src/sim/starterFish';
import {game,newStyle} from '../src/state/GameState';
import {ADULT} from '../src/sim/life';
import {EPOCHS} from '../src/data/epochs';
vi.mock('phaser',()=>({default:{}}));
// These are the retained Devon rules; the playable Perm lineage has its own evolution flow.
const devonPlayable=EPOCHS[0].playable;
beforeEach(()=>{EPOCHS[0].playable=true;game.resetAll();game.newRun(0);});
afterEach(()=>{EPOCHS[0].playable=devonPlayable;});
const plan=(meat:number,low=1)=>({eaten:{meat,plant:100-meat},effort:{minHealth:low}});
const rolls=(...values:number[])=>{let i=0;return ()=>values[i++]??.5;};
describe('Ernährung und feste Untergrenzen',()=>{
 it.each([[90,3, -1],[100,4,-2],[10,-1,3],[0,-2,4],[75,1,0],[89,2,0],[25,0,1],[11,0,2]])('Nahrung %s Prozent Fleisch', (meat,hp,stamina)=>{
  const high=hp===4||stamina===4||hp===2||stamina===2||hp===-2;
  const nutritionRolls=meat>=90||meat<=10?2:1;
  const g=fishBirthGains(plan(meat),rolls(.5,...Array(nutritionRolls).fill(high?.75:.25))).gains;
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
 it('respektiert trotz Streuung Startwerte, sichtbare Stufensprünge und die Grenze der sekundären Waffe',()=>{
  const birth=(r:number)=>{
   const spy=vi.spyOn(Math,'random').mockReturnValue(r);
   try{const c=game.addClutch({place:'riff',x:300,y:500,at:Date.now(),fert:true,role:'father',young:1});return game.layEggs(c,game.inherit({meat:0,plant:0},newStyle()))[0];}
   finally{spy.mockRestore();}
  };
  const base=game.roeShown(),low=game.roeShown(birth(.2));expect(low).toEqual(base);
  game.traits.biteGain=9;
  const step=birth(.8);expect(game.roeShown(step).bite).toBe(25);expect(step.traits.fishForm).toBe(1);
  Object.assign(game.traits,{biteGain:30,ramGain:15,fishForm:18,fishPrimary:1});
  expect(game.roeShown(birth(.8)).ram).toBe(25);
 });
 it('würfelt jeden der fünf Werte unabhängig mit exakt drei gleich großen Zufallsbereichen',()=>{
  const p={eaten:{meat:0,plant:0},effort:{biteDamage:60,ramDamage:80,minHealth:.4}};
  const keys=['hp','stamina','bite','skull','scales'] as const;
  const base=fishBirthGains(p,()=>.5,true).gains;
  const counts=keys.map(()=>[0,0,0]);
  for(let n=0;n<243;n++){
   const offsets=keys.map((_,i)=>Math.floor(n/3**i)%3-1);
   const result=fishBirthGains(p,rolls(.5,...offsets.map(v=>(v+1.5)/3)));
   keys.forEach((key,i)=>{expect(result.gains[key]).toBeCloseTo(base[key]+offsets[i]);counts[i][offsets[i]+1]++;});
   expect(result.gains.fins).toBe(base.fins);expect(result.mutation).toBe(false);
  }
  expect(counts).toEqual(keys.map(()=>[81,81,81]));
  for(const [roll,offset]of [[0,-1],[1/3-1e-8,-1],[1/3,0],[2/3-1e-8,0],[2/3,1],[1-1e-8,1]]){
   expect(fishBirthGains(p,rolls(.5,...keys.map(()=>roll))).gains.hp).toBe(offset);
  }
 });
 it('hält die Vorschau zufallsfrei und berechnet den Flossenverlust aus der Verletzung statt aus zufälligen Schuppen',()=>{
  const random=vi.fn(()=>.99),p=plan(50,.2);
  expect(fishBirthGains(p,random,true).gains.scales).toBe(2);expect(random).not.toHaveBeenCalled();
  const low=fishBirthGains(p,rolls(.5,.5,.5,0,0,0,0,0));
  const high=fishBirthGains(p,rolls(.5,.5,.5,.99,.99,.99,.99,.99));
  expect(low.gains.scales).toBe(1);expect(high.gains.scales).toBe(3);
  expect(low.gains.fins).toBe(-1);expect(high.gains.fins).toBe(-1);
 });
 it('speichert den individuellen Wurf pro Ei und würfelt bei Anzeige oder Schlüpfen nicht erneut',()=>{
  Object.assign(game.traits,{vitality:10,staminaGain:10,scaleGain:10,biteGain:5,ramGain:5,finGain:10,fishForm:4});
  const parent={...game.traits},h=game.inherit({meat:0,plant:0},{...newStyle(),biteDamage:50,ramDamage:50,minHealth:.4});
  const lay=(r:number)=>{
   const spy=vi.spyOn(Math,'random').mockReturnValue(r);
   try{const c=game.addClutch({place:'riff',x:300,y:500,at:Date.now(),fert:true,role:'father',young:1});return game.layEggs(c,h)[0];}
   finally{spy.mockRestore();}
  };
  const a=lay(.2),b=lay(.8);
  for(const key of ['vitality','staminaGain','scaleGain','biteGain','ramGain'] as const)expect((b.traits[key]??0)-(a.traits[key]??0)).toBe(2);
  expect(a.traits.finGain).toBe(10);expect(b.traits.finGain).toBe(10);expect(game.traits).toEqual(parent);
  const saved=JSON.stringify(a),shown=game.roeShown(a);expect(game.roeShown(a)).toEqual(shown);expect(JSON.stringify(a)).toBe(saved);
  game.hatchRoe(a,2);expect(game.traits.biteGain).toBe(a.traits.biteGain);expect(game.roeShown().bite).toBe(shown.bite);
 });
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

describe('Erreichbare Möglichkeiten neben euren Wegen',()=>{
 it('zeigt nur aktuelle Spieler als lebende Stränge und bewahrt ältere echte Verläufe als Geschichte',()=>{
  const root={form:0,primary:0};
  const own={id:'local-2',name:'Deine Linie',trace:[root,{form:1,primary:1}]};
  const ben={id:'peer-now',name:'Ben',trace:[root,{form:7,primary:3}]};
  const old={id:'peer-old',name:'Ben',trace:[root,{form:4,primary:0}]};
  const tree=fishTreeBranches([old,{id:'peer-empty',name:'Alt',trace:[root]}, {...ben,trace:[root]}],own,[ben]);
  expect(tree.filter(b=>!b.archived&&!b.extinct)).toEqual([own,ben]);
  expect(tree.find(b=>b.id===old.id)).toEqual({...old,archived:true});
  expect(tree.some(b=>b.id==='peer-empty')).toBe(false);
  expect(fishTree(tree,true).nodes.find(n=>!n.possible&&n.mark.form===4)!.children).toEqual([]);
 });
 it('zeigt alle 48 Formen über legale Einzelschritte, unabhängige Flossen und begrenzten Sekundärschaden',()=>{
  const pending=[{form:0,primary:0}],seen=new Set<string>(),forms=new Set<number>();
  while(pending.length){
   const mark=pending.pop()!,key=`${mark.form}.${mark.primary}`;
   if(seen.has(key))continue;seen.add(key);forms.add(mark.form);
   const before=STARTER_FORMS[mark.form];
   for(const next of fishSuccessors(mark)){
    const after=STARTER_FORMS[next.form];
    expect(after.reduce((sum,v,i)=>sum+v-before[i],0)).toBe(1);
    if(mark.primary)expect(next.primary).toBe(mark.primary);
    if(next.primary===1)expect(after[2]).toBeLessThanOrEqual(1);
    if(next.primary===3)expect(after[0]).toBeLessThanOrEqual(1);
    pending.push(next);
   }
  }
  expect(forms.size).toBe(48);
 });
 it('trennt ungespielte Äste von beiden echten Verläufen, ohne ihre gemeinsame Abstammung zu verändern',()=>{
  const root={form:0,primary:0},a={id:'a',name:'Anna',trace:[root,{form:1,primary:1}]},b={id:'b',name:'Ben',trace:[root,{form:7,primary:3}]};
  const observed=fishTree([a,b]),tree=fishTree([a,b],true);
  expect(tree.nodes.filter(n=>!n.possible).map(n=>n.id)).toEqual(observed.nodes.map(n=>n.id));
  expect(tree.roots[0].routes.map(b=>b.name)).toEqual(['Anna','Ben']);
  expect(tree.nodes.some(n=>n.possible)).toBe(true);
  for(const parent of tree.nodes)for(const child of parent.children)if(child.possible){
   expect(fishSuccessors(parent.mark)).toContainEqual(child.mark);
   expect(child.routes).toEqual([]);expect(child.branches).toEqual([]);
  }
  expect(Math.max(...tree.nodes.map(n=>n.depth))).toBeLessThanOrEqual(7);
  expect(tree.nodes.every(n=>Number.isFinite(n.x))).toBe(true);
 });
 it('endet am vollständig entwickelten Tier und setzt keine weiteren scheinbaren Stufen dahinter',()=>{
  const mark={form:starterFormIndex([3,3,1]),primary:1};
  expect(fishSuccessors(mark)).toEqual([]);
  const tree=fishTree([{id:'a',name:'A',trace:[{form:0,primary:0},mark]}],true);
  expect(tree.nodes.find(n=>!n.possible&&n.mark.form===mark.form)!.children).toEqual([]);
 });
});

it('verstärkt Grundbiss und alle Gebissstufen um 25 Prozent bei unveränderten sichtbaren Punkten',()=>{
 for(const points of [10,25,60,125]){
  const traits={...game.traits,biteGain:points-10};
  const st=game.stats('fish',traits,ADULT),base=game.stats('fish',{...game.traits,biteGain:0},ADULT);
  const oldBaseBite=4*base.size*Math.pow(ADULT.grow,.6);
  expect(st.bite).toBeCloseTo(oldBaseBite*1.25*points/10);
  expect(game.roeShown({traits}).bite).toBe(points);
  expect(st.ram).toBe(base.ram);
 }
 expect(game.shown().bite).toBe(10);
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
