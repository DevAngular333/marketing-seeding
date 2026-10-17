# Strategy Foundation — Changes

- Added `src/strategy.mjs` with deterministic bounded advisory decisions.
- Added `SeedingService.deriveStrategy` persistence through `JsonStore`.
- Added read-only dashboard strategy projection.
- Added additive `POST /api/campaigns/:id/strategy` route.
- Added strategy regression tests, including realistic UNKNOWN rows without a
  campaign ID.
- Preserved existing LinkedIn, JEV, ORCA, authorization, grant, window, lease,
  idempotency and publication verification contracts.
