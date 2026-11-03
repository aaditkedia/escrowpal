import { useEffect, useRef, useState } from 'react';
import { planDeal, judge, type Deal, type Milestone } from './agent';

const SAMPLE = 'Landing page for my bakery, $600 total. A Figma mockup of the homepage; then the responsive React site with menu and order form; then deploy to Vercel with a custom domain. Due in 2 weeks.';
const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'sb';
declare global { interface Window { paypal?: any } }

function usePayPal() {
  const [ready, setReady] = useState(!!window.paypal);
  useEffect(() => {
    if (window.paypal) return;
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD&intent=authorize&components=buttons`;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);
  return ready;
}

function FundButton({ m, onFunded }: { m: Milestone; onFunded: (authId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = usePayPal();
  useEffect(() => {
    if (!ready || !ref.current || !window.paypal) return;
    ref.current.innerHTML = '';
    window.paypal.Buttons({
      style: { layout: 'horizontal', height: 35, tagline: false },
      createOrder: (_: any, actions: any) => actions.order.create({ intent: 'AUTHORIZE', purchase_units: [{ description: `EscrowPal: ${m.title}`.slice(0, 120), amount: { currency_code: 'USD', value: m.amount.toFixed(2) } }] }),
      onApprove: async (_: any, actions: any) => {
        const a = await actions.order.authorize();
        const auth = a?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id || a?.id;
        onFunded(auth);
      },
    }).render(ref.current);
  }, [ready, m.id]);
  return <div><div ref={ref} />
    <button className="ghost" onClick={() => onFunded('DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase())}>Demo fund (skip PayPal popup)</button></div>;
}

export default function App() {
  const [text, setText] = useState(SAMPLE);
  const [deal, setDeal] = useState<Deal | null>(() => JSON.parse(localStorage.getItem('deal') || 'null'));
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>(() => JSON.parse(localStorage.getItem('log') || '[]'));
  useEffect(() => { localStorage.setItem('deal', JSON.stringify(deal)); localStorage.setItem('log', JSON.stringify(log)); }, [deal, log]);
  const add = (s: string) => setLog(l => [`${new Date().toLocaleTimeString()} · ${s}`, ...l]);
  const upd = (id: string, p: Partial<Milestone>) => setDeal(d => d && ({ ...d, milestones: d.milestones.map(m => m.id === id ? { ...m, ...p } : m) }));

  async function plan() { setBusy(true); const d = await planDeal(text); setDeal(d); add(`Agent (${d.engine}) split $${d.total} into ${d.milestones.length} milestones`); setBusy(false); }
  async function release(m: Milestone, pct: number) {
    const amt = Math.round(m.amount * pct) / 100;
    let note = 'sandbox capture simulated (server creds not set)';
    if (m.authId && !m.authId.startsWith('DEMO')) {
      const r = await fetch('/api/paypal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'capture', authorizationId: m.authId, amount: amt }) });
      if (r.ok) note = `PayPal capture ${(await r.json()).id}`;
    }
    upd(m.id, { status: pct > 0 ? 'released' : 'disputed' });
    add(pct > 0 ? `Released $${amt.toFixed(2)} (${pct}%) for "${m.title}" · ${note}` : `Opened dispute on "${m.title}"; funds stay on hold`);
  }

  const held = deal?.milestones.filter(m => m.status === 'funded' || m.status === 'delivered').reduce((a, m) => a + m.amount, 0) || 0;
  const paid = deal?.milestones.filter(m => m.status === 'released').reduce((a, m) => a + m.amount, 0) || 0;

  return <main>
    <header><h1>🤝 EscrowPal</h1><p>An AI escrow agent for freelancers and small sellers. Describe the deal, the agent writes checkable milestones, the buyer funds each one through PayPal as an <b>authorization hold</b>, and the agent judges delivered work before money moves.</p></header>
    <section className="card">
      <label htmlFor="deal">1 · Describe the deal in plain English</label>
      <textarea id="deal" rows={4} value={text} onChange={e => setText(e.target.value)} />
      <button onClick={plan} disabled={busy}>{busy ? 'Agent planning…' : 'Have the agent draft milestones'}</button>
      {deal && <button className="ghost" onClick={() => { setDeal(null); setLog([]); }}>Reset</button>}
    </section>
    {deal && <>
      <section className="stats"><div><b>${deal.total.toFixed(2)}</b><span>deal total</span></div><div><b>${held.toFixed(2)}</b><span>held by PayPal</span></div><div><b>${paid.toFixed(2)}</b><span>released</span></div><div><b>{deal.engine}</b><span>agent engine</span></div></section>
      {deal.risk.length > 0 && <section className="card warn"><b>Agent risk notes</b><ul>{deal.risk.map(r => <li key={r}>{r}</li>)}</ul></section>}
      {deal.milestones.map((m, i) => <section key={m.id} className={`card ms ${m.status}`}>
        <div className="row"><h3>{i + 1}. {m.title}</h3><span className="pill">{m.status}</span><b>${m.amount.toFixed(2)}</b></div>
        <ul className="crit">{m.criteria.map(c => <li key={c} className={m.verdict ? (m.verdict.met.includes(c) ? 'ok' : 'no') : ''}>{c}</li>)}</ul>
        {m.status === 'draft' && <FundButton m={m} onFunded={authId => { upd(m.id, { status: 'funded', authId }); add(`Buyer authorized $${m.amount.toFixed(2)} for "${m.title}" (hold ${authId})`); }} />}
        {m.status === 'funded' && <Deliver m={m} onJudge={async ev => { const v = await judge(m, ev); upd(m.id, { status: 'delivered', evidence: ev, verdict: v }); add(`Agent (${v.engine}) reviewed delivery: ${v.recommendation} ${v.releasePct}%`); }} />}
        {m.status === 'delivered' && m.verdict && <div className={`verdict ${m.verdict.recommendation}`}>
          <b>Agent recommends: {m.verdict.recommendation.toUpperCase()} {m.verdict.releasePct}%</b><p>{m.verdict.reasoning}</p>
          <button onClick={() => release(m, m.verdict!.releasePct || 100)}>Buyer: accept & release {m.verdict.releasePct || 100}%</button>
          <button className="ghost" onClick={() => release(m, 0)}>Dispute</button></div>}
      </section>)}
      <section className="card"><b>Audit trail</b><ol className="log">{log.map((l, i) => <li key={i}>{l}</li>)}</ol></section>
    </>}
    <footer>PayPal sandbox · funds are authorized (held), captured only on release. Not a licensed escrow service; hackathon prototype.</footer>
  </main>;
}

function Deliver({ m, onJudge }: { m: Milestone; onJudge: (ev: string) => void }) {
  const [ev, setEv] = useState(`Done: ${m.title}. Link: https://example.com/delivery , screenshot attached.`);
  return <div><label htmlFor={'ev' + m.id}>Seller: submit delivery evidence</label><textarea id={'ev' + m.id} rows={2} value={ev} onChange={e => setEv(e.target.value)} /><button onClick={() => onJudge(ev)}>Submit for agent review</button></div>;
}
