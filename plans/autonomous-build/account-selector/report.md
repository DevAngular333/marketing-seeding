# Account selector audit

## Result

No new runtime selector was added. The current implementation already has a
bounded deterministic account selection read model in `src/service.mjs`:
`projectAuthorizedAccountCandidates()` projects exact campaign authorization
destinations, and `projectAuthorizedAccountPool()` selects an eligible candidate
only when the authorization policy resolves it (ordered policy) or exactly one
eligible candidate exists. Multiple active authorizations and ambiguous pools
fail closed.

This projection is advisory and read-only. It does not create or mutate
execution requests, one-time windows, grants, leases, browser sessions,
credentials, posts, or uncertainty records. `readyExecutionRequests()` and
standing execution control derivation remain the authoritative pre-dispatch
binding checks.

## Evidence

- Exact campaign, authorization, target URL/platform/account/profile, account
  status/health, validity, fingerprint, and fresh readiness checks are applied.
- Ordered account selection policy is restricted by normalization to exact
  authorized destinations and exact profile binding.
- Output is allowlisted: profile IDs, readiness evidence, identity URLs, and
  secret-like values are omitted; profile fingerprints and bounded reason codes
  are used.
- No live browser or canonical runtime state was touched.

## Verification

```text
node --test test/authorized-account-candidate-projection.test.mjs test/account-runtime-projection.test.mjs test/standing-campaign-delegation.test.mjs
19 passed, 0 failed, 0 skipped
node --check src/service.mjs
passed
git diff --check
passed
```

## Boundary / remaining gap

Autonomous account failover, session recovery/OAuth refresh, and multi-account
live proof remain unimplemented and require separately versioned policy and
exact authority derivation. A second dispatch selector would duplicate the
binding authority and could permit unsafe post-authorization rebinding, so it
was intentionally not introduced.
