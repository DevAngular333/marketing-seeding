# Test results

## Focused

```text
node --test test/outcome.test.mjs test/control-cycle.test.mjs test/learning.test.mjs test/service.test.mjs
42 passed, 0 failed, 0 skipped
```

## Full suite

```text
node --test test/*.test.mjs
388 total, 386 passed, 0 failed, 2 skipped
```

The full suite emitted the existing expected fixture-domain guard diagnostic;
the corresponding rejection test passed.

## Static

```text
node --check src/outcome.mjs
git diff --check
```

Both passed.

## Independent review

Read-only review verdict: **ACCEPT (bounded)**. No authority, browser,
provider, social, canonical runtime or historical UNKNOWN mutation found.
