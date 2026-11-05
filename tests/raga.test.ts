import { describe, expect, it } from 'vitest';
import { parse, SECTIONS, SWARA, upper } from '../src/audio/RagaScore';

// Die Alapana des Laichflusses bleibt im Raga Neelambari: nur seine Töne, Dha nur im Umweg Pa–Dha–Pa, und sie endet
// immer auf dem Grundton.

const scale = new Set(Object.values(SWARA));
const tones = (p: ReturnType<typeof parse>) => p.tones.filter((t): t is { semi: number; beats: number; gamaka: 'plain' } => 'semi' in t);
const within = (semi: number) => ((semi % 12) + 12) % 12;

describe('Raga Neelambari', () => {
  it('liest die Swara-Schrift', () => {
    const p = parse('S R ~G:3 *N_ /S^:2 -:2');
    expect(p.tones).toEqual([
      { semi: 0, beats: 1, gamaka: 'plain' },
      { semi: 2, beats: 1, gamaka: 'plain' },
      { semi: 4, beats: 3, gamaka: 'kampita' },
      { semi: -1, beats: 1, gamaka: 'nokku' },
      { semi: 12, beats: 2, gamaka: 'jaru' },
      { rest: 2 },
    ]);
    expect(() => parse('X')).toThrow();
  });

  it('schwingt zum oberen Nachbarn im Raga', () => {
    expect(upper(0)).toBe(2);
    expect(upper(4)).toBe(5);
    expect(upper(11)).toBe(12);
    expect(upper(-1)).toBe(0);
  });

  it('bleibt in seinen Tönen, nimmt Dha nur zwischen zwei Pa und endet auf Sa', () => {
    for (const sec of SECTIONS) {
      for (const p of sec.phrases) {
        const ts = tones(p);
        ts.forEach((t, i) => {
          expect(scale.has(within(t.semi))).toBe(true);
          if (within(t.semi) === SWARA.D) {
            expect(within(ts[i - 1].semi)).toBe(SWARA.P);
            expect(within(ts[i + 1].semi)).toBe(SWARA.P);
          }
        });
        expect(Math.abs(ts[0].semi)).toBeLessThanOrEqual(12);
      }
    }
    for (const p of SECTIONS[SECTIONS.length - 1].phrases) expect(within(tones(p).at(-1)!.semi)).toBe(SWARA.S);
  });

  it('steigt vom tiefen Teil bis zum hohen Sa', () => {
    const top = (i: number) => Math.max(...SECTIONS[i].phrases.flatMap(p => tones(p).map(t => t.semi)));
    expect(top(0)).toBeLessThan(top(2));
    expect(top(2)).toBeGreaterThanOrEqual(12);
  });
});
