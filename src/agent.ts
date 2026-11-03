// EscrowPal agent: turns a plain-English deal into milestones + acceptance criteria,
// then judges delivered evidence against those criteria. Uses an LLM via /api/agent
// when a key is configured; otherwise a transparent local heuristic (labelled in UI).
export type Milestone = { id: string; title: string; amount: number; criteria: string[]; status: 'draft'|'funded'|'delivered'|'released'|'disputed'; authId?: string; evidence?: string; verdict?: Verdict };
export type Verdict = { met: string[]; missing: string[]; releasePct: number; recommendation: 'release'|'partial'|'dispute'; reasoning: string; engine: string };
export type Deal = { title: string; buyer: string; seller: string; total: number; currency: string; milestones: Milestone[]; risk: string[]; engine: string };

const uid = () => Math.random().toString(36).slice(2, 9);

export function parseAmount(text: string): number {
  const m = text.match(/\$\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:usd|dollars)/i);
  return m ? Number((m[1] || m[2]).replace(/,/g, '')) : 500;
}

export function localPlan(text: string): Deal {
  const total = parseAmount(text);
  const parts = text.split(/\.\s+|;|\n|\bthen\b/i)
    .map(s => s.replace(/^[\s,]*(and|a|an|then)\s+/i, '').replace(/[.\s]+$/, '').trim())
    .filter(s => s.length > 8 && !/\$|\b(total|budget|due|deadline|within)\b/i.test(s)).slice(0, 5);
  const items = parts.length ? parts : ['Initial draft', 'Revisions', 'Final delivery'];
  const weights = items.map((_, i) => (i === items.length - 1 ? 1.5 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let left = total;
  const milestones = items.map((it, i) => {
    const amt = i === items.length - 1 ? Math.round(left * 100) / 100 : Math.round((total * weights[i] / wsum) * 100) / 100;
    left -= amt;
    const title = it.charAt(0).toUpperCase() + it.slice(1);
    const keys = keywords(it);
    return { id: uid(), title, amount: amt, status: 'draft' as const, criteria: [
      `Delivers: ${title}`,
      ...keys.slice(0, 2).map(k => `Evidence mentions or shows "${k}"`),
      'Includes a link, file, or screenshot as proof',
    ] };
  });
  const risk: string[] = [];
  if (total > 2000) risk.push('High value: consider more, smaller milestones.');
  if (!/deadline|by |due|days?|weeks?/i.test(text)) risk.push('No deadline stated: add one so disputes are decidable.');
  if (items.length < 2) risk.push('Single milestone: buyer carries all the risk until the end.');
  return { title: items[0].slice(0, 60), buyer: 'Buyer', seller: 'Seller', total, currency: 'USD', milestones, risk, engine: 'local heuristic' };
}

export function keywords(s: string): string[] {
  const stop = new Set('the a an and or of for to with in on my our your page site app that this it be is are will should'.split(' '));
  return [...new Set(s.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])].filter(w => !stop.has(w));
}

export function localJudge(m: Milestone, evidence: string): Verdict {
  const ev = evidence.toLowerCase();
  const met: string[] = [], missing: string[] = [];
  for (const c of m.criteria) {
    const q = c.match(/"([^"]+)"/)?.[1];
    let ok: boolean;
    if (q) ok = ev.includes(q.toLowerCase());
    else if (/link|file|screenshot/i.test(c)) ok = /https?:\/\/|\.(png|jpg|pdf|zip|fig)|screenshot|attached/i.test(evidence);
    else ok = keywords(m.title).some(k => ev.includes(k)) || ev.length > 40;
    (ok ? met : missing).push(c);
  }
  const pct = Math.round((met.length / m.criteria.length) * 100);
  const recommendation = pct === 100 ? 'release' : pct >= 50 ? 'partial' : 'dispute';
  return { met, missing, releasePct: recommendation === 'release' ? 100 : recommendation === 'partial' ? pct : 0, recommendation,
    reasoning: `${met.length}/${m.criteria.length} acceptance criteria satisfied by the submitted evidence.` + (missing.length ? ` Missing: ${missing.join('; ')}.` : ''), engine: 'local heuristic' };
}

async function llm<T>(task: string, payload: unknown): Promise<T | null> {
  try {
    const r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, payload }) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export async function planDeal(text: string): Promise<Deal> {
  const local = localPlan(text);
  const ai = await llm<Deal>('plan', { text, total: local.total });
  if (ai && Array.isArray(ai.milestones) && ai.milestones.length) {
    return { ...local, ...ai, milestones: ai.milestones.map(m => ({ ...m, id: uid(), status: 'draft' as const })) };
  }
  return local;
}

export async function judge(m: Milestone, evidence: string): Promise<Verdict> {
  const ai = await llm<Verdict>('judge', { milestone: { title: m.title, criteria: m.criteria, amount: m.amount }, evidence });
  return ai && typeof ai.releasePct === 'number' ? ai : localJudge(m, evidence);
}
