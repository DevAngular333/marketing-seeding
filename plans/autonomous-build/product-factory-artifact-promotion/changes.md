# Changes

- Added `SeedingService.promoteProductFactoryArtifact` using the existing store and artifact schema.
- Bound promotion to the exact successful run/campaign/repository/candidate path and hash, and re-read current source bytes inside the mutation.
- Added relative-path validation, bounded credential/session-safe metadata checks, provenance, conflict detection and restart-safe idempotency.
- Added operator-only HTTP route; automation callers and unauthenticated callers cannot promote.
- Added regressions for happy path, no authority/execution side effects, restart idempotency, stale bytes, path/hash errors, secret-like metadata, failed runs and HTTP role boundary.
