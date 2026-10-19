# ORCA runtime-version pinning verification — 2026-10-19

## Scope

Read-only review of the current patch at HEAD `5519b80`. No source, journal,
canonical runtime, browser/session, credentials, social state, or UNKNOWN
records were modified.

Acceptance IDs:

- **A1** preserve the provider-neutral transport abstraction and deterministic
  transport identity.
- **A2** verify runtime-version pinning occurs before durable submit intent.
- **A3** preserve `COMMAND_COMPLETED != semantic activation` and UNKNOWN
  semantics.
- **A4** preserve exact-once/no duplicate browser input and no transport switch
  after intent.
- **A5** avoid introducing a duplicate browser abstraction.
- **V2** focused transport/LinkedIn/JEV tests pass.
- **V7** irreversible live LinkedIn proof remains unproven.

## Findings

### A1 — PASS

The patch extends the existing `BrowserInteractionTransport` seam with
`assertReadyForFinalSubmit`; it does not create a second browser abstraction.
ORCA accessibility and pointer transports retain the same normalized receipt,
preflight validation, deterministic identity, and transport selection path.

`selectCertifiedTransport` now requires non-empty exact equality between the
runtime version, certification record version, and transport identity version.
Unknown or mismatched versions fail with `TRANSPORT_NOT_CERTIFIED`.

### A2 — PASS

`OrcaCliClient.probeRuntimeVersion()` invokes the configured executable with
`--version` using a bounded read-only process call and records an observed
version separately from the configured certification pin. `assertRuntimeVersion`
fails closed for an unpinned runtime and for mismatches.

Both ORCA transports invoke the runtime guard before provider input. The
`LinkedInAdapter` submit boundary invokes `assertReadyForFinalSubmit` before
`beforeSubmitIntent`, so a version failure occurs before durable submit intent
and before any final input. Regression coverage explicitly confirms an
unpinned ORCA runtime is rejected before intent.

### A3 — PASS

The patch does not conflate runtime readiness with activation. Transport
receipts still report `COMMAND_COMPLETED` and `transportReceipt()` retains
`activation: null`; semantic activation remains a separate observation layer.
A runtime mismatch is a pre-submit failure, not an UNKNOWN publication claim.

### A4 — PASS (bounded)

The patch adds no retry or second click. Existing durable-intent fences,
execution lease/idempotency checks, UNKNOWN quarantine, and
`assertTransportCannotChangeAfterIntent` remain in place. Version probing is
read-only and occurs before intent. Focused tests retain duplicate-dispatch,
post-intent fence, and UNKNOWN/no-retry coverage.

### A5 — PASS

Only the existing ORCA client and transport abstraction were extended. No
Playwright/CDP/second campaign store/provider router/browser layer was added.

### V2 — PASS

Command run:

```text
node --test test/browser-interaction-transport.test.mjs \
  test/click-transport.test.mjs \
  test/linkedin-verification.test.mjs \
  test/jev-execution-worker.test.mjs
```

Result: **102 tests, 102 passed, 0 failed, 0 skipped**.

Static checks also passed:

```text
node --check src/orca-browser-client.mjs
node --check src/browser-interaction-transport.mjs
node --check src/linkedin-adapter.mjs
git diff --check
```

### V7 — PASS (boundary preserved)

The patch does not claim or perform irreversible publication. ORCA CLI
`--version` reports `1.4.229`; host observations include ORCA daemon processes
at `1.4.229`, plus older `1.4.227` and translocated `1.4.224` processes. The
new executable probe protects the configured lane, but real LinkedIn Post
activation, platform acceptance, independent discovery, permalink/post ID,
and VERIFIED publication remain unproven. No Post/Publish control was clicked.

## Remaining limitation

The guard verifies the configured executable's version, not every already
running host process. The selected executable/process lane must still be
controlled by the live runtime before any future irreversible proof. This is
appropriately fail-closed for unknown or mismatched executable output.

## Status

**PASS (bounded)**

The patch closes the identified unknown-version wildcard before durable submit,
preserves existing safety and evidence-layer semantics, and passes the focused
102/102 gate. It does not certify or attempt an irreversible LinkedIn publish.
