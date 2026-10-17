# Control cycle foundation

Implemented a bounded `SeedingService.runCampaignControlCycle` that composes
the existing deterministic outcome summary, advisory learning feedback, and
advisory strategy decision methods. The cycle persists only those projections,
deduplicates repeated calls for the same timestamp, and explicitly reports
that it has no authority or external side effects.

An additive automation endpoint is available at
`POST /api/campaigns/:campaignId/control-cycle`. It uses the existing
automation authentication and does not alter execution dispatch routes.

## Evidence

- Focused tests: 2 passed, 0 failed.
- UNKNOWN test confirms `do_nothing` dominance and unchanged authority
  collections.
- Idempotency test confirms one persisted outcome, learning, and strategy row
  for a repeated timestamp.

## Limitations

This is advisory control only. It does not create execution authority or
perform browser/provider/social actions, and does not constitute live proof.
