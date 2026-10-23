import { Room, type Client } from 'colyseus';
import { EPOCHS } from '../data/epochs';
import { WORLD } from '../data/life';
import { SPECIES } from '../data/species';
import { placesOf } from '../data/world';
import { generateLevel } from '../level/LevelGen';
import { NetAnimal, NetFish, NetMeat, ZoneState } from '../net/schema';
import {
  cleanName, MAX_SPEED, MOVE_BURST, PATCH_HZ, RECONNECT_S,
  type EatMsg, type FaunaMsg, type HitMsg, type HurtMsg, type JoinOptions, type LookMsg, type PingMsg, type PlantMsg, type PosMsg,
  type SnapMsg, type WelcomeMsg,
} from '../net/protocol';

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1e9 ? v : 0);
/** so viele Tiere bzw. Fleischstücke (und Pflanzen) hält ein Ort höchstens */
const MAX_ANIMALS = 600, MAX_MEATS = 200, MAX_PLANTS = 1000;

/** Ein Ort aus "zeitalter/ort" – oder null, wenn es ihn nicht gibt. */
export function parseZone(zone: unknown): { epoch: number; place: string } | null {
  if (typeof zone !== 'string') return null;
  const m = /^(\d{1,2})\/([a-z0-9_-]{1,40})$/.exec(zone);
  if (!m) return null;
  const epoch = Number(m[1]);
  const ep = EPOCHS[epoch];
  // nur in Zeitaltern, in denen man leben kann (die anderen ruhen noch)
  if (!ep?.playable || !placesOf(ep).some((p) => p.id === m[2])) return null;
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
    fauna: (client: Client, m: FaunaMsg) => this.onFauna(client, m),
    // der Ortswächter gibt ab (sein Fenster ist im Hintergrund – dort rechnet der Browser kaum noch): ein anderer übernimmt
    yield: (client: Client) => {
      if (client.sessionId !== this.state.host) return;
      const next = [...this.state.players.entries()].find(([id, f]) => id !== client.sessionId && !f.away);
      if (next) this.state.host = next[0];
    },
    // ein Spieler trifft ein Tier bzw. frisst vom Fleisch: Das rechnet der Ortswächter
    hit: (client: Client, m: HitMsg) => {
      const id = int(m?.id);
      if (!id || client.sessionId === this.state.host) return;
      const kind = m.kind === 'ram' || m.kind === 'other' ? m.kind : 'bite';
      this.toHost({ type: 'hit', msg: { id, dmg: clamp(num(m.dmg, 0), 0, 200), kind, stun: clamp(num(m.stun, 0), 0, 3000), from: client.sessionId } satisfies HitMsg });
    },
    eat: (client: Client, m: EatMsg) => {
      const id = int(m?.id);
      if (!id || client.sessionId === this.state.host) return;
      this.toHost({ type: 'eat', msg: { id, amount: clamp(num(m.amount, 0), 0, 60) } satisfies EatMsg });
    },
    // ein Spieler beißt in eine Pflanze: Das rechnet der Ortswächter
    plant: (client: Client, m: PlantMsg) => {
      const i = m?.i;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= MAX_PLANTS || client.sessionId === this.state.host) return;
      this.toHost({ type: 'plant', msg: { i } satisfies PlantMsg });
    },
    // hin und zurück: So misst ein Client, wie schnell seine Verbindung ist
    ping: (client: Client, m: PingMsg) => client.send('pong', { t: num(m?.t, 0) } satisfies PingMsg),
    // ein Tier des Ortswächters trifft einen anderen Spieler
    hurt: (client: Client, m: HurtMsg) => {
      if (client.sessionId !== this.state.host || typeof m?.to !== 'string') return;
      const to = this.clients.getById(m.to);
      to?.send('hurt', { animal: Math.max(0, Math.floor(num(m.animal, 0))), dmg: clamp(num(m.dmg, 0), 0, 200), x: num(m.x, 0), by: String(m.by ?? '').slice(0, 40) } satisfies HurtMsg);
    },
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
    // PATCH_HZ-mal je Sekunde gehen die Änderungen hinaus
    this.setPatchRate(1000 / PATCH_HZ);
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
    // der Erste am Ort (oder wenn keiner mehr da ist) wird Ortswächter
    if (!this.state.players.has(this.state.host)) this.state.host = client.sessionId;
    client.send('welcome', { now: Date.now(), you: client.sessionId } satisfies WelcomeMsg);
  }

  /** Die Verbindung riss ab: Der Platz bleibt eine Weile frei, der Fisch wartet. */
  onDrop(client: Client) {
    const f = this.state.players.get(client.sessionId);
    if (f) f.away = true;
    // ein Ortswächter ohne Verbindung rechnet nichts mehr: ein anderer übernimmt
    if (this.state.host === client.sessionId) this.newHost(client.sessionId);
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
    if (this.state.host === client.sessionId) this.newHost(client.sessionId);
  }

  /** Ein anderer Spieler wird Ortswächter (wer verbunden ist). Ist keiner da, rechnet der Nächste, der kommt, neu. */
  private newHost(old: string) {
    let next = '';
    for (const [id, f] of this.state.players) if (id !== old && !f.away) next = next || id;
    this.state.host = next;
    if (!next && !this.state.players.size) {
      this.state.animals.clear();
      this.state.meats.clear();
      this.state.plants.clear();
    }
  }

  private toHost(m: { type: string; msg: unknown }) {
    this.clients.getById(this.state.host)?.send(m.type, m.msg);
  }

  /** Der Ortswächter meldet seine Tiere und das Fleisch: Sie gehen an alle (nur geänderte Werte). */
  private onFauna(client: Client, m: FaunaMsg) {
    if (client.sessionId !== this.state.host || !m) return;
    const b = this.bounds;
    const A = this.state.animals, M = this.state.meats;
    const sent = num(m.t, 0);
    for (const r of Array.isArray(m.a) ? m.a.slice(0, MAX_ANIMALS) : []) {
      const id = int(r?.id);
      if (!id || typeof r.sp !== 'string' || r.sp.length > 40) continue;
      const key = String(id);
      let a = A.get(key);
      if (!a) {
        if (A.size >= MAX_ANIMALS) continue;
        a = new NetAnimal();
        a.sp = r.sp;
        A.set(key, a);
      }
      a.x = clamp(num(r.x, a.x), b.x0 - 600, b.x1 + 600);
      a.y = clamp(num(r.y, a.y), b.y0, b.y1 + 200);
      a.d = num(r.d, 1) < 0 ? -1 : 1;
      a.an = clamp(Math.round(num(r.an, 0)), -360, 360);
      a.mh = clamp(num(r.mh, 1), 0.1, 1e5);
      a.hp = clamp(num(r.hp, a.mh), 0, a.mh);
      a.sz = clamp(num(r.sz, 1), 0.1, 5);
      a.tn = clamp(Math.round(num(r.tn, 0)), 0, 0xffffff);
      a.al = clamp(Math.round(num(r.al, 100)), 0, 100);
      a.at = r.at === true;
      a.t = sent;
    }
    const died: number[] = [];
    for (const g of Array.isArray(m.gone) ? m.gone : []) {
      const id = int(Array.isArray(g) ? g[0] : 0);
      if (!id || !A.delete(String(id))) continue;
      if (g[1]) died.push(id);
    }
    // gestorben (nicht nur fort): Die anderen sehen es vergehen
    if (died.length) this.broadcast('died', died, { except: client });
    for (const r of Array.isArray(m.m) ? m.m.slice(0, MAX_MEATS) : []) {
      const id = int(r?.id);
      if (!id) continue;
      const key = String(id);
      let f = M.get(key);
      if (!f) {
        if (M.size >= MAX_MEATS) continue;
        f = new NetMeat();
        M.set(key, f);
      }
      f.x = clamp(num(r.x, f.x), b.x0 - 200, b.x1 + 200);
      f.y = clamp(num(r.y, f.y), b.y0, b.y1 + 200);
      f.v = clamp(num(r.v, 0), 0, 1000);
      f.s = clamp(Math.round(num(r.s, 0)), 0, 2);
      f.sp = typeof r.sp === 'string' && Object.hasOwn(SPECIES, r.sp) ? r.sp : '';
      f.kill = typeof r.kill === 'string' ? r.kill.slice(0, 64) : '';
    }
    for (const id of Array.isArray(m.mgone) ? m.mgone : []) if (int(id)) M.delete(String(id));
    // die Pflanzen: übrige Bissen je Pflanze
    const P = this.state.plants;
    for (const r of Array.isArray(m.p) ? m.p.slice(0, MAX_PLANTS) : []) {
      const i = Array.isArray(r) ? r[0] : -1;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= MAX_PLANTS) continue;
      P.set(String(i), clamp(Math.round(num(r[1], 0)), 0, 20));
    }
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
    f.t = num(m.t, 0);
    f.facing = num(m.facing, 1) < 0 ? -1 : 1;
    f.anim = clamp(Math.round(num(m.anim, 0)), 0, 7);
    f.size = clamp(num(m.size, 1), 0.1, 3);
  }
}
