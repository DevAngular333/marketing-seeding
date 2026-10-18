# Scheduler-Owned Product Story Derivation

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN  
**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`  
**Evidence class:** LOCAL / SYNTHETIC

## Outcome

The existing campaign queue can now derive one deterministic, evidence-grounded
`draft` story when a campaign has an explicit bounded
`contentBoundary.storyPolicy`. The queue reuses
`SeedingService.deriveProductIntelligenceStory`, `JsonStore`, the existing
approved-template candidate contract and the existing readiness, request,
one-time-window, grant, lease, idempotency and UNKNOWN controls. No second
store, router, state machine, browser abstraction or LinkedIn publisher was
introduced.

The derivation path is enabled only for one current active
`standing_autonomous` authorization with `allowLiveExecution === true`,
`approved_template_set` scope, a valid authorization fingerprint and a valid
campaign-scope fingerprint. The story policy supplies a bounded caller-owned
CTA and optional disclosure/language. The queue never infers a CTA from the
campaign objective, URL or another unapproved field.

Product intelligence must still be a current READY handoff with matching
repository inspection and source bytes. Repeated queue ticks and a new service
instance reuse one story identity. Derived stories remain `draft`; downstream
candidate/materialization controls are the only route toward execution
artifacts.

## Safety and review

- Missing policy, incomplete handoff, ambiguous authority, stale authorization
  binding, stale campaign binding, source drift and unsafe policy values fail
  closed.
- Stale or tampered authority is rejected before story derivation, so it cannot
  even create a draft story.
- No execution request, one-time window, live grant, lease, browser action,
  ORCA action, LinkedIn action or social mutation occurred.
- Historical UNKNOWN executions and uncertainty records remain immutable.
- Independent reviewer `/root/story_scheduler_review`: **ACCEPT** after the
  stale-binding hardening pass.

## Boundary

This milestone removes a local per-story drafting call from the bounded
approved-template queue path. It does not provide model-generated strategy,
autonomous audience research, production content generation, live LinkedIn
publication or independent real publication proof.
