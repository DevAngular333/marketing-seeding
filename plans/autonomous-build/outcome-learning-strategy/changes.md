# Changes

- Added fail-closed validation for the latest learning feedback used by advisory strategy.
- Added bounded `learningContext` and learning/outcome evidence references to strategy decisions when current feedback is valid.
- Preserved existing publish, discovery, wait and UNKNOWN ordering.
- Added regressions for publish precedence, stale/malformed feedback and authoritative UNKNOWN dominance.
- No authority, execution, browser, provider, publication or schema changes.
