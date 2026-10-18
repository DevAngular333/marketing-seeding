# Test results

## Focused backend/API gate

```text
node --test test/service.test.mjs test/server.test.mjs test/product-factory.test.mjs
91 passed, 0 failed, 0 skipped
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
466 total, 464 passed, 0 failed, 2 skipped
```

## Static checks

```text
node --check src/*.mjs
git diff --check
```

Both passed.
