# Channel capability/readiness projection

## Outcome

Added a bounded Mission Control read model at `channelCapabilities`. It combines the existing `CHANNELS` policy registry with configured targets and their fresh readiness records. Operators can now see whether a channel is ready, missing a target, waiting for rules review, missing fresh session readiness, or blocked by inactive targets.

This is advisory only. It does not select accounts, create authorization, invoke a browser/provider, or mutate state. Existing `channels` counts remain unchanged for compatibility.

## Evidence

- `node --test test/channel-capability-projection.test.mjs`: 2 passed, 0 failed.
- `node --test test/service.test.mjs test/server.test.mjs test/channel-capability-projection.test.mjs`: 84 passed, 0 failed.

## Remaining limits

The projection reflects persisted caller/provider readiness; it does not perform live login, account failover, channel discovery, or publication. LinkedIn irreversible execution remains blocked by missing fresh live authorization and live transport/publication proof.
