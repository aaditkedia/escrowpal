# Latest verification — November 10, 2026

A clean anonymous clone of the public `submission/laya-market` branch was tested in a separate Debian checkout. The original working baseline was preserved.

- 71 logic/database/API tests passed; model and payment responses were mocked.
- Frontend, API and local-server type checks, lint and production build passed.
- Production-client browser run: 15 existing workflow checks and 13 market checks passed, with the real RPC handler and isolated persistent PGlite.
- Separate seller/buyer contexts exercised signature, simulated funding, delivery attachment download, dispute acceptance, capture and zero-percent settlement.
- PDF exports and SHA-256 analysis/evidence receipts verified; role keys were absent from receipts.
- Invalid private links, wrong-role actions, pre-signature funding, replay, missing evidence, disabled Laya and injected outage recovery were exercised.
- Axe scans reported zero violations on the tested market screens; 320/360/768/1280px reflow passed. The existing seven-view interface audit passed.
- A real server restart preserved an ordinary agreement, completed market ledger and sealed analysis digest.
- Production dependency audit: zero reported vulnerabilities. The install reports four moderate development-only advisories; no forced dependency upgrades were applied.

No live model was loaded or benchmarked. No payment network call was made by the browser suite. A credential-backed PayPal sandbox checkout/authorization/capture/void, hosted deployment and a full manual accessibility review remain unverified.

Reproduction and skipped coverage: [docs/TESTING.md](docs/TESTING.md). Machine-readable result: [verification/e2e-2026-11-10.json](verification/e2e-2026-11-10.json).

---

## Earlier delivery record

# EscrowPal 4 — verification and execution boundary

## Completed before model execution was stopped

- 71 tests passed in seven files, including 24 database/API workflow checks.
- Existing settlement, access-control, attachment and receipt cases passed.
- New checks covered declared market evidence, observed CTR, exact cents, missing/stale references, invalid model outputs, option-order disagreement, manual selections, source-digest preservation, and PayPal custom_id/reference_id binding.
- Payment-network responses in these tests were mocked.
- One actual Laya market-choice canary completed on the pinned public ONNX export before the stop request. It chose the same fictional candidate in both option orders. This was an inference check, not an accuracy evaluation or GPU training run.

## After the owner requested no local Laya loading and no further model tests

- The new local Laya process was stopped.
- The newly downloaded VM model cache was removed.
- LAYA_BASE_URL was cleared from the local app environment.
- The temporary extra VM swap allocation was removed.
- The owner's existing private training setup and model files were not changed.
- No additional model inference, training, or model tests were run.
- Frontend/API TypeScript, lint, and production build completed successfully after the integration changes.
- A clearly labelled recorded example was added so the workflow can be explored without a model.

## Accuracy scope

84% is recorded as an owner-reported accuracy figure. Its task, evaluation data, holdout, and connection to the current market workflow were not independently verified here. Current market-decision accuracy is unmeasured.

A separate preserved GPU experiment is summarized in research-evidence.ts: Tesla T4, four epochs, 605 held-out ads, 58 advertiser groups, delayed-recall MAE 20.7505929485 percentage points. That is regression error, not 84% classification accuracy. Its detailed implementation and weights are not included.

## Remaining external verification

A real PayPal sandbox checkout/authorization/capture still needs a test using sandbox credentials. No production payment, public deployment, repository publication, YouTube upload, or Devpost submission was performed.

The earlier release's responsive and accessibility checks remain historical evidence. The added market interface was compiled and visually previewed; no new claim of a complete accessibility certification is made.
