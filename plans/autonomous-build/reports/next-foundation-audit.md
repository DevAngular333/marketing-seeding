# Next Foundation Audit — bounded implementation lane

**Status:** DONE
**Review pin:** `4115a732f758985c2b39ccbfab3748d57d9f3c00`
**Working tree:** `integration/autonomous-build` (existing integration changes were not modified)
**Evidence class:** read-only source and artifact inspection; no external network, browser, credentials, canonical runtime write, or social action.

## Unverified first

- No account selector/failover was exercised against a live browser profile.
- No autonomous login, token refresh, MFA/CAPTCHA recovery, or multi-account live execution is proven.
- No platform search/community-rule crawler is implemented or live verified; discovery URLs remain caller-configured.
- Product Factory arbitrary build/run/render/media execution remains fail-closed because the host sandbox is `UNSUPPORTED` (`executionEligible: false`).
- No live metrics, engagement, publication, or adaptive strategy outcome exists in the canonical runtime.

## Acceptance mapping

| Criterion | Result | Evidence |
|---|---|---|
| A1 | PASS (review) | Existing standing delegation and ORCA fixture artifacts are present; current branch contains the latest proof changes and no source edits were made by this review. |
| A2 | PASS | A bounded next lane is identified below: deterministic authorized account/session candidate selection and failover projection, reusing existing account/readiness/target contracts. |
| A3 | PASS | Account/session, Product Factory, discovery/strategy, engagement and metrics seams were inspected with concrete paths, tests and blockers. |
| A4 | PASS | Recommendation is read-only/advisory first and preserves campaign authority, exact bindings, leases, idempotency, UNKNOWN immutability and no-blind-retry semantics. |

## Current seam audit

### Account/session runtime

**Implemented and locally verified:** `src/readiness.mjs` normalizes account identity and readiness without secret-like fields; `src/linkedin-readiness.mjs` performs bound LinkedIn readiness checks; `src/service.mjs` registers exact `(platform, accountId, profileId)` accounts and refreshes readiness; `projectExecutionAccountRuntime` exposes a redacted `SESSION_REUSE` / `MANUAL_AUTH` dashboard projection with fail-closed eligibility and blocker reasons. Existing tests include `test/account-runtime-projection.test.mjs` (5 focused tests) and `test/readiness-execution.test.mjs` readiness/identity regressions.

**Missing:** no deterministic account pool selector, target failover policy, session recovery state machine, secure credential broker, or multi-account execution proof. The exact target currently binds one account/profile and `assertExecutionSendable` rejects identity or readiness drift, which is the correct safety boundary for live submit.

**Assessment:** highest-value dependency-independent lane. A pure candidate-selection/readiness-failover read model can be added without changing authority or dispatch. It directly prepares the required future live lane while keeping identity switching explicit and bounded.

### Discovery, audience and channel intelligence

**Implemented and locally verified:** `src/discovery-observer.mjs` performs bounded public HTTP(S) observation with DNS/private-address/redirect/size/timeout and redaction controls. `src/discovery.mjs` normalizes, deduplicates, classifies, scores and optionally evaluates caller-supplied audience/channel/locale fit. `pollConfiguredDiscoveries` is opt-in and isolates campaign failures. Evidence includes `test/discovery.test.mjs`, `test/discovery-scheduler.test.mjs`, and `plans/autonomous-build/discovery-fit-scheduler/report.md`.

**Missing:** source URLs are caller-configured; there is no platform search, community-rule crawler, audience research, eligibility registry derived from external discovery, or autonomous channel discovery. Fit remains advisory and cannot create authority.

### Strategy and engagement

**Implemented and locally verified:** `src/strategy.mjs` emits deterministic advisory `publish`, `engage`, `research`, `wait`, or `do_nothing` decisions, with bounded evidence and learning context. `SeedingService.addInteraction`, `draftReply`, `approveReply`, and `markReplySent` plus `assertReplyCanSend` provide grounded interaction/reply persistence and safety checks. Existing tests cover strategy, reply grounding, idempotence and outcome attribution.

**Missing:** engagement remains approval-gated (`src/constants.mjs` channel policies default `replyRequiresApproval: true`), has no platform adapter execution/verification for replies, and has no autonomous conversation crawler or conversation continuation loop. This is downstream of live platform support and account selection.

### Metrics and learning

**Implemented and locally verified:** official collector persistence/idempotence, bounded provider retry handling, checkpoint projections, outcome attribution and advisory learning context exist in `src/service.mjs`, `src/outcome.mjs`, `src/learning.mjs`, and `src/integrations.mjs`. Evidence includes official-metrics, metric-checkpoint, outcome-attribution and learning/strategy reports.

**Missing:** no live provider authenticity/permissions, no measured canonical outcomes, and no authority-changing adaptive rerouting. Learning must remain advisory until live evidence and policy define bounded action changes.

### Product Factory

**Implemented and locally verified:** classifier, strict syntax/evidence probes, bounded run lineage and exact operator artifact promotion reuse existing `productFactoryRuns` and artifact schema. The sandbox preflight correctly distinguishes backend presence from safe eligibility.

**Blocked:** host sandbox preflight is `UNSUPPORTED`; arbitrary project commands/build/render/media generation remain `NOT_EXECUTED_UNSAFE`. This is an environment blocker, not a reason to weaken fail-closed behavior.

## Recommended next lane (highest value)

### Deterministic authorized account/session candidate selection and failover projection

Implement a bounded, pure/read-model lane over existing `executionAccounts`, `targets`, readiness records, campaign authorization destinations and platform policies. It should produce an ordered candidate list and explicit fail-closed reasons, without changing target identity, creating authority, selecting a different account for a live request, or invoking a browser.

**Why now:**

1. The live LinkedIn proof is blocked on exact account/profile/session readiness in addition to authority and transport.
2. The current dashboard projection reports eligibility but cannot answer which authorized account would be selected, why alternatives are rejected, or whether failover is possible.
3. The lane reuses existing contracts and can be proven in isolated stores while the external live authorization/ORCA lane remains blocked.
4. It is safer and more valuable than enabling engagement or Product Factory execution before platform/account safety is complete.

**Explicit acceptance boundary:**

- Input: campaign id, platform/target class, current time, existing account/target/readiness/authorization state.
- Output: deterministic ordered candidates containing only redacted account/profile fingerprints, target id, readiness state/expiry, policy eligibility, and reason codes.
- Candidate eligibility requires enabled account, healthy account, exact profile/target binding, fresh `READY` readiness, active campaign destination authorization and platform capability/readiness.
- Exclude `HUMAN_REQUIRED`, `UNKNOWN`, stale/expired readiness, wrong profile, disabled/unhealthy accounts, unresolved submission identities and policy-ineligible destinations.
- Stable ordering and a deterministic selection fingerprint; no wildcard or scope escalation.
- Failover is advisory/read-only in phase one. No mutation of `post.targetId`, no grant/window/lease creation, no request rebinding, no browser call, no retry and no external action.
- Tests must cover one eligible candidate, deterministic tie ordering, ineligible primary with eligible alternate, profile mismatch, expired readiness, HUMAN_REQUIRED/UNKNOWN, authorization scope mismatch, and UNKNOWN historical post quarantine. Restart equality and canonical-state non-mutation are required.

## Dependency order after this lane

1. Prove the selector/readiness projection locally and expose only bounded Mission Control observability.
2. Obtain a fresh exact authorized live lane and use the selector as a preflight/read-only audit before deriving one execution window/grant/lease.
3. Recalibrate or replace ORCA transport in the permitted browser lane; keep transport fixed before durable submit intent.
4. Run exactly one fresh autonomous LinkedIn publish, activation/acceptance evidence, independent permalink discovery and normalized VERIFIED receipt.
5. Only after live publication proof, add platform-specific metrics and contextual engagement adapters.

## Alternative lanes (lower priority now)

- **Discovery/community intelligence:** valuable but requires new external-source policy and platform-specific rule semantics; current HTTP observer and caller fit are suitable foundations, but it does not unblock the immediate live publish gate.
- **Engagement execution:** currently approval-gated and lacks certified platform reply execution; implementing autonomous send now would create unsafe surface area before live publish/account proof.
- **Product Factory sandbox:** blocked by host capability. Continue diagnostics/documentation only until an audited sandbox profile/resource policy exists.
- **Metrics/learning:** local contracts are mature and advisory; live provider authenticity is externally gated and should not drive authority yet.

## Evidence paths and commands reviewed

- `src/readiness.mjs`
- `src/linkedin-readiness.mjs`
- `src/service.mjs` (`registerExecutionAccount`, readiness refresh, `projectExecutionAccountRuntime`, `assertExecutionSendable`)
- `src/standing-campaign-delegation.mjs`
- `src/discovery-observer.mjs`, `src/discovery.mjs`, `src/strategy.mjs`, `src/learning.mjs`, `src/product-factory.mjs`
- `test/account-runtime-projection.test.mjs`
- `test/readiness-execution.test.mjs`
- `test/discovery.test.mjs`, `test/discovery-scheduler.test.mjs`
- `test/strategy.test.mjs`, `test/service.test.mjs`, `test/outcome.test.mjs`, `test/learning.test.mjs`
- `plans/autonomous-build/standing-autonomous-delegation-proof/report.md`
- `plans/autonomous-build/account-runtime-mission-control/report.md`
- `plans/autonomous-build/discovery-runtime/report.md`
- `plans/autonomous-build/discovery-fit-scheduler/report.md`
- `plans/autonomous-build/official-metrics-collection/report.md`
- `plans/autonomous-build/outcome-attribution/report.md`
- `plans/autonomous-build/product-factory-sandbox-preflight/report.md`
- `plans/autonomous-build/product-readiness.md`
- `plans/autonomous-build/blocker-ledger.json`

Commands used (read-only):

```text
pwd; cat plans/autonomous-build/next-foundation-review/acceptance.md
cat plans/autonomous-build/next-foundation-review/pin/git-head.txt
git status --short --branch; git log -1 --oneline
rg --files src test plans/autonomous-build
rg -n "Account|Session|Discovery|Audience|Channel|Engagement|Metric|Learning|Factory|sandbox" src test plans/autonomous-build
sed/cat of the evidence paths listed above
```

No tests were run by this read-only review, per worker constraints. Existing recorded test results remain the cited evidence.

## Independent review conclusion

The strongest dependency-independent bounded implementation is a deterministic authorized account/session candidate and failover **projection**, not live account switching. It advances the Product Definition of Done's account/session selection requirement, gives Mission Control an actionable explanation of readiness and alternatives, and preserves every safety invariant. It should be assigned as the next implementation milestone only after this report is accepted by the integration owner.

Status: DONE
