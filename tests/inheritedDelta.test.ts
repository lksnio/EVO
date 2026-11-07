import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { game, newStyle } from '../src/state/GameState';
import { EPOCHS } from '../src/data/epochs';

const devonPlayable = EPOCHS[0].playable;
afterEach(() => { EPOCHS[0].playable = devonPlayable; });

describe('Übersicht: geerbte Veränderung ohne Zufallssegen',()=>{
  beforeEach(()=>{EPOCHS[0].playable=true;game.resetAll();game.newRun(0);});
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

it('compares each Perm generation with its own inherited weapon state', () => {
  game.resetAll(); game.newRun(2);
  for (let generation = 0; generation < 4; generation++) {
    const c = game.addClutch({ place: 'riff', x: 1100, y: 520, at: Date.now(), fert: true,
      role: 'father', young: 1, breedingSite: 'water' });
    game.layEggs(c, game.inherit({ meat: 0, plant: 0 }, { ...newStyle(), biteDamage: 100 }));
    expect(game.hatch('next', 0)).toBe(true);
  }
  expect(game.evolution.tier).toBe(1);
  expect(game.shown().bite).toBe(18);
  expect(game.inheritedDelta()).toMatchObject({ bite: 5, skull: 0 });
});
