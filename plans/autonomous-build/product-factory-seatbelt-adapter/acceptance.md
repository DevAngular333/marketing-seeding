# Product Factory Seatbelt adapter

## Requirements

- A1. Reuse the existing `SYSTEM_AGENTIC_AI` typed Seatbelt execution backend
  through a narrow adapter; do not modify frozen Core or add another sandbox.
- A2. Route only the existing allowlisted, shell-free Product Factory plan
  commands through the adapter.
- A3. Preserve repository staging, bounded output, secret redaction and
  `externalSideEffects: false` lineage.
- A4. Keep the existing injected/local runner available for deterministic tests
  and fail closed when the shared backend is unavailable.

## Constraints

- C1. No browser, account, credential, canonical campaign or external platform
  side effect.
- C2. No arbitrary project scripts, package-manager commands or shell strings.
- C3. No changes to `/Users/nam/Documents/System-Agentic_AI`.

## Verification

- V1. Adapter unit tests cover request shape, successful result mapping,
  timeout/backend failure and rejection of commands outside the Product Factory
  allowlist.
- V2. A local real smoke uses the existing typed executor for a staged
  `node --check` command and records no external side effect. Evidence:
  `local-real-smoke-20261021.json` (`BOUNDED_SMOKE_PASS`, observed
  `2026-10-21T10:56:46.101Z`).
- V3. Full Node test suite and syntax/diff checks pass.

## Boundary

The smoke proves only the existing narrow, allowlisted syntax probe through the
shared executor. It does not certify arbitrary project build/render/package
manager execution, and no production `factory-sandbox-v1` attestation is
persisted or enabled by this artifact.
