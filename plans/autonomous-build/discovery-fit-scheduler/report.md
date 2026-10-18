# Discovery fit scheduler

## Unverified first

- No live discovery network, browser, ORCA, provider, credential, LinkedIn,
  social, or canonical-state mutation was performed.
- This milestone does not prove autonomous audience/channel discovery; it only
  carries explicit campaign fit hints into the existing bounded observer.

## Outcome

Campaigns now optionally persist bounded `discoveryFit` configuration through
the existing `SeedingService`/`JsonStore` campaign seams. The existing opt-in
poller forwards that fit only for configured campaigns to
`observeDiscoveries()`. Legacy campaigns continue to receive `{ urls }` and
retain the no-fit discovery shape. Fit remains advisory evidence and is not
part of `campaignScopeFingerprint()`.

## Evidence

- Focused gate: `node --test test/discovery-scheduler.test.mjs test/discovery.test.mjs test/strategy.test.mjs test/service.test.mjs test/server.test.mjs` — **90 passed, 0 failed, 0 skipped**.
- Full gate: `npm test` — **446 total, 444 passed, 0 failed, 2 skipped**.
- Static gate: all `src/*.mjs` and the edited test parse; `git diff --check` passes.
- Independent review: **PASS_BOUNDED** by `/root/audience_channel_review`.
- Canonical state read-only check: schema 8, revision 194, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`;
  four historical UNKNOWN executions and uncertainty records remain protected.

## Scope

- `src/service.mjs`: bounded normalization, create/update persistence, and
  scheduler forwarding.
- `test/discovery-scheduler.test.mjs`: bounds, normalization, credential
  rejection, create/update/clear, scheduler forwarding, legacy behavior, and
  authority fingerprint regressions.
- No authority, execution, browser transport, platform adapter, provider,
  publication, or UNKNOWN-submission path changed.

## Review note

The scheduler forwarding test uses a mock observer. Existing observer,
discovery, service, and strategy tests cover fixture fetch, persistence,
deterministic fit, no-fit compatibility, and fail-closed mismatch/unknown
strategy behavior.
