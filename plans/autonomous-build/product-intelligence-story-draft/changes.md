# Changes

- Added pure `deriveProductIntelligenceStory` to the existing content
  foundation.
- Added `SeedingService.deriveProductIntelligenceStory` using the existing
  product repository, product-intelligence handoff and `JsonStore` seams.
- Added handoff, repository inspection, normalized evidence and source-byte
  revalidation before persistence.
- Added stable story identity and restart-safe idempotent persistence.
- Added bounded CTA/disclosure and credential-like input rejection.
- Added focused deterministic, fail-closed, restart and draft-only regressions.
