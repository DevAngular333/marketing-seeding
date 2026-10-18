# Official metrics collection idempotence — Report

## Unverified items first

- No live provider credentials, external network, browser, ORCA, or canonical production write was used. Real provider permissions and responses remain unverified.
- LinkedIn remains `manual_only` in the integration readiness metadata; this milestone does not collect LinkedIn metrics.
- The collector is not an outcome-driven strategy or authority loop. It records advisory metric evidence only.

## Outcome

The existing `SeedingService.collectMetrics` and `collectAllMetrics` paths now
deduplicate unchanged official readings by post and provider source while
retaining an append-only collector-run record for every attempt. A changed
reading appends one immutable metric snapshot. Per-post provider failures are
bounded and isolated by `collectAllMetrics`, so later published posts continue
to be evaluated. Manual-only and unconfigured providers remain explicit
snapshot-free outcomes.

The change reuses `JsonStore`, `metricSnapshots`, `collectorRuns`, the existing
integration readiness map and the existing traffic collector guard. It adds no
store, provider router, scheduler, state machine, authority, browser action,
publication behavior or retry path.

## Evidence class

`SYNTHETIC` provider responses plus `LOCAL_REAL` isolated temporary-store
persistence semantics. This is not live API or platform proof.

## Verification

- Focused service/server/integration gate: **58 passed, 0 failed, 0 skipped**.
- Full Node suite: **430 total, 428 passed, 0 failed, 2 skipped**.
- Source syntax checks: **PASS** (`node --check` for every `src/*.mjs`).
- `git diff --check`: **PASS**.
- Independent review: **PASS (bounded)** — see
  `plans/autonomous-build/reports/verify-20261018-official-metrics-collection.md`.
- Canonical runtime checksum/revision and protected UNKNOWN records: unchanged.

## Status

`COMPLETE_LOCAL_VERIFIED` for deterministic official collection behavior.
Live provider behavior, LinkedIn metrics, and adaptive strategy consumption
remain outside this milestone.
