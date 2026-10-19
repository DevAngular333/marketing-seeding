# Product Factory evidence projection

Implemented a deterministic, bounded, secret-safe read model for persisted Product Factory runs. The projection exposes classification, plan/execution status, side-effect flags, artifact count, relative artifact paths, hashes, sizes, and bounded command references through `SeedingService.dashboard()` as `productFactoryEvidence`.

This is observability only. It does not run commands, alter sandbox eligibility, promote artifacts, create execution authority, or touch external systems. Arbitrary build/render execution remains fail-closed because the host sandbox profile/resource limits are not audited.

Evidence: `node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs` (23 passed), `node --check src/product-factory.mjs`, `node --check src/service.mjs`, `git diff --check`.
