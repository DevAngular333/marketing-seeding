# Changes

- Added fail-closed validation for the latest learning feedback used by advisory strategy.
- Added bounded `learningContext` and learning/outcome evidence references to strategy decisions when current feedback is valid.
- Preserved existing publish, discovery, wait and UNKNOWN ordering.
- Added regressions for publish precedence, stale/malformed feedback and authoritative UNKNOWN dominance.
- Added bounded post attribution context to learning feedback and strategy explanation, retaining global status counts and prioritizing high-risk statuses before truncation.
- Added campaign-aware post/target/account/profile/channel validation so self-consistent foreign or drifted attribution fails closed.
- Added regressions for late UNKNOWN retention, global bounded counts, foreign posts and target identity drift.
- No authority, execution, browser, provider, publication or schema changes.
