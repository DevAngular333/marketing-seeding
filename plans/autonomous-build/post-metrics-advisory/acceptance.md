# Post-level metrics advisory context — Acceptance

## Requirements

- **A1** Reuse each campaign post's exact existing `postAttributions` metrics and deterministic latest snapshot; do not mix metrics between posts.
- **A2** Derive a deterministic bounded per-post assessment that distinguishes `RESPONSE_OBSERVED`, `REACH_WITHOUT_RESPONSE`, `MEASURED_NO_RESPONSE`, `PARTIAL_MEASUREMENTS`, `UNKNOWN_OR_UNSUPPORTED`, and `UNOBSERVED`.
- **A3** Count assessments across the full normalized campaign attribution set, preserve risk-prioritized truncation and late `UNKNOWN`, and keep snapshot evidence references bounded and redacted.
- **A4** Include the assessment/count summary only in existing advisory learning feedback and strategy learning context. Do not change the selected learning action or strategy action/precedence.
- **A5** Reject malformed, foreign-post, or target-drift attribution from current strategy context; authoritative `UNKNOWN` continues to dominate and hides learning context.
- **A6** Repeated derivation/control-cycle execution and restart preserve deterministic feedback/decision identity for the same persisted evidence/time bucket.
- **A7** The milestone creates no posts, requests, grants, windows, leases, publication attempts, browser actions, or external effects.

## Constraints

- **C1** Reuse the existing outcome attribution, learning normalizer, strategy context validation and `SeedingService` control cycle; do not add a store, model provider, router or state machine.
- **C2** Do not infer platform support, success rates, causal lift or business recommendations from metric presence alone.
- **C3** Do not mutate canonical runtime, historical UNKNOWN records, credentials, browser sessions or social platforms.

## Verification

- **V1** Unit tests cover each metric classification, mixed/invalid coverage and bounded evidence.
- **V2** Integration tests prove exact post isolation, deterministic latest snapshot identity, target/post validation, UNKNOWN dominance and action precedence.
- **V3** Control-cycle/restart tests preserve deterministic IDs and prove execution collections unchanged.
- **V4** Focused tests, full Node suite, source syntax and `git diff --check` pass with zero new failures.
- **V5** Independent review confirms advisory-only scope and no authority/external side effects.
