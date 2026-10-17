# Content Foundation — Test Results

```text
node --test test/content-foundation.test.mjs test/service.test.mjs --test-name-pattern=content
33 passed, 0 failed, 0 skipped

node --check src/*.mjs
passed

git diff --check
passed
```

The focused suite covers deterministic draft identity, READY and evidence
gates, unsupported channels, platform length limits, credential rejection,
raw bounds, missing IDs, campaign target scoping, restart persistence and
absence of publication authority side effects.
