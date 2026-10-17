# Discovery scheduler milestone report

## Unverified first

- No live network polling was performed.
- The repository `.env.example` now documents `SEEDING_DISCOVERY_POLL_MINUTES=0`; the earlier configuration concern is resolved.
- Full suite and canonical runtime invariants were rerun after the follow-up; see the observer-hardening verification report for the independent read-only check.
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

Focused scheduler tests cover source sanitization, authority immutability, bounded polling, skipped campaigns, error isolation, and interval policy. Synthetic fixtures only. Post-hardening observer subset: 17 passed, 0 failed; full suite: 361 total, 359 passed, 0 failed, 2 skipped.

## No-side-effect statement

No LinkedIn, JEV, ORCA, browser, social, authorization, grant, window, lease, execution, or UNKNOWN records were mutated.

Status: DONE_WITH_CONCERNS
