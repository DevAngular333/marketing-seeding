# Account Runtime Projection Worker Report

## Unverified first

- No browser, ORCA, credential, session, LinkedIn, or external side effect was performed.
- Live account/session health remains unverified; this change is a read-only dashboard projection.
- Full suite result is pending the integrator gate.

## Outcome

Added a deterministic, read-only account runtime projection to `SeedingService.dashboard()`.
The projection reuses existing `executionAccounts` and target readiness records and emits both
`accountRuntime` and compatibility alias `executionAccounts` with safe fields only:

- `id`, `platform`, `accountId`
- SHA-256 `profileFingerprint` (raw profile ID omitted)
- `status`, `health`, `lastReadinessAt`
- bounded readiness state/timestamps/reason/recovery classification
- `boundTargetCount`, bounded `currentBlocker`

Identity URLs, raw profile IDs, readiness evidence, and arbitrary account fields are excluded.
Accounts are sorted by stable ID; readiness is selected deterministically by latest `checkedAt`.
No state mutation, authority creation, execution, or session handling was added.

## Verification

Focused command:

```text
node --test test/account-runtime-projection.test.mjs
```

Result: 2 passed, 0 failed.

Covered: allowlist/redaction, deterministic profile fingerprint, multiple bound target count,
readiness blocker projection, restart equality, and no canonical state mutation.

## Changed paths

- `src/service.mjs`
- `test/account-runtime-projection.test.mjs`
- `plans/autonomous-build/reports/account-runtime-projection-worker.md`

## Constraints

No new store, state machine, provider router, browser abstraction, credential broker,
live access, or canonical runtime writes.
