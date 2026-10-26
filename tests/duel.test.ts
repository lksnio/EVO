import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { EPOCHS } from '../src/data/epochs';
import { placesOf } from '../src/data/world';
import { generateLevel } from '../src/level/LevelGen';
import { WORLD } from '../src/data/life';
import { ZONE_ROOM, zoneId, type DuelHatchMsg, type DuelHurtMsg, type DuelStartMsg, type JoinOptions } from '../src/net/protocol';
import { DuelState, ZoneState } from '../src/net/schema';
import { afterLay, ARENA, BEATS, DUEL, duelDamage, duelReward, elemAt, flowAt, driftEgg } from '../src/sim/duel';

// Das Laichduell: Regeln (sim/duel.ts) und der Ablauf auf dem Server – einloggen in der Höhle, das Becken, Bisse, Laichen,
// Schlüpfen und der Sieg.

describe('Laichduell: Regeln', () => {
  it('Stein schlägt Wasser, Wasser schlägt Pflanze, Pflanze schlägt Stein – sonst 2', () => {
    expect(duelDamage('stone', 'water')).toBe(5);
    expect(duelDamage('stone', 'plant')).toBe(1);
    expect(duelDamage('water', 'plant')).toBe(5);
    expect(duelDamage('water', 'stone')).toBe(1);
    expect(duelDamage('plant', 'stone')).toBe(5);
    expect(duelDamage('plant', 'water')).toBe(1);
    for (const e of ['base', 'stone', 'water', 'plant'] as const) {
      expect(duelDamage(e, e)).toBe(2);
      expect(duelDamage('base', e)).toBe(2);
      expect(duelDamage(e, 'base')).toBe(2);
    }
    expect(BEATS.base).toBeNull();
  });

  it('links Stein, Mitte Wasser, rechts Pflanzen; oben zieht die Strömung nach rechts, unten nach links', () => {
    expect(elemAt(10)).toBe('stone');
    expect(elemAt(ARENA.w / 2)).toBe('water');
    expect(elemAt(ARENA.w - 10)).toBe('plant');
    expect(flowAt(ARENA.currents[0].y0 + 5)).toBe(1);
    expect(flowAt(ARENA.floor - 5)).toBe(-1);
    expect(flowAt((ARENA.surface + ARENA.floor) / 2)).toBe(0);
    // unten rechts gelaicht: In der Zeit bis zum Schlüpfen treibt der Laich vom Pflanzen- ins Steingebiet
    const e = { x: ARENA.w - 150, y: ARENA.floor - 20 };
    expect(elemAt(e.x)).toBe('plant');
    for (let t = 0; t < DUEL.hatch; t += 0.05) driftEgg(e, 0.05);
    expect(elemAt(e.x)).toBe('stone');
  });

  it('Laichen kostet die Hälfte der Lebenskraft; die Belohnung wird aufgerundet', () => {
    expect(afterLay(20)).toBe(10);
    expect(afterLay(7)).toBe(4);
    expect(afterLay(1)).toBe(1);
    // erster Fisch: 20 Nahrung je Nachkomme → 5 für den Sieger, 2 für den Verlierer
    expect(duelReward(20, true)).toBe(5);
    expect(duelReward(20, false)).toBe(2);
    expect(duelReward(23, true)).toBe(6);
    expect(duelReward(23, false)).toBe(3);
  });
});

const PORT = 25900 + Math.floor(Math.random() * 200);
const URL = `http://localhost:${PORT}`;
const ZONE = zoneId(0, 'riff');
const L = generateLevel(EPOCHS[0], WORLD.seed, placesOf(EPOCHS[0])[0]);
const cave = L.cave!;
const inside = { x: cave.x + cave.w * 0.5, y: cave.y + cave.h * 0.5 };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Zeit abgelaufen');
    await wait(20);
  }
}
const opts = (name: string, o: Partial<JoinOptions> = {}): JoinOptions => ({ zone: ZONE, name, look: '', gen: 1, x: inside.x, y: inside.y, ...o });
const join = (o: JoinOptions) => new Client(URL).joinOrCreate<ZoneState>(ZONE_ROOM, o, ZoneState);

describe('Laichduell: auf dem Server', () => {
  const rooms: { leave(): Promise<unknown> }[] = [];
  const saved = { ...DUEL };

  beforeAll(async () => {
    // kurz gefasst: schneller Start, schnelles Schlüpfen, kein Schutz nach einem Treffer
    Object.assign(DUEL, { count: 0.2, hatch: 0.6, guard: 0, biteEvery: 0 });
    await server.listen(PORT);
  });

  afterAll(async () => {
    Object.assign(DUEL, saved);
    for (const r of rooms) await Promise.race([r.leave().catch(() => undefined), wait(500)]);
    await server.gracefullyShutdown(false);
  });

  it('einloggen geht nur zu zweit in der Höhle – wer sie verlässt, ist wieder draußen', async () => {
    const a = await join(opts('Anna'));
    rooms.push(a);
    await until(() => a.state.players.size === 1);
    // allein in der Höhle: nichts
    a.send('cave', { on: true });
    await wait(150);
    expect(a.state.players.get(a.sessionId)!.cave).toBe(false);
    const b = await join(opts('Ben', { x: 2400, y: 400 }));
    rooms.push(b);
    await until(() => a.state.players.size === 2);
    // der andere ist nicht in der Höhle: nichts
    a.send('cave', { on: true });
    await wait(150);
    expect(a.state.players.get(a.sessionId)!.cave).toBe(false);
    // Ben kommt herein – jetzt geht es
    for (let i = 1; i <= 10; i++) {
      b.send('pos', { t: i, x: 2400 + (inside.x - 2400) * (i / 10), y: 400 + (inside.y - 400) * (i / 10), facing: -1, anim: 0, size: 1 });
      await wait(150);
    }
    await until(() => Math.abs(a.state.players.get(b.sessionId)!.x - inside.x) < 1);
    a.send('cave', { on: true });
    await until(() => a.state.players.get(a.sessionId)!.cave);
    // Anna schwimmt hinaus: ausgeloggt
    a.send('pos', { t: 1, x: cave.x + cave.w + 400, y: inside.y, facing: 1, anim: 0, size: 1 });
    await until(() => !a.state.players.get(a.sessionId)!.cave);
    await a.leave();
    await b.leave();
  });

  it('zwei Eingeloggte kommen ins Becken: Bisse, Laichen, Schlüpfen und der Sieg', async () => {
    const a = await join(opts('Ada'));
    const b = await join(opts('Bo'));
    rooms.push(a, b);
    const starts: DuelStartMsg[] = [];
    a.onMessage('duel', (m: DuelStartMsg) => starts.push(m));
    b.onMessage('duel', (m: DuelStartMsg) => starts.push(m));
    await until(() => a.state.players.size === 2);
    a.send('cave', { on: true });
    await until(() => a.state.players.get(a.sessionId)!.cave);
    b.send('cave', { on: true });
    await until(() => starts.length === 2);
    expect(starts[0].room).toBe(starts[1].room);
    expect(starts.map((m) => m.side).sort()).toEqual([0, 1]);
    expect(starts[0].ticket).not.toBe(starts[1].ticket);
    expect(new Set(starts.map((m) => m.foe))).toEqual(new Set(['Ada', 'Bo']));
    // nach dem Start ist niemand mehr eingeloggt
    await until(() => !a.state.players.get(a.sessionId)!.cave && !a.state.players.get(b.sessionId)!.cave);
    // ohne gültige Eintrittskarte kommt niemand hinein
    await expect(new Client(URL).joinById(starts[0].room, { ticket: 'falsch-falsch' }, DuelState)).rejects.toThrow();
    const ticketOf = (side: number) => starts.find((m) => m.side === side)!.ticket;
    const left = await new Client(URL).joinById<DuelState>(starts[0].room, { ticket: ticketOf(0) }, DuelState);
    const right = await new Client(URL).joinById<DuelState>(starts[0].room, { ticket: ticketOf(1) }, DuelState);
    rooms.push(left, right);
    const hurts: DuelHurtMsg[] = [], hatches: DuelHatchMsg[] = [];
    left.onMessage('hurt', (m: DuelHurtMsg) => hurts.push(m));
    left.onMessage('hatch', (m: DuelHatchMsg) => hatches.push(m));
    await until(() => left.state.phase === 'play');
    const L1 = left.state.fish.get(left.sessionId)!, R1 = left.state.fish.get(right.sessionId)!;
    expect(L1.side).toBe(0);
    expect(L1.x).toBeLessThan(R1.x);
    expect(L1.hp).toBe(DUEL.hp);
    expect(L1.elem).toBe('base');
    // beide schwimmen in die Mitte (ruhiges Wasser, keine Strömung)
    const y = Math.round((ARENA.surface + ARENA.floor) / 2);
    left.send('pos', { t: 1, x: ARENA.w / 2 - 40, y, facing: 1, anim: 0, size: 1, gen: 1 });
    right.send('pos', { t: 1, x: ARENA.w / 2 + 40, y, facing: -1, anim: 0, size: 1, gen: 1 });
    await until(() => Math.abs(left.state.fish.get(right.sessionId)!.x - (ARENA.w / 2 + 40)) < 1 && Math.abs(left.state.fish.get(left.sessionId)!.x - (ARENA.w / 2 - 40)) < 1);
    // ein Biss: Urfisch gegen Urfisch, 2 Schaden
    left.send('hit', {});
    await until(() => hurts.length === 1);
    expect(hurts[0]).toMatchObject({ to: right.sessionId, from: left.sessionId, dmg: 2, hp: DUEL.hp - 2 });
    // rechts laicht: die Hälfte der Lebenskraft ist fort – und nur einmal zugleich
    right.send('lay', {});
    await until(() => left.state.eggs.size === 1);
    expect(left.state.fish.get(right.sessionId)!.hp).toBe(afterLay(DUEL.hp - 2));
    right.send('lay', {});
    await wait(80);
    expect(left.state.eggs.size).toBe(1);
    // nach der Zeit schlüpft der neue Fisch – mit voller Lebenskraft und dem Element des Gebiets (hier: Wasser)
    await until(() => hatches.length === 1);
    expect(hatches[0]).toMatchObject({ owner: right.sessionId, elem: 'water', gen: 2 });
    await until(() => left.state.fish.get(right.sessionId)!.hp === DUEL.hp);
    expect(left.state.fish.get(right.sessionId)!.elem).toBe('water');
    expect(left.state.eggs.size).toBe(0);
    // Meldungen des alten Fisches zählen nicht mehr
    right.send('pos', { t: 2, x: ARENA.w / 2 + 300, y, facing: -1, anim: 0, size: 1, gen: 1 });
    await wait(80);
    expect(left.state.fish.get(right.sessionId)!.x).toBeCloseTo(hatches[0].x, 0);
    // links beißt, bis rechts stirbt – ohne Laich ist die Runde vorbei
    right.send('pos', { t: 3, x: ARENA.w / 2 + 40, y, facing: -1, anim: 0, size: 1, gen: 2 });
    await until(() => Math.abs(left.state.fish.get(right.sessionId)!.x - (ARENA.w / 2 + 40)) < 1);
    for (let i = 0; i < 12 && left.state.phase === 'play'; i++) {
      left.send('hit', {});
      await wait(40);
    }
    await until(() => left.state.phase === 'over');
    expect(left.state.winner).toBe(left.sessionId);
    expect(right.state.winner).toBe(left.sessionId);
    expect(left.state.fish.get(right.sessionId)!.alive).toBe(false);
  });

  it('wer mitten im Duell geht, verliert', async () => {
    const a = await join(opts('Cara'));
    const b = await join(opts('Dirk'));
    rooms.push(a, b);
    const starts: DuelStartMsg[] = [];
    a.onMessage('duel', (m: DuelStartMsg) => starts.push(m));
    b.onMessage('duel', (m: DuelStartMsg) => starts.push(m));
    await until(() => a.state.players.size >= 2);
    a.send('cave', { on: true });
    b.send('cave', { on: true });
    await until(() => starts.length === 2);
    const [p, q] = await Promise.all(starts.map((m) => new Client(URL).joinById<DuelState>(m.room, { ticket: m.ticket }, DuelState)));
    rooms.push(p, q);
    await until(() => p.state.phase === 'play');
    await q.leave();
    await until(() => p.state.phase === 'over');
    expect(p.state.winner).toBe(p.sessionId);
  });
});
