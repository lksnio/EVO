import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COLLECTION_FOSSILS, COLLECTION_SHELLS, SHELL_WISDOM } from '../src/data/collection';
import { game } from '../src/state/GameState';
import { readCollection } from '../src/sim/collection';
import { phases } from '../src/sim/life';

describe('Dauerhafte Sammlungen', () => {
  beforeEach(() => { game.resetAll(); game.newRun(0); });

  it('zählt sieben unterschiedliche Muscheln einmal und verändert weder Werte noch Körper', () => {
    const stats=game.stats(),shown=game.shown(),morph=game.morph();
    for(const {id} of COLLECTION_SHELLS){expect(game.collectShell(id)).toBe(true);expect(game.collectShell(id)).toBe(false);}
    expect(game.shells).toBe(7);
    expect(game.stats()).toEqual(stats);expect(game.shown()).toEqual(shown);expect(game.morph()).toEqual(morph);
    expect(game.staminaMax).toBe(1);
  });

  it('behält Funde nach Aussterben, neuer Linie und Zeitalterwechsel', () => {
    game.collectShell('abyss');game.extinct(.4,'Test');game.newRun(0);game.newRun(1);
    expect(game.collection.shells).toEqual(['abyss']);expect(game.collectShell('abyss')).toBe(false);
  });

  it('merkt ungelesene Funde für Übersicht und Weisheiten getrennt', () => {
    expect(game.collectionFresh).toBe(false);expect(game.unheardWisdom).toBe(false);
    game.collectShell('abyss');expect(game.collectionFresh).toBe(true);expect(game.unheardWisdom).toBe(true);
    game.seeCollection();expect(game.collectionFresh).toBe(false);expect(game.unheardWisdom).toBe(true);
    expect(game.hearWisdom().text).toBe(SHELL_WISDOM[0]);expect(game.unheardWisdom).toBe(false);
    expect(game.hearWisdom().text).toBe(SHELL_WISDOM[0]);
  });

  it('erzählt alle sieben Weisheiten der Reihe nach, auch bei mehreren neuen Funden vor einem Besuch', () => {
    expect(game.hearWisdom().index).toBe(-1);
    for(const {id} of COLLECTION_SHELLS)game.collectShell(id);
    const before=game.stats();
    expect(Array.from({length:7},()=>game.hearWisdom().text)).toEqual([...SHELL_WISDOM]);
    expect(game.unheardWisdom).toBe(false);expect(game.hearWisdom().index).toBe(6);expect(game.stats()).toEqual(before);
  });

  it('merkt einen ersten Bossdrop vor dem Aufheben und verhindert doppelte Drops sowie Funde', () => {
    const d={id:'dunkleosteus' as const,epoch:'devon',place:'wand',x:800,y:900};
    expect(game.collectFossil(d.id)).toBe(false);
    expect(game.recordFossilDrop(d)).toBe(true);expect(game.recordFossilDrop(d)).toBe(false);
    expect(game.fossils).toBe(0);expect(game.collection.pending).toEqual([d]);
    game.extinct(.4,'Test');game.newRun(0);expect(game.collection.pending).toEqual([d]);
    expect(game.collectFossil(d.id)).toBe(true);expect(game.collectFossil(d.id)).toBe(false);
    expect(game.collection.pending).toEqual([]);expect(game.recordFossilDrop(d)).toBe(false);
  });

  it('hat sieben Bossplätze und validiert doppelte, unbekannte sowie beschädigte Einträge', () => {
    expect(new Set(COLLECTION_FOSSILS.map(f=>f.id)).size).toBe(7);
    const c=readCollection({v:1,shells:['abyss','abyss','drop:old','nope'],fossils:['dunkleosteus','dunkleosteus'],heard:99,
      pending:[{id:'dunkleosteus',epoch:'devon',place:'wand',x:1,y:2},{id:'mosasaurus',epoch:'kreide',place:'meer',x:NaN,y:2}],seen:['shell:abyss','fossil:unknown']});
    expect(c.shells).toEqual(['abyss']);expect(c.fossils).toEqual(['dunkleosteus']);expect(c.pending).toEqual([]);
    expect(c.heard).toBe(1);expect(c.seen).toEqual(['shell:abyss']);
  });
});

describe('Migration und Speichern', () => {
  const store=new Map<string,string>();
  beforeEach(()=>{
    store.clear();
    (globalThis as {localStorage?:unknown}).localStorage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)};
    game.load();game.resetAll();game.newRun(0);
  });
  afterEach(()=>{delete (globalThis as {localStorage?:unknown}).localStorage;});

  it('löscht alte Währung und gekaufte/goldene Boni aus aktivem Lauf, geparkten Linien und Eiern auch im gespeicherten JSON',()=>{
    const base=game.stats(),traits={...game.traits},old=JSON.parse(JSON.stringify(game.data));
    old.shells=1023;old.seenShells=100;old.keptUps={karbon:{hp:9,stam:8,oxy:4}};
    const legacy={shells:['old'],blessings:7,seenRows:1,ups:{hp:8,stam:8,sight:2,oxy:6},upLog:['hp'],upHint:true,gold:{key:'hp',at:0}};
    Object.assign(old.run,legacy);old.run.pool=[{traits:{},sex:1,seed:1,place:'riff',x:30,y:40,gold:'hp'}];
    old.run.next=[{traits:{},sex:1,seed:2,place:'riff',x:30,y:40,gold:'stam'}];
    old.run.life.clutches=[{place:'riff',x:30,y:40,at:0,fert:true,role:'father',eggs:true,gold:true}];
    old.parked={1:{...JSON.parse(JSON.stringify(old.run)),epoch:1,cls:'amphibian',node:'root:karbon'}};
    old.nodes['root:karbon']={...old.nodes.root,id:'root:karbon',epoch:1,cls:'amphibian'};
    store.set('evo-save-v3',JSON.stringify(old));game.load();
    expect(game.shells).toBe(0);expect(game.collection.fossils).toEqual([]);expect(game.stats()).toEqual(base);expect(JSON.parse(JSON.stringify(game.traits))).toEqual(traits);
    const persisted=JSON.parse(store.get('evo-save-v3')!);
    for(const key of ['shells','seenShells','keptUps'])expect(persisted).not.toHaveProperty(key);
    for(const r of [persisted.run,...Object.values(persisted.parked)] as any[]){
      for(const key of Object.keys(legacy))expect(r).not.toHaveProperty(key);
      for(const e of [...r.pool,...r.next,...r.life.clutches])expect(e).not.toHaveProperty('gold');
    }
  });

  it('behält neue Funde, Weisheiten und liegengebliebene Fossilien beim Laden',()=>{
    game.collectShell('abyss');game.recordFossilDrop({id:'dunkleosteus',epoch:'devon',place:'wand',x:700,y:900});
    game.load();expect(game.shells).toBe(1);expect(game.unheardWisdom).toBe(true);expect(game.collection.pending).toHaveLength(1);
    game.collectFossil('dunkleosteus');game.hearWisdom();game.load();expect(game.fossils).toBe(1);expect(game.unheardWisdom).toBe(false);
  });

  it('ändert bei der Migration kein reguläres Alter unterhalb des Lebensendes',()=>{
    game.life.age=phases(1).mature+100;game.save();game.load();expect(game.life.age).toBe(phases(1).mature+100);
  });
});
