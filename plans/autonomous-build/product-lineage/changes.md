# Product Lineage Changes

- Added `src/product-repository-inspection.mjs` with bounded allowlisted evidence reads, stable hashes, redaction and containment checks.
- Added `test/product-repository-inspection.test.mjs`.
- Added `SeedingService.inspectProductIntelligence()` and an additive inspection endpoint.
- Added campaign-owned bounded `productFactoryRuns` persistence and dashboard projection.
- Hardened factory repository, command cwd and artifact path canonicalization through `realpath`.
- Changed Python syntax validation to `python3 -B` with no cache writes.
- Added focused and restart/bounded-history tests.
- Updated audit and autonomous-build journal evidence to match current source and test results.

No System-Agentic Core, browser session, canonical state, social platform or protected UNKNOWN record was changed.
