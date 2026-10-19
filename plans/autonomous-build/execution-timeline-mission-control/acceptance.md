# Execution Timeline Mission Control — Acceptance

## Requirements

- **A1** Expose a bounded chronological execution timeline through the existing read-only `executionRuntime` projection.
- **A2** Use only existing execution requests/receipts/UNKNOWN records; do not create a second store, route, state machine, authority path, or browser action.
- **A3** Keep execution and post references fingerprinted, keep publication status fail-closed, and preserve `COMMAND_COMPLETED != PUBLICATION_VERIFIED`.
- **A4** Render the timeline in the existing Mission Control execution evidence panel without adding controls or external links for unverified rows.
- **A5** Preserve UNKNOWN quarantine and immutable markers; do not expose raw content, credentials, cookies, tokens, profile material, or raw execution identifiers.

## Constraints

- **C1** No LinkedIn, browser, ORCA, credential, network-write, or social side effect.
- **C2** No canonical runtime mutation and no change to historical UNKNOWN records.
- **C3** SYSTEM_AGENTIC_AI Core, authorization, grant/window/lease, submit, verifier, and transport semantics remain unchanged.
- **C4** Keep the dashboard read-only and bounded.

## Verification

- **V1** Focused projection tests cover deterministic bounded ordering and redaction.
- **V2** Existing dashboard/server and full Node suites pass with zero new failures.
- **V3** UI typecheck and production build pass.
- **V4** Independent review confirms no authority or external-effect path was added.
