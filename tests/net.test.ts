import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { parseZone } from '../src/server/ZoneRoom';
import { ZONE_ROOM, zoneId, type EatMsg, type HitMsg, type HurtMsg, type JoinOptions, type SnapMsg, type WelcomeMsg } from '../src/net/protocol';
import { ZoneState } from '../src/net/schema';

// Meilenstein 1: Zwei Clients betreten denselben Ort und sehen die Bewegungen des jeweils anderen.

const PORT = 25670 + Math.floor(Math.random() * 200);
const URL = `http://localhost:${PORT}`;
const ZONE = zoneId(0, 'lagune');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Zeit abgelaufen');
    await wait(20);
  }
}

const opts = (name: string, o: Partial<JoinOptions> = {}): JoinOptions => ({ zone: ZONE, name, look: '', gen: 1, x: 900, y: 500, ...o });
const join = (o: JoinOptions) => new Client(URL).joinOrCreate<ZoneState>(ZONE_ROOM, o, ZoneState);

describe('Spielserver (Colyseus)', () => {
  const rooms: Room<unknown, ZoneState>[] = [];

  beforeAll(async () => {
    await server.listen(PORT);
  });

  afterAll(async () => {
    // wer schon gegangen ist, antwortet nicht mehr – nicht ewig warten
    for (const r of rooms) await Promise.race([r.leave().catch(() => undefined), wait(500)]);
    await server.gracefullyShutdown(false);
  });

  it('kennt nur Orte, die es gibt', () => {
    expect(parseZone('0/lagune')).toEqual({ epoch: 0, place: 'lagune' });
    expect(parseZone('0/gibtsnicht')).toBeNull();
    expect(parseZone('9/lagune')).toBeNull();
    expect(parseZone('../etc')).toBeNull();
    expect(parseZone(42)).toBeNull();
  });

  it('zwei Spieler am selben Ort sehen einander und ihre Bewegung', async () => {
    const a = await join(opts('Anna'));
    const welcome: WelcomeMsg[] = [];
    a.onMessage('welcome', (m: WelcomeMsg) => welcome.push(m));
    const b = await join(opts('Ben', { x: 1000 }));
    rooms.push(a, b);
    expect(a.roomId).toBe(b.roomId);
    await until(() => a.state.players.size === 2 && b.state.players.size === 2);
    expect(b.state.players.get(a.sessionId)?.name).toBe('Anna');
    // A schwimmt ein Stück nach rechts – B sieht es
    for (let i = 1; i <= 10; i++) {
      a.send('pos', { x: 900 + i * 12, y: 500, facing: 1, anim: 0, size: 0.5 });
      await wait(70);
    }
    await until(() => Math.round(b.state.players.get(a.sessionId)!.x) === 1020);
    expect(b.state.players.get(a.sessionId)!.size).toBeCloseTo(0.5, 3);
    // die Uhr des Servers (für die gemeinsame Weltzeit) kam an
    await until(() => welcome.length > 0);
    expect(Math.abs(welcome[0].now - Date.now())).toBeLessThan(5000);
  });

  it('ein unmöglicher Sprung wird abgefangen', async () => {
    const c = await join(opts('Cleo', { x: 600 }));
    rooms.push(c);
    const snaps: SnapMsg[] = [];
    c.onMessage('snap', (m: SnapMsg) => snaps.push(m));
    await wait(100);
    c.send('pos', { x: 600 + 5000, y: 500, facing: 1, anim: 0, size: 1 });
    await until(() => snaps.length > 0);
    // nur so weit, wie das Streckenkonto reicht – nicht bis ans Ziel
    expect(snaps[0].x).toBeLessThan(600 + 1000);
    await until(() => Math.abs(c.state.players.get(c.sessionId)!.x - snaps[0].x) < 1);
  });

  it('andere Orte sind andere Räume, und wer geht, verschwindet', async () => {
    const d = await join(opts('Dora', { zone: zoneId(0, 'tang') }));
    const e = await join(opts('Emil'));
    rooms.push(d);
    expect(d.roomId).not.toBe(e.roomId);
    expect(d.state.zone).toBe('0/tang');
    const watcher = rooms[0];
    await until(() => watcher.state.players.has(e.sessionId));
    await e.leave();
    await until(() => !watcher.state.players.has(e.sessionId));
  });

  it('der Ortswächter rechnet die Tiere: Gäste sehen sie, Treffer und Fressen gehen an ihn, Schaden an den Getroffenen', async () => {
    const zone = zoneId(0, 'bucht');
    const host = await join(opts('Wächter', { zone }));
    const hits: HitMsg[] = [], eats: EatMsg[] = [];
    host.onMessage('hit', (m: HitMsg) => hits.push(m));
    host.onMessage('eat', (m: EatMsg) => eats.push(m));
    const guest = await join(opts('Gast', { zone }));
    const hurts: HurtMsg[] = [], died: number[][] = [];
    guest.onMessage('hurt', (m: HurtMsg) => hurts.push(m));
    guest.onMessage('died', (ids: number[]) => died.push(ids));
    rooms.push(host, guest);
    await until(() => guest.state.players.size === 2);
    expect(guest.state.host).toBe(host.sessionId);
    host.send('fauna', {
      a: [{ id: 7, sp: 'arandaspis', x: 1200, y: 600, d: -1, an: 5, hp: 4, mh: 6, sz: 1.1, tn: 0, al: 100, at: false }],
      m: [{ id: 3, x: 1300, y: 640, v: 5, s: 1 }],
    });
    await until(() => guest.state.animals.has('7') && guest.state.meats.has('3'));
    // ein volles Paket (so viele Tiere schickt der Ortswächter höchstens auf einmal) passt durch
    host.send('fauna', { a: Array.from({ length: 24 }, (_, i) => ({ id: 100 + i, sp: 'arandaspis', x: 1000 + i * 37.5, y: 600.5, d: -1, an: 12, hp: 5.5, mh: 6.5, sz: 1.123, tn: 0xff9a82, al: 100, at: true })) });
    await until(() => guest.state.animals.has('123'));
    expect(guest.state.animals.get('7')!.hp).toBe(4);
    // nur der Ortswächter darf Tiere melden
    guest.send('fauna', { a: [{ id: 99, sp: 'arandaspis', x: 1, y: 1, d: 1, an: 0, hp: 1, mh: 1, sz: 1, tn: 0, al: 100, at: false }] });
    guest.send('hit', { id: 7, dmg: 2.5, kind: 'bite', stun: 550 });
    guest.send('eat', { id: 3, amount: 1.5 });
    await until(() => hits.length > 0 && eats.length > 0);
    expect(hits[0]).toEqual({ id: 7, dmg: 2.5, kind: 'bite', stun: 550, from: guest.sessionId });
    expect(eats[0]).toEqual({ id: 3, amount: 1.5 });
    expect(guest.state.animals.has('99')).toBe(false);
    host.send('hurt', { to: guest.sessionId, dmg: 3, x: 1200, by: 'Arandaspis' });
    await until(() => hurts.length > 0);
    expect(hurts[0]).toEqual({ dmg: 3, x: 1200, by: 'Arandaspis' });
    host.send('fauna', { gone: [[7, 1]], mgone: [3] });
    await until(() => !guest.state.animals.has('7') && died.length > 0);
    expect(died[0]).toEqual([7]);
    expect(guest.state.meats.has('3')).toBe(false);
    // geht der Ortswächter, übernimmt der Gast – mit den Tieren, wie sie gerade sind
    host.send('fauna', { a: [{ id: 8, sp: 'arandaspis', x: 900, y: 500, d: 1, an: 0, hp: 6, mh: 6, sz: 1, tn: 0, al: 100, at: false }] });
    await until(() => guest.state.animals.has('8'));
    await host.leave();
    await until(() => guest.state.host === guest.sessionId);
    expect(guest.state.animals.has('8')).toBe(true);
  });

  it('ein Ortswächter im Hintergrund gibt ab – an einen anderen Spieler am Ort', async () => {
    const zone = zoneId(0, 'sandfeld');
    const a = await join(opts('Ada', { zone }));
    const b = await join(opts('Bo', { zone }));
    rooms.push(a, b);
    await until(() => b.state.host === a.sessionId);
    b.send('yield', {});
    await wait(150);
    expect(b.state.host).toBe(a.sessionId);
    a.send('yield', {});
    await until(() => a.state.host === b.sessionId);
  });

  it('einen Ort, den es nicht gibt, kann man nicht betreten', async () => {
    await expect(join(opts('Fritz', { zone: '0/nirgendwo' }))).rejects.toThrow();
  });
});
