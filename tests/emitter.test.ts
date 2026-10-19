import { describe, expect, it } from 'vitest';
import { Emitter } from '../src/util/emitter';

describe('Ereignis-Verteiler', () => {
  it('ruft Empfänger auf, entfernt sie wieder und kennt once', () => {
    const e = new Emitter();
    const got: number[] = [];
    const fn = (n: number) => got.push(n);
    e.on('x', fn);
    e.once('x', (n: number) => got.push(n * 10));
    e.emit('x', 1);
    e.emit('x', 2);
    e.off('x', fn);
    expect(e.emit('x', 3)).toBe(false);
    expect(got).toEqual([1, 10, 2]);
  });
});
