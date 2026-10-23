/** Presentation only: these settings never affect simulation, saves or the shared world. */
export interface RetroSettings {
  enabled: boolean;
  pixelSize: number;
  contrast: number;
  saturation: number;
  dither: number;
}

export const RETRO_DEFAULTS: Readonly<RetroSettings> = Object.freeze({
  enabled: true, pixelSize: 3, contrast: 1.14, saturation: 1.3, dither: 0.35,
});

export const retroSettings: RetroSettings = { ...RETRO_DEFAULTS };
const STORE = 'evo-retro-visuals-v1';
const listeners = new Set<() => void>();

const bounds = {
  pixelSize: [1, 6, 1], contrast: [0.85, 1.5, 0.01], saturation: [0.7, 1.8, 0.01], dither: [0, 1, 0.01],
} as const;

/** Ignore malformed imports/storage; constrain shader uniforms before they reach the GPU. */
export function normalizeRetroSettings(value: unknown): RetroSettings {
  const out = { ...RETRO_DEFAULTS };
  if (!value || typeof value !== 'object') return out;
  const input = value as Record<string, unknown>;
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const n = input[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) continue;
    const [min, max, step] = bounds[key];
    out[key] = Math.round(Math.max(min, Math.min(max, n)) / step) * step;
  }
  return out;
}

export function loadRetroSettings() {
  try { Object.assign(retroSettings, normalizeRetroSettings(JSON.parse(localStorage.getItem(STORE) ?? 'null'))); }
  catch { Object.assign(retroSettings, RETRO_DEFAULTS); }
}

export function setRetroSettings(patch: Partial<RetroSettings>) {
  Object.assign(retroSettings, normalizeRetroSettings({ ...retroSettings, ...patch }));
  try { localStorage.setItem(STORE, JSON.stringify(retroSettings)); } catch { /* session-only when storage is unavailable */ }
  for (const fn of listeners) fn();
}

export function resetRetroSettings() { setRetroSettings({ ...RETRO_DEFAULTS }); }

export function onRetroSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** A shared RGB555 palette: cool steel/sea ramps, hot energy, plants and readable creature colours. */
export const RETRO_PALETTE = [
  0x000000, 0x080c21, 0x101c3b, 0x18305a, 0x204d84, 0x286fc3, 0x329bed, 0x27c7e8,
  0x67edf0, 0xb5f7ef, 0xf4fcff, 0x202038, 0x383848, 0x52576b, 0x747f94, 0x9cabb9,
  0xd2d6ce, 0x302451, 0x543b85, 0x7952b1, 0xb353cc, 0xec63d8, 0xffa4df, 0x51243b,
  0x8d2e54, 0xc84957, 0xf17958, 0xffad5b, 0xffd878, 0xffefb5, 0x163e42, 0x22705b,
  0x459365, 0x80c771, 0xc5e797, 0x1b3a50, 0x285973, 0x39849a, 0xc1bc7b, 0xe4d6a5,
  0x302c30, 0x55403b, 0x795347, 0x997457, 0xc49b73, 0xe3bd94, 0x6b3943, 0xa45e69,
] as const;

/** The SNES stores 5 bits per colour channel (BGR555), rather than arbitrary 24-bit RGB. */
export function rgb555(colour: number): [number, number, number] {
  return [16, 8, 0].map((shift) => Math.round(((colour >> shift) & 255) / 255 * 31) / 31) as [number, number, number];
}

/** A 32³ RGB555 colour cube packed as 1024×32 RGBA. Built once, instead of 48 comparisons per screen pixel. */
export function createRetroPaletteLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(1024 * 32 * 4);
  const palette = RETRO_PALETTE.map(rgb555);
  for (let b = 0; b < 32; b++) for (let g = 0; g < 32; g++) for (let r = 0; r < 32; r++) {
    let best = Infinity, chosen = palette[0];
    for (const p of palette) {
      const dr = r / 31 - p[0], dg = g / 31 - p[1], db = b / 31 - p[2];
      const distance = dr * dr * 0.3 + dg * dg * 0.52 + db * db * 0.18;
      if (distance < best) { best = distance; chosen = p; }
    }
    const i = (b * 1024 + g * 32 + r) * 4;
    lut[i] = Math.round(chosen[0] * 255);
    lut[i + 1] = Math.round(chosen[1] * 255);
    lut[i + 2] = Math.round(chosen[2] * 255);
    lut[i + 3] = 255;
  }
  return lut;
}
