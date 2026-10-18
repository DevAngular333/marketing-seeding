# Independent verification — discovery fit compatibility

Date: 2026-10-18  
Baseline: `cf77a941`  
Worktree: `integration/autonomous-build`

## Unverified first

- Canonical runtime state and protected UNKNOWN records were not opened or hashed.
- No full Node suite was requested or run in this verification pass; the focused gates below are the evidence for this seam.
- No network, browser, ORCA, credential, social, or external-provider action was performed.

## Diff scope

Compared with `cf77a941`, the current patch changes only:

- `src/discovery.mjs`: attach `fit` only when at least one explicit audience/channel/locale hint normalizes to a non-empty value.
- `test/discovery.test.mjs`: assert no-fit records do not receive an UNKNOWN fit object.
- `test/strategy.test.mjs`: exercise `recordDiscoveries` plus strategy selection for a no-fit scheduler-style record.

No service, strategy runtime, authority, execution, browser, provider, or UNKNOWN-submission source code changed.

## Verification evidence

- `node --test test/discovery.test.mjs test/discovery-scheduler.test.mjs test/strategy.test.mjs test/service.test.mjs` — **77 passed, 0 failed, 0 skipped**.
- `node --test test/independent-audit.test.mjs` — **2 passed, 0 failed, 0 skipped**; protected UNKNOWN quarantine remains immutable in the isolated audit fixture.
- `for f in src/*.mjs; do node --check "$f"; done` — passed.
- `git diff --check` — passed.

## Acceptance table

| Criterion | Result | Evidence |
|---|---|---|
| Preserve no-fit discovery compatibility | PASS | `hasFitHints()` suppresses fit metadata when all hints are absent; discovery ID, classification and score code are unchanged. **FACT** |
| Explicit fit remains deterministic and fail-closed | PASS | Existing match/mismatch/locale/unknown/determinism tests remain green; explicit hints still call `evaluateDiscoveryFit`. **FACT** |
| Scheduler-style discoveries remain actionable | PASS | New service persistence test records a no-fit observation and `deriveStrategy()` selects `research`. **FACT** |
| Explicit mismatch/unknown cannot become candidate | PASS | Existing strategy fit gate tests pass; runtime strategy source unchanged. **FACT** |
| Persistence/dashboard path unchanged | PASS | `src/service.mjs` has no diff; focused service tests pass. **FACT** |
| No authority/execution side effects | PASS | Diff has no authority or execution source changes; no-fit test asserts research only and existing audit test preserves UNKNOWN state. **FACT** |
| Bounded/no external effects | PASS | Only local unit tests, syntax, and diff checks were run. **FACT** |
| Syntax and diff checks | PASS | All `src/*.mjs` parse; `git diff --check` passes. **FACT** |

## FACT / INFERENCE / UNKNOWN

- **FACT:** Before the patch, every `processDiscoveries()` result received an all-UNKNOWN `fit` object when no fit hints were supplied, causing the existing strategy filter to exclude scheduler-created records.
- **FACT:** The patch makes fit metadata opt-in while retaining explicit fit behavior.
- **INFERENCE:** This restores the intended backward-compatible legacy shape for caller/scheduler discoveries without weakening the explicit-fit gate.
- **UNKNOWN:** Canonical runtime revision/hash and live UNKNOWN record comparison were not checked.

## Verdict

**PASS (bounded)** — the compatibility seam is narrow, regression-backed, and preserves advisory-only behavior. Live canonical/runtime invariants remain outside this review.

Status: PASS (bounded)
