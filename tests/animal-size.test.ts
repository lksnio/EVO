import { describe, expect, it } from 'vitest';
import { SPECIES } from '../src/data/species';
import { SPECIES_FACTS } from '../src/data/speciesFacts';
import { ENTRIES, entryOf } from '../src/data/aquapendium';
import { adultLengthCm, animalScale, MIN_ADULT_WORLD_LENGTH, PLAY_LENGTH_CM, playLengthCm, sizeBasis, spriteReferenceSpan, worldLength } from '../src/data/animalSize';

describe('biological reference and readable play scale', () => {
  it('every species has a biological reference and one finite display scale, independent of texture size', () => {
    expect(Object.keys(SPECIES_FACTS).sort()).toEqual(Object.keys(SPECIES).sort());
    for (const d of Object.values(SPECIES)) {
      expect(adultLengthCm(d)).toBeGreaterThan(0);
      expect(Number.isFinite(worldLength(d))).toBe(true);
      const span = spriteReferenceSpan(d, 200);
      expect(span * animalScale(d, span)).toBeCloseTo(worldLength(d));
    }
    for (const e of ENTRIES) expect(e.cm).toBe(adultLengthCm(e.def));
    for (const [id, cm] of Object.entries(PLAY_LENGTH_CM)) { expect(SPECIES[id]).toBeDefined(); expect(cm).toBeGreaterThan(0); }
    expect(() => adultLengthCm({ id: 'missing' })).toThrow();
  });

  it('uses the larger small specimen and the conservative giant without changing chronicle facts', () => {
    expect(adultLengthCm(SPECIES.moythomasia)).toBe(6);
    expect(playLengthCm(SPECIES.moythomasia)).toBe(10);
    expect(adultLengthCm(SPECIES.dunkleosteus)).toBe(410);
    expect(playLengthCm(SPECIES.dunkleosteus)).toBe(340);
    expect(playLengthCm(SPECIES.rhizodus)).toBe(600);
    expect(playLengthCm(SPECIES.mosasaurus)).toBe(1100);
    expect(playLengthCm(SPECIES.rolfosteus)).toBe(adultLengthCm(SPECIES.rolfosteus));
    expect(entryOf('dunkleosteus')?.cm).toBe(410);
    expect(entryOf('dunkleosteus')?.note).toContain('geschätzt');
  });

  it('keeps tiny adults visible at ordinary zoom and even the largest animal larger than before', () => {
    for (const d of Object.values(SPECIES)) {
      expect(worldLength(d)).toBeGreaterThanOrEqual(MIN_ADULT_WORLD_LENGTH);
      // Smallest normal individual, with the actual play zoom; juveniles still get at least eight pixels.
      expect(worldLength(d, .86) * .72).toBeGreaterThanOrEqual(14);
      expect(worldLength(d, .86 * .55) * .72).toBeGreaterThanOrEqual(8);
    }
    expect(worldLength(SPECIES.moythomasia, .86) * .72).toBeGreaterThan(20);
    expect(worldLength(SPECIES.dunkleosteus)).toBeGreaterThan(410);
    expect(worldLength(SPECIES.mosasaurus)).toBeGreaterThan(1500);
  });

  it('compresses the old 250:1 span while preserving size order and individual growth', () => {
    const ordered = Object.values(SPECIES).sort((a, b) => playLengthCm(a) - playLengthCm(b));
    for (let i = 1; i < ordered.length; i++) expect(worldLength(ordered[i])).toBeGreaterThanOrEqual(worldLength(ordered[i - 1]));
    expect(worldLength(SPECIES.rhizodus) / worldLength(SPECIES.moythomasia)).toBeLessThan(40);
    expect(worldLength(SPECIES.mosasaurus) / worldLength(SPECIES.moythomasia)).toBeLessThan(100);
    expect(worldLength(SPECIES.rhizodus, .55)).toBeCloseTo(worldLength(SPECIES.rhizodus) * .55);
  });

  it('keeps the same play length when a sprite is redrawn at another resolution', () => {
    const d = SPECIES.hyneria;
    for (const resolution of [90, 360, 1440]) {
      const span = spriteReferenceSpan(d, resolution);
      expect(span * animalScale(d, span)).toBeCloseTo(worldLength(d));
    }
  });

  it('measures shell and bell sizes independently of tentacles and transparent glow', () => {
    expect(sizeBasis(SPECIES.qualle)).toBe('bell-diameter');
    expect(spriteReferenceSpan(SPECIES.qualle, 80)).toBe(spriteReferenceSpan(SPECIES.qualle, 400));
    expect(sizeBasis(SPECIES.ammonit)).toBe('shell-diameter');
    expect(sizeBasis(SPECIES.orthoceras)).toBe('shell-length');
    expect(sizeBasis(SPECIES.trigonotarbid)).toBe('body');
  });
});
