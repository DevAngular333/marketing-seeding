# Product Factory safety observability

## Result

**PASS (local, read-only).** The existing Product Factory sandbox capability
preflight is now visible through the existing `/health` and `/api/dashboard`
projections and Mission Control. The projection keeps the host backend result,
profile/check/limit status, effective eligibility and unsafe-command policy
separate. It cannot execute a project, promote an artifact, create authority,
or trigger browser/social work.

## Behavior

- The host probe is cached for 15 seconds and can be forced only in service
  tests; repeated dashboard reads do not spawn an unbounded process.
- Probe errors return `UNAVAILABLE`, `executionEligible: false`, and
  `NOT_EXECUTED_UNSAFE`.
- Projection sanitizes backend/profile/check/limit values to bounded allowlists.
  Paths and arbitrary status text are not exposed.
- Mission Control shows the capability state and why build/render remains
  blocked. It has no action or approval control.

## Evidence class

`LOCAL_REAL` service/API/UI projection over a local host capability probe and
synthetic injected probe fixtures. No registered product command, browser,
ORCA, credential, network, canonical state, LinkedIn or social action ran.
