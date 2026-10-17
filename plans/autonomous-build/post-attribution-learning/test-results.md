# Test results

```text
node --test test/learning.test.mjs test/strategy.test.mjs
20 total, 20 passed, 0 failed, 0 skipped

node --test test/strategy.test.mjs test/control-cycle.test.mjs test/learning.test.mjs test/outcome.test.mjs test/service.test.mjs test/server.test.mjs
56 total, 56 passed, 0 failed, 0 skipped

node --test test/*.test.mjs
393 total, 391 passed, 0 failed, 2 skipped

node --check src/learning.mjs
passed

node --check src/strategy.mjs
passed

git diff --check
passed
```

The full suite emitted the existing expected fixture-domain guard diagnostic
while testing rejection behavior; that test passed. No external side effect
was performed.
