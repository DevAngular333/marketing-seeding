# Verification

- `node --test test/engagement-context.test.mjs` — 6 passed, 0 failed.
- `node --test test/engagement-context.test.mjs test/service.test.mjs` — 79 passed, 1 initial fixture assertion failure, then corrected and focused projection suite passed. The initial failure was test selection of the no-ID row, not a product failure.
- No canonical runtime, browser, credential, network, or social mutation was used.
