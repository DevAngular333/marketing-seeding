# Test results

- node --test test/conversation-continuity.test.mjs test/engagement-context.test.mjs: 12 passed, 0 failed.
- node --test test/opportunity-projection.test.mjs: 3 passed, 0 failed.
- node --test test/authorized-account-candidate-projection.test.mjs: 6 passed, 0 failed.
- npm test: 515 total, 513 passed, 0 failed, 2 skipped.
- node --check src/*.mjs: passed.
- git diff --check: passed.
- UI typecheck and production build: passed.

All evidence is local/read-only or synthetic.
