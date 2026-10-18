# Advisory authorized account-pool summary

**Status:** LOCAL_VERIFIED (read-only)

## Outcome

Added `projectAuthorizedAccountPoolSummary()` and exposed its result in the existing dashboard as `authorizedAccountPoolSummary`. It groups already projected exact campaign/authorization/platform/target candidates, reports the number eligible, stable candidate keys for eligible entries, and counted fail-closed reasons for blocked entries. `autonomousPath` is explicitly advisory (`AVAILABLE_ADVISORY` or `BLOCKED`).

## Safety boundary

This summary is derived solely from the existing read-only candidate projection. It does not select an account for dispatch, rebind a target, change campaign authorization, create windows/grants/leases/requests, authenticate, invoke a browser, or touch external platforms. It exposes no raw profile ID, credential, cookie, token, or readiness evidence. Dispatch continues to use the exact target/account/profile binding and existing execution gates.

## Verification

- `node --test test/authorized-account-candidate-projection.test.mjs` — 5 passed, 0 failed, 0 skipped.
- `node --check src/service.mjs` — passed.
- `git diff --check` — passed.

The dashboard fixture asserts state equality before and after the read. Live multi-account selection, failover, login/session recovery and real platform execution remain unverified.
