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

/** Shared eggs retain their own generations and ancestry. Taking an egg removes only
 * that egg; it never advances or deletes another player's branch. Extinction is
 * shared only when no eggs and no living connected players remain. */
export class SpeciesRoom extends Room<{ state: SpeciesState }> {
  state = new SpeciesState();
  maxClients = 24;
  autoDispose = false;
  /** jede Kennung, die die Art je gesehen hat – was schon geschlüpft ist, kommt nicht wieder */
  private known = new Set<string>();
  private deadMembers=new Set<string>();
  private memberGen=new Map<string,number>();

  messages = {
    hello: (client: Client, m: SpeciesHello) => this.onHello(client, m),
    lineage:(client:Client,m:{trace?:unknown})=>this.branch(client,m.trace),
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
      this.deadMembers.add(client.sessionId);
      const own=s.branches.get(client.sessionId);
      if(own){try{s.branches.set(client.sessionId,JSON.stringify({...JSON.parse(own),extinct:true}));}catch{}}
      if (s.over || s.pool.size || s.next.size || !s.gen || [...s.members.keys()].some(id=>!this.deadMembers.has(id))) return;
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
    this.memberGen.delete(client.sessionId);
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
    s.over='';this.deadMembers.delete(_client.sessionId);s.gen=Math.max(s.gen||0,gen);this.memberGen.set(_client.sessionId,gen);
    this.branch(_client,m.trace);
    for (const raw of pool.slice(0, SPECIES_MAX_EGGS)) this.place(gen, raw);
    for (const raw of next.slice(0, SPECIES_MAX_EGGS)) this.place(gen + 1, raw);
  }

  /** Store each unique egg once, preserving its generation across reconnects. */
  private place(gen: number, raw: unknown) {
    const s = this.state;
    const e = eggOf(raw);
    if (!e || this.known.has(e.id) || s.pool.size + s.next.size >= SPECIES_MAX_EGGS) return;
    this.known.add(e.id);
    const data=JSON.parse(e.json);data.generation=Math.min(65535,Math.max(1,Math.round(num(data.generation,gen))));
    s.pool.set(e.id,JSON.stringify(data));
  }

  private branch(client:Client,raw:unknown) {
    if(typeof raw!=='string'||raw.length>1500)return;
    try {
      const trace=JSON.parse(raw);
      if(!Array.isArray(trace)||!trace.length||trace.length>8||trace.some(m=>!Number.isInteger(m.form)||m.form<0||m.form>=48||![0,1,3].includes(m.primary)))return;
      const before=this.state.branches.get(client.sessionId);
      if(before){const prior=JSON.parse(before);if(!JSON.stringify(trace).startsWith(JSON.stringify(prior.trace).slice(0,-1))){
        const id=`past-${client.sessionId}-${prior.trace.map((m:{form:number})=>m.form).join('-')}`;
        this.state.branches.set(id,JSON.stringify({...prior,id,extinct:true}));
      }}
      this.state.branches.set(client.sessionId,JSON.stringify({id:`peer-${client.sessionId}`,name:this.state.members.get(client.sessionId)??'Artgenosse',trace}));
    }catch{}
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
    const raw=s.pool.get(id)??s.next.get(id);
    if(!raw)return reply({req,egg:'',gen:this.memberGen.get(client.sessionId)??s.gen,group:'pool'});
    const gen=Math.max(1,Math.round(num(JSON.parse(raw).generation,s.gen)));
    const prev=this.memberGen.get(client.sessionId)??1;
    s.pool.delete(id);s.next.delete(id);this.pruneSelections();s.selections.delete(client.sessionId);
    this.deadMembers.delete(client.sessionId);this.memberGen.set(client.sessionId,gen);s.gen=Math.max(s.gen||0,gen);
    reply({req,egg:raw,gen,group:gen>prev?'next':'pool'});
    if(gen>prev)this.broadcast('advanced',{name:s.members.get(client.sessionId)??'',gen} satisfies SpeciesAdvanced,{except:client});
  }
}
