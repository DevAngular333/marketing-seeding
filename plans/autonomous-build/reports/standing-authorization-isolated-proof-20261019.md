# Standing authorization isolated proof — 2026-10-19

Evidence class: `LOCAL_REAL_ISOLATED_STORE` (read/write temporary fixture only).

## Scope

This proof exercises the existing `SeedingService` and `JsonStore` standing
campaign delegation path in an isolated temporary directory. It does not read
or write canonical state, browser profiles, credentials, ORCA/JEV, network
services, or external platforms.

## Command

```text
node --test test/standing-autonomous-delegation-proof.test.mjs \\
  test/standing-campaign-delegation.test.mjs \\
  test/one-time-execution-window.test.mjs \\
  test/live-execution-grant.test.mjs
```

Result: **39 passed, 0 failed, 0 skipped**.

## Proven control chain

A fresh fixture campaign receives one bounded `standing_autonomous`
authorization with `allowLiveExecution=true`, exact LinkedIn account/profile,
target, public visibility and content hash. A single queued post then derives,
without a post-level approval call:

1. one execution request (`REQUEST_READY`, `NOT_STARTED`);
2. one exact one-time execution window (`RESERVED`, `maxExecutions=1`) reserved
to the request execution ID;
3. one exact live execution grant (`ACTIVE`) bound to authorization, campaign,
job, execution, platform, account, profile, target, content/media identity,
audience and visibility;
4. one unique execution lease bound to the same execution/job/account/profile.

The pure control-plan re-read returns `allowed=true` and exact IDs for the
campaign authorization, window, grant and execution. Re-running queue
scheduling preserves one request/window/grant/lease. Releasing the lease leaves
zero leases and zero publication attempts/posts. Binding drift, interleaving
campaign/post changes, stale window/grant bindings, kill switch, account health,
readiness and idempotency checks fail closed without creating replacement
controls.

## Contract assessment

No implementation seam was found in the standing authorization/delegation path.
The existing architecture already provides the required bounded handoff:
`authorizeCampaign` (campaign-level authority) → scheduler queue → exact
window/grant → execution lease → pure control plan. No duplicate store, router,
state machine, browser abstraction or LinkedIn publisher is needed.

## Live limitation

This proof is synthetic/local-isolated and does not establish a current real
LinkedIn authorization, browser session readiness, ORCA activation, platform
acceptance, or publication verification. Canonical live state must remain
untouched until a fresh explicit bounded authority and dispatch-time readiness
exist.
