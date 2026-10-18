# Product Factory sandbox capability inventory — 2026-10-19

## Scope

Read-only host capability audit for the Product Factory arbitrary build/run/render
lane. No project code was executed, no credentials or canonical runtime state were
opened or changed, and no browser or external platform action occurred.

## Host inventory

- Host: macOS 15.8.1 (Darwin 24.6.0, arm64).
- `/usr/bin/sandbox-exec` is present and executable. It is the deprecated macOS
  sandbox wrapper, not an independently audited Product Factory profile.
- No `docker`, `podman`, `nerdctl`, `lima`, `colima`, `qemu-system-*`,
  `firecracker`, `hyperkit`, `VBoxManage`, `vmrun`, `utmctl`, or `vzctl`
  executable is installed or on `PATH`.
- No Docker/Podman/OrbStack/Lima/UTM/VMware/Parallels application was present
  in `/Applications` and no corresponding runtime process/service was observed.
- Virtualization and Hypervisor framework directories exist as OS APIs, but no
  provisioned VM manager, guest image, policy, or lifecycle controller is
  available to the Product Factory. Framework presence alone is not an audited
  confinement backend.

## Existing backend probe

The existing `probeFactorySandboxCapability()` invocation of
`sandbox-exec -n no-network /usr/bin/true` succeeds, but the probe correctly
leaves profile integrity, filesystem scope, child-process policy, timeout
cleanup, and resource limits as `UNSUPPORTED`. Therefore:

- `status = UNSUPPORTED`
- `executionEligible = false`
- `unsafeCommandDisposition = NOT_EXECUTED_UNSAFE`

Earlier harmless checks also showed that the built-in named profile did not
confine reads to a temporary root. This prevents treating backend presence or a
successful wrapper invocation as Product Factory isolation.

## Decision

No safe local remediation is available. There is no already provisioned,
auditable container/VM backend that can prove all required checks. Do not enable
arbitrary project build/render execution and do not add a speculative backend
adapter. Keep the Product Factory lane fail-closed and continue bounded
syntax/static evidence collection only.

## Resume condition

Revisit when an independently provisioned backend can attest, on this host, to
network denial, filesystem scope, child-process policy, timeout/process-tree
cleanup, and CPU/memory/resource limits under a versioned Product Factory
profile. The attestation must be testable without running arbitrary untrusted
project code.
