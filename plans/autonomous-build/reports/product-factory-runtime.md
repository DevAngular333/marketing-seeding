# Product factory runtime report

- **Status:** LOCAL_VERIFIED, bounded local execution only.
- **Implementation:** `SeedingService.runProductFactory` resolves the registered campaign repository, reuses the safe classifier/allowlisted plan/runner, bounds timeout and output, and optionally hashes caller-selected in-repository artifacts.
- **Endpoint:** `POST /api/campaigns/:id/product-factory`; automation is allowlisted. The response carries `externalSideEffects: false` and `persisted: false`; it cannot create publication authority.
- **Verification:** focused runtime tests pass; no browser, network or external side effect occurred.
- **Limit:** artifacts are not yet persisted as a complete factory run and no generic build/render/media capture pipeline exists.
