# Account Selection Review — 2026-10-19

## Verdict

**NO_SAFE_CHANGE**

The repository already has a deterministic, secret-safe, read-only authorized account candidate/pool projection. It is not safe to promote that projection into a live selector at candidate materialization, queueing, or dispatch without changing the authority and target identity contracts. A selector that chooses a different account would either rebind an existing target/post after authorization or duplicate the existing execution binding logic. Both would weaken the current fail-closed safety model.

## Existing implementation evidence

- `src/service.mjs:1166-1320` implements `projectAuthorizedAccountCandidates()` and `projectAuthorizedAccountPool()`.
  - Candidates are derived only from exact campaign authorization destinations.
  - Eligibility checks campaign status, authorization status/mode/live flag, authorization and campaign fingerprints, validity window, target platform/account/profile/URL/status, bound fresh readiness, enabled account, healthy account, and account/profile equality.
  - Candidate output omits raw profile IDs/readiness evidence/identity URLs and secret-like data; it uses a stable hashed candidate key and bounded reason codes.
  - Pool selection is read-only. A unique eligible row may be reported; multiple active authorizations or multiple eligible accounts remain fail-closed (`AMBIGUOUS_AUTHORIZATION` / `AMBIGUOUS_POOL`). An ordered policy is only an exact-authorized destination preference in the projection.
- `src/campaign-authorization.mjs:91-115,226` normalizes `accountSelectionPolicy` only as an ordered list of already authorized exact `(platform, accountId, targetId, profileId)` rows. It rejects missing or mismatched profile bindings. The policy is included in the authorization fingerprint.
- `src/service.mjs:2616-2660` (`authorizeCampaign`) verifies each destination against the existing target and registered enabled account, then persists the target URL and exact profile binding. Authorization cannot name an unregistered or profile-mismatched account.
- `src/service.mjs:3139-3335` materializes posts with a target selected from the candidate. The post's target/content/visibility/authorization bindings and idempotency identity are persisted; destination must match exact target URL/account/profile.
- `src/service.mjs:3772-3970` (`prepareExecutionRequest`) obtains the account from `target.channel + target.accountId`, requires healthy/enabled exact profile and fresh readiness, and persists the request against that identity. It derives/reuses the existing one-time window and grant; duplicate or uncertain submissions are not redispatched.
- `src/standing-campaign-delegation.mjs:13-72` (`deriveStandingExecutionControlPlan`) revalidates exact account/profile/target, readiness, authorization, campaign scope, one-time window, live grant, content hashes, visibility, kill switch and idempotency before dispatch. This is the authoritative execution control seam.
- `src/service.mjs:3964-3998` (`readyExecutionRequests`) repeats account/profile/readiness/grant/window/delegation validation before a request can enter the live worker.
- `src/service.mjs:4200+` and related execution/receipt code bind durable submit intent, transport, activation, acceptance, publication verification and UNKNOWN quarantine to the already-materialized post/request account and profile.

## Why a live selector is unsafe at the current seam

1. **Target identity is account-bound.** A target stores one `accountId` and `profileId`; the authorization destination, post, idempotency key, grant, window, lease and execution request all bind to that target. Choosing another account requires a new target or a new post/authorization binding, not a local selection variable.
2. **Policy already has authority semantics.** `accountSelectionPolicy` is fingerprinted into the authorization and can only order exact destinations already authorized. Reading it to choose a different target after post materialization would make the persisted authorization/post binding stale.
3. **Queue materialization is the authority owner.** `materializeAuthorizedContentCandidates()` calls the existing exact materialization path and then derives readiness, request, window and grant. Adding a selector here would create a second authority path and would need to atomically re-derive every downstream artifact.
4. **Dispatch has an independent exact gate.** `deriveStandingExecutionControlPlan()` and `readyExecutionRequests()` intentionally reject account/profile/target drift. A selector that changed identity after request, durable intent, grant or lease creation would fail closed; bypassing those checks would be a safety regression.
5. **Exactly-once and UNKNOWN semantics depend on identity.** Publication identity/idempotency keys include campaign, content, platform, account and target. A failover after a request or intent exists could produce duplicate or ambiguous external side effects. Historical UNKNOWN rows are immutable and cannot be retried or rebound.
6. **Restart safety depends on persistence.** A selector would need durable selected-candidate identity plus a versioned authority decision and a fresh set of exact window/grant/lease artifacts. A transient/read-model choice cannot survive restart safely.

## Multi-account and ambiguity assessment

- Distinct accounts can only be represented as distinct exact authorization destinations/targets. The current pool projection correctly groups by exact campaign/target and refuses ambiguous eligible pools.
- Repeated identical destination rows are collapsed as representation duplicates; distinct authorization IDs remain ambiguous.
- No evidence shows a target class, account pool authority, failover/cooldown policy, session recovery contract, or account-switching runtime. Existing reports explicitly classify those as unimplemented/unverified (`plans/autonomous-build/account-runtime-audit/report.md`, `plans/autonomous-build/account-runtime-projection/remaining-gaps.md`).
- The ordered policy does not implement account failover: it is advisory projection metadata and is not consulted by post materialization or execution dispatch.

## Tests/evidence inspected

- `test/authorized-account-candidate-projection.test.mjs` covers deterministic candidate output, exact readiness/identity failures, read-only dashboard behavior, duplicate-row collapse, ambiguous authorization/pool behavior, ordered exact policy selection, and profile-binding normalization.
- `test/campaign-authorization.test.mjs` covers exact destination/profile binding, quota/cadence/concurrency, authorization renewal and UNKNOWN behavior.
- `test/standing-campaign-delegation-proof.test.mjs` and `test/standing-campaign-delegation.test.mjs` cover standing authorization to window/grant derivation and fail-closed binding.
- Existing release evidence records the full suite at 515 total / 513 passed / 0 failed / 2 skipped; no live multi-account execution proof exists.

## Smallest safe next seam (not implemented here)

A future authority-owned account-pool milestone would need, at minimum:

1. a versioned standing authorization schema that explicitly names an ordered set of exact target/account/profile destinations (already partly represented by `accountSelectionPolicy`);
2. a durable selection decision bound to campaign authorization fingerprint, target class/target ID, account/profile, readiness evidence/version and policy version;
3. atomic candidate materialization that creates a new exact post/target binding, or an explicit pre-materialization target choice only;
4. fresh one-time window, execution-scoped grant and unique lease derived after selection;
5. no selection/failover once durable submit intent exists; any post-intent uncertainty remains UNKNOWN and quarantined;
6. restart/idempotency tests proving the same selection decision is reused and no second execution is created.

That is a new shared authority contract, not a safe read-model patch. It must be reviewed as its own milestone before implementation.

## Final assessment

The current account candidate/pool projections are the strongest safe dependency-independent implementation available. **Do not add a live selector or failover helper now.** Keep the selector advisory and let the existing materialization/queue/worker remain the sole authority and identity-binding path until an explicit versioned account-pool authority contract exists.
