# Metrics due-scheduler retry

## Outcome

Fixed the local due-only planning gap identified in the 2026-10-19 audit. A valid published post whose latest checkpoint evidence is `unknown` or `failed` is now eligible for a later due-only collection tick. Manual-only/unsupported evidence remains terminal, and invalid publication timestamps remain fail-closed.

## Files

- `src/service.mjs` — narrow `buildMetricCollectionPlan` due-set change.
- `test/service.test.mjs` — retry and unsupported regression fixtures.
- `plans/autonomous-build/metrics-due-scheduler-retry/` — acceptance, changes, tests, and remaining gaps.

## Verification

- Focused metrics/service gate: 90 passed, 0 failed, 0 skipped.
- `node --check src/service.mjs`: passed.
- `git diff --check`: passed.

## Limits

No live provider or credential behavior was exercised. No canonical runtime, authority, browser, ORCA, social, or external state was touched.
