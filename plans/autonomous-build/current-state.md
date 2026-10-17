# Current State (verified 2026-10-17)

## Repository

- Integration worktree: `/Users/nam/Documents/marketing-seeding-integration`
- Branch: `integration/autonomous-build`
- Integration HEAD: `6e083ff` (`fix: harden public discovery observer`); the working tree contains the bounded audience/channel fit seam and journal updates described below.
- Main worktree `/Users/nam/Documents/marketing-seeding` was not modified.
- Working tree contains only the explicitly listed observer/config/journal artifacts; no source change has been merged into `main`.
- `SYSTEM_AGENTIC_AI` Core was not modified.

## Runtime

- Canonical state: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: 8; revision: 194; SHA-256: `5c439b0bb0f2e2bf5821e13c874530a4be95619f4ffad26558bd99a2660e17e6` (read-only inspection; the running canonical service advanced this revision independently).
- Read-only `/health`: service PID 64620, listener `127.0.0.1:4318`, source commit `b4fa42b…`, schema 8, revision 194. Canonical service has traffic, control-cycle, discovery, browser-tracking and fixture timers disabled.
- Traffic collector, daily automation, browser tracking and fixture worker disabled.
- No active execution leases, active live grants, active one-time windows, or active campaign authorizations.

## Local capability additions

- Product intelligence handoff is versioned, hash-validated, sanitized, persisted on campaigns and projected read-only by `/api/dashboard`.
- Repository inspection can now read a bounded allowlist of safe repository files, redact credential-like material, produce stable evidence hashes and persist metadata-only inspection lineage with the handoff.
- Discovery observations are normalized, deduplicated, policy-classified, scored, persisted on campaigns and projected read-only by `/api/dashboard`; integration adds an opt-in public HTTP observer and 15-minute poller, which are not enabled in the canonical service.
- Discovery fit metadata now evaluates caller-supplied audience terms, channel and locale hints as bounded `MATCHED`/`MISMATCHED`/`UNKNOWN` advisory evidence through the existing persistence path; it does not create authority or publication work.
- Product factory runtime can classify/run the registered campaign repository with the bounded allowlist, discover bounded media/document candidates when paths are omitted, return local artifact hashes, persist a bounded 24-run campaign-owned lineage and project recent runs read-only; it reports `externalSideEffects: false` and does not create publication authority.

## Counts

7 campaigns (active); 10 authorizations (5 expired, 2 superseded, 3 paused); 7 one-time windows (all `CONSUMED`); 7 grants (4 `CONSUMED`, 3 `REVOKED`); 8 execution requests (1 dry-run complete, 4 `SUBMIT_RESULT_UNKNOWN`, 3 failed); 8 receipts; 7 posts (4 `submit_result_unknown`, 3 blocked); 4 publication attempts (all `unknown`); 4 submission uncertainties (`UNKNOWN`); 4 verified artifacts; 0 stories; 0 published; 0 metrics/interactions/replies/conversions.

## Protected history

Historical UNKNOWN execution IDs: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`; uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c`. All remain immutable.

## Tests

- Focused discovery/service/server gate: 50 passed, 0 failed, 0 skipped; observer-hardening focused subset 17/17; audience-fit focused review 39/39; product-factory focused gate 40/40.
- Full suite: 364 total, 362 passed, 0 failed, 2 skipped; exit 0.
- Static checks: `node --check src/*.mjs` and `git diff --check` passed.

## Live proof

`LIVE_PROOF_BLOCKED`: no fresh exact LIVE campaign authorization, one-time window, execution-scoped grant, lease, or explicit harmless test content/session input exists. ORCA is unavailable in this shell. No browser mutation or social mutation occurred.
