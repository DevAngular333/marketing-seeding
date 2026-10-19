# Test results

## Focused gate

```text
node --check src/service.mjs
git diff --check
node --test test/authorized-account-candidate-projection.test.mjs test/account-runtime-projection.test.mjs test/readiness-execution.test.mjs
55 passed, 0 failed, 0 skipped
```

The focused gate covers deterministic ordering and stable candidate identity,
exact authorization/target/account/profile/readiness rejection, secret-safe
allowlisting, dashboard read-only behavior, restart equality and absence of
execution artifacts.

## Full gate

Pending the final integration run after the independent read-only verifier's
last-change check. No live lane was invoked.
