// Vercel serverless: server-side PayPal Orders v2 (sandbox). Needs PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET.
// actions: create (intent AUTHORIZE = funds held), capture (release, full or partial), void (refund hold).
const BASE = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
async function token() {
  const id = process.env.PAYPAL_CLIENT_ID, sec = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !sec) return null;
  const r = await fetch(`${BASE}/v1/oauth2/token`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  return (await r.json()).access_token as string;
}
export default async function handler(req: any, res: any) {
  const t = await token();
  if (!t) return res.status(501).json({ error: 'PayPal server credentials not configured' });
  const h = { authorization: `Bearer ${t}`, 'content-type': 'application/json' };
  const { action, amount, description, authorizationId, orderId } = req.body || {};
  let r: Response;
  if (action === 'create') r = await fetch(`${BASE}/v2/checkout/orders`, { method: 'POST', headers: h, body: JSON.stringify({ intent: 'AUTHORIZE', purchase_units: [{ description, amount: { currency_code: 'USD', value: Number(amount).toFixed(2) } }] }) });
  else if (action === 'authorize') r = await fetch(`${BASE}/v2/checkout/orders/${orderId}/authorize`, { method: 'POST', headers: h });
  else if (action === 'capture') r = await fetch(`${BASE}/v2/payments/authorizations/${authorizationId}/capture`, { method: 'POST', headers: h, body: JSON.stringify(amount ? { amount: { currency_code: 'USD', value: Number(amount).toFixed(2) }, final_capture: true } : {}) });
  else if (action === 'void') r = await fetch(`${BASE}/v2/payments/authorizations/${authorizationId}/void`, { method: 'POST', headers: h });
  else return res.status(400).json({ error: 'unknown action' });
  return res.status(r.status).json(await r.json().catch(() => ({})));
}
