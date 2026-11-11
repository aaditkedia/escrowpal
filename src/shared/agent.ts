// Shared deterministic agent logic (runs in browser and serverless). LLM wrappers live in api/_lib/llm.ts.
export type Criteria = string[];
export type PlanMilestone = { title: string; amount: number; criteria: Criteria; dueInDays?: number };
export type Plan = { title: string; total: number; milestones: PlanMilestone[]; risk: string[]; riskScore: number; engine: string };
export type Verdict = { met: string[]; missing: string[]; releasePct: number; recommendation: 'release' | 'partial' | 'revise'; reasoning: string; engine: string; injectionFlag?: boolean };
export type Mediation = { summary: string; buyerPosition: string; sellerPosition: string; proposedReleasePct: number; rationale: string; engine: string };

const STOP = new Set('the a an and or of for to with in on my our your page site app that this it be is are will should from into have has need needs want wants plus also more than about'.split(' '));
export const keywords = (s: string) => [...new Set(s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])].filter(w => !STOP.has(w));
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseAmount(text: string): number {
  const m = text.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?|([\d,]+(?:\.\d+)?)\s?(k)?\s?(?:usd|dollars)/i);
  if (!m) return 500;
  const n = Number((m[1] || m[3]).replace(/,/g, ''));
  return (m[2] || m[4]) ? n * 1000 : n;
}
export function parseDays(text: string): number | null {
  const m = text.match(/(\d+)\s*(day|week|month)s?/i);
  if (!m) return null;
  return Number(m[1]) * (/week/i.test(m[2]) ? 7 : /month/i.test(m[2]) ? 30 : 1);
}

export function riskAssess(text: string, total: number, ms: PlanMilestone[]): { risk: string[]; score: number } {
  const risk: string[] = []; let score = 10;
  const add = (cond: boolean, pts: number, msg: string) => { if (cond) { score += pts; risk.push(msg); } };
  add(total > 5000, 25, 'High value: over $5,000; consider identity checks and smaller milestones.');
  add(total > 1000 && total <= 5000, 10, 'Medium value: keep each milestone under ~40% of the total.');
  add(!parseDays(text) && !/deadline|due|by (mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text), 15, 'No deadline stated, so late delivery cannot be judged.');
  add(ms.length < 2, 20, 'Single milestone: the buyer carries all the risk until the end.');
  add(ms.some(m => m.amount / total > 0.6), 15, 'One milestone holds >60% of funds; split it.');
  add(/gift ?card|crypto|wire|western union|outside paypal|off[- ]platform|whatsapp me/i.test(text), 35, 'Payment-diversion language detected (gift cards / wire / off-platform). Common scam pattern.');
  add(/urgent|asap|immediately|today only/i.test(text), 8, 'Urgency pressure language.');
  add(/unlimited revisions|whatever it takes|perfect/i.test(text), 8, 'Vague or unbounded acceptance terms.');
  return { risk, score: Math.min(100, score) };
}

export function localPlan(text: string): Plan {
  const total = parseAmount(text);
  const parts = text.split(/\.\s+|;|\n|\bthen\b|\bfinally\b|\bafter that\b/i)
    .map(s => s.replace(/^[\s,•\-\d.)]*(and|a|an|then|first|second|third|next)?[\s,]*/i, '').replace(/[.\s]+$/, '').trim())
    .filter(s => s.length > 8 && !/\$|\b(total|budget|due|deadline|within|paid via)\b/i.test(s)).slice(0, 6);
  const items = parts.length ? parts : ['Initial draft', 'Revisions', 'Final delivery'];
  const weights = items.map((_, i) => (i === items.length - 1 ? 1.5 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const days = parseDays(text) || 14;
  let left = total;
  const milestones = items.map((it, i) => {
    const amt = i === items.length - 1 ? round2(left) : round2(total * weights[i] / wsum); left -= amt;
    const title = it.charAt(0).toUpperCase() + it.slice(1);
    return { title, amount: amt, dueInDays: Math.round(days * (i + 1) / items.length), criteria: [
      `Delivers: ${title}`, ...keywords(it).slice(0, 2).map(k => `Evidence mentions or shows "${k}"`), 'Includes a link, file, or screenshot as proof'] };
  });
  const r = riskAssess(text, total, milestones);
  return { title: items[0].slice(0, 70), total, milestones, risk: r.risk, riskScore: r.score, engine: 'local rules' };
}

const INJECTION = /ignore (all|previous|the above)|system prompt|you are now|release (all|100%|the funds)|approve this|as the (ai|arbiter)/i;
export function localJudge(title: string, criteria: Criteria, evidence: string, hasFile: boolean): Verdict {
  const ev = evidence.toLowerCase(); const met: string[] = [], missing: string[] = [];
  for (const c of criteria) {
    const q = c.match(/"([^"]+)"/)?.[1]; let ok: boolean;
    if (q) ok = ev.includes(q.toLowerCase());
    else if (/link|file|screenshot/i.test(c)) ok = hasFile || /https?:\/\/|\.(png|jpe?g|pdf|zip|fig)\b|screenshot|attached/i.test(evidence);
    else ok = keywords(c).filter(k => k !== 'delivers').some(k => ev.includes(k)) || keywords(title).some(k => ev.includes(k));
    (ok ? met : missing).push(c);
  }
  const injectionFlag = INJECTION.test(evidence);
  const pct = Math.round((met.length / Math.max(1, criteria.length)) * 100);
  const recommendation = injectionFlag ? 'revise' : pct === 100 ? 'release' : pct >= 50 ? 'partial' : 'revise';
  return { met, missing, injectionFlag, releasePct: recommendation === 'release' ? 100 : recommendation === 'partial' ? pct : 0, recommendation,
    reasoning: (injectionFlag ? 'Evidence contains instructions aimed at the reviewer; ignored and flagged for the buyer. ' : '') + `${met.length}/${criteria.length} written claims addressed by a keyword check. Files and links were not verified.` + (missing.length ? ` Missing: ${missing.join('; ')}.` : ''), engine: 'local rules' };
}

export function localMediate(m: { title: string; criteria: Criteria }, verdict: Verdict | null, reason: string, sellerResp: string): Mediation {
  const base = verdict ? verdict.met.length / Math.max(1, m.criteria.length) : 0.5;
  const pct = Math.max(0, Math.min(100, Math.round(base * 100 / 10) * 10));
  return { summary: `Dispute over "${m.title}". The AI review found ${verdict ? `${verdict.met.length}/${m.criteria.length}` : 'unknown'} written claims addressed. File contents and links were not inspected.`,
    buyerPosition: reason || '(none given)', sellerPosition: sellerResp || '(seller has not responded yet)', proposedReleasePct: pct,
    rationale: `Suggested capture based on the share of claims addressed (${pct}%) and leave the rest uncaptured. Either party can reject; settlement requires both participants to accept. Authorization expiry still applies.`, engine: 'local rules' };
}
