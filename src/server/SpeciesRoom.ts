import { Room, type Client } from 'colyseus';
import { EPOCHS } from '../data/epochs';
import { SpeciesState } from '../net/schema';
import {
  cleanName, SPECIES_MAX_EGGS,
  type SpeciesAdvanced, type SpeciesHello, type SpeciesJoin, type SpeciesLay, type SpeciesOver, type SpeciesPick, type SpeciesPicked,
} from '../net/protocol';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
/** ein Ei, wie es ein Client schickt: JSON mit Kennung – nicht zu groß */
function eggOf(v: unknown): { id: string; json: string } | null {
  if (typeof v !== 'string' || v.length > 4000) return null;
  try {
    const e = JSON.parse(v) as { id?: unknown; traits?: unknown };
    if (typeof e?.id !== 'string' || !/^[a-z0-9]{4,40}$/.test(e.id) || typeof e.traits !== 'object') return null;
    return { id: e.id, json: v };
  } catch {
    return null;
  }
}

/**
 * Die gemeinsame Art eines Zeitalters (Koop): der Laich aller Spieler, die dort leben. Ein Raum je Zeitalter; er bleibt
 * bestehen, wenn alle gegangen sind (der Laich wartet), bis der Server endet.
 *   – Gelaicht (lay): Eier der Generation gen kommen dazu – zur Generation der Geschwister in den pool, zur nächsten in next,
 *     aus einer vergangenen Generation gar nicht (dorthin führt kein Weg mehr zurück).
 *   – Ein Ei schlüpft (pick): Wer zuerst kommt, bekommt es. Aus next: Die nächste Generation beginnt für alle – die übrigen
 *     Geschwister sind fort, der übrige Laich sind die neuen Geschwister.
 *   – Ausgestorben (extinct): Stirbt jemand und es liegt kein Laich mehr da, ist die Art ausgestorben – das erfahren alle.
 *     Die nächste Linie, die sich meldet (hello), beginnt eine neue Art.
 */
export class SpeciesRoom extends Room<{ state: SpeciesState }> {
  state = new SpeciesState();
  maxClients = 24;
  autoDispose = false;
  /** jede Kennung, die die Art je gesehen hat – was schon geschlüpft ist, kommt nicht wieder */
  private known = new Set<string>();

  messages = {
    hello: (client: Client, m: SpeciesHello) => this.onHello(client, m),
    lay: (_client: Client, m: SpeciesLay) => {
      if (this.state.over || !this.state.gen || !Array.isArray(m?.eggs)) return;
      const gen = Math.round(num(m.gen, 0));
      for (const raw of m.eggs.slice(0, 100)) this.place(gen, raw);
    },
    pick: (client: Client, m: SpeciesPick) => this.onPick(client, m),
    select: (client: Client, m: { id?: unknown }) => {
      const id = typeof m?.id === 'string' ? m.id : '';
      if (!id) this.state.selections.delete(client.sessionId);
      else if (!this.state.over && (this.state.pool.has(id) || this.state.next.has(id))) this.state.selections.set(client.sessionId, id);
    },
    extinct: (client: Client, m: { cause?: unknown }) => {
      const s = this.state;
      // nur wenn wirklich nichts mehr da ist (ein anderer könnte gerade gelaicht haben)
      if (s.over || s.pool.size || s.next.size || !s.gen) return;
      s.selections.clear();
      s.over = String(m?.cause ?? 'Zu wenige Artgenossen').slice(0, 80) || 'Zu wenige Artgenossen';
      this.broadcast('extinct', { name: s.members.get(client.sessionId) ?? '', cause: s.over, gen: s.gen } satisfies SpeciesOver);
    },
  };

  onCreate(o: SpeciesJoin) {
    const epoch = Math.round(num(o?.epoch, -1));
    if (!EPOCHS[epoch]?.playable) throw new Error('Dieses Zeitalter gibt es nicht.');
    this.state.epoch = epoch;
  }

  onJoin(client: Client, o: SpeciesJoin) {
    this.state.members.set(client.sessionId, cleanName(o?.name) || 'Fisch');
  }

  onLeave(client: Client) {
    this.state.members.delete(client.sessionId);
    this.state.selections.delete(client.sessionId);
  }

  /**
   * Ein Spieler meldet sich mit seinem Laich: Gibt es noch keine Art (ist sie ausgestorben, oder ist er allein da), beginnt
   * sie mit seinem Laich und seiner Generation. Sonst kommen seine Eier dazu – nur die, die die Art noch nicht kennt.
   */
  private onHello(_client: Client, m: SpeciesHello) {
    const s = this.state;
    const gen = Math.max(1, Math.round(num(m?.gen, 1)));
    const pool = Array.isArray(m?.pool) ? m.pool : [];
    const next = Array.isArray(m?.next) ? m.next : [];
    // keine Art (oder eine ausgestorbene) – oder niemand sonst ist da: Dann gilt der Laich dessen, der sich meldet (ein
    // verlassener Raum von früher verschluckt keine neue Linie)
    if (!s.gen || s.over || s.members.size <= 1) {
      s.over = '';
      s.gen = gen;
      s.pool.clear();
      s.next.clear();
      s.selections.clear();
      this.known.clear();
    }
    for (const raw of pool.slice(0, SPECIES_MAX_EGGS)) this.place(gen, raw);
    for (const raw of next.slice(0, SPECIES_MAX_EGGS)) this.place(gen + 1, raw);
  }

  /** Ein Ei der Generation gen in den Laich: zu den Geschwistern, zur nächsten Generation – oder nirgends. */
  private place(gen: number, raw: unknown) {
    const s = this.state;
    const e = eggOf(raw);
    if (!e || this.known.has(e.id) || s.pool.size + s.next.size >= SPECIES_MAX_EGGS) return;
    this.known.add(e.id);
    if (gen < s.gen) return;
    if (gen === s.gen) s.pool.set(e.id, e.json);
    else s.next.set(e.id, e.json);
  }

  private pruneSelections() {
    const s = this.state;
    for (const [player, egg] of s.selections) if (!s.pool.has(egg) && !s.next.has(egg)) s.selections.delete(player);
  }

  private onPick(client: Client, m: SpeciesPick) {
    const s = this.state;
    const req = num(m?.req, 0);
    const id = typeof m?.id === 'string' ? m.id : '';
    const reply = (r: SpeciesPicked) => client.send('picked', r);
    if (s.over) return reply({ req, egg: '', gen: s.gen, group: 'pool' });
    const fromPool = s.pool.get(id);
    if (fromPool) {
      s.pool.delete(id);
      this.pruneSelections();
      s.selections.delete(client.sessionId);
      return reply({ req, egg: fromPool, gen: s.gen, group: 'pool' });
    }
    const fromNext = s.next.get(id);
    if (!fromNext) return reply({ req, egg: '', gen: s.gen, group: 'pool' });
    // die nächste Generation beginnt – für alle
    s.next.delete(id);
    s.gen += 1;
    s.pool.clear();
    for (const [k, v] of s.next) s.pool.set(k, v);
    s.next.clear();
    this.pruneSelections();
    s.selections.delete(client.sessionId);
    reply({ req, egg: fromNext, gen: s.gen, group: 'next' });
    this.broadcast('advanced', { name: s.members.get(client.sessionId) ?? '', gen: s.gen } satisfies SpeciesAdvanced, { except: client });
  }
}
