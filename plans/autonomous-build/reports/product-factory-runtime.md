# Product factory runtime report

- **Status:** LOCAL_VERIFIED, bounded local execution only.
- **Implementation:** `SeedingService.runProductFactory` resolves the registered campaign repository, reuses the safe classifier/allowlisted plan/runner, bounds timeout and output, and optionally hashes caller-selected in-repository artifacts.
- **Endpoint:** `POST /api/campaigns/:id/product-factory`; automation is allowlisted. The response carries `externalSideEffects: false` and `persisted: true`; the existing campaign store retains a bounded 24-entry run lineage and it cannot create publication authority.
- **Verification:** product-factory focused/runtime tests and the complete Node suite pass; restart persistence and bounded history are covered; no browser, network or external side effect occurred.
- **Limit:** run lineage is persisted, but no generic build/render/media capture pipeline exists and artifact registration remains explicit/bounded.
