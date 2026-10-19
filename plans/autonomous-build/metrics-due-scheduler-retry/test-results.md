# Test results

Date: 2026-10-19

## Focused gate

```text
node --test test/service.test.mjs test/integrations.test.mjs
90 passed, 0 failed, 0 skipped
```

The new regressions prove that a valid checkpoint with failed/unknown evidence is selected by `dueOnly`, while a `not_applicable` manual-only checkpoint is not retried. Existing provider normalization, retry, idempotence, invalid timestamp, and per-post isolation tests also pass.

## Static checks

```text
node --check src/service.mjs
git diff --check
```

Both passed.

## Safety

No live provider, credentials, browser/ORCA, canonical runtime, external write, publication, social action, or historical UNKNOWN mutation occurred.
