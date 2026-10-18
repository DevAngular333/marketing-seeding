# Product Factory sandbox capability preflight — acceptance

## Requirements

- **A1** Report a versioned, deterministic sandbox capability result with
  explicit backend and profile status: `AVAILABLE`, `UNAVAILABLE`, or
  `UNSUPPORTED`.
- **A2** Probe only a harmless synthetic command and record bounded checks for
  backend invocation, network denial, filesystem scope, child-process policy,
  timeout cleanup, and resource limits. Unknown or unverified checks remain
  `UNSUPPORTED`.
- **A3** Set `executionEligible` to `true` only when every required isolation
  and resource-limit check is proven. The current macOS `sandbox-exec`
  presence must therefore remain ineligible because its profile and limits are
  not audited by this product.
- **A4** Keep arbitrary repository build, render, package-manager and script
  execution at `NOT_EXECUTED_UNSAFE` unless a future audited sandbox explicitly
  enables it. The preflight result must never grant publication authority.
- **A5** Do not read credentials, browser profiles, canonical state, network
  resources, or registered product repositories during the probe.

## Constraints

- **C1** Reuse `src/product-factory.mjs` and the existing staged factory seam;
  do not add a store, router, provider, browser, or execution state machine.
- **C2** Use only temporary synthetic fixtures in tests. Do not run an actual
  customer/project build or render command.
- **C3** Preserve LinkedIn/JEV/ORCA, authorization, grant, window, lease,
  idempotency, publication verification, and UNKNOWN semantics.
- **C4** Do not mutate canonical runtime, authenticated sessions, credentials,
  social platforms, or protected UNKNOWN records.

## Verification

- **V1** Focused preflight tests cover backend unavailable, backend detected but
  profile/limits unsupported, deterministic output, and fail-closed eligibility.
- **V2** Existing Product Factory tests continue to prove unsafe manifest
  commands stay unexecuted and staged syntax checks remain bounded.
- **V3** Full Node suite passes with zero failures; existing skips are reported.
- **V4** Source syntax and diff checks pass.
- **V5** Journal records this as local/synthetic capability evidence only; no
  production sandbox or arbitrary build/render support is claimed.
