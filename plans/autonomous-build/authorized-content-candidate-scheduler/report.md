# Authorized Content Candidate Scheduler

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN
**Date:** 2026-10-18
**Branch:** `integration/autonomous-build`

## Outcome

The queue now materializes draft content candidates automatically only when one
exact active campaign authorization is a standing autonomous authorization with
live execution enabled and an approved content boundary. `approved_copy_set`
uses exact content hashes. `approved_template_set` uses the separately
versioned template binding contract. Both modes reuse the existing content
materialization, readiness, execution request, one-time window, live grant,
lease and idempotency contracts.

This removes a per-post approval dependency for the bounded approved-copy case
without creating a new store, state machine, provider router, browser
abstraction or LinkedIn publisher. The advisory control cycle remains
authority-free.

## Safety behavior

- No active exact standing authorization: candidate stays `draft`.
- Paused, revoked, expired, missing, multiply-active or mismatched authority:
  no candidate promotion and no execution controls.
- `approved_template_set`: is eligible only through the versioned
  `template-candidate-binding` contract; legacy or incomplete candidates remain
  draft-only.
- Existing terminal or uncertain posts are never replayed from a draft
  candidate; historical `UNKNOWN` records remain immutable.
- Repeated ticks and a fresh `JsonStore` instance preserve one post, request,
  one-time window and grant for the same candidate.

## Scope boundary

This is local/synthetic scheduler proof. It does not create authorization,
authenticate an account, operate ORCA/JEV, click a platform submit control or
verify a real publication. The canonical runtime and protected UNKNOWN history
were not modified.

## Verification

- Focused service/server gate: **42 passed, 0 failed, 0 skipped**.
- Full Node suite: **406 total, 404 passed, 0 failed, 2 skipped**.
- Syntax and diff checks passed.
- Independent review: **ACCEPT**; the recommended inactive-campaign fail-closed
  condition is implemented and covered by regression.

The template binding milestone adds the corresponding `approved_template_set`
queue path and is documented in `plans/autonomous-build/template-candidate-binding/`.
