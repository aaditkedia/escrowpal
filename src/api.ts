export async function rpc<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  const j = await r.json().catch(() => ({ error: 'Network error' }));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j as T;
}
export type Saved = { id: string; k: string; role: 'buyer' | 'seller'; title: string; savedAt: number };
export const saved = (): Saved[] => JSON.parse(localStorage.getItem('ep_deals') || '[]');
export function remember(s: Saved) { const all = saved().filter(x => !(x.id === s.id && x.role === s.role)); localStorage.setItem('ep_deals', JSON.stringify([s, ...all].slice(0, 50))); }
export const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
