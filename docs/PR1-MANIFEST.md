# PR1 baseline manifest

This commit isolates campaign-level authorization governance from the mixed source worktree. It does not include a live publisher or changes to production/runtime state.

## Included files

| File | PR1 purpose |
| --- | --- |
| `src/campaign-authorization.mjs` | Campaign authorization normalization, scope fingerprints, publication identity, and inherited authorization evaluation. |
| `src/constants.mjs` | Adds the blocked job state and its permitted transitions. |
| `src/guards.mjs` | Enforces campaign eligibility, readiness freshness, fan-out, idempotency, and explicitly authorized repeat-content behavior while preserving legacy approval behavior for campaigns without an authorization record. |
| `src/service.mjs` | Implements authorization creation/pause/resume, child-job inheritance, queue reevaluation, readiness invalidation, asset identity checks, and publication identity binding. |
| `src/server.mjs` | Adds operator-only campaign authorization controls and an automation-safe queue reevaluation endpoint with bounded scheduling. |
| `src/store.mjs` | Adds `campaignAuthorizations` and additive schema v1/v2 to v3 migration. |
| `docs/ARCHITECTURE-V2.md` | Updates the architecture description to schema v3 and campaign authorization. |
| `docs/CAMPAIGN-AUTHORIZATION.md` | Documents authorization scope, eligibility, lifecycle, fan-out, migration, and capability limits. |
| `docs/OPERATOR-RUNBOOK.md` | Documents PR1 API operations and clarifies that queue eligibility is not publication. |
| `test/campaign-authorization.test.mjs` | Covers authorization scope, inheritance, legacy approval boundaries, fan-out, repeat-content policy, and limits. |
| `test/campaign-authorization-server.test.mjs` | Covers operator-only authorization and automation queue reevaluation permissions. |
| `test/service.test.mjs` | Updates schedule-gate expectations to the campaign authorization rule. |
| `test/store-migration.test.mjs` | Covers isolated schema v1/v2 to v3 migration and preservation without implicit authorization. |

## Schema and migration

Schema v3 adds an empty `campaignAuthorizations` array. Migration from v1 or v2 preserves existing campaigns, posts, approval fields, and other state. Existing `approvedAt` values do not become campaign authorization. Campaigns without authorization records continue through the legacy per-post approval gate.

## Tests

The isolated baseline is validated with `pnpm.cmd test` and focused authorization, migration, service, server, and guard tests. Migration tests use temporary fixture state only.

## Explicit exclusions

The baseline excludes mixed/untracked DOS, CLI, MCP, dashboard, Auto-GTM, fixture, product, System One, Telegram, prior evidence, generated bundle, cache, token, and runtime-state changes. It does not modify the original dirty worktrees and does not implement live publishing or readiness collection.
