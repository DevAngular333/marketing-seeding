# Product Factory sandbox feasibility probe (2026-10-19)

## Result

**NOT CERTIFIED / fail-closed retained.** No Product Factory source or execution policy was changed. Arbitrary repository build, run, render, package-manager, and media commands remain `NOT_EXECUTED_UNSAFE` with `executionEligible=false`.

## Synthetic host probes

All probes used a newly-created `/tmp` fixture containing a sentinel file and a shell probe. No registered repository, browser profile, credentials, canonical state, network write, or social action was touched.

- Host: macOS Darwin 24.6.0, arm64.
- `/usr/bin/sandbox-exec` exists and is executable.
- A harmless invocation with the repository's existing probe shape (`sandbox-exec -n no-network /usr/bin/true`) is **not evidence of a usable policy**: this host reports `no-network: profile not found` (exit 65).
- A permissive synthetic profile (`(version 1) (allow default)`) can launch `/usr/bin/true` (exit 0), which only proves wrapper invocation.
- A deny-default profile with a narrow `/bin/sh` executable/file allowlist terminated the child with exit 134 before producing probe output. This demonstrates that profile syntax/runtime behavior needs an independently reviewed compatibility harness; it does not prove filesystem, network, descendant, timeout, or resource isolation.
- `/usr/bin/sandbox-exec` exposes only profile-file/name/string selection; no repository-owned versioned profile or resource-limit contract is present.

## Required certification checks

The Product Factory capability contract requires repeatable evidence for all of:

1. profile integrity/version pin;
2. network denial;
3. filesystem scope and symlink/path escape resistance;
4. child-process and descendant policy/cleanup;
5. timeout cleanup;
6. CPU, memory, process, and output/resource limits.

None of these can be honestly marked `PASS` from the probes above. Backend presence and successful harmless commands are insufficient. A profile that crashes a synthetic process is not a safe execution proof.

## Decision

Keep the existing preflight's `UNSUPPORTED` checks and fail-closed behavior. Do not enable arbitrary Product Factory commands. Closing blocker `PRODUCT-FACTORY-SANDBOX-001` requires an independently audited backend/profile plus hostile-fixture regression tests proving every required check and cleanup behavior. The current macOS host does not provide that evidence.

## Verification

- `node --test test/product-factory.test.mjs test/product-factory-runtime.test.mjs`: previously recorded **23 passed, 0 failed, 0 skipped**.
- `node --check src/product-factory.mjs`: pass (previously recorded).
- `git diff --check`: pass (no source changes in this probe).
