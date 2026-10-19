# Regression results

## Focused transport and publication safety gate

```text
node --test test/browser-interaction-transport.test.mjs \
  test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs \
  test/jev-execution-worker.test.mjs

154 passed, 0 failed, 0 skipped
```

Coverage includes command completion versus activation, pointer and
accessibility transport receipts, stale/moving/covered controls, wrong
composer/account/profile gates, durable intent ordering, timeout and UNKNOWN
quarantine, duplicate dispatch prevention and no second final click.

## Full suite

```text
npm test
538 total, 536 passed, 0 failed, 2 skipped
```

## Static checks

```text
node --check src/*.mjs
git diff --check
```

Both passed after the source/test patch. The two existing skips remain the
runtime ACL and browser-evidence permission checks.

## External safety

No LinkedIn Post, comment, Like, Follow, Connect, message, account change,
credential change, publication, retry or reconciliation was performed.
