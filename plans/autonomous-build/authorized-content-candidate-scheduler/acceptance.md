# Authorized Content Candidate Scheduler

## Goal

Allow the existing campaign queue scheduler to materialize exact evidence-grounded
content candidates when one active standing autonomous authorization explicitly
allows the candidate copy, then reuse the existing readiness, request, window,
grant and lease controls.

## Requirements

- A1. Only draft candidates under exactly one active `standing_autonomous`
  authorization with `allowLiveExecution: true` and `approved_copy_set` scope may
  enter automatic materialization.
- A2. Reuse `SeedingService.materializeContentCandidate`; do not add a store,
  state machine, publisher, provider router or browser abstraction.
- A3. Repeated scheduler ticks and a fresh service instance preserve one
  publication identity and do not create duplicate posts, requests, windows or
  grants.
- A4. Inactive, paused, revoked, expired, missing, multiply-active,
  mismatched-authority and `approved_template_set` candidates remain draft-only
  or fail closed.
- A5. Historical `UNKNOWN` executions and canonical runtime state remain
  untouched; no browser, ORCA, platform or social side effect occurs.
- A6. The advisory control cycle remains authority-free and is not used for
  materialization.

## Constraints

- C1. Preserve exact candidate/content/source/target/account/profile/visibility
  binding and existing UNKNOWN quarantine.
- C2. Preserve one-time execution windows, execution-scoped grants, leases,
  readiness and idempotency semantics.
- C3. No live execution, external mutation, deployment, push or merge to main.
- C4. `SYSTEM_AGENTIC_AI` Core remains frozen.

## Verification

- V1. Focused scheduler/materialization tests pass with zero failures.
- V2. Full Node suite passes with zero failures.
- V3. Syntax and diff checks pass.
- V4. Re-review confirms the helper is called only from the queue path and does
  not alter control-cycle authority guarantees.
