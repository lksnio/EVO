import { describe, expect, it } from 'vitest';
import { EPOCHS } from '../src/data/epochs';
import { placesOf } from '../src/data/world';
import { gradeAnimal, grade, inkOn, inkWorldOn, setInkWorld, withInk } from '../src/art/ink';
import { MOODS, moodOf } from '../src/art/inkWorld';
import { isInkSpecies } from '../src/art/speciesArt';

// Der Tuschestil gilt nur für das Devon: Schalter, Stimmungen der drei Orte, welche Tiere dazugehören.

describe('Tuschestil (Devon)', () => {
  it('ist nur an, solange withInk läuft – und stellt den alten Zustand wieder her', () => {
    expect(inkOn()).toBe(false);
    withInk(true, () => {
      expect(inkOn()).toBe(true);
      withInk(false, () => expect(inkOn()).toBe(false));
      expect(inkOn()).toBe(true);
    });
    expect(inkOn()).toBe(false);
    // auch nach einem Fehler
    expect(() => withInk(true, () => { throw new Error('x'); })).toThrow();
    expect(inkOn()).toBe(false);
    setInkWorld(true);
    expect(inkWorldOn()).toBe(true);
    setInkWorld(false);
    expect(inkWorldOn()).toBe(false);
  });

  it('gibt jedem Ort des Devons seine eigene Stimmung', () => {
    const devon = EPOCHS.find((e) => e.id === 'devon')!;
    const moods = placesOf(devon).map(moodOf);
    expect(moods).toEqual(['river', 'garden', 'valley']);
    const luma = (c: number) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
    // der Laichfluss ist hell, das Tiefental dunkel; die Ebenen werden nach vorn dunkler (fern blass, nah fast schwarz)
    expect(luma(MOODS.river.sky[0])).toBeGreaterThan(luma(MOODS.garden.sky[0]));
    expect(luma(MOODS.garden.sky[0])).toBeGreaterThan(luma(MOODS.valley.sky[0]));
    for (const m of Object.values(MOODS)) {
      expect(luma(m.far)).toBeGreaterThan(luma(m.mid));
      expect(luma(m.mid)).toBeGreaterThan(luma(m.near));
    }
  });

  it('rückt Farben ins Wasser; Tiere bleiben die hellsten Flächen', () => {
    const c = 0x8a6a40;
    const luma = (v: number) => 0.3 * ((v >> 16) & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255);
    expect(grade(c)).not.toBe(c);
    expect(luma(gradeAnimal(c))).toBeGreaterThan(luma(grade(c)));
  });

  it('malt nur die Tiere des Devons (und nicht die des Karbons) im Tuschestil', () => {
    for (const id of ['cladoselache', 'dunkleosteus', 'trilobit', 'qualle', 'seeskorpion']) expect(isInkSpecies(id)).toBe(true);
    for (const id of ['rhizodus', 'pulmonoscorpius', 'megalichthys', 'mosasaurus', 'elasmosaurus']) expect(isInkSpecies(id)).toBe(false);
  });
});
