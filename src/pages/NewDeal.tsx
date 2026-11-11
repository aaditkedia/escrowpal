import { go } from '../navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Copy, FileText, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Footer, Nav } from '../Router';
import { rpc, remember, money, errorText, type Made } from '../api';
import { planInput } from '../shared/validation';
import { riskAssess, type Plan, type PlanMilestone } from '../shared/agent';
const SAMPLE = 'A fictional $1,200 bakery website. Design a homepage and menu mockup; then build a responsive site with an order form; finally document deployment and a handoff walkthrough. Due in 3 weeks.';
export function Risk({ score }: { score: number }) {
  return <span className={'tag '+(score >= 60 ? 'red' : score >= 30 ? 'amber' : 'green')}>{score >= 60 ? 'More scope checks' : score >= 30 ? 'Some scope checks' : 'Fewer scope flags'}</span>;
}
export function NewDeal() {
  const [f, setF] = useState({ description: '', title: '', buyerName: '', sellerName: '', buyerEmail: '', sellerEmail: '', inspectionDays: 3 });
  const [plan, setPlan] = useState<Plan | null>(null); const [step, setStep] = useState(1); const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [made, setMade] = useState<(Made & {qr: string}) | null>(null); const [copied, setCopied] = useState(false);
  const total = plan?.milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0) || 0;
  const assessment = plan ? riskAssess(f.description, total, plan.milestones) : null;
  const update = (key: keyof typeof f, value: string | number) => { setF(old => ({...old,[key]: value})); setAck(false); };
  const edit = (i: number, changes: Partial<PlanMilestone>) => { setPlan(p => p && ({ ...p, milestones: p.milestones.map((m,j) => j === i ? {...m,...changes} : m) })); setAck(false); };
  async function preview() {
    setBusy('Drafting a plan from your brief…'); setErr('');
    try { const p = await rpc<Plan>('preview',{description:f.description}); setPlan(p); setF(old => ({ ...old,title:old.title || p.title })); setStep(2); setAck(false); }
    catch(e) { setErr(errorText(e)); } finally { setBusy(''); }
  }
  async function create() {
    setErr(''); if (!plan || !ack) return;
    const parsed = planInput.safeParse({...plan, title:f.title});
    if (!parsed.success) { setErr(parsed.error.issues[0]?.message || 'Check the milestone fields.'); return; }
    setBusy('Saving your agreement…');
    try {
      const r = await rpc<Made>('create', {...f, plan: {...plan,title:f.title}, acknowledge:true});
      remember({id:r.id,k:r.buyerToken,role:'buyer',title:f.title,savedAt:Date.now()});
      let qr = ''; try { const QR = await import('qrcode'); qr = await QR.toDataURL(location.origin+'/d/'+r.id+'?k='+r.sellerToken,{margin:2,width:180}); } catch { /* The private text link is always available. */ }
      setMade({...r,qr}); setStep(3);
    } catch(e) { setErr(errorText(e)); } finally { setBusy(''); }
  }
  const sellerUrl = made ? location.origin+'/d/'+made.id+'?k='+made.sellerToken : '';
  return <><Nav /><main id="main" className="shell page" tabIndex={-1}>
    <div className="page-heading"><div><p className="eyebrow">Start on the same page</p><h1>A plan you can <em>both agree on.</em></h1><p className="muted">Clear milestones first. Funding after the seller accepts.</p></div><span className="tag green">Sandbox prototype</span></div>
    <ol className="wizard-steps" aria-label="Agreement progress">{['Describe the work','Review the plan','Invite your partner'].map((t,i) => <li key={t} className={step === i+1 ? 'current' : step > i+1 ? 'complete' : ''} aria-current={step === i+1 ? 'step' : undefined}><span>{step > i+1 ? <Check size={14} /> : '0'+(i+1)}</span>{t}</li>)}</ol>
    {made ? <section className="invite-layout card"><div><span className="large-check"><CheckCheck size={30} /></span><p className="eyebrow">The agreement is ready</p><h2>Next, bring your<br /><em>partner in.</em></h2><p>You've signed as the buyer. The seller can review every milestone before accepting. No funding has been recorded.</p><button onClick={() => go('/d/'+made.id+'?k='+made.buyerToken)}>Open my buyer workspace <ArrowRight size={18}/></button></div><div className="invitation"><p className="eyebrow">Private seller invitation</p>{made.qr && <img src={made.qr} alt="QR code containing the private seller link" width={180} height={180}/>}<label htmlFor="seller-link">Send this link only to {f.sellerName}</label><input id="seller-link" readOnly value={sellerUrl} onFocus={e=>e.target.select()}/><button className="btn-outline" onClick={async()=>{try{await navigator.clipboard.writeText(sellerUrl);setCopied(true);}catch{setErr('Select and copy the seller link manually.');}}}><Copy size={16}/>{copied?'Link copied':'Copy private seller link'}</button><p className="muted small">Anyone with this link can act as the seller. This app does not send invitations automatically.</p></div></section> : <div className="create-layout">
      <section className="card create-main">
        {step === 1 ? <form onSubmit={e=>{e.preventDefault();void preview();}}>
          <div className="card-heading"><span className="icon-tile"><FileText size={20}/></span><div><h2>Tell us about the work.</h2><p>Include deliverables, a USD budget, and timing.</p></div></div>
          <label htmlFor="brief">Project brief</label><textarea id="brief" rows={6} minLength={15} maxLength={4000} required value={f.description} onChange={e=>update('description',e.target.value)} placeholder="For $1,200, design a homepage and menu, build a responsive website, then document the handoff. Due in 3 weeks."/>
          <button type="button" className="text-link sample-fill" onClick={()=>{setF({...f,description:SAMPLE,buyerName:'Maya · sample buyer',sellerName:'Alex · sample designer'});setAck(false);}}>Use the fictional bakery brief <ArrowUpRightIcon/></button>
          <div className="row2"><label htmlFor="buyer">Buyer name<input id="buyer" autoComplete="name" required maxLength={80} value={f.buyerName} onChange={e=>update('buyerName',e.target.value)} placeholder="Who's commissioning the work?"/></label><label htmlFor="seller">Seller name<input id="seller" required maxLength={80} value={f.sellerName} onChange={e=>update('sellerName',e.target.value)} placeholder="Who's delivering it?"/></label></div>
          <div className="row2"><label htmlFor="buyer-email">Buyer email <span className="muted">(optional)</span><input id="buyer-email" type="email" value={f.buyerEmail} onChange={e=>update('buyerEmail',e.target.value)} placeholder="buyer@example.com"/></label><label htmlFor="seller-email">Seller email <span className="muted">(optional)</span><input id="seller-email" type="email" value={f.sellerEmail} onChange={e=>update('sellerEmail',e.target.value)} placeholder="seller@example.com"/></label></div>
          <button type="submit" disabled={!!busy}><Sparkles size={17}/>{busy || 'Draft an editable plan'}{!busy && <ArrowRight size={17}/>}</button>
          {busy && <p className="muted small" role="status">The local model may take up to a minute. If it is unavailable, the plan will identify the rules fallback.</p>}
        </form> : plan && <form onSubmit={e=>{e.preventDefault();void create();}}>
          <button type="button" className="text-link" onClick={()=>{setStep(1);setErr('');}}><ArrowLeft size={16}/> Edit the brief</button>
          <div className="card-heading plan-heading"><div><h2>Make this plan yours.</h2><p>Drafted by {plan.engine}. You can edit everything.</p></div><b>{money(total)}</b></div>
          <label htmlFor="deal-title">Agreement title</label><input id="deal-title" required maxLength={120} value={f.title} onChange={e=>update('title',e.target.value)}/>
          {plan.milestones.map((m,i)=><fieldset className="milestone-edit" key={i}><legend><span>0{i+1}</span> Milestone {i+1}</legend><div className="milestone-edit-head"><input aria-label={'Milestone '+(i+1)+' title'} required maxLength={140} value={m.title} onChange={e=>edit(i,{title:e.target.value})}/><button type="button" className="icon-button" aria-label={'Remove milestone '+(i+1)} disabled={plan.milestones.length===1} onClick={()=>{setPlan({...plan,milestones:plan.milestones.filter((_,j)=>i!==j)});setAck(false);}}><Trash2 size={17}/></button></div>
            <div className="row2"><label>Amount in USD<input required type="number" min=".01" max="1000000" step=".01" value={m.amount || ''} onChange={e=>edit(i,{amount:Number(e.target.value)})}/></label><label>Due in days<input type="number" min={1} max={365} value={m.dueInDays || ''} onChange={e=>edit(i,{dueInDays:e.target.value?Number(e.target.value):undefined})}/></label></div>
            <label>Acceptance criteria <span className="muted">· one per line, up to six</span><textarea required rows={m.criteria.length+1} value={m.criteria.join('\n')} onChange={e=>edit(i,{criteria:e.target.value.split('\n')})}/></label>
          </fieldset>)}
          <button type="button" className="btn-outline small" disabled={plan.milestones.length>=8} onClick={()=>{setPlan({...plan,milestones:[...plan.milestones,{title:'',amount:100,criteria:['Describe what must be delivered'],dueInDays:7}]});setAck(false);}}><Plus size={16}/> Add a milestone</button>
          <label htmlFor="review-days" className="review-days">Review target, in days<input id="review-days" type="number" min={1} max={14} required value={f.inspectionDays} onChange={e=>update('inspectionDays',Number(e.target.value))}/></label><p className="muted small">After delivery, this target marks when to follow up. It never triggers automatic release.</p>
          <label className="checkbox-label"><input type="checkbox" checked={ack} required onChange={e=>setAck(e.target.checked)}/><span>I reviewed these amounts and acceptance criteria, and agree to the plan as the buyer. This is a sandbox prototype; no real payment occurs on creation.</span></label>
          <button type="submit" disabled={!!busy || !ack}>{busy || 'Sign as buyer & create agreement'}<ArrowRight size={18}/></button>
        </form>}
        {err && <p role="alert" className="error">{err}</p>}
      </section>
      <aside className="create-aside"><div className="aside-note"><span className="eyebrow">Clarity is the point</span><h2>Define “done”<br /><em>before you start.</em></h2><p>A good milestone names a deliverable, a way to review it, and the amount attached to it.</p><div className="aside-example"><span className="tag green">Example, not a verified result</span><b>Homepage & menu mockup</b><p>Desktop and mobile layouts, with a review link the buyer can open.</p></div></div>
        {assessment && <div className="scope-check"><div className="risk-head"><h3>Scope check</h3><Risk score={assessment.score}/></div>{assessment.risk.length?<ul>{assessment.risk.map(r=><li key={r}>{r}</li>)}</ul>:<p>No configured scope flags were triggered.</p>}<p className="small muted">A rules-based checklist, not a fraud prediction or security assessment.</p></div>}
        <p className="privacy-note">Private links replace accounts in this prototype. Store yours safely and share each role’s link only with that person.</p>
      </aside>
    </div>}
  </main><Footer/></>;
}
function ArrowUpRightIcon(){return <ArrowRight size={15} style={{transform:'rotate(-35deg)'}}/>;}
