# Current State (pinned 2026-10-17)

## Repository

- Path: `/Users/nam/Documents/marketing-seeding`
- Branch: `pr3-4-2-presubmit-cancel`
- HEAD: `b4fa42b161896f1d4992743d5daa9f0fc91c70a5`
- Branch is ahead of origin by 6 commits.
- Working tree is dirty with preexisting LinkedIn/ORCA hardening and transport certification files. These are preserved and checkpointed before workers.

## Runtime

- Canonical state: `/Users/nam/build-agentic-AI/.agentic/marketing-seeding/state.json`
- Schema: 8; revision: 193; SHA-256: `327688c03b5f535e4cc8082837a3cd338db74b74207b86887eef2ae9ed965aae`.
- Service PID: 64620; listener: `127.0.0.1:4318`.
- Traffic collector, daily automation, browser tracking and fixture worker disabled.
- No active execution leases, active live grants, active one-time windows, or active campaign authorizations.

## Counts

7 campaigns; 10 authorizations; 7 one-time windows; 7 grants; 8 execution requests; 8 receipts; 7 posts; 4 UNKNOWN posts; 3 blocked posts; 4 publication attempts; 0 published; 0 metrics; 0 stories/interactions/replies/conversions.

## Protected history

Historical UNKNOWN execution IDs: `ce9cfc41-528b-425f-9dee-ab2563b50ed3`, `0f6b588b-20fd-42e1-9f6d-9b3bf5f04628`, `c2265ddf-4384-4339-a26b-4949b6a12af9`, `8e058f6e-5f67-4078-99bf-6cf86e1b62d7`; uncertainty `df39df1c-2f06-4c20-8e9a-4ed07f5df34c`. They are immutable.

## Tests

Baseline full suite: `node --test test/*.test.mjs` → 272 tests, 270 passed, 0 failed, 2 skipped.
