import { describe, expect, it } from 'vitest';
import { CAMERA, PLAY_VIEW, W } from '../src/config';
import { frameZoom, leadOf } from '../src/sim/camera';

describe('Kamera', () => {
  it('ist beim ausgewachsenen Starttier näher als früher und rückt kleinere Tiere noch näher heran', () => {
    const adult = frameZoom(CAMERA.ref);
    expect(adult).toBeCloseTo(CAMERA.adult);
    // das frühere Bild (Zoom 0,72) – die Kamera ist jetzt deutlich näher
    expect(adult).toBeGreaterThan((W / PLAY_VIEW.w) * 1.5);
    expect(frameZoom(18)).toBeGreaterThan(adult);
    expect(frameZoom(120)).toBeLessThan(adult);
  });

  it('bleibt in ihren Grenzen – auch für winzige und riesige Tiere', () => {
    expect(frameZoom(0)).toBe(CAMERA.max);
    expect(frameZoom(5000)).toBe(CAMERA.min);
  });

  it('dämpft die Größe: Ein doppelt so großes Tier wirkt im Bild größer, aber nicht doppelt so groß', () => {
    const a = 40 * frameZoom(40), b = 80 * frameZoom(80);
    expect(b / a).toBeGreaterThan(1.2);
    expect(b / a).toBeLessThan(2);
  });

  it('schaut in Blickrichtung voraus, in voller Fahrt weiter', () => {
    expect(leadOf(1, 0, 0).x).toBeCloseTo(CAMERA.idle);
    expect(leadOf(-1, 1, 0).x).toBeCloseTo(-CAMERA.lead);
    expect(leadOf(1, 3, 0).x).toBeCloseTo(CAMERA.lead);
    expect(leadOf(1, 0, -2).y).toBeCloseTo(-CAMERA.leadY);
  });
});
