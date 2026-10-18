# Campaign Queue Runtime Observability

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN  
**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`

## Outcome

The existing campaign queue scheduler now exposes a bounded, read-only runtime
projection through `/health` and the existing `/api/dashboard` automation
object. The projection shows whether the queue is enabled, its fixed interval,
running state, last start/completion, next scheduled run and a bounded summary
of the most recent cycle.

The scheduler still calls the existing `SeedingService.queueDueCampaignJobs`
seam. It does not create execution authority, bypass readiness, derive a grant,
operate a browser, or add dashboard controls.

## Safety behavior

- Successful cycles report bounded campaign and decision counts.
- Failed cycles report only a bounded error code/reason label; raw errors,
  credentials and state paths are not projected.
- Shutdown clears the timer and waits for an active queue cycle before releasing
  the writer lease.
- Existing standing-authority, readiness, execution-request, one-time-window,
  live-grant, lease, idempotency and UNKNOWN semantics remain unchanged.
- No canonical runtime, browser session, ORCA state, LinkedIn state or
  historical UNKNOWN execution was mutated.

## Evidence class

This is **LOCAL / SYNTHETIC** evidence. The projection improves observability
for a future authorized run; it is not proof of a real LinkedIn publication.

## Review

Independent review accepted the seam: it reuses the existing timer/service
boundary, exposes the same allowlisted projection on both read-only surfaces,
and introduces no authority or external side effect. A future hardening test
may force a queue failure and assert the bounded summary, but that is not a
release blocker for this read-only projection.
