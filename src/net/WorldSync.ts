import Phaser from 'phaser';
import { SPECIES } from '../data/species';
import { makeSpeciesTextures } from '../art/speciesArt';
import type { Animal, PlayerLike } from '../objects/Animal';
import { Kill, Meat } from '../objects/Food';
import type { Rect } from '../util/math';
import type { LevelScene } from '../scenes/LevelScene';
import { GhostAnimal } from './GhostAnimal';
import { FAUNA_HZ, type AnimalRow, type EatMsg, type FaunaMsg, type HitMsg, type HurtMsg, type MeatRow, type PlantMsg } from './protocol';
import type { RemoteFish } from './RemoteFish';
import type { ZoneState } from './schema';
import type { Zone } from './NetClient';

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

  constructor(readonly id: string, private f: RemoteFish, private send: (m: HurtMsg) => void) {}

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
    this.send({ to: this.id, dmg, x: fromX, by: by ?? '', animal: (source as { netId?: number } | undefined)?.netId });
  }
}

/** Wird dieses Tier mit den anderen Spielern geteilt? (Artgenossen und Tiere eines Auftrags gehören nur dir.) */
const shared = (a: Animal) => !a.dead && !a.kin && !a.personal && !a.scripted && !(a instanceof GhostAnimal);

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
  private sentA = new Map<number, { sig: string; same: number }>();
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

  addTarget(id: string, f: RemoteFish) {
    this.targets.set(id, new RemoteTarget(id, f, (m) => this.z?.hurt(m)));
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
      if (!first) this.takeOver();
      this.sentA.clear();
      this.sentM.clear();
      this.sentP.clear();
      this.sendAt = 0;
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
    this.sendAt = now + 1000 / FAUNA_HZ;
    const msg: FaunaMsg = { t: Math.round(now) };
    const seen = new Map<number, Animal>();
    for (const a of this.h.animals) {
      if (!shared(a)) continue;
      if (!a.netId) a.netId = this.nextId++;
      seen.set(a.netId, a);
      const r = this.rowOf(a);
      const sig = `${r.sp},${r.x | 0},${r.y | 0},${r.d},${r.an},${r.hp},${r.mh},${r.sz},${r.tn},${r.al},${r.at}`;
      const last = this.sentA.get(r.id);
      // unverändert: nur noch ein paar Mal (es ist stehen geblieben), dann nicht mehr
      const same = last?.sig === sig ? last.same + 1 : 0;
      if (same > SETTLE_SENDS) continue;
      this.sentA.set(r.id, { sig, same });
      (msg.a ??= []).push(r);
    }
    for (const [id, a] of this.lastA) {
      if (seen.has(id)) continue;
      (msg.gone ??= []).push([id, a.dead ? 1 : 0]);
      this.sentA.delete(id);
    }
    this.lastA = seen;
    this.byId = seen;
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
    this.send(msg);
  }

  /** In kleinen Paketen senden: Eine Nachricht darf nicht zu groß werden (der Server nimmt nur ein paar KB auf einmal). */
  private send(msg: FaunaMsg) {
    const z = this.z;
    if (!z) return;
    const a = msg.a ?? [], m = msg.m ?? [], t = msg.t;
    for (let i = 0; i < a.length; i += ROWS_PER_MSG) z.fauna({ t, a: a.slice(i, i + ROWS_PER_MSG) });
    for (let i = 0; i < m.length; i += ROWS_PER_MSG) z.fauna({ m: m.slice(i, i + ROWS_PER_MSG) });
    if (msg.gone || msg.mgone || msg.p) z.fauna({ gone: msg.gone?.slice(0, 200), mgone: msg.mgone?.slice(0, 200), p: msg.p?.slice(0, 400) });
  }

  private rowOf(a: Animal): AnimalRow {
    return {
      id: a.netId,
      sp: a.def.id,
      x: r1(a.x),
      y: r1(a.y),
      d: a.flipX ? -1 : 1,
      an: Math.round(a.angle),
      hp: r1(Math.max(0, a.hp)),
      mh: r1(a.maxHp),
      sz: Math.round(a.sz * 1000) / 1000,
      tn: a.isTinted && a.tintMode !== Phaser.TintModes.FILL ? a.tintTopLeft : 0,
      al: Math.round(a.alpha * 100),
      at: a.attacking,
    };
  }

  // ---------------------------------------------------------------- Gast

  /** Der Stand des Ortes ist da (etwa 30 Mal je Sekunde): Stellvertreter, Fleisch und Pflanzen nachführen. */
  patch(s: ZoneState) {
    if (!this.started || this.host) return;
    const now = performance.now();
    for (const [key, n] of s.animals) {
      const id = Number(key);
      const r: AnimalRow = { id, sp: n.sp, x: n.x, y: n.y, d: n.d, an: n.an, hp: n.hp, mh: n.mh, sz: n.sz, tn: n.tn, al: n.al, at: n.at };
      const g = this.ghosts.get(id);
      if (g && !g.dead) g.apply(r, now, n.t || now);
      else if (!g && now > (this.deadUntil.get(id) ?? 0)) this.addGhost(r, now, n.t || now);
    }
    const time = this.h.time.now;
    for (const [key, units] of s.plants) this.h.plants[Number(key)]?.netSet(units, time);
    for (const [id, g] of this.ghosts) {
      if (s.animals.has(String(id))) continue;
      this.ghosts.delete(id);
      if (!g.dead) {
        this.h.dropAnimal(g);
        g.dead = true;
        g.destroy();
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
    if (!p.dead && !this.h.ended) p.hurt(m.dmg, m.x, m.by, m.animal ? this.ghosts.get(m.animal) : undefined);
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
    let max = 0;
    for (const g of this.ghosts.values()) {
      max = Math.max(max, g.netId);
      this.h.dropAnimal(g);
      if (g.dead) continue;
      const a = this.h.spawnAnimal(g.def.id, g.x, g.y);
      a.netId = g.netId;
      a.sz = g.sz;
      a.setScale(g.sz);
      a.maxHp = g.maxHp;
      a.hp = Math.max(0.5, g.hp);
      a.dir = g.dir;
      g.dead = true;
      g.destroy();
    }
    this.ghosts.clear();
    let maxM = 0;
    for (const [id, gm] of this.gmeats) {
      maxM = Math.max(maxM, id);
      if (gm.gone) continue;
      gm.remove();
      const m = new Meat(this.h, this.h, gm.x, gm.y, gm.value, this.h.time.now, gm.kill);
      m.netId = id;
      this.h.meats.push(m);
    }
    this.gmeats.clear();
    this.nextId = Math.max(this.nextId, max + 1);
    this.nextMeat = Math.max(this.nextMeat, maxM + 1);
    // die Pflanzen: wie sie gerade sind – was fehlt, wächst von jetzt an hier nach
    for (const pl of this.h.plants) pl.local(this.h.time.now);
  }

  close() {
    for (const m of this.gmeats.values()) m.remove();
    this.gmeats.clear();
    this.ghosts.clear();
    this.targets.clear();
  }
}
