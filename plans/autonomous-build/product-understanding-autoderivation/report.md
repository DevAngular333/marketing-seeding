# Product Understanding Auto-Derivation

**Status:** DONE_WITH_CONCERNS
**Branch:** `feat/autonomous-build-product-understanding`

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
| V1-V2 | PASS | focused tests: 38 passed, 0 failed |
| V3 | PASS (focused) | `node --check src/product-intelligence.mjs`; `git diff --check` |
| V4-V5 | NOT VERIFIED HERE | independent full-suite/runtime review remains with integrator |

## Evidence and limitations

- FACT: inference consumes only normalized evidence records passed to the builder.
- FACT: explicit valid claims are selected before derived candidates.
- INFERENCE: sentence markers identify bounded descriptive statements; they do not establish customers, superiority, benchmarks or market claims.
- UNKNOWN: full repository suite and canonical runtime invariants were not run or opened in this worker.
- CONCERN: heuristic coverage is intentionally conservative; fields without safe evidence stay null.

## Verification commands

```text
node --test test/product-intelligence.test.mjs test/product-repository-inspection.test.mjs test/service.test.mjs
node --check src/product-intelligence.mjs
git diff --check
```

Status: DONE_WITH_CONCERNS
