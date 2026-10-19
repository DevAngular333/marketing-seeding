# Test results

Focused projection gate:

```text
node --test test/service.test.mjs
77 passed, 0 failed, 0 skipped
```

Additional gates after the final source/test change:

```text
node --check src/*.mjs
git diff --check
```

Both passed. The current integration-branch full suite completed with:

```text
515 total, 513 passed, 0 failed, 2 skipped
```

UI typecheck and production build also passed in the same work session.
