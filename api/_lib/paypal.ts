const BASE = 'https://api-m.sandbox.paypal.com';
export const paypalServer = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
let cached: { token: string; until: number } | undefined;
async function token() {
  if (!paypalServer()) throw new Error('PayPal sandbox credentials are not configured.');
  if (process.env.PAYPAL_BASE && process.env.PAYPAL_BASE !== BASE) throw new Error('Only the PayPal sandbox endpoint is enabled.');
  if (cached && cached.until > Date.now()) return cached.token;
  const r = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { authorization: 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await r.json() as any;
  if (!r.ok || typeof data.access_token !== 'string') throw new Error('PayPal sandbox authentication failed.');
  cached = { token: data.access_token, until: Date.now() + Math.max(30, Number(data.expires_in || 300) - 30) * 1000 };
  return cached.token;
}
async function call(path: string, requestId: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json', 'PayPal-Request-Id': requestId },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({})) as any;
  if (!r.ok) throw new Error('PayPal sandbox returned HTTP ' + r.status + '. Reconcile the operation before retrying.');
  return data;
}
const safe = (s: string) => { if (!/^[A-Za-z0-9-]{5,64}$/.test(s)) throw new Error('Invalid PayPal identifier.'); return s; };
export const createOrder = (amount: number, description: string, refId: string, contextId?: string) =>
  call('/v2/checkout/orders', 'ep-order-' + refId, { intent: 'AUTHORIZE', purchase_units: [{ reference_id: refId, ...(contextId ? { custom_id: contextId.slice(0, 127) } : {}), description: description.slice(0, 120), amount: { currency_code: 'USD', value: amount.toFixed(2) } }] });
export const authorizeOrder = (orderId: string) => call('/v2/checkout/orders/' + safe(orderId) + '/authorize', 'ep-auth-' + orderId);
export const capture = (authId: string, amount: number, key: string) =>
  call('/v2/payments/authorizations/' + safe(authId) + '/capture', 'ep-capture-' + key, { amount: { currency_code: 'USD', value: amount.toFixed(2) }, final_capture: true });
export const voidAuth = (authId: string, key: string) => call('/v2/payments/authorizations/' + safe(authId) + '/void', 'ep-void-' + key);
export const isMockAuth = (id?: string | null) => Boolean(id?.startsWith('MOCK-'));
