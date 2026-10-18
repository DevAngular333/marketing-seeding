# Changes

- Added `src/system-agentic-handoff-bridge.mjs` with versioned envelope
  construction, validation, stable identity and dry-run consumption.
- Extended the existing distribution handoff route to consume wrapped
  envelopes while preserving raw canonical compatibility.
- Preserved bridge provenance as allowlisted sanitized source metadata in the
  existing campaign handoff row.
- Added focused bridge tests for restart/idempotency, malformed input, hash and
  campaign binding, forbidden fields and zero execution artifacts.
- Added an HTTP fixture assertion for wrapped and raw canonical handoffs.
- No System-Agentic Core files, browser/LinkedIn code, authority contracts,
  UNKNOWN records or canonical runtime state were modified.
