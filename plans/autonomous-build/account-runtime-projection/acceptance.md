# Account Runtime Projection — Acceptance

## Requirements

- **A1** Reuse the existing `executionAccounts` and readiness state; do not add a second store, account state machine, provider router, browser abstraction, or credential/session broker.
- **A2** Expose a read-only dashboard projection for each registered execution account with platform, account identity, profile fingerprint, status, health, last readiness timestamp, and a bounded blocker/recovery classification when known.
- **A3** Never expose credentials, cookies, browser storage, tokens, raw profile material, or arbitrary readiness evidence in the projection.
- **A4** Projection is deterministic and restart-safe; it must not mutate canonical state or create execution authority, grants, windows, leases, requests, or publication records.
- **A5** Preserve exact account/profile/readiness/UNKNOWN/publish semantics and existing API authorization behavior.

## Constraints

- **C1** Source ownership is limited to `src/service.mjs` plus focused tests and this milestone's journal artifacts.
- **C2** No live browser, ORCA, credential, session, LinkedIn, social, or external side effect.
- **C3** No mutation of `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json` or historical UNKNOWN records.
- **C4** `SYSTEM_AGENTIC_AI` Core remains frozen.
- **C5** Do not store or print secret/session material.

## Verification

- **V1** Focused account projection tests pass with zero failures.
- **V2** Existing full Node suite passes with zero failures; skips are reported.
- **V3** Projection contains only the declared safe fields and preserves restart equality.
- **V4** Canonical runtime SHA/revision and protected UNKNOWN identities remain unchanged.
- **V5** Independent read-only review inspects the diff and reruns the focused gate after the last change.
