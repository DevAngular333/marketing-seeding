# Fresh Authority Source Audit — 2026-10-19

## Scope

Read-only inspection of integration branch `integration/autonomous-build` (HEAD `5519b80`), canonical runtime state, local runtime configuration, campaign authorization contracts, scheduler delegation, and available campaign artifacts. No state, browser, grant, window, lease, account, or UNKNOWN record was modified.

## Findings

- Canonical state: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`, schema 8, revision 194.
- Campaigns: 7 active records. Campaign authorizations: 10 historical records; none are currently active and valid. Records are expired, paused, superseded, or otherwise terminal. Their validity windows ended between 2026-10-14 and 2026-10-17.
- Active execution controls: `oneTimeExecutionWindows = []`, `liveExecutionGrants = []`, `executionLeases = []`.
- Registered account: one enabled healthy LinkedIn account (`linkedin_primary`) bound to one ORCA profile UUID and one feed target. The persisted target readiness evidence was checked 2026-10-17 and expired five minutes later; no current readiness proof is available in the canonical state.
- Historical UNKNOWN/uncertain posts remain present. They are immutable and cannot be used to derive a new execution.
- Local runtime config enables live capability flags but explicitly disables campaign-autonomous live mode. It contains no campaign authorization payload, approved content scope, or current readiness result. Credential/session values were not printed.

## Implementation boundary

`authorizeCampaign()` requires caller-supplied exact authority: campaign scope, validity dates, exact destination/account/profile/target, content or approved template/claims, audience, publication visibility, quotas/cadence, and `standingAuthorizationReference`; it additionally validates current account/target/artifact/source bytes. The method is operator-only in the HTTP API. `runCampaignControlCycle()` is advisory and explicitly has no authority side effects. Scheduler methods derive a one-time window, live grant, and lease only after an active `standing_autonomous` authorization, exact binding, healthy account, and fresh readiness are present.

## Determination

No genuine fresh exact LinkedIn campaign authority, harmless content scope, current readiness proof, or derived execution controls are available from workspace/config/runtime inputs. Creating any would invent authorization or revive expired authority, violating the policy and UNKNOWN immutability rules.

**Exact blocker:** `EXTERNAL_HARD_BLOCKER` — a fresh exact authorized LinkedIn campaign scope (including harmless test content/visibility, account/profile/target binding, validity, and standing authorization reference) plus current readiness/session proof must be supplied through an authorized operator/control-plane input. Until then, no fresh window, grant, lease, or live submit may be derived.
