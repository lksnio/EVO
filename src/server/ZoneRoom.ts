import { Room, type Client } from 'colyseus';
import { EPOCHS } from '../data/epochs';
import { WORLD } from '../data/life';
import { placesOf } from '../data/world';
import { generateLevel } from '../level/LevelGen';
import { NetFish, ZoneState } from '../net/schema';
import { cleanName, MAX_SPEED, MOVE_BURST, RECONNECT_S, type JoinOptions, type LookMsg, type PosMsg, type SnapMsg, type WelcomeMsg } from '../net/protocol';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Ein Ort aus "zeitalter/ort" – oder null, wenn es ihn nicht gibt. */
export function parseZone(zone: unknown): { epoch: number; place: string } | null {
  if (typeof zone !== 'string') return null;
  const m = /^(\d{1,2})\/([a-z0-9_-]{1,40})$/.exec(zone);
  if (!m) return null;
  const epoch = Number(m[1]);
  const ep = EPOCHS[epoch];
  if (!ep || !placesOf(ep).some((p) => p.id === m[2])) return null;
  return { epoch, place: m[2] };
}

/** Wie viel Strecke ein Spieler gerade noch zurücklegen darf (wächst mit der Zeit nach, bis MOVE_BURST). */
interface Budget {
  left: number;
  at: number;
}

/**
 * Ein Ort der Welt, in dem sich Spieler begegnen (ein Raum je Zeitalter und Ort). Meilenstein 1: Die Clients bewegen
 * ihre Fische selbst und melden die Lage; der Raum prüft sie – nicht schneller als MAX_SPEED, nicht außerhalb des Ortes –
 * und verteilt sie an alle. Die Grenzen kennt der Server aus demselben Weltgenerator wie die Clients (feste Weltsaat).
 */
export class ZoneRoom extends Room<{ state: ZoneState }> {
  state = new ZoneState();
  maxClients = 24;
  private bounds = { x0: 0, x1: 4000, y0: -600, y1: 2000, sx: 200, sy: 300 };
  private budget = new Map<string, Budget>();

  messages = {
    pos: (client: Client, m: PosMsg) => this.onPos(client, m),
    look: (client: Client, m: LookMsg) => {
      const f = this.state.players.get(client.sessionId);
      if (!f || !m || typeof m.look !== 'string' || m.look.length > 4000) return;
      f.look = m.look;
      f.gen = clamp(Math.round(num(m.gen, f.gen)), 1, 60000);
    },
  };

  onCreate(o: JoinOptions) {
    const z = parseZone(o?.zone);
    if (!z) throw new Error('Diesen Ort gibt es nicht.');
    this.state.zone = `${z.epoch}/${z.place}`;
    const ep = EPOCHS[z.epoch];
    const L = generateLevel(ep, WORLD.seed, placesOf(ep).find((p) => p.id === z.place)!);
    this.bounds = { x0: 0, x1: L.width, y0: Math.min(0, L.surfaceY) - 600, y1: L.height + 60, sx: L.start.x, sy: L.start.y };
    // 20 Mal je Sekunde gehen die Änderungen hinaus
    this.setPatchRate(50);
  }

  onJoin(client: Client, o: JoinOptions) {
    const b = this.bounds;
    const f = new NetFish();
    f.name = cleanName(o?.name) || 'Fisch';
    f.x = clamp(num(o?.x, b.sx), b.x0, b.x1);
    f.y = clamp(num(o?.y, b.sy), b.y0, b.y1);
    f.facing = 1;
    f.size = 1;
    f.look = typeof o?.look === 'string' && o.look.length <= 4000 ? o.look : '';
    f.gen = clamp(Math.round(num(o?.gen, 1)), 1, 60000);
    this.state.players.set(client.sessionId, f);
    this.budget.set(client.sessionId, { left: MOVE_BURST, at: Date.now() });
    client.send('welcome', { now: Date.now(), you: client.sessionId } satisfies WelcomeMsg);
  }

  /** Die Verbindung riss ab: Der Platz bleibt eine Weile frei, der Fisch wartet. */
  onDrop(client: Client) {
    const f = this.state.players.get(client.sessionId);
    if (f) f.away = true;
    this.allowReconnection(client, RECONNECT_S);
  }

  onReconnect(client: Client) {
    const f = this.state.players.get(client.sessionId);
    if (f) f.away = false;
    this.budget.set(client.sessionId, { left: MOVE_BURST, at: Date.now() });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.budget.delete(client.sessionId);
  }

  /**
   * Die gemeldete Lage annehmen – soweit sie möglich ist: Jeder Spieler hat ein Streckenkonto, das mit MAX_SPEED
   * nachwächst. Wer weiter springt, kommt nur so weit, wie das Konto reicht, und wird zurückgesetzt (snap).
   */
  private onPos(client: Client, m: PosMsg) {
    const f = this.state.players.get(client.sessionId);
    const acc = this.budget.get(client.sessionId);
    if (!f || !acc || !m) return;
    const b = this.bounds;
    const x = clamp(num(m.x, f.x), b.x0, b.x1);
    const y = clamp(num(m.y, f.y), b.y0, b.y1);
    const now = Date.now();
    acc.left = Math.min(MOVE_BURST, acc.left + ((now - acc.at) / 1000) * MAX_SPEED);
    acc.at = now;
    const d = Math.hypot(x - f.x, y - f.y);
    if (d <= acc.left) {
      f.x = x;
      f.y = y;
      acc.left -= d;
    } else {
      const k = acc.left / d;
      f.x += (x - f.x) * k;
      f.y += (y - f.y) * k;
      acc.left = 0;
      client.send('snap', { x: f.x, y: f.y } satisfies SnapMsg);
    }
    f.facing = num(m.facing, 1) < 0 ? -1 : 1;
    f.anim = clamp(Math.round(num(m.anim, 0)), 0, 7);
    f.size = clamp(num(m.size, 1), 0.1, 3);
  }
}
