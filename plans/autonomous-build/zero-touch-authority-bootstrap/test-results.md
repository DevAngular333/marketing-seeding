# Test Results

## Focused

```text
node --test test/campaign-bootstrap.test.mjs
5 passed, 0 failed, 0 skipped
```

Coverage includes deterministic authority derivation, idempotence,
product-only repository resolution, ambiguous repository rejection, missing or
ambiguous account/target rejection, and stale-readiness blocking.

## Full

```text
npm test
543 total
541 passed
0 failed
2 skipped
```

The two skips are existing host ACL/evidence-environment checks. No test
performed a browser command or external side effect.

## Static

```text
node --check src/service.mjs
node --check src/campaign-bootstrap.mjs
git diff --check
```

All passed.
