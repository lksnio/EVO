import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EPOCHS, ERAS, firstPlayable, inEra, isPlayable, ofEra } from '../src/data/epochs';
import { SECTIONS } from '../src/data/aquapendium';
import { SPECIES } from '../src/data/species';
import { INHERIT } from '../src/data/life';
import { game, rootId, type Clutch, type Traits } from '../src/state/GameState';

// Sieben Zeitalter zur Wahl (Devon bis Paläogen) – jedes eine eigene Welt mit eigener Linie und eigenem Stammbaum.
// Der Prototyp spielt nur im frühen Perm; Devon und Karbon ruhen im Stein, bis sie wiederkommen.
const P = firstPlayable();

/** Die nächste Generation schlüpft – mit diesen Merkmalen (wie nach dem Laichen). */
function nextGen(t: Partial<Traits>) {
  const c: Clutch = { id: 1, place: 'riff', x: 100, y: 100, at: Date.now(), fert: true, role: 'father' };
  const v = INHERIT.vary;
  INHERIT.vary = 0;
  const [egg] = game.layEggs(c, { traits: { ...game.traits, ...t }, sex: 1, seed: 3, fit: { st: 0, bs: 0, vf: 0, sw: 0 } });
  INHERIT.vary = v;
  game.hatch('next', game.roe.indexOf(egg));
}

describe('Zeitalter', () => {
  it('sieben zur Wahl, nur das Perm ist spielbar – mit Weltkarte und im gemalten Stil', () => {
    expect(ERAS.map((e) => e.ep.id)).toEqual(['devon', 'karbon', 'perm', 'trias', 'jura', 'kreide', 'palaeogen']);
    expect(ERAS.filter((e) => e.ep.playable).map((e) => e.ep.id)).toEqual(['perm']);
    expect(EPOCHS[P].id).toBe('perm');
    expect(EPOCHS[P].overworld).toBe(true);
    expect(EPOCHS[P].painted).toBe(true);
    // das Devon bleibt gemalt (für später), ist aber nicht spielbar
    expect(EPOCHS[0].painted).toBe(true);
    for (const { i } of ERAS.filter((e) => e.i !== P)) expect(isPlayable(i)).toBe(false);
    // die Reihenfolge ist Teil des Spielstands: Nummer 0 (früher das Ordovizium) ist heute das Devon
    expect(EPOCHS[0].id).toBe('devon');
    // die Zeiträume schließen lückenlos aneinander an
    ERAS.slice(1).forEach((e, k) => expect(e.ep.period[0]).toBe(ERAS[k].ep.period[1]));
    expect(inEra(EPOCHS[0])).toBe('in the Devonian');
    expect(ofEra(EPOCHS[0])).toBe('of the Devonian');
    expect(ofEra(ERAS[3].ep)).toBe('of the Triassic');
    expect(inEra(ERAS[5].ep)).toBe('in the Cretaceous');
  });

  it('jedes Zeitalter hat seinen Teil im Aquapendium – und jedes Tier dort einen Steckbrief', () => {
    expect(SECTIONS.map((s) => s.ep.id)).toEqual(ERAS.map((e) => e.ep.id));
    const filled = SECTIONS.filter((s) => s.entries.length);
    expect(filled.map((s) => s.ep.id)).toEqual(['devon', 'karbon', 'perm', 'kreide']);
    for (const s of filled) {
      expect(s.entries.length).toBeGreaterThan(8);
      s.entries.forEach((e, k) => {
        expect(SPECIES[e.id]).toBeDefined();
        expect(e.no).toBe(k + 1);
        expect(e.note.length).toBeGreaterThan(30);
        expect(e.latin).not.toBe(e.def.name);
      });
    }
    const ids = (id: string) => SECTIONS.find((s) => s.ep.id === id)!.entries.map((e) => e.id);
    for (const id of ['dunkleosteus', 'thelodus', 'pteraspis', 'drepanaspis']) expect(ids('devon')).toContain(id);
    for (const id of ['mosasaurus', 'elasmosaurus', 'archelon', 'ammonit', 'cretoxyrhina']) expect(ids('kreide')).toContain(id);
    for (const id of ['rhizodus', 'strepsodus', 'tausendfuss', 'pulmonoscorpius', 'elonichthys']) expect(ids('karbon')).toContain(id);
    // im Perm auch die Tiere, die nur an einzelnen Orten leben – samt Dimetrodon, dem Boss des Hochlands
    for (const id of ['paramblypterus', 'orthacanthus', 'dimetrodon', 'eryops', 'diplocaulus', 'eudibamus']) expect(ids('perm')).toContain(id);
  });
});

describe('Stammbaum je Zeitalter', () => {
  beforeEach(() => game.resetAll());

  it('jede Linie beginnt am Urahn ihres Zeitalters; eine neue Art ist ein neuer Abschnitt des Astes', () => {
    const run = game.newRun(P);
    expect(run.node).toBe(rootId(P));
    nextGen({});
    // dieselbe Art: kein neuer Abschnitt
    expect(game.run!.node).toBe(rootId(P));
    nextGen({ bs: 1 });
    const n = game.data.nodes[game.run!.node];
    expect(n.parent).toBe(rootId(P));
    expect(n.gen).toBe(3);
    expect(n.epoch).toBe(P);
    const leaf = game.data.nodes[game.extinct(0.5, 'Gefressen')];
    expect(leaf.parent).toBe(n.id);
    expect(leaf.gen).toBe(3);
    expect(leaf.dead?.gens).toBe(3);
  });

  it('Linien, die zur selben Art werden, teilen sich den Ast', () => {
    game.newRun(P);
    nextGen({ bs: 1 });
    const a = game.run!.node;
    game.extinct(0.3, 'Gefressen');
    game.newRun(P);
    nextGen({});
    nextGen({ bs: 1 });
    expect(game.run!.node).toBe(a);
    expect(game.data.nodes[a].runs).toBe(2);
    // ab der früheren Generation
    expect(game.data.nodes[a].gen).toBe(2);
  });
});

describe('eine Linie je Zeitalter', () => {
  // Ein zweites spielbares Zeitalter gibt es gerade nicht – für diesen Test wird das (verborgene) Ordovizium eines: Es hat Orte
  const other = EPOCHS.findIndex((e) => e.id === 'ordovizium');
  beforeEach(() => {
    EPOCHS[other].playable = true;
    game.resetAll();
  });
  afterEach(() => {
    EPOCHS[other].playable = undefined;
  });

  it('wer das Zeitalter wechselt, lässt seine Linie dort ruhen – und findet sie bei der Rückkehr wieder', () => {
    const a = game.newRun(P);
    game.enterEpoch(other);
    expect(game.run).toBeNull();
    expect(game.runIn(P)).toBe(a);
    const b = game.newRun(other);
    expect(b.node).toBe(rootId(other));
    expect(game.chosenEpoch).toBe(other);
    game.enterEpoch(P);
    expect(game.run).toBe(a);
    expect(game.runIn(other)).toBe(b);
    expect(game.chosenEpoch).toBe(P);
  });

  it('in ruhende Zeitalter kann man nicht wechseln – auch nicht ins Devon', () => {
    const a = game.newRun(P);
    game.enterEpoch(0);
    expect(game.run).toBe(a);
    expect(game.chosenEpoch).toBe(P);
    // eine neue Linie in einem ruhenden Zeitalter beginnt im Perm
    game.extinct(0.5, 'Test');
    expect(game.newRun(0).epoch).toBe(P);
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

  it('der alte Urahn wird der des ersten Zeitalters, Astenden kennen ihre Generation, Äste über Zeitalter hinweg fallen weg', () => {
    game.resetAll();
    const old = JSON.parse(JSON.stringify(game.data));
    const T = old.nodes.root.traits;
    old.nodes.root = { ...old.nodes.root, epoch: -1, sig: 'root', gen: undefined, children: ['n1', 'n2'] };
    old.nodes.n1 = { id: 'n1', parent: 'root', epoch: 0, cls: 'fish', traits: T, hue: 0, seed: 1, sig: 'x', children: [], runs: 1, last: 1, dead: { frac: 0.4, cause: 'Gefressen', run: 1, gens: 5 } };
    // früher konnte eine Linie ein Zeitalter überleben: Dieser Ast führte ins nächste
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
    // ohne laufende Linie geht es im ersten spielbaren Zeitalter weiter
    expect(game.chosenEpoch).toBe(P);
  });

  it('eine Linie im Devon geht nicht verloren: Sie ruht dort, bis das Devon wieder spielbar ist', () => {
    EPOCHS[0].playable = true;
    try {
      game.resetAll();
      game.newRun(0);
      game.ageBy(30);
      store.set('evo-save-v3', JSON.stringify(game.data));
    } finally {
      EPOCHS[0].playable = undefined;
    }
    game.load();
    expect(game.run).toBeNull();
    expect(game.runIn(0)?.life.age).toBe(30);
    expect(game.chosenEpoch).toBe(P);
    // eine neue Linie beginnt im Perm, die im Devon ruht weiter
    const b = game.newRun();
    expect(b.epoch).toBe(P);
    expect(game.runIn(0)).not.toBeNull();
  });

  it('entfernt alte Aufgaben, Wand- und Bosszustände, erhält aber die laufende Linie', () => {
    game.resetAll();
    game.newRun(P);
    game.ageBy(40);
    game.collectShell('abyss');
    const old = JSON.parse(JSON.stringify(game.data));
    const r = old.run;
    r.quests = { gefaehrte: 1, jagd: 2 };
    r.hunt = { kills: 2, took: true, size: 5 };
    r.walls = ['devon:garten:0'];
    r.coatSet = true;
    r.life.coat = 1;
    r.prog.boss = 1;
    r.prog.resume = { x: 1800, y: 400 };
    r.swarm = { members: [{ id: 1, hp: 0.6 }], next: 2, out: [1], callable: false, fed: 1, grown: 0, lost: 0, left: 0 };
    store.set('evo-save-v3', JSON.stringify(old));
    game.load();
    expect(game.run?.id).toBe(r.id);
    expect(game.life.age).toBe(40);
    expect(game.prog.resume).toEqual({ x: 1800, y: 400 });
    expect(game.shells).toBe(1);
    expect(game.life.coat).toBe(1);
    expect(game.drifted().coat).toBe(1);
    expect(game.swarm?.callable).toBe(true);
    expect(game.swarm?.members).toEqual([{ id: 1, hp: 0.6 }]);
    expect(game.swarm?.out).toEqual([1]);
    for (const field of ['quests', 'hunt', 'walls', 'coatSet']) expect(game.run).not.toHaveProperty(field);
    expect(game.prog).not.toHaveProperty('boss');
    game.save();
    const saved = JSON.parse(store.get('evo-save-v3')!);
    expect(saved.run).not.toHaveProperty('quests');
    expect(saved.run.prog).not.toHaveProperty('boss');
  });

});
