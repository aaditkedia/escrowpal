import { useState } from 'react';
import QRCode from 'qrcode';
import { Nav, go } from '../Router';
import { rpc, remember, money } from '../api';
import type { Plan, PlanMilestone } from '../shared/agent';

const SAMPLE = 'Landing page for my bakery, $1,200 total. A Figma mockup of the homepage and menu page; then the responsive React site with online order form; then deploy to Vercel with a custom domain and analytics. Due in 3 weeks.';
export function NewDeal() {
  const [f, setF] = useState({ description: SAMPLE, title: '', buyerName: 'Maya (Sweet Crumb Bakery)', buyerEmail: '', sellerName: 'Aadit (freelance dev)', sellerEmail: '', inspectionDays: 3 });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [made, setMade] = useState<{ id: string; buyerToken: string; sellerToken: string; qr: string } | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const total = plan ? plan.milestones.reduce((a, m) => a + Number(m.amount || 0), 0) : 0;
  const edit = (i: number, p: Partial<PlanMilestone>) => plan && setPlan({ ...plan, milestones: plan.milestones.map((m, j) => j === i ? { ...m, ...p } : m) });

  async function preview() { setErr(''); setBusy('Agent is drafting milestones…'); try { const p = await rpc<Plan>('preview', { description: f.description }); setPlan(p); setF(x => ({ ...x, title: x.title || p.title })); } catch (e: any) { setErr(e.message); } setBusy(''); }
  async function create() {
    setErr(''); setBusy('Creating deal…');
    try {
      const r = await rpc('create', { ...f, plan });
      remember({ id: r.id, k: r.buyerToken, role: 'buyer', title: f.title || plan?.title || 'Deal', savedAt: Date.now() });
      const sellerUrl = `${location.origin}/d/${r.id}?k=${r.sellerToken}`;
      setMade({ ...r, qr: await QRCode.toDataURL(sellerUrl, { margin: 1, width: 180 }) });
    } catch (e: any) { setErr(e.message); } setBusy('');
  }
  if (made) { const sellerUrl = `${location.origin}/d/${made.id}?k=${made.sellerToken}`; return <><div className="bar"><Nav /></div><main className="page narrow">
    <h1 className="display small">Deal created ✓</h1>
    <div className="card"><h2>Send this private link to the seller</h2><p className="muted">Anyone with this link acts as the seller. Share it only with them.</p>
      <div className="share"><img src={made.qr} alt="QR code for the seller link" width={180} height={180} /><div><input readOnly value={sellerUrl} aria-label="Seller link" onFocus={e => e.target.select()} />
        <button onClick={() => navigator.clipboard.writeText(sellerUrl)}>Copy seller link</button>{f.sellerEmail && <a className="btn ghost" href={`mailto:${f.sellerEmail}?subject=${encodeURIComponent('Escrow deal: ' + (f.title || 'our project'))}&body=${encodeURIComponent('Please review and accept the milestones here: ' + sellerUrl)}`}>Email it</a>}</div></div></div>
    <button onClick={() => go(`/d/${made.id}?k=${made.buyerToken}`)}>Open my buyer deal room →</button>
  </main></>; }
  return <><div className="bar"><Nav /></div><main className="page">
    <h1 className="display small">New protected deal</h1>
    <div className="grid2">
      <section className="card">
        <label htmlFor="d">What is being bought? Describe the deliverables, price and timing.</label>
        <textarea id="d" rows={6} value={f.description} onChange={set('description')} />
        <div className="row2"><div><label htmlFor="bn">Buyer name</label><input id="bn" value={f.buyerName} onChange={set('buyerName')} /></div><div><label htmlFor="be">Buyer email (optional)</label><input id="be" type="email" value={f.buyerEmail} onChange={set('buyerEmail')} /></div></div>
        <div className="row2"><div><label htmlFor="sn">Seller name</label><input id="sn" value={f.sellerName} onChange={set('sellerName')} /></div><div><label htmlFor="se">Seller email (optional)</label><input id="se" type="email" value={f.sellerEmail} onChange={set('sellerEmail')} /></div></div>
        <label htmlFor="ins">Inspection window (days before auto-release)</label><input id="ins" type="number" min={1} max={14} value={f.inspectionDays} onChange={set('inspectionDays')} />
        <button onClick={preview} disabled={!!busy}>{plan ? 'Re-draft with AI' : 'Draft milestones with AI'}</button>
      </section>
      <section className="card">
        {!plan ? <p className="muted">The agent's milestone plan appears here. You can edit every field before creating the deal.</p> : <>
          <div className="riskhead"><h2>Plan · {money(total)}</h2><Risk score={plan.riskScore} /></div>
          <p className="muted small">Planner: {plan.engine}</p>
          <label htmlFor="ti">Deal title</label><input id="ti" value={f.title} onChange={set('title')} />
          {plan.risk.length > 0 && <ul className="risk">{plan.risk.map(r => <li key={r}>{r}</li>)}</ul>}
          {plan.milestones.map((m, i) => <fieldset key={i} className="msedit"><legend>Milestone {i + 1}</legend>
            <input aria-label={`Milestone ${i + 1} title`} value={m.title} onChange={e => edit(i, { title: e.target.value })} />
            <div className="row2"><label>Amount $<input type="number" value={m.amount} onChange={e => edit(i, { amount: Number(e.target.value) })} /></label><label>Due in days<input type="number" value={m.dueInDays || ''} onChange={e => edit(i, { dueInDays: Number(e.target.value) })} /></label></div>
            <label>Acceptance criteria (one per line)<textarea rows={3} value={m.criteria.join('\n')} onChange={e => edit(i, { criteria: e.target.value.split('\n') })} /></label>
            <button className="ghost small" onClick={() => setPlan({ ...plan, milestones: plan.milestones.filter((_, j) => j !== i) })}>Remove</button>
          </fieldset>)}
          <button className="ghost" onClick={() => setPlan({ ...plan, milestones: [...plan.milestones, { title: 'New milestone', amount: 100, criteria: ['Describe what must be delivered'], dueInDays: 7 }] })}>+ Add milestone</button>
          <button onClick={create} disabled={!!busy}>Sign as buyer & create deal</button>
        </>}
        {busy && <p role="status">{busy}</p>}{err && <p role="alert" className="err">{err}</p>}
      </section>
    </div>
  </main></>;
}
export function Risk({ score }: { score: number }) {
  const lvl = score >= 60 ? 'high' : score >= 30 ? 'med' : 'low';
  return <div className={`riskmeter ${lvl}`} role="img" aria-label={`Risk score ${score} out of 100, ${lvl}`}><span style={{ width: `${score}%` }} /><b>Risk {score}/100</b></div>;
}
