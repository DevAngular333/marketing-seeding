# Account selector next

## Outcome

Added a pure deterministic selector over the existing authorized account pool projection. It accepts exactly one campaign/target pool row only when the projection reports `UNIQUE_ELIGIBLE` or `POLICY_SELECTED`, and returns the selected candidate key plus redacted account/profile references. Ambiguous authorizations, multiple eligible accounts without policy, blocked rows, missing keys, and key mismatches fail closed.

## Safety boundary

The helper does not write state, create or derive authority, rebind targets, choose a new account for an existing post, or dispatch browser work. Existing execution request preparation and exact account/profile/target/authorization checks remain authoritative. Historical UNKNOWN records are untouched.

## Files

- `src/service.mjs`: pool rows now carry selected account ID/profile fingerprint and exports `selectAuthorizedAccountCandidate`.
- `test/authorized-account-candidate-projection.test.mjs`: deterministic selection, mismatch, ambiguity, blocked pool, and immutability regressions.

## Verification

`node --test test/authorized-account-candidate-projection.test.mjs` — 11 passed, 0 failed.
`git diff --check` — passed.

## Remaining limitation

This is a planning/selection primitive only. It does not implement secure credential provisioning, session recovery, account switching, or live failover after an execution has started. A live execution remains pinned to its exact authorized account/profile and cannot be rebound.
