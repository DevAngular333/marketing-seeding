# Verification

- `node --check src/service.mjs` — PASS
- `node --check src/server.mjs` — PASS
- `node --check test/service.test.mjs` — PASS
- `git diff --check` — PASS
- `node --test test/service.test.mjs test/server.test.mjs test/server-lifecycle.test.mjs` — **47 passed, 0 failed, 0 skipped**
- `npm test` / `node --test test/*.test.mjs` — **407 total, 405 passed, 0 failed, 2 skipped**

Evidence class: **LOCAL / SYNTHETIC**. No browser action, ORCA action,
LinkedIn mutation, canonical runtime write or historical UNKNOWN mutation
occurred.
