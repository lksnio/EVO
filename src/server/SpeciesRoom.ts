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

/** Only the shared current generation and its next brood remain playable. A jump
 * discards the old eggs; living players may finish their lives and spectators wait. */
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
      if (this.state.over || !this.state.gen || this.deadMembers.has(_client.sessionId) || !Array.isArray(m?.eggs)) return;
      const gen = Math.round(num(m.gen, 0));
      for (const raw of m.eggs.slice(0, 100)) this.place(gen, raw);
    },
    pick: (client: Client, m: SpeciesPick) => this.onPick(client, m),
    select: (client: Client, m: { id?: unknown }) => {
      const id = typeof m?.id === 'string' ? m.id : '';
      if (!id) this.state.selections.delete(client.sessionId);
      else if (!this.state.over && (this.state.pool.has(id) || this.state.next.has(id))) this.state.selections.set(client.sessionId, id);
    },
    extinct:(client:Client,m:{cause?:unknown;ended?:boolean})=>{
      this.deadMembers.add(client.sessionId);
      const presence=JSON.parse(this.state.presence.get(client.sessionId)??'{}');
      this.state.presence.set(client.sessionId,JSON.stringify({...presence,alive:false}));
      if(m.ended!==false){const raw=this.state.branches.get(client.sessionId);if(raw){try{this.state.branches.set(client.sessionId,JSON.stringify({...JSON.parse(raw),extinct:true}));}catch{}}}
      this.maybeOver(String(m.cause??'No eggs left'),client.sessionId);
    },
  };

  onCreate(o: SpeciesJoin) {
    const epoch = Math.round(num(o?.epoch, -1));
    if (!EPOCHS[epoch]?.playable) throw new Error('This era does not exist.');
    this.state.epoch = epoch;
  }

  onJoin(client: Client, o: SpeciesJoin) {
    this.state.members.set(client.sessionId, cleanName(o?.name) || 'Fish');
    this.state.presence.set(client.sessionId,JSON.stringify({alive:true,place:'',identity:client.sessionId}));
  }

  onLeave(client: Client) {
    this.state.members.delete(client.sessionId);
    this.state.selections.delete(client.sessionId);
    this.memberGen.delete(client.sessionId);
    this.state.presence.delete(client.sessionId);this.deadMembers.delete(client.sessionId);
    this.maybeOver('No living fellow creatures remain',client.sessionId);
  }

  /**
   * Die erste lebende Linie setzt die Generation, ebenso ein Neustart nach dem Aussterben. Weitere Meldungen behalten
   * die gemeinsame Generation bei; nur unbekannte Eier innerhalb ihres Fensters kommen dazu.
   */
  private onHello(_client: Client, m: SpeciesHello) {
    const s = this.state;
    const gen = Math.max(1, Math.round(num(m?.gen, 1)));
    const pool = Array.isArray(m?.pool) ? m.pool : [];
    const next = Array.isArray(m?.next) ? m.next : [];
    if(s.over&&!m.waiting){s.gen=gen;s.pool.clear();s.next.clear();}
    s.over='';if(m.waiting)this.deadMembers.add(_client.sessionId);else this.deadMembers.delete(_client.sessionId);s.gen=s.gen||gen;this.memberGen.set(_client.sessionId,gen);
    const identity=typeof m.identity==='string'&&/^[a-z0-9]{4,40}$/i.test(m.identity)?m.identity:_client.sessionId;
    s.presence.set(_client.sessionId,JSON.stringify({alive:!m.waiting,place:typeof m.place==='string'?m.place.slice(0,60):'',identity}));
    this.branch(_client,m.trace);
    for (const raw of pool.slice(0, SPECIES_MAX_EGGS)) this.place(gen, raw);
    for (const raw of next.slice(0, SPECIES_MAX_EGGS)) this.place(gen + 1, raw);
    if(m.waiting)this.maybeOver('No eggs left',_client.sessionId);
  }

  private maybeOver(cause:string,who:string) {
    const s=this.state;
    if(s.over||!s.gen||s.pool.size||s.next.size||[...s.members.keys()].some(id=>!this.deadMembers.has(id)))return;
    s.over=cause.slice(0,80);s.selections.clear();
    this.broadcast('extinct',{name:s.members.get(who)??'',cause:s.over,gen:s.gen} satisfies SpeciesOver);
  }

  /** Store each unique egg once, preserving its generation across reconnects. */
  private place(gen: number, raw: unknown) {
    const s = this.state;
    const e = eggOf(raw);
    if (!e || this.known.has(e.id) || s.pool.size + s.next.size >= SPECIES_MAX_EGGS) return;
    this.known.add(e.id);
    const data=JSON.parse(e.json);data.generation=Math.min(65535,Math.max(1,Math.round(num(data.generation,gen))));
    if(data.generation===s.gen)s.pool.set(e.id,JSON.stringify(data));
    else if(data.generation===s.gen+1)s.next.set(e.id,JSON.stringify(data));

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
      this.state.branches.set(client.sessionId,JSON.stringify({id:`peer-${client.sessionId}`,name:this.state.members.get(client.sessionId)??'Fellow creature',trace,...(this.deadMembers.has(client.sessionId)?{extinct:true}:{})}));
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
    const next=s.next.get(id),raw=s.pool.get(id)??next;
    if(!raw)return reply({req,egg:'',gen:s.gen,group:'pool'});
    const group=next?'next':'pool';
    if(next){
      s.next.delete(id);s.gen+=1;s.pool.clear();
      for(const [key,value] of s.next)s.pool.set(key,value);s.next.clear();
    }else s.pool.delete(id);
    this.pruneSelections();s.selections.delete(client.sessionId);
    this.deadMembers.delete(client.sessionId);this.memberGen.set(client.sessionId,s.gen);
    const presence=JSON.parse(s.presence.get(client.sessionId)??'{}');s.presence.set(client.sessionId,JSON.stringify({...presence,alive:true}));
    reply({req,egg:raw,gen:s.gen,group});
    if(next)this.broadcast('advanced',{name:s.members.get(client.sessionId)??'',gen:s.gen} satisfies SpeciesAdvanced,{except:client});

  }
}
