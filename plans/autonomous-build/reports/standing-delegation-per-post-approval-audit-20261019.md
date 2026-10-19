# Standing Delegation Per-Post Approval Audit

Date: 2026-10-19
Scope: read-only source and test review on `integration/autonomous-build`.

## Finding

No per-post operator approval is required on the standing autonomous live path.

The scheduler/router invokes `ensureStandingExecutionWindow()` and
`ensureStandingExecutionGrant()` for an active authorization with
`executionMode=standing_autonomous` and `allowLiveExecution=true`. These
functions derive one-time controls from persisted campaign authority and
revalidate exact campaign, post, target, account/profile, readiness, content,
window, and grant bindings. `prepareExecutionRequest()` calls the window path
for standing jobs without an operator actor. Queue paths call grant derivation
from scheduler/execution-router actors.

The operator-only `createLiveExecutionGrant()` remains an explicit manual
control for non-standing flows; it is not called by the standing path.

## Evidence

- `src/service.mjs:1979` `ensureStandingExecutionWindow`
- `src/service.mjs:2068` `ensureStandingExecutionGrant`
- `src/service.mjs:3902` standing request preparation
- `src/service.mjs:3648`, `src/service.mjs:3151`, `src/service.mjs:3416` scheduler/router derivation
- `src/standing-campaign-delegation.mjs` pure exact control-plan validation
- `test/standing-autonomous-delegation-proof.test.mjs` standing no-approval proof and stale/interleaving rejection tests
- `test/authorized-account-candidate-projection.test.mjs` deterministic candidate/pool projection

## Focused verification

`node --test test/account-runtime-projection.test.mjs test/authorized-account-candidate-projection.test.mjs test/standing-autonomous-delegation-proof.test.mjs`

Result: 19 passed, 0 failed, 0 skipped.

## Remaining blocker

Canonical runtime has no active standing authorization, active one-time window,
active live grant, or fresh readiness. This prevents a live lane from being
derived, but is an authorization/readiness input blocker rather than a
per-post approval seam.

No source, canonical state, browser session, credentials, or UNKNOWN record was
mutated by this audit.
