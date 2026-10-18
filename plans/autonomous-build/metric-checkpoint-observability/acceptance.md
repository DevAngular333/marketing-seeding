# Metric checkpoint observability — Acceptance

## Requirements

- **A1** Reuse the existing `buildTrafficPulse`, `SeedingService.dashboard`,
  `metricSnapshots` and `collectorRuns` paths; do not add a store, scheduler,
  provider router or state machine.
- **A2** Project explicit post-relative checkpoints at 1 hour, 24 hours and
  72 hours from a valid `publishedAt` timestamp.
- **A3** A metric snapshot satisfies only the checkpoint whose due time has
  passed and whose snapshot was captured at or after that due time. Earlier
  snapshots must not satisfy later checkpoints.
- **A4** Preserve fail-closed evidence states: a post-due `unknown` collector
  run projects `unknown`, a post-due `not_applicable`/unsupported run projects
  `unsupported`, and absent evidence projects `missing` (or `due` when the
  checkpoint is currently due).
- **A5** Invalid or missing publication timestamps produce an explicit bounded
  `unknown` checkpoint projection and never infer a due time.
- **A6** Reuse deterministic snapshot ordering and preserve the existing
  `trafficPulse.nextReviewAt`, `priority` and delta behavior for compatibility.
- **A7** Expose checkpoints through the existing read-only dashboard/traffic
  pulse projection only. No authority, execution, browser, publication,
  metric collection or canonical runtime semantics may change.

## Constraints

- **C1** Local isolated fixtures only; no credentials, browser, ORCA, external
  network, canonical state writes or social actions.
- **C2** Historical UNKNOWN executions and uncertainty records are immutable.
- **C3** No zero-filling or `measured` inference from a collector command or
  numeric field without the existing coverage/provenance evidence.
- **C4** Keep the projection bounded to three checkpoints per post and
  redacted to existing dashboard-safe fields.

## Verification

- **V1** Focused service tests cover missing snapshots, due/overdue behavior,
  1h/24h/72h progression, pre-publication snapshots, unknown/unsupported
  collector evidence, invalid publication timestamps and deterministic ties.
- **V2** Existing dashboard and traffic-pulse regressions pass unchanged.
- **V3** Full Node suite, source syntax checks and `git diff --check` pass with
  zero failures.
- **V4** Independent read-only review confirms no authority/browser/provider/
  UNKNOWN drift and canonical runtime immutability.

## Non-goals

- No durable checkpoint job scheduler or automatic metric collection cadence.
- No live provider/API verification or LinkedIn metric collector.
- No strategy rerouting, adaptive action, dashboard redesign or external API
  compatibility migration.
