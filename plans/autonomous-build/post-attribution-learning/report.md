# Post attribution learning context

**Date:** 2026-10-18  
**Branch:** `integration/autonomous-build`  
**Result:** `COMPLETE_LOCAL_VERIFIED`

## Unverified first

- No browser, ORCA, credential, network, canonical runtime or external
  platform was accessed.
- No publication, comment, like, follow, message or other social mutation
  occurred.
- This milestone does not enable adaptive publishing, candidate rerouting,
  account selection, publication verification or live LinkedIn behavior.

## Outcome

The existing bounded `postAttributions` projection is now consumed by the
existing learning and advisory strategy path as explanation context. The
projection is normalized deterministically, rejects secret-like references,
keeps global status counts, and prioritizes `UNKNOWN` and other higher-risk
statuses before the 24-row context bound. A late UNKNOWN cannot disappear
because of lexical post ordering.

Raw account/profile identity values are not exposed in learning context;
short deterministic fingerprints are used for bounded explanation, while raw
values remain internal to exact validation.

Before strategy exposes the context, every attribution is checked against the
current campaign's post and bound target identity (target, channel, account and
profile). Foreign posts, cross-campaign rows and target identity drift fail
closed. Existing strategy precedence remains unchanged: product readiness,
authoritative UNKNOWN quarantine, publishable queue, discovery, wait, then
`do_nothing`.

## Evidence

- Focused learning/strategy gate: **20 passed, 0 failed, 0 skipped**.
- Combined strategy/control-cycle/learning/outcome/service/server gate:
  **56 passed, 0 failed, 0 skipped**.
- Full Node suite: **393 total, 391 passed, 0 failed, 2 skipped**.
- `node --check src/learning.mjs`: passed.
- `node --check src/strategy.mjs`: passed.
- `git diff --check`: passed.
- Independent review rework findings were addressed: late UNKNOWN retention
  and campaign-aware identity validation.

## Safety

The changes are pure/advisory at the decision layer. They do not import or
call authority, browser, provider, publication, account selection or dispatch
code. Tests preserve publish precedence, authoritative UNKNOWN quarantine,
deterministic identity, bounded context, and empty execution grants/requests.

## Remaining limitation

The context is evidence for explanation only. It does not select a different
post, reroute a channel, modify campaign state outside the existing advisory
feedback/decision history, or create a next-best-action authority decision.
