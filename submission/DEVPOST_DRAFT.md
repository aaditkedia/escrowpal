## Inspiration

A market recommendation is only the beginning. A small business still needs to decide what to test, agree on what will be delivered, and approve when that work should be paid for.

EscrowPal connects those steps: **evidence → decision → agreed pilot → PayPal milestones → portable record**.

## What it does

Start with a market brief: audience, objective, budget, two or three candidate channels, quoted costs, dated references, and optional observed clicks and impressions. EscrowPal calculates observed response rates and affordability checks, keeping source claims visible for human inspection.

Laya provides the constrained decision layer. Its adapter compares the candidates in both option orders and validates the returned choices and probabilities. A changed winner calls for manual review. An unavailable model produces no fabricated recommendation.

The buyer reviews the choice, or explains a manual alternative, then approves a pilot with research, delivery, and reporting milestones. Amounts are allocated in exact cents. The seller reviews and accepts the agreement before funding opens.

PayPal sandbox authorization is separate from the model decision. The order binds the milestone and the saved analysis digest. Final capture or void requires explicit approval; a dispute settles only after both people accept the same proposal.

Delivery notes, proof files, advisory review, an agreement PDF, and evidence receipts keep the work and its reasoning together. A review target passing never automatically releases a payment.

## How we built it

React, TypeScript, and Vite power the interface. A Node API uses Zod validation and Drizzle/PostgreSQL, with local persistent PGlite and a Neon hosting option.

The Laya adapter accepts typed candidate choices from an optional compatible endpoint. The optional companion service uses a pinned public ONNX checkpoint through @receptron/laya. Ollama supports the separate milestone-drafting, delivery-claim review, and mediation workflows.

PayPal sandbox orders use authorization intent, stable request IDs, final capture or void, and guards against duplicate settlement. An immutable analysis digest flows into the agreement, PayPal custom_id, and exportable record; the milestone is carried in reference_id.

## Challenges we ran into

A model preference must become a useful next step without becoming permission to spend. We kept model selection, agreement acceptance, delivery review, and payment approval as separate decisions.

We also handle order-sensitive recommendations, missing evidence, stale dispute proposals, duplicate settlement attempts, and uncertain payment responses. Advisory scores stay distinct from observed response rates and confirmed payment state.

## Accomplishments that we're proud of

- One path from market evidence to a reviewed, budgeted pilot.
- A decision trace that stays attached to the agreement and payment metadata.
- Explicit buyer and seller acceptance, with no timed automatic release.
- Exportable agreement, analysis, and delivery records.
- 71 logic and API tests passed in the prior integration run; the final source also passed type, lint, and production-build checks. PayPal vendor responses in those checks were mocked.

## What we learned

A useful AI workflow needs a measurable next action. EscrowPal turns a recommendation into a small pilot with deliverables, a budget, and a record people can inspect.

The research background includes a completed four-epoch Tesla T4 fine-tune for delayed brand recall, evaluated on 605 held-out ads across 58 advertiser groups at 20.75 percentage points mean absolute error. This separate regression result does not measure current market-choice accuracy. An 84% accuracy figure is owner-reported; its benchmark scope is unverified for this build.

## What's next for EscrowPal

Record a credential-backed PayPal sandbox checkout, validate the hosted release, and evaluate market choices on an independent benchmark.

The new demo uses a clearly labelled saved Laya comparison on fictional bakery data. Local Laya inference stays disabled. Payment entries shown are simulated. The PayPal adapter is implemented, but a real sandbox transaction has not been verified. Captures credit the configured sandbox merchant; seller payouts are not implemented. EscrowPal is a hackathon prototype.


Watch the narrated demo. [YouTube](https://youtu.be/36SAwZgmN_c)
