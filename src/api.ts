import type { Mediation, Verdict } from './shared/agent';
export type Role = 'buyer' | 'seller';
export type Config = { version: string; laya: boolean; llm: boolean; llmModel: string | null; paypalServer: boolean; paypalClientId: string | null; storage: string; sandboxOnly: true; automaticRelease: false };
export type MilestoneData = { id: string; idx: number; title: string; amount: number; criteria: string[]; dueDate: string | null; status: string; releasedAmount: number | null; captureId: string | null; verdict: Verdict | null; reviewDue: string | null; reviewOverdue: boolean };
export type DisputeData = { id: string; milestoneId: string; openedBy: string; reason: string; buyerResponse: string | null; sellerResponse: string | null; mediator: Mediation | null; buyerAccepts: number | null; sellerAccepts: number | null; resolution: string | null; proposalHash: string };
export type View = {
  role: Role; deal: { market?: {analysisId:string;sha256:string;fictional:boolean;selectedCandidate:string;decisionStatus:string;engine:string;budget:number;objective:string;stages:string[]} | null; id: string; title: string; description: string; total: number; status: string; buyerName: string; sellerName: string; buyerEmail?: string; sellerEmail?: string; inspectionDays: number; riskScore: number; risk: string[]; engine: string; demo: boolean; createdAt: string; buyerSignedAt: string | null; sellerSignedAt: string | null };
  milestones: MilestoneData[]; disputes: DisputeData[];
  evidence: { id: string; milestoneId: string; note: string; fileName: string | null; fileSize: number | null; createdAt: string }[];
  events: { id: number; role: string; kind: string; message: string; createdAt: string }[];
  counterpartyLink: string | null; config: Config;
};
export type Made = { id: string; buyerToken: string; sellerToken: string };
export async function rpc<T = View>(action: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, action }), signal });
  const j = await r.json().catch(() => ({ error: 'The server returned an unreadable response. Refresh before retrying.' }));
  if (!r.ok) throw new Error(j.error || 'The request could not finish.');
  return j as T;
}
export type Saved = { id: string; k: string; role: Role; title: string; savedAt: number; demo?: boolean };
export function saved(): Saved[] {
  try { const all: unknown = JSON.parse(localStorage.getItem('ep_deals') || '[]'); return Array.isArray(all) ? all.filter(s => typeof s?.id === 'string' && typeof s?.k === 'string' && ['buyer','seller'].includes(s.role) && typeof s?.title === 'string').slice(0, 50) : []; } catch { return []; }
}
export function remember(s: Saved) {
  try { localStorage.setItem('ep_deals', JSON.stringify([s, ...saved().filter(x => !(x.id === s.id && x.role === s.role))].slice(0, 50))); } catch { /* The private URL remains usable when device storage is unavailable. */ }
}
export async function createDemo() {
  const r = await rpc<Made>('demo'); const at = Date.now();
  remember({ id: r.id, k: r.buyerToken, role: 'buyer', title: 'Sweet Crumb · website launch', savedAt: at, demo: true });
  remember({ id: r.id, k: r.sellerToken, role: 'seller', title: 'Sweet Crumb · website launch', savedAt: at, demo: true });
  return '/d/' + r.id + '?k=' + r.buyerToken;
}
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
export const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Refresh before retrying.';
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
