import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Controls } from '../src/objects/Controls';
import { Player, type PlayerHost } from '../src/objects/Player';
import { game } from '../src/state/GameState';
import { ADULT } from '../src/sim/life';

// Nur Darstellung und Audio ersetzen: Bewegung, Ausdauer und Eingaben laufen durch Player.update.
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/audio/Audio', () => ({ audio: { sfx: vi.fn() } }));
vi.mock('../src/objects/CreatureView', () => ({
  CreatureView: class {
    key = 'fish';
    L = { halfW: 20, footY: 15, topY: -15 };
    headTilt = 0;
    squintK = 0;
    build() {}
    setDepth() {}
    setPosition() {}
    setTurn() {}
    setAlpha() {}
    animate() {}
    squint(k: number) { this.squintK = k; }
  },
}));

function swimmer(skull = 0, land = false) {
  game.resetAll();
  game.newRun();
  game.traits.skull = skull;
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
    time: { now: 0 }, surfaceY: 0, puff() {}, solidAt: () => false,
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
    p.stamina = p.staminaMax;
    p.update(time, ms / 1000, c);
    rect.x += body.velocity.x * ms / 1000;
    c.pressed.ram = false;
  }
  function ram() { c.held.ram = true; c.pressed.ram = true; }
  return { p, c, step, ram };
}

beforeEach(() => vi.clearAllMocks());

describe('Schädelstoß', () => {
  it.each([
    [-10, 1000], [0, 1000], [22.5, 1250], [45, 1500], [67.5, 1750], [90, 2000], [140, 2000],
  ])('vererbter Schädelzuwachs %s ergibt %s ms Betäubung', (ramGain, duration) => {
    game.resetAll();
    game.newRun();
    for (const cls of ['fish', 'amphibian'] as const) {
      const st = game.stats(cls, { ...game.traits, ramGain }, ADULT);
      expect(st.ramStun).toBeCloseTo(duration);
    }
  });

  it('berücksichtigt auch ältere Schädelmerkmale und die aktuelle Stärke des Jungtiers', () => {
    game.resetAll();
    game.newRun();
    const traits = { ...game.traits, skull: 0.5 };
    // Dreifache Stoßkraft gegenüber dem Urahn: Schädel 30, also 20/90 des Wegs von 1 zu 2 Sekunden.
    expect(game.stats('fish', traits, ADULT).ramStun).toBeCloseTo(1000 + 1000 * 20 / 90);
    const strong = { ...game.traits, ramGain: 90 };
    expect(game.stats('fish', strong, ADULT).ramStun).toBe(2000);
    expect(game.stats('fish', strong, { grow: 0.4, old: 0 }).ramStun).toBeLessThan(2000);
    expect(game.stats().ramStun).toBe(1000);
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
    for (let i = 0; i < 30; i++) s.step();
    expect(s.p.isRamming).toBe(true);
    expect(s.p.view.headTilt).toBeGreaterThan(0.42);
    expect((s.p.view as unknown as { squintK: number }).squintK).toBeGreaterThan(0.5);
    for (let i = 0; i < 30; i++) s.step();
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
