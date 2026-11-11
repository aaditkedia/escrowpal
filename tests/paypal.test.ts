import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
beforeEach(()=>{vi.resetModules();vi.stubEnv('PAYPAL_CLIENT_ID','sandbox-client-test-fixture');vi.stubEnv('PAYPAL_CLIENT_SECRET','sandbox-secret-test-fixture');vi.stubEnv('PAYPAL_BASE','');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('PayPal sandbox adapter, mocked network',()=>{
  it('uses stable order and capture idempotency keys and final-capture semantics',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({access_token:'fake-oauth-token',expires_in:300})).mockResolvedValue(json({id:'FIXTURE-RESULT',status:'COMPLETED'}));vi.stubGlobal('fetch',fetcher);
    const pp=await import('../api/_lib/paypal');
    await pp.createOrder(123.45,'Website','milestone-001');await pp.createOrder(123.45,'Website','milestone-001');
    await pp.capture('AUTH-FIXTURE-001',61.73,'milestone-001');await pp.capture('AUTH-FIXTURE-001',61.73,'milestone-001');
    const calls=fetcher.mock.calls;expect(calls.every(c=>String(c[0]).startsWith('https://api-m.sandbox.paypal.com/'))).toBe(true);
    expect(calls[1][1].headers['PayPal-Request-Id']).toBe(calls[2][1].headers['PayPal-Request-Id']);
    expect(calls[3][1].headers['PayPal-Request-Id']).toBe(calls[4][1].headers['PayPal-Request-Id']);
    expect(JSON.parse(calls[3][1].body)).toEqual({amount:{currency_code:'USD',value:'61.73'},final_capture:true});
    expect(JSON.parse(calls[1][1].body).purchase_units[0].reference_id).toBe('milestone-001');
    expect(calls.filter(c=>String(c[0]).endsWith('/token'))).toHaveLength(1);
  });
  it('blocks a production endpoint override before any network call',async()=>{vi.stubEnv('PAYPAL_BASE','https://api-m.paypal.com');const f=vi.fn();vi.stubGlobal('fetch',f);const pp=await import('../api/_lib/paypal');await expect(pp.createOrder(10,'Design','milestone-001')).rejects.toThrow('Only the PayPal sandbox');expect(f).not.toHaveBeenCalled();});
  it('does not turn missing credentials or real identifiers into mock captures',async()=>{vi.stubEnv('PAYPAL_CLIENT_SECRET','');const f=vi.fn();vi.stubGlobal('fetch',f);const pp=await import('../api/_lib/paypal');expect(pp.paypalServer()).toBe(false);expect(pp.isMockAuth('REAL-AUTH-123')).toBe(false);expect(pp.isMockAuth('MOCK-123')).toBe(true);await expect(pp.capture('REAL-AUTH-123',10,'milestone-001')).rejects.toThrow('not configured');expect(f).not.toHaveBeenCalled();});
  it('masks vendor error bodies and does not automatically retry an uncertain write',async()=>{const f=vi.fn().mockResolvedValueOnce(json({access_token:'fake-token'})).mockResolvedValueOnce(json({debug_id:'private-vendor-detail'},503));vi.stubGlobal('fetch',f);const pp=await import('../api/_lib/paypal');await expect(pp.capture('AUTH-FIXTURE-001',10,'milestone-001')).rejects.toThrow('HTTP 503');expect(f).toHaveBeenCalledTimes(2);});
  it('rejects path injection in authorization identifiers',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);const pp=await import('../api/_lib/paypal');expect(()=>pp.voidAuth('../capture','key')).toThrow('Invalid PayPal identifier');expect(f).not.toHaveBeenCalled();});
});
