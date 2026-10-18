# Test results

Date: 2026-10-18

## Focused

```text
node --test test/discovery-scheduler.test.mjs test/discovery.test.mjs test/strategy.test.mjs test/service.test.mjs test/server.test.mjs
90 passed, 0 failed, 0 skipped
```

## Full

```text
npm test
446 total, 444 passed, 0 failed, 2 skipped
```

## Static

```text
for f in src/*.mjs; do node --check "$f"; done
git diff --check
```

Passed.

## Safety

No live network, browser, ORCA, provider, credential, social, canonical, or
historical UNKNOWN mutation occurred.
