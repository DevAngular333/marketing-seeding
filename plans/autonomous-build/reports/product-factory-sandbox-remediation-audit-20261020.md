# Product Factory sandbox remediation audit — 2026-10-20

## Verdict

`PRODUCT-FACTORY-SANDBOX-001` remains an `EXTERNAL_HARD_BLOCKER` for arbitrary
project build/render execution on this host. No implementation change is safe
without weakening the existing fail-closed contract.

## Evidence

- `src/product-factory.mjs` requires all seven checks to be `PASS` before
  `executionEligible` can become true: backend invocation, profile integrity,
  network denial, filesystem scope, child-process policy, timeout cleanup and
  resource limits.
- The only discovered host backend is `/usr/bin/sandbox-exec` on macOS 15.8.1
  (arm64). `sandbox-exec -n no-network /usr/bin/true` can prove a harmless
  backend invocation only.
- No `bwrap`, `firejail`, `docker`, `podman`, or `gtimeout` backend is present.
- `sandbox-exec` is deprecated on this host. Its presence does not provide an
  independently reviewed product profile, resource-limit proof, or descendant
  cleanup proof required by the contract.
- `executeFactoryPlan` is intentionally limited to narrow syntax/static probes
  and is not connected to an audited arbitrary-command sandbox.

## Safety conclusion

Do not mark the sandbox available, do not execute arbitrary project scripts,
and do not promote the harmless wrapper invocation into a production sandbox
claim. Existing `NOT_EXECUTED_UNSAFE` behavior is correct. A future milestone
needs an independently reviewed backend/profile plus representative network,
filesystem, child-process, timeout/descendant-cleanup and resource-limit
probes before eligibility can be enabled.

## Commands

- `rg` source/tests/plans inspection
- `command -v` checks for local sandbox/container primitives
- `/usr/bin/sandbox-exec -h` capability inspection (no project code executed)
- `sw_vers`, `uname -a`
