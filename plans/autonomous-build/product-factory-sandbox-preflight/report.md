# Product Factory sandbox capability preflight

## Result

**PASS (fail-closed local capability report).** Product Factory now exposes a
versioned sandbox capability preflight. It distinguishes backend detection from
effective execution eligibility and records unsupported isolation or resource
limits instead of inferring safety from the presence of `sandbox-exec`.

On this macOS host `/usr/bin/sandbox-exec` can run a harmless `true` command,
but the profile is not audited by the product and resource/descendant limits
are not proven. The effective result is therefore `UNSUPPORTED` with
`executionEligible: false`.

## Evidence class

`LOCAL_REAL` host capability detection plus synthetic fixture tests. No
registered product repository, browser profile, credential, network resource,
canonical state, ORCA command, or social platform was used.

## Safety boundary

This preflight is observability only. It cannot authorize arbitrary project
build/render commands, create publication authority, or change existing
`NOT_EXECUTED_UNSAFE` behavior. Temporary staging remains isolation for the
existing narrow syntax probe, not a general OS sandbox.

## Verification

- Focused preflight/Product Factory tests: recorded in `test-results.md`.
- Full Node suite: recorded in `test-results.md`.
- `node --check src/product-factory.mjs` and `git diff --check`: required.
