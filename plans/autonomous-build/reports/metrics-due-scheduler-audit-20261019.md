# Metrics due-scheduler audit — 2026-10-19

## Scope and safety

- Repository inspected: `/Users/nam/Documents/marketing-seeding-integration` (`integration/autonomous-build`).
- Read-only inspection of `src/service.mjs`, `src/server.mjs`, `src/integrations.mjs`, and focused metric/service tests.
- No source edit, provider request, credential access, browser/ORCA action, canonical runtime mutation, or external write was performed.
- The repository already had an unrelated dirty working tree; this audit added only this report.

## Unverified first

- Live provider recovery, credentials, rate limits, and production scheduler cadence remain unverified.
- No recommendation here authorizes an automatic retry against a live provider; the defect is in the local due-plan projection.

## Finding: retryable `unknown`/`failed` checkpoint is skipped forever by `dueOnly`

**Status: concrete local defect; bounded implementation is warranted.**

Evidence:

1. `buildMetricCheckpoints()` maps collector runs with status `unknown` or `failed` to checkpoint status `unknown` (`src/service.mjs:750-767`). A provider-not-configured run is persisted with `status: "unknown"` in `collectAllMetrics()` (`src/service.mjs:5245-5253`); provider failures persist `status: "failed"` (`src/service.mjs:5221-5228`).
2. `buildMetricCollectionPlan()` only treats checkpoint statuses `due` and `missing` as collection candidates (`src/service.mjs:834-840`). `unknown` is excluded from `due` and therefore produces `shouldCollect: false` and `reason: "checkpoint_not_due"` when `dueOnly: true` (`src/service.mjs:835-839`).
3. The production traffic loop always calls `service.collectAllMetrics(actor, { dueOnly: true })` (`src/server.mjs:343-350`). Consequently, once a 1h/24h/72h checkpoint has an unknown or failed run, later scheduler ticks do not call the provider again, even after credentials/provider health recover. The checkpoint remains `unknown` indefinitely unless a separate manual collection call is made with `dueOnly: false`.

Deterministic reproduction (no network):

```text
post published: 2026-10-18T00:00:00.000Z
existing snapshot: 1h at 2026-10-18T01:01:00Z
existing collector run: status=unknown (or failed), at=2026-10-19T00:01:00Z
plan now: 2026-10-19T00:02:00Z, dueOnly=true
```

Observed output from the local pure functions:

```json
{
  "24h": {"status":"unknown"},
  "shouldCollect": false,
  "reason": "checkpoint_not_due",
  "dueCheckpoints": []
}
```

The same behavior occurs for `status: "failed"` because both statuses project to `unknown`.

## Why this matters

The server's opt-in traffic scheduler is explicitly due-only. A transient provider outage, missing credential at the first due tick, or temporary rate-limit/fetch failure therefore converts a checkpoint into a terminal observability state from the scheduler's perspective. This conflicts with the intended recovery behavior of a scheduler and with the existing bounded retry handling in `requestJson()`: request-level retries can succeed later in the same call, but a failed call has no subsequent scheduler attempt.

The current tests cover unknown evidence projection and per-post failure isolation, but do not cover a later `dueOnly` tick after an unknown/failed run. Focused command run:

```text
node --test test/service.test.mjs test/integrations.test.mjs
88 passed, 0 failed, 0 skipped
```

All existing tests passed; none asserts the missing recovery path.

## Bounded implementation recommendation

Add a narrowly scoped local plan rule and regression fixtures:

- Keep `unsupported`/`not_applicable` terminal for manual-only channels.
- Treat a checkpoint whose latest evidence is retryable `unknown` or `failed` as eligible in `dueOnly` mode (or introduce an explicit `retryable` checkpoint status/reason while preserving the visible `unknown` evidence). Do not infer a new due timestamp.
- Preserve bounded scheduler cadence and per-post isolation; do not add provider calls, authority, browser, or external-write behavior.
- Add a pure-plan test proving an unknown/failed 24h run is selected on the next `dueOnly` evaluation, plus a manual-only test proving `not_applicable` remains skipped.

This is a small, dependency-independent fix in the existing checkpoint/plan seam. It should be implemented only with the corresponding local tests and journal evidence; no live credentials are needed.

## Audit conclusion

A concrete local scheduler gap is present. A bounded implementation is warranted, while live provider recovery and authenticity remain unverified.
