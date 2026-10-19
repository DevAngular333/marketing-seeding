# Product Factory sandbox feasibility re-audit (2026-10-19)

## Decision

**No implementation enabled.** The Product Factory remains fail-closed for arbitrary project build, run, render, package-manager, or media generation commands. `executionEligible` remains `false` and unsafe manifests remain `NOT_EXECUTED_UNSAFE`.

## Host evidence

- Host: Darwin 24.6.0, arm64.
- `/usr/bin/sandbox-exec` is present and can execute the harmless `-n no-network /usr/bin/true` probe (backend invocation only).
- The host command is deprecated and this repository has no versioned, audited profile proving the required policy.
- No independently managed `bwrap`, `firejail`, `podman`, or `docker` executable is available on `PATH`.

## Required isolation evidence still missing

The Product Factory capability contract requires repeatable evidence for profile integrity, network denial, filesystem scope, child-process and descendant cleanup, timeout cleanup, and CPU/memory/process/resource limits. Backend presence and a successful harmless wrapper invocation do not establish these properties. The current preflight correctly reports `UNSUPPORTED` for unproven checks and therefore cannot authorize arbitrary repository code.

## Existing safe seam verified

The existing implementation remains bounded and safe for its current scope: classification, strict shell-free syntax/static checks, temporary staging, symlink exclusion, path containment, bounded output/time, redaction, artifact hashing and cleanup. It performs no browser, network, credential, canonical-state, or social-platform action. No new abstraction, store, router, provider, or state machine was added.

## Verification

- `node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs`: **23 passed, 0 failed, 0 skipped**.
- `node --check src/product-factory.mjs`: pass.
- `git diff --check`: pass.
- Host capability probes and all tests used synthetic/local fixtures only; no registered customer repository or external side effect was used.

## Resume condition

Close `PRODUCT-FACTORY-SANDBOX-001` only after an independently audited backend/profile supplies the missing network, filesystem, child-process/descendant cleanup and resource-limit evidence, with adapter and hostile-fixture regression tests. Until then, retain fail-closed behavior.
