# Mission Control authority and claim boundary — acceptance

## Requirements

- A1 Expose campaign authority/window/grant/lease readiness as a bounded read-only projection.
- A2 Expose account-pool, channel, Product Factory sandbox and unsupported-claim boundaries in the existing Mission Control panel.
- A3 Preserve existing authority ownership, exact account/profile binding, UNKNOWN quarantine and no external side effects.
- A4 Omit credentials, profile IDs, readiness evidence and other secret-like values from the new projection.

## Constraints

- C1 Reuse the existing dashboard/API and JsonStore; do not add a second state store, selector, authority path or browser abstraction.
- C2 Do not mutate canonical runtime, browser/session state, external platforms or historical UNKNOWN records.
- C3 Keep the dashboard read-only and advisory; it cannot approve, select, authenticate or execute.

## Verification

- V1 `node --test test/authorized-account-candidate-projection.test.mjs` passes.
- V2 Changed-area transport/LinkedIn/JEV and standing delegation tests pass.
- V3 Full `npm test` passes with zero failures; UI typecheck/build and source syntax pass.
- V4 Independent review confirms projection is side-effect free and safety boundaries remain intact.
