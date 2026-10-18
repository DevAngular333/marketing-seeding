# Changes

- Added `SeedingService.handoffRehearsalCandidates()` for explicitly marked candidates. It validates campaign/story/template/candidate/target/content and authorization lineage, requires fresh local readiness, and reuses the existing dry-run request/worker contracts.
- Kept live request preparation unchanged; the scheduler actor is accepted only for `dryRun: true`. No live grant, window, publication evidence or provider readiness call is created by the handoff.
- Added service regressions for a valid worker-completing handoff, repeat/restart idempotence, malformed metadata, unmarked-candidate exclusion and terminal receipt behavior.
