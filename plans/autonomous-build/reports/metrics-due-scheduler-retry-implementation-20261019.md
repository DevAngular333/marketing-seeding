# Metrics due-scheduler retry implementation — 2026-10-19

## Unverified first

- Live provider recovery, credentials, rate limits, response authenticity, and production scheduler cadence remain unverified.
- No provider call, credential access, browser/ORCA action, canonical runtime mutation, social action, or external write occurred.

## Implemented bounded fix

The audited defect was fixed in `src/service.mjs` at `buildMetricCollectionPlan`. The due-only set now includes `unknown` checkpoint rows whose reason is not `published_at_invalid`. `buildMetricCheckpoints` already projects persisted `failed` collector runs to visible `unknown`, so both failed and unknown provider evidence become eligible on a later scheduler tick without changing checkpoint identity or persisted evidence.

`unsupported`/`not_applicable` rows remain excluded because they retain status `unsupported`. Invalid publication timestamps remain excluded by the explicit `published_at_invalid` guard.

## Regression evidence

Added to `test/service.test.mjs`:

- A failed 1h collector run is selected by `dueOnly: true`, retains its checkpoint status `unknown`, and exposes its collector run ID.
- A `not_applicable` manual-only 1h run remains `unsupported`, is not selected, and has no due checkpoints.

Command results:

```text
node --test test/service.test.mjs test/integrations.test.mjs
90 passed, 0 failed, 0 skipped

node --check src/service.mjs
PASS

git diff --check
PASS
```

## Changed files

- `src/service.mjs`
- `test/service.test.mjs`
- `plans/autonomous-build/metrics-due-scheduler-retry/{acceptance.md,changes.md,report.md,test-results.md,remaining-gaps.md}`

## Contract assessment

No contract change is required. The implementation reuses the existing checkpoint and collection-plan seam, preserves manual `dueOnly: false` behavior, bounded timer cadence, per-post isolation, idempotent snapshot persistence, and all authority/browser/UNKNOWN publication controls.
