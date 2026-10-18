# Mission Control Execution Evidence UI

## Requirements

- **A1** Reuse the existing `/api/dashboard` `executionRuntime` read model.
- **A2** Show execution phase/state evidence with explicit DRY_RUN, LIVE and UNKNOWN distinctions.
- **A3** Show a permalink only when the backend projection supplies one from independent VERIFIED evidence.
- **A4** Show bounded blockers and immutable UNKNOWN quarantine status without raw execution IDs, payloads, credentials or controls.
- **A5** Preserve the existing dashboard role as OBSERVE / UNDERSTAND / STEER; add no approval, dispatch, retry or mutation action.

## Constraints

- **C1** No backend, store, schema, authority, worker, adapter or LinkedIn semantic changes.
- **C2** No ORCA, browser, network, credential or social action.
- **C3** Missing or malformed `executionRuntime` data renders safe UNKNOWN/empty states.
- **C4** Keep SYSTEM_AGENTIC_AI Core frozen.

## Verification

- **V1** TypeScript check and UI production build pass.
- **V2** Existing Node suite remains green with no new failures.
- **V3** Diff review confirms read-only UI only and no raw identifiers/secrets.
