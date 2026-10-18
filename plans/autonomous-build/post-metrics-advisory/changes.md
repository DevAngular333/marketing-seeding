# Changes

- Added deterministic per-post metric assessments to the existing normalized attribution projection.
- Restricted positive metric response evidence to valid fields with explicit `coverage: measured`.
- Classified null, missing, negative, and snapshot-only measurements as unknown or partial; mixed malformed snapshots never become response claims.
- Added bounded metric advisory counts and evidence references without changing learning action selection or strategy precedence.
- Projected advisory rows from the same retained attribution set used by the bounded context, preserving self-validation under truncation.
- Recomputed assessment, evidence, classification order, and aggregate checks in `isNormalizedPostAttributionContext`; tampered advisory data fails closed.
- Added focused regressions for each classification, invalid values, unsupported positive values, mixed malformed values, >24-row projection, tampering, deterministic identity, and UNKNOWN dominance.
- No authority, execution, browser, provider, publication, schema, canonical runtime, or social behavior changed.
