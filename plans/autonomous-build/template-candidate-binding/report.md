# Template Candidate Binding

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN  
**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`

## Outcome

The integration branch now supports a versioned `approved_template_set`
candidate path. A candidate is rendered deterministically from the one exact
active campaign authorization, its source-bound approved claims and required
disclosures. The candidate stores a template contract version, template
fingerprint, canonical claim IDs, source hashes and authorization binding.

The candidate identity includes that binding, so an approved template cannot
collide with a generated-copy candidate. Queue materialization revalidates the
authorization fingerprint, campaign scope, destination account/profile/URL,
template, claim IDs, source bytes, rendered content, policy, audience and
PUBLIC visibility before it reuses the existing standing execution path.

No new store, state machine, provider router, browser abstraction or LinkedIn
publisher was introduced. Existing post idempotency, readiness, execution
request, one-time window, execution-scoped grant, lease and UNKNOWN quarantine
controls remain the only route to queue authority.

## Safety boundary

- Candidates require exactly one current active `approved_template_set`
  authorization and an in-window authorization period.
- Missing, ambiguous, stale, tampered or source-drifted bindings fail closed.
- Legacy candidates and manual/non-standing candidates remain draft-only.
- A terminal or uncertain existing post is never replayed from a candidate.
- The operator-only HTTP endpoint derives candidates; the automation role cannot
  call it. Queue promotion still occurs only through the bounded scheduler.
- No browser, ORCA, LinkedIn, social, canonical runtime or historical UNKNOWN
  mutation occurred.

## Evidence class

This milestone is **LOCAL / SYNTHETIC** evidence. It proves deterministic
template binding and local queue/idempotency behavior. It does not prove ORCA
transport, LinkedIn activation, platform acceptance or independent publication.

## Review

The focused (46/46) and full (410 total, 408 passed, 0 failed, 2 skipped) Node gates pass with zero failures. The independent
template-binding review is recorded in the worker ledger; any finding must be
resolved before this milestone is committed.

## Remaining boundary

Live LinkedIn proof still needs a fresh exact campaign authorization, harmless
test content, valid existing account/profile/session, readiness, one-time
window, execution-scoped grant and a controlled ORCA lane. Historical UNKNOWN
executions remain immutable and are not eligible for retry.
