# Metrics and dirty-diff review — 2026-10-19

## Verdict

**ACCEPT** for the reviewed metric due-only retry and channel-capability projection seams.

## Scope and safety

Read-only review of the current dirty integration worktree on branch `integration/autonomous-build`:

- `src/service.mjs` metric collection-plan change and dashboard channel projection wiring
- `src/channel-capability-projection.mjs`
- `test/service.test.mjs` focused metric regressions
- `test/channel-capability-projection.test.mjs`
- `plans/autonomous-build/acceptance.md` (A1-A10, C1-C8, V1-V7)
- Existing metric/projection reports and current-state/integration journal entries

No source, test, canonical state, browser/ORCA session, provider, social action, or external system was mutated. The repository has broad pre-existing dirty work; this review did not reset, stage, or discard it.

## Findings

- Due-only metric planning retains `due`/`missing` selection and additionally retries projected `unknown` evidence from failed/unknown collector runs.
- `published_at_invalid` remains fail-closed and is not selected.
- `not_applicable`/unsupported manual-only evidence remains terminal and is not selected.
- `dueOnly: false` behavior remains unchanged.
- Channel projection is bounded, deterministic, advisory and read-only. It requires active targets, acceptable rules status, READY readiness and future expiry before reporting READY; missing, inactive, rules-pending and stale readiness states fail closed.
- Dashboard wiring only adds the projection to the existing read model; no authority, account selection, grant/window/lease, provider, browser or mutation path is introduced.
- No blocking safety, acceptance, UNKNOWN immutability, or scope finding was observed.

## Focused verification

Commands run from `/Users/nam/Documents/marketing-seeding-integration`:

```text
node --check src/service.mjs
PASS

git diff --check
PASS

node --test test/service.test.mjs test/channel-capability-projection.test.mjs
85 passed, 0 failed, 0 skipped
```

The focused service run included metric due-only retry, unsupported non-retry, invalid publication fail-closed, and backward-compatibility regressions. The channel projection run covered deterministic output, advisory/no-side-effect flags, rules review, stale readiness and inactive targets.

## Limitations

Live provider recovery, credentials, scheduler cadence in production, authenticated browser state, canonical runtime immutability hashes, and real social publication remain unverified here. No live browser or social action was performed, per scope.
