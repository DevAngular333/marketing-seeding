# Account runtime eligible-target projection

## Outcome

Extended the existing read-only `accountRuntime` dashboard projection with deterministic `eligibleTargetCount` and redacted `eligibleTargetRefs`. The projection reuses existing account/target bindings and reports only targets whose persisted readiness is explicitly `READY` with a future expiry. It creates no authority, execution request, lease, grant, browser action, or external side effect.

## Files

- `src/service.mjs`
- `test/account-runtime-projection.test.mjs`

## Verification

- `node --check src/service.mjs` — passed.
- `node --test test/account-runtime-projection.test.mjs` — 5 passed, 0 failed, 0 skipped.

## Safety boundary

This is advisory Mission Control data only. It does not select an account, perform failover, refresh sessions, derive authorization, or expose profile IDs, identity URLs, credentials, cookies, or tokens. Existing exact dispatch and readiness gates remain authoritative.

## Remaining gap

Secure account selection/failover and live session recovery remain unimplemented and require a separate authority-owned seam plus permitted account pool input.
