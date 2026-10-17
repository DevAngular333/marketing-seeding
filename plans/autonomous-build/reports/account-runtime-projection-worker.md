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

## Completion contract

### Acceptance IDs addressed

- **A1** Reused existing `executionAccounts` and target readiness records; no new store, state machine, router, browser abstraction, or credential broker.
- **A2** Added read-only dashboard account runtime fields and bounded blocker/recovery projection.
- **A3** Excluded credentials, cookies, tokens, raw profile IDs, identity URLs, and readiness evidence.
- **A4** Projection is pure over the read snapshot and restart deterministic; it creates no authority or execution records.
- **A5** Existing account/profile/readiness/publish and UNKNOWN semantics remain unchanged.
- **C1-C5** Source ownership, local-only execution, canonical-state protection, frozen core, and secret-handling constraints were respected.
- **V1/V3** Focused tests passed; allowlist, fingerprinting, count, restart equality, and no-mutation behavior are covered.
- **V2/V4** Full suite was started by the worker and must be treated as integrator-owned final evidence; no canonical runtime writes were performed in this lane.

### Summary

The dashboard now exposes a deterministic account runtime view while preserving existing state and execution contracts. The compatibility `executionAccounts` projection and explicit `accountRuntime` projection are equivalent and read-only.

### Evidence

- Commit: `b06ca32` (`feat: project safe account runtime dashboard state`)
- Focused command: `node --test test/account-runtime-projection.test.mjs`
- Focused result: **2 passed, 0 failed**
- Full suite command: `node --test test/*.test.mjs` (integrator should record final totals after process completion)

### Confidence

**High for local projection behavior and redaction; low for live account/session health because no browser or external session was accessed.**

### Out-of-scope noticed

Live ORCA/browser execution, credential/session provisioning, login/MFA/CAPTCHA recovery, account selection/failover, and social mutation remain out of scope and unchanged.

**Status: DONE**
