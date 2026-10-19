# Metrics due-scheduler retry acceptance

## Requirements

- **A1** `buildMetricCollectionPlan(..., { dueOnly: true })` selects checkpoints with `due` or `missing` status as before.
- **A2** The due-only plan also selects the latest `unknown`/`failed` collector evidence for a valid published post so a later scheduler tick can retry transient provider/configuration failures.
- **A3** `unsupported`/`not_applicable` manual-only evidence remains terminal and is not selected for retry.
- **A4** Invalid publication timestamps remain fail-closed and are never selected or sent to a provider.
- **A5** Checkpoint identity, snapshot/run persistence, idempotence, scheduler cadence, authority, execution, browser, and UNKNOWN publication semantics remain unchanged.

## Constraints

- **C1** Change only the existing service checkpoint/collection-plan seam and focused metric regression tests.
- **C2** Use no live provider, credentials, browser/ORCA session, canonical runtime, social action, or external write.
- **C3** Preserve existing `dueOnly: false` behavior and per-post failure isolation.

## Verification

- **V1** Focused service/integration metric tests cover unknown/failed retry and unsupported non-retry.
- **V2** `node --check src/service.mjs` passes.
- **V3** `git diff --check` passes.
- **V4** Implementation report records changed files, evidence, and remaining live gaps.
