import { describe,expect,it } from 'vitest';
import { wholeBite } from '../src/sim/feeding';

describe('Ein Biss verschluckt relativ schwache Beute',()=>{
  it('hängt von voller Lebenskraft und effektiver Bissstärke ab, nicht von einer festen Tierliste',()=>{
    expect(wholeBite(10,10)).toBe(true);expect(wholeBite(9.99,10)).toBe(false);
    expect(wholeBite(200,150)).toBe(true);expect(wholeBite(10,150)).toBe(false);
  });
  it('macht aus dem letzten Treffer auf einen verwundeten Riesen keinen Ein-Biss-Happen',()=>{
    const remaining=1,full=1000,damage=12;
    expect(damage>=remaining).toBe(true);expect(wholeBite(damage,full)).toBe(false);
  });
  it('akzeptiert keine ungültigen Schadens- oder Lebenswerte',()=>{
    expect(wholeBite(Infinity,10)).toBe(false);expect(wholeBite(10,0)).toBe(false);expect(wholeBite(NaN,10)).toBe(false);
  });
});
