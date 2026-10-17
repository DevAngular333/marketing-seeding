# Product Intelligence — Local Capability Report

- **Status:** LOCAL_VERIFIED, caller-supplied evidence only; handoff is now persisted on the campaign and projected read-only.
- **Implementation:** `src/product-intelligence.mjs` normalizes/deduplicates provided evidence, creates stable SHA-256 evidence identities, emits machine-readable `WHAT_IS_IT`, `WHAT_PROBLEM_DOES_IT_SOLVE`, `WHY_IS_IT_BETTER`, `WHO_NEEDS_IT`, links claims to evidence and quarantines unsupported/malformed evidence references. Redacts secret-like keys and common token patterns.
- **Verification:** `node --test test/product-intelligence.test.mjs` was integrated into the 299-test full suite (297 pass, 0 fail, 2 skip). Worker focused tests passed 4/4; master full gate passed.
- **Runtime seam:** `SeedingService.attachProductIntelligence` sanitizes and hash-validates the versioned handoff before storing it on campaign state; `/api/dashboard` exposes only the sanitized document/handoff. `POST /api/campaigns/:id/product-intelligence` is automation-allowlisted.
- **Evidence class:** local synthetic. Module does not inspect repositories, discover evidence, generate claims, or use an LLM. Caller controls evidence and factual quality.
