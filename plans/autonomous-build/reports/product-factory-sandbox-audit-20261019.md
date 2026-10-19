# Product Factory sandbox audit — 2026-10-19

## Scope

Read-only audit in `marketing-seeding-integration`. No source, canonical state,
browser, ORCA, network, or social mutation. The existing Product Factory seam
remains fail-closed in `src/product-factory.mjs`.

## Observed implementation

- `/usr/bin/sandbox-exec` exists and is executable on Darwin 24.6.0/macOS 15.8.1.
- Existing probe invokes only `sandbox-exec -n no-network /usr/bin/true` and records
  backend invocation. The implementation intentionally leaves profile integrity,
  filesystem scope, child-process policy, timeout cleanup, and resource limits as
  `UNSUPPORTED`; `executionEligible` is therefore `false`.
- Existing Product Factory command execution is argv-only, allowlisted, shell-free,
  temporary-staging based, bounded by timeout/output, and removes staging in a
  `finally` block. This is bounded evidence collection, not arbitrary project
  execution.

## Harmless host probes

1. `sandbox-exec -n no-network /usr/bin/true` returned `0`.
2. Under the same named profile, `/bin/cat` could read files in both a temporary
   `root` directory and a sibling `outside` directory. This proves the built-in
   profile does not provide Product Factory filesystem confinement.
3. Under the same profile, `curl` failed DNS resolution (`curl` exit 6). This is
   consistent with network denial but is not an independently audited profile or
   complete network policy proof.
4. A temporary custom profile with a deny-default policy exited `134` for all
   harmless commands. The profile was not accepted as a valid audited runtime;
   no attempt was made to weaken policy or retry with unsafe commands.
5. No safe, host-independent proof of child-process containment, timeout process
   tree cleanup, or memory/CPU/resource limits was obtained.

## Result

`PRODUCT-FACTORY-SANDBOX-001` remains **OPEN / EXTERNAL_HARD_BLOCKER** for
arbitrary build/render execution. A backend binary and a built-in no-network
profile are insufficient to mark the capability `AVAILABLE`. No remediation is
safe to merge without a versioned, audited profile adapter that proves all
required checks (profile integrity, network denial, filesystem scope,
child-process policy, timeout cleanup, and resource limits) on this host.

## Recommendation

Keep `executionEligible: false` and `unsafeCommandDisposition:
NOT_EXECUTED_UNSAFE`. Continue using the existing syntax-check/static evidence
probe only. Revisit when an auditable sandbox profile/runtime (for example a
managed VM/container or independently verifiable macOS profile with resource
limits and process-tree cleanup) is provisioned.

## Verification

No tests or source edits were needed for this read-only audit. Existing focused
Product Factory tests remain the authoritative regression gate.
