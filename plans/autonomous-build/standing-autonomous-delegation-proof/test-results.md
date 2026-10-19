# Test results

## Focused proof

```text
node --test test/standing-autonomous-delegation-proof.test.mjs
1 passed, 0 failed, 0 skipped
```

The proof asserts exact campaign/account/profile/target/content/visibility
binding, automatic request/window/grant derivation, unique lease ownership,
provider-neutral control-plan approval, scheduler idempotency, lease release,
and zero publication artifacts.

## Latest integration gate

```text
npm test
515 total, 513 passed, 0 failed, 2 skipped
node --check src/*.mjs
PASS
git diff --check
PASS
```

Evidence is isolated local state, not live platform evidence.
