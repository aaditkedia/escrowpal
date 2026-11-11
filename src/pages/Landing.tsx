import { go } from '../navigation';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCheck, CircleDashed, FileCheck2, GitCompareArrows, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Footer, Link, Nav } from '../Router';
import { createDemo, errorText } from '../api';

export function Landing() {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [review, setReview] = useState<'partial' | 'ready'>('partial');
  async function demo() { setBusy(true); setErr(''); try { go(await createDemo()); } catch (e) { setErr(errorText(e)); setBusy(false); } }
  return <><Nav /><main id="main" tabIndex={-1}>
    <section className="hero shell">
      <div className="hero-copy"><div className="eyebrow"><span className="tiny-star">✳</span> A clearer way to work together</div>
        <h1>Great work.<br />Clear terms.<br /><em>Better endings.</em></h1>
        <p className="hero-description">Turn “I’ll pay when it’s done” into a plan you both understand. Agree on milestones, review delivery, and decide what gets paid.</p>
        <div className="hero-actions"><button className="btn-dark" onClick={demo} disabled={busy}>{busy ? 'Preparing your sample…' : 'Explore the live demo'}<ArrowUpRight size={20} /></button><Link to="/new" className="text-link">Create an agreement <ArrowRight size={17} /></Link></div>
        <div className="hero-assurance"><span><Check size={15} /> No account needed</span><span><Check size={15} /> No real money in the demo</span></div>
        {err && <p role="alert" className="error">{err}</p>}
        <div className="hero-footnote"><span className="line" /> Built with PayPal’s sandbox authorization & capture APIs.</div>
      </div>
      <div className="hero-visual" aria-label="Illustrative milestone review">
        <div className="visual-label"><span className="dot" /> A little less “trust me.” A lot more clarity.</div>
        <div className="sample-window">
          <div className="window-bar"><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /><span>escrowpal / sweet-crumb</span><LockKeyhole size={12} /></div>
          <div className="sample-room-head"><div><p className="eyebrow">Fictional sample agreement</p><h2>A fresh start for<br />Sweet Crumb.</h2></div><div className="sample-total"><small>Project total</small><b>$1,200<span>.00</span></b></div></div>
          <div className="sample-parties"><span className="avatar mint">M</span><span>Maya <small>Buyer</small></span><span className="party-line" /><span className="avatar peach">A</span><span>Alex <small>Designer</small></span><span className="tag green">Agreed</span></div>
          <div className="sample-milestone"><div className="sample-step"><span className="number-square">01</span><div><b>Direction & design</b><small>Milestone one · $300.00</small></div><span className="tag amber">In review</span></div>
            <div className="sample-review"><div><Sparkles size={16} /><b>A second pair of eyes.</b><span className="tag neutral">Illustrative</span></div><p>{review === 'partial' ? 'The homepage is described. Mobile layouts and a review link still need attention.' : 'All three delivery claims are addressed. The buyer still checks the work and chooses what to do.'}</p>
              <ul className="sample-checks"><li><CheckCheck size={16} /> Homepage & menu mockup</li><li className={review === 'partial' ? 'missing' : ''}>{review === 'partial' ? <CircleDashed size={16} /> : <CheckCheck size={16} />} Mobile layout</li><li className={review === 'partial' ? 'missing' : ''}>{review === 'partial' ? <CircleDashed size={16} /> : <CheckCheck size={16} />} Design review link</li></ul>
            </div>
            <div className="sample-toggle" aria-label="Illustrative review scenario"><button aria-pressed={review === 'partial'} onClick={() => setReview('partial')}>Needs a little more</button><button aria-pressed={review === 'ready'} onClick={() => setReview('ready')}>Claims addressed</button></div>
          </div>
          <div className="sample-next"><span className="number-square muted-square">02</span><span>Build & handoff</span><b>$600.00</b><LockKeyhole size={14} /></div>
        </div>
        <div className="human-note"><span className="hand-arrow">↳</span> AI advises.<br /><em>You decide.</em></div>
        <div className="floating-note"><ShieldCheck size={22} /><div><b>Your call, every time.</b><span>No automatic payment release.</span></div></div>
      </div>
    </section>
    <div className="market-entry shell"><div><Sparkles size={20}/><span><b>Start with the market. Then agree on the work.</b><small>Evidence checks, a Laya comparison, and a pilot linked to PayPal milestones.</small></span></div><Link to="/market" className="btn btn-outline small">Explore market briefs <ArrowRight size={16}/></Link></div><section className="principle-strip"><div className="shell"><span>Small steps.<br /><b>Shared confidence.</b></span><p><FileCheck2 /> Agree on “done”</p><p><LockKeyhole /> Authorize by milestone</p><p><GitCompareArrows /> Resolve with both sides</p></div></section>
    <section className="shell section how" id="how-it-works"><div className="section-heading"><div><p className="eyebrow">From brief to better agreement</p><h2>Good relationships<br />start with <em>clear expectations.</em></h2></div><p>One shared workspace for the scope, the proof, and the conversation that follows.</p></div>
      <div className="feature-grid">
        <article className="feature"><span className="feature-number">01 / MAKE A PLAN</span><div className="feature-icon"><FileCheck2 /></div><h3>A brief becomes<br />something concrete.</h3><p>The planner drafts milestones and acceptance criteria from your scope. Edit every amount and every word before signing.</p><span className="feature-bottom">Human reviewed from the start <ArrowUpRight size={17} /></span></article>
        <article className="feature"><span className="feature-number">02 / SHOW THE WORK</span><div className="feature-icon"><Sparkles /></div><h3>Less guesswork.<br />A clearer review.</h3><p>Share a delivery note and a proof file. The reviewer compares the written claims with the agreed criteria and highlights gaps.</p><span className="feature-bottom">Files and links need your own inspection <ArrowUpRight size={17} /></span></article>
        <article className="feature"><span className="feature-number">03 / CLOSE IT WELL</span><div className="feature-icon"><GitCompareArrows /></div><h3>Agree on the next step.<br />Then take it.</h3><p>Approve, request changes, or discuss a split. A mediated settlement needs both parties to accept the same proposal.</p><span className="feature-bottom">A record you can take with you <ArrowUpRight size={17} /></span></article>
      </div>
    </section>
    <section className="shell section closing"><div className="closing-copy"><p className="eyebrow">Try both sides of the conversation</p><h2>Be the buyer.<br />Be the designer.<br /><em>See the whole picture.</em></h2><p>The sample workspace includes a fictional $1,200 agreement and an incomplete first delivery. Switch roles, request changes, and try a settlement. Nothing moves real money.</p><button onClick={demo} disabled={busy}>Open the sample workspace <ArrowRight size={18} /></button></div>
      <div className="faq"><h3>A few things to know.</h3><details><summary>Does the AI make payment decisions?</summary><p>No. It reviews the completeness of written delivery claims. It does not visit links or inspect file contents. The buyer or both parties must explicitly approve a settlement.</p></details><details><summary>Is this real escrow?</summary><p>This is a hackathon prototype using PayPal sandbox authorizations and captures, with an explicit simulated ledger for the demo. It is not a licensed escrow service. Captures go to the configured sandbox merchant; seller payouts are not implemented.</p></details><details><summary>What happens if the review target passes?</summary><p>The room marks the review as overdue. Funds are never automatically released. Real sandbox authorizations are subject to PayPal’s validity limits.</p></details><details><summary>Can I export the agreement?</summary><p>Yes. Download an agreement PDF and a JSON evidence receipt with a SHA-256 digest. The digest helps check the export’s integrity; it does not prove that delivery claims are true.</p></details></div>
    </section>
  </main><Footer /></>;
}
