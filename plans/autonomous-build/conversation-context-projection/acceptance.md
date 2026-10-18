# Conversation Context Projection — Acceptance

## Requirements

- **A1** Project bounded deterministic conversations from existing interactions/replies joined to post, campaign, target and channel.
- **A2** Preserve stable-ID deduplication, no-ID observations, cross-post isolation, and reply state semantics.
- **A3** Emit explicit fail-closed reason codes for grounding, approval, duplicate/already-replied, UNKNOWN, readiness and unsupported-channel conditions.
- **A4** Keep the projection advisory/read-only: no authority, execution request, lease, grant, window, browser, provider, reply or publication mutation.
- **A5** Expose the projection through the existing dashboard read model with bounded, secret-safe identifiers.

## Constraints

- **C1** Reuse existing JsonStore schema, interactions/replies, target policies, UNKNOWN quarantine and dashboard.
- **C2** No new browser abstraction, provider router, account selector, state machine or external adapter.
- **C3** No live browser, network write, credentials, canonical state mutation or social action.

## Verification

- **V1** Focused projection tests pass.
- **V2** Existing service and strategy regressions pass.
- **V3** Syntax and diff checks pass.
- **V4** Projection is deterministic under restart-equivalent input and UNKNOWN rows remain non-actionable.
