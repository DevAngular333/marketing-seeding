# Discovery feed observer — test results

## Focused

Command:

```sh
node --test test/discovery-observer.test.mjs test/discovery.test.mjs test/discovery-scheduler.test.mjs
```

Result: **28 passed, 0 failed, 0 skipped**.

## Adjacent regression

Command:

```sh
node --test test/discovery*.test.mjs test/service.test.mjs test/server.test.mjs
```

Result: **110 passed, 0 failed, 0 skipped**.

## Static

- `node --check src/*.mjs`: pass.
- `git diff --check`: pass.

Full-suite release gate after integration: **536 total, 534 passed, 0 failed, 2 skipped**; UI typecheck/build and journal JSON checks pass.
