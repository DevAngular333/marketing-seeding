# Standing autonomous authorization audit — 2026-10-19

## Verdict

`IMPLEMENTED`, `LOCAL_REAL_ISOLATED_STORE` verified. No bounded source defect found. Live LinkedIn execution remains blocked by missing fresh exact external authorization/session; canonical runtime was read-only.

## Evidence

- `src/campaign-authorization.mjs`: `normalizeCampaignAuthorization` requires explicit bounded destinations, account/profile identity, target, content/asset/claim boundary, audience, visibility, schedule, quotas/cadence, validity, `allowLiveExecution`, and `standingAuthorizationReference` for `standing_autonomous` mode.
- `src/service.mjs`: `authorizeCampaign` is the one campaign-level operator authorization boundary. After it, post creation and queue ticks derive readiness, one-time window, execution request, and execution-scoped live grant through scheduler-only actors. No per-post approval is required within the bounded authority.
- `src/service.mjs`: `acquireExecutionLease` atomically grants one exact execution/profile lease and rejects conflicts.
- `src/standing-campaign-delegation.mjs`: pure control-plan derivation fails closed on authorization, campaign, target, account/profile, readiness, quota/cadence, idempotency, window, grant, content/visibility and kill-switch drift.
- `test/standing-autonomous-delegation-proof.test.mjs`: exact request/window/grant/lease and binding proof, repeated queue idempotency, lease release; no publication.
- Focused command: `node --test test/standing-autonomous-delegation-proof.test.mjs test/standing-campaign-delegation.test.mjs test/one-time-execution-window.test.mjs test/live-execution-grant.test.mjs` → 36 passed, 0 failed.
- Canonical state `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json` (read-only): schema 8, revision 194; 10 authorizations (5 expired, 3 paused, 2 superseded), 7 consumed windows, 7 grants (4 consumed/3 revoked), 0 leases, 4 UNKNOWN submissions, 0 published posts.

## Live blocker

`LIVE-LINKEDIN-AUTH-001` remains `EXTERNAL_HARD_BLOCKER`: no fresh active exact standing authorization, harmless test content, target/account/profile/session/readiness exists in canonical runtime. Expired/paused/superseded controls cannot be promoted or reused. Historical UNKNOWN executions remain immutable.

## Safety

No canonical state mutation, browser/ORCA command, LinkedIn action, credentials/session material, or social mutation occurred.
