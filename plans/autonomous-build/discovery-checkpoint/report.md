# Discovery observer checkpoint

Implemented a small read-only runtime seam for restart/resume observability. `SeedingService.observeDiscoveries` now persists `campaign.discovery.observerCheckpoint` through the existing store after each bounded observation attempt, including all-UNKNOWN attempts. The checkpoint stores only a SHA-256 fingerprint of the configured source list, counts, truncation and timestamp. It does not retain raw URLs, credentials, or execution controls.

This advances the bounded product definition by making crawl attempts visible and resumable at the campaign read model without adding a scheduler, store, state machine, provider, or external side effect.
