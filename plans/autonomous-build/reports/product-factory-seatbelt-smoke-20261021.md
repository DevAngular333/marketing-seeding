# Product Factory Seatbelt smoke — 2026-10-21

## Result

`BOUNDED_SMOKE_PASS` (`LOCAL_REAL`); no external side effect occurred.

The existing Product Factory allowlist was staged into a temporary directory
under `/usr/local/bin` for the macOS Seatbelt lane. The shared
`SYSTEM_AGENTIC_AI` typed executor then ran exactly one `node --check
src/server.mjs` command through `/usr/bin/env node`. The staged directory was
removed by the adapter's `finally` cleanup path.

Evidence: `plans/autonomous-build/product-factory-seatbelt-adapter/local-real-smoke-20261021.json`.

## Host/runtime finding

The outer process uses `/usr/local/bin/node` v24.21.0, but the Seatbelt request
resolves `node` through the allowlisted PATH entry `/opt/homebrew/bin/node`
(Node 22.23.3). This avoids the earlier host-runtime `LowLevelAlloc` crash.
The adapter does not expose or persist credentials, cookies or session data.

## Boundary

This is a bounded syntax-probe smoke, not arbitrary Product Factory execution.
The seven profile checks still require an independently reviewed attestation
before production code may enable project build, render, package-manager or
media-generation commands. The existing fail-closed `NOT_EXECUTED_UNSAFE`
behavior remains authoritative when that attestation is absent.
