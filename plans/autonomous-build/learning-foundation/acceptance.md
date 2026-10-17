# Learning Foundation — Acceptance

## Requirements

- **A1** Derive a deterministic, bounded learning feedback record from existing campaign outcome and strategy state.
- **A2** Preserve UNKNOWN quarantine and distinguish verified publication, measured metrics, missing metrics and unsupported metrics.
- **A3** Persist feedback through the existing `JsonStore` with bounded history and restart survival.
- **A4** Expose feedback only as advisory/read-only dashboard data and an additive campaign endpoint; it must not create authority, grants, windows, leases, executions or browser actions.
- **A5** Include stable evidence references and an explainable recommendation chosen from a finite action set.
- **A6** Add focused regression tests for unknown hold, missing metric collection, measured outcome adaptation, deterministic identity and persistence/projection.

## Constraints

- **C1** Reuse existing `SeedingService`, `JsonStore`, campaign state, outcome summary and strategy contracts; no duplicate store/router/state machine.
- **C2** Do not modify LinkedIn/JEV/ORCA execution, transport, authorization, grant, lease, submit intent, publication verification or UNKNOWN semantics.
- **C3** No network, browser, social mutation, credential/session access or external side effect.
- **C4** Keep `SYSTEM_AGENTIC_AI` Core frozen.
- **C5** Do not turn advisory feedback into automatic execution authority or per-action approval.
- **C6** Keep outputs bounded, redacted and deterministic for equivalent inputs/time bucket.

## Verification

- **V1** Focused learning/outcome/strategy/service/dashboard tests pass with zero failures.
- **V2** Syntax and diff checks pass after the last change.
- **V3** Independent read-only review confirms scope, persistence, identity links and no authority/execution side effects.
- **V4** Full Node suite passes with zero failures; skipped tests are reported.
- **V5** Canonical runtime and protected UNKNOWN records remain unchanged.
