# EscrowPal 4 — market evidence to measured pilots

EscrowPal connects a market brief, a bounded Laya comparison, a reviewed pilot agreement, and PayPal sandbox milestone payments.

Watch the new market-to-pilot walkthrough. [YouTube demo](https://youtu.be/36SAwZgmN_c)

The hackathon project page is on Devpost. [EscrowPal](https://devpost.com/software/escrowpal)

## Start locally

Use Node.js 24 LTS.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173/market**. Choose **Open recorded Laya example · no model loads** to explore the complete market-to-agreement workflow without loading a model. Quotes, counts, and participants in the example are fictional.

**Laya is disabled locally in this delivery. No model weights are bundled.** The app does not automatically download or start Laya. The recorded example contains an actual earlier Laya response and clearly labels it as recorded. New analyses without a configured model still compute evidence checks and observed ratios, but show the model recommendation as unavailable.

The existing buyer/seller workspace, delivery review, dispute workflow, PDF export, and evidence receipts remain available. Optional Ollama configuration for those earlier workflows remains separate from the Laya integration.

## The pipeline

1. **Declared evidence:** two or three candidate channels/offers, dated source references, quoted costs, and optional observed click/impression counts.
2. **Observed signals:** compute price comparisons, source coverage, affordability and CTR from the supplied counts. Source contents are not fetched or independently verified.
3. **Laya comparison:** send bounded choice questions with listed and reversed option orders. Validate every option and probability. A changed choice produces manual review; missing/invalid responses produce no substituted model result.
4. **Reviewed pilot:** choose a candidate, explain a manual override when applicable, review exact-cent research/delivery/reporting milestones, and sign as buyer.
5. **PayPal milestones:** seller acceptance precedes authorization. The server-created order includes the sealed market-analysis digest in PayPal's custom_id and its milestone in reference_id. Capture/void decisions remain explicit human actions.

The analysis snapshot is stored in PostgreSQL and exported with a reproducible SHA-256 digest. Its digest follows into the agreement, payment-order metadata, activity record, agreement PDF, and evidence receipt. A digest checks a saved record's integrity, not the truth of its source claims.

## Accuracy and training scope

**84% accuracy is an owner-reported figure.** Its benchmark task, holdout, and applicability were not independently verified for this build. It is not presented as validated market-decision accuracy.

A separate preserved GPU research run completed four epochs on a Tesla T4. It evaluated delayed brand recall on 605 held-out ads across 58 advertiser groups, with 20.75 percentage points of mean absolute error. That regression metric is not classification accuracy. Creative text did not demonstrate additional benefit over the metadata control in that experiment.

The private research weights, dataset, source project, and detailed experimental implementation are excluded. The optional serving integration uses a separate public pretrained Laya checkpoint. Current market-choice accuracy is unmeasured.

## Optional Laya endpoint — only when explicitly enabled

For an existing compatible endpoint, privately set:

```dotenv
LAYA_BASE_URL=https://your-model-service
LAYA_API_KEY=
```

The adapter calls POST /v1/systemone with typed choice questions. It accepts only known options, normalized finite probabilities, and an allowed winning choice. The model never receives a payment tool.

The optional companion source is under services/laya. Its preparation command downloads approximately 1.7 GB of pinned public ONNX weights and verifies their hashes. **Do not run these commands until you want to install and load a local model:**

```sh
npm run laya:prepare
npm run laya:start
```

The public model is [Laya by Convai Innovations](https://huggingface.co/convaiinnovations/laya), accessed through [@receptron/laya](https://github.com/receptron/laya). The model has Apache-2.0 terms; the SDK has MIT terms. Neither is represented as a model trained by EscrowPal. A remote model service must use HTTPS; nonlocal companion binding requires a strong API key.

## PayPal sandbox configuration

Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET privately for a PayPal sandbox REST app. The server creates AUTHORIZE orders, verifies authorization reference/status/currency/amount, and issues final capture or void requests with stable operation IDs.

Missing credentials do not silently simulate a vendor payment. Users explicitly choose a demo hold. Demo ledger entries never call PayPal. No real-world funds move in the demo.

There is no automatic release after a review target passes. A partial capture leaves the remainder uncaptured; it is not a refund of previously captured money. Captures credit the configured sandbox merchant, not a seller payout. Uncertain vendor results block automatic retries and require reconciliation.

A credential-backed PayPal sandbox transaction was not performed in this upgrade. PayPal order binding and failure behavior were verified with mocked vendor responses.

## Storage and hosting

Local PGlite initializes persistent PostgreSQL data in .data/escrowpal. Run one process against that directory. Hosted deployments use Neon through DATABASE_URL. The two migrations are under drizzle.

For an intended hosted database, set DATABASE_URL in .env.local, then run npm run db:migrate. Vercel builds with npm run build and serves dist plus api/rpc.ts. Optional model endpoints must be reachable from the hosting environment.

## Verification record

Before local Laya execution was disabled, 71 logic/database/API tests passed. They cover payment state, market validation, stable option parsing, manual-override rules, immutable analysis receipts, and PayPal order metadata. A real Laya market-choice canary also completed before the stop request.

After the final changes, frontend/API type checks, lint, and the production build passed. No further model tests, training, or local inference were run after the owner requested stopping.

See VERIFICATION.md, submission/DEVPOST_DRAFT.md, and submission/CLAIMS.md. The new narrated walkthrough covers the market brief, saved Laya comparison, pilot agreement, simulated authorization, and exports. [YouTube demo](https://youtu.be/36SAwZgmN_c)

## Limits

This is a hackathon prototype, not a licensed escrow service or validated market forecasting product. There is no production custody, seller payout system, identity verification, link revocation, or reconciliation console. The model reviews bounded declared evidence and does not prove that linked work or source statements are correct. Private role links are bearer credentials; protect them.

MIT license applies to this independently implemented integration and app source. Third-party components retain their own terms.
