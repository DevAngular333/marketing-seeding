# Provider-neutral handoff versioning — Report

## Unverified first

No upstream SYSTEM_AGENTIC_AI producer was connected or exercised. This remains a local `DRY_RUN` metadata seam; it cannot derive live authority or dispatch.

## Change

Canonical provider-neutral distribution envelopes now require `handoffVersion: 1`. The accepted normalized handoff records the same version. This provides a smallest explicit contract boundary for future upstream producer wiring while preserving the existing downstream validator and no-side-effect behavior.

## Evidence

- Focused: `node --test test/distribution-handoff.test.mjs` — 8 passed, 0 failed, 0 skipped.
- Full: `npm test` — 436 total, 434 passed, 0 failed, 2 skipped.
- No browser, ORCA, network, credentials, canonical state, UNKNOWN record or social action was touched.

## Remaining gaps

- No live upstream producer/consumer wiring.
- Handoff remains `DRY_RUN` only and cannot derive authorization, grant, window, lease, post or publication evidence.
- Contract version is downstream-enforced; upstream System-Agentic source remains unchanged.

## Rework — legacy replay compatibility

Independent review found that adding `handoffVersion` to the normalized hash could append a duplicate when replaying a pre-version persisted row. The attach path now compares both the current versioned hash and a legacy-equivalent hash that omits `handoffVersion`. A regression seeds a pre-version row and verifies reattachment remains one row. New canonical envelopes still require version 1 and mismatches fail closed.

Rework evidence: focused 9/9; full suite 437 total, 435 passed, 0 failed, 2 skipped; syntax and diff checks pass.
