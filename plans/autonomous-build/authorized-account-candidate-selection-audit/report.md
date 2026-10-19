# Authorized account candidate selection audit

## Result

No new selector or failover helper was added. The current implementation already
provides the narrow safe pre-dispatch read model in
`projectAuthorizedAccountCandidates()` and `projectAuthorizedAccountPoolSummary()`
(`src/service.mjs`). It derives rows only from exact campaign authorization
destinations and assigns deterministic `selectionOrder` after sorting by
eligibility, platform, target, and stable candidate key.

A live account selector would duplicate the exact binding logic in
`deriveStandingExecutionControlPlan()` and `readyExecutionRequests()`, and could
silently rebind a post after authorization, submit intent, or grant creation.
That would violate the existing safety contract. Candidate eligibility is
therefore intentionally advisory only; the queue/worker remains the sole
execution binding authority.

## Evidence

- Candidate projection validates campaign/authorization status, execution mode,
  validity window, authorization and campaign fingerprints, exact target URL /
  platform / account / profile, enabled healthy account, and fresh readiness.
- Candidate output omits raw profile IDs, readiness evidence, identity URLs and
  secret-like fields; it exposes only a profile fingerprint and bounded reason
  codes.
- `readyExecutionRequests()` and `deriveStandingExecutionControlPlan()` repeat
  exact account/profile/target/readiness and grant/window/lease checks before
  dispatch; no candidate projection can create or alter those artifacts.
- Dashboard reads expose candidate and pool summaries without mutating requests,
  windows, grants, leases, posts, or uncertainty records.

## Verification

```text
node --test test/authorized-account-candidate-projection.test.mjs test/account-runtime-projection.test.mjs test/standing-campaign-delegation.test.mjs
16 passed, 0 failed, 0 skipped
```

No browser, credential, canonical runtime, social action, or historical UNKNOWN
record was touched.

## Remaining gap

There is no autonomous account failover, session recovery, OAuth refresh, or
multi-account live proof. Implementing those requires a separately versioned
policy and exact authority derivation; it must not be added as a read-model
selector.
