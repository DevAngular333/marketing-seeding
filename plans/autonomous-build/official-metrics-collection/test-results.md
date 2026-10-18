# Test results

- `node --test test/service.test.mjs`: 54 passed, 0 failed.
- `node --test test/server.test.mjs`: 1 passed, 0 failed.
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
