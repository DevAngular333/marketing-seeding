# Verification

- `npm test` — **412 total, 410 passed, 0 failed, 2 skipped**
- `node --test test/service.test.mjs test/server.test.mjs` — **47 passed, 0 failed, 0 skipped**
- `node --check src/service.mjs` — PASS
- `node --check test/service.test.mjs` — PASS
- `git diff --check` — PASS
- Independent review — **ACCEPT**

Covered behavior includes queue-only template derivation from persisted stories,
active standing authority gates, paused/ambiguous/inactive fail-closed paths,
immutable candidate lineage, repeated-tick idempotency, restart idempotency,
source/render/authorization tamper handling and reuse of existing request,
window and grant controls.

Evidence is LOCAL / SYNTHETIC. No browser, ORCA, LinkedIn, social, canonical
runtime or historical UNKNOWN mutation occurred.
