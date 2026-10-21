# Local release smoke — 2026-10-21

## Scope

Read-only release verification of the tested source HEAD `f992f50` after the
journal reconciliation commit. The smoke used an isolated temporary data
directory and loopback ports; it did not use canonical state, browser profiles,
credentials, ORCA commands, or external platforms.

## Evidence

- Service start on an isolated state file completed successfully.
- `/health` reported `sourceCommit=f992f502b1349b9ae1c94638fa3ca30072ec3f39`,
  `sourceDirty=false`, schema version `8`, and state revision `0`.
- Stop/start restart smoke completed successfully with the same source commit,
  `sourceDirty=false`, and persisted revision `0`.
- The isolated health projection reported Product Factory
  `factory-sandbox-v1` as `UNSUPPORTED` and `executionEligible=false`; this is
  the expected fail-closed result without an independent profile attestation.
- No canonical state mutation, browser input, credential/session access, or
  external side effect occurred.

## Commands

```text
SEEDING_DATA_DIR=<temporary> ... node src/server.mjs
curl http://127.0.0.1:<isolated-port>/health
stop process → start with the same isolated data directory → query /health
```

## Limits

This is a local deployment/restart smoke only. It does not prove live LinkedIn
publication, ORCA semantic activation, platform acceptance, independent
permalink discovery, live provider metrics, or arbitrary Product Factory
build/render execution.
