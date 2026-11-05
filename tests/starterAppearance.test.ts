import { describe, expect, it, vi } from 'vitest';
import { starterInkColor } from '../src/art/fish/starterAppearance';
vi.mock('phaser',()=>({default:{}}));
const rgb=(c:number)=>[c>>>16&255,c>>>8&255,c&255];
const lum=(c:number)=>{const [r,g,b]=rgb(c);return .3*r+.59*g+.11*b;};

describe('Gemeinsame Tuschewirkung der eigenen Fische',()=>{
  it('erhält dunkle Konturen und Zeichendetails, während silbrige Glanzlichter maßvoll zurücktreten',()=>{
    for(const c of [0x06090c,0x10151a,0x202020])expect(starterInkColor(c)).toBe(c);
    expect(lum(starterInkColor(0xf0f0f0))).toBeLessThan(220);
    expect(lum(starterInkColor(0x888888))).toBeGreaterThan(120);
    const values=Array.from({length:256},(_,v)=>lum(starterInkColor(v<<16|v<<8|v)));
    for(let i=1;i<values.length;i++)expect(values[i]).toBeGreaterThanOrEqual(values[i-1]);
  });
  it('bewahrt kühle Haut, warme Flossen und die Abstufungen dunkler Schuppen statt alles einheitlich einzufärben',()=>{
    const skin=rgb(starterInkColor(0x68748c)),fin=rgb(starterInkColor(0xe6dbb1));
    expect(skin[2]).toBeGreaterThan(skin[0]);expect(fin[0]).toBeGreaterThan(fin[2]);
    const colors=[0x394955,0x68748c,0xa4b0bd].map(starterInkColor);
    expect(lum(colors[0])).toBeLessThan(lum(colors[1]));expect(lum(colors[1])).toBeLessThan(lum(colors[2]));
  });
});
