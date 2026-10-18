# Verification

- `node --check src/server.mjs` — PASS
- `node --check test/server.test.mjs` — PASS
- `node --check test/server-lifecycle.test.mjs` — PASS
- `git diff --check` — PASS
- `node --test test/service.test.mjs test/server.test.mjs test/server-lifecycle.test.mjs` — **46 passed, 0 failed, 0 skipped**
- `npm test` / `node --test test/*.test.mjs` — **406 total, 404 passed, 0 failed, 2 skipped**

Evidence class: **LOCAL / SYNTHETIC**. No browser action, ORCA action,
LinkedIn mutation, canonical runtime write or historical UNKNOWN mutation
occurred.
