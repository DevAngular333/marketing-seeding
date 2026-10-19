# Product Factory sandbox capability audit — 2026-10-19e

## Scope and safety

Fresh read-only reassessment of the Product Factory execution boundary in the
`integration/autonomous-build` worktree. I inspected the existing source,
tests, journal entries, and host sandbox/runtime availability. I did not run any
repository build, render, package-manager, browser, ORCA, credential, network
write, canonical-state, or social command. No source or runtime state was
changed by this audit.

## Current implementation evidence

`src/product-factory.mjs` already has a versioned `factory-sandbox-v1`
capability evaluator and fail-closed preflight. `executionEligible` is true
only when every required check is independently reported `PASS`:

- backend invocation;
- profile integrity/version;
- network denial;
- filesystem scope;
- child-process policy;
- timeout and descendant cleanup;
- CPU/memory/process/output resource limits.

The current runner is intentionally narrower than arbitrary Product Factory
execution. It supports repository classification, shell-free allowlisted
syntax/static probes, temporary staging, symlink exclusion, path containment,
bounded output/time, redaction, artifact hashing, and cleanup. Manifest scripts,
package managers, arbitrary interpreters, renderers, browser access, and network
or credential access remain `NOT_EXECUTED_UNSAFE`. No caller promotes an
unproven preflight result into arbitrary command execution.

## Host capability observations

Host: macOS 15.8.1, Darwin 24.6.0, arm64 (Darwin 24.6.0). Read-only command
availability checks found:

- `/usr/bin/sandbox-exec` is present and executable.
- `docker`, `podman`, `nerdctl`, `lima`, `limactl`, `colima`, `bwrap`/
  `bubblewrap`, `firejail`, and QEMU system binaries are absent from PATH and
  inspected standard locations.
- Hardware virtualization support (`kern.hv_support=1`) exists, but there is no
  provisioned VM/container image, policy, lifecycle owner, or cleanup contract.
- The system sandbox profile directory is Apple-owned. No repository-owned,
  version-pinned Product Factory profile is present.
- `sandbox-exec` exposes profile selection (`-f`, `-n`, `-p`) only; backend
  presence does not attest profile behavior or resource enforcement. The tool is
  deprecated on this host.

A harmless wrapper invocation can establish only that the executable launches;
it cannot establish filesystem confinement, transitive child-process policy,
descendant cleanup, or CPU/memory/process/disk limits. Existing prior probes
also showed that built-in/ad-hoc profiles do not provide a complete audited
Product Factory boundary; no ad-hoc profile was adopted or retried here.

## Capability decision

`PRODUCT-FACTORY-SANDBOX-001` remains **OPEN** and is correctly classified as
an `ENVIRONMENT_BLOCKER` / `EXTERNAL_HARD_BLOCKER` for arbitrary repository
build/run/render/media execution on this host. There is no safe implementation
lane in the current repository that can honestly mark the all-PASS evaluator
`AVAILABLE`. Adding a new unsupervised `sandbox-exec` profile would create a
false security boundary and would be a new execution substrate, not a seam
repair.

The safe product behavior remains:

- `executionEligible: false`;
- unsafe commands stay `NOT_EXECUTED_UNSAFE`;
- bounded syntax/static evidence probes remain available;
- no package installation, renderer, browser, network, credential, or
  arbitrary-script execution is enabled.

## Required resume condition

Revisit only after an independently managed and reviewable backend/profile is
provisioned, with repeatable hostile-fixture evidence for:

1. network denial, including descendants;
2. explicit filesystem read/write scope and symlink/path escape resistance;
3. executable and child-process policy enforced transitively;
4. timeout termination and descendant cleanup, including stubborn children;
5. CPU, memory, process-count, disk, and output limits;
6. profile integrity/version pinning and deterministic invocation;
7. isolation from credentials, browser profiles, canonical state, and unrelated
   host data;
8. adapter integration tests that preserve fail-closed behavior.

Until these controls are independently evidenced, arbitrary Product Factory
execution must remain blocked. This is a host capability prerequisite, not a
missing campaign authorization that can be derived in software.

## Verification performed

- Read-only source/test/journal inspection.
- Host OS and executable capability inspection.
- No repository test/build/render command was run in this audit.
- No browser, ORCA, canonical-state, credential, or external side effect was
  touched.
