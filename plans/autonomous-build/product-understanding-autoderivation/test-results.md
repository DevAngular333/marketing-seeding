# Verification

- `node --test test/product-intelligence.test.mjs test/product-intelligence-runtime.test.mjs test/product-repository-inspection.test.mjs test/service.test.mjs` — **67 passed, 0 failed, 0 skipped**
- `node --check src/product-intelligence.mjs` — PASS
- `node --check test/product-intelligence.test.mjs` — PASS
- `node --check test/product-intelligence-runtime.test.mjs` — PASS
- `node --check test/product-repository-inspection.test.mjs` — PASS
- `git diff --check` — PASS
- Canonical runtime read-only integrity — schema 8, revision 194, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6`

The focused suite covers normalized evidence hashing and deduplication,
deterministic field-specific ranking, explicit claim precedence, unsupported
claim quarantine, evidence-reference integrity, credential redaction,
versioned handoff validation and service persistence. Evidence is LOCAL /
SYNTHETIC; no browser, provider, network, social, canonical-state or
historical-UNKNOWN mutation occurred.
