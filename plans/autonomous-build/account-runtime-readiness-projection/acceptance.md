# Account Runtime Readiness Projection — Acceptance

## Requirements

- **A1** Extend the existing read-only `accountRuntime`/`executionAccounts` projection with bounded `sessionMode`, `authMode`, `eligibleForExecution`, and deterministic `ineligibilityReasons`.
- **A2** Derive those fields only from existing account status/health, exact bound targets, and latest readiness; do not add login, credential, session recovery, account selection, failover, authority, dispatch, browser calls, or a new store/abstraction.
- **A3** Preserve secret-safe allowlisting: no profile IDs, identity URLs, evidence, credentials, cookies, tokens, or session material appear in the projection.
- **A4** Keep readiness and eligibility fail-closed: missing, expired, mismatched, blocked, human-required, unknown, disabled, or unhealthy inputs must be explicit and ineligible.
- **A5** Preserve deterministic ordering, restart equality, canonical state immutability for dashboard reads, and all existing execution/UNKNOWN semantics.

## Constraints

- **C1** Reuse `projectExecutionAccountRuntime` and the existing `SeedingService.dashboard()` path.
- **C2** Do not modify LinkedIn/JEV/ORCA, transport, authorization, grants, windows, leases, submit intent, publication verification, or UNKNOWN quarantine.
- **C3** Do not access authenticated browser profiles, network, credentials, or canonical runtime state.
- **C4** Synthetic/local fixtures only; no external side effect.

## Verification

- **V1** Focused account projection tests pass with zero failures.
- **V2** Full Node suite passes with zero failures; existing skips are reported.
- **V3** Static syntax and diff checks pass.
- **V4** Independent read-only review confirms field allowlist, fail-closed reasons, deterministic/restart behavior, and no authority or execution changes.
- **V5** Canonical runtime SHA/revision and protected UNKNOWN IDs remain unchanged.
