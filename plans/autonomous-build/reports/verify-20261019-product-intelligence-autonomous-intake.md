# Product-Intelligence Autonomous Intake Review — 2026-10-19

## Scope

Read-only review of the new autonomous product-intelligence intake path in `src/service.mjs` and its `test/service.test.mjs` coverage. No files, canonical runtime, browser, credentials, network, or external platform were modified.

## Findings

**ACCEPT (bounded).**

1. **Authority boundary:** Intake runs only inside `materializeAuthorizedContentCandidates()` after a uniquely active, bound `standing_autonomous` authorization with `allowLiveExecution === true` and `approved_template_set` plus explicit story policy. Inspection and story derivation do not themselves create grants, windows, leases, posts, execution requests, or provider calls. Existing materialization remains the only later authority path.
2. **Evidence/source binding:** Approved claims are converted to a bounded allowlist of their exact `sourceRefs.relativePath`; the queue re-inspects the campaign repository, compares every source SHA-256, then persists inspection. Story derivation re-inspects and compares inspection hash, record identity/hash/bytes, evidence content/hash/locator, and grounding source hash before drafting.
3. **Incomplete/ambiguous fail-closed behavior:** Missing claims/allowlist, incomplete handoff, missing story policy, duplicate active authorizations, stale authorization/campaign binding, and source drift are caught or skipped. Existing stories are not replaced on intake failure. The focused regression asserts zero new stories/candidates/posts/execution requests/windows/grants/leases for missing-policy, ambiguous-authority, stale-binding, stale-campaign-binding, and source-drift scenarios.
4. **Idempotency/restart:** The new autonomous intake test verifies one READY handoff, one deterministic story, one template candidate, then restart and second queue tick preserve one story and one candidate. Existing `deriveProductIntelligenceStory()` identity checks return the existing draft rather than duplicate it.
5. **Content safety:** `inspectProductIntelligence()` uses repository evidence and sanitized handoff/document allowlists. `deriveProductIntelligenceStory()` requires all required fields, valid handoff, persisted inspection, current repository bytes, and grounded evidence. No CTA/objective/URL inference is introduced; the policy CTA is explicit authorization input.

## Evidence

Focused command:

```text
node --test test/service.test.mjs --test-name-pattern='story policy|autonomously inspects|product intelligence story derivation|queue story derivation'
```

Result: **78 passed, 0 failed, 0 skipped** (Node's name-pattern run also exercised adjacent service regressions in this file).

Static checks previously run on this dirty integration worktree: `node --check src/service.mjs` and `git diff --check` passed.

## Residual limits

- This proves local synthetic/repository behavior only; no live model, provider, browser, or external publication is established.
- Intake can persist an incomplete `productIntelligence` handoff during a failed first inspection attempt, but tests and subsequent derivation keep it non-actionable; no execution artifacts are created.
- Full-suite evidence belongs to the broader integration gate; this review did not mutate or rerun external systems.

## Decision

**ACCEPT (bounded)**
