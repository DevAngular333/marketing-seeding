# Content Candidate Authorization Binding Report

**Status:** COMPLETE_LOCAL_VERIFIED; LIVE_UNPROVEN
**Branch:** `integration/autonomous-build`
**Date:** 2026-10-18

## Outcome

An exact evidence-grounded content candidate can now be materialized into one idempotent post and, when an exact active standing campaign authorization already covers it, enter the existing queue/readiness/execution request/one-time window/live grant path without a per-post approval step. The implementation reuses the existing `JsonStore`, campaign authorization, `evaluateQueue`, readiness, execution request, standing delegation and UNKNOWN contracts.

The binding is fail-closed. A manual authorization, expired authorization, mismatched destination, account/profile, target URL, campaign scope, content hash, audience, visibility, stale fingerprint, multiple active authorizations or changed grounding file cannot confer authority. The candidate remains a draft or the operation fails before a post is created.

## Safety evidence

- Grounding source bytes are re-read and SHA-256 checked against the story lineage before persistence.
- Candidate content identity and derived `contentId` are recomputed.
- Existing post lineage checks include campaign, story, content, content hash, candidate identity, evidence, audience, language, visibility and idempotency identity.
- Standing authorization matching requires `standing_autonomous`, `allowLiveExecution`, active validity, exact destination URL/account/profile/target, campaign and authorization fingerprints, approved copy hash, allowed audience and PUBLIC visibility.
- Existing queue, readiness, one-time window, live grant, execution lease, durable submit intent, exact dispatch and UNKNOWN quarantine semantics are unchanged.

## Boundaries

- This does not create authorization, authenticate accounts, operate a browser, click a platform submit control or verify a real publication.
- ORCA remains unavailable in this shell and irreversible LinkedIn transport activation remains uncertified live.
- The canonical runtime remains read-only and has no active exact live authority.
