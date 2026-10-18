# Test results

- `node --test test/engagement-context.test.mjs`: 4 passed, 0 failed, 0 skipped.
- `node --test test/engagement-context.test.mjs test/service.test.mjs test/strategy.test.mjs`: 91 passed, 0 failed, 0 skipped.
- `node --check src/engagement-context.mjs`: passed.
- `git diff --check`: passed.
