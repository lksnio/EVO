import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { SpeciesState, ZoneState, type NetFish } from './schema';
import {
  SPECIES_ROOM, ZONE_ROOM,
  type SpeciesAdvanced, type SpeciesJoin, type SpeciesOver, type SpeciesPicked,
  type EatMsg, type FaunaMsg, type HitMsg, type HurtMsg, type JoinOptions, type LookMsg, type PingMsg, type PlantMsg, type PosMsg,
  type SnapMsg, type WelcomeMsg,
} from './protocol';

// Die Verbindung zum Spielserver (Colyseus). Dieses Modul wird erst geladen, wenn gespielt wird – wer offline spielt,
// lädt es nie (siehe net/NetSync.ts).

export type NetStatus = 'verbunden' | 'unterbrochen' | 'getrennt';

export interface ZoneHandlers {
  add(id: string, f: NetFish): void;
  remove(id: string): void;
  /** nach jeder Änderung vom Server (etwa 20 Mal je Sekunde) – mit dem ganzen Zustand des Ortes */
  patch(state: ZoneState): void;
  /** ein anderer (oder man selbst) ist jetzt Ortswächter */
  host(id: string): void;
  welcome(m: WelcomeMsg): void;
  snap(m: SnapMsg): void;
  status(s: NetStatus): void;
  /** als Ortswächter: ein Spieler hat ein Tier getroffen bzw. vom Fleisch gefressen */
  hit(m: HitMsg): void;
  eat(m: EatMsg): void;
  /** ein Tier des Ortswächters hat dich getroffen */
  hurt(m: HurtMsg): void;
  /** diese Tiere sind gestorben */
  died(ids: number[]): void;
  /** als Ortswächter: ein Spieler hat in eine Pflanze gebissen */
  plant(m: PlantMsg): void;
  /** die Antwort auf ping() – mit der eigenen Uhrzeit von damals */
  pong(m: PingMsg): void;
}

/** Ein betretener Ort: senden, verlassen – und wer man selbst ist. */
export interface Zone {
  readonly me: string;
  readonly state: ZoneState;
  pos(m: PosMsg): void;
  look(m: LookMsg): void;
  fauna(m: FaunaMsg): void;
  hit(m: HitMsg): void;
  hurt(m: HurtMsg): void;
  eat(m: EatMsg): void;
  plant(m: PlantMsg): void;
  /** Wie lange braucht eine Nachricht hin und zurück? (Antwort: pong) */
  ping(m: PingMsg): void;
  /** als Ortswächter abgeben (ein anderer Spieler rechnet weiter) */
  yieldHost(): void;
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
  // Erst nach dem vollständigen Patch wechseln: Map-Einträge können nach dem Feld „host“ eintreffen.
  room.onStateChange((s) => { h.host(s.host); h.patch(s); });
  room.onMessage('welcome', (m: WelcomeMsg) => h.welcome(m));
  room.onMessage('snap', (m: SnapMsg) => h.snap(m));
  room.onMessage('hit', (m: HitMsg) => h.hit(m));
  room.onMessage('eat', (m: EatMsg) => h.eat(m));
  room.onMessage('hurt', (m: HurtMsg) => h.hurt(m));
  room.onMessage('died', (ids: number[]) => h.died(ids));
  room.onMessage('plant', (m: PlantMsg) => h.plant(m));
  room.onMessage('pong', (m: PingMsg) => h.pong(m));
  room.onDrop(() => h.status('unterbrochen'));
  room.onReconnect(() => h.status('verbunden'));
  room.onLeave(() => {
    if (!left) h.status('getrennt');
  });
  h.status('verbunden');
  const send = (type: string, m: unknown) => room.connection.isOpen && room.send(type, m);
  return {
    me: room.sessionId,
    get state() {
      return room.state;
    },
    pos: (m) => send('pos', m),
    look: (m) => send('look', m),
    fauna: (m) => send('fauna', m),
    hit: (m) => send('hit', m),
    hurt: (m) => send('hurt', m),
    eat: (m) => send('eat', m),
    plant: (m) => send('plant', m),
    ping: (m) => send('ping', m),
    yieldHost: () => send('yield', {}),
    leave: () => {
      if (left) return;
      left = true;
      room.leave().catch(() => undefined);
    },
  };
}

/** Die gemeinsame Art (Koop): was ihr Raum meldet. */
export interface SpeciesHandlers {
  /** der gemeinsame Laich hat sich geändert */
  change(): void;
  picked(m: SpeciesPicked): void;
  advanced(m: SpeciesAdvanced): void;
  over(m: SpeciesOver): void;
  closed(): void;
}

/** Den Raum der gemeinsamen Art eines Zeitalters betreten (siehe net/Species.ts). */
export async function joinSpecies(url: string, opts: SpeciesJoin, h: SpeciesHandlers) {
  const room: Room<unknown, SpeciesState> = await clientFor(url).joinOrCreate<SpeciesState>(SPECIES_ROOM, opts, SpeciesState);
  room.onStateChange(() => h.change());
  room.onMessage('picked', (m: SpeciesPicked) => h.picked(m));
  room.onMessage('advanced', (m: SpeciesAdvanced) => h.advanced(m));
  room.onMessage('extinct', (m: SpeciesOver) => h.over(m));
  room.onLeave(() => h.closed());
  return room;
}
