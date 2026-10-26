import { bus, game } from '../state/GameState';
import { setServerClock } from '../sim/life';
import { ANIM, SEND_HZ, cleanName, zoneId, type DuelStartMsg, type PosMsg } from './protocol';
import { RemoteFish } from './RemoteFish';
import type { NetFish, ZoneState } from './schema';
import { WorldSync } from './WorldSync';
import type { NetStatus, Zone, ZoneHandlers } from './NetClient';
import type { LevelScene } from '../scenes/LevelScene';

// Mehrspieler im Level: den eigenen Fisch melden, die anderen am selben Ort zeigen. Tiere, Fleisch und Pflanzen rechnet der
// Ortswächter für alle (net/WorldSync.ts); die Orte sehen für alle gleich aus (feste Weltsaat).

const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

/**
 * Der letzte Stand der Verbindung (für das HUD, auch wenn es erst danach startet): offline, online, unterbrochen, getrennt –
 * und wie lange eine Nachricht zum Server und zurück braucht (ms, 0 = noch nicht gemessen).
 */
export const netInfo = { state: 'offline', others: 0, ping: 0 };

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
  /** zuletzt bewegt: danach noch kurz weiter melden – so wissen die anderen, dass der Fisch steht */
  private movedAt = 0;
  private pingAt = 0;
  private lookKey = '';
  private closed = false;
  private others = -1;
  /** der Ortswächter, wie zuletzt gemeldet (auch schon, bevor das Betreten ganz fertig ist) */
  private hostId = '';
  /** die Tiere und das Fleisch des Ortes – für alle Spieler gleich */
  readonly world: WorldSync;

  constructor(private host: LevelScene) {
    this.world = new WorldSync(host, () => this.zone);
    // Im Hintergrund rechnet der Browser kaum noch, und in der Rast steht das Level: Ein Ortswächter gibt dann ab, sonst
    // stünden die Tiere für alle still
    const onHide = () => {
      if (document.hidden && this.world.host) this.zone?.yieldHost();
    };
    const onPause = () => {
      if (this.world.host) this.zone?.yieldHost();
    };
    document.addEventListener('visibilitychange', onHide);
    host.events.on('pause', onPause);
    host.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onHide);
      host.events.off('pause', onPause);
    });
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
      // steht schon fest, wer die Tiere des Ortes rechnet? (sonst gleich, mit dem ersten Stand des Ortes)
      this.decideRole();
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
        const r = new RemoteFish(h, f, performance.now());
        this.fish.set(id, r);
        this.world.addTarget(id, r);
      },
      remove: (id: string) => {
        this.fish.get(id)?.destroy();
        this.fish.delete(id);
        this.world.removeTarget(id);
      },
      patch: (state: ZoneState) => {
        if (this.closed) return;
        const now = performance.now();
        const players = state.players;
        for (const [id, f] of players) this.fish.get(id)?.push(f, now);
        if (!this.world.started) {
          this.hostId = state.host;
          this.decideRole();
        }
        this.world.patch(state);
        const n = Math.max(0, players.size - 1);
        if (n !== this.others) {
          this.others = n;
          tell('online', n);
        }
      },
      host: (id: string) => {
        this.hostId = id;
        this.decideRole();
      },
      hit: (m) => !this.closed && this.world.hit(m),
      eat: (m) => !this.closed && this.world.eat(m),
      hurt: (m) => !this.closed && this.world.hurt(m),
      died: (ids) => !this.closed && this.world.died(ids),
      plant: (m) => !this.closed && this.world.plant(m),
      pong: (m) => {
        const rtt = performance.now() - m.t;
        if (this.closed || !(rtt >= 0 && rtt < 10000)) return;
        // geglättet, damit die Anzeige nicht springt
        netInfo.ping = netInfo.ping ? netInfo.ping + (rtt - netInfo.ping) * 0.3 : rtt;
        bus.emit('ping', Math.round(netInfo.ping));
      },
      welcome: (m) => setServerClock(m.now),
      duel: (m: DuelStartMsg) => !this.closed && this.host.startDuel(m),
      // Der Server kennt die Lage besser (der Fisch war zu schnell): zurück dorthin
      snap: (m) => !this.closed && !h.player.dead && h.player.body.reset(m.x, m.y),
      status: (s: NetStatus) => {
        if (this.closed) return;
        if (s !== 'verbunden') tell(s, 0);
        else this.others = -1;
      },
    };
  }

  /** Die anderen Spieler an diesem Ort (so, wie sie gerade gezeigt werden). */
  players(): RemoteFish[] {
    return [...this.fish.values()].filter((f) => !f.gone);
  }

  /** Ist man selbst in der Höhle zum Laichduell eingeloggt (so, wie es der Server sieht)? */
  get inCave() {
    const z = this.zone;
    return !!z && !!z.state.players.get(z.me)?.cave;
  }

  /** In der Höhle einloggen bzw. ausloggen. */
  caveLogin(on: boolean) {
    this.zone?.cave({ on });
  }

  /** Wer rechnet die Tiere? Erst entscheiden, wenn der Ortswächter bekannt ist (beim Betreten kommt der Stand etwas später). */
  private decideRole() {
    if (!this.zone || this.closed || !this.hostId) return;
    this.world.setHost(this.hostId === this.zone.me);
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastAt) / 1000));
    this.lastAt = now;
    for (const f of this.fish.values()) f.update(now, dt);
    if (!this.closed) this.world.update();
    const z = this.zone, p = this.host.player;
    if (!z || this.closed || now < this.sendAt) return;
    this.sendAt = now + 1000 / SEND_HZ;
    if (now > this.pingAt) {
      this.pingAt = now + 2000;
      z.ping({ t: now });
    }
    const m: PosMsg = {
      t: Math.round(now), x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, facing: p.facing, anim: animOf(this.host, this.host.time.now), size: p.stats.size,
    };
    const l = this.last;
    // still: nur ab und zu melden, dass man noch da ist (gleich nach dem Anhalten aber noch ein paar Mal)
    const same = l && l.x === m.x && l.y === m.y && l.anim === m.anim && l.facing === m.facing;
    if (!same) this.movedAt = now;
    if (!same || now - this.movedAt < 300 || now - this.lastSent > 1000) {
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
    this.world.close();
    for (const f of this.fish.values()) f.destroy();
    this.fish.clear();
  }
}
