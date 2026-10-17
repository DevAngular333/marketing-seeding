# Discovery scheduler milestone report

## Unverified first

- No live network polling was performed.
- Full suite and canonical runtime invariants require integrator rerun after this follow-up.
- Scheduler wall-clock firing was not exercised; pure polling seam is covered with injected fixtures.

## Outcome

Implemented an opt-in, bounded campaign discovery poller on the existing `SeedingService` and `JsonStore` boundary. It is disabled unless `SEEDING_DISCOVERY_POLL_MINUTES` is configured to at least 15 minutes, polls only campaigns with sanitized `discoverySources`, isolates per-campaign errors, and reports bounded runtime metadata.

## Acceptance mapping

- A1: campaign create/update persist max-20 HTTP(S) sources without URL credentials.
- A2: server scheduler is opt-in and validates interval >=15 minutes.
- A3: poller calls existing `observeDiscoveries`; no authority or execution paths are invoked.
- A4: `/health` and dashboard expose bounded discovery runtime metadata.
- A5: per-campaign failures are summarized; UNKNOWN observations are not persisted as positive discoveries.
- C1-C5: no second store/router/state machine, no external write/login/browser/provider access, bounded inputs, disabled default, frozen core/contracts.

## Tests

Focused `test/discovery-scheduler.test.mjs` covers source sanitization, authority immutability, bounded polling, skipped campaigns, error isolation, and interval policy. Synthetic fixtures only.

## No-side-effect statement

No LinkedIn, JEV, ORCA, browser, social, authorization, grant, window, lease, execution, or UNKNOWN records were mutated.

Status: DONE_WITH_CONCERNS
