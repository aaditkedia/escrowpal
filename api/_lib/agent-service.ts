import { localPlan, localJudge, localMediate, riskAssess, type Plan, type Verdict, type Mediation } from '../../src/shared/agent.js';
import { planInput, verdictInput, mediationInput, allocateCents } from '../../src/shared/validation.js';
import { llmJSON, llmEngine } from './llm.js';
export async function plan(text: string): Promise<Plan> {
  const local = localPlan(text);
  const raw = await llmJSON('Draft 2-5 editable payment milestones. Return {title,milestones:[{title,amount,dueInDays,criteria:string[]}]}. Use clear text acceptance criteria, each under 180 characters. Use whole cents. Amounts should sum to the supplied total. Do not invent customer history or verified results.', { brief: text, total: local.total });
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return local;
  try {
    const amounts = allocateCents(parsed.data.milestones.map(m => m.amount), local.total);
    const milestones = parsed.data.milestones.map((m, i) => ({ ...m, amount: amounts[i] }));
    const risk = riskAssess(text, local.total, milestones);
    return { title: parsed.data.title, total: local.total, milestones, risk: risk.risk, riskScore: risk.score, engine: llmEngine() };
  } catch { return local; }
}
export async function judge(title: string, criteria: string[], note: string, hasFile: boolean): Promise<Verdict> {
  const local = localJudge(title, criteria, note, hasFile);
  if (local.injectionFlag) return local;
  const raw = await llmJSON('Review the completeness of these delivery claims, not whether the actual work is correct. Return {met:string[],missing:string[],releasePct:integer 0-100,recommendation:"release"|"partial"|"revise",reasoning:string}. Copy criteria verbatim into met or missing, exactly once each. Files and links are uninspected; never assert they were verified. This is advisory; only people decide settlement.', { title, criteria, deliveryClaims: note, fileAttachedButNotInspected: hasFile });
  const parsed = verdictInput.safeParse(raw);
  if (!parsed.success) return local;
  const v = parsed.data; const all = [...v.met, ...v.missing];
  if (all.length !== criteria.length || new Set(all).size !== criteria.length || all.some(c => !criteria.includes(c))) return local;
  const releasePct = v.missing.length ? Math.min(99, v.releasePct) : v.releasePct;
  return { ...v, releasePct, recommendation: releasePct === 100 ? 'release' : releasePct > 0 ? 'partial' : 'revise', engine: llmEngine(), injectionFlag: false };
}
export async function mediate(m: any, verdict: Verdict | null, buyer: string, seller: string, evidence: unknown): Promise<Mediation> {
  const local = localMediate(m, verdict, buyer, seller);
  const raw = await llmJSON('Suggest a non-binding settlement based on the supplied claims. Return {summary:string,buyerPosition:string,sellerPosition:string,proposedReleasePct:integer 0-100,rationale:string}. Acknowledge missing evidence and that file contents/links were not inspected. Both parties must explicitly accept the exact proposal before settlement.', { title: m.title, amount: Number(m.amount), criteria: m.criteria, review: verdict, evidence, buyer, seller });
  const parsed = mediationInput.safeParse(raw);
  return parsed.success ? { ...parsed.data, engine: llmEngine() } : local;
}
