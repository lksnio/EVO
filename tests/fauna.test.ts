import { describe, expect, it, vi } from 'vitest';
import { EPOCHS, epochSpecies } from '../src/data/epochs';
import { SPECIES } from '../src/data/species';
import { speciesAnatomy, rayRegistration } from '../src/art/fauna/fish';
import { solveSpine, type SpineIn } from '../src/art/fish/spine';

vi.mock('phaser', () => ({ default: {} }));

const ids = [...new Set([...epochSpecies(EPOCHS.find(e => e.id === 'devon')!), 'rhizodus', 'gillicus', 'enchodus', 'protosphyraena', 'xiphactinus'])]
  .filter(id => SPECIES[id].art.t === 'fish');

describe('Devon fauna anatomy', () => {
  it.each(ids)('%s: bounded silhouette and finite attachments without mutating the species', id => {
    const def = SPECIES[id], before = JSON.stringify(def);
    const a = speciesAnatomy(def);
    for (const n of [a.bw, a.bh, a.jawLen, a.jawH, a.eye.x, a.eye.y, ...Object.values(a.bounds), ...a.loop.flat()]) expect(Number.isFinite(n)).toBe(true);
    for (const fin of [a.dorsal, a.anal, a.pelvic, a.pectoral, ...(a.dorsal2 ? [a.dorsal2] : [])]) {
      expect(fin.at[0]).toBeGreaterThan(a.bounds.x0);
      expect(fin.at[0]).toBeLessThan(a.bounds.x1);
      expect(fin.len).toBeGreaterThan(0);
    }
    expect(a.jawLen).toBeGreaterThan(0);
    expect(a.bounds.x1).toBeGreaterThan(a.bounds.x0);
    expect(JSON.stringify(def)).toBe(before);
  });

  it('registered rayfins preserve aspect ratio and their sloping upper lip', () => {
    for (const id of ['cheirolepis', 'moythomasia', 'gillicus']) {
      const a = speciesAnatomy(SPECIES[id]), r = rayRegistration(id)!;
      const k = 100 / (r.bounds[2] - r.bounds[0]);
      expect(a.tip[0] - a.hinge[0]).toBeCloseTo((r.points.upperLip[0] - r.points.jawHinge[0]) * k);
      expect(a.jawRest).toBeCloseTo(Math.atan2(a.tip[1] - a.hinge[1], a.tip[0] - a.hinge[0]));
    }
  });

  it('has distinct shark, lobe, shield and boss anatomy', () => {
    expect(speciesAnatomy(SPECIES.stethacanthus).dorsal.shape).toBe('anvil');
    expect(speciesAnatomy(SPECIES.cladoselache).dorsal2).toBeDefined();
    expect(speciesAnatomy(SPECIES.hyneria).pectoral.lobed).toBe(true);
    expect(speciesAnatomy(SPECIES.rhizodus).tail.kind).toBe('lobed');
    const shield = speciesAnatomy(SPECIES.cephalaspis);
    expect(shield.jawless).toBe(true);
    expect(shield.rigidFrom).toBeLessThan(shield.hx);
    const dunk = speciesAnatomy(SPECIES.dunkleosteus);
    expect(dunk.teeth).toBe('blades');
    expect(dunk.rigidFrom).toBeDefined();
  });
});

describe('rigid anterior body under extreme poses', () => {
  it.each([0, 0.4, 1.2, 2.8])('preserves every armored segment at phase %s', ph => {
    const colX = new Float32Array([-60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40]);
    const n = colX.length, x = new Float32Array(n), y = new Float32Array(n), angle = new Float32Array(n);
    const i: SpineIn = { colX, xa: -10, Ls: 50, amp: 22, kw: 0.1, ph, pw: 1.8, bw: 80, coil: 1, pitch: 0.35,
      neckEnd: 20, lungeDx: 8, bob: 1, reach: new Float32Array(n).fill(20), rigidFrom: 0 };
    solveSpine(i, x, y, angle);
    for (let k = 6; k < n - 1; k++) {
      expect(angle[k]).toBeCloseTo(i.pitch);
      expect(Math.hypot(x[k + 1] - x[k], y[k + 1] - y[k])).toBeCloseTo(10, 4);
    }
    // The protected front remains rigid while the rear continues to undulate.
    expect(Math.abs(angle[1] - angle[2])).toBeGreaterThan(0.001);
  });
});
