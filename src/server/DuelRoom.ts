import { Room, type Client } from 'colyseus';
import { DuelEgg, DuelFish, DuelState } from '../net/schema';
import { MAX_SPEED, MOVE_BURST, PATCH_HZ, type DuelHatchMsg, type DuelHurtMsg, type DuelJoin, type DuelPosMsg } from '../net/protocol';
import { afterLay, ARENA, driftEgg, DUEL, duelDamage, duelStart, elemAt, type Elem } from '../sim/duel';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Wer ins Becken darf: Eintrittskarte → Name und Seite (vom Ort vergeben, siehe ZoneRoom). */
export interface DuelSeat {
  ticket: string;
  name: string;
  side: number;
}

/** Was ein Spieler im Becken gerade hat: Streckenkonto (wie im Ort), letzter Biss und Schutz nach einem Treffer. */
interface Seat {
  left: number;
  at: number;
  biteAt: number;
  guardUntil: number;
}

/**
 * Ein Laichduell zu zweit (Regeln: sim/duel.ts). Der Ort legt das Becken an, sobald zwei Spieler in der Höhle eingeloggt
 * sind, und gibt ihnen je eine Eintrittskarte. Die Clients bewegen ihre Fische selbst und melden Lage und Bisse; Lebenskraft,
 * Laich (er treibt mit der Strömung), Schlüpfen und den Sieg rechnet der Server.
 */
export class DuelRoom extends Room<{ state: DuelState }> {
  state = new DuelState();
  maxClients = 2;
  private seats: DuelSeat[] = [];
  private live = new Map<string, Seat>();

  messages = {
    pos: (client: Client, m: DuelPosMsg) => this.onPos(client, m),
    hit: (client: Client) => this.onHit(client),
    lay: (client: Client) => this.onLay(client),
    // aufgeben: Der andere gewinnt
    forfeit: (client: Client) => {
      if (this.state.phase === 'play' || this.state.phase === 'count') this.over(this.foeOf(client.sessionId));
    },
  };

  onCreate(o: { seats?: DuelSeat[] }) {
    const seats = Array.isArray(o?.seats) ? o.seats.filter((s) => typeof s?.ticket === 'string' && s.ticket.length >= 8) : [];
    if (seats.length !== 2) throw new Error('Ein Laichduell braucht zwei Eintrittskarten.');
    this.seats = seats;
    // erst schließen, wenn das Duell vorbei ist und beide gegangen sind (ein abgewiesener Versuch schließt es nicht)
    this.autoDispose = false;
    this.state.phase = 'wait';
    this.state.left = DUEL.joinWait;
    this.setPatchRate(1000 / PATCH_HZ);
    this.setSimulationInterval((ms) => this.tick(ms / 1000), 50);
  }

  onJoin(client: Client, o: DuelJoin) {
    const seat = this.seats.find((s) => s.ticket === o?.ticket);
    if (!seat || [...this.state.fish.values()].some((f) => f.side === seat.side)) throw new Error('Keine gültige Eintrittskarte.');
    const f = new DuelFish();
    const at = duelStart(seat.side);
    f.name = seat.name;
    f.side = seat.side;
    f.x = at.x;
    f.y = at.y;
    f.facing = seat.side ? -1 : 1;
    f.hp = f.maxHp = DUEL.hp;
    f.elem = 'base';
    f.alive = true;
    f.away = false;
    f.gen = 1;
    this.state.fish.set(client.sessionId, f);
    this.live.set(client.sessionId, { left: MOVE_BURST, at: Date.now(), biteAt: 0, guardUntil: 0 });
    if (this.state.fish.size === 2 && this.state.phase === 'wait') {
      this.state.phase = 'count';
      this.state.left = DUEL.count;
    }
  }

  onDrop(client: Client) {
    const f = this.state.fish.get(client.sessionId);
    if (f) f.away = true;
    this.allowReconnection(client, 8);
  }

  onReconnect(client: Client) {
    const f = this.state.fish.get(client.sessionId);
    if (f) f.away = false;
    const s = this.live.get(client.sessionId);
    if (s) Object.assign(s, { left: MOVE_BURST, at: Date.now() });
  }

  onLeave(client: Client) {
    // ein abgewiesener Versuch (ohne gültige Eintrittskarte) zählt nicht
    if (!this.state.fish.has(client.sessionId)) return;
    // wer mitten im Duell geht, hat verloren
    if (this.state.phase === 'play' || this.state.phase === 'count') this.over(this.foeOf(client.sessionId));
    else if (this.state.phase === 'wait') this.over('');
  }

  private foeOf(id: string) {
    for (const k of this.state.fish.keys()) if (k !== id) return k;
    return '';
  }

  private over(winner: string) {
    if (this.state.phase === 'over') return;
    this.state.phase = 'over';
    this.state.winner = winner;
    this.state.left = 0;
    this.state.eggs.clear();
  }

  private tick(dt: number) {
    const s = this.state;
    if (s.phase === 'over') {
      if (!this.clients.length) void this.disconnect();
      return;
    }
    if (s.phase === 'wait' || s.phase === 'count') {
      s.left = Math.max(0, s.left - dt);
      if (s.left > 0) return;
      // der zweite kam nicht: abgebrochen
      if (s.phase === 'wait') return this.over('');
      s.phase = 'play';
      return;
    }
    if (s.phase !== 'play') return;
    for (const [key, e] of s.eggs) {
      e.age += dt;
      driftEgg(e, dt);
      e.elem = elemAt(e.x);
      if (e.age >= DUEL.hatch) {
        s.eggs.delete(key);
        this.hatch(e);
      }
    }
  }

  /** Aus dem Laich schlüpft ein neuer Fisch: Das alte Tier stirbt, der neue hat volle Lebenskraft und das Element des Gebiets. */
  private hatch(e: DuelEgg) {
    const f = this.state.fish.get(e.owner);
    if (!f) return;
    f.x = e.x;
    f.y = e.y;
    f.hp = f.maxHp;
    f.elem = elemAt(e.x) satisfies Elem;
    f.alive = true;
    f.gen = Math.min(250, f.gen + 1);
    const seat = this.live.get(e.owner);
    if (seat) Object.assign(seat, { left: MOVE_BURST, at: Date.now(), guardUntil: Date.now() + DUEL.guard });
    this.broadcast('hatch', { owner: e.owner, x: e.x, y: e.y, elem: f.elem, gen: f.gen } satisfies DuelHatchMsg);
  }

  /** Laichen: nur einmal zugleich (bis der Laich geschlüpft ist) – es kostet die Hälfte der Lebenskraft. */
  private onLay(client: Client) {
    const f = this.state.fish.get(client.sessionId);
    if (this.state.phase !== 'play' || !f?.alive || [...this.state.eggs.values()].some((e) => e.owner === client.sessionId)) return;
    const e = new DuelEgg();
    e.owner = client.sessionId;
    e.x = clamp(f.x, 60, ARENA.w - 60);
    e.y = clamp(f.y + 18, ARENA.surface + 30, ARENA.floor - 14);
    e.age = 0;
    e.elem = elemAt(e.x);
    this.state.eggs.set(client.sessionId, e);
    f.hp = afterLay(f.hp);
  }

  /** Ein Biss: Der Server prüft, ob der Gegner nah genug ist, und rechnet den Schaden nach den Elementen. */
  private onHit(client: Client) {
    const now = Date.now();
    const a = this.state.fish.get(client.sessionId), sa = this.live.get(client.sessionId);
    const foe = this.foeOf(client.sessionId);
    const d = this.state.fish.get(foe), sd = this.live.get(foe);
    if (this.state.phase !== 'play' || !a?.alive || !d?.alive || !sa || !sd) return;
    if (now - sa.biteAt < DUEL.biteEvery || now < sd.guardUntil) return;
    if (Math.hypot(a.x - d.x, a.y - d.y) > DUEL.reach) return;
    sa.biteAt = now;
    sd.guardUntil = now + DUEL.guard;
    const dmg = duelDamage(a.elem as Elem, d.elem as Elem);
    d.hp = Math.max(0, d.hp - dmg);
    this.broadcast('hurt', { to: foe, from: client.sessionId, dmg, hp: d.hp, x: a.x, y: a.y } satisfies DuelHurtMsg);
    if (d.hp > 0) return;
    d.alive = false;
    // liegt noch Laich von ihm, geht es mit dem neuen Fisch weiter – sonst ist die Runde vorbei
    if (!this.state.eggs.has(foe)) this.over(client.sessionId);
  }

  /** Die gemeldete Lage annehmen – nur im Becken und nicht schneller, als ein Fisch kann (wie im Ort). */
  private onPos(client: Client, m: DuelPosMsg) {
    const f = this.state.fish.get(client.sessionId), acc = this.live.get(client.sessionId);
    if (!f || !acc || !m || !f.alive || num(m.gen, 0) !== f.gen) return;
    const x = clamp(num(m.x, f.x), 0, ARENA.w), y = clamp(num(m.y, f.y), ARENA.surface, ARENA.floor);
    const now = Date.now();
    acc.left = Math.min(MOVE_BURST, acc.left + ((now - acc.at) / 1000) * MAX_SPEED);
    acc.at = now;
    const dist = Math.hypot(x - f.x, y - f.y);
    if (dist <= acc.left) {
      f.x = x;
      f.y = y;
      acc.left -= dist;
    } else {
      const k = acc.left / dist;
      f.x += (x - f.x) * k;
      f.y += (y - f.y) * k;
      acc.left = 0;
      client.send('snap', { x: f.x, y: f.y });
    }
    f.t = num(m.t, 0);
    f.facing = num(m.facing, 1) < 0 ? -1 : 1;
    f.anim = clamp(Math.round(num(m.anim, 0)), 0, 7);
  }
}
