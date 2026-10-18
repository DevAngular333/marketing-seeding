# Autonomous JEV Dry-Run Rehearsal

## Acceptance requirements

- A1. Provide a provider-neutral service query that selects only dry-run execution requests at `REQUEST_READY` with `submitState: NOT_STARTED`.
- A2. Apply exact account/profile health, fresh readiness, queue eligibility, and unresolved-submission checks; exclude all live requests.
- A3. Add an explicit opt-in scheduler flag `SEEDING_JEV_DRY_RUN_AUTONOMOUS_ENABLED=true` without changing live scheduler precedence or explicit execution-ID dispatch.
- A4. Execute selected rows through the existing `JevExecutionWorker` dry-run path and preserve dry-run receipt restrictions, leases, idempotency, and no external side effects.
- A5. Expose bounded read-only rehearsal runtime counters through health and dashboard projections.

## Constraints

- C1. Do not touch ORCA, browser sessions, network, social platforms, canonical production state, or historical UNKNOWN records.
- C2. Do not add a store, browser abstraction, router, or state machine.
- C3. Existing `readyExecutionRequests()` live semantics and live authorization/window/grant checks remain unchanged.
- C4. The scheduler is opt-in and disabled unless the exact flag is `true`.

## Verification

- V1. Focused dry-run selection and worker tests pass.
- V2. Live requests are excluded from dry-run selection and dry-run requests are excluded from live selection.
- V3. Repeated scheduler ticks/restarts cannot dispatch a completed dry-run twice.
- V4. Dry-run receipts remain `NOT_STARTED` with no publication evidence and no live window/grant consumption.
- V5. Full existing test suite has zero new failures.
