# Explicit rehearsal candidate → JEV dry-run handoff

## Outcome

The integration branch now has a bounded, opt-in rehearsal handoff for
explicitly marked content candidates. The handoff validates exact campaign,
story, template, target, authorization and content lineage, then reuses the
existing `JsonStore`, execution-request and `JevExecutionWorker` contracts.

This proves local orchestration only. It does not create live authority,
consume a one-time live window, create a live grant, call ORCA, open a browser,
or publish to a platform.

## Changed paths

- `src/service.mjs` — explicit `handoffRehearsalCandidates()` and a narrowly
  scoped scheduler actor for `dryRun: true` request preparation.
- `src/server.mjs` — the existing dry-run-only JEV tick invokes the handoff
  before querying the existing worker and exposes bounded counters.
- `test/service.test.mjs` — valid, malformed, unmarked, idempotent, restart and
  worker-terminal rehearsal coverage.

## Verification evidence

- Focused service handoff selector: 64 passed, 0 failed, 0 skipped.
- Focused readiness/JEV gate: 76 passed, 0 failed, 0 skipped.
- Full Node suite: 449 total, 447 passed, 0 failed, 2 skipped.
- Source syntax checks and `git diff --check` passed.
- Fixture result: one `DRY_RUN_COMPLETE` receipt with `submitState: NOT_STARTED`
  and `publicationEvidence: null`.
- Repeated handoff and a new `JsonStore` instance retained one request; a second
  worker tick dispatched no additional work.
- The fixture retained zero live grants and zero one-time live windows.

## Safety result

The dry-run-only branch does not reconcile historical UNKNOWN executions. Live
and explicit execution-ID paths keep their existing precedence and behavior.
Protected canonical UNKNOWN executions and the uncertainty records were not
read for mutation and no external side effect occurred.

## Limitations

ORCA is unavailable in this shell, there is no active exact live campaign
authorization/window/grant/lease, and no real LinkedIn activation, acceptance
or independent publication verification was attempted. The milestone is
therefore `COMPLETE_LOCAL_VERIFIED`; live LinkedIn proof remains blocked.
