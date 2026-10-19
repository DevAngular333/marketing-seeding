# Changes

- Extended the existing metric collection plan's due set to include valid checkpoint rows whose latest collector evidence is `unknown`.
- This covers persisted `failed` runs because `buildMetricCheckpoints` projects `failed` to visible `unknown` evidence while retaining its run ID/reason.
- Excluded `published_at_invalid` from retry eligibility and left `unsupported`/`not_applicable` terminal.
- Added focused regressions for transient failed evidence and manual-only unsupported evidence.

No provider, authority, browser, ORCA, canonical runtime, credential, or social state was accessed or changed.
