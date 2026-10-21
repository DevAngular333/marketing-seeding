# Product Factory / SYSTEM_AGENTIC_AI execution backend audit

**Date:** 2026-10-21  
**Classification:** LOCAL_REAL (source inspection and synthetic local checks)  
**External side effects:** none

## Reconciliation — source baseline 1073caf

The narrow adapter described by the earlier decision below is now present in
`src/product-factory.mjs`: it reuses the frozen typed executor, stages the
existing allowlisted syntax probe, routes Node through `/usr/bin/env node`,
and preserves fail-closed behavior. A bounded local-real smoke passed on
2026-10-21 at 10:56:46Z with no external side effect; see
`plans/autonomous-build/product-factory-seatbelt-adapter/local-real-smoke-20261021.json`.

The earlier conclusion that no adapter had been added is historical and is
superseded by that narrow seam. The production boundary remains unchanged:
the smoke does not establish arbitrary build/render/package-manager support,
and no independent `factory-sandbox-v1` attestation is persisted or enabled.

## Decision

The frozen `SYSTEM_AGENTIC_AI` workbench does contain a reusable, strict
execution backend: `products/agent-runtime/tool_executor.py`. It creates a
fresh macOS Seatbelt profile per typed command, denies inbound and outbound
network access, restricts reads to the assigned workspace and approved system
runtime roots, limits writes to scratch (and the assigned workspace only for
`WORKSPACE_WRITE`), bounds command time/output, and kills the process group on
timeout/cancellation. The queue/LaunchAgent path is covered by the existing
typed `workspace_exec` / `run_tests` contract.

This is **not currently a safe Product Factory adapter**. The backend contract
is queue-specific and only exposes two typed command kinds; it has no
provider-neutral Product Factory request/receipt contract, artifact staging
semantics, or independently attested `factory-sandbox-v1` profile. Calling
`tool_executor.py` directly from marketing-seeding would bypass the existing
queue/worker ownership and would create an unversioned second execution path.
Calling the queue CLI from Product Factory would likewise couple the domain to
private SQLite/LaunchAgent details, contrary to the frozen backend boundary.

Therefore no adapter or Product Factory execution eligibility was added. The
existing `executionEligible === false` gate remains correct and the
`PRODUCT-FACTORY-SANDBOX-001` blocker remains open.

## Evidence

### Shared backend source

- `products/agent-runtime/tool_executor.py:71-218` validates typed requests,
  rejects `ELEVATED`, resolves executables against approved paths, requires
  `sandbox-exec`, creates a per-command scratch directory, applies the Seatbelt
  profile, denies network, enforces timeout/cancellation, bounds output, and
  reports execution status separately from exit code.
- `products/agent-runtime/agentic_runtime.py:363-443` owns the typed queue
  insertion, single-worker claim, cancellation, and result persistence.
- `products/agent-runtime/README.md` documents that the queue is a shared
  Tool Runtime lane, not a Product Factory API; no generic artifact/build
  contract is published.

### Marketing Product Factory source

- `src/product-factory.mjs:93-220` deliberately treats backend presence as
  insufficient and requires explicit checks for profile integrity, network,
  filesystem, child-process policy, timeout cleanup, and resource limits.
- `src/product-factory.mjs:331-395` only executes the existing narrow staged
  syntax/static probes. Its direct spawn path is not the shared Seatbelt
  executor and is not used for arbitrary repository build/render commands.
- `src/service.mjs` projects the probe read-only and fail-closed; no caller
  promotes `executionEligible` to authority or publication capability.

## Synthetic verification

Commands run:

```text
PYTHONPATH=products/agent-runtime python3.12 -m unittest discover \
  -s products/agent-runtime/tests -p 'test_*.py' -q
→ 33 tests, OK

PYTHONPATH=products/agent-runtime python3.12 - <<'PY' ... execute_command(...) ...
→ COMPLETED, exit_code=0, stdout=factory-audit-ok
```

The direct check used a temporary directory and `/usr/bin/printf`; it did not
read credentials, touch canonical marketing state, access a browser profile,
use network, or invoke a registered product build/render command.

An earlier invocation without `PYTHONPATH=products/agent-runtime` failed to
import the test module (`local_agent`); this was a test-environment path issue,
not a backend failure. The corrected run passed all 33 tests.

## Reuse conditions

The backend can become a Product Factory substrate only after a shared,
versioned adapter contract is introduced and independently reviewed. That
contract must preserve the current queue ownership and add explicit artifact
staging, command/resource limits, receipt identity, and profile attestations.
Until then, Product Factory should continue its bounded evidence/syntax probes
and report `NOT_EXECUTED_UNSAFE` for arbitrary build, render, package-manager,
or media-generation commands.

## Blocker conclusion

`PRODUCT-FACTORY-SANDBOX-001` is **OPEN / ENVIRONMENT_BLOCKER**. The existing
System-Agentic executor is strong reusable infrastructure, but its current
public seam is insufficient to certify arbitrary Product Factory execution.
No safety guard was weakened and no source code was changed.
