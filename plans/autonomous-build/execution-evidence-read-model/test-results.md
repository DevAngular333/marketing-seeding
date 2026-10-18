# Test Results

Date: 2026-10-18

## Focused gate

```text
node --test test/service.test.mjs test/server.test.mjs
72 passed, 0 failed, 0 skipped
```

Coverage includes rehearsal/live separation, `NOT_STARTED` dry-run submit
state, no dry-run permalink, independent VERIFIED evidence requirements,
UNKNOWN quarantine visibility, hashed/redacted bounded output, deterministic
ordering, legacy UNKNOWN rows without an execution id and read-only GETs.

## Full gate

```text
npm test
456 total, 454 passed, 0 failed, 2 skipped
```

## Static and UI checks

```text
node --check src/service.mjs
node --check src/server.mjs
node --check test/service.test.mjs
node --check test/server.test.mjs
git diff --check
cd ui && npx tsc --noEmit
cd ui && npm run build
```

All passed. The two skipped Node tests are existing permission checks. The UI
build emitted only the existing Vite native-config warnings.

## State safety

Canonical state remained schema 8, revision 194, SHA-256
`5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
Protected UNKNOWN executions and the protected uncertainty were not mutated.
No ORCA, browser, network, credential or social action occurred.
