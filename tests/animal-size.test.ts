import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/data/species';
import { SPECIES_FACTS } from '../src/data/speciesFacts';
import { ENTRIES, entryOf } from '../src/data/aquapendium';
import { adultLengthCm, animalScale, sizeBasis, spriteReferenceSpan, worldLength, WORLD_PX_PER_CM } from '../src/data/animalSize';

describe('biological size shared by the world and the chronicle', () => {
  it('every animal has one finite, positive biological reference; no silent placeholder lengths', () => {
    expect(Object.keys(SPECIES_FACTS).sort()).toEqual(Object.keys(SPECIES).sort());
    for (const d of Object.values(SPECIES)) {
      expect(adultLengthCm(d)).toBeGreaterThan(0);
      expect(Number.isFinite(worldLength(d))).toBe(true);
      const span = spriteReferenceSpan(d, 200);
      expect(span).toBeGreaterThan(0);
      expect(span * animalScale(d, span)).toBeCloseTo(SPECIES_FACTS[d.id].cm * WORLD_PX_PER_CM);
    }
    for (const e of ENTRIES) expect(e.cm).toBe(adultLengthCm(e.def));
    expect(() => adultLengthCm({ id: 'missing' })).toThrow();
  });

  it('keeps a 6 cm fish, a 1.8 m shark and a 7 m rhizodont in their actual linear ratios', () => {
    expect(worldLength(SPECIES.moythomasia)).toBe(6);
    expect(worldLength(SPECIES.cladoselache)).toBe(180);
    expect(worldLength(SPECIES.rhizodus)).toBe(700);
    expect(worldLength(SPECIES.cladoselache) / worldLength(SPECIES.moythomasia)).toBe(30);
    expect(worldLength(SPECIES.rhizodus) / worldLength(SPECIES.moythomasia)).toBeCloseTo(116.6666667);
    expect(worldLength(SPECIES.rhizodus, .55)).toBeCloseTo(385);
  });

  it('keeps the same physical length when the sprite is redrawn at another resolution', () => {
    const d = SPECIES.hyneria;
    for (const resolution of [90, 360, 1440]) {
      const span = spriteReferenceSpan(d, resolution);
      expect(span * animalScale(d, span)).toBeCloseTo(280);
    }
    expect(SPECIES.hyneria.hp).toBeGreaterThan(0);
  });

  it('measures shell and bell sizes independently of their tentacles and transparent glow', () => {
    const jelly = SPECIES.qualle;
    expect(sizeBasis(jelly)).toBe('bell-diameter');
    expect(spriteReferenceSpan(jelly, 80)).toBe(spriteReferenceSpan(jelly, 400));
    expect(sizeBasis(SPECIES.ammonit)).toBe('shell-diameter');
    expect(sizeBasis(SPECIES.orthoceras)).toBe('shell-length');
    expect(sizeBasis(SPECIES.trigonotarbid)).toBe('body');
  });

  it('uses the newer Dunkleosteus reconstruction in both the world and the chronicle', () => {
    expect(adultLengthCm(SPECIES.dunkleosteus)).toBe(410);
    expect(entryOf('dunkleosteus')?.cm).toBe(410);
    expect(entryOf('dunkleosteus')?.note).toContain('geschätzt');
  });
});
