import { SPECIES } from '../data/species';
import { makeSpeciesTextures } from '../art/speciesArt';
import type { Animal, PlayerLike } from '../objects/Animal';
import { Kill, Meat } from '../objects/Food';
import type { Rect } from '../util/math';
import type { LevelScene } from '../scenes/LevelScene';
import { GhostAnimal } from './GhostAnimal';
import { FAUNA_HZ, FAUNA_NEAR_HZ, FAUNA_NEAR_PX, type AnimalRow, type EatMsg, type FaunaMsg, type HitMsg, type HurtMsg, type MeatRow, type PlantMsg } from './protocol';
import type { RemoteFish } from './RemoteFish';
import type { ZoneState } from './schema';
import type { Zone } from './NetClient';
import { animalRow } from './animalRow';

const r1 = (v: number) => Math.round(v * 10) / 10;
/** so viele Tiere bzw. Fleischstücke je Nachricht (eine Nachricht bleibt so unter 3 KB) */
const ROWS_PER_MSG = 24;
/** Ein Tier, das stehen bleibt, wird noch so oft gemeldet – damit es bei den anderen nicht über das Ziel hinausschwimmt */
const SETTLE_SENDS = 2;

/**
 * Ein anderer Spieler – so, wie ihn die Tiere des Ortswächters sehen: Sie jagen ihn, weichen ihm aus und beißen ihn wie
 * dich. Trifft ihn ein Tier, geht der Schaden über den Server an ihn.
 */
export class RemoteTarget implements PlayerLike {
  readonly human = true;
  hidden = false;
  private hurtAt = 0;

  constructor(readonly id: string, private f: RemoteFish, private send: (m: HurtMsg, source?: object) => void) {}

  get x() {
    return this.f.view.x;
  }

  get y() {
    return this.f.view.y;
  }

  get dead() {
    return this.f.dead || this.f.gone || !this.f.view.active;
  }

  get fast() {
    return this.f.fast;
  }

  get loud() {
    return this.f.fast;
  }

  get facing() {
    return this.f.facingDir;
  }

  get bodyLen() {
    const L = this.f.view.L;
    return L ? L.halfW * 2 : 50;
  }

  hitRect(): Rect {
    const L = this.f.view.L;
    const w = L ? L.halfW * 2 : 40, top = L ? L.topY : -15, h = L ? L.footY - L.topY : 30;
    return { x: this.x - w / 2, y: this.y + top, w, h };
  }

  hurt(dmg: number, fromX: number, by?: string, source?: object) {
    const now = performance.now();
    if (now - this.hurtAt < 150 || this.dead) return;
    this.hurtAt = now;
    this.send({ to: this.id, dmg, x: fromX, by: by ?? '' }, source);
  }
}

/** Wird dieses Tier mit den anderen Spielern geteilt? (Artgenossen gehören nur dir.) */
const shared = (a: Animal) => !a.dead && !a.kin && !(a instanceof GhostAnimal);

/**
 * Die Tiere, das Fleisch und die Pflanzen eines Ortes für alle Spieler gleich (siehe net/protocol.ts):
 *   – Ortswächter: Sein Spiel rechnet wie immer; FAUNA_HZ-mal je Sekunde meldet es, was sich geändert hat.
 *   – Gast: Die eigenen Tiere des Ortes verschwinden, dafür kommen Stellvertreter (GhostAnimal) und Fleisch des
 *     Ortswächters; seine Pflanzen wachsen nicht mehr selbst nach, sondern zeigen den Stand des Ortswächters. Treffer,
 *     Fressen (auch Bissen in Pflanzen) und Schaden gehen über den Server.
 *   – Wechsel: Wer Ortswächter wird, übernimmt Tiere und Pflanzen so, wie sie gerade sind.
 */
export class WorldSync {
  /** Rolle schon bekannt? Bis dahin rechnet das eigene Spiel (wie allein). */
  started = false;
  host = false;
  /** die anderen Spieler als Ziele für die Tiere (nur beim Ortswächter von Bedeutung) */
  readonly targets = new Map<string, RemoteTarget>();
  private ghosts = new Map<number, GhostAnimal>();
  private gmeats = new Map<number, Meat>();
  private gkills = new Map<string, Kill>();
  private eatenKills = new Set<string>();
  /** Ortswächter: zuletzt gemeldet (Kurzform) und die Tiere/Stücke dazu */
  private sentA = new Map<number, { sig: string; same: number; at: number }>();
  private sentM = new Map<number, string>();
  /** Ortswächter: zuletzt gemeldete Bissen je Pflanze */
  private sentP = new Map<number, number>();
  private lastA = new Map<number, Animal>();
  private lastM = new Set<number>();
  private byId = new Map<number, Animal>();
  private meatById = new Map<number, Meat>();
  private nextId = 1;
  private nextMeat = 1;
  private sendAt = 0;
  /** Ortswächter: wann wieder alles gemeldet wird (dazwischen nur die Tiere in der Nähe eines anderen Spielers) */
  private fullAt = 0;
  /** Gast: vorhergesagt gestorben – bis dahin nicht wieder hervorholen */
  private deadUntil = new Map<number, number>();

  constructor(private h: LevelScene, private zone: () => Zone | undefined) {}

  /** die Verbindung zum Ort (erst, wenn das Betreten fertig ist) */
  private get z() {
    return this.zone();
  }

  get authority() {
    return !this.started || this.host;
  }

  /** die eigene Sitzungskennung im Ort (leer, solange noch nicht verbunden) */
  get me() {
    return this.z?.me ?? '';
  }

  addTarget(id: string, f: RemoteFish) {
    this.targets.set(id, new RemoteTarget(id, f, (m, source) => {
      const a = source as Animal | undefined;
      if (a?.def && shared(a)) {
        if (!a.netId) a.netId = this.nextId++;
        m.animal = a.netId;
        m.attacker = { ...animalRow(a), hu: this.hunted(a) };
      }
      this.z?.hurt(m);
    }));
  }

  removeTarget(id: string) {
    this.targets.delete(id);
  }

  /** Die Rolle steht fest (beim Betreten) oder wechselt (der Ortswächter ging). */
  setHost(host: boolean) {
    if (this.started && host === this.host) return;
    const first = !this.started;
    this.started = true;
    this.host = host;
    if (host) {
      if (!first || this.z?.state.animals.size) this.takeOver();
      this.sentA.clear();
      this.sentM.clear();
      this.sentP.clear();
      this.lastA.clear();
      this.lastM.clear();
      this.byId.clear();
      this.sendAt = 0;
      this.fullAt = 0;
    } else {
      this.h.dropShared();
      // die Pflanzen rechnet der Ortswächter: Bissen gehen an ihn
      this.h.plants.forEach((pl, i) => {
        pl.net = true;
        pl.onTake = () => this.z?.plant({ i });
      });
      if (this.z) this.patch(this.z.state);
    }
  }

  update() {
    if (!this.started || !this.host) return;
    const now = performance.now();
    if (now < this.sendAt) return;
    this.sendAt = now + 1000 / FAUNA_NEAR_HZ;
    // FAUNA_HZ-mal je Sekunde alles; dazwischen nur die Tiere in der Nähe eines anderen Spielers (dort zählt jede Zehntelsekunde)
    const full = now >= this.fullAt;
    if (full) this.fullAt = now + 1000 / FAUNA_HZ - 500 / FAUNA_NEAR_HZ;
    const others = [...this.targets.values()].filter((t) => !t.dead);
    const near = (a: Animal) => others.some((t) => Math.abs(t.x - a.x) < FAUNA_NEAR_PX && Math.abs(t.y - a.y) < FAUNA_NEAR_PX);
    const msg: FaunaMsg = { t: Math.round(now) };
    const seen = new Map<number, Animal>();
    for (const a of this.h.animals) {
      if (!shared(a)) continue;
      if (!a.netId) a.netId = this.nextId++;
      seen.set(a.netId, a);
      if (!full && !near(a)) continue;
      const r = animalRow(a);
      r.hu = this.hunted(a);
      const sig = `${r.sp},${r.x | 0},${r.y | 0},${r.d},${r.an},${r.hp},${r.mh},${r.sz},${r.tn},${r.al},${r.at},${r.hu}`;
      const last = this.sentA.get(r.id);
      // unverändert: nur noch ein paar Mal (es ist stehen geblieben), dann nicht mehr
      const same = last?.sig === sig ? last.same + 1 : 0;
      if (same > SETTLE_SENDS && now - (last?.at ?? 0) < 1000) continue;
      this.sentA.set(r.id, { sig, same, at: now });
      (msg.a ??= []).push(r);
    }
    for (const [id, a] of this.lastA) {
      if (seen.has(id)) continue;
      (msg.gone ??= []).push([id, a.dead ? 1 : 0]);
      this.sentA.delete(id);
    }
    this.lastA = seen;
    this.byId = seen;
    if (full) this.sendRest(msg);
    this.send(msg);
  }

  /** Wen jagt dieses Tier gerade (Sitzungskennung)? Die anderen hören dann ihr Herz klopfen und spüren es kommen. */
  private hunted(a: Animal): string {
    const t = a.target;
    if (!t || a.kin || a.ally || !(a.st === 'hunt' || a.attacking || a.aggroUntil > this.h.time.now)) return '';
    if (t === this.h.player) return this.me;
    return t instanceof RemoteTarget ? t.id : '';
  }

  /** Fleisch und Pflanzen: nur bei der vollen Meldung. */
  private sendRest(msg: FaunaMsg) {
    const mseen = new Set<number>();
    this.meatById.clear();
    for (const m of this.h.meats) {
      if (m.gone || m.net) continue;
      if (!m.netId) m.netId = this.nextMeat++;
      mseen.add(m.netId);
      this.meatById.set(m.netId, m);
      const r: MeatRow = { id: m.netId, x: r1(m.x), y: r1(m.y), v: r1(m.value), s: m.size, sp: m.kill.species, kill: m.kill.id };
      const sig = `${r.x | 0},${r.y | 0},${r.v}`;
      if (this.sentM.get(r.id) === sig) continue;
      this.sentM.set(r.id, sig);
      (msg.m ??= []).push(r);
    }
    for (const id of this.lastM) {
      if (mseen.has(id)) continue;
      (msg.mgone ??= []).push(id);
      this.sentM.delete(id);
    }
    this.lastM = mseen;
    this.h.plants.forEach((pl, i) => {
      if (this.sentP.get(i) === pl.units) return;
      this.sentP.set(i, pl.units);
      (msg.p ??= []).push([i, pl.units]);
    });
  }

  /** In kleinen Paketen senden: Eine Nachricht darf nicht zu groß werden (der Server nimmt nur ein paar KB auf einmal). */
  private send(msg: FaunaMsg) {
    const z = this.z;
    if (!z) return;
    const a = msg.a ?? [], m = msg.m ?? [], t = msg.t;
    for (let i = 0; i < a.length; i += ROWS_PER_MSG) z.fauna({ t, a: a.slice(i, i + ROWS_PER_MSG) });
    for (let i = 0; i < m.length; i += ROWS_PER_MSG) z.fauna({ m: m.slice(i, i + ROWS_PER_MSG) });
    for (let i = 0; i < (msg.gone?.length ?? 0); i += 200) z.fauna({ gone: msg.gone!.slice(i, i + 200) });
    for (let i = 0; i < (msg.mgone?.length ?? 0); i += 200) z.fauna({ mgone: msg.mgone!.slice(i, i + 200) });
    for (let i = 0; i < (msg.p?.length ?? 0); i += 400) z.fauna({ p: msg.p!.slice(i, i + 400) });
  }

  // ---------------------------------------------------------------- Gast

  /** Der Stand des Ortes ist da (etwa 30 Mal je Sekunde): Stellvertreter, Fleisch und Pflanzen nachführen. */
  patch(s: ZoneState) {
    if (!this.started || this.host) return;
    const now = performance.now();
    for (const [key, n] of s.animals) {
      const id = Number(key);
      const r: AnimalRow = { id, sp: n.sp, x: n.x, y: n.y, d: n.d, an: n.an, hp: n.hp, mh: n.mh, sz: n.sz, tn: n.tn, al: n.al, at: n.at, hu: n.hu };
      const g = this.ghosts.get(id);
      if (g && g.active && !g.dead) g.apply(r, now, n.t || now);
      else if (r.hp > 0 && now > (this.deadUntil.get(id) ?? 0)) {
        if (g) { this.h.dropAnimal(g); g.destroy(); this.ghosts.delete(id); }
        this.deadUntil.delete(id);
        this.addGhost(r, now, n.t || now);
      }
    }
    const time = this.h.time.now;
    for (const [key, units] of s.plants) this.h.plants[Number(key)]?.netSet(units, time);
    for (const [id, g] of this.ghosts) {
      if (s.animals.has(String(id))) continue;
      this.ghosts.delete(id);
      // fort (nicht gestorben): ausblenden – nie schlagartig vor den Augen verschwinden
      if (!g.dead) {
        this.h.dropAnimal(g);
        g.fadeOut();
      }
    }
    for (const [key, n] of s.meats) {
      const id = Number(key);
      const m = this.gmeats.get(id);
      if (m) m.netUpdate(n.x, n.y, n.v);
      else this.addMeat(id, n.x, n.y, n.v, n.sp, n.kill);
    }
    for (const [id, m] of this.gmeats) {
      if (s.meats.has(String(id)) && !m.gone) continue;
      m.remove(true);
      this.gmeats.delete(id);
    }
    // Vergangene Beute hält keine zerstörten Bilder fest; ihre Kennung verhindert doppeltes Zählen verspäteter Brocken.
    for (const [id, kill] of this.gkills) {
      if (kill.left) continue;
      if (kill.playerAte) this.eatenKills.add(id);
      this.gkills.delete(id);
    }
  }

  private addGhost(r: AnimalRow, now: number, sent: number) {
    const def = SPECIES[r.sp];
    if (!def) return;
    makeSpeciesTextures(this.h, def);
    const g = new GhostAnimal(this.h, def, r, now, sent);
    g.onHit = (_g, dmg, kind, stun) => this.z?.hit({ id: r.id, dmg, kind, stun });
    g.onDie = () => {
      this.deadUntil.set(r.id, performance.now() + 1500);
      this.h.dropAnimal(g);
    };
    this.ghosts.set(r.id, g);
    this.h.animals.push(g);
  }

  private addMeat(id: number, x: number, y: number, v: number, species = '', killId = '') {
    if (v <= 0.5) return;
    const kill = (killId && this.gkills.get(killId)) || new Kill(false, species || undefined, killId || undefined);
    if (killId) {
      kill.playerAte ||= this.eatenKills.has(killId);
      this.gkills.set(killId, kill);
    }
    const m = new Meat(this.h, this.h, x, y, v, this.h.time.now, kill);
    m.netId = id;
    m.net = { x, y };
    m.onBite = (got) => this.z?.eat({ id, amount: got });
    this.gmeats.set(id, m);
    this.h.meats.push(m);
  }

  /** Diese Tiere sind beim Ortswächter gestorben. */
  died(ids: number[]) {
    for (const id of ids) {
      const g = this.ghosts.get(id);
      this.h.confirmNetDefeat(id, g);
      if (g && !g.dead) g.vanishDead();
    }
  }

  /** Ein Tier des Ortswächters hat dich getroffen. */
  hurt(m: HurtMsg) {
    const p = this.h.player;
    if (p.dead || this.h.ended) return;
    const r = m.attacker;
    if (r && r.id === m.animal && r.hp > 0 && !this.host) {
      let g = this.ghosts.get(r.id);
      if (g && (g.dead || !g.active)) {
        this.h.dropAnimal(g); g.destroy(); this.ghosts.delete(r.id); g = undefined;
      }
      if (!g) { this.addGhost(r, performance.now(), performance.now()); g = this.ghosts.get(r.id); }
      g?.reveal(r, performance.now());
      this.deadUntil.delete(r.id);
    }
    p.hurt(m.dmg, m.x, m.by, m.animal ? this.ghosts.get(m.animal) : undefined);
  }

  // ---------------------------------------------------------------- Ortswächter

  /** Ein anderer Spieler hat ein Tier getroffen. */
  hit(m: HitMsg) {
    if (!this.host) return;
    const a = this.byId.get(m.id) ?? this.h.animals.find((x) => x.netId === m.id);
    if (!a || a.dead) return;
    const from: PlayerLike = (m.from && this.targets.get(m.from)) || {
      x: a.x - a.dir * 30, y: a.y, dead: false, fast: false, loud: false, bodyLen: 40, hidden: false, human: true,
      hitRect: () => ({ x: a.x - a.dir * 50, y: a.y - 15, w: 40, h: 30 }),
      hurt: () => undefined,
    };
    if (m.dmg > 0) a.hurt(m.dmg, from, m.kind);
    if (m.stun > 0 && !a.dead) a.stun(m.stun);
  }

  /** Ein anderer Spieler hat vom Fleisch gefressen. */
  eat(m: EatMsg) {
    if (!this.host) return;
    const f = this.meatById.get(m.id) ?? this.h.meats.find((x) => x.netId === m.id);
    f?.bite(m.amount);
  }

  /** Ein anderer Spieler hat in eine Pflanze gebissen. */
  plant(m: PlantMsg) {
    if (!this.host) return;
    this.h.plants[m.i]?.take(this.h.time.now);
  }

  /** Der Ortswächter ging: Ab jetzt rechnet dieses Spiel die Tiere – so, wie sie gerade sind. */
  private takeOver() {
    const state = this.z?.state;
    // Maßgeblich ist der vollständige Serverstand, nicht eine unvollständige oder lokal als tot vorhergesagte Ansicht.
    const animals: AnimalRow[] = state ? [...state.animals].map(([key, n]) => ({
      id: Number(key), sp: n.sp, x: n.x, y: n.y, d: n.d, an: n.an,
      hp: n.hp, mh: n.mh, sz: n.sz, tn: n.tn, al: n.al, at: n.at,
    })) : [...this.ghosts.values()].filter((g) => !g.dead).map(animalRow);
    const meats = state ? [...state.meats].map(([key, n]) => ({
      id: Number(key), x: n.x, y: n.y, v: n.v, sp: n.sp, kill: n.kill,
    })) : [...this.gmeats].map(([id, m]) => ({ id, x: m.x, y: m.y, v: m.value, sp: m.kill.species, kill: m.kill.id }));
    this.h.dropShared();
    for (const g of this.ghosts.values()) {
      this.h.dropAnimal(g);
      g.destroy();
    }
    this.ghosts.clear();
    this.deadUntil.clear();
    let max = 0;
    for (const r of animals) {
      max = Math.max(max, r.id);
      if (r.hp <= 0 || !SPECIES[r.sp]) continue;
      const a = this.h.spawnAnimal(r.sp, r.x, r.y);
      a.netId = r.id;
      a.sz = r.sz;
      a.setScale(r.sz);
      a.b.reset(r.x, r.y);
      a.maxHp = r.mh;
      a.hp = r.hp;
      a.dir = r.d;
      a.setFlipX(r.d < 0);
    }
    for (const gm of this.gmeats.values()) gm.remove();
    this.gmeats.clear();
    let maxM = 0;
    for (const r of meats) {
      maxM = Math.max(maxM, r.id);
      if (r.v <= 0) continue;
      const kill = (r.kill && this.gkills.get(r.kill)) || new Kill(false, r.sp || undefined, r.kill || undefined);
      const m = new Meat(this.h, this.h, r.x, r.y, r.v, this.h.time.now, kill);
      m.netId = r.id;
      this.h.meats.push(m);
    }
    this.nextId = Math.max(this.nextId, max + 1);
    this.nextMeat = Math.max(this.nextMeat, maxM + 1);
    // Die Pflanzen: derselbe Stand; was fehlt, wächst von jetzt an hier nach.
    if (state) for (const [key, units] of state.plants) this.h.plants[Number(key)]?.netSet(units, this.h.time.now);
    for (const pl of this.h.plants) pl.local(this.h.time.now);
  }

  close() {
    for (const m of this.gmeats.values()) m.remove();
    this.gmeats.clear();
    this.ghosts.clear();
    this.targets.clear();
  }
}
