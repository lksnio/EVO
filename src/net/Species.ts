import { bus, game, type RoeEgg } from '../state/GameState';
import { EPOCHS } from '../data/epochs';
import type { SpeciesAdvanced, SpeciesOver, SpeciesPicked } from './protocol';
import { netWanted, playerName, serverUrl } from './NetSync';
import type { FishBranch } from '../sim/fishTree';

// Der gemeinsame Laich im Koop: Nur Eier der aktuellen und nächsten Generation bleiben nutzbar (server/SpeciesRoom.ts). Die Verbindung
// bleibt über alle Szenen hinweg bestehen (Level, Laich-Wahl, Karte) – sie spiegelt den gemeinsamen Laich in den Spielstand
// (GameState.syncShared) und meldet, was man laicht. Ohne Server (offline) bleibt alles beim eigenen Laich.
//
// Ereignisse (bus): 'species' – der gemeinsame Laich hat sich geändert; 'speciesAdvanced' (name, gen) – ein Artgenosse hat
// die nächste Generation begonnen; 'speciesOver' (name, cause, gen) – die Art ist ausgestorben.

interface RoomLike {
  sessionId: string;
  state: { gen: number; pool: Map<string, string>; next: Map<string, string>; members: Map<string, string>; selections: Map<string, string>; branches: Map<string,string>; presence:Map<string,string>; over: string };
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
  private place='';
  private joining?: Promise<void>;
  private req = 1;
  private waits = new Map<number, (r: SpeciesPicked) => void>();
  private lastLaich = '';
  private lastMarks = '';
  private lastBranches='';
  private marked = '';

  constructor() {
    bus.on('fishLineage',()=>this.publishBranch());
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

  /** Current peers only; the persistent branch archive also contains earlier, disconnected sessions. */
  get peerBranches(): FishBranch[] {
    const r=this.room;if(!r)return [];
    return [...r.state.members.keys()].filter(id=>id!==r.sessionId).flatMap(id=>{
      try{const b=JSON.parse(r.state.branches.get(id)??'null');return b&&Array.isArray(b.trace)&&b.trace.length&&b.trace.length<=8?[b as FishBranch]:[];}catch{return [];}
    });
  }

  get livingPeers():{id:string;name:string;place:string;identity:string}[] {
    const r=this.room;if(!r)return [];
    return [...r.state.presence.entries()].flatMap(([id,raw])=>{try{const p=JSON.parse(raw);return id!==r.sessionId&&p.alive?[{id,name:r.state.members.get(id)??'Artgenosse',place:p.place??'',identity:p.identity??''}]:[];}catch{return [];}});
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
  connect(epoch: number,place=game.prog.place) {
    this.place=place;
    if (!netWanted() || EPOCHS[epoch]?.brood) return;
    if(this.epoch===epoch&&this.room){
      const run=game.run;
      if(run){this.room.send('hello',{identity:game.playerId,place,waiting:!!run.waiting,gen:game.poolGen,pool:game.pool.map(e=>JSON.stringify(e)),next:game.roe.map(e=>JSON.stringify(e)),trace:JSON.stringify(run.fishTrace??[{form:0,primary:0}])});this.lastLaich='';this.mirror();}
      return;
    }
    if(this.epoch===epoch&&this.joining)return;
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
        room.send('hello', {identity:game.playerId,place:this.place||game.prog.place,waiting:!!run.waiting,trace:JSON.stringify(run.fishTrace??[{form:0,primary:0}]), gen: game.poolGen, pool: game.pool.map((e) => JSON.stringify(e)), next: game.roe.map((e) => JSON.stringify(e)) });
      }
      // Auch einen bereits vollständigen Anfangsstand übernehmen, wenn hello nichts mehr ändert.
      this.mirror();
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
    const branchStamp=JSON.stringify([...(r.state.branches??[])]);
    for(const [id,raw] of r.state.branches??[])if(id!==r.sessionId){
      try{const branch=JSON.parse(raw);if(!Array.isArray(branch.trace)||branch.trace.length>8)continue;
        const saved=game.data.fishBranches??=[];const i=saved.findIndex(b=>b.id===branch.id);
        if(i<0)saved.push(branch);else saved[i]=branch;
      }catch{}
    }
    if(branchStamp!==this.lastBranches){this.lastBranches=branchStamp;game.save();}
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

  private publishBranch() {
    if(this.room&&game.run?.fishTrace)this.room.send('lineage',{trace:JSON.stringify(game.run.fishTrace)});
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
  extinct(cause: string,ended=true) {
    this.room?.send('extinct', { cause,ended });
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
