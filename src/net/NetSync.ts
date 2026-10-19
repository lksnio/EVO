import { bus, game } from '../state/GameState';
import { setServerClock } from '../sim/life';
import { ANIM, SEND_HZ, cleanName, zoneId, type PosMsg } from './protocol';
import { RemoteFish } from './RemoteFish';
import type { NetFish } from './schema';
import type { NetStatus, Zone, ZoneHandlers } from './NetClient';
import type { LevelScene } from '../scenes/LevelScene';

// Mehrspieler im Level (Meilenstein 1): den eigenen Fisch melden, die anderen am selben Ort zeigen. Die Tiere, Pflanzen
// und alles andere rechnet vorerst jeder Client für sich; die Orte sehen für alle gleich aus (feste Weltsaat).

const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

/** Der letzte Stand der Verbindung (für das HUD, auch wenn es erst danach startet): offline, online, unterbrochen, getrennt. */
export const netInfo = { state: 'offline', others: 0 };

function tell(state: string, others: number) {
  netInfo.state = state;
  netInfo.others = others;
  bus.emit('net', state, others);
}

/**
 * Mit dem Server spielen? Ja, wenn das Spiel von unserem Server kommt (npm run dev, npm start). Nein mit ?offline und
 * auf GitHub Pages (dort gibt es keinen Server). Ist keiner erreichbar, geht es still allein weiter.
 */
export function netWanted() {
  const q = params();
  if (q.has('offline')) return false;
  if (q.has('server')) return true;
  return typeof location !== 'undefined' && !location.hostname.endsWith('github.io') && location.protocol !== 'file:';
}

/** Wo der Server läuft: ?server=http://… oder dort, woher das Spiel kommt. */
export function serverUrl() {
  return params().get('server') || location.origin;
}

/** Der Name über dem eigenen Fisch: ?name=… (wird gemerkt), sonst ein zufälliger. */
export function playerName() {
  const q = cleanName(params().get('name'));
  try {
    if (q) localStorage.setItem('evo-name', q);
    const s = cleanName(localStorage.getItem('evo-name'));
    if (s) return s;
    const n = `Fisch ${100 + Math.floor(Math.random() * 900)}`;
    localStorage.setItem('evo-name', n);
    return n;
  } catch {
    return q || 'Fisch';
  }
}

/** Was der eigene Fisch gerade tut – so sehen ihn die anderen. */
function animOf(h: LevelScene, now: number) {
  const p = h.player;
  if (p.dead) return ANIM.dead;
  if (p.isRamming) return ANIM.ram;
  if (now - p.bitAt < 260) return ANIM.bite;
  if (p.speed01 > 1.2) return ANIM.dash;
  return p.speed01 > 0.08 ? ANIM.swim : ANIM.idle;
}

/** Die Verbindung eines Levels zum Server: betreten beim Start, verlassen beim Ende des Levels. */
export class NetSync {
  private zone?: Zone;
  private fish = new Map<string, RemoteFish>();
  private sendAt = 0;
  private last?: PosMsg;
  private lastAt = 0;
  private lastSent = 0;
  private lookKey = '';
  private closed = false;
  private others = -1;

  constructor(private host: LevelScene) {
    // bis dieser Ort betreten ist, zeigt das HUD nichts
    netInfo.state = 'offline';
    void this.connect();
    host.events.once('shutdown', () => this.close());
  }

  private async connect() {
    const h = this.host, p = h.player;
    try {
      const { joinZone } = await import('./NetClient');
      if (this.closed) return;
      const zone = await joinZone(
        serverUrl(),
        { zone: zoneId(h.epochIdx, h.place.id), name: playerName(), look: JSON.stringify(p.morph()), gen: game.life.gen, x: p.x, y: p.y },
        this.handlers(),
      );
      if (this.closed) return zone.leave();
      this.zone = zone;
      this.lookKey = p.view.key;
    } catch (e) {
      console.warn('[EVO] Kein Spielserver erreichbar – es geht allein weiter.', e);
      tell('offline', 0);
    }
  }

  private handlers(): ZoneHandlers {
    const h = this.host;
    return {
      add: (id: string, f: NetFish) => {
        if (this.closed || this.fish.has(id)) return;
        this.fish.set(id, new RemoteFish(h, f, performance.now()));
      },
      remove: (id: string) => {
        this.fish.get(id)?.destroy();
        this.fish.delete(id);
      },
      patch: (players: Map<string, NetFish>) => {
        if (this.closed) return;
        const now = performance.now();
        for (const [id, f] of players) this.fish.get(id)?.push(f, now);
        const n = Math.max(0, players.size - 1);
        if (n !== this.others) {
          this.others = n;
          tell('online', n);
        }
      },
      welcome: (m) => setServerClock(m.now),
      // Der Server kennt die Lage besser (der Fisch war zu schnell): zurück dorthin
      snap: (m) => !this.closed && !h.player.dead && h.player.body.reset(m.x, m.y),
      status: (s: NetStatus) => {
        if (this.closed) return;
        if (s !== 'verbunden') tell(s, 0);
        else this.others = -1;
      },
    };
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastAt) / 1000));
    this.lastAt = now;
    for (const f of this.fish.values()) f.update(now, dt);
    const z = this.zone, p = this.host.player;
    if (!z || this.closed || now < this.sendAt) return;
    this.sendAt = now + 1000 / SEND_HZ;
    const m: PosMsg = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, facing: p.facing, anim: animOf(this.host, this.host.time.now), size: p.stats.size };
    const l = this.last;
    // still: nur ab und zu melden, dass man noch da ist
    const same = l && l.x === m.x && l.y === m.y && l.anim === m.anim && l.facing === m.facing;
    if (!same || now - this.lastSent > 1000) {
      z.pos(m);
      this.last = m;
      this.lastSent = now;
    }
    // sichtbar verändert (gewachsen, neue Gestalt): das neue Aussehen melden
    if (p.view.key !== this.lookKey) {
      this.lookKey = p.view.key;
      z.look({ look: JSON.stringify(p.morph()), gen: game.life.gen });
    }
  }

  private close() {
    if (this.closed) return;
    this.closed = true;
    this.zone?.leave();
    this.zone = undefined;
    for (const f of this.fish.values()) f.destroy();
    this.fish.clear();
  }
}
