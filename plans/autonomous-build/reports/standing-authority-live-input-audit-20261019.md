# Standing Authority Live Input Audit — 2026-10-19

## Scope

Read-only audit of `integration/autonomous-build` at HEAD `5519b80`.
Inspected the standing authorization implementation, campaign artifacts,
canonical state summary, local configuration names, release/readiness reports,
and existing isolated delegation proof.

No source code, canonical state, browser profile, ORCA runtime, credentials,
external platform, social action, grant/window/lease, or historical UNKNOWN
record was modified.

## Status

**DONE**

## Executive determination

No safe deterministic control-plane path can materialize a fresh exact
standing LinkedIn campaign authorization from currently available local inputs
and the user mission alone.

The system can materialize one only after an authorized caller supplies all
required exact authority fields and current readiness. Filling omitted fields
from defaults, old records, a Reddit draft, or broad mission text would invent
authority and violate the exact binding contract.

## FACT

### Canonical runtime

Read-only state inspection reports:

- schema 8, revision 194 (as recorded by release journal);
- campaigns: 7;
- campaign authorizations: 10, all terminal/non-active:
  - expired: 5;
  - superseded: 2;
  - paused: 3;
- targets: 1 LinkedIn target;
- execution accounts: 1 enabled/healthy LinkedIn account;
- active standing authorizations: 0;
- active one-time windows: 0;
- active live grants: 0;
- active execution leases: 0;
- published posts: 0;
- UNKNOWN submission uncertainties: 4;
- target readiness persisted as READY but expired at
  `2026-10-17T06:06:46.590Z`.

The four historical UNKNOWN submissions remain quarantined and immutable.

### Available campaign artifact

The only inspected campaign draft is a Reddit `r/opensource` discussion draft
under `campaigns/design-os-studio-launch/reddit-r-opensource-draft.md`.
It is not a LinkedIn target authorization and does not specify the exact
LinkedIn account/profile, target URL, visibility, validity window, quotas,
cadence, concurrency, standing reference, or current readiness.

### Authorization contract

`SeedingService.authorizeCampaign()` and
`normalizeCampaignAuthorization()` require and validate:

- campaign scope and active campaign;
- validity `validFrom`/`validUntil`;
- exact destination platform/account/target/profile;
- approved copy hashes or source-bound approved template/claims;
- explicit audience allowlist;
- publication visibility rules;
- schedule timezone/days/local window;
- rate limits: daily campaign/account limits, concurrency and minimum interval;
- `allowLiveExecution: true`;
- `executionMode: standing_autonomous`;
- non-empty `standingAuthorizationReference`;
- current enabled account and exact target/profile binding;
- verified media/source hashes where applicable.

The HTTP authorization route is operator-only. The control cycle is advisory
and has no authority side effects.

### Standing delegation proof

The isolated test `test/standing-autonomous-delegation-proof.test.mjs`
plus campaign authorization tests pass (reported 21/21). With supplied exact
inputs, the existing path derives one request, one max-executions=1 reserved
window, one execution-scoped grant, and one lease without per-post approval.
Binding drift fails closed and does not create artifacts.

## INFERENCE

- The mission's humanless-by-default objective is a product direction, not a
  concrete authorization payload. It cannot establish exact target, content,
  audience, visibility, timing, or permission.
- Existing local account/target identity may identify a possible destination,
  but does not prove current session readiness or confer permission to publish.
- The Reddit draft is useful content evidence for Reddit only; adapting it to
  LinkedIn would create new content and platform scope that has not been
  explicitly authorized.
- Terminal authorization records may inform diagnostics but cannot be revived,
  copied, or used as a fresh live grant.
- Local ORCA reversible control activation (10/10 accessibility and pointer
  trials on ORCA 1.4.229) proves transport/control behavior only. It does not
  supply authority or certify an irreversible LinkedIn Post.

## UNKNOWN / NOT AVAILABLE

- Fresh exact harmless LinkedIn content and content hash approved for live use.
- Explicit target and account/profile permission for this new execution.
- Publication visibility and audience authorization for the exact post.
- Validity window, schedule, quota, cadence, concurrency and standing reference
  for a new authorization.
- Current LinkedIn readiness/session evidence; persisted readiness is expired.
- A fresh execution window, grant and lease; all active counts are zero.
- Real LinkedIn final-submit activation, acceptance, independent permalink/post
  ID, author/content/time match and VERIFIED receipt.
- Live metric provider authenticity and exact cadence.
- Audited sandbox capability for arbitrary product build/run/render.

## Why automatic synthesis is prohibited

A synthesized authorization would either:

1. revive or clone terminal authorization;
2. infer a LinkedIn post from a Reddit draft;
3. default audience/visibility/window/quota/content;
4. use expired readiness;
5. create a grant/window/lease without current authority; or
6. bypass the operator/control-plane boundary.

Each option violates exact authority, account/profile/target/content binding,
UNKNOWN immutability, or no-external-side-effect requirements.

## Remaining dependency-independent product gaps

No additional safe implementation lane is identified.

Existing local foundations already cover standing delegation, exact controls,
transport abstraction and fail-closed certification, product intelligence,
evidence lineage, bounded factory checks, discovery/opportunity projections,
strategy/learning/read-only engagement context, account candidate/pool
projections, execution timeline, persistence and dry-run restart proofs.

Remaining gaps require external capability, live evidence, or a separately
reviewed contract change:

- fresh authorized LinkedIn live lane and irreversible publication proof;
- real-platform transport certification and independent publication discovery;
- audited build/render sandbox;
- live provider metrics/authenticity;
- platform search/community discovery;
- autonomous engagement execution and verification;
- multi-account session recovery/failover;
- 24/7/live restart and outcome-driven authority changes.

## Acceptance and safety

- Exact campaign authorization, target/account/profile/content/visibility and
  current readiness remain authoritative.
- Standing authorization must be caller-supplied and freshly validated.
- Historical UNKNOWN records remain immutable; no retry or rebinding occurred.
- No external side effect occurred.
- No source, canonical runtime, browser, ORCA, credential, or social mutation
  occurred.

## Recommended resume input

A separately authorized control-plane request must supply a fresh harmless
LinkedIn test scope with exact campaign ID, target/account/profile, content
(or approved template/claim lineage), audience, visibility, validity/schedule,
quotas/cadence/concurrency, standing reference, and current readiness/session
proof. Then reuse the existing standing delegation path to derive the exact
window, grant and lease. Do not create a new authority abstraction.

## Evidence commands

```text
git status --short --branch
git log -1 --oneline
sed/cat source and release reports
node (read-only canonical state summary)
```

## Final status

**Status: DONE**

**Classification:** FACT = inspected source/runtime/artifacts and recorded test
evidence. INFERENCE = mission intent cannot fill exact authority fields.
UNKNOWN = fresh authorization/readiness/live publication inputs absent.
