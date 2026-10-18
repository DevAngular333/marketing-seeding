# Content Candidate Materialization Report

**Status:** COMPLETE_LOCAL_VERIFIED (draft-only; superseded by exact standing authorization binding)
**Branch:** `integration/autonomous-build`
**Date:** 2026-10-18

## Outcome

The existing content foundation now has a narrow materialization seam: an exact persisted evidence-grounded content candidate can be converted into one idempotent `state.posts` draft. The seam reuses `JsonStore`, `SeedingService`, `publicationIdentityKey`, existing channel policy, campaign target binding and existing story grounding. It preserves candidate content identity, content hash, claim IDs, evidence references, source-file hashes, audience and language on the draft. The later authorization-binding seam can promote the same exact draft through existing standing execution controls when an exact active authorization covers it.

Without an exact active `standing_autonomous` authorization, materialization remains non-authoritative. It does not create or bind campaign authorization, lifecycle, queue, readiness, execution request, grant, lease, browser action, publication attempt or publication evidence. Paused, revoked and expired authorizations are covered by regression tests and leave the candidate draft-only.

## Safety checks

- Exact campaign, candidate `contentId` and `contentIdentity` lookup.
- Candidate must be `draft` and its story must belong to the campaign.
- Story must contain a bounded verified grounding source hash.
- Target and channel must match an existing supported campaign-bound target.
- Channel length policy is rechecked.
- Candidate content hash, identity and derived `contentId` are recomputed.
- Publication idempotency identity is reused; an existing non-draft or lineage-conflicting post fails closed.
- No historical UNKNOWN records are read for mutation or changed.

## Verification

- Focused content/service/server gate: `node --test test/content-foundation.test.mjs test/service.test.mjs test/server.test.mjs` — **44 passed, 0 failed, 0 skipped**.
- Full Node suite: `node --test test/*.test.mjs` — **403 total, 401 passed, 0 failed, 2 skipped**.
- Syntax: `node --check src/*.mjs` — passed.
- Diff: `git diff --check` — passed.
- Independent review: **ACCEPT** (bounded); follow-up gaps are recorded below.

## Boundaries and remaining work

- `approved_template_set` authorizations remain conservatively draft-only for this materialization path; exact approved-copy binding is the only automatic promotion mode.
- No live browser, ORCA or platform behavior was exercised.
