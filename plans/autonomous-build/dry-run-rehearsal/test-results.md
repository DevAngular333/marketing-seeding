# Test results

- `node --test test/readiness-execution.test.mjs test/jev-execution-worker.test.mjs`: 76 passed, 0 failed, 0 skipped.
- `npm test`: 447 total, 445 passed, 0 failed, 2 skipped.
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
- Regression coverage enforces strict matching of top-level and nested dry-run flags, live exclusion, one receipt, repeated tick idempotency, no publication evidence, and no live grant/window consumption.
- Static scheduler review confirms only the dry-run-only branch bypasses `reconcilePendingOnce()`; if autonomous live mode is enabled concurrently, the existing live reconciliation path remains active.
