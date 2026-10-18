# Verification

- `node --test test/service.test.mjs --test-name-pattern='queue story derivation|queue derives one deterministic product story'` — **52 passed, 0 failed, 0 skipped**
- `node --test test/content-foundation.test.mjs test/product-intelligence.test.mjs test/product-intelligence-runtime.test.mjs test/service.test.mjs test/server.test.mjs test/server-lifecycle.test.mjs` — **74 passed, 0 failed, 0 skipped**
- `npm test` — **420 total, 418 passed, 0 failed, 2 skipped**
- `node --check src/service.mjs` — PASS
- `node --check test/service.test.mjs` — PASS
- `git diff --check` — PASS
- Independent review — **ACCEPT**

Regression coverage includes explicit policy normalization and fingerprinting,
one-story idempotency across queue ticks and restart, missing policy,
ambiguous authority, stale authorization binding, stale campaign binding,
source drift, incomplete product intelligence and zero changes to posts,
execution requests, windows, grants, leases and UNKNOWN records on fail-closed
paths.

Evidence is LOCAL / SYNTHETIC. No browser, ORCA, LinkedIn, social, canonical
runtime or historical UNKNOWN mutation occurred.
