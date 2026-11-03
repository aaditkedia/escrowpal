# EscrowPal: plan, demo script, Devpost draft

**Hackathon:** Build What's Next with PayPal and AI. https://paypalaihackathon.devpost.com
**Deadline:** Thu Nov 12 2026, 3:00 PM ET. **Rule:** must meaningfully use PayPal *and* AI; working prototype; documentation; text description (+ video; check the submission form).
**Sponsor tools (optional, may have own prizes):** AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic, KERNEL, Postman, Render, Zapier.

## Status (Nov 2)
- [x] Agent planning + judging (local heuristic working; LLM path coded in `api/agent.ts`)
- [x] PayPal sandbox Buttons with `intent=AUTHORIZE` (uses public `sb` client ID)
- [x] Server capture/void route (`api/paypal.ts`), needs sandbox creds
- [x] Audit trail, risk notes, partial release
- [x] Deployed on Vercel

## Remaining steps
1. **Aadit:** sign in at developer.paypal.com (needs his login), create a sandbox REST app, and give me Client ID + Secret, then set `VITE_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` on Vercel. Switch the frontend to server-created orders (`api/paypal` create→authorize) so the capture is real end to end.
2. Get a free LLM key (Groq or Gemini) → `LLM_API_KEY`. Test plan + judge prompts; keep the heuristic as fallback.
3. Persist deals in Neon Postgres (Drizzle: `deals`, `milestones`, `events`) and add shareable buyer/seller links (two roles, two views).
4. PayPal webhooks (`PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`) → audit trail.
5. Stretch for sponsor prizes: Elastic for evidence search / dispute precedent; Zapier trigger on release; Postman collection of the API.
6. Optional: PayPal Payouts to split a capture between seller and a subcontractor.
7. Record a 2–3 min video (Kokoro hm_omega voice), screenshots, then submit **after Aadit OKs**.

## Demo script (~2:30)
1. 0:00 Problem: "Half of freelancers have been stiffed at least once; buyers get burned too."
2. 0:20 Paste the bakery landing-page deal → agent creates 3 milestones with checkable criteria and risk notes.
3. 0:50 Buyer funds milestone 1 via PayPal sandbox; the stats show **held by PayPal**, not paid.
4. 1:15 Seller submits weak evidence → agent says PARTIAL 50% and lists what's missing. Seller resubmits full evidence → RELEASE 100% → capture.
5. 1:50 Show a dispute: hold stays, nothing moves.
6. 2:10 How it works: PayPal Orders v2 authorize/capture/void + LLM agent with injection-safe judging. Close on impact.

## Devpost draft
**Name:** EscrowPal
**Tagline:** An AI escrow agent that holds PayPal funds per milestone and releases them only when the work checks out.
**Inspiration:** Freelancers and small sellers trade with strangers. Today it's "pay first and hope" or "work first and hope."
**What it does:** It turns a plain-English deal into checkable milestones, funds each one as a PayPal authorization hold, has an AI agent judge delivered evidence against the criteria, and captures the funds (full or partial) only when the buyer accepts. Disputes keep the hold in place. Everything is logged.
**How we built it:** React + TypeScript on Vercel; PayPal JS SDK Buttons with intent=AUTHORIZE; Orders v2 + Payments v2 capture/void in a serverless route; an OpenAI-compatible LLM agent with JSON output and prompt-injection guarding, with a deterministic fallback.
**Challenges:** Making acceptance criteria objective enough for an AI to judge, and mapping partial delivery to partial capture.
**What's next:** Two-sided links, webhooks, Payouts for subcontractor splits, and an arbitration panel for disputes.
**Built with:** react, typescript, vite, vercel, paypal-js-sdk, paypal-orders-api, llm, groq


## v2 (Nov 2) — what changed and why
Researched acclaimed projects and borrowed their best ideas:
- AutoTrust AI Escrow (https://devpost.com/software/provera): AI verification plus auto-release. We added an inspection window with auto-release.
- Agent Pay (https://devpost.com/software/agent-pay-v8fuwn): partial refunds by score, and the AI never holds keys. We added partial capture plus void, with release decided by people only.
- Flow8 (https://devpost.com/software/flo8): milestone dashboard. We added a timeline stepper and a My deals page.
- AutoTrust PayMesh: multi-agent arbiter with an audit trail. We added an AI mediator, signed-terms audit and a contract PDF.
- AgentEscrow (https://devpost.com/software/agentescrow-8fqcps) is a direct competitor in this hackathon (agent-to-agent negotiation). We stand apart with human two-sided roles, risk scoring, a prompt-injection guard and the dispute mediator.

Done: Neon + Drizzle persistence, capability-link roles, seller signature, proof uploads (stored as Postgres bytea instead of Vercel Blob), AI judge and mediator, risk score, activity feed, contract PDF, landing page, tests and live API e2e.

Still blocked on Aadit:
1. PayPal sandbox app credentials (developer.paypal.com login).
2. A Groq or Gemini API key for the real LLM. Local rules are used until then.
3. Email magic links would need an email provider. Capability links are used for now.
4. Record the demo video and submit on Devpost.
