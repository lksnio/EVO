import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { STARTER_FORMS, PAINTED_FORMS, advanceStarterFish, resolveStarterForm, starterFormIndex, starterId, validStarterForm, type StarterScores } from '../src/sim/starterFish';
import { game, newStyle, packTraits } from '../src/state/GameState';
import { ADULT } from '../src/sim/life';
import { morphKey, quantize } from '../src/art/creatureArt';
import { STARTER_REGISTRATION } from '../src/art/fish/starterAssets';

vi.mock('phaser', () => ({ default: {} }));
beforeEach(() => { game.resetAll(); game.newRun(); });

describe('Die 48 erreichbaren Startfischformen', () => {
  it('hat genau 48 eindeutige Zustände und die passenden transparenten Laufzeitbilder', () => {
    expect(new Set(STARTER_FORMS.map(s => s.join(','))).size).toBe(48);
    expect(STARTER_REGISTRATION).toHaveLength(48);
    STARTER_FORMS.forEach((s,i) => {
      const art=STARTER_REGISTRATION[i];
      expect(art.id).toBe(starterId(i));expect(art.state).toEqual(s);
      if(i<PAINTED_FORMS.length)expect(existsSync(resolve('src/assets/fish/starter',art.id+'.webp'))).toBe(true);
      expect(art.eye.every(v => v>0 && v<1)).toBe(true);
      expect(art.mouth.length).toBeGreaterThan(2);
      expect(art.mouth.every(([x,y],j) => x>0 && x<1 && y>0 && y<1 && (!j || x>=art.mouth[j-1][0]))).toBe(true);
    });
  });

  it.each(STARTER_FORMS.map((state,index)=>({state,index})))(
    'ist aus dem Basisfisch erreichbar: $state', ({state,index}) => {
      let child={scores:[10,10,10] as StarterScores,form:0,primary:0};
      const main=[0,2].sort((a,b)=>state[b]-state[a] || a-b)[0];
      const train=(axis:number,target:number) => {
        for(let n=0;STARTER_FORMS[child.form][axis]<target && n<100;n++){
          const next:StarterScores=[...child.scores];next[axis]+=5;
          child=advanceStarterFish(child.scores,next,child.form,child.primary);
        }
        expect(STARTER_FORMS[child.form][axis]).toBe(target);
      };
      if(state[main])train(main,1);
      const side=[0,2].find(i=>i!==main && state[i]>0)??-1;
      if(side>=0)train(side,1); // Nebenmerkmal bereits vor Primärstufe 3.
      if(state[main]>1)train(main,state[main]);
      if(state[1])train(1,state[1]);
      expect(child.form).toBe(index);
      expect(STARTER_FORMS[child.form]).toEqual(state);
    },
  );

  it.each([[20,25,0,1],[50,60,1,2],[100,125,2,3]])(
    'springt bei Elternwert %s nur mit positivem Zugewinn auf %s', (threshold,target,from,to) => {
      const form=starterFormIndex([from,0,0]);
      const child=advanceStarterFish([threshold,10,10],[threshold+.25,10,10],form,from?1:undefined);
      expect(child.scores[0]).toBe(target);expect(STARTER_FORMS[child.form][0]).toBe(to);
      expect(advanceStarterFish([threshold,10,10],[threshold,10,10],form,from?1:undefined).form).toBe(form);
    },
  );

  it('bleibt an der Trainingsgrenze und entwickelt erst den passenden Nachkommen', () => {
    const first=advanceStarterFish([19,10,10],[23,10,10]);
    expect(first.scores[0]).toBe(20);expect(first.form).toBe(0);
    const next=advanceStarterFish(first.scores,[21,10,10],first.form,first.primary);
    expect(next.scores[0]).toBe(25);expect(next.primary).toBe(1);
  });

  it('begrenzt den Sekundärschaden auf 25; Flossen bleiben unabhängig',()=>{
    const both=starterFormIndex([1,0,1]);
    const child=advanceStarterFish([50,50,25],[54,55,29],both,1);
    expect(STARTER_FORMS[child.form]).toEqual([2,2,1]);expect(child.scores).toEqual([60,55,25]);
    const reverse=advanceStarterFish([25,50,50],[29,55,54],both,3);expect(STARTER_FORMS[reverse.form]).toEqual([1,2,2]);
  });

  it('beschränkt ältere Mischwerte auf eine vorhandene Zeichnung, ohne die Werte zu verändern', () => {
    const scores:StarterScores=[200,150,130];
    expect(STARTER_FORMS[resolveStarterForm(scores)]).toEqual([3,3,1]);
    expect(scores).toEqual([200,150,130]);
    expect(validStarterForm(-1)).toBe(false);expect(validStarterForm(48)).toBe(false);expect(validStarterForm(1.5)).toBe(false);
  });

  it('verwendet für jede Kombination eine eigene Kennung und behält sie in Vorschau und Wachstum', () => {
    const keys=new Set<string>();
    STARTER_FORMS.forEach((stages,index)=>{
      const value=(stage:number)=>[10,25,60,125][stage];
      const traits={...game.traits,biteGain:value(stages[0])-10,finGain:[10,20,50,100][stages[1]]-10,ramGain:value(stages[2])-10};
      const adult=game.morph({traits,life:ADULT}),young=game.morph({traits,life:{grow:.4,old:0}});
      expect(adult.fishForm).toBe(index);expect(young.fishForm).toBe(index);
      expect(quantize(adult).fishForm).toBe(index);keys.add(morphKey(adult));
    });
    expect(keys.size).toBe(48);
  });

  it('vererbt Form und Primärmerkmal tatsächlich im Laich; der Elternfisch verwandelt sich nicht', () => {
    vi.spyOn(Math,'random').mockReturnValue(.5);
    game.traits.biteGain=10; // Elternwert 20.
    const style={...newStyle(),biteDamage:100};
    const heir=game.inherit({meat:40,plant:60},style);
    const clutch=game.addClutch({place:'riff',x:300,y:600,at:Date.now(),fert:true,role:'father',young:1});
    const [egg]=game.layEggs(clutch,heir);
    expect(game.roeShown(egg).bite).toBe(25);expect(game.roeMorph(egg).fishForm).toBe(starterFormIndex([1,0,0]));
    expect(game.morph().fishForm).toBe(0);
    expect(egg.traits.fishPrimary).toBe(1);
    expect(packTraits({...game.traits,fishForm:18,fishPrimary:1}).fishForm).toBe(18);
    expect(game.hatch('next',0)).toBe(true);
    expect(game.morph().fishForm).toBe(starterFormIndex([1,0,0]));
    game.ageBy(250);expect(game.morph().fishForm).toBe(starterFormIndex([1,0,0]));vi.restoreAllMocks();
  });
});
