# Product Factory Sandbox Audit (2026-10-19)

## Result

**NOT ENABLED — ENVIRONMENT_BLOCKER remains open.** No safe, independently audited host sandbox is available for arbitrary repository build/render execution. The Product Factory remains fail-closed (`executionEligible: false`, `NOT_EXECUTED_UNSAFE`).

## Host evidence

- Host: Darwin 24.6.0, arm64.
- `/usr/bin/sandbox-exec` exists and accepts the deprecated CLI.
- A harmless `sandbox-exec -n no-network /usr/bin/true` invocation succeeds. This proves backend invocation only; it does not prove a profile's policy or isolation.
- The system manual labels `sandbox-exec` **DEPRECATED**. No managed VM/container or separately versioned profile is present in this repository.

## Required checks not evidenced

The current probe intentionally reports `UNSUPPORTED` for profile integrity, network denial, filesystem scope, child-process policy, timeout/descendant cleanup, and resource limits. No evidence proves these controls against hostile or representative project code. Therefore enabling arbitrary scripts, package managers, renderers, browser access, network access, or credential access would violate the existing fail-closed contract.

## Existing implementation reviewed

`src/product-factory.mjs` currently:

- classifies repositories and derives a strict shell-free allowlist;
- permits only bounded syntax checks or an internal static validation command;
- copies to temporary staging, excludes symlinks and ignored directories, bounds output/time, redacts command output, hashes bounded artifacts, and cleans staging;
- requires all seven sandbox checks to be `PASS` before `AVAILABLE`; no production caller uses eligibility to authorize arbitrary commands.

This is sufficient for local evidence probes, not general project execution.

## Verification

- `node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs`: focused factory safety tests pass (23/23 in the existing audit run).
- `node --check src/product-factory.mjs src/service.mjs`: pass.
- `git diff --check`: pass.
- No project build/render command, browser, network, credential, canonical runtime, or social side effect was executed.

## Resume condition

Close `PRODUCT-FACTORY-SANDBOX-001` only after a separately audited backend/profile supplies repeatable evidence for network policy, filesystem scope, child-process and descendant cleanup, timeout handling, and CPU/memory/process/resource limits, with adapter tests preserving fail-closed behavior.
