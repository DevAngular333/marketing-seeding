# Changes

- Added `normalizeBootstrapProductKeys` for bounded, deterministic product
  reference normalization.
- Added repository resolution in `SeedingService` using exact product keys,
  existing campaign state, optional bounded registry input, configured local
  repository roots, and existing campaign reference artifacts.
- Added fail-closed `PRODUCT_REFERENCE_REQUIRED`,
  `PRODUCT_REPOSITORY_NOT_FOUND`, and `PRODUCT_REPOSITORY_AMBIGUOUS` outcomes.
- Kept explicit `productRepo` input fully compatible and unchanged in meaning.
- Added product-only and ambiguous-match regression tests.

No frozen SYSTEM_AGENTIC_AI contract, canonical state, browser session,
credential, external platform or historical UNKNOWN record was modified.
