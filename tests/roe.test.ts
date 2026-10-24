import { beforeEach, describe, expect, it } from 'vitest';
import { game, type RoeEgg } from '../src/state/GameState';
import { orderRoe } from '../src/sim/roe';

const eggs: RoeEgg[] = [
  { id: 'eggbite', traits: { biteGain: 12, vitality: 3 }, seed: 1, sex: 1, place: 'riff', x: 600, y: 300 },
  { id: 'eggswim', traits: { finGain: 12, vitality: 9 }, seed: 2, sex: 1, place: 'riff', x: 600, y: 300 },
  { id: 'egggold', traits: { ramGain: 10 }, seed: 3, sex: 1, place: 'riff', x: 600, y: 300, gold: 'hp' },
];
const shown = () => orderRoe(eggs, (e) => game.roeShown(e)).map(({ egg, v }) => ({ id: egg.id, v }));

describe('Gemeinsamer Laich: Werte und Reihenfolge', () => {
  beforeEach(() => { game.resetAll(); game.newRun(0); });

  it('zeigt identische Eier trotz anderer Elterntiere und persönlicher Muschelsegen', () => {
    const raw = JSON.stringify(eggs);
    game.traits.biteGain = 90;
    const a = shown();
    game.traits.biteGain = 0;
    game.traits.finGain = 120;
    game.run!.ups = { hp: 4, stam: 3, sight: 2, oxy: 0 };
    expect(shown()).toEqual(a);
    expect(JSON.stringify(eggs)).toBe(raw);
  });

  it('ordnet gleich starke Eier nach Kennung, unabhängig von der Reihenfolge im Netzwerk', () => {
    const same = eggs.slice(0, 2).map((e) => ({ ...e, traits: {} }));
    const ids = (list: RoeEgg[]) => orderRoe(list, (e) => game.roeShown(e)).map((r) => r.egg.id);
    expect(ids(same)).toEqual(ids([...same].reverse()));
  });

  it('enthält den goldenen Segen; persönliche Segen gelten weiterhin nach dem Schlüpfen', () => {
    const e = eggs[2];
    const geneticHp = game.roeShown(e).hp;
    expect(geneticHp).toBeGreaterThan(game.roeShown({ ...e, gold: undefined }).hp);
    game.run!.ups = { hp: 4, stam: 0, sight: 0, oxy: 0 };
    expect(game.roeShown(e).hp).toBe(geneticHp);
    game.hatchRoe(e, 2);
    expect(game.ups.hp).toBe(5);
    expect(game.stats(game.cls, game.traits, undefined, true).maxHp).toBeGreaterThan(geneticHp);
  });
});
