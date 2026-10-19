# ORCA Runtime Version Pinning — Acceptance

## Requirements

- A1 Preserve the existing browser transport abstraction and separate transport, activation, acceptance, and publication evidence.
- A2 Require a read-only exact ORCA executable version observation before an ORCA final-submit transport can emit browser input.
- A3 Reject an expected-version mismatch before durable submit intent and before browser input.
- A4 Require exact non-empty runtime/certification version matches when selecting a certified transport.
- A5 Preserve deterministic transport choice and no transport change after durable submit intent.

## Constraints

- C1 Do not click LinkedIn Post or perform any social mutation.
- C2 Do not mutate canonical runtime state, browser session/profile, credentials, or historical UNKNOWN executions.
- C3 Do not add another browser abstraction, publisher, state machine, or store.
- C4 Preserve existing tests and safety semantics.

## Verification

- V1 Focused transport and LinkedIn/JEV tests pass after the patch.
- V2 New regressions prove unknown/mismatched ORCA runtime versions fail closed and matching versions pass.
- V3 Full Node suite and static checks pass.
- V4 Independent read-only review confirms the live irreversible-submit blocker remains accurately recorded.
