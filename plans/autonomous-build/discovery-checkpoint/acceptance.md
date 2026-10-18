# Discovery observer checkpoint — Acceptance

- A1 Persist one bounded checkpoint per campaign observation through the existing JsonStore.
- A2 Record requested, accepted, UNKNOWN, truncation, source fingerprint and timestamp only; never store credentials or create execution authority.
- A3 Preserve existing normalized observation deduplication and UNKNOWN filtering.
- V1 Focused discovery scheduler tests pass.
- V2 Existing authority collections remain unchanged in the successful observation test.
