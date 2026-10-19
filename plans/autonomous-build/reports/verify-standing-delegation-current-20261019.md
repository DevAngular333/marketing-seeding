# Verify Standing Autonomous Delegation — Current HEAD

**Date:** 2026-10-19
**Repository:** `/Users/nam/Documents/marketing-seeding-integration`
**Branch:** `integration/autonomous-build`
**HEAD reviewed:** `5519b80 docs: re-evaluate remaining dependency-independent gaps`
**Mode:** read-only isolated verification

## Status

**Status: PASS (locally proven; live external execution remains unproven).**

## Safety

The verification used only temporary isolated `JsonStore` fixtures and existing Node tests. It did not read or mutate canonical runtime state, browser/session state, credentials, ORCA, LinkedIn, social records, or historical UNKNOWN executions. No external action occurred.

## Acceptance criteria

- **A1 — Existing active authority only:** an active `standing_autonomous` campaign authorization with `allowLiveExecution=true` is the sole authority input; no per-post operator approval/window/grant call is required.
- **A2 — Exact request derivation:** a queued approved post derives one exact live execution request bound to campaign, authorization, account, profile, target, content identity/hash, visibility, idempotency key and execution ID.
- **A3 — Exact one-time window:** the queue derives one bounded, max-executions=1 window bound to the current authorization and reserved execution.
- **A4 — Exact execution grant:** the queue derives one execution-scoped active grant bound to the request and exact account/profile/target/content/visibility.
- **A5 — Lease serialization:** the execution worker can acquire one unique lease for the derived execution; conflicting profile/job leases are rejected.
- **A6 — Idempotent repeat:** repeated queue evaluation does not create duplicate requests, windows, grants, or leases.
- **A7 — Fail closed on drift/uncertainty:** stale authority/binding, campaign/post drift, unhealthy account, stale readiness, kill switch, or UNKNOWN quarantine prevents derivation without new artifacts.
- **A8 — No authority invention:** draft-only, inactive, ambiguous, expired, revoked, or non-standing authority does not produce live controls.

## Evidence

Command:

```text
node --test test/standing-autonomous-delegation-proof.test.mjs test/service.test.mjs
```

Result:

```text
87 tests, 87 passed, 0 failed, 0 skipped
```

The proof test creates a temporary active campaign, exact enabled healthy LinkedIn account/profile, active target with fresh readiness, and one active standing authorization. Creating the approved post through the queue produced:

- one `REQUEST_READY` request with `submitState=NOT_STARTED`;
- one `RESERVED` one-time execution window with `maxExecutions=1` and the request execution ID;
- one `ACTIVE` live grant bound to that execution and the standing authorization reference;
- one acquired execution lease bound to the exact LinkedIn profile.

The test then re-evaluates the queue and asserts all request/window/grant/lease counts remain unchanged. It releases the lease and confirms no publication attempt or published post was created. It also verifies direct control-plan derivation is allowed only when every exact binding matches.

Additional current service tests cover interleaved campaign/post drift, stale existing window/grant binding, request/content identity drift, paused/expired/revoked/ambiguous authorization, source drift, kill switch, unhealthy account, stale readiness, UNKNOWN quarantine, restart/idempotency and no duplicate execution artifacts. All passed in the 87-test focused run.

## Source inspection

- `src/standing-campaign-delegation.mjs` provides a pure exact control-plan validator. It creates no authority and requires active standing authorization, fresh readiness, exact campaign/post/account/profile/target/content/visibility, one-time window, active grant, kill-switch clearance and no terminal/UNKNOWN duplicate.
- `SeedingService.ensureStandingExecutionWindow()` and `ensureStandingExecutionGrant()` are scheduler-only automation paths. They re-read and revalidate the current state inside store mutations, reject stale bindings and interleaved drift, and do not permit operator-only APIs to be bypassed for arbitrary scope.
- The standing queue path in `createPost`/`materializeContentCandidate`/scheduler evaluates active standing authorization and automatically derives bounded execution controls; it does not require a separate per-post approval action.
- `acquireExecutionLease()` serializes by execution/job/profile and requires a dispatchable request, preserving exactly-once semantics.

## Boundary and remaining blocker

This proves autonomous derivation **from an already-issued active campaign-level authority**. Campaign authorization creation itself remains operator-controlled, which is the intended standing authorization boundary. The canonical runtime currently has no active exact live authorization/window/grant/lease, so this local proof cannot establish real LinkedIn publication, platform acceptance, independent post discovery, or a VERIFIED receipt.

## Verdict

**ACCEPT — standing autonomous authorization delegation is locally proven at current HEAD.** No concrete implementation defect was found in this review. The remaining live proof blocker is external authorization/session availability, not a missing per-post approval seam.
