# Strategy Foundation Milestone — Acceptance

## Requirements

- **A1** Derive deterministic, explainable next-best-action candidates from existing campaign state only: product-intelligence readiness, discovery observations, target/policy eligibility, drafts/posts, schedules and available outcome metrics.
- **A2** Emit an explicit action type from a bounded set (`publish`, `engage`, `research`, `wait`, `do_nothing`) with score, reasons, evidence references and a safe `eligible` flag.
- **A3** Never create or widen campaign authorization, one-time windows, execution grants, leases, posts, publication attempts or browser/provider calls. Strategy output is advisory state only.
- **A4** Fail closed when product intelligence is incomplete, discovery is blocked/unknown, target policy is not eligible, required content is absent, or an unresolved UNKNOWN submission exists.
- **A5** Persist a bounded strategy decision history through the existing campaign store and project the latest decisions read-only through the existing dashboard.
- **A6** Preserve existing LinkedIn/JEV/ORCA, authorization, grant, window, lease, idempotency, UNKNOWN and publication semantics.
- **A7** Keep SYSTEM_AGENTIC_AI Core frozen and avoid a second store, router or state machine.

## Constraints

- **C1** Reuse `JsonStore`, `SeedingService`, existing campaign/discovery/content/metrics state and dashboard projection.
- **C2** No network, browser, external platform, credential/session or social mutation.
- **C3** Deterministic output for identical state and timestamp bucket; no model/provider dependency.
- **C4** Bound input/history/output sizes and redact free-text reasons/evidence labels.

## Verification

- **V1** Unit tests cover publish eligibility, engage/research fallback, wait/do-nothing decisions, blocked/unknown fail-closed cases, score/reason determinism and bounded output.
- **V2** Service tests cover persistence, restart survival, dashboard projection and no publication-authority side effects.
- **V3** Existing full Node suite remains zero-failure.
- **V4** All source files pass `node --check` and `git diff --check`.
- **V5** Independent read-only review confirms no authority/browser/provider semantics changed.
