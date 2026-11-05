import { describe, expect, it } from 'vitest';
import { starterPoint, type StarterMotionPose } from '../src/art/fish/starterMotion';

const geometry = { width: 112, height: 63, hinge: [.78, .64] };
const pose = (over: Partial<StarterMotionPose> = {}): StarterMotionPose => ({
  phase: 0, speed: 0, still: 0, pitch: 0, bob: 0, lunge: 0, opening: 0, ...over,
});
const distance = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x - b.x, a.y - b.y);

describe('Bewegung der gemalten Startfische', () => {
  it('erhält Kopf- und Rumpfproportionen beim Schwimmen, Neigen und Zubeißen', () => {
    const points = [[.46, .4], [.56, .65], [.7, .42], [.9, .54]];
    for (let frame = 0; frame < 120; frame++) {
      const p = pose({ phase: frame * .3, speed: frame % 3 * .75, pitch: Math.sin(frame) * .2, bob: Math.sin(frame) * .1, lunge: Math.cos(frame) * 2 });
      for (let i = 1; i < points.length; i++) {
        const [u0, v0] = points[i - 1], [u1, v1] = points[i];
        const expected = Math.hypot((u1 - u0) * geometry.width, (v1 - v0) * geometry.height);
        expect(distance(starterPoint(u0, v0, geometry, p), starterPoint(u1, v1, geometry, p))).toBeCloseTo(expected, 8);
      }
    }
  });

  it('hält den Rumpf ohne Körperwelle und lässt Schwanz und Flossenspitzen in Ruhe weiterarbeiten', () => {
    const a = pose({ phase: 0 }), b = pose({ phase: 1.5 });
    expect(starterPoint(.6, .5, geometry, a)).toEqual(starterPoint(.6, .5, geometry, b));
    expect(distance(starterPoint(.1, .5, geometry, a), starterPoint(.1, .5, geometry, b))).toBeGreaterThan(.5);
    expect(distance(starterPoint(.5, .18, geometry, a, false, 1), starterPoint(.5, .18, geometry, b, false, 1))).toBeGreaterThan(.1);
    expect(starterPoint(.5, .38, geometry, a, false, 1)).toEqual(starterPoint(.5, .38, geometry, b, false, 1));
  });

  it('dreht die Schwanzflosse ohne sie wie ein Tuch zu dehnen', () => {
    const rest = Math.hypot(.1 * geometry.width, .3 * geometry.height);
    for (let frame = 0; frame < 100; frame++) {
      const p = pose({ phase: frame * .27, speed: 1.5 });
      expect(distance(starterPoint(.1, .35, geometry, p, false, 1), starterPoint(.2, .65, geometry, p, false, 1))).toBeCloseTo(rest, 8);
    }
  });

  it('öffnet den Unterkiefer um das gemeinsame Gelenk und hält Auge und Oberkiefer am Kopf', () => {
    const p = pose({ phase: 2, opening: .4, pitch: -.2, bob: .1, lunge: 2 });
    const [u, v] = geometry.hinge;
    expect(starterPoint(u, v, geometry, p, true)).toEqual(starterPoint(u, v, geometry, p));
    const closed = pose({ ...p, opening: 0 });
    expect(starterPoint(.84, .48, geometry, p)).toEqual(starterPoint(.84, .48, geometry, closed));
    expect(distance(starterPoint(.94, .65, geometry, p, true), starterPoint(.94, .65, geometry, closed, true))).toBeGreaterThan(5);
  });
});
