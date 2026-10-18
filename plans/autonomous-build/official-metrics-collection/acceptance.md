# Official metrics collection idempotence — Acceptance

## Requirements

- **A1** Reuse the existing `SeedingService.collectMetrics` and `collectAllMetrics` paths and existing `metricSnapshots` / `collectorRuns` collections; do not add a store, provider router, scheduler, or state machine.
- **A2** Repeated official readings for the same post and provider identity persist one metric snapshot for unchanged readings while preserving a collector-run record with `metricsChanged: false`.
- **A3** Changed official readings persist exactly one new snapshot and report `metricsChanged: true`; the prior snapshot remains immutable.
- **A4** A failure collecting one published post is isolated; `collectAllMetrics` continues to other eligible published posts and returns bounded per-post outcomes.
- **A5** Manual-only and unconfigured providers remain explicit `not_applicable` / `unknown` collector outcomes and never create metric snapshots.
- **A6** Repeated collection and a fresh `SeedingService` instance produce deterministic snapshot deduplication without changing authority, execution, publication, browser, or UNKNOWN semantics.
- **A7** Any existing traffic collector running guard and read-only health/dashboard projection remain compatible; no live social action is added.

## Constraints

- **C1** Only local fixture/provider responses may be used. Do not access credentials, browser sessions, ORCA, external networks, or canonical runtime for writes.
- **C2** Do not collect LinkedIn metrics; current integration metadata marks LinkedIn `manual_only`.
- **C3** Do not mutate historical UNKNOWN executions, uncertainty records, canonical production state, or any external platform.
- **C4** Preserve collector-run observability for every attempted published post, including failures and unchanged readings.
- **C5** Keep metric collection advisory; it must not create execution authority, alter strategy precedence, or dispatch browser actions.

## Verification

- **V1** Focused service/integration tests cover unchanged official readings, changed readings, restart-safe dedupe, per-post failure isolation, and manual/unconfigured outcomes.
- **V2** Existing server collector-cycle tests continue to pass, including overlap/running guard behavior where applicable.
- **V3** Full Node test suite, source syntax checks, and `git diff --check` pass with zero new failures.
- **V4** Independent read-only review inspects the final diff and reruns the focused gate after the last change.
- **V5** Canonical runtime checksum/revision and protected UNKNOWN IDs are unchanged.

## Non-goals

- No live metric credentials or real provider calls.
- No LinkedIn metric collector.
- No adaptive next-best-action, authority rerouting, dashboard redesign, or new persistence abstraction.
