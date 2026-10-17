# Account Runtime Mission Control — Acceptance

## Requirements

- **A1** Expose the existing read-only `accountRuntime` dashboard projection in the existing Mission Control overview.
- **A2** Show session mode, auth mode, eligibility and bounded ineligibility reasons for each configured account without exposing profile IDs, identity URLs, evidence, credentials, cookies or tokens.
- **A3** Make the read-only/advisory boundary explicit; the UI must not add approval, selection, login, failover, browser or execution controls.
- **A4** Render empty/unknown data safely and preserve current dashboard behavior and layout responsiveness.

## Constraints

- **C1** Reuse the existing `/api/dashboard` response and current React dashboard; no route, store, API mutation or new runtime abstraction.
- **C2** Do not modify LinkedIn/JEV/ORCA, authority, grants, windows, leases, submit, verification or UNKNOWN semantics.
- **C3** No network beyond the existing dashboard fetch, no browser profile access, no credentials and no external side effects.

## Verification

- **V1** TypeScript check passes.
- **V2** Production UI build passes.
- **V3** Read-only source review confirms no action controls or mutation path.
- **V4** Existing Node suite remains 374 total, 372 passed, 0 failed, 2 skipped.
