# Test results

## Focused gate

Command:

```sh
node --test test/service.test.mjs test/outcome.test.mjs
```

Result: **39 passed, 0 failed, 0 skipped**.

## Combined review

Command:

```sh
node --test test/service.test.mjs test/outcome.test.mjs test/control-cycle.test.mjs
```

Result: **41 passed, 0 failed, 0 skipped**.

## Full suite

Command:

```sh
node --test test/*.test.mjs
```

Result: **397 total, 395 passed, 0 failed, 2 skipped**.

## Static checks

- `node --check src/service.mjs`: passed.
- `git diff --check`: passed.

No external or canonical runtime checks were run.
