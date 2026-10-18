# Metric Collection Due Scheduler Acceptance

- A1: Existing checkpoint projection is reused; no new store, scheduler, provider router, or authority state.
- A2: Scheduled traffic collection opts into due-only selection.
- A3: Manual `collectAllMetrics()` remains backward compatible unless `dueOnly: true` is supplied.
- A4: Invalid `publishedAt` fails closed; provider failures and manual/unconfigured outcomes remain isolated.
- V1: Focused service tests pass.
- V2: Full test suite, syntax, and diff checks pass.
