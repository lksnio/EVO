import { beforeEach, describe, expect, it } from 'vitest';
import { game, type RoeEgg } from '../src/state/GameState';
import { ADULT } from '../src/sim/life';
import { orderRoe } from '../src/sim/roe';

const eggs: RoeEgg[] = [
  { id: 'eggbite', traits: { biteGain: 12, vitality: 3 }, seed: 1, sex: 1, place: 'riff', x: 600, y: 300 },
  { id: 'eggswim', traits: { finGain: 12, vitality: 9 }, seed: 2, sex: 1, place: 'riff', x: 600, y: 300 },
  { id: 'egggold', traits: { ramGain: 10 }, seed: 3, sex: 1, place: 'riff', x: 600, y: 300 },
];
const shown = () => orderRoe(eggs, (e) => game.roeShown(e)).map(({ egg, v }) => ({ id: egg.id, v }));

describe('Gemeinsamer Laich: Werte und Reihenfolge', () => {
  beforeEach(() => { game.resetAll(); game.newRun(0); });

  it('zeigt identische Eier trotz anderer Elterntiere und gesammelter Muscheln', () => {
    const raw = JSON.stringify(eggs);
    game.traits.biteGain = 90;
    const a = shown();
    game.traits.biteGain = 0;
    game.traits.finGain = 120;
    game.collectShell('abyss');
    expect(shown()).toEqual(a);
    expect(JSON.stringify(eggs)).toBe(raw);
  });

  it('ordnet gleich starke Eier nach Kennung, unabhängig von der Reihenfolge im Netzwerk', () => {
    const same = eggs.slice(0, 2).map((e) => ({ ...e, traits: {} }));
    const ids = (list: RoeEgg[]) => orderRoe(list, (e) => game.roeShown(e)).map((r) => r.egg.id);
    expect(ids(same)).toEqual(ids([...same].reverse()));
  });

  it('ein geschlüpftes Tier übernimmt die im Ei sichtbare Lebenskraft', () => {
    const e=eggs[2],hp=game.roeShown(e).hp;
    game.hatchRoe(e,2);game.ageBy(250);
    expect(game.stats('fish',game.traits,ADULT).maxHp).toBe(hp);
  });

  it('Ausdauer: Ei, eigenes Erbgut und Spiel rechnen gleich – unabhängig von Wachstum, Spieler und Sammelfunden', () => {
    const egg: RoeEgg = { id: 'eggfins', traits: { finGain: 10 }, seed: 4, sex: 1, place: 'riff', x: 0, y: 0 };
    const a = game.roeShown(egg).stam;
    // ein anderer Spieler: jung, mit anderem Erbgut
    game.traits.biteGain = 40;
    expect(game.roeShown(egg).stam).toBe(a);
    // Tempo kostet etwas Ausdauer: kräftigere Flossen ermüden ein wenig früher (aber nur ein wenig)
    const plain = game.roeShown({ ...egg, traits: {} }).stam;
    expect(a).toBeLessThan(plain);
    expect(a).toBeGreaterThan(plain * 0.9);
    // geschlüpft: dieselbe Ausdauer im Spiel, ob Jungtier oder ausgewachsen
    game.hatchRoe(egg, 2);
    expect(game.shown().stam).toBe(a);
    game.ageBy(250);
    expect(game.shown().stam).toBe(a);
  });
});
