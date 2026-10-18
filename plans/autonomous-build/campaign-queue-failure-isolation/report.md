# Campaign Queue Failure Isolation

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN  
**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`

## Outcome

The existing queue cycle now isolates failures at campaign boundaries. A
failure while evaluating one campaign is returned as a bounded campaign result
and does not stop the next campaign from being evaluated. Candidate
materialization failures are also retained for that campaign so the scheduler
can report them without silently claiming a clean cycle.

Successful campaign results keep the prior `{ campaignId, decisions }` shape.
Failure results add `failed: true` and a safe reason code. The server queue
projection counts failed campaigns and exposes up to eight unique bounded
reason codes through its existing read-only `lastSummary`.

## Safety behavior

- No failure is retried inside the same cycle.
- Existing queue methods still own readiness, authorization, one-time window,
  grant, lease, idempotency and UNKNOWN checks.
- No new execution authority, browser action, provider call or social mutation
  was introduced.
- Raw exception messages are never returned by the queue result or projected by
  the server; nonconforming error codes map to `campaign_queue_failed`.

## Evidence class

This is **LOCAL / SYNTHETIC** evidence. It proves queue resilience in isolated
fixtures only. It does not prove ORCA, LinkedIn activation, acceptance or
publication.

## Remaining boundary

Global expiry/store failures still fail the whole cycle because they are shared
state operations rather than independent campaign work. Those failures remain
fail-closed and are visible through the existing top-level queue error path.
