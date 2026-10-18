# Worker report — explicit candidate-to-JEV dry-run handoff

## Acceptance IDs addressed

A1-A6; C1-C5; V1-V4. A7/V5 remain bounded by the existing runtime projection and independent review lane.

## Summary

Implemented an explicit `rehearsalMetadata` candidate selector and handoff on `SeedingService`. Exact lineage, active authorization binding, destination, healthy account and fresh readiness are checked fail-closed; only the existing dry-run request and JEV worker path are used. Repeated ticks and restart reuse one request, and terminal dry-run rows are not redispatched.

## Evidence

- `node --test test/service.test.mjs --test-name-pattern='rehearsal handoff'` — 64 passed, 0 failed.
- `node --test test/readiness-execution.test.mjs` — 47 passed, 0 failed.
- `node --check src/service.mjs` — passed.
- `git diff --check` — passed.
- Fixture worker produced `DRY_RUN_COMPLETE`, `NOT_STARTED` receipt, no publication evidence.
- Fixture state retained zero live grants and zero one-time windows.
- No ORCA, browser, network, social, canonical or UNKNOWN state was touched.

## Confidence

High for local synthetic service/JEV handoff and safety boundaries. Full suite and server scheduler integration were not rerun in this worker scope.

## Out-of-scope noticed

The existing `src/server.mjs` dry-run-only scheduler does not invoke this candidate handoff; server edits were outside the allowed paths. Runtime dashboard projection and independent final review remain with the controller/reviewer.

Status: DONE_WITH_CONCERNS
Summary: Explicit rehearsal candidates now hand off idempotently into the existing dry-run request and JEV worker path with strict lineage and no live controls. The server scheduler wiring remains outside this worker’s permitted files.
Concerns/Blockers: A7/V5 and server scheduler invocation require controller/reviewer follow-up.
