# Account Runtime Readiness Projection

## FACT

The existing dashboard account projection now reports bounded session/auth mode labels, explicit execution eligibility, and deterministic ineligibility reasons. It remains a pure read transformation over persisted execution accounts, exact bound targets, and latest readiness.

## INFERENCE

This improves humanless-by-default observability and operator steering without creating execution authority or changing the account/session boundary. `SESSION_REUSE` and `MANUAL_AUTH` accurately describe current implementation: an operator-provisioned ORCA profile/session is reused; credentials are not managed by this runtime.

## ASSUMPTION

The existing target readiness enum remains authoritative (`ready`, `checking`, `warming_up`, `blocked`); HUMAN_REQUIRED and UNKNOWN are represented by account health/provider outcomes plus bounded reasons rather than by broadening target state.

## UNKNOWN

Live session health, account recovery, selection/failover and multi-account operation remain unverified.

## Acceptance

- A1-A5: PASS locally. Existing projection extended with safe bounded fields; fail-closed eligibility; no secret material or execution semantics.
- C1-C4: PASS. Existing service/dashboard path reused; no forbidden integrations or external effects.
- V1: PASS, focused 5/5.
- V2: PASS, full Node suite 374 total, 372 passed, 0 failed, 2 skipped.
- V3: PASS, syntax and diff checks.
- V4: Independent review pending; no authority or execution changes in diff.
- V5: Canonical runtime was not accessed or mutated in this local milestone.

## Confidence

High for local projection behavior and safety boundaries. Low for live account/session behavior because no browser or external session was accessed.

## Out of scope

Login, credentials, browser mutation, authority, dispatch, publication, account selection/failover and live proof.

**Status: DONE_WITH_CONCERNS**
