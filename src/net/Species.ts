import { bus, game, type RoeEgg } from '../state/GameState';
import { EPOCHS } from '../data/epochs';
import type { SpeciesAdvanced, SpeciesOver, SpeciesPicked } from './protocol';
import { netWanted, playerName, serverUrl } from './NetSync';

// Die gemeinsame Art im Koop: Alle Spieler eines Zeitalters teilen ihren Laich (server/SpeciesRoom.ts). Die Verbindung
// bleibt über alle Szenen hinweg bestehen (Level, Laich-Wahl, Karte) – sie spiegelt den gemeinsamen Laich in den Spielstand
// (GameState.syncShared) und meldet, was man laicht. Ohne Server (offline) bleibt alles beim eigenen Laich.
//
// Ereignisse (bus): 'species' – der gemeinsame Laich hat sich geändert; 'speciesAdvanced' (name, gen) – ein Artgenosse hat
// die nächste Generation begonnen; 'speciesOver' (name, cause, gen) – die Art ist ausgestorben.

interface RoomLike {
  sessionId: string;
  state: { gen: number; pool: Map<string, string>; next: Map<string, string>; members: Map<string, string>; selections: Map<string, string>; over: string };
  send(type: string, m: unknown): void;
  leave(): Promise<unknown>;
  connection: { isOpen: boolean };
}

const parse = (json: string): RoeEgg | null => {
  try {
    return JSON.parse(json) as RoeEgg;
  } catch {
    return null;
  }
};
const list = (m: Map<string, string> | undefined) => [...(m?.values() ?? [])].map(parse).filter((e): e is RoeEgg => !!e);

class SpeciesLink {
  private room?: RoomLike;
  private epoch = -1;
  private joining?: Promise<void>;
  private req = 1;
  private waits = new Map<number, (r: SpeciesPicked) => void>();
  private lastLaich = '';
  private lastMarks = '';
  private marked = '';

  constructor() {
    bus.on('roeLaid', (gen: unknown, eggs: unknown) => this.lay(gen as number, eggs as RoeEgg[]));
  }

  /** Verbunden – der Laich, den man sieht, ist der gemeinsame. */
  get active() {
    const r = this.room;
    return !!r && r.connection.isOpen && r.state.gen > 0 && !r.state.over;
  }

  /** Die anderen Spieler der Art (ihre Namen). */
  get others(): string[] {
    const r = this.room;
    if (!r) return [];
    return [...r.state.members.entries()].filter(([id]) => id !== r.sessionId).map(([, n]) => n);
  }

  /** Was andere Spieler gerade ansehen, mit ihrer Kennung statt einer Platznummer. */
  get selections(): { player: string; name: string; egg: string }[] {
    const r = this.room;
    if (!r || !this.active) return [];
    return [...r.state.selections.entries()].filter(([id]) => id !== r.sessionId)
      .map(([player, egg]) => ({ player, name: r.state.members.get(player) ?? 'Artgenosse', egg }));
  }

  mark(id: string | null) {
    const next = id ?? '';
    if (!this.active || (next !== '' && this.marked === next)) return;
    this.marked = next;
    this.room!.send('select', { id: next });
  }

  /** In diesem Zeitalter mit der gemeinsamen Art verbinden (einmal; ein anderes Zeitalter: neu). */
  connect(epoch: number) {
    if (!netWanted() || EPOCHS[epoch]?.brood) return;
    if (this.epoch === epoch && (this.room || this.joining)) return;
    this.leave();
    this.epoch = epoch;
    this.joining = this.join(epoch).finally(() => (this.joining = undefined));
  }

  private async join(epoch: number) {
    try {
      const { joinSpecies } = await import('./NetClient');
      const room = (await joinSpecies(serverUrl(), { epoch, name: playerName() }, {
        change: () => this.mirror(),
        picked: (m) => {
          this.waits.get(m.req)?.(m);
          this.waits.delete(m.req);
        },
        advanced: (m: SpeciesAdvanced) => bus.emit('speciesAdvanced', m.name, m.gen),
        over: (m: SpeciesOver) => bus.emit('speciesOver', m.name, m.cause, m.gen),
        closed: () => {
          if (this.room === room) {
            this.room = undefined;
            this.marked = '';
            bus.emit('speciesSelection');
          }
        },
      })) as unknown as RoomLike;
      if (this.epoch !== epoch) {
        void room.leave();
        return;
      }
      this.room = room;
      // der eigene Laich: Gibt es die Art noch nicht, beginnt sie damit – sonst kommt er dazu
      const run = game.run;
      if (run && run.epoch === epoch && !run.brood) {
        room.send('hello', { gen: game.poolGen, pool: game.pool.map((e) => JSON.stringify(e)), next: game.roe.map((e) => JSON.stringify(e)) });
      }
    } catch (e) {
      console.warn('[EVO] Gemeinsame Art nicht erreichbar – es bleibt beim eigenen Laich.', e);
    }
  }

  /** Der gemeinsame Laich hat sich geändert: in den Spielstand. */
  private mirror() {
    const r = this.room;
    const run = game.run;
    if (!r || !r.state.gen || r.state.over || !run || run.epoch !== this.epoch || run.brood) return;
    const laich = JSON.stringify([r.state.gen, [...r.state.pool], [...r.state.next]]);
    const marks = JSON.stringify([[...r.state.selections], [...r.state.members]]);
    if (laich !== this.lastLaich) {
      this.lastLaich = laich;
      game.syncShared(r.state.gen, list(r.state.pool), list(r.state.next));
      bus.emit('species');
    }
    if (marks !== this.lastMarks) {
      this.lastMarks = marks;
      bus.emit('speciesSelection');
    }
  }

  /** Gelaicht: an die Art (Eier der Generation gen). */
  private lay(gen: number, eggs: RoeEgg[]) {
    const r = this.room;
    if (!r || !this.active || game.run?.epoch !== this.epoch || !eggs.length) return;
    r.send('lay', { gen, eggs: eggs.map((e) => JSON.stringify(e)) });
  }

  /**
   * Dieses Ei soll schlüpfen: Der Server teilt es zu (wer zuerst kommt). Antwort: das Ei und als welche Generation es
   * schlüpft – oder null, wenn es schon fort ist (oder keine Antwort kam).
   */
  pick(id: string): Promise<{ egg: RoeEgg; gen: number; group: 'pool' | 'next' } | null> {
    const r = this.room;
    if (!r || !this.active) return Promise.resolve(null);
    const req = this.req++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waits.delete(req);
        resolve(null);
      }, 6000);
      this.waits.set(req, (m) => {
        clearTimeout(timer);
        const egg = m.egg ? parse(m.egg) : null;
        resolve(egg ? { egg, gen: m.gen, group: m.group } : null);
      });
      r.send('pick', { id, req });
    });
  }

  /** Gestorben, und es lag kein Laich mehr da: Die Art ist ausgestorben – das erfahren alle. */
  extinct(cause: string) {
    this.room?.send('extinct', { cause });
  }

  leave() {
    const r = this.room;
    this.room = undefined;
    this.epoch = -1;
    this.lastLaich = '';
    this.lastMarks = '';
    this.marked = '';
    if (r) void r.leave().catch(() => undefined);
  }
}

/** Die gemeinsame Art (eine Verbindung für das ganze Spiel). */
export const species = new SpeciesLink();
