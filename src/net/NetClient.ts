import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { ZoneState, type NetFish } from './schema';
import { ZONE_ROOM, type JoinOptions, type LookMsg, type PosMsg, type SnapMsg, type WelcomeMsg } from './protocol';

// Die Verbindung zum Spielserver (Colyseus). Dieses Modul wird erst geladen, wenn gespielt wird – wer offline spielt,
// lädt es nie (siehe net/NetSync.ts).

export type NetStatus = 'verbunden' | 'unterbrochen' | 'getrennt';

export interface ZoneHandlers {
  add(id: string, f: NetFish): void;
  remove(id: string): void;
  /** nach jeder Änderung vom Server (etwa 20 Mal je Sekunde) */
  patch(players: Map<string, NetFish>): void;
  welcome(m: WelcomeMsg): void;
  snap(m: SnapMsg): void;
  status(s: NetStatus): void;
}

/** Ein betretener Ort: senden, verlassen – und wer man selbst ist. */
export interface Zone {
  readonly me: string;
  pos(m: PosMsg): void;
  look(m: LookMsg): void;
  leave(): void;
}

let client: Client | undefined;
let clientUrl = '';

/** Der Client zum Server (einer für das ganze Spiel). */
function clientFor(url: string) {
  if (!client || clientUrl !== url) {
    client = new Client(url);
    clientUrl = url;
  }
  return client;
}

/** Einen Ort betreten: Man ist mit allen im Raum dieses Ortes verbunden, bis leave() aufgerufen wird. */
export async function joinZone(url: string, opts: JoinOptions, h: ZoneHandlers): Promise<Zone> {
  const room: Room<unknown, ZoneState> = await clientFor(url).joinOrCreate<ZoneState>(ZONE_ROOM, opts, ZoneState);
  let left = false;
  const cb = Callbacks.get(room);
  cb.onAdd('players', (f, id) => {
    if (id !== room.sessionId) h.add(id, f);
  });
  cb.onRemove('players', (_f, id) => h.remove(id));
  room.onStateChange((s) => h.patch(s.players as unknown as Map<string, NetFish>));
  room.onMessage('welcome', (m: WelcomeMsg) => h.welcome(m));
  room.onMessage('snap', (m: SnapMsg) => h.snap(m));
  room.onDrop(() => h.status('unterbrochen'));
  room.onReconnect(() => h.status('verbunden'));
  room.onLeave(() => {
    if (!left) h.status('getrennt');
  });
  h.status('verbunden');
  return {
    me: room.sessionId,
    pos: (m) => room.connection.isOpen && room.send('pos', m),
    look: (m) => room.connection.isOpen && room.send('look', m),
    leave: () => {
      if (left) return;
      left = true;
      room.leave().catch(() => undefined);
    },
  };
}
