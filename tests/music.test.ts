import { describe, expect, it } from 'vitest';
import { followMood, musicalTension, OCEAN_MOTIFS, pianoPhrase, worldMusicMood } from '../src/audio/scoreMusic';

const player = { x: 1000, y: 400, hp: 100, maxHp: 100, power: 10, underwater: true };
const hunter = { x: 850, y: 400, dead: false, role: 'predator', power: 10, hunting: true };

describe('Adaptive piano', () => {
  it('warns about low health even when no animal is chasing', () => {
    const calm = worldMusicMood(player, [], 100, 1100);
    expect(calm.injury).toBe(0);
    expect(calm.threat).toBe(0);
    const hurt = worldMusicMood({ ...player, hp: 10 }, [], 100, 1100);
    expect(hurt.threat).toBe(0);
    expect(musicalTension(hurt)).toBeGreaterThan(0.75);
  });

  it('hears ordinary predators behind the fish and combines pursuit with injury', () => {
    const pursuit = worldMusicMood(player, [hunter], 100, 1100);
    const both = worldMusicMood({ ...player, hp: 10 }, [hunter], 100, 1100);
    expect(pursuit.threat).toBeGreaterThan(0.7);
    expect(musicalTension(both)).toBeGreaterThan(musicalTension(pursuit));
    expect(musicalTension(both)).toBeLessThanOrEqual(1);
  });

  it('ignores allies, dead animals, prey and distant pursuers', () => {
    const ignored = [
      { ...hunter, dead: true }, { ...hunter, ally: true }, { ...hunter, kin: true },
      { ...hunter, role: 'prey' }, { ...hunter, role: 'hazard' }, { ...hunter, x: -1000 },
      { ...hunter, hunting: false },
    ];
    expect(worldMusicMood(player, ignored, 100, 1100).threat).toBe(0);
  });

  it('adapts to physical water depth and returns to the surface sound on land', () => {
    const shallow = worldMusicMood(player, [], 100, 1100);
    const deep = worldMusicMood({ ...player, y: 1000 }, [], 100, 1100);
    expect(shallow.depth).toBeCloseTo(0.3);
    expect(deep.depth).toBeCloseTo(0.9);
    expect(worldMusicMood({ ...player, y: 1000, underwater: false }, [], 100, 1100).depth).toBe(0);
  });

  it('raises musical tension promptly and resolves it gradually without overshooting', () => {
    const calm = { depth: 0, threat: 0, injury: 0 }, danger = { depth: 1, threat: 1, injury: 1 };
    const rise = followMood(calm, danger, 1);
    expect(rise.threat).toBeGreaterThan(0.7);
    expect(rise.injury).toBeGreaterThan(0.75);
    expect(followMood(rise, calm, 1).threat).toBeGreaterThan(0.5);
    const settled = followMood(rise, calm, 60);
    expect(settled.threat).toBeLessThan(0.001);
    expect(settled.injury).toBeLessThan(0.001);
  });

  it('keeps the inherited melody, lowering its register in deep water', () => {
    const melody = [0, 2, 4, 6].flatMap((s) => pianoPhrase(0, s, 0, 'level').filter((n) => n.voice === 'melody').map((n) => n.midi));
    expect(melody).toEqual([...OCEAN_MOTIFS[0]]);
    const deep = pianoPhrase(0, 0, 1, 'level');
    expect(deep.find((n) => n.voice === 'melody')!.midi).toBe(OCEAN_MOTIFS[0][0] - 12);
    expect(deep.find((n) => n.voice === 'bass')!.midi).toBe(38);
  });
});
