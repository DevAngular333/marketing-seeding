# Channel capability readiness hardening

## Change

Hardened the existing read-only channel capability projection. A target is no
longer advertised as `READY` when normalized readiness has a future
`checkedAt`, malformed `checkedAt`, or explicit account/profile/platform/target
identity fields that do not match the target. Expiry remains required and
fail-closed. Legacy fixture rows that omit `checkedAt` and normalized identity
fields remain compatible.

This is projection-only: no authority, account selection, execution request,
window, grant, lease, browser, provider or external state is changed.

## Verification

- `node --test test/channel-capability-projection.test.mjs` — 3 passed, 0 failed, 0 skipped
- `node --check src/channel-capability-projection.mjs` — passed
- `git diff --check` — passed

## Scope

Files: `src/channel-capability-projection.mjs`,
`test/channel-capability-projection.test.mjs`.
