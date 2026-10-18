# Campaign discovery fit through the scheduler — Acceptance

## Requirements

- **A1** Persist an optional, bounded `discoveryFit` on campaign create/update
  using the existing `SeedingService` and `JsonStore` path.
- **A2** Forward a configured campaign `discoveryFit` through
  `pollConfiguredDiscoveries()` to the existing `observeDiscoveries()` path.
- **A3** Preserve legacy campaigns without fit configuration: scheduled
  observation is called without fit hints and discovery records keep the
  existing no-fit shape.
- **A4** Keep fit advisory and fail-closed: existing `MATCHED`, `MISMATCHED`,
  and `UNKNOWN` evaluation remains unchanged and cannot create posts,
  authorizations, windows, grants, leases, execution requests, or publication
  state.
- **A5** Keep campaign execution authority stable when only `discoveryFit`
  changes; `campaignScopeFingerprint()` remains unchanged.

## Constraints

- **C1** Reuse `src/discovery.mjs`, `observeDiscoveries()`,
  `recordDiscoveries()`, `JsonStore`, and the existing scheduler.
- **C2** Bound and normalize audience terms (20 terms, 64 characters each),
  target channel (80 characters), and target locale (32 characters).
- **C3** Reject malformed fit input and credential/session-like material; do
  not persist raw secrets.
- **C4** Do not add a store, router, state machine, provider, browser path,
  authority contract, or live/external execution.
- **C5** Do not mutate canonical runtime state or historical UNKNOWN records.

## Verification

- **V1** Focused tests cover create/update persistence, bounds and validation,
  scheduler forwarding, deterministic fit, legacy no-fit behavior, and
  authority fingerprint immutability.
- **V2** Existing discovery, service, server, and strategy regressions pass.
- **V3** Full Node suite, source syntax checks, and `git diff --check` pass with
  zero new failures.
- **V4** Independent read-only review confirms only the existing campaign and
  discovery seams changed.
