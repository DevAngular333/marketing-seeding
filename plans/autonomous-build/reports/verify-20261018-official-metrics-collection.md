# Independent verification — official metrics collection

## Unverified items first

- No live provider, credential, browser, ORCA, network, or canonical-state write was used; real external API behavior remains unverified by design.
- Provider response authenticity, rate limits, and production API permissions are not proven by fixture tests.
- `schema` is not a top-level field in the inspected canonical snapshot (the persisted revision and protected IDs were checked).

## Review scope and ledger

- **FACT:** Reviewed acceptance A1–A7, constraints C1–C5, and final diffs for `9ea1270` and `28798e8`.
- **FACT:** Official collection reuses `SeedingService.collectMetrics`/`collectAllMetrics`, existing `metricSnapshots`, and `collectorRuns`; no new store/router/scheduler/state machine was introduced.
- **FACT:** Unchanged readings are deduplicated by `postId` plus `source` (`official:<channel>`) and still append a collector-run record with `metricsChanged: false`.
- **FACT:** Changed readings append one snapshot while preserving previous snapshots.
- **FACT:** Per-post failures are caught by `collectAllMetrics`, bounded, and do not stop later posts.
- **FACT:** Manual-only and unconfigured providers produce explicit `not_applicable`/`unknown` collector runs without snapshots.
- **FACT:** No authority, execution, publication, browser, ORCA, or UNKNOWN semantics are changed by this diff.
- **INFERENCE:** Restart-safe deduplication follows from persisted JSON state and the explicit restart test.
- **ASSUMPTION:** Existing `JsonStore` atomic mutation semantics remain the source of persistence guarantees.

## Acceptance table

| Requirement | Result | Evidence |
|---|---|---|
| A1 reuse existing paths/collections | PASS | `src/service.mjs` only; no new persistence abstraction |
| A2 unchanged official reading dedupe + collector run | PASS | `test/service.test.mjs` idempotence test; source/source comparison |
| A3 changed reading one immutable snapshot | PASS | same test verifies 10 then 11 and snapshot count 2 |
| A4 failure isolation/bounded outcomes | PASS | `collectAllMetrics` catches each post; focused isolation test |
| A5 manual/unconfigured explicit outcomes | PASS | `manual_only` → `not_applicable`; unconfigured → `unknown`; no snapshot |
| A6 deterministic restart behavior and no safety drift | PASS (bounded) | fresh `SeedingService` test; diff inspection |
| A7 traffic guard/dashboard compatibility, no live action | PASS (bounded) | focused/full suites; no browser/authority calls in diff |

## Verification commands and results

- `node --test test/service.test.mjs test/server.test.mjs test/integrations.test.mjs`: **58 passed, 0 failed**.
- `for f in src/*.mjs; do node --check "$f"; done`: **PASS**.
- `git diff --check`: **PASS**.
- `npm test`: **430 total, 428 passed, 0 failed, 2 skipped**.

## Edge review

- Official metric parsing remains fail-closed for malformed/non-negative-integer values through existing `metricReading`/provider normalization.
- Snapshot comparison includes both values and coverage status, preventing a measured/unknown coverage transition from being silently deduped.
- Failed collection records only bounded error code/message text and a collector run; it does not create a metric snapshot.
- The `collectAllMetrics` readiness branch records observability for every published post, including manual and unconfigured providers.
- `collectorRun` records are immutable append-only state entries under the existing store mutation path.

## Untouched-target check

- Canonical runtime file was read only. SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`; revision `194`.
- Protected UNKNOWN execution IDs observed unchanged: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`.
- Protected uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c` was not mutated.
- No credentials, cookies, tokens, browser sessions, ORCA, network, or social platform were accessed.

## Verdict

Status: PASS (bounded)
