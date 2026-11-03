import { useEffect, useRef, useState } from 'react';
import { Nav } from '../Router';
import { rpc, remember, money } from '../api';
import { Risk } from './NewDeal';
import { contractPdf } from '../contract';

declare global { interface Window { paypal?: any } }
const STAGES = ['pending', 'funded', 'submitted', 'released'];
const label: Record<string, string> = { pending: 'Awaiting funding', funded: 'Funded · on hold', submitted: 'Delivered · in review', released: 'Released', refunded: 'Refunded', disputed: 'In dispute', resolved: 'Resolved' };

function loadPayPal(clientId: string) {
  return new Promise<void>(res => {
    if (window.paypal) return res();
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=authorize&components=buttons`;
    s.onload = () => res(); document.body.appendChild(s);
  });
}

export function DealRoom({ id, k }: { id: string; k: string }) {
  const [v, setV] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const load = () => rpc('get', { id, k }).then(x => { setV(x); remember({ id, k, role: x.role, title: x.deal.title, savedAt: Date.now() }); }).catch(e => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [id, k]);
  async function act(action: string, body: Record<string, unknown> = {}, msg = 'Working…') {
    setBusy(msg); setErr('');
    try { setV(await rpc(action, { id, k, ...body })); } catch (e: any) { setErr(e.message); }
    setBusy('');
  }
  if (err && !v) return <><div className="bar"><Nav /></div><main className="page"><p role="alert" className="err">{err}</p></main></>;
  if (!v) return <><div className="bar"><Nav /></div><main className="page"><p role="status">Loading deal…</p></main></>;
  const { deal, milestones: ms, role } = v;
  const held = ms.filter((m: any) => ['funded', 'submitted', 'disputed'].includes(m.status)).reduce((a: number, m: any) => a + m.amount, 0);
  const released = ms.reduce((a: number, m: any) => a + (m.status === 'released' || m.status === 'resolved' ? m.releasedAmount || 0 : m.status === 'refunded' ? 0 : 0), 0);
  const refunded = ms.reduce((a: number, m: any) => a + (['released', 'refunded'].includes(m.status) ? m.amount - (m.releasedAmount || 0) : 0), 0);
  const pct = Math.round(released / deal.total * 100);
  const sellerLink = v.counterpartyLink ? location.origin + v.counterpartyLink : '';
  return <><div className="bar"><Nav /></div><main className="page">
    <div className="roomhead">
      <div><p className="eyebrow dark">DEAL {deal.id} · YOU ARE THE {role.toUpperCase()}</p><h1 className="display small">{deal.title}</h1>
        <p className="muted">{deal.buyerName} → {deal.sellerName} · inspection window {deal.inspectionDays} days · <span className={`status ${deal.status}`}>{deal.status.replace('_', ' ')}</span></p></div>
      <div className="headbtns"><button className="ghost" onClick={() => contractPdf(v)}>⬇ Contract PDF</button>{sellerLink && <button className="ghost" onClick={() => navigator.clipboard.writeText(sellerLink)}>Copy seller link</button>}</div>
    </div>
    <section className="stats">
      <div><b>{money(deal.total)}</b><span>deal total</span></div><div><b>{money(held)}</b><span>held by PayPal</span></div>
      <div><b>{money(released)}</b><span>released to seller</span></div><div><b>{money(refunded)}</b><span>refunded</span></div>
    </section>
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid out"><span style={{ width: pct + '%' }} /></div>
    <div className="grid2 wide">
      <div>
        {deal.status === 'awaiting_seller' && <section className="card banner">
          {role === 'seller' ? <><h2>Review and accept the terms</h2><p>Check each milestone and its acceptance criteria below. Once you accept, the buyer can fund the milestones.</p>
            <button onClick={() => act('sign', {}, 'Signing…')}>Accept terms & sign</button><button className="ghost" onClick={() => { const r = prompt('Why are you declining?'); if (r !== null) act('decline', { reason: r }); }}>Decline</button></>
            : <><h2>Waiting for {deal.sellerName} to accept</h2><p>Send them the private seller link. Funding opens once they sign.</p><input readOnly value={sellerLink} aria-label="Seller link" onFocus={e => e.target.select()} /></>}
        </section>}
        <section className="card"><div className="riskhead"><h2>Risk check</h2><Risk score={deal.riskScore} /></div>{deal.risk.length ? <ul className="risk">{deal.risk.map((r: string) => <li key={r}>{r}</li>)}</ul> : <p className="muted">No red flags found.</p>}</section>
        <ol className="timeline">{ms.map((m: any, i: number) => <Milestone key={m.id} m={m} i={i} v={v} act={act} reload={load} />)}</ol>
      </div>
      <aside>
        <section className="card"><h2>Activity</h2>
          <form onSubmit={e => { e.preventDefault(); const t = (e.currentTarget.elements.namedItem('c') as HTMLInputElement); if (t.value.trim()) { act('comment', { text: t.value }); t.value = ''; } }}>
            <label htmlFor="c" className="sr">Message the other party</label><input id="c" name="c" placeholder="Message the other party…" /><button className="small">Post</button></form>
          <ol className="feed">{v.events.map((e: any) => <li key={e.id} className={e.role}><span className="who">{e.role}</span>{e.message}<time>{new Date(e.createdAt).toLocaleString()}</time></li>)}</ol>
        </section>
        <p className="muted small">AI engine: {v.config.llm ? 'LLM' : 'local rules (no LLM key set)'} · PayPal: {v.config.paypalServer ? 'sandbox, server capture' : 'sandbox buttons, simulated capture'}</p>
      </aside>
    </div>
    {busy && <div className="toast" role="status">{busy}</div>}{err && <div className="toast err" role="alert">{err}</div>}
  </main></>;
}

function FundButtons({ m, v, act }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    loadPayPal(v.config.paypalClientId).then(() => {
      if (dead || !ref.current || !window.paypal) return; ref.current.innerHTML = '';
      window.paypal.Buttons({
        style: { layout: 'horizontal', height: 40, tagline: false, label: 'pay' },
        createOrder: v.config.paypalServer
          ? async () => (await rpc('ppCreate', { id: v.deal.id, k: new URLSearchParams(location.search).get('k'), mid: m.id })).id
          : (_: any, a: any) => a.order.create({ intent: 'AUTHORIZE', purchase_units: [{ description: `EscrowPal: ${m.title}`.slice(0, 120), amount: { currency_code: 'USD', value: m.amount.toFixed(2) } }] }),
        onApprove: async (data: any, a: any) => {
          if (v.config.paypalServer) return act('fund', { mid: m.id, orderId: data.orderID }, 'Placing PayPal hold…');
          const r = await a.order.authorize(); act('fund', { mid: m.id, authId: r?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id, orderId: data.orderID }, 'Recording hold…');
        },
      }).render(ref.current);
    });
    return () => { dead = true; };
  }, [m.id]);
  return <div className="fund"><div ref={ref} className="ppbtn" /><button className="ghost small" onClick={() => act('fund', { mid: m.id }, 'Placing demo hold…')}>Demo hold (skip PayPal)</button></div>;
}

function Milestone({ m, i, v, act }: any) {
  const role = v.role; const ev = v.evidence.filter((e: any) => e.milestoneId === m.id); const ds = v.disputes.filter((d: any) => d.milestoneId === m.id);
  const [note, setNote] = useState(''); const [file, setFile] = useState<File | null>(null);
  const k = new URLSearchParams(location.search).get('k');
  const stage = Math.max(0, STAGES.indexOf(m.status === 'disputed' ? 'submitted' : m.status === 'refunded' || m.status === 'resolved' ? 'released' : m.status));
  async function submit() {
    let f: any = null;
    if (file) { if (file.size > 2_500_000) return alert('Max 2.5 MB'); const b = await file.arrayBuffer(); let s = ''; new Uint8Array(b).forEach(x => s += String.fromCharCode(x)); f = { name: file.name, type: file.type, b64: btoa(s) }; }
    await act('submit', { mid: m.id, note, file: f }, 'Uploading and running AI review…'); setNote(''); setFile(null);
  }
  const vd = m.verdict;
  return <li className={`card ms ${m.status}`}>
    <div className="mshead"><span className="idx">{i + 1}</span><div className="grow"><h3>{m.title}</h3><small>{m.dueDate ? `Due ${m.dueDate}` : 'No due date'}</small></div><span className={`pill ${m.status}`}>{label[m.status]}</span><b>{money(m.amount)}</b></div>
    <div className="stepper" aria-hidden="true">{['Fund', 'Deliver', 'Review', 'Paid'].map((s, j) => <span key={s} className={j <= stage ? 'on' : ''}>{s}</span>)}</div>
    <ul className="crit">{m.criteria.map((c: string) => <li key={c} className={vd ? (vd.met?.includes(c) ? 'ok' : 'no') : ''}>{c}</li>)}</ul>
    {ev.length > 0 && <div className="evid"><b>Evidence</b>{ev.map((e: any) => <p key={e.id}>{e.note}{e.fileName && <> · <a href={`/api/rpc?id=${v.deal.id}&k=${k}&file=${e.id}`} target="_blank" rel="noreferrer">📎 {e.fileName}</a> ({Math.round(e.fileSize / 1024)} KB)</>}</p>)}</div>}
    {vd && <div className={`verdict ${vd.recommendation}`}><b>AI review ({vd.engine}): {vd.recommendation.toUpperCase()} · {vd.releasePct}%</b><p>{vd.reasoning}</p>{vd.injectionFlag && <p className="err">⚠ The evidence tried to instruct the reviewer. It was ignored.</p>}</div>}
    {m.status === 'pending' && role === 'buyer' && v.deal.status === 'active' && <FundButtons m={m} v={v} act={act} />}
    {m.status === 'funded' && role === 'seller' && <div className="deliver">
      <label htmlFor={'n' + m.id}>Delivery note (links, what changed)</label><textarea id={'n' + m.id} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Figma mockup of homepage and menu: https://figma.com/… screenshot attached" />
      <label htmlFor={'f' + m.id}>Attach proof (image, PDF or zip, up to 2.5 MB)</label><input id={'f' + m.id} type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={submit} disabled={!note.trim() && !file}>Submit delivery for review</button></div>}
    {m.status === 'submitted' && role === 'buyer' && <div className="actions">
      <button onClick={() => act('approve', { mid: m.id, pct: 100 }, 'Capturing payment…')}>Approve & release {money(m.amount)}</button>
      {vd && vd.releasePct > 0 && vd.releasePct < 100 && <button className="ghost" onClick={() => act('approve', { mid: m.id, pct: vd.releasePct }, 'Partial capture…')}>Release AI-suggested {vd.releasePct}%</button>}
      <button className="ghost" onClick={() => { const r = prompt('What needs to change?'); if (r) act('revise', { mid: m.id, note: r }); }}>Request changes</button>
      <button className="ghost danger" onClick={() => { const r = prompt('Describe the problem for the mediator'); if (r) act('dispute', { mid: m.id, reason: r }, 'Opening dispute…'); }}>Open dispute</button></div>}
    {m.status === 'submitted' && role === 'seller' && <p className="muted">Waiting for buyer review. Auto-release happens after {v.deal.inspectionDays} days with no response.</p>}
    {ds.map((d: any) => <Dispute key={d.id} d={d} role={role} act={act} />)}
    {m.releasedAmount != null && <p className="paid">Paid out {money(m.releasedAmount)}{m.captureId ? ` · capture ${m.captureId}` : ''}</p>}
  </li>;
}

function Dispute({ d, role, act }: any) {
  const [t, setT] = useState(''); const med = d.mediator; const mine = role === 'buyer' ? d.buyerAccepts : d.sellerAccepts;
  return <div className="dispute"><h4>⚖ Dispute opened by {d.openedBy}</h4><p>“{d.reason}”</p>
    {med && <div className="mediator"><b>AI mediator ({med.engine})</b><p>{med.summary}</p><p><b>Buyer:</b> {med.buyerPosition}</p><p><b>Seller:</b> {med.sellerPosition}</p>
      <p className="proposal">Proposal: release <b>{med.proposedReleasePct}%</b> to the seller and refund the rest. {med.rationale}</p>
      {!d.resolution && (mine ? <p className="muted">You accepted. Waiting for the other party.</p> : <button onClick={() => act('accept', { did: d.id }, 'Recording acceptance…')}>Accept proposal</button>)}
      {d.resolution && <p className="paid">{d.resolution}</p>}</div>}
    {!d.resolution && <div className="row2"><input aria-label="Your side of the story" value={t} onChange={e => setT(e.target.value)} placeholder={role === 'seller' ? 'Your side of the story…' : 'Add details…'} /><button className="small" onClick={() => { if (t) { act('respond', { did: d.id, text: t }, 'Mediator is re-evaluating…'); setT(''); } }}>Send to mediator</button></div>}
  </div>;
}
