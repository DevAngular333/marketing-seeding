# Test results

## Focused backend/API gate

```text
node --test test/service.test.mjs test/server.test.mjs test/product-factory.test.mjs
92 passed, 0 failed, 0 skipped
```

Coverage includes deterministic cached projection, injected probe failure,
sanitization of path/status input, health/dashboard parity, no state mutation,
and the existing Product Factory fail-closed tests.

## UI gate

```text
cd ui && npx tsc --noEmit
npm --prefix ui run build
```

Both passed. Vite emitted only existing configuration deprecation warnings.

## Full gate

```text
npm test
468 total, 466 passed, 0 failed, 2 skipped
```

## Static checks

```text
node --check src/*.mjs
git diff --check
```

Both passed.

## Regression added after the original gate

The projection sanitizer now preserves the valid all-PASS `AVAILABLE` sandbox
status. The regression proves that `executionEligible`, profile/check/limit
statuses and `NOT_EXECUTED_UNSAFE` remain intact. The focused gate above and the
full suite include this regression.
