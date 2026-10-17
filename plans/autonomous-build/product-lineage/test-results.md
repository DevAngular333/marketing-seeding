# Product Lineage Test Results

## Focused

```text
node --test test/product-repository-inspection.test.mjs test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs
41 passed, 0 failed, 0 skipped
```

Coverage includes bounded repository reads, deterministic hashes, path and symlink containment, redaction, factory command safety, artifact hashing, persistent factory history, restart persistence, product-intelligence persistence and dashboard projection.

## Complete suite

```text
node --test test/*.test.mjs
324 total, 322 passed, 0 failed, 2 skipped
```

The two skips are existing environment-dependent ACL checks. No new failures were introduced.

## Static

```text
node --check src/*.mjs
git diff --check
```

Both passed after the final source and journal changes.
