# Dry-run restart and lease-recovery soak

## Objective

Prove that the existing explicit rehearsal candidate handoff and JEV dry-run
worker survive local service/store restart and recover an expired execution
lease without creating duplicate work or crossing a live/external boundary.

## Acceptance requirements

- **A1** Use an isolated temporary `JsonStore`; do not open or mutate the
  canonical production state.
- **A2** Seed one explicitly marked rehearsal candidate through the existing
  campaign/story/template/content/target/authorization lineage.
- **A3** Run the existing handoff and JEV dry-run worker, then repeat the
  scheduler/worker tick after a new `JsonStore`/`SeedingService` instance is
  created.
- **A4** Execute at least three post-restart ticks and retain exactly one post,
  one dry-run execution request and one execution receipt.
- **A5** A terminal `DRY_RUN_COMPLETE` request is never redispatched after a
  tick or restart.
- **A6** An expired execution lease is removed by the existing lease-acquire
  path and a fresh worker can acquire/release the same execution lease.
- **A7** The rehearsal path creates no live execution window, live grant,
  publication evidence, browser/ORCA call or external side effect.
- **A8** Historical `UNKNOWN` execution and uncertainty rows in the isolated
  fixture remain byte-equivalent throughout the soak.

## Constraints

- **C1** Reuse `JsonStore`, `SeedingService`, `JevExecutionWorker`, the existing
  rehearsal handoff, execution lease and receipt contracts.
- **C2** Do not add a store, state machine, provider router, browser
  abstraction, account selector or retry path.
- **C3** Never read-write the canonical state, mutate historical UNKNOWN
  records, call ORCA, open a browser, access a network provider or perform a
  social action.
- **C4** `DRY_RUN_COMPLETE` and `submitState: NOT_STARTED` are rehearsal proof
  only and never publication proof.

## Verification criteria

- **V1** The focused soak test passes with three restart ticks and one terminal
  dry-run receipt.
- **V2** The lease recovery assertion passes for an expired lease and no
  active lease remains after worker completion.
- **V3** The isolated fixture has zero live windows/grants and no publication
  evidence after the soak.
- **V4** Full Node tests, source syntax checks and `git diff --check` pass with
  zero new failures.
- **V5** Canonical runtime schema/revision/hash and protected UNKNOWN IDs are
  unchanged by the milestone.
