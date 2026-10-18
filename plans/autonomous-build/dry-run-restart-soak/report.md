# Dry-run restart and lease-recovery soak

## Outcome

The existing explicit rehearsal candidate → JEV dry-run path now has an
isolated restart and lease-recovery proof. The test uses a temporary
`JsonStore`, one exact candidate, one fixture adapter and a protected UNKNOWN
row inside that temporary state. It never opens a browser, calls ORCA, uses a
network provider or touches canonical production state.

The first worker tick found and removed an expired execution lease before
acquiring a fresh lease, reached one `DRY_RUN_COMPLETE` receipt and released
the lease. Three subsequent ticks each created a new `SeedingService` and
`JsonStore`, repeated the rehearsal handoff, and observed the terminal row as
already complete. No second adapter execution, request or receipt occurred.

## Implementation

- `test/dry-run-restart-soak.test.mjs` — isolated end-to-end local soak.
- Existing `src/service.mjs` lease acquisition remains the recovery seam: it
  removes leases whose `expiresAt` is in the past atomically before checking
  conflicts.
- Existing `src/service.mjs` dry-run readiness query excludes terminal
  `DRY_RUN_COMPLETE`/`DRY_RUN_FAILED` rows.
- Existing `src/jev-execution-worker.mjs` and `handoffRehearsalCandidates()` are
  reused without a new worker, store, state machine or retry path.

## Evidence

- Isolated soak: 1 passed, 0 failed, 0 skipped.
- Combined dry-run/readiness/JEV/service gate: 148 passed, 0 failed, 0 skipped.
- The fixture ended with exactly one rehearsal post, one dry-run execution
  request and one dry-run receipt.
- Adapter execution count: 1 across the initial tick and all three restarts.
- Terminal receipt: `dryRun: true`, `submitState: NOT_STARTED`,
  `publicationEvidence: null`, `publicationUrl: null`.
- Active execution leases, live grants and one-time live windows: 0.
- Protected UNKNOWN fixture request and uncertainty row were byte-equivalent
  before and after every restart tick.

This is `LOCAL_REAL`/synthetic orchestration evidence. It does not prove ORCA
transport, LinkedIn activation, platform acceptance or publication.

## Safety result

No canonical state, historical UNKNOWN execution, credential, browser profile,
external provider, social account or external platform was mutated.

## Readiness

The local dry-run queue and lease recovery seam is ready for further bounded
restart/soak hardening. Real LinkedIn publish and independent verification
remain blocked by the existing external authorization/session and ORCA
availability requirements.
