const BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
export const paypalServer = () => !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
async function token() {
  const r = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  return ((await r.json()) as any).access_token as string;
}
async function call(path: string, body?: unknown) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.message || `PayPal ${r.status}`); return j;
}
export const createOrder = (amount: number, description: string, refId: string) => call('/v2/checkout/orders', { intent: 'AUTHORIZE', purchase_units: [{ reference_id: refId, description: description.slice(0, 120), amount: { currency_code: 'USD', value: amount.toFixed(2) } }] });
export const authorizeOrder = (orderId: string) => call(`/v2/checkout/orders/${orderId}/authorize`);
export const capture = (authId: string, amount: number) => call(`/v2/payments/authorizations/${authId}/capture`, { amount: { currency_code: 'USD', value: amount.toFixed(2) }, final_capture: true });
export const voidAuth = (authId: string) => call(`/v2/payments/authorizations/${authId}/void`);
export const isMockAuth = (id?: string | null) => !id || id.startsWith('MOCK-') || !paypalServer();
