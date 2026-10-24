import { describe, expect, it, vi } from 'vitest';
import { GhostAnimal } from '../src/net/GhostAnimal';
import { Interp } from '../src/net/Interp';
import type { AnimalRow } from '../src/net/protocol';

vi.mock('phaser', () => ({ default: { Physics: { Arcade: { Sprite: class {} } }, TintModes: { MULTIPLY: 0, FILL: 1 } } }));
vi.mock('../src/audio/Audio', () => ({ audio: { sfx() {} } }));

function ghost() {
  const g = Object.create(GhostAnimal.prototype) as GhostAnimal;
  Object.assign(g, {
    dead: false, x: 100, y: 300, sz: 1, hp: 20, maxHp: 20, flashUntil: 0,
    dir: 1, tn: 0, presence: 1, alpha: 0.35, isTinted: false,
    path: new Interp(130), world: { water: true, time: { now: 500 } },
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    setFlipX: vi.fn(), setScale: vi.fn(), setAngle: vi.fn(), setAlpha: vi.fn(),
  });
  return g;
}
const row: AnimalRow = { id: 1, sp: 'cladoselache', x: 120, y: 300, d: -1, an: 0, hp: 20, mh: 20, sz: 1, tn: 0, al: 100, at: true };

describe('Stellvertreter im persönlichen Blickfeld', () => {
  it('überschreibt nach der Bewegung nicht mehr die lokale Sichtbarkeit', () => {
    const g = ghost();
    g.apply(row, 1000, 1000);
    g.tick(0, 0.05);
    expect(g.setAlpha).not.toHaveBeenCalled();
    expect(g.presence).toBe(1);
  });

  it('zeigt bei einem Treffer die aktuelle Position statt einer alten interpolierten Position', () => {
    const g = ghost();
    g.apply(row, 1000, 1000);
    g.reveal({ ...row, x: 450 }, 1100);
    expect(g.x).toBe(450);
    expect(g.y).toBe(300);
    expect(g.revealedUntil).toBe(1500);
    expect(g.setAlpha).toHaveBeenCalledWith(1);
  });
});
