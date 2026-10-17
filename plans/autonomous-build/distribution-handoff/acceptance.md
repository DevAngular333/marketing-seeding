# Distribution handoff foundation — Acceptance

## Requirements

- **A1** Validate a provider-neutral System-Agentic distribution handoff with bounded product, content, media and platform references.
- **A2** Reject LIVE handoffs in this milestone; accept only explicit DRY_RUN mode and preserve a clear `liveDispatch=false` result.
- **A3** Reject credentials, browser/session/profile, selectors, CDP/WebDriver and other execution internals recursively; never persist their values.
- **A4** Enforce product identity, exact content/media reference resolution, media SHA-256 integrity and bounded input sizes.
- **A5** Attach the validated handoff to an existing campaign through the existing `JsonStore`/`SeedingService`; persist a stable hash and source metadata and survive restart.
- **A6** Project the handoff read-only through the dashboard and expose an additive automation-safe endpoint; it must not create posts, approvals, authorizations, grants, windows, leases, execution requests, browser calls or publication evidence.
- **A7** Add focused tests for dry-run validation, LIVE fail-closed, cross-product/reference/integrity failures, secret/execution-field rejection, idempotent identity and persistence/projection.

## Constraints

- **C1** Reuse `JsonStore`, `SeedingService`, existing product intelligence/content and dashboard contracts; no duplicate store/router/state machine/provider router.
- **C2** Do not modify LinkedIn/JEV/ORCA, browser transport, authorization, grants, windows, leases, submit intent, publication verification or UNKNOWN semantics.
- **C3** No network, browser, social mutation, credential/session access or external side effect.
- **C4** Keep `SYSTEM_AGENTIC_AI` Core and its source files frozen; this is a downstream validator only.
- **C5** Do not turn a handoff into execution authority or silently create campaign/post state.
- **C6** Bound arrays/text/JSON, redact or reject sensitive material, and keep deterministic identity for equivalent input.

## Verification

- **V1** Focused handoff/service/dashboard tests pass with zero failures.
- **V2** Syntax and diff checks pass after the last change.
- **V3** Independent read-only review confirms no authority/execution/browser/provider side effects and no contract drift.
- **V4** Full Node suite passes with zero failures; skipped tests are reported.
- **V5** Canonical runtime and protected UNKNOWN records remain unchanged.
