# Claim ledger — EscrowPal 4

| Claim | Status and scope |
| --- | --- |
| Laya integration | Typed decision adapter and optional pinned ONNX companion source implemented. Local model is disabled. |
| Recorded example | Actual earlier response on fictional market data, explicitly marked recorded. Opening it does not load a model. |
| 84% accuracy | Owner-reported only. Benchmark task, holdout and applicability unverified here. Not current market accuracy. |
| GPU training completed | Preserved historical research run: Tesla T4, four epochs; private weights excluded. |
| 605 held-out ads / 58 advertiser groups | Historical delayed-recall evaluation, separate from current market decisions. |
| 20.75 pp MAE | Historical recall-regression error. Not classification accuracy or a sales metric. |
| 71 tests passed | Before the request to stop model testing; payment and model response fixtures are identified as mocked. |
| Final type/lint/build checks | Passed after the integration changes. |
| Analysis-to-PayPal binding | Digest in custom_id, milestone in reference_id; verified with mocked vendor responses. |
| Real sandbox transaction | Not performed in this upgrade. |
| Market source verification | User-supplied references are recorded; their contents are not independently fetched or validated. |
| Deployment / submission | Not done for this upgraded release. |

The public package contains no private source project, training data, private checkpoint, API key, model endpoint credential, or private project path. Public model and dependency credits remain intact.
