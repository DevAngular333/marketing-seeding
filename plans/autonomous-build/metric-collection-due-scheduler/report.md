# Metric Collection Due Scheduler

Implemented a narrow local seam for checkpoint-aware official metric collection.
`buildMetricCollectionPlan()` deterministically projects due checkpoints from existing persisted posts, snapshots, and collector runs. `collectAllMetrics()` accepts opt-in `dueOnly`; the server traffic timer uses that opt-in, while direct/manual calls preserve the previous all-published-post behavior.

Invalid publication timestamps fail closed and are not sent to providers. Existing per-post failure isolation and manual/unconfigured outcomes are unchanged. No browser, ORCA, credential, network, canonical state, or external system was touched.

## Verification

- `node --test test/service.test.mjs`: 61 passed, 0 failed, 0 skipped.
- Full suite and static checks are run by the integrator after commit.
