# EscrowPal: an AI escrow agent on PayPal

Built for **Build What's Next with PayPal and AI** (Devpost, due Thu Nov 12 2026, 3:00 PM ET).

Freelancers and small online sellers get burned two ways: buyers vanish after work is delivered, or sellers vanish after getting paid. EscrowPal puts an AI agent between them:

1. **Plan**: describe the deal in plain English. The agent splits it into 2–5 milestones with *objectively checkable* acceptance criteria and flags risks (no deadline, one giant milestone, high value).
2. **Fund**: the buyer funds each milestone with PayPal Checkout using `intent=AUTHORIZE`, so money is **held**, not paid.
3. **Deliver**: the seller submits evidence (links, files, notes).
4. **Judge**: the agent checks the evidence against each criterion and recommends release, partial release or dispute.
5. **Release**: the buyer accepts, and the server **captures** the authorization (full or partial) through PayPal Orders v2; a dispute leaves the hold in place (or `void`s it).

Every step lands in an audit trail.

## Stack
- Vite + React + TypeScript (SPA), Vercel serverless functions in `api/`
- PayPal JS SDK (Buttons, sandbox) + PayPal Orders v2 / Payments v2 REST (`api/paypal.ts`: create, authorize, capture, void)
- LLM agent (`api/agent.ts`): any OpenAI-compatible endpoint (Groq Llama 3.3 70B by default) with JSON output. Evidence is treated as untrusted data (prompt-injection guard). If no key is set, a transparent local heuristic runs instead, and the UI labels which engine ran.

## Local setup
```bash
npm i
cp .env.example .env.local   # fill in values (all optional for the demo)
npm run dev                  # UI only; use `npx vercel dev` to also run /api
```
| Variable | Purpose |
|---|---|
| `VITE_PAYPAL_CLIENT_ID` | Sandbox REST app client ID (defaults to PayPal's public `sb` test ID) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Server-side capture/void (sandbox) |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | AI agent; falls back to local heuristic |

## Limitations
Prototype only, sandbox money, not a licensed escrow service. PayPal authorizations are honored for 3 days (29-day validity window), so long milestones need reauthorization. State is kept in localStorage.
