# Test Results

Date: 2026-10-18

## Focused gate

```text
node --test test/integrations.test.mjs test/service.test.mjs test/server.test.mjs
70 passed, 0 failed, 0 skipped
```

The integration subset covers transient transport errors, `429`, valid
numeric `Retry-After`, valid HTTP-date `Retry-After`, malformed/negative/
oversized hints, and fail-fast `401` behavior.

## Full gate

```text
npm test
444 total, 442 passed, 0 failed, 2 skipped
```

## Static checks

```text
node --check src/integrations.mjs
node --check test/integrations.test.mjs
git diff --check
```

All passed. The independent bounded review is recorded by
`/root/metric_provider_resilience_review` as PASS after the signed negative
hint fix.

## State safety

Read-only canonical inspection remained schema 8, revision 194, SHA-256
`5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`.
Protected UNKNOWN executions and uncertainty records were not touched.
