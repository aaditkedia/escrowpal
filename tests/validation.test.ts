import { describe,it,expect } from 'vitest';
import { allocateCents,dollars,percent,planInput } from '../src/shared/validation';
describe('payment input boundaries',()=>{
  it.each([0,-1,1.005,NaN,Infinity,1000000.01])('rejects invalid dollar amount %s',n=>expect(dollars.safeParse(n).success).toBe(false));
  it('accepts valid whole cents without rejecting floating-point representations',()=>{for(const n of [.01,.1,.29,1200.01,1000000])expect(dollars.safeParse(n).success).toBe(true);});
  it.each([-1,101,1.5,NaN,'50'])('rejects an invalid settlement percentage %s',n=>expect(percent.safeParse(n).success).toBe(false));
  it('preserves the exact budget when three shares do not divide into cents',()=>{expect(allocateCents([1,1,1],10)).toEqual([3.34,3.33,3.33]);expect(allocateCents([2,3,5],123.45).reduce((n,v)=>n+Math.round(v*100),0)).toBe(12345);});
  it('rejects allocations too small to fund each milestone',()=>{expect(()=>allocateCents([1,1,1],.02)).toThrow();expect(()=>allocateCents([1,0],10)).toThrow();});
  it('rejects blank criteria, missing milestones, and oversized plans',()=>{const m={title:'Design',amount:10,criteria:['Mobile layout']};for(const milestones of [[],[{...m,criteria:['']}],Array.from({length:9},()=>m)])expect(planInput.safeParse({title:'Design',milestones}).success).toBe(false);});
});
