import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, asc, desc, inArray, isNull } from 'drizzle-orm';
import { z, ZodError } from 'zod';
import { db, schema, storageMode } from './_lib/db.js';
import { llmEnabled, llmEngine } from './_lib/llm.js';
import { plan, judge, mediate } from './_lib/agent-service.js';
import * as pp from './_lib/paypal.js';
import { localMediate, riskAssess, round2, type Plan, type Mediation, type Verdict } from '../src/shared/agent.js';
import { recordedMarket } from '../src/shared/market-recorded.js';
import { analyzeMarket, pilotPlan } from './_lib/market-service.js';
import { layaConfigured } from './_lib/laya.js';
import { marketInput, type MarketResult } from '../src/shared/market.js';
import { planInput, percent } from '../src/shared/validation.js';

const { deals, milestones, evidence, disputes, events, marketAnalyses } = schema;
const id = (n = 10) => randomBytes(n).toString('base64url');
type Role = 'buyer' | 'seller';
class HttpErr extends Error { constructor(public code: number, msg: string) { super(msg); } }
const fail = (code: number, msg: string): never => { throw new HttpErr(code, msg); };
const clean = (s: unknown, max = 4000) => String(s ?? '').slice(0, max).trim();
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// PostgreSQL JSONB reorders object keys; market receipts use recursively sorted keys.
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const proposalHash = (d: any) => digest({ id: d.id, mediator: d.mediator, buyer: d.buyerResponse, seller: d.sellerResponse });
function equalKey(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const config = () => ({
  version: '4.0.0', laya: layaConfigured(), llm: llmEnabled(), llmModel: llmEnabled() ? llmEngine() : null,
  paypalServer: pp.paypalServer(), paypalClientId: pp.paypalServer() ? process.env.PAYPAL_CLIENT_ID : null,
  storage: storageMode, sandboxOnly: true, automaticRelease: false,
});
async function auth(dealId: string, k: string) {
  if (typeof dealId !== 'string' || typeof k !== 'string' || k.length > 128) fail(403, 'Use a valid private deal link.');
  const d = await db.query.deals.findFirst({ where: eq(deals.id, dealId) }) || fail(404, 'Deal not found.');
  const role: Role = k && equalKey(k, d.buyerToken) ? 'buyer' : k && equalKey(k, d.sellerToken) ? 'seller' : fail(403, 'Use a valid private deal link.');
  return { d, role };
}
const log = (dealId: string, role: string, kind: string, message: string) => db.insert(events).values({ dealId, role, kind, message });
async function loadMs(dealId: string, mid: string) {
  const m = await db.query.milestones.findFirst({ where: eq(milestones.id, mid) });
  if (!m || m.dealId !== dealId) fail(404, 'Milestone not found in this deal.');
  return m!;
}
function active(d: typeof deals.$inferSelect) { if (d.status !== 'active') fail(409, 'This action requires an active, signed deal.'); }
async function settle(d: typeof deals.$inferSelect, m: typeof milestones.$inferSelect, rawPct: unknown, by: string, expected: string) {
  active(d); const pct = percent.parse(rawPct);
  if (!m.authId) fail(409, 'No authorization is recorded for this milestone.');
  if (!pp.isMockAuth(m.authId) && !pp.paypalServer()) fail(503, 'Sandbox credentials are unavailable. Reconcile the authorization before continuing.');
  const amount = round2(Number(m.amount) * pct / 100);
  if (pct > 0 && amount < 0.01) fail(400, 'The settlement must capture at least one cent.');
  const claim = await db.update(milestones).set({ status: 'settling' }).where(and(eq(milestones.id, m.id), eq(milestones.status, expected))).returning({ id: milestones.id });
  if (!claim.length) fail(409, 'Settlement already started or the milestone changed. Refresh the room.');
  let captureId: string | null = null;
  try {
    if (!pp.isMockAuth(m.authId)) {
      if (pct === 0) await pp.voidAuth(m.authId!, m.id);
      else {
        const c = await pp.capture(m.authId!, amount, m.id);
        if (typeof c.id !== 'string' || c.status !== 'COMPLETED' || c.amount?.currency_code !== 'USD' || Number(c.amount?.value) !== amount) throw new Error('Capture is not confirmed completed.');
        captureId = c.id;
      }
    }
  } catch {
    await log(d.id, by, 'reconciliation', 'Sandbox settlement outcome is uncertain. Automatic retries are blocked; check the PayPal record.');
    fail(502, 'Settlement needs reconciliation. Refresh and inspect the payment record; do not retry automatically.');
  }
  await db.update(milestones).set({ status: pct === 0 ? 'refunded' : 'released', releasedAmount: String(amount), captureId }).where(eq(milestones.id, m.id));
  const mode = pp.isMockAuth(m.authId) ? 'simulated ledger; no money moved' : 'PayPal sandbox merchant capture; no seller payout';
  await log(d.id, by, pct === 0 ? 'refund' : 'release', pct === 0
    ? 'Voided the authorization for "' + m.title + '" · ' + mode
    : 'Settled "' + m.title + '": $' + amount.toFixed(2) + ' captured (' + pct + '%), $' + (Number(m.amount) - amount).toFixed(2) + ' left uncaptured · ' + mode);
  const all = await db.select().from(milestones).where(eq(milestones.dealId, d.id));
  if (all.every(x => ['released','refunded','resolved'].includes(x.status))) {
    await db.update(deals).set({ status: 'completed' }).where(eq(deals.id, d.id));
    await log(d.id, 'system', 'complete', 'All milestones are settled. No seller payout was performed.');
  }
}
// A compare-and-set lock serializes proposal revisions and acceptances across instances.
async function exclusiveDispute(mid: string, task: () => Promise<void>) {
  const rows = await db.update(milestones).set({ status: 'negotiating' }).where(and(eq(milestones.id, mid), eq(milestones.status, 'disputed'))).returning();
  if (!rows.length) fail(409, 'The proposal is being updated or settled. Refresh before deciding.');
  try { await task(); }
  finally { await db.update(milestones).set({ status: 'disputed' }).where(and(eq(milestones.id, mid), eq(milestones.status, 'negotiating'))); }
}
async function authMarket(mid: unknown, key: unknown) {
  if (typeof mid !== 'string' || mid.length > 64 || typeof key !== 'string' || key.length > 128) fail(403, 'Use a valid private analysis link.');
  const a = await db.query.marketAnalyses.findFirst({ where: eq(marketAnalyses.id, String(mid)) }) || fail(404, 'Analysis not found.');
  if (!key || !equalKey(String(key), a.accessToken)) fail(403, 'Use a valid private analysis link.');
  return a;
}
function marketView(a: typeof marketAnalyses.$inferSelect) {
  return { id: a.id, result: a.result, sha256: a.digest, createdAt: a.createdAt, status: a.status, dealId: a.dealId };
}
async function view(dealId: string, role: Role) {
  const d = (await db.query.deals.findFirst({ where: eq(deals.id, dealId) }))!;
  const ms = await db.select().from(milestones).where(eq(milestones.dealId, dealId)).orderBy(asc(milestones.idx));
  const mids = ms.map(m => m.id);
  const ev = mids.length ? await db.select({ id: evidence.id, milestoneId: evidence.milestoneId, role: evidence.role, note: evidence.note, fileName: evidence.fileName, fileType: evidence.fileType, fileSize: evidence.fileSize, createdAt: evidence.createdAt }).from(evidence).where(inArray(evidence.milestoneId, mids)).orderBy(asc(evidence.createdAt)) : [];
  const ds = mids.length ? await db.select().from(disputes).where(inArray(disputes.milestoneId, mids)).orderBy(asc(disputes.createdAt)) : [];
  const evs = await db.select().from(events).where(eq(events.dealId, dealId)).orderBy(desc(events.id)).limit(200);
  const { buyerToken: _buyer, sellerToken, ...pub } = d;
  const market = await db.query.marketAnalyses.findFirst({ where: eq(marketAnalyses.dealId, d.id) });
  const mr = market?.result as MarketResult | undefined;
  const marketSummary = market && mr ? { analysisId: market.id, sha256: market.digest, fictional: mr.input.fictional, selectedCandidate: mr.input.options.find(o => o.id === market.selectedId)?.label || '', decisionStatus: mr.decision.status, engine: mr.decision.engine, budget: mr.input.budget, objective: mr.input.objective, stages: mr.stages } : null;
  const demo = d.engine === 'guided-demo' || !!mr?.input.fictional || ms.some(m => pp.isMockAuth(m.authId));
  return { role, deal: { ...pub, total: Number(d.total), demo, market: marketSummary }, milestones: ms.map(m => ({
    ...m, amount: Number(m.amount), releasedAmount: m.releasedAmount == null ? null : Number(m.releasedAmount),
    reviewDue: m.submittedAt ? new Date(m.submittedAt.getTime() + d.inspectionDays * 864e5).toISOString() : null,
    reviewOverdue: m.status === 'submitted' && !!m.submittedAt && Date.now() - m.submittedAt.getTime() > d.inspectionDays * 864e5,
  })), evidence: ev, disputes: ds.map(s => ({ ...s, proposalHash: proposalHash(s) })), events: evs,
    counterpartyLink: role === 'buyer' ? '/d/' + d.id + '?k=' + sellerToken : null, config: config() };
}
const createInput = z.object({
  acknowledge: z.literal(true), description: z.string().trim().min(15).max(4000), title: z.string().max(120).optional(),
  buyerName: z.string().trim().min(1).max(80), sellerName: z.string().trim().min(1).max(80),
  buyerEmail: z.union([z.email(), z.literal('')]).optional(), sellerEmail: z.union([z.email(), z.literal('')]).optional(),
  inspectionDays: z.coerce.number().int().min(1).max(14), plan: planInput.optional(),
});
const handlers: Record<string, (b: any) => Promise<any>> = {
  config: async () => config(),
  marketExample: async () => {
    const result = recordedMarket, analysisId = id(8), token = id(18), hash = digest(canonical(result));
    const rows = await db.insert(marketAnalyses).values({id:analysisId,accessToken:token,input:result.input,result,digest:hash}).returning();
    return {...marketView(rows[0]),token};
  },
  marketAnalyze: async b => {
    const result = await analyzeMarket(b.input);
    const analysisId = id(8), token = id(18), hash = digest(canonical(result));
    const rows = await db.insert(marketAnalyses).values({ id: analysisId, accessToken: token, input: result.input, result, digest: hash }).returning();
    return { ...marketView(rows[0]), token };
  },
  marketGet: async b => marketView(await authMarket(b.id, b.k)),
  marketReceipt: async b => {
    const a = await authMarket(b.id, b.k);
    return { schema: 'escrowpal.market-receipt.v1', payload: canonical(a.result), sha256: a.digest, algorithm: 'SHA-256', scope: 'Digest checks this analysis snapshot, not whether source claims or model preferences are true.' };
  },
  marketCreate: async b => {
    const input = z.object({ acknowledge: z.literal(true), acknowledgeDecision: z.literal(true), buyerName: z.string().trim().min(1).max(80), sellerName: z.string().trim().min(1).max(80), selectedId: z.string().min(1).max(32), overrideReason: z.string().trim().max(800).optional() }).parse(b);
    const a = await authMarket(b.id, b.k);
    if (a.dealId) {
      const d = (await db.query.deals.findFirst({ where: eq(deals.id, a.dealId) }))!;
      return { id: d.id, buyerToken: d.buyerToken, sellerToken: d.sellerToken };
    }
    if (Date.now() - a.createdAt.getTime() > 864e5) fail(409, 'This analysis is more than a day old. Run a fresh comparison before creating a pilot.');
    const result = a.result as MarketResult, brief = marketInput.parse(a.input);
    if (result.evidence.policyBlocks.length) fail(409, 'Resolve the blocking evidence checks before creating a pilot.');
    const option = brief.options.find(o => o.id === input.selectedId);
    if (!option || option.quotedPrice > brief.budget) fail(400, 'Select a candidate that fits this pilot budget.');
    const override = result.decision.choiceId !== input.selectedId;
    if (override && (!input.overrideReason || input.overrideReason.length < 8)) fail(400, 'Explain your manual selection when it differs from the model recommendation or the model is unavailable.');
    const claim = await db.update(marketAnalyses).set({ status: 'creating' }).where(and(eq(marketAnalyses.id, a.id), eq(marketAnalyses.status, 'ready'))).returning();
    if (!claim.length) fail(409, 'Pilot creation already started. Refresh before trying again.');
    const plan = pilotPlan(brief, input.selectedId);
    const description = (brief.fictional ? 'Fictional sample pilot. ' : '') + brief.objective + '\nSelected pilot: ' + option!.label + '\nAudience: ' + brief.audience + '\nAgreed project budget: $' + brief.budget.toFixed(2) + ' USD. Due in 14 days. Quoted channel costs are observations, not automatic vendor purchases. Analysis SHA-256: ' + a.digest;
    const made = await handlers.create({ acknowledge: true, description, title: plan.title, buyerName: input.buyerName, sellerName: input.sellerName, inspectionDays: 3, plan });
    await db.update(deals).set({ engine: 'market-pilot-v1' }).where(eq(deals.id, made.id));
    await db.update(marketAnalyses).set({ status: 'created', dealId: made.id, selectedId: input.selectedId }).where(eq(marketAnalyses.id, a.id));
    await log(made.id, 'buyer', 'market_plan', 'Market analysis ' + a.id + ' bound to pilot. SHA-256 ' + a.digest + '. ' + (override ? 'Manual selection: ' + input.overrideReason : 'Buyer reviewed the Laya recommendation.') + ' No funding or merchant purchase occurred on creation.');
    return made;
  },
  preview: async b => { const description = z.string().trim().min(15).max(4000).parse(b.description); if (!/\$\s?[\d,]+|[\d,]+\s*(?:usd|dollars)/i.test(description)) fail(400, 'Include an explicit USD budget, such as $1,200.'); return plan(description); },
  create: async b => {
    const input = createInput.parse(b);
    const p = input.plan || await plan(input.description);
    const parsed = planInput.parse(p); const ms = parsed.milestones;
    const total = round2(ms.reduce((a, m) => a + m.amount, 0)); if (total > 1_000_000) fail(400, 'Total exceeds the prototype limit.');
    const r = riskAssess(input.description, total, ms);
    const dealId = id(6), buyerToken = id(18), sellerToken = id(18);
    await db.insert(deals).values({ id: dealId, title: input.title?.trim() || parsed.title, description: input.description, total: String(total), buyerName: input.buyerName, buyerEmail: input.buyerEmail || null, sellerName: input.sellerName, sellerEmail: input.sellerEmail || null, buyerToken, sellerToken, buyerSignedAt: new Date(), inspectionDays: input.inspectionDays, riskScore: r.score, risk: r.risk, engine: input.plan ? 'buyer-reviewed plan' : (p as Plan).engine });
    await db.insert(milestones).values(ms.map((m, i) => ({ id: id(8), dealId, idx: i, title: m.title, amount: String(m.amount), criteria: m.criteria, dueDate: m.dueInDays ? new Date(Date.now() + m.dueInDays * 864e5).toISOString().slice(0, 10) : null })));
    await log(dealId, 'buyer', 'create', 'Buyer signed a $' + total.toFixed(2) + ' plan with ' + ms.length + ' milestones. Amounts and terms were reviewed by the buyer.');
    return { id: dealId, buyerToken, sellerToken };
  },
  get: async b => { const { d, role } = await auth(b.id, b.k); return view(d.id, role); },
  sign: async b => {
    const { d, role } = await auth(b.id, b.k); if (role !== 'seller') fail(403, 'Only the seller can sign here.');
    if (d.status !== 'awaiting_seller') fail(409, 'This deal is no longer awaiting a signature.');
    const rows = await db.update(deals).set({ sellerSignedAt: new Date(), status: 'active' }).where(and(eq(deals.id, d.id), eq(deals.status, 'awaiting_seller'))).returning();
    if (rows.length) await log(d.id, role, 'sign', 'Seller accepted the milestones. Funding is now available.');
    return view(d.id, role);
  },
  decline: async b => {
    const { d, role } = await auth(b.id, b.k);
    if (d.status !== 'awaiting_seller') fail(409, 'Only an agreement awaiting acceptance can be declined.');
    const rows = await db.update(deals).set({ status: 'cancelled' }).where(and(eq(deals.id, d.id), eq(deals.status, 'awaiting_seller'))).returning();
    if (!rows.length) fail(409, 'The agreement changed before it could be declined.');
    await log(d.id, role, 'cancel', 'Agreement declined before seller acceptance: ' + (clean(b.reason, 300) || 'No reason supplied.'));
    return view(d.id, role);
  },
  ppCreate: async b => {
    const { d, role } = await auth(b.id, b.k); if (role !== 'buyer') fail(403, 'Buyer only.'); active(d);
    const m = await loadMs(d.id, b.mid); if (m.status !== 'pending') fail(409, 'Milestone is no longer awaiting funding.');
    if (!pp.paypalServer()) fail(503, 'Sandbox credentials are not configured. Use the explicitly labelled demo hold.');
    if (m.orderId) return { id: m.orderId };
    const market = await db.query.marketAnalyses.findFirst({ where: eq(marketAnalyses.dealId, d.id) });
    const order = await pp.createOrder(Number(m.amount), 'EscrowPal: ' + m.title, m.id, market ? 'ep-market:' + market.digest : undefined);
    if (typeof order.id !== 'string') fail(502, 'PayPal did not return a usable order.');
    await db.update(milestones).set({ orderId: order.id }).where(eq(milestones.id, m.id)); return { id: order.id };
  },
  fund: async b => {
    const { d, role } = await auth(b.id, b.k); if (role !== 'buyer') fail(403, 'Only the buyer can fund.'); active(d);
    const m = await loadMs(d.id, b.mid); if (m.status !== 'pending') fail(409, 'Funding was already recorded or is being reconciled.');
    if (b.authId) fail(400, 'Client-supplied authorizations are not accepted.');
    const demo = b.demo === true;
    if (!demo && (!pp.paypalServer() || !m.orderId || b.orderId !== m.orderId)) fail(400, 'Use the server-created PayPal order, or explicitly select demo mode.');
    if (demo && b.orderId) fail(400, 'A demo hold cannot be attached to a PayPal order.');
    const claim = await db.update(milestones).set({ status: 'authorizing' }).where(and(eq(milestones.id, m.id), eq(milestones.status, 'pending'))).returning();
    if (!claim.length) fail(409, 'Funding already started.');
    let authId = 'MOCK-' + id(8), mode = 'simulated hold; no PayPal request or money movement';
    if (!demo) {
      try {
        const order = await pp.authorizeOrder(m.orderId!);
        const unit = order.purchase_units?.find((u: any) => u.reference_id === m.id);
        const a = unit?.payments?.authorizations?.[0];
        if (order.id !== m.orderId || a?.status !== 'CREATED' || a.amount?.currency_code !== 'USD' || Number(a.amount?.value) !== Number(m.amount) || typeof a.id !== 'string') throw new Error('Authorization does not match this milestone.');
        authId = a.id; mode = 'server-verified PayPal sandbox authorization';
      } catch { await log(d.id, 'buyer', 'reconciliation', 'Sandbox authorization needs reconciliation; automatic retry is blocked.'); fail(502, 'Authorization needs reconciliation. Check the PayPal record before continuing.'); }
    }
    await db.update(milestones).set({ status: 'funded', authId }).where(eq(milestones.id, m.id));
    await log(d.id, 'buyer', 'fund', '$' + Number(m.amount).toFixed(2) + ' authorized for "' + m.title + '" · ' + mode);
    return view(d.id, role);
  },
  submit: async b => {
    const { d, role } = await auth(b.id, b.k); if (role !== 'seller') fail(403, 'Only the seller submits delivery.'); active(d);
    const m = await loadMs(d.id, b.mid); if (!['funded','submitted'].includes(m.status)) fail(409, 'Fund the milestone before submitting evidence.');
    const note = clean(b.note, 4000); let file: Buffer | null = null;
    if (b.file?.b64) { if (typeof b.file.b64 !== 'string' || b.file.b64.length > 3_334_000) fail(413, 'Maximum file size is 2.5 MB.'); file = Buffer.from(b.file.b64, 'base64'); if (file.length > 2_500_000) fail(413, 'Maximum file size is 2.5 MB.'); }
    if (!note && !file?.length) fail(400, 'Add delivery notes or a proof file.');
    await db.insert(evidence).values({ id: id(8), milestoneId: m.id, role, note, fileName: file ? clean(b.file.name, 120) : null, fileType: file ? clean(b.file.type, 80) : null, fileSize: file?.length ?? null, fileData: file });
    const notes = await db.select({ note: evidence.note, f: evidence.fileName }).from(evidence).where(eq(evidence.milestoneId, m.id));
    const v = await judge(m.title, m.criteria, notes.map(x => x.note + (x.f ? ' [uninspected file: ' + x.f + ']' : '')).join('\n'), notes.some(x => x.f));
    const updated = await db.update(milestones).set({ status: 'submitted', submittedAt: new Date(), verdict: v }).where(and(eq(milestones.id, m.id), inArray(milestones.status, ['funded','submitted']))).returning();
    if (!updated.length) fail(409, 'The milestone changed during review. Refresh the room.');
    await log(d.id, role, 'submit', 'Delivery claims reviewed by ' + v.engine + ': ' + v.recommendation + ' (' + v.releasePct + '% advisory). Files and links were not inspected.' + (v.injectionFlag ? ' Reviewer-instruction attempt flagged.' : ''));
    return view(d.id, role);
  },
  approve: async b => { const { d, role } = await auth(b.id, b.k); if (role !== 'buyer') fail(403, 'Only the buyer can settle a review.'); const m = await loadMs(d.id, b.mid); await settle(d, m, b.pct ?? 100, role, 'submitted'); return view(d.id, role); },
  revise: async b => {
    const { d, role } = await auth(b.id, b.k); if (role !== 'buyer') fail(403, 'Buyer only.'); active(d);
    const m = await loadMs(d.id, b.mid); if (m.status !== 'submitted') fail(409, 'Only a submitted milestone can be revised.');
    const note = clean(b.note, 500) || fail(400, 'Explain which changes are needed.');
    const changed = await db.update(milestones).set({ status: 'funded', submittedAt: null, verdict: null }).where(and(eq(milestones.id, m.id), eq(milestones.status, 'submitted'))).returning();
    if (!changed.length) fail(409, 'The milestone changed. Refresh before requesting a revision.');
    await log(d.id, role, 'revise', 'Buyer requested changes: ' + note); return view(d.id, role);
  },
  dispute: async b => {
    const { d, role } = await auth(b.id, b.k); active(d); const m = await loadMs(d.id, b.mid);
    const reason = clean(b.reason, 2000) || fail(400, 'Explain the disputed work.');
    const claim = await db.update(milestones).set({ status: 'disputed' }).where(and(eq(milestones.id, m.id), inArray(milestones.status, ['funded','submitted']))).returning();
    if (!claim.length) fail(409, 'Only currently authorized work can be disputed.');
    const med = localMediate(m, m.verdict as Verdict | null, role === 'buyer' ? reason : '', role === 'seller' ? reason : '');
    await db.insert(disputes).values({ id: id(8), milestoneId: m.id, openedBy: role, reason, buyerResponse: role === 'buyer' ? reason : null, sellerResponse: role === 'seller' ? reason : null, mediator: med });
    await log(d.id, role, 'dispute', 'Dispute opened. Authorization remains unchanged. ' + reason.slice(0, 160)); return view(d.id, role);
  },
  respond: async b => {
    const { d, role } = await auth(b.id, b.k); active(d);
    const initial = await db.query.disputes.findFirst({ where: eq(disputes.id, b.did) }) || fail(404, 'Dispute not found.');
    const m = await loadMs(d.id, initial.milestoneId);
    if (initial.resolution) fail(409, 'This dispute is already closed.');
    const text = clean(b.text, 2000) || fail(400, 'Add your position.');
    await exclusiveDispute(m.id, async () => {
      const ds = (await db.query.disputes.findFirst({ where: eq(disputes.id, initial.id) }))!;
      if (ds.resolution) fail(409, 'This dispute is already closed.');
      const buyer = role === 'buyer' ? text : ds.buyerResponse || '', seller = role === 'seller' ? text : ds.sellerResponse || '';
      const ev = await db.select({ note: evidence.note, fileName: evidence.fileName }).from(evidence).where(eq(evidence.milestoneId, m.id));
      const med = await mediate(m, m.verdict as Verdict | null, buyer, seller, ev);
      await db.update(disputes).set({ buyerResponse: buyer || null, sellerResponse: seller || null, mediator: med, buyerAccepts: null, sellerAccepts: null }).where(and(eq(disputes.id, ds.id), isNull(disputes.resolution)));
      await log(d.id, role, 'respond', 'Proposal updated by ' + med.engine + '. Both parties must review and accept this revision again.');
    });
    return view(d.id, role);
  },
  accept: async b => {
    const { d, role } = await auth(b.id, b.k); active(d);
    const initial = await db.query.disputes.findFirst({ where: eq(disputes.id, b.did) }) || fail(404, 'Dispute not found.');
    const m = await loadMs(d.id, initial.milestoneId);
    if (initial.resolution) fail(409, 'The dispute is already closed.');
    await exclusiveDispute(m.id, async () => {
      const ds = (await db.query.disputes.findFirst({ where: eq(disputes.id, initial.id) }))!;
      if (ds.resolution) fail(409, 'The dispute is already closed.');
      if (b.proposalHash !== proposalHash(ds)) fail(409, 'The proposal changed. Refresh and review the current proposal.');
      if (role === 'buyer' ? ds.buyerAccepts : ds.sellerAccepts) return;
      await db.update(disputes).set(role === 'buyer' ? { buyerAccepts: 1 } : { sellerAccepts: 1 }).where(and(eq(disputes.id, ds.id), isNull(disputes.resolution)));
      await log(d.id, role, 'accept', role + ' explicitly accepted proposal ' + proposalHash(ds).slice(0, 12) + '.');
      const now = (await db.query.disputes.findFirst({ where: eq(disputes.id, ds.id) }))!;
      if (now.buyerAccepts && now.sellerAccepts && proposalHash(now) === b.proposalHash) {
        const pct = percent.parse((now.mediator as Mediation).proposedReleasePct);
        await settle(d, m, pct, 'both parties', 'negotiating');
        await db.update(disputes).set({ resolution: 'Settled by mutual acceptance: ' + pct + '% captured, remainder uncaptured.' }).where(eq(disputes.id, ds.id));
      }
    });
    return view(d.id, role);
  },
  comment: async b => { const { d, role } = await auth(b.id, b.k); const t = clean(b.text, 1000) || fail(400, 'Enter a message.'); await log(d.id, role, 'comment', t); return view(d.id, role); },
  receipt: async b => {
    const { d, role } = await auth(b.id, b.k); const v = await view(d.id, role);
    const audit = await db.select().from(events).where(eq(events.dealId, d.id)).orderBy(asc(events.id));
    const payload = { schema: 'escrowpal.evidence.v1', exportedAt: new Date().toISOString(), scope: 'Sandbox prototype; digest checks export integrity, not proof that claims are true.', deal: v.deal, milestones: v.milestones, evidence: v.evidence, disputes: v.disputes, events: audit };
    return { payload, sha256: digest(payload), algorithm: 'SHA-256' };
  },
  demo: async () => {
    const made = await handlers.create({ acknowledge: true, description: 'Fictional sample: $1,200 bakery website. First a homepage mockup; then a responsive site; finally deployment. Due in 3 weeks.', title: 'Sweet Crumb · website launch', buyerName: 'Maya · sample buyer', sellerName: 'Alex · sample designer', inspectionDays: 3, plan: { title: 'Bakery website', milestones: [
      { title: 'Direction & design', amount: 300, dueInDays: 7, criteria: ['Homepage and menu mockup described', 'Mobile layout described', 'Design review link provided'] },
      { title: 'Build & handoff', amount: 600, dueInDays: 14, criteria: ['Responsive site implementation described', 'Order form described', 'Repository link provided'] },
      { title: 'Launch & walkthrough', amount: 300, dueInDays: 21, criteria: ['Deployment steps documented', 'Custom domain setup described', 'Handoff walkthrough provided'] },
    ] } });
    await db.update(deals).set({ engine: 'guided-demo' }).where(eq(deals.id, made.id));
    await handlers.sign({ id: made.id, k: made.sellerToken });
    let v = await view(made.id, 'buyer');
    for (const m of v.milestones) await handlers.fund({ id: made.id, k: made.buyerToken, mid: m.id, demo: true });
    const first = v.milestones[0];
    await db.insert(evidence).values({ id: id(8), milestoneId: first.id, role: 'seller', note: 'Fictional delivery claim: homepage and menu mockup outlined. Mobile layout and design review link are still missing.' });
    const verdict = { met: first.criteria.slice(0, 1), missing: first.criteria.slice(1), releasePct: 33, recommendation: 'partial', reasoning: 'Illustrative review: 1 of 3 delivery claims addressed. No files or links were verified.', engine: 'handwritten sample review' };
    await db.update(milestones).set({ status: 'submitted', submittedAt: new Date(), verdict }).where(eq(milestones.id, first.id));
    await log(made.id, 'seller', 'submit', 'Fictional sample delivery and labelled illustrative review loaded. Re-submit evidence to run the configured reviewer.');
    return made;
  },
};
const buckets = new Map<string, { count: number; at: number }>();
export default async function handler(req: any, res: any) {
  res.setHeader('cache-control', 'private, no-store');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-content-type-options', 'nosniff');
  try {
    const origin = req.headers?.origin;
    if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Cross-origin requests are blocked.');
    if (['cross-site','same-site'].includes(req.headers?.['sec-fetch-site'])) fail(403, 'Cross-site requests are blocked.');
    if (req.method === 'GET' && req.query?.file) {
      await auth(String(req.query.id), String(req.query.k));
      const e = await db.query.evidence.findFirst({ where: eq(evidence.id, String(req.query.file)) });
      if (!e?.fileData) fail(404, 'File not found.');
      await loadMs(String(req.query.id), e!.milestoneId);
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('content-disposition', 'attachment; filename="' + (e!.fileName || 'proof').replace(/[^a-zA-Z0-9._-]/g, '_') + '"');
      res.setHeader('content-security-policy', "default-src 'none'");
      return res.status(200).send(e!.fileData);
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
    const b = req.body; if (!b || typeof b !== 'object' || Array.isArray(b)) fail(400, 'Send a JSON action.');
    if (JSON.stringify(b).length > 3_600_000) fail(413, 'Request exceeds the upload limit.');
    if (['preview','create','demo','marketAnalyze','marketCreate','marketExample'].includes(b.action)) {
      const key = digest(req.socket?.remoteAddress || 'serverless'); const now = Date.now(); const old = buckets.get(key);
      const bucket = old && now - old.at < 60_000 ? old : { count: 0, at: now };
      if (++bucket.count > 20) fail(429, 'This demo is busy. Wait a minute before creating more workspaces.');
      buckets.set(key, bucket); if (buckets.size > 1000) buckets.delete(buckets.keys().next().value!);
    }
    const action = typeof b.action === 'string' ? handlers[b.action] : undefined;
    if (!action) fail(400, 'Unknown action.');
    return res.status(200).json(await action!(b));
  } catch (error: any) {
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Check the supplied fields.' });
    if (error instanceof HttpErr) return res.status(error.code).json({ error: error.message });
    console.error('EscrowPal API failure:', error?.name || 'unknown');
    return res.status(500).json({ error: 'The action could not finish. Refresh and check its current state before retrying.' });
  }
}
