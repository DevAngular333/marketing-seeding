# Changes

- Added the provider-neutral pure `projectExecutionRuntime(state)` read model
  to the existing service module.
- Added bounded mode/state/phase/submit counts, latest action, blocker codes,
  recent rows and immutable UNKNOWN quarantine projection.
- Added strict independent publication evidence checks before exposing a
  permalink; dry-run and quarantined evidence can never be VERIFIED.
- Added the projection to existing `SeedingService.dashboard()` and `/health`
  responses without adding a route or changing authorization/execution.
- Added service and server regression coverage for redaction, bounds,
  deterministic ordering and no-write GET behavior.

No store/schema/state-machine/browser/provider/router/LinkedIn semantics were
changed.
