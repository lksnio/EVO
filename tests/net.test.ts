import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { server } from '../src/server/index';
import { parseZone } from '../src/server/ZoneRoom';
import { ZONE_ROOM, zoneId, type JoinOptions, type SnapMsg, type WelcomeMsg } from '../src/net/protocol';
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
    for (const r of rooms) await r.leave().catch(() => undefined);
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

  it('einen Ort, den es nicht gibt, kann man nicht betreten', async () => {
    await expect(join(opts('Fritz', { zone: '0/nirgendwo' }))).rejects.toThrow();
  });
});
