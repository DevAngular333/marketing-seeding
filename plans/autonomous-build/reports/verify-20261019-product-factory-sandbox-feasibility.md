# Product Factory Sandbox Feasibility Audit — 2026-10-19

## Scope

Read-only audit of current Product Factory sandbox capability, execution seam, tests, and runtime evidence. No canonical state, browser/ORCA profile, credentials, external system, or source file was modified.

## Recommendation

**Do not enable arbitrary Product Factory execution in this integration wave.** A safe local implementation is limited to improving capability reporting and tests; it is not safe to promote `executionEligible` or widen the command allowlist without an independently audited isolation backend/profile.

If a future implementation is authorized, owned paths should remain narrowly separated:

- `src/product-factory.mjs`: versioned sandbox adapter/probe only.
- `src/service.mjs`: allowlisted capability projection/cache only.
- `test/product-factory.test.mjs` and `test/service.test.mjs`: synthetic capability and fail-closed regressions.
- `plans/autonomous-build/product-factory-sandbox-preflight/` and a new audit report: backend/profile evidence.

Do not add package installation, arbitrary scripts, renderers, browser access, network, or credential access to the current factory runner.

## Evidence-ranked findings

1. **Strong evidence — current host capability is insufficient.** `/usr/bin/sandbox-exec` exists and `sandbox-exec -n no-network /usr/bin/true` exits 0 on Darwin 24.6.0, but the probe intentionally marks profile integrity, filesystem scope, child-process policy, timeout cleanup, and resource limits `UNSUPPORTED`. The resulting status is `UNSUPPORTED`, `executionEligible: false`, and `unsafeCommandDisposition: NOT_EXECUTED_UNSAFE`.
2. **Strong evidence — command runner is narrow but not a general hostile-code sandbox.** `executeFactoryPlan()` rejects shell metacharacters, absolute binaries, interpreters/scripts/package managers, and unsafe paths; it runs only syntax checks or an internal static echo in a temporary copy. `copyToStaging()` removes symlinks and cleans the staging directory. These controls support evidence probes, not arbitrary project build/render behavior.
3. **Strong evidence — eligibility is fail-closed and not consumed to authorize execution.** `evaluateFactorySandboxCapability()` requires PASS for all seven checks; `SeedingService.productFactorySandboxCapability()` independently sanitizes checks and recomputes eligibility. Source comments explicitly state no caller currently consumes `executionEligible` to run project commands.
4. **Strong evidence — tests cover the safety contract.** Focused Product Factory/runtime tests passed 23/23, including unavailable backend, backend invocation versus audited profile, all-PASS synthetic evaluator, unsafe manifests, staging cleanup, timeout/failure, traversal rejection, and artifact bounds. Server/service tests assert the host projection remains ineligible.
5. **Unverified — real isolation proof.** No evidence proves network denial beyond the harmless wrapper invocation, filesystem confinement, descendant process termination, CPU/memory limits, cleanup under hostile behavior, or a versioned auditable profile. Enabling arbitrary commands would therefore violate fail-closed acceptance.

## Focused verification

```text
node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs --test-name-pattern='sandbox|factory run'
# 23 passed, 0 failed, 0 skipped

node --check src/product-factory.mjs src/service.mjs
# pass

git diff --check
# pass
```

## Acceptance mapping

- **A5 / A8:** PASS (bounded): local classification, allowlisted command planning, artifact hashes, and focused tests are present.
- **A1 / A6 / C2 / C3 / C5:** PASS (fail-closed): no authority, provider, credential, browser, or canonical-state path is added by the sandbox probe.
- **V3 / V4:** PASS (bounded): safety and Product Factory tests pass; projections remain read-only.
- **V7:** NOT APPLICABLE to local sandbox; live external publication remains unproven.
- Product Factory arbitrary build/render acceptance: **UNMET / environment blocker** until all isolation checks are independently evidenced.

## Safe next steps

1. Keep `executionEligible: false` on this host.
2. If pursuing feasibility, supply a separately audited managed VM/container or versioned macOS profile with measurable network, filesystem, child-process, timeout/cleanup, and CPU/memory controls.
3. Add an adapter contract test that cannot set `AVAILABLE` unless every check is independently attested; preserve the existing synthetic all-PASS evaluator test.
4. Re-run focused tests and an independent review before any command allowlist expansion.

## Status: PASS (bounded; arbitrary execution remains blocked)
