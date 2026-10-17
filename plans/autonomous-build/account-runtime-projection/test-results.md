# Test Results

## Focused

```text
node --test test/account-runtime-projection.test.mjs
3 passed, 0 failed, 0 skipped
```

## Full

```text
node --test test/*.test.mjs
367 total, 365 passed, 0 failed, 2 skipped
```

## Static

```text
node --check src/service.mjs
git diff --check
```

Both passed.
