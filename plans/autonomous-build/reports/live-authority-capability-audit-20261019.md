# Live authority capability audit — 2026-10-19

## Scope

Read-only inspection of the integration branch source, canonical runtime state,
local configuration surface, and existing audit evidence. No browser/ORCA action,
state mutation, credential/session read, or external side effect occurred.

## Finding

`LIVE-LINKEDIN-AUTH-001` remains an external hard blocker at this observation.
The repository contains a complete standing-authority implementation, but no
legitimate fresh authority is persisted or supplied from which a new LinkedIn
execution may be derived.

## Implementation evidence

- `SeedingService.authorizeCampaign` is the campaign-level activation boundary.
- `executionMode: "standing_autonomous"` requires a nonempty
  `standingAuthorizationReference`; live execution requires explicit
  `allowLiveExecution: true`.
- Exact destination `(linkedin, accountId, profileId, targetId)`, content/media
  hashes, audience, visibility, schedule, validity, quota, cadence, and
  concurrency are validated and fingerprint-bound.
- Scheduler-only derivation produces the one-time execution window, execution
  request, execution-scoped live grant, and unique lease without per-post
  approval. Focused standing delegation tests already pass.
- Historical controls cannot be promoted or revived; unresolved UNKNOWN
  submissions remain quarantine barriers.

## Canonical runtime observation

State: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`.

- Revision 194; one enabled/healthy LinkedIn account and one exact bound target/profile exist.
- Last readiness evidence is historical and expired (2026-10-17, five-minute TTL).
- Ten campaign authorizations are terminal (`expired`, `paused`, or
  `superseded`); zero are active now.
- All seven windows are consumed; all seven grants are consumed or revoked;
  zero execution leases are active.
- Four historical `SUBMIT_RESULT_UNKNOWN` executions remain immutable; no
  confirmed published posts exist.
- No environment/configuration file or source artifact supplies a fresh exact
  campaign scope, harmless content identity, visibility, authorization bounds,
  or live approval reference. Runtime env exposes no relevant authority vars.

## What can be derived once a genuine authority exists

An authorized control-plane caller must provide/select an exact new campaign or
bounded campaign scope, harmless new content (and media hashes if used), target,
account/profile, PUBLIC visibility, policy limits, validity window, and a
non-secret standing authorization reference. The service can then activate the
standing authority and autonomously derive request/window/grant/lease after a
fresh readiness check. No code change is required for this missing input.

## Safety determination

It would be unsafe to reuse any historical authorization, content/idempotency
identity, window, grant, readiness observation, or UNKNOWN execution. Creating
fresh records by guessing user intent would fabricate external authority.
Therefore no live execution was attempted.

## Verdict

`LIVE_PROOF_BLOCKED` / `EXTERNAL_HARD_BLOCKER` pending a genuine fresh
campaign-level authorization and fresh bound LinkedIn readiness/session.
