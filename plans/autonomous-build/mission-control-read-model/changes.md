# Mission Control Read Model — Changes

## Added

- A read-only `MissionControlPanel` in the existing overview composition.
- Explicit advisory and UNKNOWN/no-data rendering for absent state.
- Compact responsive styling for the four bounded operator-context cards.
- Tracked production bundle output corresponding to the UI source change.

## Reused

- Existing `/api/dashboard` GET response and dashboard fetch lifecycle.
- Existing `automation.controlCycle`, `strategy`, `learning` and `outcomes`
  projections.
- Existing formatter and status styling conventions.

## Deliberately unchanged

- Campaign store and state machine.
- Authorization, quota, cadence, grant, window and lease semantics.
- JEV, LinkedIn adapter, ORCA transport, submit intent and publication
  verification.
- Dashboard routes, operator controls and external integrations.
- `SYSTEM_AGENTIC_AI` Core.
