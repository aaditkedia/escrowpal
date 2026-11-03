import { Link, Nav } from '../Router';
const RIBBON = ['Milestone escrow', 'PayPal authorization holds', 'AI acceptance review', 'Dispute mediator', 'Partial releases', 'Risk scoring', 'Signed contracts', 'Audit trail'];
export function Landing() {
  return <>
    <header className="hero">
      <Nav />
      <div className="hero-inner">
        <p className="eyebrow">ESCROWPAL · AI ESCROW ON PAYPAL</p>
        <h1 className="display">Pay for work<br /><em>only when it’s done.</em></h1>
        <div className="rule" />
        <p className="lede">Describe a freelance job or an online sale in plain English. An AI agent turns it into checkable milestones. The buyer’s money sits as a PayPal hold, and it moves only when the delivery passes review or both sides accept a mediated split.</p>
        <div className="cta"><Link to="/new" className="btn light">Start a protected deal</Link><a href="#how" className="btn outline">See how it works</a></div>
      </div>
      <div className="ribbon" aria-hidden="true"><div className="track">{[...RIBBON, ...RIBBON, ...RIBBON].map((r, i) => <span key={i}>{r}<b>✦</b></span>)}</div></div>
    </header>
    <main className="land">
      <section id="how" className="steps">
        {[['01', 'Describe', 'Paste the deal. The agent drafts 2–6 milestones with objective acceptance criteria, due dates and a 0–100 risk score that flags scam patterns such as gift cards or off-platform payment.'],
          ['02', 'Sign & fund', 'The seller opens a private link and accepts the terms. The buyer funds each milestone with PayPal using intent=AUTHORIZE, so the money is held and not yet paid.'],
          ['03', 'Deliver & review', 'The seller uploads proof. The AI reviewer checks each criterion, ignores prompt-injection tricks in the evidence, and recommends release, partial release or revision.'],
          ['04', 'Release or mediate', 'The buyer releases funds, and the server captures the hold through PayPal. In a dispute, the AI mediator summarizes both sides and proposes a split that settles only when both accept. Silence past the inspection window auto-releases.']]
          .map(([n, t, d]) => <article key={n}><span className="num">{n}</span><h2>{t}</h2><p>{d}</p></article>)}
      </section>
      <section className="why">
        <h2 className="display small">Built for freelancers and small online sellers</h2>
        <p>Many freelancers report being paid late or not at all, and buyers get burned by no-shows. Traditional escrow charges about 3% or more and takes days. EscrowPal uses PayPal holds that people already trust, plus an agent that does the tedious checking, and keeps a human in control of every dollar.</p>
        <Link to="/new" className="btn">Create your first deal</Link>
      </section>
    </main>
    <footer className="foot">EscrowPal · Built for the PayPal AI Hackathon · PayPal sandbox · Not a licensed escrow service</footer>
  </>;
}
