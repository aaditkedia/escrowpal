# Run and inspect the tests

Use Node.js 24 LTS, install the locked dependencies, and provision Chromium once:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm run lint
npm run test:e2e
```

`test:e2e` builds the production client, chooses a free loopback port, and starts the actual RPC handler with a new persistent PGlite database. It explicitly clears hosted-database, payment, and model settings for the server process, including values that could otherwise come from local environment files. The browser contexts are isolated. Market browser checks block and report requests to external origins. No model preparation command runs, and the test needs no account sign-in or vendor credentials.

The runner closes its own server, restarts it against the same temporary database, verifies persisted agreements and analysis digests, then removes its temporary database and private role-link fixtures. It leaves the normal application database untouched. JSON reports, screenshots, generated fictional PDFs, receipts, and logs are written under the ignored `test-results/` directory.

## Coverage

- Existing agreement flow: editable plan, explicit buyer acknowledgement, seller acceptance, revision requests, attachment upload, advisory review, dispute proposals, matching acceptance, exact settlement, PDF and full evidence receipt.
- Market flow: recorded example and truthful recorded label, reload, analysis export and digest, reviewed manual override, consent reset after changing the choice, sealed analysis binding, exact-cent milestones, separate buyer/seller contexts, simulated holds, delivery and attachment download, disputes, full and zero-percent settlements, completed ledger and export.
- Access and recovery: invalid private links, wrong-role mutations, funding before seller signature, settlement replay, disabled model service, missing evidence, an injected API outage, visible error and successful retry.
- Persistence: an ordinary agreement, completed market ledger and immutable analysis survive server restart.
- Browser probes: axe scans on the brief, analysis and completed market pilot; reflow at 320, 360, 768 and 1280 CSS pixels. The older interface audit also checks landing, plan and agreement views. The existing confirmation check exercises focus containment and Escape cancellation.

The test artifacts identify intentional 403 access failures, the injected 503, and Chromium's expected aborted navigation for a successfully downloaded attachment. Other page errors or failed market requests fail the run. The application has one light theme; there is no theme-switch test.

## Inspect the result

Start with `test-results/e2e-summary.json`. Then inspect `browser-workflow.json`, `market-workflow.json`, `interface-audit.json`, the raw `axe-market-*.json` files, and the screenshots. A failed assertion exits with a nonzero code. The historical published result is in `verification/e2e-2026-11-10.json`; it describes the tested run, not a promise about future versions.

To run individual probes against an application you already started:

```sh
ESCROWPAL_BASE_URL=http://127.0.0.1:4173 npm run test:browser
ESCROWPAL_BASE_URL=http://127.0.0.1:4173 npm run test:market-browser
ESCROWPAL_BASE_URL=http://127.0.0.1:4173 npm run audit:ui
```

For a local production-client preview with the real API, run `npm run build`, then `npm run dev -- --production`. This is a local verification server, not a deployment recipe.

## External boundaries

Unit/API tests mock model and PayPal network responses. The browser suite uses actual UI, RPC and database operations, rules-based advisory responses, a saved historical Laya example and explicitly simulated payment holds. It does not load Laya, download weights, assess model accuracy, or complete a real PayPal checkout. A credential-backed PayPal sandbox authorization/capture/void remains unverified. Hosted Neon/Vercel behavior, other browser engines, performance budgets, full keyboard traversal, expanded translations and a complete manual accessibility review are also outside this run.
