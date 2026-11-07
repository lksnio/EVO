import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Controls } from '../src/objects/Controls';
import { Player, type PlayerHost } from '../src/objects/Player';
import { game } from '../src/state/GameState';
import { ADULT } from '../src/sim/life';
import { EPOCHS } from '../src/data/epochs';

// Nur Darstellung und Audio ersetzen: Bewegung, Ausdauer und Eingaben laufen durch Player.update.
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/audio/Audio', () => ({ audio: { sfx: vi.fn() } }));
vi.mock('../src/objects/CreatureView', () => ({
  CreatureView: class {
    key = 'fish';
    L = { halfW: 20, footY: 15, topY: -15, bite: { x: 10, y: -5, w: 20, h: 10 } };
    headTilt = 0;
    squintK = 0;
    build() {}
    setDepth() {}
    setPosition() {}
    setTurn() {}
    setAlpha() {}
    animate() {}
    bite() {}
    squint(k: number) { this.squintK = k; }
  },
}));

function swimmer(skull = 0, land = false, options: { reservePoints?: number; refill?: boolean } = {}) {
  game.resetAll();
  game.newRun(0);
  game.traits.ramGain = skull*115;
  game.traits.staminaGain=(options.reservePoints??30)-30;
  const velocity = { x: 0, y: 0 };
  const body = {
    velocity, blocked: { down: land }, touching: { down: false }, height: 30,
    setVelocity(x: number, y: number) { velocity.x = x; velocity.y = y; },
    setVelocityX(x: number) { velocity.x = x; },
    setVelocityY(y: number) { velocity.y = y; },
    setSize() {}, setCollideWorldBounds() {}, setAllowGravity() {}, setGravityY() {},
  };
  const rect = { x: 0, y: 500, width: 40, height: 30, body, setSize() {} };
  const host = {
    add: { rectangle: () => rect }, physics: { add: { existing() {} } },
    time: { now: 0, delayedCall: (_ms: number, fn: () => void) => fn() }, surfaceY: 0, puff() {}, solidAt: () => false,
    playerBite: vi.fn(),
    amphibious: land,
  } as unknown as PlayerHost;
  const p = new Player(host, 0, 500, !land);
  p.inWater = !land;
  Object.assign(p.stats, { speed: 200, landSpeed: 150, agility: 1, cruise: 1, groundSpeed: 1, climb: 1, dive: 1 });
  const held = { right: true, left: false, up: false, down: false, jump: false, bite: false, sprint: false, ram: false, talk: false, call: false };
  const c = { held, pressed: { ...held, right: false } } as Controls;
  let time = 1000;
  function step(ms = 1000 / 60) {
    time += ms;
    host.time.now = time;
    // Ohne Erschöpfung vergleichen: Auch mit voller Ausdauer darf R kein schnellerer Reise-Modus sein.
    if (options.refill !== false) p.stamina = p.staminaMax;
    p.update(time, ms / 1000, c);
    rect.x += body.velocity.x * ms / 1000;
    c.pressed.ram = false;
    c.pressed.bite = false;
  }
  function ram() { c.held.ram = false; c.pressed.ram = true; }
  return { p, c, step, ram, host };
}

// This suite retains the legacy three-stage weapon mechanics in Devon.
const devonPlayable = EPOCHS[0].playable;
beforeEach(() => { vi.clearAllMocks(); EPOCHS[0].playable = true; });
afterEach(() => { EPOCHS[0].playable = devonPlayable; });

describe('Schädelstoß', () => {
  it.each([
    [-10,0],[0,0],[15,0],[39,0],[40,1000],[89,1000],[90,2000],[140,2000],
  ])('vererbter Schädelzuwachs %s ergibt %s ms Betäubung', (ramGain, duration) => {
    game.resetAll();
    game.newRun(0);
    for (const cls of ['fish'] as const) {
      const st = game.stats(cls, { ...game.traits, ramGain }, ADULT);
      expect(st.ramStun).toBeCloseTo(duration);
    }
  });

  it('Betäubung hängt von der vererbten Stufe ab, nicht vom Alter oder alten kosmetischen Merkmalen',()=>{
    game.resetAll();game.newRun(0);
    expect(game.stats('fish',{...game.traits,skull:1},ADULT).ramStun).toBe(0);
    expect(game.stats('fish',{...game.traits,ramGain:50},{grow:.4,old:0}).ramStun).toBe(1000);
  });

  it('kommt mit höherem Schädelwert früher und schneller auf Stoßtempo', () => {
    const peak = (skull: number) => {
      const s = swimmer(skull);
      s.ram();
      let speed = 0;
      for (let i = 0; i < 24; i++) { s.step(); speed = Math.max(speed, s.p.body.velocity.x); }
      return speed;
    };
    expect(peak(0)).toBeGreaterThan(200 * 1.45);
    expect(peak(0.5)).toBeGreaterThan(peak(0));
    expect(peak(1)).toBeGreaterThan(peak(0.5));
  });

  it('kneift im Stoß die Augen zusammen und duckt sich; danach erholt er sich ohne neue Stöße oder Spurt', () => {
    const s = swimmer();
    s.ram();
    for (let i = 0; i < 8; i++) s.step();
    expect(s.p.isRamming).toBe(true);
    expect(s.p.view.headTilt).toBeGreaterThan(0.42);
    expect((s.p.view as unknown as { squintK: number }).squintK).toBeGreaterThan(0.5);
    for (let i = 0; i < 52; i++) s.step();
    expect(s.p.isRamming).toBe(false);
    expect(s.p.body.velocity.x).toBeLessThan(s.p.stats.speed);
    expect((s.p.view as unknown as { squintK: number }).squintK).toBe(0);
    s.c.held.sprint = true;
    for (let i = 0; i < 10; i++) { s.ram(); s.step(); expect(s.p.isRamming).toBe(false); }
    expect(s.p.sprinting).toBe(false);
    for (let i = 0; i < 60; i++) s.step();
    expect(s.p.sprinting).toBe(true);
    expect(s.p.body.velocity.x).toBeGreaterThan(s.p.stats.speed);
  });

  it.each([0, 0.5, 1])('Sprinten bleibt auf Strecke schneller als wiederholte Stöße (Schädel %s), auch zusammen mit W', (skull) => {
    const distance = (sprint: boolean, ram: boolean, land: boolean) => {
      const s = swimmer(skull, land);
      s.c.held.sprint = sprint;
      for (let i = 0; i < 600; i++) { if (ram) s.ram(); s.step(); }
      return s.p.x;
    };
    for (const land of [false, true]) {
      const sprint = distance(true, false, land);
      expect(sprint).toBeGreaterThan(distance(false, true, land));
      expect(sprint).toBeGreaterThan(distance(true, true, land));
    }
  });

  it('ein kurzer Tipp und ein abgebrochener Stoß führen ebenfalls in die Erholung', () => {
    for (const knocked of [false, true]) {
      const s = swimmer();
      s.ram(); s.step();
      s.c.held.ram = false;
      if (knocked) s.p.recoil(s.p.x + 50, 0);
      for (let i = 0; i < 30; i++) s.step();
      expect(s.p.isRamming).toBe(false);
      expect(s.p.body.velocity.x).toBeLessThan(s.p.stats.speed);
      s.ram(); s.step();
      expect(s.p.view.headTilt).toBe(0);
    }
  });
});

describe('Angriffsreserve im tatsächlichen Spieler-Update', () => {
  it.each([[30, 8, 8], [45, 12, 12], [60, 16, 16], [100, 26, 26]])(
    'Ausdauer %s erlaubt %s Bisse oder %s Stöße pro voller Leiste', (reservePoints, bites, rams) => {
      for (const [action, expected, cost] of [['bite', bites, 1/8], ['ram', rams, 1 / 8]] as const) {
        const s = swimmer(0.6, false, { reservePoints, refill: false });
        s.p.stats.recover = 0; // Nur die Reserve messen, keine Wartezeit-Regeneration.
        game.traits.jaw = 0.8; // Starke Waffen verändern die festen Kosten nicht.
        let count = 0;
        for (let attempt = 0; attempt < expected + 2; attempt++) {
          const before = s.p.stamina;
          s.c.held[action] = true;
          s.c.pressed[action] = true;
          s.step();
          const spent = before - s.p.stamina;
          if (spent > 1e-8) { count++; expect(spent).toBeCloseTo(cost); }
          s.c.held[action] = false;
          for (let i = 0; i < 120; i++) s.step();
        }
        expect(count).toBe(expected);
        if (action === 'bite') expect(s.host.playerBite).toHaveBeenCalledTimes(bites);
      }
    },
  );

  it('führt den letzten vollständig bezahlten Stoß trotz danach leerer Leiste kraftvoll aus', () => {
    const s = swimmer(0, false, { refill: false });
    s.p.stats.recover = 0;
    s.p.stamina = 1 / 8;
    s.ram();
    let peak = 0;
    for (let i = 0; i < 30; i++) { s.step(); peak = Math.max(peak, s.p.body.velocity.x); }
    expect(s.p.stamina).toBe(0);
    expect(peak).toBeGreaterThan(s.p.stats.speed * 2);
  });

  it('verbraucht bei einem abgebrochenen Stoß genau einmal und erlaubt keine unbezahlten Angriffe', () => {
    const s = swimmer(0, false, { refill: false });
    s.p.stats.recover = 0;
    s.ram(); s.step(); s.c.held.ram = false;
    for (let i = 0; i < 120; i++) s.step();
    expect(s.p.stamina).toBeCloseTo(7 / 8);
    s.p.stamina = 0.1;
    s.ram(); s.step();
    expect(s.p.stamina).toBeCloseTo(0.1);
    s.c.pressed.bite = true; s.step();
    expect(s.p.stamina).toBeCloseTo(0.1);
    expect(s.host.playerBite).not.toHaveBeenCalled();
  });
});


describe('Aufladbare Waffen',()=>{
 it('Stufe 0 beißt sofort, Stufe 1 hält das Maul offen und bezahlt beim Start genau einmal',()=>{
  const base=swimmer(0,false,{refill:false});base.c.pressed.bite=true;base.c.held.bite=true;base.step();expect(base.host.playerBite).toHaveBeenCalledTimes(1);
  const s=swimmer(0,false,{refill:false});game.traits.biteGain=15;s.c.pressed.bite=true;s.c.held.bite=true;s.step();
  for(let i=0;i<82;i++)s.step();expect(s.host.playerBite).not.toHaveBeenCalled();expect(s.p.view.holdOpen).toBeCloseTo(1);expect(s.p.stamina).toBeCloseTo(7/8);
  s.c.held.bite=false;s.step();expect(s.host.playerBite).toHaveBeenCalledTimes(1);expect(s.host.playerBite).toHaveBeenLastCalledWith(expect.anything(),expect.any(Number),1);
  expect(s.p.view.holdOpen).toBe(0);expect(s.p.stamina).toBeCloseTo(7/8);
 });
 it('ein kurzer Tipp bleibt auch mit entwickeltem Gebiss ein schneller Biss',()=>{
  const s=swimmer(0,false,{refill:false});game.traits.biteGain=15;s.c.pressed.bite=true;s.c.held.bite=false;s.step();
  expect(s.host.playerBite).toHaveBeenCalledWith(expect.anything(),expect.any(Number),0);expect(s.p.stamina).toBeCloseTo(7/8);
 });
 it('löst nach 2,5 Sekunden einmal aus und startet bei weiter gehaltener Taste keinen zweiten Biss',()=>{
  const s=swimmer(0,false,{refill:false});game.traits.biteGain=15;s.c.pressed.bite=true;s.c.held.bite=true;
  for(let i=0;i<220;i++)s.step();expect(s.host.playerBite).toHaveBeenCalledTimes(1);expect(s.p.view.holdOpen).toBe(0);
 });
 it('der aufgeladene Stoß startet erst beim Loslassen und kostet nur einen Stoß',()=>{
  const s=swimmer(1,false,{refill:false});s.p.stats.recover=0;s.ram();s.c.held.ram=true;s.step();
  for(let i=0;i<82;i++)s.step();expect(s.p.isRamming).toBe(false);expect(s.p.stamina).toBeCloseTo(7/8);
  s.c.held.ram=false;s.step();let peak=0;for(let i=0;i<12;i++){s.step();peak=Math.max(peak,s.p.body.velocity.x);}
  expect(peak).toBeGreaterThan(s.p.stats.speed*3);expect(s.p.stamina).toBeCloseTo(7/8);
 });
});

describe('Ausdauer ohne vollständiges Wiederaufladen',()=>{
 it.each(['bite','ram'] as const)('erlaubt %s mit genau einem Achtel trotz zuvor erschöpfter Leiste',action=>{
  const s=swimmer(0,false,{refill:false});s.p.stats.recover=0;s.p.exhausted=true;s.p.stamina=1/8;
  s.c.held[action]=false;s.c.pressed[action]=true;s.step();
  expect(s.p.stamina).toBe(0);
  if(action==='bite')expect(s.host.playerBite).toHaveBeenCalledTimes(1);
  else{for(let i=0;i<7;i++)s.step();expect(s.p.isRamming).toBe(true);}
 });
 it('kann mit kleiner wieder verfügbarer Reserve sofort wieder sprinten',()=>{
  const s=swimmer(0,false,{refill:false});s.p.stats.recover=0;s.p.exhausted=true;s.p.stamina=.1;s.c.held.sprint=true;s.step();
  expect(s.p.sprinting).toBe(true);expect(s.p.exhausted).toBe(false);expect(s.p.stamina).toBeLessThan(.1);
 });
 it('bewegt sich beim Zielen ungefähr so schnell wie mit leerer Leiste',()=>{
  const s=swimmer(1,false,{refill:false});s.ram();s.c.held.ram=true;
  for(let i=0;i<60;i++)s.step();
  expect(s.p.isRamming).toBe(false);expect(s.p.body.velocity.x/s.p.stats.speed).toBeGreaterThan(.65);expect(s.p.body.velocity.x/s.p.stats.speed).toBeLessThan(.72);
 });
 it('nimmt Sprintschwung ins Zielen mit und bremst ihn allmählich ab',()=>{
  const s=swimmer(1,false,{reservePoints:100,refill:false});s.c.held.sprint=true;
  for(let i=0;i<90;i++)s.step();const sprint=s.p.body.velocity.x;
  s.c.held.sprint=false;s.ram();s.c.held.ram=true;
  for(let i=0;i<8;i++)s.step();
  expect(s.p.body.velocity.x).toBeGreaterThan(sprint*.85);expect(s.p.body.velocity.x).toBeLessThanOrEqual(sprint*1.01);
 });
});
