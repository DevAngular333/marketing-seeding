# Product Understanding Auto-Derivation

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN
**Branch:** `integration/autonomous-build`

## Outcome

`buildProductIntelligence` now derives bounded, deterministic descriptive candidates from already normalized local repository evidence when callers omit a field. Safe `package.json` descriptions are accepted as `WHAT_IS_IT`; otherwise sentence-level repository evidence is selected by field-specific descriptive markers. Explicit evidence-grounded claims remain authoritative. Unsupported fields remain `null` and receive `CLAIMS_WE_CANNOT_MAKE` entries.

No store, route, provider, model, browser, authority or execution path was added. Credential redaction, stable hashing and existing handoff/persistence contracts remain intact.

## Acceptance

| ID | Result | Evidence |
|---|---|---|
| A1 | PASS | deterministic candidates for all four fields when bounded evidence supports them |
| A2 | PASS | derived candidates reference normalized evidence hashes; unsupported fields are quarantined |
| A3 | PASS | document shape and hash remain compatible; explicit claims preserve precedence |
| A4 | PASS | existing service inspection and dashboard projection consume the same document |
| C1-C5 | PASS | local pure code only; no network/provider/browser/credentials or execution changes |
| V1-V2 | PASS | focused integrated tests: 67 passed, 0 failed, 0 skipped |
| V3 | PASS | syntax checks for product-intelligence, runtime, repository inspection and tests; `git diff --check` |
| V4 | PASS | End-to-end `SeedingService.inspectProductIntelligence` fixture persisted a READY handoff with four derived fields and zero unsupported claims. |
| V5 | PASS | Integrated branch re-verification passed; canonical runtime schema 8/revision 194 and protected UNKNOWN records remain unchanged. |

## Evidence and limitations

- FACT: inference consumes only normalized evidence records passed to the builder.
- FACT: explicit valid claims are selected before derived candidates.
- INFERENCE: sentence markers identify bounded descriptive statements; they do not establish customers, superiority, benchmarks or market claims.
- FACT: field-specific candidates are ranked by deterministic marker coverage, then evidence hash and sentence order.
- CONCERN: heuristic coverage is intentionally conservative; fields without safe evidence stay null.

## Verification commands

```text
node --test test/product-intelligence.test.mjs test/product-intelligence-runtime.test.mjs test/product-repository-inspection.test.mjs test/service.test.mjs
node --check src/product-intelligence.mjs
node --check test/product-intelligence.test.mjs
node --check test/product-intelligence-runtime.test.mjs
node --check test/product-repository-inspection.test.mjs
git diff --check
```

Status: DONE_WITH_CONCERNS
