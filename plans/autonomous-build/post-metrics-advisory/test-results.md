# Post metrics advisory test results

## Focused

```text
node --test test/learning.test.mjs test/strategy.test.mjs
25 total, 25 passed, 0 failed, 0 skipped
```

## Integration

```text
node --test test/learning.test.mjs test/strategy.test.mjs test/outcome.test.mjs test/control-cycle.test.mjs test/service.test.mjs test/server.test.mjs
87 total, 87 passed, 0 failed, 0 skipped
```

## Full suite

```text
npm test
428 total, 426 passed, 0 failed, 2 skipped
```

## Static checks

```text
for f in src/*.mjs; do node --check "$f"; done
passed

git diff --check
passed
```

The two skipped tests are existing host ACL checks. The fixture-domain error printed during the suite is an expected rejection diagnostic from a passing test. No canonical state was used for writes and no external effect was performed.
