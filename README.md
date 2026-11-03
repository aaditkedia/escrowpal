# EscrowPal: two-sided AI escrow on PayPal

Built for **Build What's Next with PayPal and AI** (Devpost, due Thu Nov 12 2026, 3:00 PM ET). Live demo: https://escrowpal.vercel.app

Freelancers and small online sellers get burned two ways: buyers vanish after the work is delivered, or sellers vanish after getting paid. EscrowPal puts an AI agent between the two sides. **The AI never moves money on its own.** It drafts, checks, flags and mediates, and only the people involved can release or refund funds.

## Features (v2)
- **AI deal planner**: turns a plain-English deal into 2–5 milestones with checkable acceptance criteria, due dates and an inspection window. Milestones stay editable.
- **Risk score (0–100)**: flags scam patterns, urgency pressure, off-platform payment requests, missing deadlines, all-up-front structures and high value.
- **Two-sided deal room**: separate secret links for buyer and seller. Roles are enforced on the server. The seller must sign the terms before any money is held.
- **PayPal holds**: each milestone is funded with Checkout `intent=AUTHORIZE`. Release triggers a server-side **capture** (full or partial), and a refund triggers a **void**. Without sandbox credentials it falls back to a clearly labelled demo hold.
- **Proof uploads**: files up to 2.5 MB plus links and notes. Files are served only to deal parties, under a strict CSP.
- **AI judge**: checks the evidence against each criterion (pass / partial / fail). A prompt-injection guard treats evidence as untrusted data.
- **Approve, partial release or revision request**.
- **Auto-release**: if the buyer is silent once the inspection window has passed, the milestone is released (inspired by real escrow services).
- **Disputes with an AI mediator**: both sides state their case. The mediator proposes a split with reasoning, the deal settles when both accept, and funds are split by capture + void.
- **Activity feed and comments**, with 15 s live refresh. Every action is recorded in an audit log.
- **Contract PDF** with the terms, signatures and audit trail.
- **My deals** dashboard (links saved on this device), plus seller invite by link, QR or email.

## Stack
- Vite + React + TypeScript SPA. Vercel functions: `api/rpc.ts` (single RPC endpoint) and `api/_lib/*`.
- **Neon Postgres + Drizzle ORM** (`api/_lib/schema.ts`, migrations in `drizzle/`). Tables: deals, milestones, evidence, disputes, events.
- PayPal JS SDK + Orders v2 / Payments v2 REST (`api/_lib/paypal.ts`).
- LLM via any OpenAI-compatible API (Groq Llama 3.3 70B by default) with JSON output. When no key is set, transparent local rules run instead, and the UI shows which engine was used.
- Tests: `npm test` (vitest) and `node scripts/e2e-api.mjs <url>`, a full live API run (plan → sign → hold → proof → release → dispute → settle).

## Setup
```bash
npm i
cp .env.example .env.local
npx drizzle-kit migrate      # needs DATABASE_URL
npx vercel dev
```
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `VITE_PAYPAL_CLIENT_ID` | Sandbox REST app client ID (defaults to PayPal's public `sb` ID) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real sandbox authorize, capture and void. Without them, demo holds are used |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | AI planner, judge and mediator. Without them, local rules are used |

## Security notes
Auth uses capability links: unguessable 24-character tokens, one per role. Pages send `Referrer-Policy: no-referrer`. This is a prototype using sandbox money; it is not a licensed escrow service. PayPal honors authorizations for 3 days (29-day validity window), so long milestones need reauthorization.

## Inspirations
AutoTrust AI Escrow, Agent Pay, Flow8 and AutoTrust PayMesh on Devpost, plus Escrow.com's inspection period. See PLAN.md.
