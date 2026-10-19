# Account pool runtime scout — 2026-10-19

## Verdict

**NO SOURCE CHANGE RECOMMENDED.** The repository already contains a deterministic, read-only account pool projection and explicit ordered selection policy. Adding another selector or failover layer would duplicate authority and could weaken exact target/account/profile binding.

## Evidence inspected

- `src/service.mjs`
  - `projectAuthorizedAccountCandidates(...)` (around line 1249) projects exact authorization destinations, validates campaign/authorization/target/account/readiness bindings, redacts profile/identity material, and never mutates state.
  - `projectAuthorizedAccountPool(...)` (around line 1345) groups by exact campaign/target, treats duplicate rows as representation duplicates, selects a unique eligible candidate, applies an explicit `accountSelectionPolicy.mode=ordered`, and fails closed on multiple active authorizations or multiple eligible accounts.
  - `authorizeCampaign(...)` validates each destination against the registered target, enabled execution account, exact profile, URL, approved assets, and campaign grounding before activating authority.
  - Dispatch/delegation paths (`queueAuthorizedCampaignJobs`, `deriveStandingExecutionControlPlan`) consume the post's already-bound target/account/profile and revalidate exact bindings before creating/using execution controls.
- `src/standing-campaign-delegation.mjs`
  - `deriveStandingExecutionControlPlan(...)` rejects account/profile mismatch, stale readiness, stale authorization, missing window/grant, idempotency conflicts, and UNKNOWN quarantine. It returns an exact immutable control only after all gates pass.
- `src/readiness.mjs`
  - Execution accounts are normalized with platform/account/profile identity; LinkedIn requires an immutable ORCA profile UUID.
- `test/authorized-account-candidate-projection.test.mjs`
  - Covers deterministic projection, secret/evidence redaction, stale/mismatched readiness, unique candidate selection, duplicate destination collapse, ambiguous authorization fail-closed behavior, ordered policy selection, exact profile normalization, dashboard read-only behavior, and state immutability.
- `test/standing-campaign-delegation.test.mjs`, `test/standing-autonomous-delegation-proof.test.mjs`
  - Cover exact execution delegation gates and unhealthy-account rejection.

## Runtime boundary

The pool projection is **advisory Mission Control data**, not a live account router. It does not create authority, windows, grants, leases, or execution requests. The live queue binds a post to one exact destination; the worker then revalidates that destination and account. This is the safe boundary for current milestone work.

## Exact blocker

A future multi-account failover lane would require a versioned shared contract describing when a standing authorization may choose an alternate exact destination before any execution controls are issued. Current execution state is post/target bound and the live grant/window/lease contracts are exact identity bindings. Implementing failover now would require changing those shared contracts and adding migration/idempotency/recovery proof. It is therefore **CONTRACT_CHANGE_REQUIRED**, not a safe dependency-independent patch.

## Safety conclusion

No live credentials, browser sessions, canonical runtime state, external platform, or UNKNOWN execution was accessed or mutated. No selector or failover implementation was added.
