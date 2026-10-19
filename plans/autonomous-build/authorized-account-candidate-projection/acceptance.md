# Authorized account/session candidate projection — acceptance

## Requirements

- **A1** Project only exact campaign-authorized destinations using the existing campaign authorization, target, execution account and readiness contracts.
- **A2** Mark a destination eligible only when campaign/authorization scope and validity, exact platform/account/profile/target binding, enabled healthy account, active target and fresh bound readiness all pass; otherwise expose deterministic fail-closed reason codes.
- **A3** Return deterministic candidate ordering and a stable selection key without rebinding targets, switching profiles, or creating authority or execution artifacts.
- **A4** Expose a bounded read-only candidate projection through the existing dashboard read model; no credentials, cookies, tokens, raw profile material or readiness evidence may be exposed.
- **A5** Preserve the existing queue, one-time window, grant, lease, idempotency, submit and UNKNOWN semantics; candidate eligibility must be documented as a pre-dispatch projection and must not imply publication readiness or platform support.

## Constraints

- **C1** Reuse `SeedingService`, `JsonStore`, `projectExecutionAccountRuntime`, campaign authorization, target and readiness contracts; do not add a store, state machine, browser abstraction, provider router, credential broker or account recovery implementation.
- **C2** Read-only/local fixtures only; no browser, ORCA, LinkedIn, network, credential, canonical runtime or social mutation.
- **C3** Do not rebind a post/target to another account, derive grants/windows/leases, create execution requests, retry execution or touch historical UNKNOWN records.
- **C4** Keep `SYSTEM_AGENTIC_AI` Core frozen and keep dashboard changes read-only.
- **C5** Do not persist or print secret/session material.

## Verification

- **V1** Focused candidate projection tests pass with zero failures.
- **V2** Existing account/readiness/JEV/LinkedIn tests and complete Node suite pass with zero failures; skips are reported.
- **V3** Candidate projection is deterministic under a fixed clock, restart-safe, bounded and secret-safe.
- **V4** Canonical runtime revision/SHA and protected UNKNOWN execution IDs remain unchanged.
- **V5** Independent read-only review checks the final diff and reruns the focused gate after the last change.
