# Test results

## Focused

```text
node --test test/service.test.mjs
80 passed, 0 failed, 0 skipped
```

The focused service tests cover complete automatic intake, restart idempotency,
incomplete fail-closed behavior, source drift, ambiguous/stale authority,
template derivation, and zero execution artifacts on rejected paths.

## Integration gates

```text
npm test
515 total, 513 passed, 0 failed, 2 skipped

node --check src/*.mjs
PASS

git diff --check
PASS

ui/node_modules/.bin/tsc -p ui/tsconfig.json --noEmit
PASS

npm --prefix ui run build
PASS
```

All evidence is local or synthetic. No live platform, browser, ORCA final
submit, credential, canonical runtime, or social mutation was used.
