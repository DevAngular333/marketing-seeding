# Conversation Continuity Projection — Acceptance

## Requirements

- **A1** Project existing interactions and replies into bounded chronological turns.
- **A2** Scope continuity by post and campaign; fingerprint identifiers and avoid raw external IDs.
- **A3** Preserve UNKNOWN quarantine and approval-gated reply semantics.
- **A4** Keep the projection pure read-only with no authority, provider, browser, or state mutation.

## Constraints

- **C1** Reuse existing engagement context and JsonStore-shaped state.
- **C2** No new store, router, state machine, provider, account selector, or browser transport.
- **C3** No external or social side effects.

## Verification

- **V1** Focused continuity and engagement-context tests pass.
- **V2** Syntax and diff checks pass.
- **V3** Restart-equivalent input is deterministic and bounded.
