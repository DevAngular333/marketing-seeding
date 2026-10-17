# Changes

- Added `derivePostOutcomeAttributions` to `src/outcome.mjs`.
- Appended `postAttributions` and bounded `unassignedConversionIds` to the
  existing outcome summary without changing schema version or persistence.
- Added deterministic metric tie handling, bounded identifiers and redacted
  evidence references.
- Added outcome attribution regressions in `test/outcome.test.mjs`.
- No authority, execution, browser, provider, publication or UNKNOWN record
  semantics changed.
