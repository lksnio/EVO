import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LINEAGE_FORMS } from '../src/sim/lineageEvolution';
import { LINEAGE_FORM_IDS, LINEAGE_ORIGIN, LINEAGE_REGISTRATION, LINEAGE_WIDTH, lineageHasLegs, lineageRegistration } from '../src/art/lineage/forms';
import { lineageBinding, lineagePoint, type LineagePose } from '../src/art/lineage/motion';
import { layoutOf, morphKey, quantize, type Morph } from '../src/art/creatureArt';

vi.mock('phaser', () => ({ default: {} }));

const pose = (over: Partial<LineagePose> = {}): LineagePose => ({
  phase: 0, finPhase: 0, speed: 0, still: 0, pitch: 0, bob: 0, lunge: 0, opening: 0, mode: 'swim', ...over,
});
const distance = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.hypot(a.x-b.x, a.y-b.y);
const morph = (lineageForm: Morph['lineageForm'], size = 1): Morph => ({ cls: 'fish', lineageForm, size,
  jaw: 0, skull: 0, stealth: 0, diet: 0, scars: 0, belly: 0, fierce: 0, hue: 0, seed: 7 });

describe('Approved shoreline lineage paintings', () => {
  it('has runtime artwork for every reachable body and weapon milestone', () => {
    expect(new Set(LINEAGE_FORM_IDS)).toEqual(new Set(LINEAGE_FORMS));
    expect(LINEAGE_REGISTRATION).toHaveLength(LINEAGE_FORMS.length);
    expect(new Set(LINEAGE_FORM_IDS.map(id => morphKey(morph(id)))).size).toBe(LINEAGE_FORMS.length);
    for (const id of LINEAGE_FORM_IDS) {
      const r = lineageRegistration(id), source = readFileSync(r.source);
      expect(createHash('sha256').update(source).digest('hex')).toBe(r.sourceSha256);
      expect(existsSync(`src/assets/lineage/${id}.webp`)).toBe(true);
      expect(quantize(morph(id)).lineageForm).toBe(id);
      expect(r.upperLip[0]).toEqual(r.hinge);
      expect(r.upperLip.at(-1)![0]).toBeGreaterThan(r.hinge[0]);
      expect(r.lowerLip.at(-1)![0]).toBeGreaterThan(r.hinge[0]);
      for (const tooth of r.teeth) expect(tooth.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses the user-reclassified jaw-one fish and the stronger final fang painting', () => {
    expect(lineageRegistration('water-bite-1').source).toContain('bite_tier2_v3/');
    expect(lineageRegistration('water-bite-2').source).toContain('bite_tier2_v4/');
    expect(lineageRegistration('shore-skull-1').source).toContain('skull_tier1_v2/');
    expect(lineageRegistration('transition').source).toContain('shortlegs');
  });

  it('registers the real eyes above the jaw, including the fang paintings', () => {
    for (const r of LINEAGE_REGISTRATION) {
      expect(r.eye[0]).toBeGreaterThan(.86);
      expect(r.eye[0]).toBeLessThan(.93);
      expect(r.eye[1]).toBeLessThan(r.hinge[1]-.07);
      expect(r.eye[2]).toBeGreaterThan(.004);
      expect(r.eye[2]).toBeLessThan(.016);
    }
    expect(lineageRegistration('transition').eye[0]).toBeGreaterThan(.90);
    expect(lineageRegistration('water-bite-2').eye[1]).toBeLessThan(.42);
  });

  it('uses the painted land layout despite the shared fish class and keeps adult collision stable', () => {
    for (const id of LINEAGE_FORM_IDS) {
      const a = layoutOf(morph(id)), b = layoutOf(morph(id, 1.4));
      expect(a.land).toBe(lineageHasLegs(id));
      expect(a.halfW).toBe(34);
      expect(a.bh).toBe(24);
      expect(b.halfW/a.halfW).toBeCloseTo(1.4);
      expect(b.footY/a.footY).toBeCloseTo(1.4);
      expect(b.bite.w/a.bite.w).toBeCloseTo(1.4);
      expect(a.bite.w).toBeGreaterThan(20);
      expect(a.topY).toBeLessThan(0);
    }
  });
});

describe('Rigid lineage animation', () => {
  it.each(LINEAGE_FORM_IDS)('keeps the trunk, eye and skull rigid while appendages move: %s', id => {
    const r = lineageRegistration(id), points = [[.48,.43],[.55,.54],[.65,.43],[.81,.46],[r.eye[0],r.eye[1]]];
    for (const [u,v] of points) expect(lineageBinding(u,v,id).kind).toBe('body');
    for (let frame=0; frame<35; frame++) {
      const p = pose({ phase: frame*.3, finPhase:frame*.71, speed:frame%3*.7, pitch:Math.sin(frame)*.25,
        bob:Math.sin(frame)*.2, lunge:Math.cos(frame)*3, opening:frame*.02, mode:lineageHasLegs(id)?'walk':'swim' });
      for (let i=1; i<points.length; i++) {
        const [u0,v0]=points[i-1], [u1,v1]=points[i], height=LINEAGE_WIDTH*r.height/r.width;
        const a=lineagePoint(u0,v0,r,p,lineageBinding(u0,v0,id)), b=lineagePoint(u1,v1,r,p,lineageBinding(u1,v1,id));
        expect(distance(a,b)).toBeCloseTo(Math.hypot((u1-u0)*LINEAGE_WIDTH,(v1-v0)*height),8);
      }
    }
  });

  it('paddles fins independently and rotates the tail without stretching its tip', () => {
    const r=lineageRegistration('water'), a=pose(), b=pose({finPhase:1.5,speed:1});
    const fin=lineageBinding(.68,.70,'water');
    expect(fin.kind).toBe('fin');
    expect(lineageBinding(.33,.26,'water').kind).toBe('fin');
    expect(distance(lineagePoint(.68,.70,r,a,fin),lineagePoint(.68,.70,r,b,fin))).toBeGreaterThan(.3);
    expect(lineageBinding(.64,.75,'water').kind).toBe('body');
    expect(lineageBinding(.73,.77,'water').kind).toBe('body');
    expect(lineageBinding(.60,.75,'water-bite-2').kind).toBe('body');
    const p=pose({phase:1.5,speed:1}), tip0=[.10,.45], tip1=[.15,.62];
    const bind0=lineageBinding(...tip0 as [number,number],'water'), bind1=lineageBinding(...tip1 as [number,number],'water');
    expect(bind0.weight).toBe(1); expect(bind1.weight).toBe(1);
    expect(distance(lineagePoint(tip0[0],tip0[1],r,p,bind0),lineagePoint(tip1[0],tip1[1],r,p,bind1)))
      .toBeCloseTo(Math.hypot((tip1[0]-tip0[0])*LINEAGE_WIDTH,(tip1[1]-tip0[1])*LINEAGE_WIDTH*r.height/r.width),8);
  });

  it('moves all four feet, including the far hind foot beside the tail', () => {
    for (const id of ['transition','shore','shore-bite-2'] as const) {
      const r=lineageRegistration(id), shift=id==='shore-bite-2'?-.045:0;
      const feet=id==='transition'?[[.69,.73],[.42,.73],[.757,.67],[.38,.66]]:[[.72+shift,.87],[.43+shift,.87],[.80+shift,.77],[.34+shift,.73]];
      const phases:number[]=[];
      for (const [u,v] of feet) {
        const binding=lineageBinding(u,v,id); expect(binding.kind).toBe('limb'); phases.push(binding.phase!);
        expect(distance(lineagePoint(u,v,r,pose({mode:'walk',phase:0,speed:1}),binding),
          lineagePoint(u,v,r,pose({mode:'walk',phase:1.5,speed:1}),binding))).toBeGreaterThan(.05);
      }
      expect(phases.filter(p=>p===0)).toHaveLength(2);
      expect(phases.filter(p=>p===Math.PI)).toHaveLength(2);
    }
  });

  it.each(LINEAGE_FORM_IDS)('opens only the lower jaw around its registered joint: %s', id => {
    const r=lineageRegistration(id), closed=pose({pitch:.2,lunge:2,bob:.1}), open=pose({...closed,opening:.4});
    const [u,v]=r.hinge, point=r.lowerLip.at(-1)!;
    expect(lineagePoint(u,v,r,open,undefined,true)).toEqual(lineagePoint(u,v,r,open));
    expect(lineagePoint(r.eye[0],r.eye[1],r,open)).toEqual(lineagePoint(r.eye[0],r.eye[1],r,closed));
    expect(distance(lineagePoint(point[0],point[1],r,open,undefined,true),lineagePoint(point[0],point[1],r,closed,undefined,true))).toBeGreaterThan(5);
    expect(distance(lineagePoint(point[0],point[1],r,open,undefined,true),lineagePoint(u,v,r,open)))
      .toBeCloseTo(distance(lineagePoint(point[0],point[1],r,closed,undefined,true),lineagePoint(u,v,r,closed)),8);
    const origin=lineagePoint(LINEAGE_ORIGIN[0],LINEAGE_ORIGIN[1],r,pose());
    expect(origin.x).toBe(0); expect(origin.y).toBe(0);
  });
});
