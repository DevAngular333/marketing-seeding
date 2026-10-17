# Outcome foundation worker report

Implemented a bounded deterministic campaign outcome summary using persisted posts, publication evidence, UNKNOWN records, metric snapshots, interactions, replies, conversions and keyword snapshots.

- Added `src/outcome.mjs`; output is capped to 100 evidence/items and 24 campaign history entries.
- Added `SeedingService.deriveOutcomeSummary` persistence through existing `JsonStore` only.
- Added read-only dashboard `outcomes` projection and additive `/api/campaigns/:id/outcome` route.
- Unknown metrics remain `null` with explicit coverage; UNKNOWN submissions remain counted separately from verified publications.
- No authority, grant, window, lease, execution, post, browser, provider or external side effect paths changed.

Verification: focused outcome + strategy tests 7/7 pass; service tests 28/28 pass; syntax checks and `git diff --check` pass.
