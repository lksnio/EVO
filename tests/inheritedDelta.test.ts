import { beforeEach, describe, expect, it } from 'vitest';
import { game, newStyle } from '../src/state/GameState';

describe('Übersicht: geerbte Veränderung ohne Zufallssegen',()=>{
  beforeEach(()=>{game.resetAll();game.newRun(0);});
  it('zeigt stärkere und schwächere geerbte Werte gegenüber der vorigen Generation',()=>{
    expect(game.inheritedDelta()).toBeNull();
    const lay=(jaw:number)=>{
      const c=game.addClutch({place:'riff',x:300,y:600,at:Date.now(),fert:true,role:'father',young:1});
      const h=game.inherit({meat:0,plant:0},newStyle());delete h.evolution;delete h.fishPlan;h.traits.biteGain=jaw;
      game.layEggs(c,h);expect(game.hatch('next',0)).toBe(true);
    };
    lay(20);expect(game.inheritedDelta()!.bite).toBeGreaterThan(0);
    expect(game.inheritedDelta()!.skull).toBe(0);expect(game.inheritedDelta()!.scales).toBe(0);
    lay(5);expect(game.inheritedDelta()!.bite).toBeLessThan(0);
  });
});
