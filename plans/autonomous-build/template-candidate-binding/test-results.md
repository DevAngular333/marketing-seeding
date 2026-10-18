# Verification

- `node --test test/service.test.mjs test/server.test.mjs` — **46 passed, 0 failed, 0 skipped**
- `npm test` — **410 total, 408 passed, 0 failed, 2 skipped**
- `node --check src/content-foundation.mjs` — PASS
- `node --check src/service.mjs` — PASS
- `node --check src/server.mjs` — PASS
- `git diff --check` — PASS

Covered behavior includes deterministic template rendering and fingerprints,
source/claim/authorization binding, target/account/profile/URL scope, HTTP
operator-only derivation, contract/fingerprint/authorization/claim/source/render/
target tamper rejection, queue idempotency across ticks and
restart, existing execution-control reuse, legacy draft-only behavior and
terminal/UNKNOWN no-replay behavior.

Evidence class: **LOCAL / SYNTHETIC**. No browser action, ORCA action,
LinkedIn mutation, canonical runtime write or historical UNKNOWN mutation
occurred.
