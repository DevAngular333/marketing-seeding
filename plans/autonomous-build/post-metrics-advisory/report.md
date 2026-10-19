# Post metrics advisory context

**Date:** 2026-10-18
**Branch:** `integration/autonomous-build`
**Result:** `COMPLETE_LOCAL_VERIFIED`

## Unverified first

- No browser, ORCA, credential, network, canonical write, or social action was performed.
- This milestone does not prove live metric collection, publication, adaptive authority, or LinkedIn behavior.
- Metrics and learning remain advisory evidence. They do not select an account, create execution authority, reroute a campaign, or dispatch an action.

## Outcome

The existing outcome attribution now exposes a bounded deterministic metric assessment for each normalized campaign post. Assessments distinguish response, reach without response, measured zero response, partial measurements, unknown or unsupported metrics, and unobserved posts. Positive metrics count as response only when the corresponding field is explicitly `measured` and valid.

Malformed measured values fail closed. A mixed snapshot with an invalid measured field and a positive field is `PARTIAL_MEASUREMENTS`, so it cannot become a response claim. Snapshot-only evidence is `UNKNOWN_OR_UNSUPPORTED`.

The advisory aggregate preserves global counts and bounded evidence references while projecting advisory post rows from the same retained attribution set. This makes a truncated context self-validating and deterministic. The validator recomputes per-post assessments, evidence references, classification ordering, and aggregate counts; tampered contexts are rejected before strategy context is exposed.

Existing UNKNOWN quarantine, action precedence, campaign/target identity validation, persistence, and restart behavior are unchanged.

## Evidence

- Focused learning/strategy gate: **25 passed, 0 failed, 0 skipped**.
- Integration gate (`learning`, `strategy`, `outcome`, `control-cycle`, `service`, `server`): **87 passed, 0 failed, 0 skipped**.
- Full Node suite: **428 total, 426 passed, 0 failed, 2 skipped**, exit 0.
- `for f in src/*.mjs; do node --check "$f"; done`: passed.
- `git diff --check`: passed.
- Independent re-review: **PASS_BOUNDED**. It confirmed malformed-value quarantine, unsupported-positive handling, advisory tamper rejection, bounded projection consistency, and no side-effect path. The strict mixed-invalid case was added after review and rechecked PASS_BOUNDED.

## Safety and state checks

- Canonical runtime was read only: schema **8**, revision **194**, SHA-256 `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` at final inspection.
- Protected historical UNKNOWN execution IDs remain immutable: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`.
- Protected uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c` remains present.
- No posts, execution requests, grants, windows, leases, publication attempts, browser actions, credentials, or social records were created or changed.

## Scope of changes

- `src/learning.mjs`: fail-closed metric classification, bounded advisory projection, and structural/recomputed validation.
- `test/learning.test.mjs`: invalid, negative, snapshot-only, tampered, bounded, and mixed-positive malformed metric regressions.
- No store, router, provider, browser abstraction, authority contract, or state machine was added.

## Remaining gaps

- No live metric provider execution is proven in the canonical runtime.
- LinkedIn metrics remain manual-only in the integration metadata.
- Learning remains explanatory/advisory; it does not adapt strategy into autonomous authority or next-best-action dispatch.
- Live LinkedIn publish/verify remains blocked by absent fresh exact authorization and ORCA executable 1.4.229 is available locally, but irreversible-submit proof remains unproven.
