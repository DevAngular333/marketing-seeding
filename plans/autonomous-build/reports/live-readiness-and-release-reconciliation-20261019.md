# SUPERSEDED — historical live-readiness reconciliation (2026-10-19)

> This dated diagnostic predates the current release gate. Its 515/513
> figures are historical evidence only; the current gate is 527/525/0/2.

## Scope

Read-only release reconciliation on `integration/autonomous-build`. The
existing host-managed ORCA LinkedIn profile was inspected through the current
readiness provider. No post content was entered, no Post/Publish control was
clicked, and no social mutation or canonical state write was performed.

## Current evidence

- Integration HEAD: `168c912cb546270dbcb6aaeb29dc125ba8c77e8f`.
- Historical `npm test` at this diagnostic's timestamp: **515 total, 513
  passed, 0 failed, 2 skipped**. Current gate: **527/525/0/2**.
- `node --check src/*.mjs`: PASS.
- `git diff --check`: PASS.
- `cd ui && npx tsc --noEmit`: PASS.
- `cd ui && npm run build`: PASS; existing Vite config warnings only.
- ORCA runtime: app/runtime ready, version `1.4.229`.
- The existing bound LinkedIn tab was on the LinkedIn feed under the expected
  isolated profile. A direct page observation showed an authenticated feed and
  composer trigger with no login/security challenge.
- The existing `LinkedInReadinessProvider` then returned `READY` with
  `linkedin_session_target_composer_verified` and closed the empty composer.
  This produced no durable readiness write because the provider was invoked
  directly for diagnostics.

## Authority boundary

The readiness result does not create campaign authority. Read-only canonical
state remains schema `8`, revision `194`, SHA-256
`5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`:

- active campaign authorizations: `0`;
- active or reserved one-time windows: `0`;
- active live grants: `0`;
- execution leases: `0`;
- published posts: `0`;
- submission uncertainties: `4`.

The four historical UNKNOWN execution records remain byte-equivalent. No
fresh execution ID, durable submit intent, grant, window, lease, Post click,
acceptance receipt, permalink or VERIFIED publication exists.

## Release decision

`LOCAL_GATES = PASS`.

`LIVE_LINKEDIN_PROOF = NOT_PROVEN`.

Standing autonomous delegation is implemented and isolated-store verified, and
the ORCA accessibility and pointer transports are certified for reversible
local fixture control activation. A real irreversible LinkedIn proof still
requires a fresh exact campaign-level authorization/content scope and the
corresponding one-time window, execution grant and lease. Terminal historical
authority must not be revived, and UNKNOWN executions must not be retried.

`PRODUCT_FACTORY_SANDBOX = ENVIRONMENT_BLOCKED`: the host can invoke the
deprecated `sandbox-exec` wrapper, but no audited profile, filesystem/network
policy, child-process cleanup or resource limits are proven; arbitrary project
build/render execution remains `NOT_EXECUTED_UNSAFE`.

## Resume condition

When a fresh exact campaign authorization and harmless bounded LinkedIn scope
exist, derive controls through the standing path, revalidate the fresh bound
readiness at dispatch, select the deterministic certified transport before
durable submit intent, execute exactly one final submit, and require semantic
activation, platform acceptance and independent publication verification. Any
post-intent uncertainty remains `SUBMIT_RESULT_UNKNOWN` and is quarantined.

Status: DONE_WITH_CONCERNS
