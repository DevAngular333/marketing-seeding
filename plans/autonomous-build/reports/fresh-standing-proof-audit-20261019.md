# Fresh standing authorization and delegation audit

Date: 2026-10-19
Repository: `/Users/nam/Documents/marketing-seeding-integration`
Branch/HEAD: `integration/autonomous-build` / `5519b80`

## Scope and safety

Read-only source inspection plus existing isolated temporary-store tests. No
canonical state, browser profile, credentials, ORCA/JEV runtime, LinkedIn page,
social record, or historical `UNKNOWN` execution was read or mutated.

## Result

`PASS_LOCAL_REAL_ISOLATED`; no safe implementation gap found in standing
authorization delegation. The live lane remains unavailable because the
canonical runtime has no fresh exact campaign authority and readiness.

## Verified control path

`authorizeCampaign` validates and persists one bounded campaign-level
`standing_autonomous` authorization (`allowLiveExecution=true`) with exact
campaign scope, destination target, account/profile, content/media boundary,
audience, visibility, schedule, quota/cadence/concurrency, validity and
standing reference. It supersedes prior active authority and fingerprints the
scope.

After that single campaign-level action, the queue and execution router derive
without a post-level approval:

1. one exact `REQUEST_READY`/`NOT_STARTED` execution request;
2. one max-executions=1 reserved one-time window bound to authorization and
   execution;
3. one active execution-scoped grant bound to campaign, post, target,
   account/profile, content/media hashes, audience and visibility;
4. one unique execution lease bound to execution/job/profile.

`deriveStandingExecutionControlPlan` revalidates all bindings, fresh readiness,
quota/cadence/concurrency, idempotency, kill switch and UNKNOWN quarantine and
fails closed on drift. Re-running queue evaluation is idempotent; no second
request/window/grant/lease is created. Lease release leaves no publication
artifact.

## Commands and evidence

```text
node --test test/standing-autonomous-delegation-proof.test.mjs test/campaign-authorization.test.mjs
```

Result: **21 passed, 0 failed, 0 skipped**.

The focused proof uses a temporary `JsonStore`, creates a fresh fixture
campaign, exact enabled healthy account/profile and fresh readiness, activates
standing authority, and asserts exact request/window/grant/lease IDs. It also
checks authority drift and interleaved campaign/post drift fail closed without
new artifacts. Existing broader standing proof reports cover the same path with
39/39 and 87/87 focused gates.

## Current live boundary

This is not live LinkedIn proof. Canonical active authorization/window/grant/
lease counts are currently `0/0/0/0`, and readiness is expired. Existing
terminal authorizations and historical `UNKNOWN` submissions cannot be revived
or retried. A fresh external campaign authority, harmless new content scope,
and fresh exact LinkedIn readiness are required before live derivation.

## Assessment

No source change is justified. Adding defaults, reviving terminal authority, or
deriving live authority from historical records would weaken the existing
exactly-once and UNKNOWN safety semantics.

## Fresh rerun

At the current branch HEAD (`5519b80c8e12a71427ef93b937885b89262bf08b`), the
same isolated proof was rerun:

```text
node --test test/standing-autonomous-delegation-proof.test.mjs test/campaign-authorization.test.mjs
```

Result: **21 passed, 0 failed, 0 skipped**.

Canonical runtime was inspected read-only at schema `8`, revision `194`:

```text
authorization statuses: expired=5, superseded=2, paused=3
active standing live authorizations: 0
active windows: 0
active grants: 0
active leases: 0
published posts: 0
UNKNOWN submissions: 4
fresh readiness targets: 0
```

Therefore the exact live lane remains an `EXTERNAL_HARD_BLOCKER`: no fresh
campaign authority, harmless content scope, or fresh LinkedIn readiness exists.
No historical authority or UNKNOWN execution was revived or mutated.
