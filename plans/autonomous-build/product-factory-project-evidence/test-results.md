# Test Results

## Focused

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs
45 passed, 0 failed, 0 skipped
```

## Full suite

```text
node --test test/*.test.mjs
379 total, 377 passed, 0 failed, 2 skipped
```

The two skips are existing runtime-token ACL and browser-evidence directory
permission checks.

## Static/state checks

- Node syntax checks passed.
- `git diff --check` passed.
- Canonical runtime and protected UNKNOWN execution records were read-only and
  unchanged.
- No browser, network, credential, or social mutation occurred.

