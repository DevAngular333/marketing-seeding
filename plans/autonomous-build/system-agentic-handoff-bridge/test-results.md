# Test results

## Focused

```text
node --test test/system-agentic-handoff-bridge.test.mjs test/distribution-handoff.test.mjs test/server.test.mjs
14 passed, 0 failed, 0 skipped
```

Coverage includes:

- versioned upstream envelope consumption;
- downstream canonical identity and integrity validation;
- `DRY_RUN`-only and unsupported-version gates;
- timestamp, hash and route campaign binding;
- forbidden execution/credential fields;
- malformed canonical references;
- restart replay idempotency;
- zero execution artifacts;
- wrapped HTTP route and raw canonical compatibility.

## Full regression

```text
npm test
461 total, 459 passed, 0 failed, 2 skipped
```

The two skips are the existing host ACL checks. The expected fixture-domain
guard log is emitted by an existing negative test and does not represent a
test failure.

## Static

```text
node --check src/*.mjs
git diff --check
PASS
```

No external side effect, browser action, ORCA command, credential access or
canonical production write occurred.
