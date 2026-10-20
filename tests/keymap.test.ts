import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BINDS, DEFAULT_KEYS, ESC, bindOf, capture, isDefault, keyLabel, keyName, keysOf, keysText, loadKeys, matches, onKeysChanged, resetKeys, setKey } from '../src/state/keymap';

// Die Tastenbelegung: frei wählbar, jede Taste gehört nur einer Handlung, Esc bleibt fest – und sie wird gemerkt.

describe('Tastenbelegung', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    resetKeys();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    capture.on = false;
  });

  it('die Grundbelegung: Pfeiltasten schwimmen, E beißt, F spricht an – keine Taste doppelt', () => {
    expect(isDefault()).toBe(true);
    expect(keyLabel('bite')).toBe('E');
    expect(keysText('sprint')).toBe('W oder Shift');
    expect(keyLabel('left')).toBe('←');
    const all = BINDS.flatMap((b) => [...DEFAULT_KEYS[b.id]]);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(ESC);
  });

  it('eine neue Taste nimmt sie der alten Handlung weg', () => {
    // R (Stoß) wird zum Beißen
    expect(setKey('bite', 0, 82)).toBe('ram');
    expect(keysOf('bite')).toEqual([82, 81]);
    expect(keysOf('ram')).toEqual([]);
    expect(bindOf(82)).toBe('bite');
    expect(keyLabel('ram')).toBe('–');
    expect(isDefault()).toBe(false);
  });

  it('Zweittaste setzen, leeren, tauschen – Esc lässt sich nicht vergeben', () => {
    setKey('ram', 1, 84);
    expect(keysOf('ram')).toEqual([82, 84]);
    // die eigene Zweittaste als Haupttaste: getauscht
    setKey('ram', 0, 84);
    expect(keysOf('ram')).toEqual([84, 82]);
    setKey('ram', 1, null);
    expect(keysOf('ram')).toEqual([84]);
    setKey('ram', 0, ESC);
    expect(keysOf('ram')).toEqual([84]);
  });

  it('wird gemerkt und wieder geladen; beim Neubelegen wirkt keine Taste', () => {
    let calls = 0;
    const off = onKeysChanged(() => calls++);
    setKey('call', 0, 71);
    off();
    expect(calls).toBe(1);
    expect(JSON.parse(store.get('evo-keys-v1')!).call).toEqual([71]);
    loadKeys();
    expect(keysOf('call')).toEqual([71]);
    expect(matches('call', { keyCode: 71 })).toBe(true);
    capture.on = true;
    expect(matches('call', { keyCode: 71 })).toBe(false);
    expect(keyName(112)).toBe('F1');
    expect(keyName(32)).toBe('Leertaste');
  });
});
