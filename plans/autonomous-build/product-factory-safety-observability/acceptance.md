# Product Factory safety observability — acceptance

## Requirements

- **A1** Project the existing sandbox capability preflight through the current
  dashboard and `/health` surfaces as bounded read-only data.
- **A2** Preserve the distinction between backend invocation, effective
  `status`, `executionEligible`, individual limits, and
  `NOT_EXECUTED_UNSAFE` disposition.
- **A3** Cache the host probe for a short bounded interval so dashboard refresh
  does not spawn an unbounded process per request; a failed probe remains
  explicit and fail-closed.
- **A4** Render the blocker in the existing Mission Control dashboard without
  adding approval, execution, artifact promotion, browser, credential or
  publication controls.
- **A5** Redact paths and secrets by construction; expose only the capability
  identifier, version, bounded statuses and reason-safe fields.

## Constraints

- **C1** Reuse `probeFactorySandboxCapability()` and the existing
  `SeedingService.dashboard()` / `/health` projections; do not add a store,
  router, sandbox executor, provider or state machine.
- **C2** Do not run a registered product repository or arbitrary project
  command as part of the projection.
- **C3** Preserve LinkedIn/JEV/ORCA, authority, grant, window, lease,
  idempotency, publication verification and UNKNOWN semantics.
- **C4** Do not mutate canonical runtime, browser/session state, credentials,
  network resources, social platforms or protected UNKNOWN records.

## Verification

- **V1** Service tests prove deterministic projection, short cache reuse,
  injected probe failure handling and no state mutation.
- **V2** HTTP tests prove `/health` and `/api/dashboard` expose the same
  bounded projection without mutation.
- **V3** UI typecheck and production build pass; the panel remains read-only.
- **V4** Full Node suite passes with zero failures; existing skips are reported.
- **V5** Syntax, diff and journal JSON checks pass.
