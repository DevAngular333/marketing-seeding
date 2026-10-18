# Standing Template Candidate Scheduler

## Goal

Remove the remaining per-template candidate derivation step for an already
authorized campaign. The existing queue may derive bounded candidates from
persisted stories and one exact active `standing_autonomous`
`approved_template_set` authorization, then reuse the existing candidate
materialization, readiness, request, window, grant, lease and UNKNOWN controls.

## Requirements

- A1. Derive candidates only for an active campaign with exactly one current
  active, in-window `standing_autonomous` authorization that permits live
  execution and uses `approved_template_set`.
- A2. Use only persisted campaign stories, authorized targets and exact
  approved templates/claims/disclosures/source bindings; no generated copy or
  new target/account/profile scope may be introduced.
- A3. Keep derivation bounded and deterministic; repeated queue ticks and
  restart produce one candidate/post lineage per exact identity.
- A4. Route derived candidates through the existing materialization and queue
  controls without creating a new store, state machine, provider router,
  browser abstraction or LinkedIn publisher.
- A5. Inactive, expired, paused, ambiguous, malformed or non-standing
  authority remains draft-only and creates no execution artifacts.
- A6. Preserve terminal/UNKNOWN no-replay, exact authorization binding,
  idempotency and existing safety semantics.

## Constraints

- C1. Local/synthetic verification only; no ORCA, browser, LinkedIn, social or
  other external side effect.
- C2. Do not mutate canonical runtime state or historical UNKNOWN records.
- C3. `SYSTEM_AGENTIC_AI` Production Core remains frozen.
- C4. Reuse existing `SeedingService`, `JsonStore`, candidate contract and
  queue scheduler.

## Verification

- V1. Active standing template authority derives and materializes candidates
  from persisted stories without an operator candidate route.
- V2. Repeated ticks and a new store instance remain idempotent.
- V3. Inactive/expired/paused/ambiguous/malformed authority remains draft-only
  with no post/request/window/grant/lease additions.
- V4. Existing approved-copy, template binding, authorization, queue,
  readiness and UNKNOWN regressions remain green.
- V5. Full Node suite has zero new failures; syntax, JSON and diff checks pass.
