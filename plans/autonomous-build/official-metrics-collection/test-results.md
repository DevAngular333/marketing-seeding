# Test results

## Focused gate

- `node --test test/service.test.mjs test/server.test.mjs test/integrations.test.mjs`: **58 passed, 0 failed, 0 skipped**.

## Full gate

- `npm test`: **430 total, 428 passed, 0 failed, 2 skipped**.

## Static checks

- `for f in src/*.mjs; do node --check "$f"; done`: **PASS**.
- `git diff --check`: **PASS**.

## Safety checks

- Canonical runtime was read-only; revision `194`, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Four historical UNKNOWN executions and the protected uncertainty record
  remained unchanged.
- No external, browser, ORCA, credential or social action occurred.
