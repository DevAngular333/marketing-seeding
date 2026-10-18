# Engagement Context in Advisory Strategy

## Outcome

`deriveStrategyDecision` now composes a bounded, campaign-scoped summary from the existing read-only engagement-context projection when it chooses `ENGAGE` or `RESEARCH` from an eligible discovery. The decision records deterministic evidence and reason codes for observed/actionable conversation context.

## Safety

This is advisory only. No execution request, grant, lease, account selection, reply mutation, or provider call is created. Existing `UNKNOWN` quarantine remains dominant and prevents engagement context from being projected into a decision.

## Verification

- `node --test test/strategy.test.mjs` — 14 passed, 0 failed.
- Added coverage for context evidence, side-effect flags, and UNKNOWN dominance.

## Limitations

The projection is evidence for strategy explanation; it does not authorize autonomous replies. Existing approval and platform readiness gates remain authoritative.
