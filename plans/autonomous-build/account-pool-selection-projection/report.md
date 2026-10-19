# Account pool selection projection

## Outcome

Added `projectAuthorizedAccountPool`, a pure Mission Control projection that groups existing exact authorized account candidates by campaign and target. It reports a unique eligible candidate only when exactly one candidate is eligible; multiple eligible candidates remain `AMBIGUOUS_POOL` and are never selected. No target rebinding, authorization derivation, execution request, lease, grant, browser action, login, or external side effect is performed.

## Verification

- `node --check src/service.mjs` — passed.
- `node --test test/authorized-account-candidate-projection.test.mjs` — 6 passed, 0 failed, 0 skipped.
- `git diff --check` — passed.

## Files

- `src/service.mjs`
- `test/authorized-account-candidate-projection.test.mjs`

## Boundary

This is advisory only. Existing exact execution contracts remain authoritative. Secure credential/session recovery, account failover policy, and live multi-account proof remain unimplemented.

## Deduplication hardening

Repeated exact candidate keys are collapsed before eligibility counting. This prevents duplicate authorization destination rows from falsely producing `AMBIGUOUS_POOL`; distinct authorization identities remain ambiguous and fail closed.

The pool view also exposes an allowlisted `eligibleAccounts` list containing account IDs, profile fingerprints, and session/auth mode labels only. Raw profile IDs, identity URLs, credentials, cookies, and readiness evidence remain excluded.

It now reports `selectionPolicy: { status: "UNSPECIFIED", reason: "no_explicit_account_preference_policy" }` so operators can distinguish an intentional fail-closed policy boundary from an implementation error. This remains read-only metadata and does not authorize selection.

An explicit authorization-level `accountSelectionPolicy` may now declare an ordered list of already authorized exact destinations. The projection selects the first eligible exact destination only; missing policy preserves legacy fail-closed behavior, and no target/account rebinding or new authority is created.
