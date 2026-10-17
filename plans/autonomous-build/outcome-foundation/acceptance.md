# Outcome and learning foundation — Acceptance

## Requirements

- **A1** Derive a deterministic, bounded campaign outcome summary from existing persisted posts, publication receipts/status, metric snapshots, interactions, replies, conversions and keyword snapshots.
- **A2** Preserve UNKNOWN and publication distinctions; unknown, absent or unsupported metrics remain explicitly unknown and never become success.
- **A3** Feed the summary into the existing advisory strategy decision only as bounded evidence/reasons; no strategy result may create authority or dispatch an action.
- **A4** Persist only through the existing campaign store and project read-only through the existing dashboard; cap history/output.
- **A5** Never create posts, approvals, grants, windows, leases, execution requests, browser/provider calls or external side effects.
- **A6** Preserve LinkedIn/JEV/ORCA, authorization, idempotency and UNKNOWN semantics; keep SYSTEM_AGENTIC_AI Core frozen.

## Constraints

- **C1** Local fixture and synthetic state only; no network, browser or social mutation.
- **C2** Reuse `JsonStore`, `SeedingService`, existing strategy and dashboard contracts; no second store/router/state machine.
- **C3** Deterministic output for identical state and timestamp bucket; no model/provider dependency.
- **C4** Do not label missing metrics as zero or publication as verified without existing evidence.

## Verification

- **V1** Unit tests cover empty/unknown metrics, verified versus non-verified posts, deltas, interactions/conversions and bounded output.
- **V2** Service tests cover persistence/restart/dashboard projection and no authority side effects.
- **V3** Strategy tests prove outcome evidence is advisory and fail-closed behavior remains unchanged.
- **V4** Full Node suite has zero failures; source syntax and diff checks pass.
- **V5** Independent read-only review confirms no external execution or safety semantic drift.
