import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorldSync } from '../src/net/WorldSync';
import { animalRow } from '../src/net/animalRow';
import type { Animal } from '../src/objects/Animal';
import type { LevelScene } from '../src/scenes/LevelScene';
import type { Zone } from '../src/net/NetClient';
import { type AnimalRow, type FaunaMsg } from '../src/net/protocol';
import { ZoneState, NetAnimal } from '../src/net/schema';

vi.mock('../src/art/speciesArt', () => ({ makeSpeciesTextures() {} }));
vi.mock('../src/objects/Food', () => ({ Kill: class {}, Meat: class {} }));
vi.mock('../src/net/GhostAnimal', () => ({ GhostAnimal: class {
  netId: number; dead = false; active = true; def: { id: string }; hp: number;
  constructor(_host: unknown, def: { id: string }, r: AnimalRow) { this.netId = r.id; this.def = def; this.hp = r.hp; }
  apply = vi.fn();
  destroy() { this.active = false; }
  fadeOut() { this.dead = true; this.active = false; }
  reveal = vi.fn();
} }));

const row = (id: number, extra: Partial<AnimalRow> = {}): AnimalRow => ({ id, sp: 'moythomasia', x: 1200, y: 400, d: 1, an: 0, hp: 6, mh: 8, sz: 1, tn: 0, al: 100, at: false, ...extra });
function animal(id: number) {
  return { netId: id, def: { id: 'moythomasia' }, x: 1200, y: 400, sz: 1, hp: 6, maxHp: 8, flipX: false, angle: 0, alpha: 0, presence: 1, isTinted: true, fogTint: true, tintTopLeft: 0x14262a, glowing: false, attacking: false, b: { reset: vi.fn() }, setScale() {}, setFlipX() {} } as unknown as Animal;
}
function setup() {
  const state = new ZoneState();
  const sent: FaunaMsg[] = [];
  const h = {
    animals: [] as Animal[], meats: [], plants: [], time: { now: 0 },
    player: { dead: false, hurt: vi.fn() }, ended: false,
    dropShared() { this.animals = this.animals.filter((a) => (a as unknown as { ghost?: boolean }).ghost); },
    dropAnimal(a: Animal) { this.animals = this.animals.filter((x) => x !== a); },
    spawnAnimal(_id: string, x: number, y: number) { const a = animal(0); a.x = x; a.y = y; this.animals.push(a); return a; },
    confirmNetDefeat() {},
  };
  const zone = { me: 'anna', state, fauna: (msg: FaunaMsg) => sent.push(msg) } as unknown as Zone;
  const world = new WorldSync(h as unknown as LevelScene, () => zone);
  const add = (r: AnimalRow) => { const n = new NetAnimal(); Object.assign(n, r, { t: 100 }); state.animals.set(String(r.id), n); };
  return { h, state, world, sent, add };
}

let now = 10000;
beforeEach(() => { now = 10000; vi.spyOn(performance, 'now').mockImplementation(() => now); });

describe('Gemeinsame Tiere: Sicht und Wiederherstellung', () => {
  it('überträgt keine lokale Unsichtbarkeit oder Nebelfärbung, aber die echte Einblendung und Angriffsfarbe', () => {
    const a = animal(1);
    expect(animalRow(a)).toMatchObject({ al: 100, tn: 0 });
    a.presence = 0.6;
    expect(animalRow(a).al).toBe(60);
    Object.assign(a, { glowing: true, tintTopLeft: 0xff7a66 });
    expect(animalRow(a).tn).toBe(0xff7a66);
  });

  it('holt einen fälschlich tot vorhergesagten oder zerstörten Stellvertreter wieder hervor', () => {
    const { world, h, state, add } = setup();
    add(row(7)); world.setHost(false);
    const g = h.animals[0];
    g.dead = true;
    (g as unknown as { onDie: () => void }).onDie();
    g.destroy();
    world.patch(state);
    expect(h.animals).toHaveLength(0);
    now += 2000;
    world.patch(state);
    expect(h.animals).toHaveLength(1);
    expect(h.animals[0]).not.toBe(g);
    expect(h.animals[0].netId).toBe(7);
    expect(h.animals[0].dead).toBe(false);
    state.animals.delete('7'); world.patch(state);
    expect(h.animals).toHaveLength(0);
  });

  it('übernimmt beim Wächterwechsel auch fehlende und lokal falsch tot gemeldete Tiere aus dem Serverstand', () => {
    const { world, h, state, add } = setup();
    add(row(7)); world.setHost(false);
    h.animals[0].dead = true;
    add(row(9, { x: 3000, hp: 3, sz: 1.2 })); // noch kein lokaler Stellvertreter
    world.setHost(true);
    expect(h.animals.map((a) => a.netId)).toEqual([7, 9]);
    expect(h.animals[1].hp).toBe(3);
    expect(h.animals[1].b.reset).toHaveBeenCalledWith(3000, 400);
    const extra = animal(0); h.animals.push(extra); world.update();
    expect(extra.netId).toBeGreaterThan(9);
    expect(state.animals.size).toBe(2);
  });

  it('bereitet einen bisher unbekannten Angreifer vor, bevor der Schaden angewendet wird', () => {
    const { world, h } = setup(); world.setHost(false);
    h.player.hurt.mockImplementation(() => expect(h.animals).toHaveLength(1));
    world.hurt({ animal: 21, attacker: row(21, { at: true }), dmg: 2, x: 1200, by: 'Fisch' });
    expect(h.player.hurt).toHaveBeenCalled();
    expect((h.animals[0] as unknown as { reveal: unknown }).reveal).toHaveBeenCalled();
  });

  it('meldet auch ruhende Tiere regelmäßig und berechnet Tiere außerhalb des eigenen Blickfelds', () => {
    const { world, h, sent } = setup(); h.animals.push(animal(1)); world.setHost(true);
    for (let i = 0; i < 30; i++) { now += 100; world.update(); }
    const rows = sent.flatMap((m) => m.a ?? []);
    expect(rows.filter((r) => r.id === 1).length).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.al === 100)).toBe(true);
  });

  it('meldet Tiere in der Nähe eines anderen Spielers doppelt so oft – und wen sie jagen', () => {
    const { world, h, sent } = setup();
    const near = animal(1), far = animal(2);
    far.x = 8000;
    h.animals.push(near, far);
    world.setHost(true);
    world.addTarget('ben', { view: { x: 1200, y: 400, active: true }, dead: false, gone: false } as never);
    Object.assign(near, { target: world.targets.get('ben'), st: 'hunt', aggroUntil: 0 });
    for (let i = 0; i < 20; i++) {
      now += 50;
      near.x += 3; far.x += 3;
      world.update();
    }
    const rows = sent.flatMap((m) => m.a ?? []);
    const n1 = rows.filter((r) => r.id === near.netId), n2 = rows.filter((r) => r.id === far.netId);
    expect(n1.length).toBeGreaterThanOrEqual(18);
    expect(n2.length).toBeGreaterThanOrEqual(9);
    expect(n2.length).toBeLessThanOrEqual(11);
    expect(n1.every((r) => r.hu === 'ben')).toBe(true);
    expect(n2.every((r) => r.hu === '')).toBe(true);
    // und den eigenen Spieler (Sitzungskennung des Ortswächters)
    Object.assign(far, { target: h.player, st: 'hunt' });
    now += 200; far.x += 3; world.update();
    expect(sent.flatMap((m) => m.a ?? []).filter((r) => r.id === far.netId).pop()?.hu).toBe('anna');
  });

  it('blendet einen beim Ortswächter fortgezogenen Stellvertreter aus, statt ihn schlagartig zu entfernen', () => {
    const { world, h, state, add } = setup();
    add(row(7)); world.setHost(false);
    const g = h.animals[0] as unknown as { fadeOut: () => void };
    const fade = vi.spyOn(g, 'fadeOut');
    state.animals.delete('7'); world.patch(state);
    expect(fade).toHaveBeenCalled();
    expect(h.animals).toHaveLength(0);
  });
});
