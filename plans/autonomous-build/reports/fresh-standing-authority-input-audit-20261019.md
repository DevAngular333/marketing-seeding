# Fresh Standing Authority Input Audit — 2026-10-19

## Scope

Read-only inspection of the integration worktree at `cfdc869` and the
canonical local state directory configured by `local-config/runtime.env`.
No source, canonical state, browser profile, ORCA runtime, credentials,
external platform, social action, grant/window/lease, or historical UNKNOWN
record was changed. Credential and session values were not printed.

## Determination

No fresh exact standing LinkedIn authorization is available locally. The
existing implementation can derive a request, one-time window, execution
grant, and lease without per-post approval **only after** an authorized caller
supplies and the control plane validates an exact authority payload. The
mission text and stale local records cannot substitute for that authority.

## Canonical evidence

The configured state file is
`/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`.
It reports schema 8, revision 194, seven campaigns, ten authorizations, one
LinkedIn target, one enabled/healthy LinkedIn execution account, seven request
records, seven windows, seven grants, zero active leases, seven posts, and
four submission uncertainties.

All ten authorization records are terminal (`expired`, `paused`, or
`superseded`). None is active. All persisted windows/grants are historical;
there is no active exact window or grant. The four UNKNOWN submissions remain
quarantined and immutable.

The only target is LinkedIn feed URL with account `linkedin_primary` and ORCA
profile UUID `b27a3bcc-b139-4353-a15b-10e10824291e`. The account is enabled and
marked healthy, but the target readiness checked at
`2026-10-17T06:01:46.590Z` expired at `2026-10-17T06:06:46.590Z`. This is not
current readiness/session proof.

The local runtime configuration confirms live JEV flags and an ORCA worktree,
but exposes no fresh campaign authority. Secret-bearing configuration exists;
values are intentionally redacted and were not used as authority evidence.

## Required missing inputs

A valid new live lane still needs all of the following from an authorized
control-plane caller:

- campaign identity and active campaign scope;
- exact LinkedIn account, immutable ORCA profile, target URL/target ID;
- fresh harmless content or approved template/claim lineage and content hash;
- audience and publication visibility authorization;
- validity period, schedule, quotas, cadence, and concurrency;
- standing authorization reference and `allowLiveExecution: true`;
- current readiness/session evidence bound to the same account/profile/target;
- a newly derived one-time window, execution-scoped grant, and unique lease.

## Policy conclusion

Automatic synthesis from mission prose, terminal authorization records, the
existing Reddit draft, account metadata, or expired readiness would revive,
clone, broaden, or infer authority. It would violate exact binding and
fail-closed policy. It is therefore not policy-valid and was not attempted.

Standing delegation itself is locally proven in the existing isolated tests;
this audit finds no new software defect that can create legitimate live
authority without the missing external authorization input.

## Classification

- `LIVE-LINKEDIN-AUTH-001`: **EXTERNAL_HARD_BLOCKER** (fresh exact authority
  and current readiness absent).
- No fresh live execution may be created from available local inputs.
- No external side effect is authorized by this audit.

## Evidence commands

```text
git status --short --branch
git log -1 --oneline
node (read-only summary of configured state.json)
find/read local-config files with secret values redacted
```
