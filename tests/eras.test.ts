import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EPOCHS, ERAS, inEra, isPlayable, ofEra } from '../src/data/epochs';
import { SECTIONS } from '../src/data/aquapendium';
import { SPECIES } from '../src/data/species';
import { game, rootId, type Clutch, type Traits } from '../src/state/GameState';

// Drei Zeitalter zur Wahl (Ordovizium, Devon, Kreidezeit) – jedes eine eigene Welt mit eigener Linie und eigenem Stammbaum.

/** Die nächste Generation schlüpft – mit diesen Merkmalen (wie nach dem Laichen). */
function nextGen(t: Partial<Traits>) {
  const c: Clutch = { id: 1, place: 'lagune', x: 100, y: 100, at: Date.now(), fert: true, role: 'father' };
  game.succeed(c, { traits: { ...game.traits, ...t }, sex: 1, seed: 3, fit: { st: 0, bs: 0, vf: 0, sw: 0 } });
}

describe('Zeitalter', () => {
  it('drei zur Wahl, nur das Ordovizium ist schon spielbar', () => {
    expect(ERAS.map((e) => e.ep.id)).toEqual(['ordovizium', 'devon', 'kreide']);
    expect(ERAS.filter((e) => e.ep.playable).map((e) => e.ep.id)).toEqual(['ordovizium']);
    expect(isPlayable(0)).toBe(true);
    for (const { i } of ERAS.slice(1)) expect(isPlayable(i)).toBe(false);
    // die Reihenfolge ist Teil des Spielstands: das Ordovizium bleibt Nummer 0
    expect(EPOCHS[0].id).toBe('ordovizium');
    expect(inEra(EPOCHS[0])).toBe('im Ordovizium');
    expect(ofEra(ERAS[2].ep)).toBe('der Kreidezeit');
  });

  it('jedes Zeitalter hat seinen Teil im Aquapendium – und jedes Tier dort einen Steckbrief', () => {
    expect(SECTIONS.map((s) => s.ep.id)).toEqual(['ordovizium', 'devon', 'kreide']);
    for (const s of SECTIONS) {
      expect(s.entries.length).toBeGreaterThan(8);
      s.entries.forEach((e, k) => {
        expect(SPECIES[e.id]).toBeDefined();
        expect(e.no).toBe(k + 1);
        expect(e.note.length).toBeGreaterThan(30);
        expect(e.latin).not.toBe(e.def.name);
      });
    }
    const ids = (k: number) => SECTIONS[k].entries.map((e) => e.id);
    expect(ids(1)).toContain('dunkleosteus');
    for (const id of ['mosasaurus', 'elasmosaurus', 'archelon', 'ammonit', 'cretoxyrhina']) expect(ids(2)).toContain(id);
  });
});

describe('Stammbaum je Zeitalter', () => {
  beforeEach(() => game.resetAll());

  it('jede Linie beginnt am Urahn ihres Zeitalters; eine neue Art ist ein neuer Abschnitt des Astes', () => {
    const run = game.newRun(0);
    expect(run.node).toBe(rootId(0));
    nextGen({});
    // dieselbe Art: kein neuer Abschnitt
    expect(game.run!.node).toBe(rootId(0));
    nextGen({ bs: 1 });
    const n = game.data.nodes[game.run!.node];
    expect(n.parent).toBe(rootId(0));
    expect(n.gen).toBe(3);
    expect(n.epoch).toBe(0);
    const leaf = game.data.nodes[game.extinct(0.5, 'Gefressen')];
    expect(leaf.parent).toBe(n.id);
    expect(leaf.gen).toBe(3);
    expect(leaf.dead?.gens).toBe(3);
  });

  it('Linien, die zur selben Art werden, teilen sich den Ast', () => {
    game.newRun(0);
    nextGen({ bs: 1 });
    const a = game.run!.node;
    game.extinct(0.3, 'Gefressen');
    game.newRun(0);
    nextGen({});
    nextGen({ bs: 1 });
    expect(game.run!.node).toBe(a);
    expect(game.data.nodes[a].runs).toBe(2);
    // ab der früheren Generation
    expect(game.data.nodes[a].gen).toBe(2);
  });
});

describe('eine Linie je Zeitalter', () => {
  // Das Devon ist noch nicht spielbar – für diesen Test schon
  const devon = EPOCHS.findIndex((e) => e.id === 'devon');
  beforeEach(() => {
    EPOCHS[devon].playable = true;
    game.resetAll();
  });
  afterEach(() => {
    EPOCHS[devon].playable = undefined;
  });

  it('wer das Zeitalter wechselt, lässt seine Linie dort ruhen – und findet sie bei der Rückkehr wieder', () => {
    const a = game.newRun(0);
    game.enterEpoch(devon);
    expect(game.run).toBeNull();
    expect(game.runIn(0)).toBe(a);
    const b = game.newRun(devon);
    expect(b.node).toBe(rootId(devon));
    expect(game.chosenEpoch).toBe(devon);
    game.enterEpoch(0);
    expect(game.run).toBe(a);
    expect(game.runIn(devon)).toBe(b);
    expect(game.chosenEpoch).toBe(0);
  });

  it('in ruhende Zeitalter kann man nicht wechseln', () => {
    EPOCHS[devon].playable = undefined;
    const a = game.newRun(0);
    game.enterEpoch(devon);
    expect(game.run).toBe(a);
    expect(game.chosenEpoch).toBe(0);
  });
});

describe('ältere Spielstände', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('der alte Urahn wird der des Ordoviziums, Astenden kennen ihre Generation, Äste über Zeitalter hinweg fallen weg', () => {
    game.resetAll();
    const old = JSON.parse(JSON.stringify(game.data));
    const T = old.nodes.root.traits;
    old.nodes.root = { ...old.nodes.root, epoch: -1, sig: 'root', gen: undefined, children: ['n1', 'n2'] };
    old.nodes.n1 = { id: 'n1', parent: 'root', epoch: 0, cls: 'fish', traits: T, hue: 0, seed: 1, sig: 'x', children: [], runs: 1, last: 1, dead: { frac: 0.4, cause: 'Gefressen', run: 1, gens: 5 } };
    // früher konnte eine Linie ein Zeitalter überleben: Dieser Ast führte ins Devon
    old.nodes.n2 = { id: 'n2', parent: 'root', epoch: 0, cls: 'fish', traits: T, hue: 0, seed: 1, sig: 'y', children: ['n3'], runs: 1, last: 2 };
    old.nodes.n3 = { id: 'n3', parent: 'n2', epoch: 2, cls: 'fish', traits: T, hue: 0, seed: 1, sig: 'z', children: [], runs: 1, last: 2 };
    old.runs = 2;
    store.set('evo-save-v3', JSON.stringify(old));
    game.load();
    const root = game.data.nodes.root;
    expect(root.epoch).toBe(0);
    expect(root.gen).toBe(0);
    expect(game.data.nodes.n1.gen).toBe(5);
    expect(game.data.nodes.n3).toBeUndefined();
    expect(game.data.nodes.n2.children).toEqual([]);
    expect(game.chosenEpoch).toBe(0);
  });
});
