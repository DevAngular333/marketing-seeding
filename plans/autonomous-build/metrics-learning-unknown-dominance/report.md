# Metrics and learning UNKNOWN dominance hardening

Implemented a narrow fail-closed improvement in `src/learning.mjs`. Learning now derives the bounded post attribution context once, detects authoritative post-level `UNKNOWN` rows, and forces the existing advisory `do_nothing` recommendation when aggregate publication counts are stale or inconsistent. Evidence references from UNKNOWN attribution rows are retained in the feedback record. No execution authority, state machine, browser, provider, or publication behavior changed.

## Verification

`node --test test/learning.test.mjs test/strategy.test.mjs test/control-cycle.test.mjs` — 28 passed, 0 failed, 0 skipped.

`git diff --check` — passed.

## Limitation

Learning remains advisory. Live metrics and live publication evidence remain unavailable in the canonical runtime.
