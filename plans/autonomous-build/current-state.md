# Current State (verified 2026-10-17)

## Repository

- Integration worktree: `/Users/nam/Documents/marketing-seeding-integration`
- Branch: `integration/autonomous-build`
- Integration HEAD: `4e5b7d2` (`docs: finalize autonomous build release ledger`); the current working tree adds the accepted product-lineage seam and its tests before the next release commit.
- Main worktree `/Users/nam/Documents/marketing-seeding` was not modified.
- Working tree contains the accepted integration seam changes listed in `git status`; the release commit is recorded after the final gate.
- `SYSTEM_AGENTIC_AI` Core was not modified.

## Runtime

- Canonical state: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: 8; revision: 193; SHA-256: `327688c03b5f535e4cc8082837a3cd338db74b74207b86887eef2ae9ed965aae`.
- Read-only `/health`: service PID 64620, listener `127.0.0.1:4318`, source commit `b4fa42b…`, schema 8, revision 193.
- Traffic collector, daily automation, browser tracking and fixture worker disabled.
- No active execution leases, active live grants, active one-time windows, or active campaign authorizations.

## Local capability additions

- Product intelligence handoff is versioned, hash-validated, sanitized, persisted on campaigns and projected read-only by `/api/dashboard`.
- Repository inspection can now read a bounded allowlist of safe repository files, redact credential-like material, produce stable evidence hashes and persist metadata-only inspection lineage with the handoff.
- Discovery observations are caller-supplied only; they are normalized, deduplicated, policy-classified, scored, persisted on campaigns and projected read-only by `/api/dashboard`.
- Product factory runtime can classify/run the registered campaign repository with the bounded allowlist, return local artifact evidence, persist a bounded 24-run campaign-owned lineage and project recent runs read-only; it reports `externalSideEffects: false` and does not create publication authority.

## Counts

7 campaigns (active); 10 authorizations (5 expired, 2 superseded, 3 paused); 7 one-time windows (all `CONSUMED`); 7 grants (4 `CONSUMED`, 3 `REVOKED`); 8 execution requests (1 dry-run complete, 4 `SUBMIT_RESULT_UNKNOWN`, 3 failed); 8 receipts; 7 posts (4 `submit_result_unknown`, 3 blocked); 4 publication attempts (all `unknown`); 4 submission uncertainties (`UNKNOWN`); 4 verified artifacts; 0 stories; 0 published; 0 metrics/interactions/replies/conversions.

## Protected history

Historical UNKNOWN execution IDs: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`; uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c`. All remain immutable.

## Tests

- Focused integrated gate: 242 passed, 0 failed, 0 skipped.
- Product-lineage focused gate: 41 passed, 0 failed, 0 skipped.
- Full suite: 324 total, 322 passed, 0 failed, 2 skipped; exit 0.
- Static checks: `node --check src/*.mjs` and `git diff --check` passed.

## Live proof

`LIVE_PROOF_BLOCKED`: no fresh exact LIVE campaign authorization, one-time window, execution-scoped grant, lease, or explicit harmless test content/session input exists. No browser mutation or social mutation occurred.
