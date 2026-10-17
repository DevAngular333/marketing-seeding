# Test results

```text
node --test test/strategy.test.mjs test/control-cycle.test.mjs test/learning.test.mjs test/outcome.test.mjs test/service.test.mjs test/server.test.mjs
49 total, 49 passed, 0 failed, 0 skipped

node --test test/*.test.mjs
384 total, 382 passed, 0 failed, 2 skipped

node --check src/strategy.mjs
passed

git diff --check
passed
```

The full suite emitted an expected fixture-domain guard diagnostic while testing rejection behavior; that test passed. No external side effect was performed.
