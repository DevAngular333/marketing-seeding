# Product Factory artifact evidence — Test results

## Focused

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs test/service.test.mjs
40 passed, 0 failed, 0 skipped
```

Independent read-only review:

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs
12 passed, 0 failed, 0 skipped
```

## Full gate

```text
node --test test/*.test.mjs
364 total, 362 passed, 0 failed, 2 skipped
```

Skipped tests are the existing runtime-token ACL checks for broad local user
groups and browser-evidence directory permissions.

## Static and state checks

- `node --check src/*.mjs` — passed.
- `git diff --check` — passed.
- Repository JSON parse sweep — passed.
- Canonical runtime read-only check — schema 8, revision 194, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Protected UNKNOWN execution IDs and uncertainty remain present and
  unchanged; active authorizations/windows/grants/leases remain zero.
- No browser, network, credential, social or canonical-state write occurred.
