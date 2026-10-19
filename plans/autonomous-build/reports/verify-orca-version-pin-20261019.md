# ORCA version pin and transport seam verification — 2026-10-19

## Scope

Read-only verification at integration HEAD `5519b80`. Inspected:

- `src/orca-browser-client.mjs`
- `src/browser-interaction-transport.mjs`
- `src/linkedin-adapter.mjs`
- `src/transport-certification.mjs`
- focused transport/LinkedIn/JEV tests
- configured ORCA executable and host process observations

No Post/Publish control was clicked, no content was entered, and no browser
session, canonical state, credential, social, or historical UNKNOWN record was
mutated.

## Acceptance results

### A1 — transport abstraction preserved: PASS

`BrowserInteractionTransport` remains the provider-neutral boundary. ORCA
accessibility and pointer implementations carry transport/provider/version
identity, require immediate pre-provider validation, and return normalized
transport receipts. `LinkedInAdapter` keeps one selected transport for the
execution and `assertTransportCannotChangeAfterIntent` prevents a transport
switch after durable submit intent.

### A6 — transport receipt is not activation: PASS

`transportReceipt()` sets `activation: null` and documents that activation must
be observed separately. The click path reports `COMMAND_COMPLETED`; semantic
activation is classified by post-action observation in the certification and
LinkedIn execution contracts. Focused tests explicitly cover command completion
without activation and preflight/command evidence remaining separate.

### V2 — focused transport gate: PASS

Command:

```text
node --test test/browser-interaction-transport.test.mjs \
  test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs \
  test/jev-execution-worker.test.mjs
```

Result: **98 tests, 98 passed, 0 failed, 0 skipped**.

### V7 — irreversible live proof remains unproven: PASS (boundary preserved)

No current code or evidence upgrades ORCA to irreversible LinkedIn submit
certification. Existing evidence is limited to local/reversible activation;
real Post activation, platform acceptance, independent permalink discovery and
VERIFIED publication remain unproven.

## Runtime-version observation

The pinned executable reports:

```text
/Applications/Orca 2.app/Contents/Resources/bin/orca --version
1.4.229
```

Host process inspection simultaneously showed ORCA process generations with
`--app-version 1.4.229`, `--app-version 1.4.227`, and a translocated process
with `--app-version 1.4.224`. This is version skew evidence only; no process
was stopped or restarted.

## Version-pin seam finding

A narrow fail-closed runtime-version fix is **JUSTIFIED**; the existing seam is
not sufficient for irreversible use:

1. `OrcaCliClient` accepts `ORCA_VERSION` or an injected `providerVersion`, but
   does not query and pin the executable's actual `--version` output. A normal
   server construction therefore has `runtimeVersion = null` unless an
   environment override is supplied.
2. `selectCertifiedTransport()` treats a missing runtime version as a wildcard
   (`!runtime.providerVersion`), allowing a certification record to match even
   when the active provider version is unknown. This is unsafe for a certified
   transport boundary.
3. The default `LinkedInAdapter` constructs `OrcaAccessibilityTransport`
   directly, so version certification/selection is not automatically enforced
   at adapter construction. The existing final-submit validation contract still
   protects pre-provider target validation, but it does not prove executable
   version identity.
4. Current tests verify explicit version matching and receipt semantics, but do
   not verify that an unknown or skewed runtime is rejected before an
   irreversible transport can be selected.

The smallest correct follow-up is to obtain the executable version through a
read-only ORCA version probe (or an equivalent host-verified runtime identity),
require an exact non-empty version match for certified transports, and fail
closed when the observed version is missing or differs. The fix must preserve
`COMMAND_COMPLETED != activation`, deterministic selection, and the
no-transport-switch-after-intent rule. It must not infer irreversible
certification from local/reversible evidence.

This verification task intentionally did not edit source or tests; the finding
is a bounded implementation recommendation for the owning integration lane.

## Status

**FAIL** — bounded verification: transport abstraction and evidence separation
pass, but runtime version pinning/detection is insufficiently fail-closed for a
future irreversible submit. No live proof was attempted.
