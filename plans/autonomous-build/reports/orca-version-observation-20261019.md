# ORCA version observation — 2026-10-19

## Evidence

- The configured CLI executable `/Applications/Orca 2.app/Contents/Resources/bin/orca`
  reports version `1.4.229`.
- Read-only process inspection also found older host-managed ORCA process
  observations advertising `1.4.227` and a translocated app advertising
  `1.4.224`.

## Interpretation

This is process/runtime version skew evidence, not a publication attempt. No
process was stopped, restarted, logged out, or otherwise mutated. The existing
transport certification remains valid only for its recorded fixture and
reversible LinkedIn scope. Before any future irreversible lane, the worker must
pin the executable/profile and verify the live process version as part of
readiness; otherwise the lane must fail closed.

## Safety

No credentials, cookies, tokens, browser storage, session values, LinkedIn Post
control, social action, canonical state or historical UNKNOWN record was touched.
