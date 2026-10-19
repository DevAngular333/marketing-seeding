# Product Factory sandbox capability reassessment — 2026-10-19

## Scope and safety

This is a read-only host and source audit. I did not run repository code, start a repository process, alter source/canonical state, use credentials, touch a browser session, or perform an external action. The existing Product Factory safety boundary remains unchanged.

## Finding

`PRODUCT-FACTORY-SANDBOX-001` remains an **environment blocker**, not an implementation defect that can be safely repaired in this worktree. The current Product Factory has a sound fail-closed capability seam, but this host does not provide an independently auditable backend/profile that proves the controls required for arbitrary repository build/run/render/media generation.

The host is macOS 15.8.1 (Darwin 24.6.0, arm64). `/usr/bin/sandbox-exec` exists and a harmless pre-defined `no-network` wrapper invocation exits successfully. The tool's own manual marks `sandbox-exec` **DEPRECATED**. The production probe intentionally reports only backend invocation as PASS; profile integrity, network denial, filesystem scope, child-process policy, timeout cleanup, and resource limits remain `UNSUPPORTED`, therefore `executionEligible` remains `false`.

## Evidence

### Existing implementation

- `src/product-factory.mjs` has a versioned `factory-sandbox-v1` capability evaluator and preflight probe.
- Eligibility requires PASS for all seven checks: backend invocation, profile integrity, network denial, filesystem scope, child-process policy, timeout cleanup, and resource limits.
- `executeFactoryPlan()` is deliberately narrower than arbitrary execution: it accepts only shell-free, repository-confined syntax/static checks. Manifest scripts, package managers, interpreters, renderers, and arbitrary project commands are rejected or reported `NOT_EXECUTED_UNSAFE`.
- `executeStagedFactoryProbe()` copies an eligible source tree into temporary staging, removes symlinks, bounds output/time, and cleans staging. These are useful evidence-probe controls, not a hostile-code sandbox.
- No caller consumes an unproven `executionEligible` value to widen the command allowlist.

### Host capability

- `sandbox-exec` is present at `/usr/bin/sandbox-exec`; `sandbox-exec -n no-network /usr/bin/true` succeeds.
- The installed manual explicitly labels it deprecated and documents only profile invocation; it does not supply an audited Product Factory profile or resource policy.
- No Docker, Podman, Lima, nerdctl, bubblewrap, or firejail executable/application was found in the inspected standard locations/PATH. Hypervisor support is present (`kern.hv_support=1`), but hardware support is not a provisioned VM/container, image, policy, or cleanup contract.
- A direct ad-hoc profile probe did not produce a validated Product Factory profile. No profile was adopted, and no arbitrary command was executed.

### Current verification

Existing focused evidence records the fail-closed contract (Product Factory tests, runtime/service tests, source syntax checks, and `git diff --check`). The relevant tests cover unavailable backends, backend invocation versus profile attestation, all-PASS synthetic evaluator behavior, unsafe manifest rejection, staging cleanup, timeout/failure, path traversal, artifact bounds, and service projection. They do not and cannot certify the host's missing isolation/resource guarantees.

## Required controls still unproven

To enable arbitrary product commands, a separately reviewed backend/profile must provide measurable evidence for all of the following:

1. network denied by policy (including child processes);
2. filesystem read/write confined to an explicit staging/output scope;
3. child-process and executable policy enforced transitively;
4. timeout termination and descendant cleanup, including stubborn children;
5. CPU, memory, process-count, disk, and output limits;
6. profile integrity/version pinning and deterministic invocation;
7. no access to credentials, browser profiles, canonical state, or unrelated host data;
8. reproducible audit artifacts and regression tests for the backend itself.

The deprecated macOS wrapper may help express some deny rules, but current evidence does not prove all controls, especially transitive descendant cleanup and resource limits. A successful `true` invocation is transport/backend evidence only and must not be promoted to `AVAILABLE`.

## Decision

**Do not implement or enable a new sandbox in this integration wave.** Adding an ad-hoc `sandbox-exec` profile would create a false security boundary and would require architecture/runtime ownership for profile distribution, resource enforcement, audit attestation, and recovery. That would be a new execution substrate, not a safe seam repair.

Keep:

- `executionEligible: false` on this host;
- arbitrary build/run/render/media commands fail-closed;
- existing syntax/static evidence probes and artifact hashing;
- no package installation, renderer, browser, network, credential, or arbitrary script execution from Product Factory;
- no change to campaign authority, publication, ORCA, or UNKNOWN semantics.

## Resume condition

Revisit only after provisioning one of:

- an independently managed VM/container runtime with a pinned image and explicit network/filesystem/process/resource policy; or
- a separately reviewed host sandbox adapter with reproducible profile, descendant cleanup, resource-limit, and audit evidence.

The adapter must satisfy the existing all-PASS evaluator and add backend-specific integration tests before any command allowlist expansion.

## Classification

- Product Factory bounded inspection/static evidence: **LOCAL-VERIFIED / WORKING**.
- Arbitrary repository build/run/render/media execution: **NOT_IMPLEMENTED SAFELY / BLOCKED**.
- Blocker class: **ENVIRONMENT_BLOCKER / EXTERNAL_HARD_BLOCKER for this host lane**.
- No source or architecture change recommended from this reassessment.
