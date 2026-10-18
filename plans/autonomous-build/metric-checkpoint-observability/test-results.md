# Test results

## Focused gate

- `node --test test/service.test.mjs`: **59 passed, 0 failed, 0 skipped**.

## Full gate

- `npm test`: **435 total, 433 passed, 0 failed, 2 skipped**.

## Static checks

- `node --check src/service.mjs`: **PASS**.
- `node --check test/service.test.mjs`: **PASS**.
- `git diff --check`: **PASS**.

## Safety checks

- Canonical runtime was read-only; schema 8, revision 194, SHA-256
  `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
- Historical UNKNOWN executions and the protected uncertainty record were not
  read-modified or retried.
- No external, browser, ORCA, credential, network, or social action occurred.
