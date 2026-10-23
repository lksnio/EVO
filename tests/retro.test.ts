import { describe, expect, it } from 'vitest';
import { createRetroPaletteLut, normalizeRetroSettings, RETRO_DEFAULTS, RETRO_PALETTE, rgb555 } from '../src/data/retro';

describe('16-Bit presentation settings', () => {
  it('keeps malformed storage and out-of-range GPU uniforms safe', () => {
    expect(normalizeRetroSettings(null)).toEqual(RETRO_DEFAULTS);
    expect(normalizeRetroSettings({ enabled: 'yes', pixelSize: NaN, contrast: Infinity, saturation: '1.5' })).toEqual(RETRO_DEFAULTS);
    expect(normalizeRetroSettings({ enabled: false, pixelSize: 12, contrast: -2, saturation: 9, dither: -1 })).toEqual({
      enabled: false, pixelSize: 6, contrast: 0.85, saturation: 1.8, dither: 0,
    });
    expect(normalizeRetroSettings({ pixelSize: 2.6 }).pixelSize).toBe(3);
  });

  it('maps the entire RGB555 cube to the curated palette and preserves every palette entry', () => {
    const lut = createRetroPaletteLut();
    expect(lut.length).toBe(32 ** 3 * 4);
    const packed = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;
    const rgb = RETRO_PALETTE.map((c) => rgb555(c).map((n) => Math.round(n * 255)));
    const allowed = new Set(rgb.map(([r, g, b]) => packed(r, g, b)));
    const seen = new Set<number>();
    for (let i = 0; i < lut.length; i += 4) {
      seen.add(packed(lut[i], lut[i + 1], lut[i + 2]));
      if (lut[i + 3] !== 255) throw new Error('The palette must remain opaque');
    }
    expect(seen).toEqual(allowed);
    for (const c of RETRO_PALETTE) {
      const p = rgb555(c), [r, g, b] = p.map((v) => Math.round(v * 31));
      const i = (b * 1024 + g * 32 + r) * 4;
      expect([...lut.slice(i, i + 3)]).toEqual(p.map((v) => Math.round(v * 255)));
    }
    expect([...lut.slice(0, 4)]).toEqual([0, 0, 0, 255]);
  });
});
