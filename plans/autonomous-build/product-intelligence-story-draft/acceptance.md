# Product Intelligence to Story Draft

## Goal

Derive one deterministic, evidence-grounded draft story from a campaign's
persisted READY product-intelligence handoff. The result must be reusable by
the existing content foundation while remaining draft-only.

## Requirements

- **A1** Read only the campaign's persisted product-intelligence handoff and
  require `READY` status plus all four required fields:
  `WHAT_IS_IT`, `WHAT_PROBLEM_DOES_IT_SOLVE`, `WHY_IS_IT_BETTER` and
  `WHO_NEEDS_IT`.
- **A2** Require each field to resolve to a supported claim with non-empty
  evidence references. Every referenced evidence record must resolve to a
  repository file recorded by the persisted repository inspection.
- **A3** Re-read every grounding file from the campaign repository and reject
  source drift, missing files, path escapes and unverified evidence.
- **A4** Require a caller-supplied call to action. Derive title, angle,
  audience, claim IDs, grounding sources and a stable story identity from the
  verified claims and sources without inventing claims or CTA text.
- **A5** Persist one `draft` story through the existing `JsonStore`; repeated
  calls and a fresh service instance return the same story identity without a
  duplicate row.
- **A6** Leave campaign authorization, execution requests, windows, grants,
  leases, posts and submission-uncertainty records unchanged.

## Constraints

- **C1** Local deterministic code and repository file reads only; no model,
  network, browser, provider, ORCA, LinkedIn or social side effect.
- **C2** Reuse the existing product-intelligence, story and store seams.
- **C3** Do not call this derivation from the campaign queue or control cycle.
- **C4** Do not mutate canonical production state or historical UNKNOWN rows.
- **C5** Preserve credential redaction and reject credential-like CTA or
  derived content inputs.

## Verification

- **V1** Pure helper tests cover deterministic fields, required claims, source
  references, CTA requirement and credential rejection.
- **V2** Service tests cover READY gating, missing/foreign claims, source drift,
  idempotency, restart persistence and draft-only state invariants.
- **V3** Existing scheduler/template and UNKNOWN regressions remain green.
- **V4** Full Node suite, syntax and diff checks pass with zero new failures.
- **V5** Protected canonical runtime and historical UNKNOWN executions remain
  unchanged; evidence is labeled LOCAL / SYNTHETIC.
