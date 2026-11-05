import { describe, expect, it } from 'vitest';
import { placeBound, protectedKey, stemsOf } from '../src/art/texRules';

describe('Grafikspeicher', () => {
  it('erkennt große ortsgebundene Bilder', () => {
    expect(placeBound('inkbg_far_garden_water_reef')).toBe(true);
    expect(placeBound('inkmurk_valley_100')).toBe(true);
    expect(placeBound('chasm_shade_2120x3040')).toBe(true);
    expect(placeBound('sp_dunkleosteus_1')).toBe(false);
    expect(placeBound('surface_loop_sky')).toBe(false);
  });

  it('schützt sichtbare Bilder und ihre Geschwister, aber nicht Fremdes', () => {
    const keys = new Set(['wf_moythomasia_fb', 'sp_dunkleosteus_0', 'glow']);
    const used = { keys, stems: stemsOf(keys) };
    expect(protectedKey('wf_moythomasia_fb', used)).toBe(true);
    expect(protectedKey('wf_moythomasia_fj', used)).toBe(true);
    expect(protectedKey('sp_dunkleosteus_3', used)).toBe(true);
    expect(protectedKey('glow', used)).toBe(true);
    expect(protectedKey('wf_cheirolepis_fb', used)).toBe(false);
    expect(protectedKey('sp_hyneria_0', used)).toBe(false);
    expect(protectedKey('inkbg_far_river', used)).toBe(false);
  });
});
