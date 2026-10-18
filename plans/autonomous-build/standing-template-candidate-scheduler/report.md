# Standing Template Candidate Scheduler

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN
**Date:** 2026-10-18
**Branch:** `integration/autonomous-build`
**Evidence class:** LOCAL / SYNTHETIC

## Outcome

The campaign queue now derives deterministic `approved_template_set` candidates
from persisted stories and the one exact active `standing_autonomous`
authorization. It then routes those candidates through the existing
materialization, readiness, execution-request, one-time-window,
execution-scoped-grant, lease, idempotency and UNKNOWN controls. An operator
candidate-derivation call is no longer required for this bounded template path.

The scheduler requires an active campaign, exactly one active authorization,
`allowLiveExecution === true`, a versioned approved-template boundary, persisted
stories, authorized targets and source-bound approved claims. It rereads state
before materialization. Candidate identity is immutable lineage, so autonomous
derivation never overwrites a persisted candidate; stale or tampered rows stay
visible and fail closed at materialization.

## Safety

- Paused, inactive, expired, revoked, ambiguous, missing or malformed authority
  does not derive or promote candidates.
- A source-drifted, malformed or unauthorized story/template remains draft-only;
  another exact template may be evaluated independently.
- Existing terminal or uncertain posts are never replayed. Historical UNKNOWN
  executions remain immutable and are never retried.
- No new store, state machine, browser abstraction, provider router or LinkedIn
  publisher was introduced.
- No browser, ORCA, LinkedIn, social, canonical-runtime or historical-UNKNOWN
  mutation occurred.

## Review

Independent review: **ACCEPT**. The reviewer noted one non-blocking boundary:
malformed templates are skipped individually, so a valid sibling template can
still proceed under the same otherwise valid authorization. Each candidate is
still independently source-, claim-, render-, fingerprint- and authorization-
validated before materialization.
